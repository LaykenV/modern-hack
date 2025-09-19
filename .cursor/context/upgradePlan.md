## Onboarding Flow Upgrade Plan

This plan upgrades the onboarding workflow and data model to match the intended architecture, with the following constraints honored:
- Keep agent initialization as-is in `convex/agent.ts`.
- Generate the summary only after scraping finishes.
- Normalize and deduplicate URLs/domains.
- Exclude irrelevant paths during crawling/scraping.

### Goals
- Persist crawled content to Convex storage for durability and reuse.
- Provide reliable, granular progress via phases and timeline events.
- Rank and select relevant pages, then perform high-fidelity scraping on them.
- Generate a streaming summary after scraping finishes, then verify claims.
- Offer live UI subscriptions for flows, events, pages, and summary stream.

## Scope Overview
- Server: `convex/workflows.ts`, `convex/firecrawlActions.ts`, `convex/sellerBrain.ts`, `convex/http.ts` (optional webhooks).
- Schema: leverage existing tables; add one optional index.
- No changes to `convex/agent.ts` model configuration.

## Data Model
- Use existing tables: `seller_brain`, `onboarding_flow`, `onboarding_events`, `crawl_pages`.
- Optional addition: index for fetching a flow by seller brain.
  - `onboarding_flow` add index `by_sellerBrainId` on `["sellerBrainId"]`.

## URL Normalization & Deduplication
- Implement a pure helper used by workflow mutations before persisting pages:
  - Normalize host: lowercase host and strip leading `www.` (treat apex and `www` as same domain).
  - Normalize scheme: keep original scheme; for dedupe treat `http`/`https` as equivalent by normalizing compare key to `https`.
  - Path: collapse duplicate slashes, remove trailing slash (except root), strip common default doc names (e.g. `index.html`).
  - Remove hash fragments.
  - Remove tracking query params: `utm_*`, `gclid`, `fbclid`, `ref`, `referrer`, `mc_cid`, `mc_eid`, `igshid`.
  - Sort remaining query params for stable ordering.
- Store only the normalized URL in `crawl_pages.url`. Use `by_flow_and_url` uniqueness to avoid duplicates.

## Path Exclusions and Inclusions
- Configure Firecrawl crawl with exclusions that usually are irrelevant for sales onboarding:
  - Exclude paths (regex): `^/(privacy|legal|terms|tos|cookies|gdpr|dpa)(/|$)`, `^/(careers|jobs)(/|$)`, `^/(press|media|newsroom)(/|$)`, `^/blog/.*$` (unless blog is core; can re-include selectively), `^/wp-.*`, `^/tag/.*`, `^/category/.*`.
- Prefer inclusions for relevance:
  - Include paths (regex): `^/(product|platform|features)(/|$)`, `^/(pricing)(/|$)`, `^/(about|company)(/|$)`, `^/(docs|documentation)(/|$)`.
- Keep crawl bounded: `maxDiscoveryDepth: 2–3`, `limit: 40–80`, `allowSubdomains: false`, `crawlEntireDomain: false`.

## Firecrawl Integration
- Start crawl with:
  - `scrapeOptions: { formats: ["markdown", "links"], onlyMainContent: true }`.
  - `includePaths` and `excludePaths` as above.
- Poll status:
  - Continue using polling in the workflow.
  - For each poll, if using manual pagination (`autoPaginate: false`), page through `next` until null to ingest all new batches; otherwise use `autoPaginate: true` when status becomes `completed`.
  - Emit granular events and update counts on each ingest.
- Optional: add a webhook route to push updates (see Webhooks section); keep polling as fallback.

## Content Persistence
- Persist markdown in `upsertCrawlPages` mutation:
  - When a page has valid markdown and `2xx/3xx` status, store markdown in `_storage` via `ctx.storage.store(Blob)` and set `contentRef` on `crawl_pages`.
  - Avoid re-storing if `contentRef` already exists for that URL.
  - Increment `scrapedCount`/`failedCount` based on parsed status codes.
  - For failed pages, set `status: "failed"` and `error` if present.

## Phases & Timeline Events
- Onboarding flow status lifecycle:
  - At init: `status: "running"`; phases set to `"starting"`.
  - Crawl: set `crawlPhase: "in_progress"` on start; emit `crawl.started`. On page ingest, emit `crawl.page_fetching` → `crawl.page_done`/`crawl.page_failed`. On completion, set `crawlPhase: "done"` and emit `crawl.completed`.
  - Filter: set `filterPhase: "in_progress"`; on finish, `"done"` and `filter.completed`.
  - Scrape: set `scrapePhase: "in_progress"`; on page updates, emit `scrape.page_*`; on finish, `"done"` and `scrape.completed`.
  - Summary: set `summaryPhase: "in_progress"` when streaming starts; emit `summary.streaming_started`; on final text persisted, `"done"` and `summary.completed`.
  - Claims: set `claimsPhase: "in_progress"` → `"done"` with `claims.generated`.
  - Verify: `verifyPhase: "in_progress"` → `"done"` with `claims.verified`.
  - End: set flow `status: "completed"` and emit `onboarding.completed`.
- On any unrecoverable failure, set the corresponding `{phase}: "error"`, add `errorMessage` (if tracked), and set `status: "error"` if terminal.

## Workflow Steps (final sequence)
1) Initialize
   - `initOnboarding` mutation: create flow, set phases `"starting"`, link `seller_brain.onboardingFlowId`, emit `onboarding.started`.
   - `createThreads` action: create `fastThreadId` and `smartThreadId`; `setThreads` mutation to persist.

2) Crawl (discovery + bulk fetch)
   - `startCrawl` action with include/exclude paths and bounds.
   - `markCrawlStarted` mutation; emit `crawl.started`.
   - Poll loop:
     - `getCrawlStatus` action (manual paging if `autoPaginate: false`).
     - `upsertCrawlPages` mutation: normalize/dedupe URLs, persist page rows, store markdown blobs, update counts/progress, emit crawl page events.
     - Break when `status === "completed"`.
   - `markCrawlCompleted` mutation.

3) Relevance filtering (fast)
   - `listFlowPages` internal query to read discovered URLs.
   - `filterRelevantPages` action: keep heuristic ranking (current) and optionally invoke fast agent later; persist to `onboarding_flow.relevantPages` and emit `filter.completed`.
   - Set `filterPhase` to `"done"`.

4) High-fidelity scrape of relevant pages
   - New `scrapeRelevantPages` action:
     - Input: `onboardingFlowId`, `relevantPages`.
     - For each URL, invoke Firecrawl `scrape` with `{ formats: ["markdown"], onlyMainContent: false, maxAge: 0 }` using bounded concurrency (e.g., 8).
     - Persist via a new mutation `saveScrapedPageContent` (store markdown to `_storage`, update `crawl_pages.status = "scraped"`, `title` if available).
     - Emit `scrape.page_done`/`scrape.page_failed` per URL.
   - On completion, set `scrapePhase: "done"` and emit `scrape.completed`.

5) Smart agent summary (after scraping finishes)
   - Replace static summary with streaming using `@convex-dev/agent` on `smartThreadId`:
     - New `streamSummary` internal action:
       - Build prompt from company name, source URL, and curated context (top N relevant pages). Load page text from `_storage` blobs; trim for token budget.
       - Call `agent.streamText(ctx, { threadId: smartThreadId }, { prompt }, { saveStreamDeltas: true })`.
       - Emit `summary.streaming_started`.
     - New `finalizeSummary` mutation:
       - Load latest assistant message content for `smartThreadId` (or pass in the final text from action).
       - Persist to `seller_brain.summary` and set `summaryPhase: "done"` with `summaryMessageId` on the flow.

6) Claims generation & verification
   - New `generateClaims` action (smart agent): produce 3–5 `{ text, source_url }` claims; emit `claims.generated` and set `claimsPhase: "done"`.
   - New `verifyClaims` action (fast agent): for each claim, fetch the matching page markdown from `_storage`, strictly verify support; accept or reject with reason; emit per-claim verification events; set `verifyPhase: "done"`.
   - New `saveApprovedClaims` mutation: persist accepted claims to `seller_brain.approvedClaims`.

7) Finalize
   - New `snapshotPagesList` mutation: snapshot compact `{ url, title?, category? }` list from `relevantPages`/`crawl_pages` into `seller_brain.pagesList`.
   - New `completeFlow` mutation: set `onboarding_flow.status = "completed"` and emit `onboarding.completed`.

## Queries for UI
- `onboarding_flow.get`: returns core flow document including phases, progress, threads, relevant pages.
- `crawl_pages.listByFlow` (paginated): returns per-URL status updates; index `by_flow` is already present.
- `onboarding_events.listByFlow` (paginated or recent N): timeline feed ordered by `_creationTime`/`ts` desc.
- Agent streaming: add a query that wraps `listMessages` + `syncStreams` from `@convex-dev/agent` for `smartThreadId` to show live summary with `useThreadMessages(..., { stream: true })`.

## Error Handling & Retries
- Wrap Firecrawl network calls with retries and jittered backoff (e.g., 3 attempts, 1s–5s jitter).
- On partial failures:
  - Continue crawl ingest even if some pages fail; count towards `failedCount`.
  - For summary and claims, proceed with available pages; mark phase `"error"` only on total inability to proceed.
- Surface errors into `onboarding_events` with `type = "*.failed"` entries and a short `detail`.

## Webhooks (Optional)
- Add Firecrawl webhook route in `convex/http.ts`:
  - Route: `/api/firecrawl/webhook` using `httpRouter` and `httpAction`.
  - Handle `crawl.started`, `crawl.page`, `crawl.completed` by normalizing URL and upserting `crawl_pages` and events in near real-time.
  - Keep polling as a fallback to reconcile (idempotent upserts by `(onboardingFlowId, url)`).

## Configuration
- Environment: ensure `FIRECRAWL_API_KEY` is set (already used in `convex/firecrawl.ts`).
- Firecrawl crawl parameters:
  - `limit: 60` (tunable), `maxDiscoveryDepth: 2–3`.
  - `includePaths` and `excludePaths` per above.
  - `allowSubdomains: false`, `crawlEntireDomain: false`.

## Acceptance Criteria
- Content for scraped pages is stored in `_storage` with `contentRef` set in `crawl_pages`.
- Phases progress accurately and timeline events reflect granular state.
- Relevant pages list is populated and high-fidelity scrape completes before summary.
- Summary streams to the UI and persists final content into `seller_brain.summary` only after scraping finishes.
- Approved claims are generated, verified against stored content, and saved.
- Flow ends with `status = "completed"`.

## Rollout Plan
1) Ship server-side changes behind the existing UI.
2) Update UI to subscribe to new queries for flow/pages/events and summary stream.
3) Test against a staging domain with complex navigation (docs + blog + legal) to validate normalization/exclusions.
4) Iterate on exclude/include patterns if legitimate pages are missed.

## Test Plan
- Unit-test `normalizeUrl()` with a matrix of inputs: protocol variants, `www` vs apex, trailing slashes, tracking params, anchors, default filenames.
- Integration-test workflow end-to-end against 2–3 real sites:
  - Validate page counts, dedupe effectiveness, and storage writes.
  - Ensure phase/event sequencing and final `completed` status.
  - Verify summary is generated only after relevant scrape step completes.
  - Confirm claims that cannot be verified are rejected.

## Notes
- Keep agent initialization unchanged in `convex/agent.ts`.
- Summary generation is strictly gated: do not start until the relevant-pages scrape step is `"done"`.
- URL normalization is used both for dedupe and for consistent display.


