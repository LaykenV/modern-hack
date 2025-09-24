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
- **Paywall state**:
  - `paywallOpen: boolean` controls paywall dialog visibility
  - Auto-opens when `leadGenJob.billingBlock` exists
  - Managed via effects and user interactions

## Actions
- `api.marketing.startLeadGenWorkflow`
  - Triggered by "Start Lead Generation" button.
  - Returns new `jobId`; UI stores it and shows alert with ID.
- **`api.marketing.resumeLeadGenWorkflow`** (mutation)
  - Triggered after successful upgrade via paywall dialog
  - Clears billing block and resumes workflow from paused state
  - Includes auth verification and ownership checks

## Queries (all `useQuery` with skip guards)
- `api.marketing.getLeadGenJob({ jobId })`
  - Provides parent flow metadata, phases, last event, places snapshot.
  - **Includes `billingBlock`** for paywall integration (phase, featureId, preview data)
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
2. **Paywall Dialog** — `PaywallDialog` component rendered conditionally:
   - Opens automatically when `billingBlock` exists
   - Shows Autumn preview data (title, message, upgrade product)
   - Handles Stripe checkout and workflow resume on success
3. **Current job card** — Shows status, phases timeline (with display overrides: `scrape_content` → "Preparing Scrapes", `generate_dossier` → "Scrape Content & Generate Dossier"), overall progress bar, places snapshot.
   - **Paused status banner** — Orange warning when `status === "paused_for_upgrade"` with "Upgrade Now" button
   - **Phase indicators** — Orange dots for paused phases, visual status for each phase
4. **Counts summary** — Grid of chips sourced from counts query.
5. **Opportunities list** — Accordion per opportunity:
   - Header: name, domain, status, qualification score, audit badge.
   - Signals displayed as pill chips.
   - Audit progress bar (`complete phases / total`).
   - Expanded panel:
     - Fit reason text.
     - Phase list with statuses.
     - Dossier sections (summary, gaps, talking points, sources) once loaded.
     - "View scraped sources" toggle showing signed URLs & HTTP status.
6. **Recent jobs** — History list selecting `currentJobId` on click.

## UX safeguards
- All Convex queries use "skip" until required args are ready.
- Effects synchronize selection state:
  - Auto-select latest job once history loads.
  - Reset `viewSourcesForAuditId` when accordion collapses.
  - **Auto-open paywall** when `billingBlock` exists and paywall not already open
- Loading states: text placeholders (`Loading dossier...`, `Loading sources...`) for lazy queries.
- Error handling: `startLeadGenWorkflow` action catch block shows alert on failure.
- **Paywall integration**:
  - `useCustomer().refetch()` refreshes credits after upgrade
  - `handleUpgradeSuccess` orchestrates resume workflow after checkout
  - Visual feedback for paused workflows with upgrade prompts

## Extensibility notes
- Dossier/toggle sections structured for future pagination or additional panels.
- `SummaryChip` helper component encapsulates chip styling.
- Opportunities list renders all rows (< 20) but componentized for potential virtualization.
- **PaywallDialog** component designed for reuse across different workflows
- Billing integration patterns can be extended to other metered features

## Paywall Component Integration
- **Modified `PaywallDialog`** (`components/autumn/paywall-dialog.tsx`):
  - Props: `{ open, onOpenChange, preview, onSuccess }`
  - Uses `useCustomer().checkout()` for Stripe integration  
  - Calls `onSuccess()` after successful checkout
  - Backend-driven: receives preview data from Convex instead of calling `usePaywall`
- **Helper content** (`lib/autumn/paywall-content.tsx`): Unchanged, formats preview into user-friendly messages
- **Integration pattern**: Backend stores paywall data → UI displays → User upgrades → UI resumes workflow
