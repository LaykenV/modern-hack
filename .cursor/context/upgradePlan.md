## Email & ICS Follow-up Upgrade Plan

### Context & Goals
- Prospect confirmation emails already send successfully via the Resend Convex component; we are extending follow-up coverage and reliability.
- New requirement: send a second email to the agency owner that includes a 15-minute ICS invite plus call summary.
- All agency owners authenticate through Google OAuth, so the summary email must reach their Google-linked address.
- Persist every outbound email in Convex with lifecycle tracking (`queued`, `sent`, `failed`) and capture errors for observability.
- Keep implementation aligned with official Convex Resend component guidance (queueing, durable retries, optional webhooks).

### Schema & Data Modeling
- Extend `emails` table (`convex/schema.ts`) with:
  - `from`, `to`, `bcc`, `type` (`prospect_confirmation`, `agency_summary`), `status` (`queued` | `sent` | `failed`), `storageRef` (optional `Id<"_storage">` for attachments), `error` (optional string for failure details).
  - Retain existing `subject`, `html`, `sent_at`, and `opportunityId`; consider `agencyId` for dashboard queries.
  - Add indexes supporting lookups by `opportunityId` and `agencyId` if not already present.
- Create a helper mutation that inserts new email records with status `queued` so all send paths share a consistent entry point.

### Email Lifecycle with Resend Component
- Continue using `new Resend(components.resend, { testMode: false })` from `@convex-dev/resend` to leverage queueing, batching, durable execution, and retries.
- Before calling `resend.sendEmail`, insert the email document with status `queued`; retain both the document `_id` and the component-returned `EmailId`.
- On successful send, patch the document to status `sent`, set `sent_at`, and optionally store the `EmailId` for future reconciliation (`resend.status`, webhook events).
- On error, capture message/stack in `error`, mark status `failed`, and consider scheduling retry logic via `ctx.scheduler.runAfter`.


### Prospect Email (Existing Flow)
- Preserve current template and sending logic; refactor shared utilities (formatting helpers, logging) so both emails reuse the same pieces.
- Ensure the existing flow now writes to the `emails` table (queued → sent/failed) for traceability.

### New Agency Summary Email
- Gather required context in `sendFollowUp.ts`: `meeting`, `call`, `agency`, `opportunity`.
- Template highlights:
  - Meeting time in agency timezone, prospect contact info, `call.summary`, duration from `call.billingSeconds`
  - BCC the agency’s Google OAuth email (from `agencyProfile` or auth mapping) and use a consistent sender (`Atlas Outbound <notifications@...>`).
  - Attach the generated ICS invite (15-minute duration) so the agency calendar is blocked automatically.

### ICS Generation & Handling
- Use the `ics` package (`import { createEvent } from "ics"`) as referenced in `/adamgibbons/ics` docs.
- Event payload specifics:
  - Start time: `meeting.meetingTime` converted to agency timezone.
  - Duration: fixed 15 minutes (per requirement).
  - Organizer/attendees: agency owner as attendee; include prospect contact in description.
  - Description: call summary, dial-in details, and prospect phone.
- Attachment strategy options:
  - Direct attachment via Resend API (base64-encoded `.ics` content) for simplicity.
  - Or store ICS string in Convex storage (`ctx.storage.store`) and reference `storageRef` so HTML can link/download.

### Error Handling & Observability
- Wrap ICS generation and Resend send operations in try/catch; log failures with `[Follow-up]` prefix per current style.
- If ICS generation fails, fall back to sending the email without attachment and record the issue in the email document.
- Ensure structured logs include meeting ID, agency, prospect, time, and email statuses for easier troubleshooting.

### Testing & Verification
- Manual verification:
  - Prospect and agency emails delivered.
  - ICS file imports cleanly into Google Calendar & Outlook.
  - Database entries reflect lifecycle states and capture any errors.

### Follow-up Enhancements (Future)
- Integrate Resend webhook to handle delivery, bounce, and complaint events in real time via `handleResendEventWebhook` and `onEmailEvent`.
- Add automated retries for `failed` emails and dashboards/alerts that surface delivery issues using the persisted status records.
- Explore React Email or shared template components if design requirements increase without sacrificing the simple Node-based flow.
