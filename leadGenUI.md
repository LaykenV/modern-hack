# Lead Generation UI — Dashboard Wiring

## Overview
- Parent dashboard page is `app/dashboard/page.tsx` (Next.js client component).
- Requires authentication; redirects unauthenticated users to `/`.
- Shows agency profile (via `api.sellerBrain.getForCurrentUser`) and credit meter, then renders the lead generation workflow section.
- Uses Convex `useAction`/`useQuery` hooks for all backend interactions; queries gated with "skip" until dependencies load.

## State management
- `currentJobId: Id<'lead_gen_flow'> | null`
  - Set from `startLeadGenWorkflow` response.
  - Defaults to most recent job from `listLeadGenJobsByAgency` via effect.
- Form state: `numLeads`, `targetVertical`, `targetGeography` inputs for starting new workflow.
- UI interaction state:
  - `expandedOpportunityId` for per-opportunity accordion.
  - `viewSourcesForAuditId` toggles the scraped sources panel; reset when accordion collapses.

## Actions
- `api.marketing.startLeadGenWorkflow`
  - Triggered by "Start Lead Generation" button.
  - Returns new `jobId`; UI stores it and shows alert with ID.

## Queries (all `useQuery` with skip guards)
- `api.marketing.getLeadGenJob({ jobId })`
  - Provides parent flow metadata, phases, last event, places snapshot.
- `api.marketing.getLeadGenProgress({ jobId })`
  - Drives overall progress bar in status card.
- `api.marketing.getLeadGenFlowCounts({ leadGenFlowId })`
  - Feeds summary chip grid (totals, audits, ready counts).
- `api.marketing.listClientOpportunitiesByFlow({ leadGenFlowId })`
  - Supplies opportunity cards (name, status, qualification, signals, fit reason).
- `api.marketing.listAuditJobsByFlow({ leadGenFlowId })`
  - Joined with opportunities via memoized map for audit status + phase progress.
- `api.marketing.getAuditDossier({ dossierId })`
  - Lazy-loaded only when expanded opportunity has `dossierId`.
- `api.marketing.listScrapedPagesByAudit({ auditJobId })`
  - Lazy-loaded when “View scraped sources” toggle is active.
- `api.marketing.listLeadGenJobsByAgency({ agencyId })`
  - Populates history sidebar and default job selection when `currentJobId` is null.
- `api.auth.getCurrentUser`, `api.sellerBrain.getForCurrentUser`
  - Used for gating UI and showing agency info.

## Derived data & memoization
- `auditJobMap = useMemo(() => new Map(auditJobs.map(job => [job.opportunityId, job])))`
  - Enables O(1) lookup of audit job per opportunity.
- `selectedAuditJob = auditJobMap.get(expandedOpportunityId)`
  - Drives dossier query and per-phase display.

## UI layout
1. **Start form** — Number of leads and optional campaign overrides; runs action.
2. **Current job card** — Shows status, phases timeline (with display overrides: `scrape_content` → “Preparing Scrapes”, `generate_dossier` → “Scrape Content & Generate Dossier”), overall progress bar, places snapshot.
3. **Counts summary** — Grid of chips sourced from counts query.
4. **Opportunities list** — Accordion per opportunity:
   - Header: name, domain, status, qualification score, audit badge.
   - Signals displayed as pill chips.
   - Audit progress bar (`complete phases / total`).
   - Expanded panel:
     - Fit reason text.
     - Phase list with statuses.
     - Dossier sections (summary, gaps, talking points, sources) once loaded.
     - “View scraped sources” toggle showing signed URLs & HTTP status.
5. **Recent jobs** — History list selecting `currentJobId` on click.

## UX safeguards
- All Convex queries use "skip" until required args are ready.
- Effects synchronize selection state:
  - Auto-select latest job once history loads.
  - Reset `viewSourcesForAuditId` when accordion collapses.
- Loading states: text placeholders (`Loading dossier...`, `Loading sources...`) for lazy queries.
- Error handling: `startLeadGenWorkflow` action catch block shows alert on failure.

## Extensibility notes
- Dossier/toggle sections structured for future pagination or additional panels.
- `SummaryChip` helper component encapsulates chip styling.
- Opportunities list renders all rows (< 20) but componentized for potential virtualization.
