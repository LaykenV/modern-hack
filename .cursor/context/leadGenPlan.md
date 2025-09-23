# Lead Generation Workflow — Finalized Plan (Parent Run + Per-Opportunity)

## Overview
- Use a single parent run document (lead_gen_flow) to track the whole pipeline (like onboarding_flow) and keep per-opportunity lifecycle on client_opportunities; reuse audit_jobs for deep audits.
- Frontend subscribes to the parent run for overall progress and events, and to client_opportunities filtered by leadGenFlowId for row-level statuses.

## Data model (plan)
- lead_gen_flow (new)
  - userId, agencyId
  - numLeadsRequested, numLeadsFetched
  - campaign: { targetVertical, targetGeography }
  - phases: ["source", "filter_rank", "persist_leads", "scrape_content", "generate_dossier", "finalize_rank"] with status/progress/duration/errorMessage
  - lastEvent { type, message, timestamp }
  - placesSnapshot? Array<{ id, name, website?, phone?, rating?, reviews?, address? }> (≤20, minimal fields for UI preview)
  - Indexes: by_userId, by_agencyId
- client_opportunities (existing)
  - Add link: leadGenFlowId: Id<'lead_gen_flow'> (for per-run dashboards)
  - Status lifecycle per opportunity: "SOURCED" → ("SCRAPING" → "DATA_READY") or (no website → "DATA_READY") → "AUDITING" → "READY"
  - Keep campaign fields (targetVertical, targetGeography), qualificationScore, signals[]
- audit_jobs (existing)
  - Link to opportunity (existing). Optionally include leadGenFlowId for aggregation.

## Public API surface
- marketing.startLeadGenWorkflow (public action)
  - Args: { numLeads: number (1–20), targetVertical?: string, targetGeography?: string }
  - Auth required. Resolve campaign from args or agency_profile. Create `lead_gen_flow` with initialized phases and start the workflow via `workflow.start(..., { onComplete: internal.marketing.handleLeadGenWorkflowComplete, context: { leadGenFlowId } })`; store `workflowId`. Return `{ jobId }`.
- marketing.getLeadGenJob(jobId) (public query) — parent doc for UI
- marketing.listLeadGenJobsByAgency(agencyId) (public query) — list/history for dashboard

## Workflow (convex/leadGen/workflow.ts)
Args: { agencyProfileId, userId, numLeads, campaign: { targetVertical, targetGeography } }

Phases:
1) source — Google Places fetch (IMPLEMENT NOW)
2) filter_rank — hard filter + signal detection + dynamic scoring
3) persist_leads — write client_opportunities with campaign fields and leadGenFlowId
4) scrape_content — for opportunities with websites, reuse Firecrawl batching limits and page status logic
5) generate_dossier — queue audit_jobs, build audit_dossier, update opportunity status
6) finalize_rank — compute fit_reason and final ordering

Status updates:
- Mirror onboarding/statusUtils ergonomics: phase transitions, progress (0–1), durations, lastEvent messages.
- `workflowStatus` is updated by the onComplete handler: "completed" | "failed" | "cancelled".
- Parent progress partly derived from dynamic counts on client_opportunities scoped by leadGenFlowId (e.g., scrapedCount/totalWithWebsites).

## Step 1 — Google Places source (to implement now)
- Input resolution
  - Clamp numLeads to [1, 20].
  - Campaign fallback: if missing in args, load from agency_profile; if still missing, fail with clear error + phase error status.
  - textQuery = "{targetVertical} in {targetGeography}".
- Call strategy
  - Create internal action (leadGen/source.ts) reusing logic from convex/leadGen/test.ts with FIELD_MASK and response shaping: { id, name, website?, phone?, rating?, reviews?, address? }.
  - Retries with exponential backoff (e.g., 3 attempts, 800ms initial).
- Deduplication & hygiene
  - Deduplicate by Google id or canonical website domain (drop if either duplicates).
  - Normalize website and phone where possible (store minimal fields).
- Persistence & status
  - Update parent run: numLeadsFetched, placesSnapshot (≤20), phase → complete, lastEvent "Fetched X places…".
  - No writes to client_opportunities yet (defer to persist_leads phase).
- Failure handling
  - On API error or empty results: set phase to error with errorMessage and bubble workflow failure to onComplete handler.

## UI contract
- Start: marketing.startLeadGenWorkflow → { jobId }
- Subscribe: marketing.getLeadGenJob(jobId) → phases, lastEvent, counts, placesSnapshot
- Subscribe: client_opportunities by leadGenFlowId for row-level chips and progress

## Optimizations & resilience
- Keep parent doc light; compute counts via indexed queries.
- Respect rate limits; cap later-phase concurrency (4 workers) and reuse onboarding scrape batching.
- Idempotency: all mutations scoped by leadGenFlowId; Step 1 only mutates the parent run.

## Phases 2–6 — Implementation Details (mirror onboarding patterns)

### Step 2 — filter_rank (next to implement)
- Input: use `lead_gen_flow.placesSnapshot` (≤20) from Step 1; do not write to DB here.
- Hard filter: drop any lead without `phone`.
- Signals (Google Places–only; no web scrape required):
  - MISSING_WEBSITE: `!website`.
  - WEAK_WEB_PRESENCE: `website` exists but domain is a social/aggregator (e.g., `facebook.com`, `instagram.com`, `yelp.com`, `linkedin.com`, `linktr.ee`, `tiktok.com`).
  - LOW_GOOGLE_RATING: `rating < 4.0` AND `reviews >= 5`.
  - FEW_GOOGLE_REVIEWS: `reviews < 5` (tunable).
- Scoring: `qualificationScore = matchedSignals.length / max(1, agencyProfile.leadQualificationCriteria.length)`; if no user criteria, score is 0.
- Module: `convex/leadGen/filter.ts`
  - Internal action: `filterAndScoreLeads({ leadGenFlowId, agencyProfileId })` → returns shaped leads with `{ place_id, name, website?, phone, rating?, reviews_count?, address?, signals, qualificationScore }`.
- Status: `updatePhaseStatus("filter_rank", "running")` with progress by processed/total; on success mark complete with counts kept/dropped.

### Step 3 — persist_leads
- Upsert into `client_opportunities` using `by_place_id` (and domain canonicalization safeguard) to avoid duplicates.
- Fields: `agencyId`, `name`, `domain` (from website host), `phone`, `place_id`, `address`, `rating`, `reviews_count`, `source:"google_places"`, `status:"SOURCED"`, `leadGenFlowId`, `targetVertical`, `targetGeography`, `qualificationScore`, `signals`.
- Module: `convex/leadGen/persist.ts`
  - Internal mutation: `persistClientOpportunities({ leadGenFlowId, agencyProfileId, campaign, leads })`.
- Status: running with incremental progress (i/total), then complete with totals.

### Step 4 — queue audits (phase key: scrape_content)
- Purpose: enqueue per-opportunity deep audit for leads with a `website`/`domain`. Do not scrape in the parent; audits do it.
- Module: `convex/leadGen/auditInit.ts`
  - Internal action: `queueAuditsForWebsites({ leadGenFlowId, agencyProfileId })`
    - Query `client_opportunities` by `by_leadGenFlow` with `status:"SOURCED"` and a website.
    - Create `audit_jobs` rows: `{ opportunityId, agencyId, leadGenFlowId, targetUrl, status:"queued", phases:[map_urls, filter_urls, scrape_content, generate_dossier] }`.
    - Optionally set opportunity status to `"AUDITING"`.
    - Start per-opportunity audit workflows (below).
- Status: running with queued count → complete.

### Step 5 — generate_dossier (per‑opportunity audit workflow)
- Directory: `convex/leadGen/audit/`
- Workflow: `auditWorkflow` with args `{ auditJobId, opportunityId, agencyId, targetUrl, leadGenFlowId }`.
  - map_urls: Firecrawl discovery‑only (links) for `targetUrl` (journal‑safe), keep URLs in memory.
  - filter_urls: AI ranks URLs (reuse onboarding `filterRelevantPages` approach) with a dedicated thread/context.
  - scrape_content: high‑fidelity scrape of filtered URLs (reuse onboarding scrape patterns, store blobs in `_storage`).
  - generate_dossier: synthesize dossier JSON and concise `fit_reason` using agent with (signals + scraped content). Create `audit_dossier` and link `audit_jobs.dossierId`; set `client_opportunities.status = "READY"` and save `fit_reason`.
- Status: update `audit_jobs.phases` and `audit_jobs.status` at each step; parent can poll/derive progress.
- Concurrency & idempotency: cap parallel audits (e.g., 4); skip if an active or completed job already exists for the opportunity.

### Step 6 — finalize_rank
- Module: `convex/leadGen/finalize.ts`
- Parent flow: mark `finalize_rank` complete and call `statusUtils.completeFlow`; onComplete handler sets `workflowStatus`.

## Queries & UI support
- Existing: `marketing.getLeadGenJob` (parent), `marketing.listLeadGenJobsByAgency`.
- New:
  - `listClientOpportunitiesByFlow(leadGenFlowId)` using `client_opportunities.by_leadGenFlow`.
  - `listAuditJobsByFlow(leadGenFlowId)` using `audit_jobs.by_leadGenFlow`.
  - Optional count queries for UI progress (queued/running/completed audits, READY opportunities).

## Utilities & constants
- `convex/leadGen/constants.ts`: `SOCIAL_DOMAINS`, thresholds (`LOW_RATING_THRESHOLD=4.0`, `MIN_REVIEWS_FOR_LOW_RATING=5`, `FEW_REVIEWS_THRESHOLD=10`).
- `convex/leadGen/domain.ts`: `canonicalDomain(url)`.
- `convex/leadGen/signals.ts`: `detectSignals(place)` returning values aligned to `LEAD_QUALIFICATION_OPTIONS`.

## Resilience & idempotency
- Retries: 3 attempts (800ms backoff) for Places‑derived phases; 3–4 attempts (1–2s backoff) for Firecrawl in audits.
- Idempotent upserts by `place_id` and canonical domain; skip duplicate `audit_jobs` per opportunity.
- Concurrency: cap audit workflow parallelism via `WorkflowManager` config (4) and staggered starts.

## Observability
- Phase transitions with `updatePhaseStatus` throughout leadGen; event messages per step.
- Per‑opportunity `audit_jobs.phases` and `status` mirror onboarding style for transparent progress.
- Parent progress can be derived from dynamic counts (e.g., audits completed / total enqueued) plus phase completion.

## Acceptance criteria
- Starting `marketing.startLeadGenWorkflow` sources, filters, scores, persists opportunities, enqueues audits for those with websites, and completes parent phases with clear status updates.
- Per‑opportunity audits produce `audit_dossier` and `fit_reason`; opportunities become `READY`.
- UI can subscribe to parent flow and per‑opportunity lists via the queries above.
