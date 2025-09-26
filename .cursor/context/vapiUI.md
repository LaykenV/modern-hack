### Vapi Frontend Wiring Plan (Dashboard)

- **Goals**
  - **Add Call action** on each `client_opportunities` row when `status === "READY"`.
  - **Start a Vapi call** via `api.calls.startCall`.
  - **Stream and display** live call status and transcript within the dashboard.
  - **Handle outcomes**: after a call, the opportunity `status` updates to `BOOKED` or `REJECTED` (may appear as `Booked`/`Rejected`). Hide the Call button for these and show an outcome chip.

- **UI placement**
  - File: `app/dashboard/page.tsx`.
  - In each opportunity row (inside the expanded panel), render a "Call" button when the opportunity `status` is `READY`.
  - Below existing sections (Fit Reason, Audit Phases, Dossier), add a "Live Call" panel that appears once a call is initiated or if there is an in-progress/most-recent call.

- **State & queries**
  - Maintain a local map of active calls keyed by stringified opportunity id: `activeCallByOpportunity: Record<string, Id<"calls">>`.
  - Subscribe to `useQuery(api.calls.getCallsByOpportunity, { opportunityId })` only for the expanded row.
  - Select the active call by `activeCallByOpportunity[oppKey]` or else the latest by `_creationTime`.

- **Start call flow**
  - On "Call" click: disable while pending; call `api.calls.startCall({ opportunityId: opp._id, agencyId: sellerBrain.agencyProfileId })`.
  - Save `result.callId` in `activeCallByOpportunity[String(opp._id)]`.
  - Show inline error text if the mutation throws.

- **Live status & transcript rendering**
  - Status chip from `currentStatus ?? status` with colors for queued/ringing/in-progress/completed/failed.
  - Duration: only tick while `status === "in-progress"` using `now - startedAt`. After the call stops, prefer `billingSeconds * 1000` from the DB; if absent, fall back to any static `duration` value. Do not tick during `queued`/`ringing`/terminal states.
  - Optional "Listen" link from `monitorUrls.listenUrl`.
  - Transcript: render `transcript[]` fragments (role, text, source), autoscroll on update.

- **Edge cases**
  - Multiple calls per opportunity: prefer latest by `_creationTime`; consider history dropdown later.
  - Webhook delays: keep UI responsive; show “Waiting for connection…” while queued.
  - Refresh mid-call: on row expand, pick the latest call if `activeCallByOpportunity` is empty.
  - Outcome race: if the opportunity flips to `BOOKED`/`REJECTED` while call webhooks lag, the timer still stops because ticking is tied strictly to `in-progress`.

- **Testing scenarios**
  - Happy path: READY → start → queued → ringing → in-progress → completed; opportunity updates to `BOOKED` or `REJECTED`; transcript and status update live; duration switches from ticking to `billingSeconds`.
  - No answer / failed: ensure status reaches a terminal state and transcript area remains minimal.
  - Multiple rows: start calls for two opportunities and verify independent live updates.
  - Refresh during call: state and transcript resume correctly upon reload.

- **Future enhancements** (post-MVP)
  - Calls history section with filter/sorting.
  - Outcome capture UI after `completed` (e.g., meeting booked, next steps).
  - Display partials from `speech-update` as a live typing indicator.
  - Retry/cancel controls for calls in non-terminal states.


