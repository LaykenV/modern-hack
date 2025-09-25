## Lead Gen Workflow Resume — Phase-Gated Relaunch Plan

### Problem
- After a billing pause during `generate_dossier`, resuming the lead gen workflow reruns earlier phases (`source` → `filter_rank` → `persist_leads` → `scrape_content`) before returning to `generate_dossier`.
- This causes redundant external calls (e.g., Google Places), unnecessary work, and potential double-metering risks.

### Evidence (from recent runs)
- Logs show a successful run, then a run that pauses for billing and resumes. On resume, we see the workflow hit Google Places again and re-execute earlier phases until it reaches `generate_dossier`.
- Example log cues:
  - `[Lead Gen Workflow] Searching for: "<vertical> in <geo>"` after resume
  - `[Billing] Tracking usage: lead_discovery, value: 1` after resume
  - Repeated "Starting Phase 2/3/4" messages before Phase 5 resumes

### Root Cause
- `convex/leadGen/statusUtils.ts` → `relaunchWorkflow` restarts `internal.leadGen.workflow.leadGenWorkflow` with the original arguments and no resume hint.
- `convex/leadGen/workflow.ts` always executes phases sequentially from `source` without consulting `lead_gen_flow.phases` or any `startPhase` indicator.

### Goals
- On resume, skip directly to the paused phase (e.g., `generate_dossier`) and do not rerun earlier completed phases.
- Preserve idempotent behavior and existing billing safeguards.

### Approach Overview
1) Add a resume hint to the workflow
   - Add optional `startPhase?: "source" | "filter_rank" | "persist_leads" | "scrape_content" | "generate_dossier" | "finalize_rank"` to `leadGenWorkflow` args in `convex/leadGen/workflow.ts`.
   - Default `startPhase` to `"source"` for fresh starts.

2) Pass the correct start phase on resume
   - In `convex/leadGen/statusUtils.ts` → `resumeLeadGenWorkflow`, derive `startPhase` from `billingBlock.phase`.
   - Update `relaunchWorkflow` to accept and forward `startPhase` to `workflow.start(...)` when relaunching `leadGenWorkflow`.
   - Ensure `resetPhasesAndClearBilling` only resets the paused phase and its dependents, not earlier completed phases.

3) Phase gating inside the workflow
   - At the top of `leadGenWorkflow.handler`, load the current flow doc to read `phases`.
   - Compute `firstNonCompletePhase` as the first phase whose `status !== "complete"`.
   - Compute `entryPhase = max(startPhase, firstNonCompletePhase)` according to phase order.
   - For each phase block (`source`, `filter_rank`, `persist_leads`, `scrape_content`, `generate_dossier`, `finalize_rank`):
     - If the phase precedes `entryPhase` OR its status is already `complete`, skip execution and log a concise skip message (e.g., `Skipping source (already complete)` or `Skipping filter_rank due to startPhase=generate_dossier`).

4) `generate_dossier` specifics (per-opportunity audits)
   - Keep the current behavior of querying only `queued` audit jobs (`internal.leadGen.queries.getAuditJobsByFlow` filters `status === "queued"`). This naturally avoids reprocessing completed audits.
   - Optional enhancement (not required now): Accept `resumeAuditJobId` from `billingBlock.auditJobId` for even tighter resume granularity within Phase 5. If omitted, queued-only behavior is sufficient to continue from where we paused.

### Detailed Implementation Steps
- `convex/leadGen/workflow.ts`
  - Extend `args` with `startPhase?: LeadGenPhaseName` (union of existing phase literals).
  - At handler start:
    - `const flow = await step.runQuery(internal.leadGen.statusUtils.getFlowForRelaunch, { leadGenFlowId: args.leadGenFlowId })` or a lightweight dedicated query.
    - Determine `firstNonCompletePhase` from `flow.phases`.
    - Set `entryPhase` to the later of `args.startPhase ?? "source"` and `firstNonCompletePhase`.
  - For each phase block, add a guard to skip if the phase is before `entryPhase` or already `complete`.
  - Preserve existing billing checks (`checkAndPause`), pause handling via `isBillingPauseError`, and logging.

- `convex/leadGen/statusUtils.ts`
  - `resumeLeadGenWorkflow`
    - After credit re-check and before relaunch, read `billingBlock.phase` as `startPhase`.
    - Call `relaunchWorkflow({ leadGenFlowId, customerId, startPhase })`.
  - `relaunchWorkflow`
    - Accept `startPhase` and forward it to `workflow.start(...)` args for `leadGenWorkflow`.
  - `resetPhasesAndClearBilling`
    - Verify it resets only the paused phase and dependents (e.g., paused at `generate_dossier` should reset `generate_dossier` and `finalize_rank` only). If it currently resets more than required, adjust accordingly.

### Observability & Logging
- Add clear skip logs per phase, e.g., `Skipping source (status=complete)` and `Skipping persist_leads due to startPhase=generate_dossier`.
- Keep existing logs for phase transitions, audit processing progression, and billing events.

### Correctness & Safety
- Double-metering protection remains:
  - Phase 1 billing uses `checkAndPause`/`trackUsage` once; with gating, `source` won’t execute on resume so no extra `trackUsage(lead_discovery)`.
  - Phase 5 billing is idempotent at the audit level using the `metered` flag and queued-only selection; fallback metering remains guarded by `isAuditJobMetered`.
- State drift protection:
  - Even if `startPhase` is too early by mistake, computing `entryPhase = max(startPhase, firstNonCompletePhase)` prevents reruns of already-complete phases.

### Validation Scenarios
- A) Fresh run
  - Start → all phases execute in order. No regressions.
- B) Pause at `generate_dossier`, then resume
  - On resume, logs should NOT show:
    - Google Places queries
    - `trackUsage` for `lead_discovery`
    - Phase 2–4 execution
  - Phase 5 continues with `queued` audits only; completes; finalize runs.
- C) Pause earlier (e.g., `source`)
  - Resume should start at `source` as expected (default or `startPhase`).

### Risks & Mitigations
- **Risk: Incorrect phase resets on resume.** Ensure `resetPhasesAndClearBilling` touches only paused + dependent phases.
- **Risk: Concurrent resumes.** Keep existing `statusUtils` guards and single active `workflowId` updates.
- **Risk: Hidden incomplete earlier phase.** `firstNonCompletePhase` ensures we don’t skip necessary work even if `startPhase` is later than reality.

### Acceptance Criteria
- Resuming from a billing pause at `generate_dossier` does not re-run `source`, `filter_rank`, `persist_leads`, or `scrape_content`.
- No additional `lead_discovery` credit usage is recorded on resume.
- `generate_dossier` continues from queued audits only; completed audits are not reprocessed.
- Finalization occurs normally once Phase 5 completes (unless paused again).

### Rollout
1) Implement arg + gating changes in `workflow.ts`.
2) Update `resumeLeadGenWorkflow`/`relaunchWorkflow` to pass `startPhase`.
3) Verify `resetPhasesAndClearBilling` scope.
4) Add/verify skip logs.
5) Test scenarios A–C locally; confirm logs match expectations.
6) Deploy and monitor for any unexpected `lead_discovery` metering or repeated Phase 1 logs on resume.


