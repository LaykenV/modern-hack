## Vapi Integration (Atlas Outbound)

This document explains our Vapi phone-call integration end-to-end: data model updates, Convex functions, webhook security, and how to use the API.

### Environment Variables
- VAPI_API_KEY: Server token for Vapi API.
- VAPI_PHONE_NUMBER_ID: Vapi phone number to originate calls from.
- VAPI_WEBHOOK_SECRET: HMAC secret used to verify incoming Vapi webhooks.
- SITE_URL: Public URL of the app, used to construct the webhook endpoint.

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

- finalizeReport (internalMutation)
  - Lookup by `vapiCallId` and persist `summary`, `recordingUrl`, `endedReason`, `billingSeconds`, and mark status as completed.

- getCallById, getCallsByOpportunity (queries)
  - Convenience read endpoints for the dashboard.

#### Vapi Node Runtime (convex/vapi.ts)
- startPhoneCall (internalAction)
  - Args: { callId, customerNumber, assistant }
  - Reads `VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID`, `VAPI_WEBHOOK_SECRET`, and `SITE_URL` from `process.env`.
  - Injects secure `server: { url: `${SITE_URL}/api/vapi-webhook`, secret: VAPI_WEBHOOK_SECRET }` and default `serverMessages` inside Node (not in public mutation).
  - POSTs to `https://api.vapi.ai/call/phone` with the inline assistant (squad.members[0].assistant = inlineAssistant).
  - On success, calls `internal.calls._attachVapiDetails` to patch the `calls` row with `vapiCallId`, `phoneNumberId`, and optional `monitor.listenUrl`.

- attachVapiCallDetails (internalMutation)
  - Args: { callId, vapiCallId, phoneNumberId, listenUrl? }
  - Patches the `calls` row with Vapi metadata.

#### Webhook (convex/http.ts)
- Route: POST `/api/vapi-webhook`
- Security: HMAC-SHA256 verification of the raw request body using `VAPI_WEBHOOK_SECRET`, compared against `X-Vapi-Signature` header (hex digest).
- Behavior:
  - type=status-update → `internal.calls.updateStatusFromWebhook({ vapiCallId, status })`
  - type=speech-update → `internal.calls.appendTranscriptChunk` with partial fragment
  - type=transcript → appends each final transcript message as fragments
  - type=end-of-call-report → `internal.calls.finalizeReport` with `summary`, `recordingUrl`, `endedReason`, and `billingSeconds`
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
- server/serverMessages: injected in `internal.vapi.startPhoneCall` from env in Node.
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

### Future Enhancements
- Add watchdog/reconciliation job if webhooks are missed; poll `GET /call/{id}`.
- Enrich transcript with speaker labels/timestamps if provided.
- Derive `outcome` and next-step automations (calendar, email).


