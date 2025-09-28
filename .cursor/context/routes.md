# Dashboard Routing Plan

This plan assumes users finish onboarding before ever seeing the dashboard. Once onboarding is marked complete, `/dashboard` and its children are unlocked and onboarding routes redirect to `/dashboard/agency` for any future edits.

## High-Level Flow
- Landing (`/`) → authentication → onboarding wizard.
- Onboarding completion triggers redirect to `/dashboard` (overview).
- Onboarding routes remain blocked afterward; agency details are edited within the Agency page.
- Global layout provides sidebar navigation, top-level usage stats, notifications, and shared modals (paywall, live listen, dossier preview, email preview).

## Primary Routes

### `/dashboard` (Overview)
- Purpose: command center with quick actions and current state summary.
- Content:
  - Hero tile with current credit balance, active campaign snapshot, next scheduled meeting.
  - Quick-start buttons (`Start lead generation`, `View ready opportunities`, `Review latest call`, `Send follow-up`).
  - Pipeline highlights: counts of READY opportunities, calls in progress, recent emails.
  - Global timeline feed aggregating events (campaign paused, call booked, email failed) with deep links.
- Data sources: `api.auth.getCurrentUser`, `api.agencyProfile.getForCurrentUser`, `api.marketing.listLeadGenJobsByAgency`, `api.marketing.getLeadGenFlowCounts`, `api.call.calls.getRecent`, `api.call.meetings.listUpcoming`, `api.call.emails.listRecent`.

### `/dashboard/agency`
- Purpose: single source of truth for agency configuration.
- Content:
  - Editable sections: company info, core offer, ICP (vertical, geography), guardrails, availability, claims.
  - Read-only historical onboarding summary (latest workflow results, relevant pages, timestamps).
  - Actions: edit sections, upload new claims, manage availability, regenerate summary/claims if needed.
- Post-onboarding: no pathway back to wizard; edits happen inline with standard mutations.

### `/dashboard/marketing`
- Purpose: campaign hub listing recent lead generation runs.
- Content:
  - “Start lead generation” button (opens modal, creates run, redirects to new flow detail).
  - Cards/table rows for each `lead_gen_flow` showing campaign targeting, status, leads fetched, last activity.
  - Quick filters for status (Running, Paused, Completed) and geography/vertical.
- Data: `api.marketing.listLeadGenJobsByAgency` plus aggregated credits info for warnings.

### `/dashboard/marketing/[flowId]`
- Purpose: deep dive into a specific lead gen run.
- Content:
  - Phase timeline with progress, durations, and billing block banners.
  - Places snapshot, events stream, credit/paywall prompts.
  - Opportunities table sorted by qualification score; each row expandable to reveal dossier summary, signals, audit job phases, scraped sources, call/email history.
  - Inline actions per opportunity: `Start call` (opens call workspace route)
  - Lead gen continuation controls: resume workflow, adjust filters, clone campaign.
- Data: `api.marketing.getLeadGenJob`, `api.marketing.getLeadGenProgress`, `api.marketing.getLeadGenFlowCounts`, `api.marketing.listClientOpportunitiesByFlow`, `api.marketing.listAuditJobsByFlow`, `api.marketing.getAuditDossier`, `api.marketing.listScrapedPagesByAudit`.
- UX: stay on this page while workflow runs; buttons trigger modals without navigating away.

### `/dashboard/calls`
- Purpose: history and monitoring of completed and in-progress calls.
- Content:
  - Filterable table (status, campaign, date) showing call outcomes, durations, meeting booking status.
  - Detail drawer for transcripts, recordings, billing info, booking analysis, follow-up status.
  - Banner for live calls (if any) linking to the call workspace route.
  - Actions: retry webhook reconciliation, trigger transcript re-analysis, jump to related opportunity or meeting.
- Data: `api.call.calls.getCallsByAgency`, `api.call.calls.getCallById`, `api.call.meetings.listByAgency`.

### `/dashboard/calls/[callId]`
- Purpose: dedicated live call workspace.
- Entry: “Start call” button from opportunity expansion schedules the call and redirects here immediately.
- Content:
  - Real-time call status, timer, credit usage, live transcript, listen controls, notes field.
  - Breadcrumbs/link back to originating opportunity and campaign.
- Completion: upon post-call processing, display success summary and auto-redirect to `/dashboard/calls` (or offer “Stay here” option).

### `/dashboard/meetings`
- Purpose: calendar-like view of booked meetings.
- Content:
  - Upcoming meetings list with date/time, opportunity, agency contact.
  - Calendar toggle (week/month) highlighting confirmed slots.
  - Actions: view meeting details, open related call, download ICS, reschedule/cancel, mark attended/no-show.
- Data: `api.call.meetings.listByAgency`, `api.call.calls.getCallById`, `api.marketing.listClientOpportunitiesByIds`.

### `/dashboard/emails`
- Purpose: monitor recap and summary email pipeline.
- Content:
  - Table of emails with status badges, prospect info, send time, error messages.
  - Preview panel rendering stored HTML, ICS download link, action buttons (copy snippet).
  - Filters by email type (prospect confirmation vs agency summary) and campaign.
- Data: `api.call.emails.listByAgency`, storage signed URLs for ICS or content.

### `/dashboard/subscription`
- Purpose: account billing and credit management.
- Content:
  - Current plan information, credit balances per feature, usage charts, renewal dates.
  - Plan upgrade/downgrade buttons integrating Autumn flows.
  - Payment method management, invoice history, account info (name, email, image) with edit controls.
- Data: `useCustomer()` from Autumn, `api.auth.getCurrentUser`, usage counters from marketing/calls modules.

### `/dashboard/settings`
- Purpose: miscellaneous configuration.
- Content:
  - Notification preferences (email, SMS, in-app).
  - Integration keys/placeholders (future CRMs, calendar providers).
  - Developer tools (toggle demo data, reset pipelines) guarded by role checks.
  - Support links and docs.

## Cross-Cutting Components & Behavior
- Sidebar persistent across all dashboard routes with nav items in the order: Overview → Agency → Marketing → Calls → Meetings → Emails → Subscription → Settings.
- Global timeline/notification center accessible from top nav, pulling events from lead gen, calls, emails, and billing.
- Shared modals mounted at layout root: paywall dialog, live listen, email preview, dossier sources.
- “Start lead generation” actions (Overview hero, Marketing index) create a run via mutation, then route directly to `/dashboard/marketing/[newFlowId]` so users can observe progress without manual navigation.
- Call initiation always begins from an opportunity context (primarily `/dashboard/marketing/[flowId]`); calls route to `/dashboard/calls/[callId]`, ensuring the Calls index remains focused on history/monitoring.
- Meeting creation and email sending emit events that update Overview, Marketing detail, Calls history, Meetings, and Emails pages in real time.


