# Lead Generation Workflow — Finalized Plan (Parent Run + Per-Opportunity)

## Overview
- ✅ **Fully Implemented**: A single parent run document (`lead_gen_flow`) orchestrates the entire pipeline (analogous to `onboarding_flow`). Per‑opportunity lifecycle resides in `client_opportunities`; deep audits use `audit_jobs`.
- ✅ **Upgrade Plan Remediation**: Enhanced billing pause/resume system with graceful workflow handling, comprehensive error recovery, and seamless workflow relaunching.
- ✅ **Billing Pause Bug Fix**: Implemented robust cross-runtime error detection and defensive guards to prevent workflows from incorrectly completing when paused for billing.
- ✅ **Idempotent Billing**: Implemented upgrade plan with normalized units (value: 1), atomic audit-level metering, and defense-in-depth fallback to prevent double-charging.
- Frontend subscribes to the parent job for phases/progress/events and to opportunities by `leadGenFlowId` for row‑level status.

## Data model (implemented with upgrade plan)
- `lead_gen_flow`
 - userId, agencyId, numLeadsRequested, numLeadsFetched
 - campaign: { targetVertical, targetGeography }
 - status: "idle" | "running" | "paused_for_upgrade" | "error" | "completed"
 - phases: ["source", "filter_rank", "persist_leads", "scrape_content", "generate_dossier", "finalize_rank"] with status/progress/timestamps/duration
 - lastEvent { type, message, timestamp }
 - placesSnapshot?: Array<{ id, name, website?, phone?, rating?, reviews?, address? }> (≤20)
 - **billingBlock?**: { phase: "source" | "generate_dossier", featureId: "lead_discovery" | "dossier_research", preview?: any, auditJobId?, createdAt: number, creditInfo?: { allowed, atlasFeatureId, requiredBalance, balance, deficit, usage, includedUsage, interval, intervalCount, unlimited, overageAllowed, creditSchema } } — Enhanced Autumn paywall integration with credit details
 - Indexes: `by_userId`, `by_agencyId`
- `client_opportunities`
  - Link: `leadGenFlowId: Id<'lead_gen_flow'>`
  - Status lifecycle: "SOURCED" → (no website → "DATA_READY") or (audit path) "AUDITING" → "READY"
  - Booked meeting timestamp: `meeting_time?: number` (Unix ms; set when a meeting is booked)
  - Campaign fields: `targetVertical`, `targetGeography`; ranking: `qualificationScore`; badges: `signals[]`
  - Indexes: `by_agency`, `by_place_id`, `by_agency_and_campaign`, `by_leadGenFlow`, `by_agency_and_domain`, `by_leadGenFlow_and_domain`
- `audit_jobs` (updated with upgrade plan)
  - Links: `opportunityId`, `agencyId`, optional `leadGenFlowId`; `targetUrl`, `status`, `phases[]`, optional `dossierId`, optional `analysisThread`
  - **New**: `metered?: boolean` — Idempotent billing flag to prevent double-charging (upgrade plan)
  - Indexes: `by_opportunity`, `by_agency`, `by_leadGenFlow`
- `audit_scraped_pages`
  - Stores page metadata and `_storage` `contentRef` per audit. Indexes: `by_auditJobId`, `by_opportunityId`, `by_auditJobId_and_url` (for upserts)

## Public API surface (convex/marketing.ts)
- `startLeadGenWorkflow` (action)
  - Args: { numLeads: 1–20, targetVertical?, targetGeography? }
  - Auth required. Resolves campaign from args or `agency_profile`, creates `lead_gen_flow` (initialized phases), starts workflow via `workflow.start(..., { onComplete: internal.marketing.handleLeadGenWorkflowComplete, context: { leadGenFlowId } })`, stores `workflowId`, returns `{ jobId }`.
- `getLeadGenJob(jobId)` (query) — parent doc for UI, **includes billingBlock for paywall**
- `listLeadGenJobsByAgency(agencyId)` (query) — history for dashboard
- `getLeadGenProgress(jobId)` (query) — overall 0–1 progress
- `getLeadGenFlowCounts(leadGenFlowId)` (query) — totals for UI chips
- `listClientOpportunitiesByFlow(leadGenFlowId)` (query)
- `listAuditJobsByFlow(leadGenFlowId)` (query)
- `getAuditDossier(dossierId)` (query) — expand view with dossier summary/gaps/talking points/sources
- `listScrapedPagesByAudit(auditJobId)` (query) — signed URL + metadata list for scraped sources panel
- **`resumeLeadGenWorkflow(leadGenFlowId)` (mutation)** — resume paused workflow after upgrade

## Workflow (convex/leadGen/workflow.ts)
Args: { leadGenFlowId, agencyProfileId, userId, customerId, numLeads, campaign, startPhase? ("source" | "filter_rank" | "persist_leads" | "scrape_content" | "generate_dossier" | "finalize_rank") }

### Phase gating on resume
- Computes `entryPhase = max(startPhase, firstNonCompletePhase)` based on phase order.
- Skips any phase that precedes `entryPhase` or is already marked `complete`.
- Emits concise skip logs, e.g., "Skipping source (status=complete) due to startPhase=generate_dossier".
- Ensures idempotent behavior and prevents duplicate billing on resume.

Phases:
1) source — Google Places fetch (IMPLEMENTED)
2) filter_rank — hard filter + signal detection + dynamic scoring (IMPLEMENTED)
3) persist_leads — upsert opportunities with campaign fields (IMPLEMENTED)
4) scrape_content — enqueue per‑opportunity audits (IMPLEMENTED)
5) generate_dossier — run per‑opportunity audit action, produce dossier and fit reason (IMPLEMENTED)
6) finalize_rank — compute counts and complete parent (IMPLEMENTED)

Status updates:
- Mirror onboarding/statusUtils ergonomics: phase transitions, progress (0–1), durations, lastEvent messages.
- `workflowStatus` is updated by the onComplete handler: "completed" | "failed" | "cancelled".
- Parent progress partly derived from dynamic counts on client_opportunities scoped by leadGenFlowId (e.g., scrapedCount/totalWithWebsites).

## Step 1 — Google Places source (implemented + billing)
- **Billing integration**: `checkAndPause({ featureId: "lead_discovery", requiredValue: 1 })` before sourcing
- Input resolution
  - Clamp numLeads to [1, 20]. Build `textQuery = "{targetVertical} in {targetGeography}"`.
- Call strategy (convex/leadGen/source.ts)
  - Internal action: `sourcePlaces({ leadGenFlowId, textQuery, maxResultCount })` using `@googlemaps/places` with `X-Goog-FieldMask`.
  - Retries via workflow runtime (3 attempts, 800ms backoff).
- Deduplication & hygiene
  - Normalization: `normalizeWebsite` (https, lowercase, strip `www`), `normalizePhone` (basic clean).
  - Deduplication: by Google `id` and canonical domain.
- Persistence & status
  - Update parent: `updatePlacesSnapshot` (≤20 snapshot, `numLeadsFetched`) and phase → complete with `lastEvent`.
  - **Track usage**: `trackUsage({ featureId: "lead_discovery", value: 1 })` after successful sourcing
  - No writes to `client_opportunities` yet.
- Failure handling
  - Records phase error via `recordFlowError` and fails workflow (handled by completion handler).
  - **BillingError** pauses workflow with status `"paused_for_upgrade"` and stores `billingBlock`.

## UI contract
- Start: marketing.startLeadGenWorkflow → { jobId }
- Subscribe: marketing.listLeadGenJobsByAgency(agencyId) → default selection & history
- Subscribe: marketing.getLeadGenJob(jobId) → phases, lastEvent, placesSnapshot
- Subscribe: marketing.getLeadGenProgress(jobId) → aggregate progress bar
- Subscribe: marketing.getLeadGenFlowCounts(leadGenFlowId) → totals/ready/audit chips
- Subscribe: marketing.listClientOpportunitiesByFlow(leadGenFlowId) → row-level info
- Subscribe: marketing.listAuditJobsByFlow(leadGenFlowId) → per-lead audit status & dossierId
- Lazy load on expand: marketing.getAuditDossier(dossierId) + marketing.listScrapedPagesByAudit(auditJobId)

## Optimizations & resilience
- Keep parent doc light; compute counts via indexed queries.
- Respect rate limits; cap later-phase concurrency (4 workers) and reuse onboarding scrape batching.
- Idempotency: all mutations scoped by leadGenFlowId; Step 1 only mutates the parent run.

## Phases 2–6 — Implementation Details (mirror onboarding patterns)

### Step 2 — filter_rank (implemented)
- Input: `lead_gen_flow.placesSnapshot` (≤20) from Step 1; no DB writes here.
- Hard filter: drop leads without `phone`.
- Signals (Google Places–only):
  - `MISSING_WEBSITE` if no website.
  - `WEAK_WEB_PRESENCE` if website is social/aggregator domain.
  - `LOW_GOOGLE_RATING` if `rating < 4.0` and `reviews >= 5`.
  - `FEW_GOOGLE_REVIEWS` if `reviews < 5`.
- Scoring: `qualificationScore = matchedCriteriaCount / agencyCriteria.length` (0 if no criteria).
- Module: `convex/leadGen/filter.ts`
  - Internal action: `filterAndScoreLeads({ leadGenFlowId, agencyProfileId })` → `{ place_id, name, website?, phone, rating?, reviews_count?, address?, signals, qualificationScore }`.
- Status: `updatePhaseStatus("filter_rank", ...)` with progress during loop; complete with kept/dropped counts.

### Step 3 — persist_leads (implemented)
- Upsert into `client_opportunities` with dedupe:
  - First by `by_place_id`.
  - Then by canonical domain via `by_agency_and_domain` (new index).
- Fields: `agencyId`, `name`, `domain`, `phone`, `place_id`, `address`, `rating`, `reviews_count`, `source:"google_places"`, `status:"SOURCED"`, `leadGenFlowId`, `targetVertical`, `targetGeography`, `qualificationScore`, `signals`.
- Module: `convex/leadGen/persist.ts`
  - Internal mutation: `persistClientOpportunities({ leadGenFlowId, agencyProfileId, campaign, leads })` → `{ created, updated, skipped }`.
  - Internal query: `getOpportunityCountByFlow({ leadGenFlowId })` (used in finalize).
- Status: start/complete with totals.

### Step 4 — queue audits (phase key: scrape_content) (implemented)
- Purpose: enqueue per‑opportunity deep audit for opportunities with a `domain`. Parent doesn’t scrape; audits do.
- Module: `convex/leadGen/auditInit.ts`
  - Internal action: `queueAuditsForWebsites({ leadGenFlowId, agencyProfileId })`
    - Reads opportunities by `by_leadGenFlow` and filters to those with `domain`.
    - Creates `audit_jobs` with phases and `analysisThread` (via `@convex-dev/agent.createThread`).
    - Sets opportunity `status = "AUDITING"`.
- Status: start with message, complete with `{ queuedCount, skippedCount }`.

### Step 5 — generate_dossier (per‑opportunity audit action) (implemented + idempotent billing)
- **Billing integration**: `checkAndPause({ featureId: "dossier_research", requiredValue: 1, auditJobId })` before each audit (1 unit = 2 credits via Autumn)
- Module: `convex/leadGen/audit.ts`
  - `runAuditAction({ auditJobId, opportunityId, agencyId, targetUrl, leadGenFlowId, customerId })` performs:
    - map_urls: discovery‑only crawl via `firecrawlActions.startCrawl` + `getCrawlStatusOnly` (journal‑safe).
    - filter_urls: AI selection via `filterRelevantUrls` using `analysisThread` (fallback to rules if needed).
    - scrape_content: `firecrawlActions.scrapeAuditUrls` stores markdown in `_storage` and upserts to `audit_scraped_pages`.
    - generate_dossier: `generateDossierAndFitReason` creates `audit_dossier` and saves opportunity `fit_reason`.
    - **Idempotent billing**: Checks `audit_jobs.metered` flag before tracking usage to prevent double-charging
  - Updates `audit_jobs.phases` each step; job `status` set to `"completed"` on success, `"error"` on failure.
  - Opportunity `status` set to `"READY"` on success, `"DATA_READY"` on failure.
  - **Primary metering**: `trackUsage({ featureId: "dossier_research", value: 1 })` after successful audit, sets `metered: true`
- Parent workflow processes queued audit jobs sequentially with progress updates; parallelism can be added later if needed.
- **Defense-in-depth**: Workflow fallback metering checks `audit_jobs.metered` flag and only bills if audit-level metering failed
- **BillingError** pauses workflow at specific audit job for granular resume capability.

- **Progress policy (updated)**:
  - Initialize `generate_dossier` at progress `0.1` when the phase starts.
  - Do not increase progress when an audit starts. Only increment after an audit completes successfully (or is handled and considered done for the batch).
  - Let `completedAudits` be the count of finished audits and `totalAudits` the total queued. Compute progress as `0.1 + 0.9 * (completedAudits / totalAudits)`.
  - This avoids premature jumps and the "stuck at 99%" issue; progress reaches `1.0` only when all audits are done and the phase is marked `complete`.

### Step 6 — finalize_rank (implemented)
- Module: `convex/leadGen/finalize.ts`
- Action: `finalizeLeadGenWorkflow({ leadGenFlowId })`
  - Reads counts via `persist.getOpportunityCountByFlow` (internal query).
  - Marks `finalize_rank` complete → calls `statusUtils.completeFlow`.
  - Completion handler `marketing.handleLeadGenWorkflowComplete` sets `workflowStatus` accordingly.

## Queries & UI support
- Parent: `getLeadGenJob`, `getLeadGenProgress`, `listLeadGenJobsByAgency`, `getLeadGenFlowCounts`.
- Per‑opportunity: `listClientOpportunitiesByFlow(leadGenFlowId)` using `client_opportunities.by_leadGenFlow`.
- Audits: `listAuditJobsByFlow(leadGenFlowId)` using `audit_jobs.by_leadGenFlow`.

## Utilities & constants
- `convex/leadGen/constants.ts`:
  - `SOCIAL_DOMAINS` (facebook, instagram, yelp, linkedin, linktr.ee, tiktok, ...)
  - Thresholds: `LOW_RATING_THRESHOLD=4.0`, `MIN_REVIEWS_FOR_LOW_RATING=5`, `FEW_REVIEWS_THRESHOLD=5`
  - `RETRY_CONFIG` for Google, Firecrawl, AI operations
- `convex/leadGen/signals.ts`: `detectSignals`, `calculateQualificationScore`, `processLead`, `canonicalDomain`

## Resilience & idempotency
- Retries: Places (3 attempts, 800ms backoff); Firecrawl (4 attempts, 1.5s backoff); AI (3 attempts, 1s backoff).
- Idempotent inserts: `by_place_id` and `by_agency_and_domain` prevent duplicates.
- Concurrency: `WorkflowManager` configured with `maxParallelism: 4` (parent). Audits currently run sequentially for stability.
- Journal safety: discovery‑only crawl + targeted scrape mirrors onboarding’s fix.

## Observability
- Parent phases tracked via `statusUtils.updatePhaseStatus` with automatic `startedAt`, `completedAt`, `duration`, and `lastEvent` messages; `recordFlowError` and `completeFlow` included.
- Per‑opportunity: `audit_jobs.phases` updated each step; `status` transitions visible to UI.
- Progress: top‑level `getLeadGenProgress` + counts from `getLeadGenFlowCounts`.

## Firecrawl configuration (discovery‑only + targeted scrape)
- `convex/firecrawlActions.ts`:
  - Crawl: `formats: ["links"]` ONLY; include homepage, product/services/solutions, pricing/plans, about/company/team, customers/testimonials, security/compliance, docs/developers, resources, contact; exclude legal/careers/blog patterns.
  - Scrape (audits): `scrapeAuditUrls` stores markdown in `_storage`, then upserts `audit_scraped_pages`.

## Billing & Paywall Integration (fully implemented with upgrade plan + background workflow fix)
### Credit System (Upgrade Plan Implementation)
- **Lead Discovery**: 1 credit per Google Places search (charged at source phase, 1 unit = 1 credit via Autumn)
- **Dossier Research**: 2 credits per opportunity audit (charged per audit in generate_dossier phase, 1 unit = 2 credits via Autumn)
- **Normalized Units**: All operations now use `value: 1` for consistent metering, with Autumn handling credit multiplication

### Background Workflow Billing Fix (Implemented)
**Problem**: Workflow steps run in background context where `ctx.auth.getUserIdentity()` returns `null`, causing Autumn billing to fail with "No customer identifier found".

**Solution**: 
- **Customer ID Capture**: Authenticated entry points (`startLeadGenWorkflow`, `resumeLeadGenWorkflow`) capture `customerId` from `ctx.auth.getUserIdentity()?.subject`
- **Workflow Threading**: `customerId` passed through workflow args and to all billing action calls
- **Ephemeral Autumn Instances**: Billing actions create temporary Autumn instances with explicit `identify: () => ({ customerId })` when `customerId` provided
- **Fallback Support**: Interactive actions continue using shared Autumn instance when no `customerId`
- **Resume Continuity**: Same `customerId` maintained across workflow pause/resume cycles

### Billing Flow (Enhanced with Upgrade Plan + Background Workflow Fix)
1. **Pre-check**: `checkAndPause` calls Autumn's check API before each metered operation
   - **Background Context Fix**: Uses ephemeral Autumn instance with explicit `customerId` when called from workflow steps
   - **Interactive Context**: Falls back to shared Autumn instance for user-initiated actions
2. **Success path**: Operation proceeds → `trackUsage` meters credits after success (same dual-context approach)
3. **Insufficient credits**: 
   - Workflow pauses gracefully with `status: "paused_for_upgrade"` via `try/catch` BillingError handling
   - `billingBlock` stores Autumn preview data (optional) and detailed `creditInfo` (balance, deficit, schema) plus context (phase, featureId, auditJobId)
   - Workflow exits cleanly with `return null` (no downstream mutations or `recordFlowError`)
   - UI auto-displays paywall dialog with embedded PricingTable
4. **After upgrade**: `resumeLeadGenWorkflow` performs comprehensive resume with workflow relaunch

### Enhanced Resume Process (Upgrade Plan Implementation)
1. **Credit Re-verification**: Resume process validates sufficient credits before proceeding
2. **Phase Reset**: Paused phase and all dependent phases reset to `pending` with zero progress
3. **Billing Block Clearing**: `billingBlock` (including `creditInfo`) removed and status set to `"running"`
4. **Workflow Relaunch**: New workflow instance started with original arguments via `workflow.start()`
5. **Error Handling**: If relaunch fails, reverts to paused state with error details
6. **Concurrency Protection**: Guards against concurrent resume attempts

### Modules (Updated with Upgrade Plan + Background Workflow Fix + Billing Pause Bug Fix)
- `convex/leadGen/billing.ts`: Core billing actions with background context support
  - `checkAndPause`, `trackUsage`: Accept optional `customerId` parameter, normalized to `value: 1`
  - **Background Fix**: Create ephemeral Autumn instances when `customerId` provided
  - **Fallback**: Use shared Autumn instance for interactive actions
  - **Enhanced Credit Info**: Derives detailed `creditInfo` from Autumn check payload (balance, deficit, schema)
  - **Enhanced Logging**: Contextual logs include featureId, units, phase, auditJobId, customerId presence
  - `BillingError`: Custom error class for workflow pause handling
  - **NEW**: `isBillingPauseError(err: unknown): boolean` - Robust cross-runtime error detector that works when prototypes are lost across action→workflow boundaries
- `convex/leadGen/statusUtils.ts`: Enhanced pause/resume system with idempotent billing
  - `pauseForBilling`: Stores billing context (including `creditInfo`) and pauses workflow
  - `resumeLeadGenWorkflow`: Main resume action with relaunch capability (accepts `customerId`), derives `startPhase` from `billingBlock.phase` and forwards it
  - `relaunchWorkflow`: Creates new workflow instance with original args (includes `customerId`), accepts optional `startPhase` and forwards to `workflow.start`
  - `resetPhasesAndClearBilling`: Resets phases and clears billing blocks (including `creditInfo`)
  - **New**: `markAuditJobMetered`, `isAuditJobMetered` for idempotent billing management
  - Helper queries and mutations for safe database operations with updated validators
  - **UPDATED**: `completeFlow` now includes guard against completing paused flows
  - **UPDATED**: `resumeLeadGenWorkflow` uses `isBillingPauseError` for robust error detection
- `convex/leadGen/workflow.ts`: Enhanced with idempotent billing + `try/catch` BillingError handling
  - **Background Fix**: Workflow args include `customerId` parameter
  - **Billing Calls**: All `checkAndPause` calls pass `customerId` with normalized `value: 1`
  - **Defense-in-Depth**: Fallback metering checks `audit_jobs.metered` flag after each audit
  - **No Duplicate Billing**: Primary metering moved to audit-level for atomicity
  - **UPDATED**: Uses `isBillingPauseError` instead of `instanceof BillingError` for reliable cross-runtime detection
  - **UPDATED**: Outer try/catch around audit loop prevents finalize when billing pause occurs - exits cleanly with `return null`
  - **NEW**: Phase gating with optional `startPhase`; skips completed/earlier phases on resume
- `convex/marketing.ts`: Updated resume API and workflow start
  - **Background Fix**: Captures `customerId` from `ctx.auth.getUserIdentity()?.subject`
  - **Workflow Start**: Passes `customerId` to workflow.start() calls
  - **Resume**: `resumeLeadGenWorkflow` captures and passes `customerId`
  - **Enhanced API**: `getLeadGenJob` returns full `billingBlock` with `creditInfo` for frontend
  - **UPDATED**: `handleLeadGenWorkflowComplete` now checks for paused status and skips completion to preserve paused state
- `convex/leadGen/finalize.ts`: Finalization with defensive guards
  - **UPDATED**: Added defensive guard to skip finalization when flow is paused for upgrade
- `components/autumn/paywall-dialog.tsx`: Completely redesigned for upgrade plan
  - **New API**: Accepts `billingBlock` instead of `preview`, with `onResume` and `onRefetchCustomer` callbacks
  - **Embedded PricingTable**: Direct integration of Autumn's `<PricingTable />` component
  - **Auto-detect upgrade**: Listens for window focus/visibility changes to detect return from Stripe
  - **Auto-resume workflow**: Automatically resumes after successful upgrade with 5-second countdown
  - **Manual fallback**: "I've Upgraded — Resume Now" button for manual resume
  - **Generic messaging**: Shows credit deficit, feature costs, and phase information without relying on preview
- Frontend integration in dashboard with enhanced paywall and upgrade success handling

### Billing Pause Bug Fix (September 2024)
**Problem**: When users ran out of credits during Phase 5 (generate_dossier), the workflow would correctly call `pauseForBilling` and throw a `BillingError`, but the durable workflow would still proceed to finalize and mark the run as completed. This made subsequent resume attempts fail because the flow was already marked `completed`.

**Root Cause**: The `BillingError` thrown from an action (Node) was caught in the workflow (V8). Across runtime boundaries, `instanceof BillingError` became unreliable due to prototype loss. Catch blocks missed the intended early-return path and fell through to generic error handling, which would mark the phase "complete with some failures" and continue to finalization.

**Solution Implemented**:
1. **Cross-Runtime Error Detection**: Added `isBillingPauseError(err: unknown): boolean` helper that works across action→workflow boundaries by checking `instanceof`, error name, and message substring
2. **Workflow Early Exit**: Updated all `instanceof BillingError` checks to use `isBillingPauseError` and added outer try/catch around audit loop to prevent finalize on billing pause
3. **Defensive Guards**: Added guards in `finalize.ts`, `completeFlow` mutation, and `handleLeadGenWorkflowComplete` to prevent completion when flow is paused
4. **Clean State Preservation**: Billing pauses now cause workflows to exit cleanly with `return null` instead of marking phases complete

**Result**: Workflows now pause gracefully without corruption, preserve paused state correctly, and resume functionality works as designed.

### Robust Error Handling & Recovery (Enhanced with Background Fix + Billing Pause Bug Fix)
- **Graceful Pause**: Workflows pause without corruption via robust BillingError detection across runtime boundaries
- **Clean Exit**: No partial state or failed workflow status on billing pause - workflows exit cleanly with `return null`
- **Audit-Level Granularity**: Can pause mid-dossier generation at specific audit jobs
- **Resume Validation**: Ensures credits are sufficient before clearing billing blocks
- **Rollback Capability**: Reverts to paused state if relaunch fails
- **Workflow Continuity**: New workflow instance continues from exact pause point
- **Background Context Resolution**: Billing actions work in background workflows via explicit `customerId`
- **Authentication Continuity**: Same user identity maintained throughout workflow lifecycle
- **Defense-in-Depth**: Multiple layers of guards prevent accidental completion of paused workflows

### Idempotency & Resume (Enhanced with Upgrade Plan)
- **Exact Resume Point**: Workflows resume at precise pause location (source phase or specific audit job)
- **No Double-Charging**: `audit_jobs.metered` boolean flag prevents duplicate billing across retries/resumes
- **Atomic Metering**: Primary billing happens at audit-level for atomicity with dossier creation
- **Defense-in-Depth**: Workflow fallback metering only triggers if audit-level metering failed
- **Phase Dependency**: Dependent phases properly reset when resuming from earlier phases
- **Workflow Instance Management**: New workflow IDs tracked and old instances properly handled
- **State Consistency**: Database state remains consistent throughout pause/resume cycle
- **Normalized Units**: All operations use `value: 1` for predictable costs and simpler checks

## Acceptance criteria (✅ All Implemented)
- ✅ Starting `marketing.startLeadGenWorkflow` sources, filters, scores, persists opportunities, enqueues audits for those with websites, and completes parent phases with clear status updates.
- ✅ Per‑opportunity audits produce `audit_dossier` and `fit_reason`; opportunities become `READY`.
- ✅ UI subscribes to parent flow and per‑opportunity lists via the queries above.
- ✅ **Enhanced Billing Integration**: 
  - Workflows pause gracefully on insufficient credits without corruption
  - Paywall displays with accurate preview data
  - Resume process validates credits and relaunches workflows seamlessly
  - Audit-level granularity for precise pause/resume points
  - Robust error handling with rollback capabilities
  - No double-charging or state inconsistencies
- ✅ **Background Workflow Billing Fix**:
  - Billing actions work correctly in background workflow context
  - Customer identity maintained throughout workflow lifecycle
  - Ephemeral Autumn instances resolve authentication issues
  - Resume workflows maintain same customer billing context
  - No "No customer identifier found" errors in workflow steps
- ✅ **Billing Pause Bug Fix**:
  - Workflows no longer incorrectly complete when paused for billing
  - Cross-runtime error detection works reliably across action→workflow boundaries
  - Defensive guards prevent accidental completion at multiple levels
  - Clean workflow exit preserves paused state for proper resume capability
  - Resume attempts now work correctly for previously paused workflows
