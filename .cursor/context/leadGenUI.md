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
  - Auto-opens when `billingBlock` exists, unless dismissed for this pause event
  - `paywallDismissed: boolean` prevents auto-reopen after user closes; resets on new pause or job change
  - Managed via effects and user interactions
  - No longer needs separate upgrade success handling (handled within dialog)

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
  - **Includes `billingBlock`** for paywall integration (phase, featureId, optional preview data, detailed creditInfo)
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
   - Opens automatically when `billingBlock` exists unless dismissed for the current pause
   - Shows generic upgrade messaging with credit deficit information
   - Embeds Autumn's `<PricingTable />` directly inside the dialog
   - Auto-detects upgrade completion and resumes workflow with countdown
   - Provides manual "I've Upgraded — Resume Now" fallback button
   - Dismissal is keyed by `featureId`/`phase`/`createdAt`; the paused status banner provides an "Upgrade Now" button that clears dismissal and reopens the dialog
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
  - **Auto-open paywall** when `billingBlock` exists and paywall not already open, unless dismissed for the current pause; dismissal resets on new pause or job switch
- Loading states: text placeholders (`Loading dossier...`, `Loading sources...`) for lazy queries.
- Error handling: `startLeadGenWorkflow` action catch block shows alert on failure.
- **Enhanced paywall integration**:
  - Auto-upgrade detection via window focus/visibility events
  - Automatic workflow resume with success countdown
  - Credit balance and deficit display with cost reminders
  - Visual feedback for paused workflows with upgrade prompts

## Extensibility notes
- Dossier/toggle sections structured for future pagination or additional panels.
- `SummaryChip` helper component encapsulates chip styling.
- Opportunities list renders all rows (< 20) but componentized for potential virtualization.
- **PaywallDialog** component designed for reuse across different workflows
- Billing integration patterns can be extended to other metered features
 - Dismiss-and-reopen behavior supported: dialog close marks dismissed, banner button reopens

## Paywall Component Integration (Upgrade Plan Implementation)
- **Redesigned `PaywallDialog`** (`components/autumn/paywall-dialog.tsx`):
  - **New Props**: `{ open, onOpenChange, billingBlock, onResume, onRefetchCustomer }`
  - **Embedded PricingTable**: Direct `<PricingTable />` integration inside dialog
  - **Auto-upgrade detection**: Window focus/visibility listeners detect return from Stripe checkout
  - **Auto-resume logic**: Automatically calls `onRefetchCustomer()` then `onResume()` on upgrade detection
  - **Success state**: Shows "Thank you for upgrading!" with 5-second countdown and auto-close
  - **Manual fallback**: "I've Upgraded — Resume Now" button for failed auto-detection
  - **Generic messaging**: Derives content from `billingBlock.creditInfo` (balance, deficit, feature costs)
  - **Preview-agnostic**: Works without Autumn `preview` data, backward compatible
- **Deprecated**: `lib/autumn/paywall-content.tsx` no longer used (kept for potential other use cases)
- **Enhanced integration pattern**: Backend stores `billingBlock` with `creditInfo` → UI displays embedded PricingTable → Auto-detects upgrade → Auto-resumes workflow
  - **Dismiss-and-reopen**: Parent tracks `paywallDismissed`. `onOpenChange(false)` sets dismissal to prevent auto-reopen. "Upgrade Now" banner button clears dismissal and reopens the dialog.
