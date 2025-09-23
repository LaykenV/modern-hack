## Lead Gen Upgrade Plan (Scoped)

Scope: Implement only (1) thread/user context with analysisThread and (2) storage persistence with contentRef. Remove retry/backoff and status validator changes from this plan.

### 1) Threads and userId context (analysisThread only)
- Purpose: Ensure all AI calls in audits have reliable context like onboarding by using a per‑audit thread, with userId fallback.
- Data model
  - `audit_jobs.analysisThread?: string` — dedicated thread per audit job.
  - `lead_gen_flow.userId: string` — already present or ensure available to pass as fallback context.
- Initialization
  - When queueing audits (in `leadGen/auditInit.ts`): create an agent thread for each new `audit_jobs` row and persist it to `analysisThread`.
  - Ensure `lead_gen_flow.userId` is set at flow creation (used as fallback when thread is missing).
- Context propagation
  - `leadGen/workflow.ts` → pass `userId` into `runAuditAction` args.
  - `leadGen/audit.ts`
    - `filterRelevantUrls`: call `atlasAgentGroq.generateText(ctx, { threadId: auditJob.analysisThread } || { userId }, { prompt })`.
    - `generateDossierAndFitReason`: same call signature and fallback.
- Note

### 2) Persist scraped content to storage with references (no embedding in dossier)
- Rationale: Avoid Convex doc size limits and enable incremental updates; keep dossiers compact while keeping page content accessible.
- New table (recommended)
  - `audit_scraped_pages`
    - Fields: `{ auditJobId, opportunityId, url, title?, httpStatus?, contentRef }`
    - Indexes: `by_auditJobId`, `by_opportunityId`, `by_auditJobId_and_url`
- Scrape/write flow
  - In `firecrawlActions.scrapeAuditUrls`:
    - Store markdown to `_storage` as Blob; get `contentRef`.
    - Call `leadGen.audit.saveScrapedPageWithStorage({ auditJobId, opportunityId, url, title, httpStatus, contentRef })` per URL (batch‑safe), upsert by `(auditJobId, url)`.
    - Return lightweight descriptors `{ url, title?, contentRef }` to the caller (no markdown strings in memory beyond local processing).
- Dossier generation flow
  - `generateDossierAndFitReason` loads and truncates page text using `contentRef` from `audit_scraped_pages` (select the small set of pages used for analysis), then builds prompts.
  - Save on `audit_dossier` only:
    - `summary`, `identified_gaps`, `talking_points`
    - Optional `sources: Array<{ url: string, title?: string }>` for display.
  - Do NOT embed a `pageContent` array on `audit_dossier`; rely on `audit_scraped_pages` for any future reads.

### Acceptance checklist
- `analysisThread` created/stored per `audit_jobs` and used by all AI calls in audits with `userId` fallback.
- Scraped pages persisted as `_storage` blobs and referenced via `audit_scraped_pages` with proper indexes.
- Dossier remains compact (no embedded page content), with optional `sources` list.
- No new retry/backoff or status validator changes introduced by this plan.


