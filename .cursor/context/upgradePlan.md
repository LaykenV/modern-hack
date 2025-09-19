### Onboarding Flow Upgrade Plan (Hackathon-ready)

#### P0 (Do now – demo reliability)
- Fix phase progress weighting
  - Update `convex/onboarding/statusUtils.ts`:
    - Make `calculatePhaseProgress` return unweighted 0–1 (remove phase weight multiplication).
    - Keep weights applied only in `calculateOverallProgress`.
  - Ensure calls to `updatePhaseStatusWithProgress` pass `current` and `total` when using `subPhaseProgress` so progress visibly moves.
  - Acceptance: `getOverallProgress` closely reflects true phase completion; no double-weighting while running.

- Make workflow completion tracking robust
  - Update `convex/sellerBrain.ts::handleWorkflowComplete`:
    - If `by_workflowId` lookup misses, fallback to `by_sellerBrainId` (newest), patch `workflowId`, then update status/event.
  - Optional: Update `convex/onboarding/init.ts::setWorkflowId` to retry (e.g., 5–10 attempts, small backoff) until flow exists.
  - Acceptance: completion handler always finds and updates the flow for success/fail/cancel; `workflowStatus` set accordingly.

- Reduce crawl polling load
  - Update `convex/onboarding/workflow.ts` crawl loop:
    - Use Firecrawl snapshot `completed/total` directly for progress; stop calling `internal.onboarding.queries.getFlowCounts` each poll.
    - After first fetch, call `getCrawlStatus` with `autoPaginate: false` and process only incremental pages.
  - Acceptance: fewer DB reads during crawl; smooth progress based on Firecrawl’s counters.

- Align concurrency for rate limits (demo stability)
  - `convex/workflows.ts`: set `maxParallelism` to 2.
  - `convex/firecrawlActions.ts::scrapeRelevantPages`: reduce batch size from 8 → 2–4.
  - Acceptance: no rate-limit spikes; stable runs on hackathon infra.

Estimated time P0: ~1.5–2.5 hours.

#### P1 (Post-demo – performance/cleanup)
- Efficient counts for UI
  - Option A (best for scale): maintain rolling counters on `onboarding_flow` from `pageUtils.upsertPageData` (increment/decrement per status change).
  - Option B (lighter change): compute counts using `by_flow_and_status` index per status (multiple narrow queries) instead of scanning all pages.
  - Acceptance: `getOnboardingFlow` avoids full scans of `crawl_pages`.

- Types and auth hardening
  - If using Convex Auth `users` table, switch `userId` fields in `seller_brain` and `onboarding_flow` to `v.id("users")` and update access checks accordingly.
  - Acceptance: compile-time safety for user IDs.

- API consistency & cleanup
  - Remove no-op `summary.markSummaryStreamingStarted` or add a small phase event.
  - Remove unused `totals` param in `onboarding/crawl.ts::upsertCrawlPages` (or actually use to update progress).
  - Acceptance: fewer dead paths; clearer status flow.

- Observability
  - Add `duration` to `queries.getOnboardingFlow` return (already stored in `phases`) for UI phase timing.
  - Optional: add `lastError` on flow for top-level error surfacing.
  - Acceptance: better UI insight without extra DB work.

Estimated time P1: ~2–4 hours.

#### P2 (Nice-to-haves)
- Early summary trigger when scraped ≥ X pages or ≥ Y%.
- Use Firecrawl watcher for event-driven updates instead of polling.
- Enrich `pagesList` categorization rules for better downstream UX.

#### Order of execution
1) P0: Progress math fix (statusUtils)  
2) P0: Completion handler fallback (+ optional `setWorkflowId` retry)  
3) P0: Crawl loop progress + `autoPaginate: false`  
4) P0: Concurrency settings  
5) P1: Counts efficiency → Types/auth → Cleanup → Observability  
6) P2: Early summary → Watcher → Categorization

#### Quick checklist
- [ ] Progress math unweighted in phase, weighted in overall
- [ ] Completion fallback by `sellerBrainId` and patch `workflowId`
- [ ] Crawl loop uses Firecrawl counters; no per-poll counts query
- [ ] Concurrency reduced (workflow + scraping)
- [ ] Counts optimized (rolling or per-status queries)
- [ ] `userId` typed to `v.id("users")` (if applicable)
- [ ] Remove no-op/unused functions/params
- [ ] Expose `duration` in `getOnboardingFlow`