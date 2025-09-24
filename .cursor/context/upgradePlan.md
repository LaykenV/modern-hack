## Billing Pause & Resume Remediation Plan

- **Handle billing pauses without failing the workflow**
  - Wrap `checkAndPause` invocations in each phase with a `try/catch` for `BillingError`.
  - When caught, skip downstream mutations (no `recordFlowError` or phase completion) and return `null` so the durable step exits cleanly.
  - Rely on `pauseForBilling` to set `status: "paused_for_upgrade"` and persist the `billingBlock` before throwing.

- **Resume should rerun the workflow**
  - Extend `resumeLeadGenWorkflow` to re-run `checkAndPause` (or equivalent guard) before clearing the block; if credits are still insufficient, return a helpful message.
  - Reset the paused phase (and any dependent phases) to pending with zero progress, clear `billingBlock`, and set status back to `"running"`.
  - Relaunch the durable workflow via `workflow.start` using stored args, write the new `workflowId`, and guard against concurrent resumes.

- **Propagate required credit quantities**
  - Pass `requiredValue` through to `autumn.check` so previews reflect the actual deficit, and ensure `trackUsage` uses matching values.
  - Audit workflow call sites to supply the correct credit counts (1 for sourcing, 2 per dossier) and confirm previews deserialize correctly in the UI.
