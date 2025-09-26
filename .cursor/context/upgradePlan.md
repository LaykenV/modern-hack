## Vapi Integration Upgrade Plan

### Scope
- **Issue 1**: Accept only final transcripts (drop partials) from Vapi.
- **Issue 2**: Make the “Listen” feature work by consuming the `listenUrl` WebSocket stream correctly in the UI (instead of opening the raw URL).

### Current State (context)
- Backend
  - `convex/vapi.ts` creates phone calls via Vapi and persists `monitor.listenUrl` on success.
  - `convex/calls.ts` builds the inline assistant (OpenAI model, PlayHT voice, Deepgram transcriber) and sets `serverMessages: ["status-update", "transcript", "end-of-call-report"]`.
  - `convex/http.ts` validates the webhook using `VAPI_WEBHOOK_SECRET` (shared secret or HMAC), unwraps envelopes, routes by `type`:
    - `status-update` → updates status.
    - `speech-update` → appends transcript fragment with `source: "speech"`.
    - `transcript` →
      - If `messages[]` exists, appends each as `source: "transcript"` (treated as final).
      - Else if single `transcript` string exists, appends as `source: "transcript"` when `transcriptType !== "partial"`, or as `source: "transcript-partial"` when partial.
    - `end-of-call-report` → persists summary/recording/billing and marks call as `completed`.
- Observed behavior
  - The `calls.transcript` array contains both `source: "transcript-partial"` and `source: "transcript"`, e.g., duplicate lines like "Great." appear twice (partial then final).
  - Clicking “Listen” opens the `wss://.../listen` URL in a new tab, which shows an empty page (expected, since it’s a raw WebSocket endpoint, not an HTML page).

### Decisions
- **Final transcripts only**
  - Configure upstream event selection to finals using `serverMessages` selector `"transcript[transcriptType=\"final\"]"` (supported by Vapi) so only final transcript events are delivered.
  - Keep webhook-side filtering as defense-in-depth: ignore `transcriptType === "partial"` and optionally dedupe identical final strings arriving close together.
- **Listen feature**
  - Do not open the `wss://.../listen` URL directly. Implement an in-app WebSocket client that connects to the URL and plays PCM audio via the Web Audio API. Provide UX for connect/disconnect and error states.

### Planned Changes (no code edits yet)

#### 1) Update assistant `serverMessages` to finals only
- Files: `convex/vapi.ts`, `convex/calls.ts`
- Change both inline assistant payloads to:
  - `serverMessages: ["status-update", "transcript[transcriptType=\"final\"]", "end-of-call-report"]`
- Rationale: Prevent partial transcripts from being sent at all; reduce webhook load and storage noise.

Example (illustrative only):
```ts
serverMessages: [
  "status-update",
  "transcript[transcriptType=\"final\"]",
  "end-of-call-report",
]
```

#### 2) Harden webhook to drop partials and dedupe finals
- File: `convex/http.ts`
- Adjust the `"transcript"` case:
  - If it’s a single-fragment payload and `transcriptType === "partial"`, skip appending.
  - If it’s `messages[]`, continue appending as finals.
  - Add a simple deduper to avoid storing repeated finals (e.g., when the same text arrives via different paths):
    - Strategy: On append, compare against the last 1–3 fragments for the same `role`. If `source === "transcript"` and `text` matches (case and whitespace normalized), skip.
  - Keep `speech-update` handling unchanged.

Acceptance for Issue 1:
- After a real call, `calls.transcript` contains only entries with `source: "transcript"` (no `transcript-partial`).
- Final phrases like "Great." appear only once.

#### 3) Implement a real “Listen” experience in the UI
- Files: UI layer (e.g., `app/dashboard/...`), no backend change required for `listenUrl`.
- Replace the current `window.open(listenUrl)` behavior with a modal that hosts a `LiveListen` React component:
  - Props: `{ listenUrl: string }`.
  - Behavior:
    - On connect: `new WebSocket(listenUrl)`; track `readyState`, errors, and close events.
    - On `message` with binary payloads: treat as 16-bit PCM and stream to audio output using Web Audio.
    - On close: stop playback and release audio resources.
    - UI controls: Connect/Disconnect toggle, status indicator, basic error text.
  - Audio playback suggestions:
    - Use an `AudioWorklet` for stable, low-latency PCM playback (preferred), or a small ring buffer feeding an `AudioBufferSourceNode` as a simpler fallback.
    - Default sample rate to 16000 Hz unless Vapi indicates otherwise; make this configurable if needed.

Illustrative client snippet (simplified):
```ts
// Pseudocode only
const ws = new WebSocket(listenUrl);
const audioCtx = new AudioContext({ sampleRate: 16000 });
// Use an AudioWorklet or ScriptProcessor to push Int16 PCM chunks to the output
ws.onmessage = (evt) => {
  if (evt.data instanceof Blob) {
    evt.data.arrayBuffer().then((buf) => {
      // Convert Int16 PCM -> Float32 [−1, 1], enqueue to audio pipeline
    });
  }
};
```

Acceptance for Issue 2:
- Clicking “Listen” opens a modal, connects within ~1s, plays live audio, and allows clean disconnect.
- The previous blank tab behavior is removed.

### Test Plan
- Local validation (dev):
  - Use a test call to verify webhook behavior:
    - With updated `serverMessages`, confirm partials stop arriving.
    - Manually POST a partial single-fragment payload to the webhook and verify it’s ignored.
    - POST a `messages[]` transcript payload and verify it’s appended as finals.
    - Confirm deduper prevents storing duplicates when the same final text is received via different paths.
  - UI listen test:
    - Trigger a live call; open the Listen modal; verify audio playback and graceful disconnect.
    - Simulate a WebSocket error and ensure the UI surfaces an error state without crashing.

- Observability:
  - Add debug logs (temporary) around transcript dropping/deduping (ensure no secrets are logged). Remove or lower verbosity after validation.

### Rollout Steps
1) Update `convex/calls.ts` assistant `serverMessages` to finals only.
2) Update `convex/vapi.ts` to enforce the same `serverMessages` injection server-side.
3) Adjust `convex/http.ts` transcript logic to skip partial single-fragments and add dedupe for finals.
4) Update `.cursor/context/vapi.md` to document the new `serverMessages` selector and webhook filtering expectations.
5) Implement the `LiveListen` UI (modal + component) and replace any `window.open(listenUrl)` usages.
6) Run a real test call end-to-end; validate transcripts and Listen.

### Risks & Mitigations
- Risk: `transcript[transcriptType=\"final\"]` selector unsupported in older configs.
  - Mitigation: Webhook still ignores partials. If finals stop entirely, temporarily fall back to `"transcript"` while keeping webhook filtering.
- Risk: Audio glitches in-browser due to buffer underflow.
  - Mitigation: Use `AudioWorklet` + ring buffer; small pre-buffer (e.g., 100–200ms) before playback start.
- Risk: Duplicate finals via multiple sources.
  - Mitigation: Add short-window dedupe on text + role.

### Acceptance Criteria (summary)
- Only final transcripts persisted; no `source: "transcript-partial"` stored.
- No duplicate final lines for the same utterance.
- Listen modal plays audio reliably; no blank tabs opened.

### Follow-up (optional, not in this change)
- UI timer noted in `tasks.txt` ("timer not stopping on complete and render summary"): subscribe to `status === "completed"` and stop timers; re-render with `summary` from `end-of-call-report`.

### References (from Vapi docs via Context7)
- `serverMessages` supports selectors, including `transcript[transcriptType="final"]` (filter finals at the source).
- `listenUrl` is a WebSocket that streams binary PCM audio; it is not an HTML page and should be consumed by a WS client and played via an audio pipeline.


