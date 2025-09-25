## Vapi Integration Plan

### Foundations
- Confirm `VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID`, `VAPI_WEBHOOK_SECRET`, and `SITE_URL` are set in Convex (dev + prod) and accessible via `ctx.env`. Document rotation process.
- Capture assistant persona requirements from `agency_profile` (company name, `coreOffer`, `targetGeography`, `approvedClaims`, guardrails) so outbound scripts stay aligned with the MVP narrative.
- Gate call initiation to agencies with completed onboarding flows and sufficient credits; expose a feature flag to allow staged rollout.

Critique: Perfect. This is exactly the right foundation. The `SITE_URL` is crucial for dynamically building the webhook URL.

### Data Model Updates (`convex/schema.ts`)
- Extend `calls` table:
  - `vapiCallId: v.optional(v.string())` (unique per call) with index `by_vapi_call_id` for webhook lookups.
  - `assistantId`, `phoneNumberId`, `dialedNumber` for auditing which Vapi resources were used.
  - Replace `transcript` with `v.optional(v.array(v.object({ role, text, timestamp: v.optional(v.number()), source: v.optional(v.string()) })))` to support structured, ordered fragments.
  - Add `summary`, `recordingUrl`, `endedReason`, `billingSeconds`, `metadata` (object) for richer post-call state.
- Ensure `client_opportunities.phone` is validated before call creation; enforce filters in lead workflow if missing.

Critique: Excellent. This data model is robust and ready for both live transcripts and detailed post-call analysis. No changes needed.

### Assistant & Prompt Configuration (Inline/Ephemeral Approach)
- Skip creating a reusable assistant in the Vapi dashboard; everything lives in code per call.
- `calls.startCall` builds the full assistant payload dynamically using `agency_profile` + `client_opportunities` data (company name, `coreOffer`, `approvedClaims`, guardrails, `fit_reason`).
- Include the scripted opener from `project_plan.md` (lines 121-124) in the system prompt, ensuring approved claims are cited and guardrails enforced.
- Inline assistant configuration should include model, voice, transcriber, monitoring messages, unified webhook `server`, and metadata pointing back to Convex IDs. Reference the `/call/phone` docs to ensure supported fields (model, voice, server/serverMessages, metadata, firstMessageMode, transcriber) are present. Prefer transient assistants via `squad`, or `assistantId` with `assistantOverrides`. Example inline (transient) assistant used inside a `squad` member:
```
const inlineAssistant = {
  name: `Atlas AI Rep for ${agency.companyName}`,
  model: {
    provider: "openai",
    model: "chatgpt-4o-latest",
    messages: [
      {
        role: "system",
        content: `You are a friendly sales rep for "${agency.companyName}". Their core offer is "${agency.coreOffer}". You are calling "${opportunity.name}" in ${agency.targetGeography}. Reference their gap: "${opportunity.fit_reason}". You MUST cite one approved claim: ${approvedClaimsText}. Follow guardrails: ${agency.guardrails?.join(", ") ?? "standard compliance"}.`
      }
    ]
  },
  voice: { provider: "playht", voiceId: "jennifer", model: "PlayDialog" },
  transcriber: { provider: "deepgram", model: "nova-3-general" },
  firstMessageMode: "assistant-speaks-first",
  server: {
    url: `${SITE_URL}/api/vapi-webhook`,
    secret: ctx.env.VAPI_WEBHOOK_SECRET
  },
  serverMessages: [
    { type: "status-update" },
    { type: "transcript" },
    { type: "end-of-call-report" }
  ],
  metadata: {
    convexOpportunityId: opportunity._id,
    convexAgencyId: agency._id,
    leadGenFlowId: opportunity.leadGenFlowId ?? null
  }
};
```
- Environment variables required: `VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID`, `VAPI_WEBHOOK_SECRET`, `SITE_URL`. No persistent `assistantId` needed when using `squad`.

Critique: This aligns with the inline assistant pattern and keeps the AI persona version-controlled alongside the rest of the codebase.

### Convex Backend Orchestration
`calls.startCall` (internal action):
  - Args: `opportunityId`, optional overrides for phone/script.
  - Validate ownership, onboarding completion, credit balance, phone presence. Fail fast with descriptive errors for missing phone or insufficient `approvedClaims`.
  - Fetch agency & opportunity documents; build the inline assistant config (system prompt, metadata) and call request:
    - Preferred (transient assistant via `squad`):
      ```ts
      const response = await vapiClient.calls.create({
        phoneNumberId: ctx.env.VAPI_PHONE_NUMBER_ID,
        customer: { number: opportunity.phone },
        squad: {
          members: [
            { assistant: inlineAssistant }
          ]
        }
      });
      ```
    - Alternative (existing assistant with dynamic overrides):
      ```ts
      const response = await vapiClient.calls.create({
        phoneNumberId: ctx.env.VAPI_PHONE_NUMBER_ID,
        customer: { number: opportunity.phone },
        assistantId: SOME_ASSISTANT_ID,
        assistantOverrides: {
          model: inlineAssistant.model,
          voice: inlineAssistant.voice,
          transcriber: inlineAssistant.transcriber,
          firstMessageMode: inlineAssistant.firstMessageMode,
          server: inlineAssistant.server,
          serverMessages: inlineAssistant.serverMessages,
          metadata: inlineAssistant.metadata
        }
      });
      ```
    `vapiClient` can be `new VapiClient({ token: ctx.env.VAPI_API_KEY })` or use `fetch("https://api.vapi.ai/call/phone", { method: "POST", headers: { Authorization: `Bearer ${ctx.env.VAPI_API_KEY}`, "Content-Type": "application/json" }, body })` per docs.
  - Capture `response.id`, `response.monitor?.listenUrl`, etc., and insert a `calls` row with `status="initiated"`, `startedAt`, `vapiCallId`, `assistantSnapshot`, `phoneNumberId`, `monitorUrls`.
  - Schedule watchdog cron via `ctx.scheduler.runAfter` to mark call as `timed_out` if no webhook update after e.g. 5 minutes; fallback to `GET /call/{id}` for reconciliation when needed.

Webhook handler (`convex/http.ts`, `httpAction` at `/api/vapi-webhook`):
  - Parse body, verify signature using `X-Vapi-Signature` (HMAC-SHA256 using `VAPI_WEBHOOK_SECRET`). Reject with 401 if invalid.
  - Switch on `message.type` per webhook docs:
    - `status-update`: map Vapi statuses (`queued`, `ringing`, `in-progress`, `ended`, `failed`, `no-answer`) to internal enum via `internal.calls.updateStatusFromWebhook`.
    - `speech-update`: treat as real-time partial transcript; optionally store for UI typing.
    - `transcript`: treat as final transcript fragments; append with timestamp + role using `internal.calls.appendTranscriptChunk`.
    - `end-of-call-report`: call `internal.calls.finalizeReport` to persist summary, `recordingUrl`, `messages`, full transcript string, ended reason, billing seconds; enqueue follow-on jobs (emails, calendar) with `ctx.scheduler.runAfter`.
    - Optionally handle `analysis-ready`, `recording-ready`, `function-call` for future use cases.
  - Return `new Response("ok", { status: 200 })` quickly; log unrecognized types for debugging.

- Internal mutations/actions:
  - `internal.calls.updateStatusFromWebhook`: fetch by `vapiCallId`; patch status, `currentStatus`, `lastWebhookAt`, compute duration.
  - `internal.calls.appendTranscriptChunk`: push fragment onto structured transcript array; dedupe using optional `messageId` when Vapi payload includes it.
  - `internal.calls.finalizeReport`: persist summary, `recordingUrl`, structured transcript array, raw transcript string, ended reason, billing seconds, and messages snapshot. Derive `outcome` (meeting booked vs follow-up) via keyword heuristics; store for future automation.
  - Future: `internal.calls.checkStaleCalls` watchdog.

Critique: Flawless handling of webhook events; signature verification keeps the endpoint secure while offloading heavy work to scheduled jobs.

### Frontend Integration (Next.js Dashboard)
- Trigger: Hook call button in opportunity detail to `calls.startCall` mutation; show loader, disable when credits insufficient.
- Live transcript: Use `useQuery(api.calls.getById)` to stream transcript array; render roles with color badges; auto-scroll to newest fragment. Surface partials from `speech-update` as a typing indicator; store finals from `transcript`.
- Status UX: Show chips for `initiated`, `ringing`, `connected`, `completed`, `failed`. Display duration timer while `in-progress`.
- Post-call summary: Present `summary`, `recordingUrl`, derived `outcome`, prompts for follow-up tasks. Hide until `finalizeReport` completes.
- Guard behind feature flag until backend stable.

Critique: Ideal UX—Convex real-time queries make the live transcript experience straightforward.

### Testing & Tooling

- Seed fixtures: agency profile with approved claims, opportunity with reachable phone number.
- Test matrix:
  - Successful call + meeting booked script.
  - No answer / voicemail.
  - Call rejected / invalid number.
  - Webhook failure recovery (simulate signature mismatch, retries).
- Verify transcript latency & UI updates; capture logs for each webhook event, including both `speech-update` partials and `transcript` finals.
- Exercise reconciliation path by calling Vapi `GET /call/{id}` when a webhook is missed.

Critique: Comprehensive coverage, including failure scenarios and local tooling for webhook development.

### Security & Compliance
- Implement webhook signature verification per Vapi docs (HMAC-SHA256 using `VAPI_WEBHOOK_SECRET`) before processing payload.
- Keep API key secret within Convex env; never surface to browser. Restrict actions to authenticated agency owners.
- Provide consent note in UI to align with call compliance (per `project_plan.md` risk section).
- Consider data retention policy for recordings; store URLs only, not blobs.

Critique: Production-grade security posture with proper handling of sensitive audio data.

### Observability & Ops
- Structured logs for call lifecycle: start, status updates, transcript count, completion, failures.
- Metrics: total calls/day, average duration, completion rate, credit burn (tie into Autumn usage IDs).
- Admin tooling: simple query to re-fetch call details from Vapi if webhook missed; manual override for stuck statuses.

Critique: Gives the ops team the tools needed to monitor and debug real-world usage.

### Launch Checklist
- End-to-end staging dry run with real call and script validation.
- Document operational playbook (rotating keys, updating assistant prompt, handling failed calls).
- Update onboarding to highlight call readiness requirements (phone number, time zone).
- Prepare support docs & UI copy describing live transcript and call workflow.

Critique: Ensures both the product surface and internal teams are ready for launch.

### Deferred Enhancements
- Post-call automations: schedule calendar events, send recap/follow-up emails via Resend.
- Analytics dashboards (call scoring, ICS integration).
- Warm transfer / multi-number routing, improved NLP outcome detection.

Critique: Thoughtful roadmap items that build on the foundation without blocking MVP.
