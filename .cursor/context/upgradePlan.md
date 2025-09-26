# Upgrade Plan — Post-Call AI Meeting Booking

## Overview
- Extend the Vapi call workflow so Atlas can surface a few recommended meeting times, allow prospects to suggest alternates, and automatically detect bookings from the transcript using `atlasAgentGroq`.
- Keep frontend changes out of scope for now; focus on Convex functions, data model updates, and backend observability.
- Reuse existing agency availability strings and persist contextual metadata so the AI can reason about open slots both during the call and afterward.

## Phase 1 – Data Model & Availability Foundations
- `convex/schema.ts`
  - Add `meetings` table with fields:
    - `agencyId: v.id("agency_profile")`
    - `opportunityId: v.id("client_opportunities")`
    - `callId: v.id("calls")`
    - `meetingTime: v.number()` (Unix ms)
    - Optional `createdBy`, `source` (default `"ai_call"`)
  - Index `by_agency_and_time` on `[agencyId, meetingTime]`.
- New helper module `convex/call/availability.ts`
  - Query `getAvailableSlots` (internal or public depending on future UI needs).
  - Inputs: `{ agencyId }`.
  - Logic:
    1. Load agency profile to get `timeZone`, `targetGeography`, and `availability[]` (strings like `"Tue 10:00-12:00"`).
    2. Use Luxon `DateTime` helpers (`DateTime.fromISO`, `setZone`, `plus`, `toUTC`) to generate potential 15-minute slots for the next 5–7 business days in the agency TZ while keeping results in ISO 8601.
    3. Fetch future meetings via `meetings` index (e.g., next 14 days) and remove conflicts using Luxon comparisons (`hasSame`, `toMillis`).
    4. Return structured slots `{ iso: string, label: string }` along with the raw availability strings for context; ensure outputs are serialized with `toISO()`.
  - Provide helpers for parsing availability windows into actual datetimes; keep in module for reuse by transcript analysis.

## Phase 2 – Call Initiation Enhancements
- `convex/call/calls.ts`
  - Before scheduling the Vapi action, call `api.availability.getAvailableSlots({ agencyId })`.
  - Derive:
    - `recommendedSlots`: top 3–4 upcoming ISO strings for the prompt.
    - `futureMeetings`: snapshot of the next 2 weeks of booked meetings.
  - Extend system prompt:
    - Include a section listing recommended slots in human-friendly format.
    - Instruct the assistant to explicitly confirm any agreed time and accept alternates if proposed.
  - Extend call metadata:
    - Persist `offeredSlotsISO`, `agencyAvailabilityWindows`, and `futureMeetings` on the call record (`ctx.db.patch` after insert). Dates should be stored as ISO strings returned by Luxon to avoid timezone ambiguity.
  - Pass this metadata into the scheduled `internal.vapi.startPhoneCall` payload.
- `convex/vapi.ts`
  - Update `startPhoneCall` args to accept optional `offeredSlotsISO`, `agencyAvailabilityWindows`, and `futureMeetings`.
  - Merge these into the assistant metadata sent to Vapi (`metadata.offeredSlotsISO`, etc.).
  - Ensure metadata keys remain JSON-serializable and small.

## Phase 3 – Transcript Analysis
- New `convex/call/ai.ts`
  - Internal action `processCallTranscript`:
    - Input `{ callId }`.
    - Load call doc to access transcript fragments, metadata, opportunity, agency context.
    - Reconstruct the availability grid using helpers from `convex/availability.ts` with Luxon for precise timezone math, factoring in booked meetings (including any newly persisted `futureMeetings`).
    - Aggregate transcript text (ordered by timestamp) and identify explicit rejections (for later status updates).
    - Use `atlasAgentGroq.generateText` with JSON output prompt including the availability list and instructions:
      - Determine if a meeting was booked.
      - Return `{ meetingBooked: boolean, slotIso: string | null, confidence: number, reasoning: string, rejectionDetected: boolean }`.
      - Only allow `slotIso` values present in the availability grid; use Luxon `DateTime.fromISO(slot, { zone: agencyTZ })` for validation.
    - Parse JSON defensively; log and exit if invalid or confidence below threshold.
    - Persist `bookingAnalysis` on the call doc for observability.
    - If `rejectionDetected` true, schedule status update for opportunity (`status: "Rejected"`).
    - If `meetingBooked` true, call `internal.meetings.finalizeBooking`.
- `convex/http.ts`
  - In the `end-of-call-report` branch:
    - After `internal.calls.finalizeReport`, look up the call record by `vapiCallId` (if not already retrieved).
    - Schedule `internal.ai.processCallTranscript` with `{ callId }`.

## Phase 4 – Meeting Finalization & Opportunity Status
- `convex/call/meetings.ts`
  - Internal mutation `finalizeBooking`:
    - Inputs `{ callId, isoTimestamp }`.
    - Validate slot is still open by querying `meetings` index and recomputing grid (Luxon `DateTime.fromISO(isoTimestamp).toMillis()` for comparisons).
    - Insert meeting row (source `"ai_call"`). Store `meetingTime` as `DateTime.fromISO(isoTimestamp).toMillis()`.
    - Patch `calls` doc with `outcome: "booked"`, `meeting_time` (ms), `currentStatus: "booked"`).
    - Patch related `client_opportunities` doc with `status: "Booked"`, `meeting_time`, and optionally store booking metadata.
    - Schedule follow-up placeholder action with `{ meetingId }`.
  - Provide helper `markOpportunityRejected` to centralize updates when the transcript indicates a rejection.

## Phase 5 – Follow-up Placeholder (Backend Only)
- New `convex/call/sendFollowUp.ts` (or update existing utility):
  - Internal action `sendBookingConfirmation`:
    - Inputs `{ meetingId }`.
    - Load meeting + relationships; log a structured message summarizing the booking.
    - Leave TODO for future Resend + ICS implementation.

## Observability & Instrumentation
- Add structured `ctx.log` statements around:
  - Availability slot generation (number generated, reasons for filtering).
  - Assistant prompt metadata (IDs only, avoid PII).
  - AI transcript decisions (confidence, reasoning, chosen slot).
  - Meeting finalization and opportunity status transitions.
- When logging or storing times, use Luxon `toISO()` for human-readable forms and `toMillis()` for persistence.
- Consider storing `analysisVersion` on call doc to ease migrations later.

## Testing & Verification Plan
- **Unit-style Convex tests:** Invoke `internal.ai.processCallTranscript` with mocked call records representing booked, rejected, and ambiguous transcripts.
- **Webhook replay:** Send canned `end-of-call-report` payloads to ensure the scheduler chain fires exactly once per call.
- **Race conditions:** Attempt parallel bookings on the same slot to confirm `finalizeBooking` guard logic blocks duplicates.
- **Negative cases:** Empty availability list, no transcript, or AI returning slot outside windows should leave opportunity untouched and log warnings.

## Dependencies & Notes
- Requires regenerated data model types after schema change.
- No frontend/UI work yet; ensure API additions remain internal unless later exposed.
- Maintain compatibility with existing timeline/credit systems; booking updates should not interfere with billing logic.
- Keep future email/ICS logic isolated so the placeholder can be swapped without reworking the booking pipeline.


