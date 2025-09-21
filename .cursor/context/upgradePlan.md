## Fix plan: Page status never enters "fetching" during scraping

### Problem
- After filtering, pages are saved as `queued` and later become `scraped` (or `failed`). They never transition to `fetching` during the scrape phase.

### Root cause
- `convex/firecrawlActions.ts` `scrapeRelevantPages` does not set `fetching` before calling Firecrawl.
- `convex/onboarding/pageUtils.ts` `upsertPageData` defaults to `queued` when no content is present (discovery-only), so there is no place where `fetching` is applied.
- `convex/onboarding/scrape.ts` `saveScrapedPageContentWithStorage` can revert status to `queued` when neither markdown nor a definitive HTTP status is present.

### Plan of action (no code yet)
1) Add a dedicated status setter for page-level transitions
   - Create `markPageFetching(onboardingFlowId, agencyProfileId, url)` in `convex/onboarding/pageUtils.ts`:
     - Normalize `url` with `normalizeUrl`.
     - Upsert `crawl_pages` row to `status: "fetching"` without touching `contentRef`.
     - If row is missing, insert with `status: "fetching"`.

2) Set `fetching` right before each scrape call
   - In `convex/firecrawlActions.ts` `scrapeRelevantPages`, before `firecrawl.scrape(url, ...)`:
     - Call `markPageFetching(...)` for that `url`.
     - Preserve existing batching, delays, and progress updates.

3) Preserve `fetching` unless we can definitively finalize
   - In `convex/onboarding/scrape.ts` `saveScrapedPageContentWithStorage`:
     - Use `normalizeUrl` instead of ad‑hoc string replaces.
     - If markdown exists with 2xx status → set `status: "scraped"`.
     - If status is 4xx/5xx → set `status: "failed"`.
     - Otherwise, do NOT set `status` (leave as `fetching`), only patch `title`, `httpStatus`, and `contentRef` if present.

4) Mark failures on exceptions
   - In `scrapeRelevantPages`, if a scrape throws, set that page to `failed` (new helper `markPageFailed(...)` or a generic `setPageStatus(...)`).

5) Keep counts/UI unchanged
   - `getFlowCounts` already exposes `fetchingCount`.
   - `PageDiscoveryGrid` already renders a `fetching` chip. No UI changes needed.

7) Ambiguous scrape outcomes
   - When Firecrawl returns neither markdown nor a reliable status code, mark the page as `failed` (avoid stuck `fetching` states).

### Acceptance criteria
- During scrape, `fetchingCount` rises as URLs are being processed.
- Each URL transitions `queued → fetching → scraped` (or `failed`), with no reversions from `fetching` back to `queued`.
- Counts and UI chips reflect `fetching` while batches are in-flight.
- Ambiguous outcomes produce `failed`, not a silent revert to `queued` or stuck `fetching`.




