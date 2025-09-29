## Dashboard Refactor Plan

- **Layout & Sidebar**
  - Move the `Sign out` button from the overview page into `app/dashboard/layout.tsx`, positioning it at the bottom of the sidebar below the nav items. Keep the `Test Autumn Meter` button in the overview since it is a global utility.
  - Confirm the layout still renders shared modals or providers needed by all routes.

- **Authentication Shell**
  - Let `app/dashboard/page.tsx` handle only Convex auth gating, onboarding redirects, and delegating to child pages. Retain `Unauthenticated` → `/` redirect and the onboarding completion check before rendering the overview.

- **Overview (`app/dashboard/page.tsx`)**
  - Replace the current monolithic content with an overview focused on quick stats and navigation: user profile snapshot, credit meter, high-level lead generation summary, and links into Marketing, Calls, Meetings, etc.
  - Remove all lead-gen forms, job detail panels, and Seller Brain sections from this page.

- **Agency (`app/dashboard/agency/page.tsx`)**
  - Relocate the Seller Brain / agency profile block here. Fetch `api.agencyProfile.getForCurrentUser` and render company info, targeting, guardrails, approved claims, etc. in read-only form for now.

- **Marketing Index (`app/dashboard/marketing/page.tsx`)**
  - Build the campaign hub by moving the “Start Lead Generation” form and recent job list here.
  - Fetch `api.marketing.listLeadGenJobsByAgency`, `api.marketing.getLeadGenFlowCounts`, and any other aggregate data needed for quick stats once the agency ID is available.
  - After `startLeadGenWorkflow` completes, `router.push` to `/dashboard/marketing/[jobId]` instead of managing `currentJobId` state.
  - Manage paywall dialog state here only if it is global to all jobs; otherwise, keep it scoped to the detail page.

- **Marketing Detail (`app/dashboard/marketing/[flowId]/page.tsx`)**
  - Port the job-specific UI: workflow phases, overall progress, billing block banner/paywall dialog, counts summary, places snapshot, opportunity list, dossier preview, scraped sources, etc.
  - Remove the live call panel and transcript from this page. When a call is available or started, provide navigation to `/dashboard/calls/[callId]`.
  - Maintain state and queries scoped to the flow (expanded opportunity, view sources, dossier loading) using the URL param for the flow ID.

- **Calls Index (`app/dashboard/calls/page.tsx`)**
  - Ensure this route provides a summary/table of recent calls or, minimally, a placeholder pointing to individual call workspaces.
  - Optionally reuse shared call summary components extracted from the old dashboard content.

- **Call Workspace (`app/dashboard/calls/[callId]/page.tsx`)**
  - Relocate the live call experience (status badge, timer, credit usage, transcript stream, listen modal, summary) from the old dashboard to this route.
  - Fetch call data via existing Convex queries (e.g., `api.call.calls.getCallById` or equivalent) and manage polling/subscriptions as currently done within the dashboard page.
  - Keep the Live Listen modal and transcript auto-scroll effects here. Ensure the paywall or credit messaging appears here only if directly related to call continuation.
  - Link back to the originating opportunity and marketing flow for context.

- **Shared Components / Hooks**
  - Extract reusable UI pieces (phase list, opportunity card shell, dossier section, transcript view, etc.) into `app/dashboard/(shared)/` or `app/dashboard/marketing/components/` so that marketing detail and calls pages stay focused.
  - Isolate utilities such as `formatDuration`, paywall state management, and `useAtlasCredits` into shared helpers.

- **Data & Naming Alignment**
  - Replace lingering `sellerBrain` references with `agencyProfile` terminology across new pages.
  - Ensure each route only imports the Convex queries/actions it uses, eliminating the broad import list from the original dashboard file.

- **Testing & Verification**
  - Manual path checks: `/dashboard` (overview), `/dashboard/agency`, `/dashboard/marketing`, `/dashboard/marketing/[flowId]`, `/dashboard/calls`, `/dashboard/calls/[callId]`.
  - Start a lead generation run from the marketing index and confirm redirect to the detail page with correct data loading.
  - From an opportunity, start a call and verify navigation to the call workspace, transcript updates, and live listen functionality.
  - Confirm the paywall dialog still appears when workflows pause for upgrades and that the sign-out button works from the sidebar.

