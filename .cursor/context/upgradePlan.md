### Vapi Webhook Upgrade Plan

#### Current state
- Outbound call connects and assistant has correct context.
- Webhook now reaches Convex (`/api/vapi-webhook`) and returns 200 OK.
- Call records in `calls` table remain stuck at "queued" and no transcript is persisted.

#### Root cause
- Vapi is posting a "message envelope" with payload under `message` (e.g., `message.type`, `message.call.id`, `message.transcript`).
- Our handler in `convex/http.ts` currently expects top-level fields (`type`, `call.id`, etc.). When it doesn't find them, it returns 200 without updating anything.

#### Fix plan
- **Unwrap envelope:** If `payload.message` exists, use that as the canonical object `m`; otherwise use `payload`.
- **Extract identifiers:**
  - `type = m.type`
  - `vapiCallId = m.call?.id || m.id || m.callId || req.headers["X-Call-Id"]`
- **Handle transcript:**
  - If `m.messages` or `m.data?.messages` exists, iterate and append fragments (existing behavior).
  - Else if `m.transcript` exists, append a single fragment using:
    - `role = m.role || "assistant"`
    - `text = m.transcript`
    - `source = m.transcriptType === "partial" ? "transcript-partial" : "transcript"`
- **Handle status updates:**
  - `status = m.status || m.data?.status` → call `internal.calls.updateStatusFromWebhook`.
- **Handle end-of-call-report:**
  - Pull `summary`, `recordingUrl`, `endedReason`, `billingSeconds` from `m` (or `m.data`).
- **Guards and logging:**
  - If no `vapiCallId` after all fallbacks, log once and return 200.
  - Keep responses fast; do not block on long operations.

#### Verification checklist
- `server.url` points to Convex HTTP (configured via `CONVEX_SITE_URL`) — confirmed by logs.
- `VAPI_WEBHOOK_SECRET` set and Convex verifies via `X-Vapi-Secret` (with HMAC fallback) — implemented.
- `serverMessages` includes required types: `status-update`, `transcript`, `end-of-call-report` — confirmed.
- `_attachVapiDetails` patches `vapiCallId` so subsequent webhooks can find the call — confirmed.

#### Test plan
1) Unit-style webhook tests via curl/postman against Convex endpoint:
   - Headers: `Content-Type: application/json`, `X-Vapi-Secret: <VAPI_WEBHOOK_SECRET>`
   - Bodies:
     - `status-update` envelope with `message.call.id` and `message.status`
     - `transcript` envelope with `message.transcript` and `message.role`
     - `end-of-call-report` envelope with `message.summary`, `message.recordingUrl`, `message.endedReason`, `message.billingSeconds`
   - Expect corresponding changes in `calls` row.
2) End-to-end test: trigger a real outbound call and validate live updates in UI.

#### Environment variables
- **CONVEX_SITE_URL**: public Convex HTTP URL (preferred for webhooks)
- **VAPI_WEBHOOK_SECRET**: shared secret (Vapi sends in `X-Vapi-Secret`); HMAC fallback supported via `X-Vapi-Signature` if present
- **VAPI_API_KEY**, **VAPI_PHONE_NUMBER_ID**: as configured

#### Relevant logs

- Earlier failures (webhook to Next/Vercel → 405):
```json
{
  "id": "log-267",
  "level": 50,
  "body": "Server error: Your server rejected `transcript` webhook. Error: Request failed with status code 405",
  "attributes": {
    "category": "system",
    "callId": "ca8d9ae5-dcdf-40c3-9bf3-6c1364492085",
    "orgId": "68befe23-382c-44b6-8e79-23c34335c9d5"
  }
}
```

```json
{
  "id": "log-255",
  "level": 50,
  "body": "Request failed: transcript",
  "attributes": {
    "category": "webhook",
    "callId": "ca8d9ae5-dcdf-40c3-9bf3-6c1364492085",
    "url": "https://modern-hack-5qjr.vercel.app/api/vapi-webhook",
    "messageType": "transcript",
    "error": {
      "message": "Request failed with status code 405"
    }
  }
}
```

- Current (webhook to Convex → 200 OK, envelope under `message`):
```json
{
  "id": "log-15",
  "level": 30,
  "body": "Response successful: transcript",
  "attributes": {
    "category": "webhook",
    "callId": "835ea43e-a703-49ee-a6cf-fe7529a0285c",
    "messageType": "transcript",
    "url": "https://youthful-dinosaur-571.convex.site/api/vapi-webhook",
    "response": {
      "status": 200,
      "data": "ok"
    },
    "config": {
      "headers": {
        "X-Vapi-Secret": "<redacted>"
      },
      "data": "{\"message\":{\"type\":\"transcript\",\"role\":\"user\",\"transcriptType\":\"final\",\"transcript\":\"Hello.\",\"call\":{\"id\":\"835ea43e-a703-49ee-a6cf-fe7529a0285c\"}}}"
    }
  }
}
```

#### Rollout
- Implement handler updates in `convex/http.ts` as outlined.
- Deploy to Convex; validate via curl tests; then perform a live call test.
- Monitor `calls` rows for status transitions and transcript accumulation.


