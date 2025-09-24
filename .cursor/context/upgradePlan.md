## LeadGen billing pause bug — finalize skip + onComplete guard (2025-09-24)

### Problem summary
- When a user runs out of credits during Phase 5 (generate_dossier), we correctly call `pauseForBilling` and throw a `BillingError`, but the durable workflow still proceeds to finalize and marks the run as completed.
- Consequence: subsequent resume attempts fail because the flow is already marked `completed`.

### Root cause
- The `BillingError` is thrown from an action (Node) and caught in the workflow (V8). Across runtime boundaries, `instanceof BillingError` is unreliable (prototype lost). Our `catch` blocks miss the intended early-return path and fall through to the generic error handling, which:
  - Marks the `generate_dossier` phase "complete with some failures" and
  - Continues to Phase 6 (finalize), which unconditionally calls `completeFlow`.
- Additionally, the durable workflow `onComplete` handler sets the flow to `completed` on any `success` result, without checking whether the flow was paused mid-run.

### High-level fix
1) Introduce a robust billing pause error detector that works across runtimes (name/message checks) and use it everywhere we currently do `instanceof BillingError`.
2) Prevent finalization when the flow is paused — both in the workflow control flow and defensively inside the finalize action and `completeFlow` mutation.
3) Make the `onComplete` handler a no-op if the flow is paused, so a paused run never gets marked completed.
4) Avoid marking the `generate_dossier` phase as "complete" on a billing pause.

No schema changes. No data migrations. We do not retrofit already-incorrect completed runs.

---

### Changes by file

#### 1) `convex/leadGen/billing.ts`
- Add a helper exported alongside `BillingError`:
  - `export function isBillingPauseError(err: unknown): boolean` that returns true if:
    - `err instanceof BillingError` OR
    - `(err as any)?.name === "BillingError"` OR
    - `String(err).includes("Workflow paused for billing")`.
- Rationale: Works across action→workflow boundary where prototypes may be lost.

#### 2) `convex/leadGen/workflow.ts`
- Import and use `isBillingPauseError` instead of `instanceof BillingError` in both places:
  - Source phase pre-check catch: if billing pause → `return null` (no downstream error recording).
  - Audit loop pre-check catch: if billing pause → `return null` (exit handler early).
- Outer try/catch around the audit loop:
  - If caught error is a billing pause → just `return null` (do NOT write "completed with some failures"), ensuring no finalize step runs.
  - Non-billing errors keep existing behavior.
- Net effect: On billing pause, the handler returns early before Phase 6 and does not finalize.

#### 3) `convex/leadGen/finalize.ts`
- Defensive guard at the start of `finalizeLeadGenWorkflow`:
  - Load the flow; if `status === "paused_for_upgrade"`, log and `return null` immediately (skip phase updates and `completeFlow`).
- Rationale: Safety net if finalize is called by mistake.

#### 4) `convex/leadGen/statusUtils.ts`
- `completeFlow` mutation:
  - Load the flow; if `status === "paused_for_upgrade"`, log and `return null` (do not set `status/workflowStatus` to completed and do not mass-complete phases).
- `resumeLeadGenWorkflow` action:
  - Replace `instanceof BillingError` with `isBillingPauseError` for the pre-check re-verification path.
- (No other logic changes.)

#### 5) `convex/marketing.ts`
- `handleLeadGenWorkflowComplete` (workflow `onComplete` handler):
  - Re-read the flow by `context.leadGenFlowId`.
  - If the flow is `paused_for_upgrade`, no-op (do not set `status/workflowStatus` to completed/failed/cancelled). This preserves the paused state set during the run.
  - Otherwise preserve current behavior (set completed/failed/cancelled).

---

### Behavior after the change
- On insufficient credits in Phase 1 or Phase 5:
  - `pauseForBilling` stores `billingBlock` and sets `status = paused_for_upgrade`.
  - The workflow handler returns early.
  - `onComplete` detects paused flow and does nothing (no status overwrite).
  - Finalize is never called; even if it were, the finalize and `completeFlow` guards prevent completion.
- Resume continues to work as designed (re-verifies credits, resets paused phase + dependents, clears `billingBlock`, relaunches workflow with preserved `customerId`).

---

### Implementation checklist
1) billing.ts
   - [ ] Add `isBillingPauseError(err: unknown): boolean` helper.

2) workflow.ts
   - [ ] Replace both `instanceof BillingError` checks with `isBillingPauseError` (source pre-check and audit pre-check).
   - [ ] In the audit-phase outer `catch`, if `isBillingPauseError(error)` then `return null` without writing a completion status for `generate_dossier`.

3) finalize.ts
   - [ ] Load flow and early-return if `status === "paused_for_upgrade"` before any updates.

4) statusUtils.ts
   - [ ] In `completeFlow`, early-return when flow is paused.
   - [ ] In `resumeLeadGenWorkflow`, replace `instanceof BillingError` with `isBillingPauseError`.

5) marketing.ts
   - [ ] In `handleLeadGenWorkflowComplete`, if flow is paused, no-op instead of marking completed.

6) Logging (optional but recommended)
   - [ ] Add concise logs for: detected billing pause in workflow, finalize skipped due to pause, onComplete skipped due to pause.

---

### QA test plan
Manual verification in dev:
1) Pause during Phase 5 (insufficient dossier credits)
   - Setup: Account with 1 atlas credit, then run lead gen for leads that queue audits.
   - Expect:
     - Logs show `pauseForBilling` called with `featureId: dossier_research` and `status` becomes `paused_for_upgrade`.
     - No `"Phase 6: Finalize"` logs.
     - `getLeadGenJob` shows `status: paused_for_upgrade` and `billingBlock` populated.
     - `onComplete` does not mark `completed`.

2) Pause during Phase 1 (insufficient discovery credits)
   - Setup: Zero credits, start a new job.
   - Expect: Same as above: paused, no finalize, `onComplete` no-op.

3) Resume after topping up
   - Upgrade credits.
   - Call `marketing.resumeLeadGenWorkflow(jobId)`.
   - Expect:
     - Pre-check passes; phases reset from paused point; `billingBlock` cleared; status returns to `running`.
     - New `workflowId` recorded.
     - Job completes successfully assuming enough credits.

4) Non-billing errors
   - Simulate a real failure (e.g., throw in audit run). Expect audit-phase writes "completed with some failures" and proceed to finalize. Ensure we didn’t regress non-billing failure handling.

---

### Notes and constraints
- We’re not retrofitting earlier incorrect runs. Any previously mis-marked `completed` flows remain as-is.
- No schema changes; all changes are in control flow and guards.
- The detector intentionally relies on error `name` and `message` substring to handle cross-runtime loss of prototypes.

### Risks
- Adding guards in finalize and completeFlow changes lifecycle semantics slightly, but only for the paused state.
- If any other code path inadvertently calls finalize while paused, we now explicitly no-op — correct behavior given business rules.

### Rollout
- Regular deploy. Verify logs and run the QA plan above.


