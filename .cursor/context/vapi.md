## Vapi Integration (Atlas Outbound)

This document explains our Vapi phone-call integration end-to-end: data model updates, Convex functions, webhook security, and how to use the API.

### Environment Variables
- VAPI_API_KEY: Server token for Vapi API.
- VAPI_PHONE_NUMBER_ID: Vapi phone number to originate calls from.
- VAPI_WEBHOOK_SECRET: Secret shared with Vapi (sent in `X-Vapi-Secret`) or used to compute/verify `X-Vapi-Signature`.
- CONVEX_SITE_URL: Public Convex HTTP URL (preferred) to construct the webhook endpoint, e.g. `https://<your-convex-deployment>.convex.site`.
- SITE_URL: Fallback if `CONVEX_SITE_URL` is not set.

Notes:
- Secrets are only accessed in Node runtimes (internal actions, HTTP handlers).
- Do not expose these to the browser or client queries/mutations.

### Data Model (convex/schema.ts)
We extended the `calls` table to track the Vapi lifecycle and meeting booking.

#### Calls Table Fields:
- vapiCallId: string? — The Vapi call identifier.
- assistantId: string? — Optional Vapi assistant id if persisting.
- phoneNumberId: string? — The Vapi phone number used to dial.
- dialedNumber: string? — The customer phone number dialed.
- transcript: Array<{ role, text, timestamp?, source? }>? — Structured fragments.
- outcome, meeting_time, status, duration: string/number? — State and timing.
- summary, recordingUrl, endedReason, billingSeconds, metadata: Post-call fields.
- startedAt, lastWebhookAt, currentStatus: Operational.
- assistantSnapshot: any? — Inline assistant payload used for the call (audit/debug).
- monitorUrls: { listenUrl? }? — Optional listen URL from Vapi monitor.
 - startedByUserId, startedByEmail: string? — User context captured at call start.

#### Meeting Booking Fields (NEW):
- offeredSlotsISO: string[]? — ISO timestamps of meeting slots offered during call.
- agencyAvailabilityWindows: string[]? — Raw availability strings (e.g., "Tue 10:00-12:00").
- futureMeetings: Array<{ iso: string }>? — Snapshot of upcoming meetings for context.
- bookingAnalysis: object? — AI analysis results with confidence, reasoning, and booking detection.

#### New Tables:
- **meetings**: Stores confirmed meeting bookings
  - agencyId, opportunityId, callId: References to related entities
  - meetingTime: number — Unix ms timestamp
  - source: string — Defaults to "ai_call"
  - createdBy: string? — Who created the meeting
- **client_opportunities**: Enhanced with meeting_time field for booked meetings

Indexes:
- calls: by_opportunity(opportunityId), by_agency(agencyId), by_vapi_call_id(vapiCallId)
- meetings: by_agency_and_time([agencyId, meetingTime])

### Backend Components

#### Calls API (convex/call/calls.ts)
- startCall (mutation)
  - Args: { opportunityId, agencyId }
  - Loads the opportunity and agency profile, validates presence of a phone number.
  - **NEW**: Fetches available meeting slots using `internal.call.availability.getAvailableSlots`.
  - Builds the inline assistant prompt from agency-approved claims, guardrails, core offer, target geography, opportunity's fit_reason, **and available meeting times**.
  - Inserts a `calls` row with status="initiated" and the assistant snapshot.
  - **NEW**: Captures initiating user context (`startedByUserId`, `startedByEmail`) via Better Auth when available.
  - **NEW**: Patches call record with availability metadata (offeredSlotsISO, agencyAvailabilityWindows, futureMeetings).
  - Schedules `internal.vapi.startPhoneCall` with meeting metadata via `ctx.scheduler.runAfter(0, ...)`.
  - Returns: { callId, vapiCallId: "pending" }

- updateStatusFromWebhook (internalMutation)
  - Lookup by `vapiCallId` and update `status`, `currentStatus`, `lastWebhookAt`.

- appendTranscriptChunk (internalMutation)
  - Lookup by `vapiCallId` and push a transcript fragment onto `transcript[]`.
  - Upstream webhook performs partial filtering so only speech or finalized transcript fragments reach this mutation.
  - Appends the fragment and updates `lastWebhookAt`; no additional dedupe is performed.

- finalizeReport (internalMutation)
  - Lookup by `vapiCallId` and persist `summary`, `recordingUrl`, `endedReason`, `billingSeconds`, and mark status as completed.

- getCallById, getCallsByOpportunity (queries)
  - Convenience read endpoints for the dashboard.

- **NEW**: getCallByIdInternal, getCallByVapiId (internalQuery)
  - Internal queries for accessing call data from actions.

- **NEW**: updateBookingAnalysis (internalMutation)
  - Updates call record with AI analysis results from transcript processing.

#### Vapi Node Runtime (convex/vapi.ts)
- startPhoneCall (internalAction)
  - Args: { callId, customerNumber, assistant, **NEW**: offeredSlotsISO?, agencyAvailabilityWindows?, futureMeetings? }
  - Reads `VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID`, `VAPI_WEBHOOK_SECRET`, and `CONVEX_SITE_URL` (or `SITE_URL`) from `process.env`.
  - Injects secure `server: { url: `${CONVEX_SITE_URL}/api/vapi-webhook`, secret: VAPI_WEBHOOK_SECRET }` and default `serverMessages` inside Node (not in public mutation).
  - **NEW**: Merges meeting availability metadata into `assistant.metadata` for Vapi context.
  - Default `serverMessages`: `["status-update", "speech-update", "transcript", "end-of-call-report"]` so we get live fragments plus finals; override per-call if needed.
  - POSTs to `https://api.vapi.ai/call/phone` with the inline assistant (squad.members[0].assistant = inlineAssistant).
  - On success, calls `internal.call.calls._attachVapiDetails` to patch the `calls` row with `vapiCallId`, `phoneNumberId`, and optional `monitor.listenUrl`.

- attachVapiCallDetails (internalMutation)
  - Args: { callId, vapiCallId, phoneNumberId, listenUrl? }
  - Patches the `calls` row with Vapi metadata.

#### Webhook (convex/http.ts)
- Route: POST `/api/vapi-webhook`
- Security: Prefer shared secret header `X-Vapi-Secret: <VAPI_WEBHOOK_SECRET>`. Falls back to HMAC-SHA256 verification of the raw request body compared against `X-Vapi-Signature` (hex digest) if the shared secret header is not present.
- Behavior:
  - Envelope unwrapping: If the incoming JSON has `message`, we treat `message` as the canonical payload. Otherwise we use the root object.
  - Identifier extraction: `vapiCallId = payload.call?.id || payload.id || payload.callId || req.headers['X-Call-Id']`.
  - type=status-update → `internal.calls.updateStatusFromWebhook({ vapiCallId, status })` using `payload.status || payload.data?.status`.
  - type=speech-update → `internal.calls.appendTranscriptChunk` with `{ role: payload.from || 'assistant', text: payload.text || payload.data?.text, source: 'speech' }`.
  - type=transcript →
    - If `payload.messages || payload.data?.messages` array exists, append each `{ role, text }` as `source: 'transcript'`.
    - Else if `payload.transcript` exists and `transcriptType !== 'partial'`, append a single fragment `{ role: payload.role || 'assistant', text: payload.transcript, source: 'transcript' }`.
    - Partials are detected via `transcriptType === "partial"` or type strings containing "partial"; they are skipped but logged for debugging.
  - type=end-of-call-report → `internal.call.calls.finalizeReport` with `summary`, `recordingUrl`, `endedReason`, `billingSeconds` pulled from root, `data`, `artifact`, or duration fields (seconds or ms). Values are rounded to the nearest second before storage.
  - **NEW**: After finalizing call report, triggers `internal.call.ai.processCallTranscript` via scheduler to analyze transcript for meeting bookings.
  - Logging: transcript fragments (including skipped partials) emit `[Vapi Webhook] Transcript fragment...`; billing extraction logs `[Vapi Webhook] Billing seconds extracted` showing raw vs stored values.
- Responds with `200 ok` quickly; logs errors without leaking details.

### Inline Assistant Construction
We generate the assistant payload dynamically per call:
- name: "Atlas AI Rep for <agency.companyName>"
- model: provider="openai", model="chatgpt-4o-latest", messages=[{ role: "system", content: ... }]
- system prompt includes:
  - agency.companyName, agency.coreOffer, agency.targetGeography
  - one of agency.approvedClaims
  - agency.guardrails (comma-separated)
  - opportunity.fit_reason (the gap we reference in the opener)
  - **NEW**: Available meeting times with instructions to suggest times and accept alternatives
- voice: PlayHT (jennifer, PlayDialog)
- transcriber: Deepgram (nova-3-general)
- firstMessageMode: "assistant-speaks-first"
- server: injected in `internal.vapi.startPhoneCall` from env in Node as `{ url, secret }`.
  - url: `${CONVEX_SITE_URL}/api/vapi-webhook` (preferred). Do not point to a Next.js/Vercel URL; use Convex's URL so the Convex httpAction receives requests.
- serverMessages: must be an array of string enums supported by Vapi (not objects). We currently request live updates plus finals:
  - `["status-update", "speech-update", "transcript", "end-of-call-report"]`
  - Other allowed values include: "conversation-update", "function-call", "hang", "language-changed", "language-change-detected", "model-output", "phone-call-control", "speech-update", "tool-calls", "transfer-destination-request", "handoff-destination-request", "transfer-update", "user-interrupted", "voice-input", "chat.created", "chat.deleted", "session.created", "session.updated", "session.deleted".
- **monitorPlan: REQUIRED for live listen URLs**:
  - `{ listenEnabled: true, controlEnabled: false }` - Without this, Vapi will NOT return `monitor.listenUrl` in the response
  - listenEnabled: true - Enables real-time audio streaming via WebSocket
  - controlEnabled: false - Set to true only if you need programmatic call control
  - listenAuthenticationEnabled/controlAuthenticationEnabled: Optional authentication flags (default false)
- metadata: convexOpportunityId, convexAgencyId, leadGenFlowId, **NEW**: offeredSlotsISO, agencyAvailabilityWindows, futureMeetings

### Call Lifecycle
1) Client calls `api.call.calls.startCall({ opportunityId, agencyId })`.
2) **NEW**: A preflight Autumn check via `internal.call.billing.ensureAiCallCredits` ensures the caller has at least 1 `atlas_credits` minute available. If not, the client surfaces the paywall and the call is blocked.
3) System fetches available meeting slots using Luxon timezone calculations.
4) A `calls` row is created with status="initiated"; assistant snapshot, availability metadata, and billing metadata (`billingCustomerId`, preflight balance) recorded.
5) `internal.vapi.startPhoneCall` runs (Node) with meeting context and calls the Vapi `call/phone` API.
6) Webhooks stream in:
   - status updates (queued, ringing, in-progress, ended, failed, no-answer)
   - speech-update (optional partials)
   - transcript (final messages)
   - end-of-call-report (summary, recordingUrl, duration)
7) The `calls` row is updated in real-time for UI consumption.
8) **NEW**: After the end-of-call webhook stores `billingSeconds`, `internal.call.billing.meterAiCallUsage` re-reads the call, clamps billable minutes to remaining balance, meters via Autumn, and persists `metadata.aiCallMetering = { requestedMinutes, billedMinutes, balanceAtCheck, trackedAt }` for idempotence.
9) **NEW**: After metering, AI analyzes the transcript for meeting bookings and rejections.
10) **NEW**: If meeting booked, creates `meetings` record and updates opportunity status to "Booked".

### Usage Examples

Start a call (client or server-side):
```ts
await api.call.calls.startCall({ opportunityId, agencyId });
```

Subscribe to progress:
```ts
const call = useQuery(api.call.calls.getCallById, { callId });
// or
const calls = useQuery(api.call.calls.getCallsByOpportunity, { opportunityId });
```

### Testing and Troubleshooting

Local run:
- Ensure env vars are set for the Convex backend environment.
- `bun run dev` (starts Next + Convex).

Webhook signature test:
1) Prepare a JSON payload like `{ "type": "status-update", "id": "<vapiCallId>", "status": "in-progress" }`.
2) Compute hex(HMAC-SHA256(secret=VAPI_WEBHOOK_SECRET, body=<raw-bytes>)).
3) POST to `/api/vapi-webhook` with header `X-Vapi-Signature: <hex-digest>`.
4) Expect 200 response and `calls` status updated.

Envelope test payloads (send as the stringified body and `Content-Type: application/json`):

Status update (enveloped):
```json
{ "message": { "type": "status-update", "status": "in-progress", "call": { "id": "<vapiCallId>" } } }
```

Transcript (single fragment):
```json
{ "message": { "type": "transcript", "role": "user", "transcriptType": "final", "transcript": "Hello.", "call": { "id": "<vapiCallId>" } } }
```
Partials (single fragment) are ignored by the webhook:
```json
{ "message": { "type": "transcript", "role": "user", "transcriptType": "partial", "transcript": "Hell", "call": { "id": "<vapiCallId>" } } }
```

End of call report:
```json
{ "message": { "type": "end-of-call-report", "summary": "Call summary...", "recordingUrl": "https://...", "endedReason": "completed", "billingSeconds": 123, "call": { "id": "<vapiCallId>" } } }
```

Common issues:
- 400 InvalidModules mentioning Node in non-Node files
  - Ensure only Node code (process.env, fetch to Vapi) lives in `internalAction` or `httpAction` files (we keep this in `convex/vapi.ts` and `convex/http.ts`).
- 401 on webhook
  - Signature mismatch; double-check the raw body and secret match and header name `X-Vapi-Signature`.
- No status updates
  - Confirm `SITE_URL` matches the externally reachable domain; Vapi must hit Convex webhook path.
- Credit metering skipped
  - Ensure the call has `billingSeconds > 0` and metadata contains `billingCustomerId`. The metering action logs `[AI Call Billing]` messages for missing data or API errors.
- No live listen URL (listenUrl is null/undefined)
  - **CRITICAL**: You must include `monitorPlan: { listenEnabled: true }` in the assistant configuration when creating the call. Without this, Vapi will NOT return the `monitor.listenUrl` in the API response. The `monitorPlan` must be set at call creation time - it cannot be added later.

### Security Considerations
- Secrets (API key, webhook secret) never leave Node.
- HMAC verification enforced before any mutation calls.
- We do not store audio blobs; only `recordingUrl` (URL reference) is saved.

### Live Listen UI
- The dashboard includes a modal-based in-app listener that connects to `monitor.listenUrl` via WebSocket and plays Int16 PCM audio via Web Audio.
- Controls: Connect / Disconnect, status display, error surfacing.
- Default sample rate assumed 16kHz.
- Componentization: Live listen UI has been extracted to `components/LiveListen.tsx` and imported in `app/dashboard/page.tsx`.

### UI Behavior on Call Completion
- When a call status becomes `completed`, the dashboard stops the running timer and displays a fixed duration using `billingSeconds` when available.
- The end-of-call `summary` (populated by the `end-of-call-report` webhook via `internal.calls.finalizeReport`) is rendered below the transcript on the live call panel.

### Future Enhancements
- Add watchdog/reconciliation job if webhooks are missed; poll `GET /call/{id}`.
- Enrich transcript with speaker labels/timestamps if provided.
- Derive `outcome` and next-step automations (calendar, email).



## Post-Call AI Meeting Booking (IMPLEMENTED)

This section describes the implemented post-call AI meeting booking system that automatically detects meeting bookings from call transcripts and manages the scheduling workflow.

### ✅ Implemented Components

#### Availability Management (convex/call/availability.ts)
- **getAvailableSlots** (internalQuery): Generates 15-minute time slots for next 5-7 business days
  - Uses Luxon for precise timezone handling with agency-specific timezones
  - Parses availability strings like "Tue 10:00-12:00" into actual DateTime slots
  - Filters out conflicts with existing meetings using buffer time
  - Returns structured slots with ISO timestamps and human-readable labels

- **validateSlot** (internalQuery): Validates AI-suggested meeting times against current availability
  - Real-time validation with 1-minute tolerance for slot matching
  - Used by transcript analysis to verify booking feasibility

#### AI Transcript Analysis (convex/call/ai.ts)
- **processCallTranscript** (internalAction): Analyzes call transcripts using atlasAgentGroq
  - Aggregates transcript fragments in chronological order
  - Uses structured JSON prompts with confidence scoring (0-100)
  - Validates suggested slots against real-time availability
  - Applies 70% confidence threshold for booking actions
  - Detects both meeting bookings and explicit rejections
  - Persists analysis results with reasoning for observability

#### Meeting Finalization (convex/call/meetings.ts)
- **finalizeBooking** (internalMutation): Creates confirmed meeting records
  - Race condition protection via atomic slot validation
  - Updates call outcome and opportunity status to "Booked"
  - Schedules follow-up confirmation workflows
  - Comprehensive error handling and rollback on conflicts

- **getMeetingById** (internalQuery): Retrieves meeting data for follow-up processes

#### Follow-up System (convex/call/sendFollowUp.ts)
- **sendBookingConfirmation** (internalAction): Processes successful bookings
  - Structured logging with meeting details and timezone formatting
  - **NEW**: Logs `triggeredByEmail` from the originating call (`startedByEmail`) instead of fetching auth in action context.
  - **NEW**: Calendar invite (`.ics`) uses `call.startedByEmail` as organizer/attendee, falling back to `notifications@scheduler.atlasoutbound.app` if unavailable.
  - **NEW**: Instead of attaching the `.ics` (Resend validator disallows attachments), stores in Convex storage and links the signed URL in the email body.
  - **Note**: Resend’s current validator has no `bcc` support; we omit it and plan to restore once available.
  - Placeholder for email confirmation and calendar integration
  - Agency notification preparation
- **emailMutations** helpers move to `convex/call/emailMutations.ts`
  - `createQueuedEmail`, `markEmailSent`, `markEmailFailed`
  - Keeps Node-only action files clean of mutations per Convex deployment rules


- **sendRejectionFollowUp** (internalAction): Handles detected rejections
  - Categorizes rejection reasons for analysis
  - Prepares follow-up workflows for future engagement

### Current Workflow
1. **Call Initiation**: System fetches available slots and includes them in AI prompt
2. **During Call**: Assistant suggests meeting times and accepts alternatives
3. **Post-Call**: Webhook triggers AI transcript analysis after 5-second delay
4. **AI Processing**: Analyzes conversation with confidence scoring and slot validation
5. **Booking**: Creates meeting record if booking detected with high confidence
6. **Updates**: Updates opportunity status and triggers follow-up workflows

### Key Features
- **Timezone-Aware**: Full Luxon integration for agency-specific timezone handling
- **Conflict Prevention**: Real-time slot validation with buffer time management  
- **AI Confidence**: 70% threshold with detailed reasoning for transparency
- **Race Protection**: Atomic booking operations prevent double-bookings
- **Comprehensive Logging**: Structured observability throughout the pipeline
- **Error Recovery**: Graceful handling of invalid slots and low confidence

---

## 🚀 Future Enhancements

### Email Confirmation System
**Implementation Location:** `convex/call/sendFollowUp.ts` (replace TODOs)

**Required Environment Variables:**
```bash
RESEND_API_KEY=your_resend_api_key
```

**Schema Additions:**
```typescript
// Add to client_opportunities table
email: v.optional(v.string()), // Prospect email for confirmations

// Add to agency_profile table  
email: v.string(), // Agency contact email
```

**Features to Implement:**
- ICS calendar file generation for meeting invitations
- Automated email confirmations to prospects with meeting details
- Agency notification emails for new bookings
- Branded email templates with company-specific styling
- Email delivery tracking and bounce handling

### Agency Notification System
**Implementation Location:** `convex/call/sendFollowUp.ts`

**Features to Implement:**
- Real-time Slack/Teams notifications for new bookings
- Email alerts with prospect details and call summary
- Dashboard notifications with booking analytics
- Customizable notification preferences per agency
- Integration with existing agency communication tools

### Calendar Integration
**Implementation Location:** New file `convex/call/calendar.ts`

**Required Environment Variables:**
```bash
GOOGLE_CALENDAR_CLIENT_ID=your_google_client_id
GOOGLE_CALENDAR_CLIENT_SECRET=your_google_client_secret
OUTLOOK_CLIENT_ID=your_outlook_client_id (optional)
```

**Features to Implement:**
- Google Calendar API integration for automatic event creation
- Outlook/Office 365 calendar support
- Two-way calendar sync with conflict detection
- Automated calendar invites with video call links
- Buffer time management around meetings
- Calendar availability checking before booking confirmation

### Reminder Scheduler
**Implementation Location:** New file `convex/call/reminders.ts`

**Features to Implement:**
- 24-hour advance email reminders with meeting details
- 1-hour advance SMS/email notifications
- Post-meeting follow-up for no-shows with rescheduling options
- Automated meeting preparation emails with agenda items
- Customizable reminder timing and content per agency
- Integration with SMS services (Twilio) for text reminders

**Required Environment Variables:**
```bash
TWILIO_ACCOUNT_SID=your_twilio_sid (for SMS)
TWILIO_AUTH_TOKEN=your_twilio_token
```

### Implementation Priority
1. **Phase 1 (Weeks 1-2)**: Email confirmation system with ICS files
2. **Phase 2 (Weeks 3-4)**: Calendar integration with Google Calendar
3. **Phase 3 (Month 2)**: Reminder scheduler and agency notifications
4. **Phase 4 (Month 3+)**: Advanced features like multi-calendar sync and SMS reminders

## Outbound Discovery System Prompt (Updated for Natural Conversations)

This is the enhanced system prompt used for outbound discovery calls. It is assembled at runtime inside `convex/call/calls.ts` and populated with the agency and opportunity context. The prompt is designed to create natural, human-like conversations that build rapport and increase booking conversion rates.

```text
# Identity & Purpose
You are a professional, friendly business development representative for "<agency.companyName>". You sound completely human - never robotic or scripted. Your goal is to have a natural conversation and, if there's mutual interest, schedule a brief discovery call.

# Context
- Your company: "<agency.companyName>"
- What you do: "<agency.coreOffer>"
- Territory: <agency.targetGeography>
- Prospect business: "<opportunity.name>"
- Why you're calling (the gap you noticed): "<opportunity.fit_reason>"
- Your guidelines: <agency.guardrails.join(", ")>
- Success stories you can share (pick ONE that's most relevant): <agency.approvedClaims.map(c => c.text).join(" | ")>

# Your Personality
- <agency.tone || "Warm, professional, genuinely helpful, and consultative">
- Speak naturally with contractions, like a real person would
- Show genuine interest in their business
- Be confident but not pushy
- Never sound like you're reading from a script

# Natural Conversation Flow

## 1) Opening (Be Human & Direct)
"Hi there, this is [your name] with <agency.companyName>. Do you have just a quick minute? I was looking at local businesses and noticed <opportunity.fit_reason>."

Wait for their response. If they say they're busy, offer to call back at a better time.

## 2) Build Interest Naturally
"The reason I'm reaching out is we specialize in <agency.coreOffer>, and I thought there might be a good fit here."

Then share ONE relevant success story from approved claims to build credibility.

"Would it be worth having a quick 15-minute conversation to see if we might be able to help you with something similar?"

## 3) Handle Their Response Naturally
- If interested → Move to scheduling
- If hesitant → Ask one follow-up question to understand their situation better
- If not interested → Thank them politely and end the call
- If they want to know more → Give a brief answer, then pivot to scheduling

## 4) Schedule Like a Human Would
DON'T immediately rattle off time slots. Instead:

"Great! I'd love to set up a brief chat. What day works better for you - earlier in the week or later?"

Listen to their preference, then offer 2 specific times that match their preference.

## 5) Handle Scheduling Naturally
If they suggest a different time:
- If it's within availability → Confirm it naturally
- If it's outside availability → Respond like a human: "Ah, I'm not available then. How about [alternative time]? Or does [another alternative] work better?"

When they agree to a time:
"Perfect! So that's [day], [date] at [time] [timezone]. I'll send you a calendar invite. Does that work?"

After they confirm, think to yourself [BOOK_SLOT: <exact_ISO_timestamp>] but never say this phrase out loud.

# Key Conversation Principles
- Sound genuinely interested in helping their business
- Use natural transitions between topics
- Don't rush to scheduling - let the conversation flow
- Acknowledge what they say before moving to your next point
- Handle objections by understanding their concern first, then addressing it
- Building rapport is more important than rushing to schedule

# Booking Confirmation (Technical Note)
- The AI uses internal thought markers [BOOK_SLOT: <ISO>] to signal confirmed bookings
- This replaces the old CONFIRM_SLOT output that was being spoken aloud
- The booking confirmation is processed by the backend without disrupting conversation flow

# Voicemail Script
"Hi, this is [name] from <agency.companyName>. I noticed <opportunity.fit_reason> with your business and thought we might be able to help. We've had great results with similar businesses - [mention one success story briefly]. I'd love to chat for just 15 minutes about how we might be able to help you too. Give me a call back at [your number] or I'll try you again later. Thanks!"
```

