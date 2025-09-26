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
We extended the `calls` table to track the Vapi lifecycle.

Added fields:
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

Indexes:
- by_opportunity(opportunityId)
- by_agency(agencyId)
- by_vapi_call_id(vapiCallId)

### Backend Components

#### Calls API (convex/calls.ts)
- startCall (mutation)
  - Args: { opportunityId, agencyId }
  - Loads the opportunity and agency profile, validates presence of a phone number.
  - Builds the inline assistant prompt from agency-approved claims, guardrails, core offer, target geography, and the opportunity’s fit_reason.
  - Inserts a `calls` row with status="initiated" and the assistant snapshot.
  - Schedules `internal.vapi.startPhoneCall` via `ctx.scheduler.runAfter(0, ...)` to place the call (kept in Node runtime).
  - Returns: { callId, vapiCallId: "pending" }

- updateStatusFromWebhook (internalMutation)
  - Lookup by `vapiCallId` and update `status`, `currentStatus`, `lastWebhookAt`.

- appendTranscriptChunk (internalMutation)
  - Lookup by `vapiCallId` and push a transcript fragment onto `transcript[]`.
  - Defense-in-depth: ignores `source: 'transcript-partial'` fragments.
  - Adds short-window dedupe to prevent repeated final lines: compares incoming text (normalized) against the last 3 fragments for the same role.

- finalizeReport (internalMutation)
  - Lookup by `vapiCallId` and persist `summary`, `recordingUrl`, `endedReason`, `billingSeconds`, and mark status as completed.

- getCallById, getCallsByOpportunity (queries)
  - Convenience read endpoints for the dashboard.

#### Vapi Node Runtime (convex/vapi.ts)
- startPhoneCall (internalAction)
  - Args: { callId, customerNumber, assistant }
  - Reads `VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID`, `VAPI_WEBHOOK_SECRET`, and `CONVEX_SITE_URL` (or `SITE_URL`) from `process.env`.
  - Injects secure `server: { url: `${CONVEX_SITE_URL}/api/vapi-webhook`, secret: VAPI_WEBHOOK_SECRET }` and default `serverMessages` inside Node (not in public mutation).
  - Finals-only transcripts: sets `serverMessages` to `["status-update", "transcript[transcriptType=\"final\"]", "end-of-call-report"]`.
  - POSTs to `https://api.vapi.ai/call/phone` with the inline assistant (squad.members[0].assistant = inlineAssistant).
  - On success, calls `internal.calls._attachVapiDetails` to patch the `calls` row with `vapiCallId`, `phoneNumberId`, and optional `monitor.listenUrl`.

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
    - Partials are dropped defensively.
  - type=end-of-call-report → `internal.calls.finalizeReport` with `summary`, `recordingUrl`, `endedReason`, `billingSeconds` pulled from root or `data`.
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
- voice: PlayHT (jennifer, PlayDialog)
- transcriber: Deepgram (nova-3-general)
- firstMessageMode: "assistant-speaks-first"
- server: injected in `internal.vapi.startPhoneCall` from env in Node as `{ url, secret }`.
  - url: `${CONVEX_SITE_URL}/api/vapi-webhook` (preferred). Do not point to a Next.js/Vercel URL; use Convex’s URL so the Convex httpAction receives requests.
- serverMessages: must be an array of string enums supported by Vapi (not objects). We currently request live updates plus finals:
  - `["status-update", "speech-update", "transcript", "end-of-call-report"]`
  - Other allowed values include: "conversation-update", "function-call", "hang", "language-changed", "language-change-detected", "model-output", "phone-call-control", "speech-update", "tool-calls", "transfer-destination-request", "handoff-destination-request", "transfer-update", "user-interrupted", "voice-input", "chat.created", "chat.deleted", "session.created", "session.updated", "session.deleted".
- metadata: convexOpportunityId, convexAgencyId, leadGenFlowId

### Call Lifecycle
1) Client calls `api.calls.startCall({ opportunityId, agencyId })`.
2) A `calls` row is created with status="initiated"; assistant snapshot recorded.
3) `internal.vapi.startPhoneCall` runs (Node) and calls the Vapi `call/phone` API.
4) Webhooks stream in:
   - status updates (queued, ringing, in-progress, ended, failed, no-answer)
   - speech-update (optional partials)
   - transcript (final messages)
   - end-of-call-report (summary, recordingUrl, duration)
5) The `calls` row is updated in real-time for UI consumption.

### Usage Examples

Start a call (client or server-side):
```ts
await api.calls.startCall({ opportunityId, agencyId });
```

Subscribe to progress:
```ts
const call = useQuery(api.calls.getCallById, { callId });
// or
const calls = useQuery(api.calls.getCallsByOpportunity, { opportunityId });
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


