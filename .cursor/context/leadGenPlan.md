# Lead Generation Workflow — Finalized Plan (Parent Run + Per-Opportunity)

## Overview
- ✅ Implemented: A single parent run document (`lead_gen_flow`) orchestrates the entire pipeline (analogous to `onboarding_flow`). Per‑opportunity lifecycle resides in `client_opportunities`; deep audits use `audit_jobs`.
- Frontend subscribes to the parent job for phases/progress/events and to opportunities by `leadGenFlowId` for row‑level status.

## Data model (implemented)
- `lead_gen_flow`
  - userId, agencyId, numLeadsRequested, numLeadsFetched
  - campaign: { targetVertical, targetGeography }
  - phases: ["source", "filter_rank", "persist_leads", "scrape_content", "generate_dossier", "finalize_rank"] with status/progress/timestamps/duration
  - lastEvent { type, message, timestamp }
  - placesSnapshot?: Array<{ id, name, website?, phone?, rating?, reviews?, address? }> (≤20)
  - Indexes: `by_userId`, `by_agencyId`
- `client_opportunities`
  - Link: `leadGenFlowId: Id<'lead_gen_flow'>`
  - Status lifecycle: "SOURCED" → (no website → "DATA_READY") or (audit path) "AUDITING" → "READY"
  - Campaign fields: `targetVertical`, `targetGeography`; ranking: `qualificationScore`; badges: `signals[]`
  - Indexes: `by_agency`, `by_place_id`, `by_agency_and_campaign`, `by_leadGenFlow`, `by_agency_and_domain`, `by_leadGenFlow_and_domain`
- `audit_jobs`
  - Links: `opportunityId`, `agencyId`, optional `leadGenFlowId`; `targetUrl`, `status`, `phases[]`, optional `dossierId`, optional `analysisThread`
  - Indexes: `by_opportunity`, `by_agency`, `by_leadGenFlow`
- `audit_scraped_pages`
  - Stores page metadata and `_storage` `contentRef` per audit. Indexes: `by_auditJobId`, `by_opportunityId`, `by_auditJobId_and_url` (for upserts)

## Public API surface (convex/marketing.ts)
- `startLeadGenWorkflow` (action)
  - Args: { numLeads: 1–20, targetVertical?, targetGeography? }
  - Auth required. Resolves campaign from args or `agency_profile`, creates `lead_gen_flow` (initialized phases), starts workflow via `workflow.start(..., { onComplete: internal.marketing.handleLeadGenWorkflowComplete, context: { leadGenFlowId } })`, stores `workflowId`, returns `{ jobId }`.
- `getLeadGenJob(jobId)` (query) — parent doc for UI
- `listLeadGenJobsByAgency(agencyId)` (query) — history for dashboard
- `getLeadGenProgress(jobId)` (query) — overall 0–1 progress
- `listClientOpportunitiesByFlow(leadGenFlowId)` (query)
- `listAuditJobsByFlow(leadGenFlowId)` (query)
- `getLeadGenFlowCounts(leadGenFlowId)` (query) — totals for UI chips

## Workflow (convex/leadGen/workflow.ts)
Args: { leadGenFlowId, agencyProfileId, userId, numLeads, campaign }

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

## Step 1 — Google Places source (implemented)
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
  - No writes to `client_opportunities` yet.
- Failure handling
  - Records phase error via `recordFlowError` and fails workflow (handled by completion handler).

## UI contract
- Start: marketing.startLeadGenWorkflow → { jobId }
- Subscribe: marketing.getLeadGenJob(jobId) → phases, lastEvent, counts, placesSnapshot
- Subscribe: client_opportunities by leadGenFlowId for row-level chips and progress

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

### Step 5 — generate_dossier (per‑opportunity audit action) (implemented)
- Module: `convex/leadGen/audit.ts`
  - `runAuditAction({ auditJobId, opportunityId, agencyId, targetUrl, leadGenFlowId })` performs:
    - map_urls: discovery‑only crawl via `firecrawlActions.startCrawl` + `getCrawlStatusOnly` (journal‑safe).
    - filter_urls: AI selection via `filterRelevantUrls` using `analysisThread` (fallback to rules if needed).
    - scrape_content: `firecrawlActions.scrapeAuditUrls` stores markdown in `_storage` and upserts to `audit_scraped_pages`.
    - generate_dossier: `generateDossierAndFitReason` creates `audit_dossier` and saves opportunity `fit_reason`.
  - Updates `audit_jobs.phases` each step; job `status` set to `"completed"` on success, `"error"` on failure.
  - Opportunity `status` set to `"READY"` on success, `"DATA_READY"` on failure.
- Parent workflow processes queued audit jobs sequentially with progress updates; parallelism can be added later if needed.

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

## Acceptance criteria
- Starting `marketing.startLeadGenWorkflow` sources, filters, scores, persists opportunities, enqueues audits for those with websites, and completes parent phases with clear status updates.
- Per‑opportunity audits produce `audit_dossier` and `fit_reason`; opportunities become `READY`.
- UI subscribes to parent flow and per‑opportunity lists via the queries above.
