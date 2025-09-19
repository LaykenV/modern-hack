## Onboarding SellerBrain Seeding — Implementation Plan

### Goals
- Provide a fast, transparent onboarding that ingests a company website, streams progress to the UI, and produces a cited summary plus verified claims.
- Use two agents: a fast-but-less-smart agent for early filtering and verification, and a slower smart agent for high-quality summarization and claim generation.
- Orchestrate everything via a durable, retryable Convex Workflow with reactive status observability.

### Key decisions
- Firecrawl mode: start with crawl (discovery + bulk fetch). After relevance filtering, use scrape on selected pages for higher-fidelity content. This balances speed, coverage, and quality.
- Live UI: persist granular progress (discovery, per-page status, phase transitions, stream deltas) in Convex tables; subscribe from the client. Use `@convex-dev/agent` streaming with saved deltas for the smart agent summary.
- Orchestration: replace the current `seedFromWebsite` action with a `@convex-dev/workflow` that owns each step, with retries and idempotency.
- Separation of concerns: keep `seller_brain` focused on long-lived app data; introduce `onboarding_flow` and related tables for onboarding-only state and observability.

### Data model adjustments (Convex)
- seller_brain (existing; remains app-wide)
  - Keep existing fields.
  - Add `onboardingFlowId: Id<'onboarding_flow'>` to link to the active onboarding.
  - Add `pagesList: Array<{ url: string; title?: string; category?: string }>` — compact snapshot of relevant/scraped pages for reuse outside onboarding.
  - Continue to store final `summary` and `approvedClaims` here when onboarding completes.

- onboarding_flow (new; onboarding-specific)
  - Keys: `_id`, `userId`, `sellerBrainId`, `sourceUrl`, `companyName`.
  - Orchestration: `workflowId` (from `@convex-dev/workflow`), `crawlJobId` (Firecrawl job id).
  - Overall lifecycle: `status: "idle" | "running" | "error" | "completed"`.
  - Phase fields (fine-grained):
    - `crawlPhase`, `filterPhase`, `scrapePhase`, `summaryPhase`, `claimsPhase`, `verifyPhase`
    - each: `"starting" | "in_progress" | "done" | "error"` and optional `errorMessage`.
  - Progress: `crawlProgress` (0–1), counts for `discoveredCount`, `scrapedCount`, `failedCount`.
  - Threads: `fastThreadId`, `smartThreadId` (for agent streams), `summaryMessageId?`, `claimsCandidateIds?`.
  - Results: `relevantPages: string[]` (final filtered list used for scraping).

- onboarding_events (new; for timeline transparency)
  - Fields: `onboardingFlowId`, `userId`, `sellerBrainId`, `type`, `message`, `detail?`, `ts`.
  - Example `type` values: `"crawl.started"`, `"crawl.discovered"`, `"crawl.page_fetching"`, `"crawl.page_done"`, `"crawl.page_failed"`, `"crawl.completed"`, `"filter.completed"`, `"scrape.started"`, `"scrape.page_done"`, `"summary.streaming_started"`, `"summary.completed"`, `"claims.generated"`, `"claims.verification_started"`, `"claims.verified"`, `"onboarding.completed"`.

- crawl_pages (new; per-URL state)
  - Fields: `onboardingFlowId`, `sellerBrainId`, `url`, `status: "queued" | "fetching" | "scraped" | "failed"`, `httpStatus?`, `contentRef?: Id<'_storage'>`, `error?`.
  - Index by `onboardingFlowId` for efficient live streaming to the onboarding UI.

Notes:
- Keep heavy page content in `_storage` and reference via `contentRef` to stay within Convex document size limits.
- At onboarding completion, snapshot a compact `pagesList` into `seller_brain`, leaving `crawl_pages` for audit/caching.

### Workflow design (`@convex-dev/workflow`)
Workflow args: `{ sourceUrl: string, companyName: string }` (user-submitted form values).

Default behavior:
- Durable, retryable steps. Use sensible `maxAttempts` and jittered backoff for network calls (Firecrawl, LLMs).
- Idempotency: key per-page updates by `(onboardingFlowId, url)`; avoid duplicate events by checking last-known state.

Steps (high level):
1) Initialize
   - Create `onboarding_flow` with `status="running"`, set all phases to `"starting"`.
   - Create threads: `fastThreadId` and `smartThreadId` (via `@convex-dev/agent`).
   - Link `seller_brain.onboardingFlowId`.
   - Event: `onboarding.started`.

2) Crawl — discovery + bulk fetch (Firecrawl `crawl`)
   - Configure: domain-scoped, normalize `www`, obey robots; `maxDepth: 2–3`, `maxPages: 40–80`, formats: `["markdown", "links"]`.
   - Start job; store `crawlJobId`; set `crawlPhase="in_progress"`; event `crawl.started`.
   - Poll job status periodically (using workflow step delays). On each poll:
     - Upsert `crawl_pages` for new URLs as `queued`; event `crawl.discovered`.
     - Mark in-flight pages as `fetching` when observed; event `crawl.page_fetching`.
     - Persist page content blobs and mark `scraped` on completion; event `crawl.page_done`.
     - Mark `failed` with `error` for failures; event `crawl.page_failed`.
     - Update `crawlProgress`, counts.
   - Stop when job completes or limits/timebox hit. Event `crawl.completed`; set `crawlPhase="done"`.

3) Fast agent — relevance filtering
   - Input: discovered URLs (and optionally brief content snippets per page).
   - Task: rank and select ~10–20 relevant pages (product, features, pricing, docs, about; exclude legal/careers/blog unless core).
   - Output: `relevantPages` with reasons/categories; persist to `onboarding_flow`; event `filter.completed`; set `filterPhase="done"`.

4) Scrape relevant pages (Firecrawl `scrape`) in parallel
   - For each URL in `relevantPages`, run `scrape` with formats `["markdown"]` using bounded concurrency (workpool `maxParallelism` or batches).
   - Store `contentRef` for each page, mark `scraped` or `failed`, and emit per-page events; update counts.
   - Event `scrape.started` then phase `scrapePhase="done"` when all complete.

5) Smart agent — streaming summary
   - Curate context: prioritize homepage + product/docs + about; trim content to fit token limits.
   - Use `@convex-dev/agent` with `saveStreamDeltas: true` on `smartThreadId` to stream summary text; event `summary.streaming_started`.
   - On completion, persist final summary into `seller_brain.summary`; event `summary.completed`; set `summaryPhase="done"`.

6) Smart agent — claims generation (parallel with summary or after)
   - Generate 3–5 structured claims: `{ text, source_url }`, each mapped to one crawled page. Do not fabricate; omit if unsupported.
   - Persist candidates transiently in `onboarding_flow` (or proceed directly to verification); event `claims.generated`; set `claimsPhase="done"` when generation done.

7) Fast agent — claims verification
   - For each candidate claim, load the `source_url` page text from storage and strictly verify support and guardrails (guardrails can be integrated in step 2 of the UI wizard later).
   - Accept/reject with reason; event per claim verification; aggregate verified claims.
   - Persist verified to `seller_brain.approvedClaims`; event `claims.verified`; set `verifyPhase="done"`.

8) Persist + finalize
   - Snapshot compact `pagesList` to `seller_brain` from `relevantPages` (+ optional titles/categories).
   - Set `onboarding_flow.status="completed"`.
   - Optionally use `onComplete` to perform cleanup or emit a final `onboarding.completed` event.

Error handling & retries:
- Mark phase `"error"` and store `errorMessage`; continue where possible (e.g., summary can proceed despite some page failures).
- Configure retries for Firecrawl/network; keep verifier idempotent.

### Firecrawl configuration details
- Crawl: domain-bound; `maxDepth 2–3`, `maxPages 40–80`, `formats: ["markdown", "links"]`; exclude `/legal`, `/privacy`, tracking params; allow include allowlist.
- Scrape: high-fidelity `markdown` for `relevantPages`; store as `_storage` blobs referenced by `crawl_pages.contentRef`.
- Early summary: optionally begin when thresholds reached (e.g., ≥50% progress or ≥10 pages scraped) to improve perceived speed.

### Agents and prompting strategy
- Fast agent (filtering & verifier):
  - Filtering prompt: “Rank site URLs for sales relevance. Prefer product/docs/pricing/about. Exclude careers/legal/blog unless core. Return top 10–20 with reasons.”
  - Verifier prompt: “Given a claim and the full text from its source URL, determine if the claim is strongly supported verbatim. If weak/unrelated/violates guardrails, reject with reason and matched snippet.”
- Smart agent (summary & claims):
  - Summary: concise company profile with inline citations `[n]` mapped to `source_url` list; obey guardrails.
  - Claims: 3–5 statements, each must include exactly one `source_url` that directly supports it; omit unsupported claims.

### UI updates (onboarding wizard)
- Data subscriptions
  - `seller_brain.getForCurrentUser` to read `onboardingFlowId`, and later `summary`, `approvedClaims`.
  - `onboarding_flow.get` for overall/phase statuses, progress, threads, `relevantPages`.
  - `crawl_pages.listByFlow` (paginated) for the pages grid with per-URL status.
  - `onboarding_events.listByFlow` for the timeline; consider stream syncing helpers if using agent deltas.
  - `useThreadMessages` (from `@convex-dev/agent/react`) with `smartThreadId` and `{ stream: true }` for live summary text; use `useSmoothText` for nicer streaming.
- Panels & UX
  - Pages panel: discovered URLs appear within seconds; status chips (Queued, Crawling, Scraped, Failed); progress bar and counts.
  - Timeline panel: granular events across phases.
  - Summary panel: streaming text as generated by smart agent.
  - Claims panel: show generation, then verification states per claim; final list with sources.
  - Disable “Finish” until minimum viable content is ready (e.g., summary done + ≥1 verified claim), or let users continue while background finalization proceeds.

### Performance & safety considerations
- Concurrency: cap parallel scrapes via workflow workpool `maxParallelism` (e.g., 8–10); batch if needed.
- Token budgets: trim page content and prioritize sections; deduplicate URLs; enforce domain/depth.
- Storage: large content in `_storage`; pass references between steps; avoid exceeding document size limits.
- Resumability: workflow can recover across restarts; polling step continues from `crawlJobId` and known URLs.

### Milestones (implementation order)
1) Schema: add `onboarding_flow`, `onboarding_events`, `crawl_pages`; add `onboardingFlowId` and `pagesList` to `seller_brain`.
2) Workflow: define `onboardingWorkflow` (args: `sourceUrl`, `companyName`), create threads, link flow, emit start event.
3) Firecrawl steps: `crawl` + polling upserts for `crawl_pages`, progress, and events.
4) Fast agent filtering step → persist `relevantPages` + event.
5) Parallel scrape step with bounded concurrency → update `crawl_pages` + events.
6) Smart agent summary with streaming deltas → persist final summary.
7) Smart agent claims generation → fast agent verification → persist `approvedClaims`.
8) Finalize: snapshot `pagesList` to `seller_brain`, mark flow completed, final event.
9) UI: wire subscriptions to flow/pages/events + streaming summary.

### What stays the same
- The second onboarding form step (guardrails, tone, ICP, availability) remains as-is: a simple mutation updating `seller_brain` fields after the seeding workflow completes.


