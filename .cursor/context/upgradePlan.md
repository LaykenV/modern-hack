# Lead Gen Workflow Upgrade Plan

## Goals
- Adjust displayed phase names in the frontend for clarity without touching backend schema.
- Rebalance overall progress so dossier work accounts for ~80% of the bar.

## Frontend Updates
- Update phase label mapping in dashboard components (`app/dashboard/page.tsx`) to show:
  - `scrape_content` → “Preparing Scrapes”
  - `generate_dossier` → “Scrape Content & Generate Dossier”
- Ensure any tooltips or docs (`leadGenUI.md`) mirror the new display names.

## Backend Updates
- Revise `marketing.getLeadGenProgress` to use weighted progress (e.g. 80% weight for `generate_dossier`, remaining 20% distributed across other phases).
- Adjust workflow progress reporting, if needed, so weighted totals behave correctly when no audits exist.

## Testing & Validation
- Add/refresh lightweight tests for `getLeadGenProgress` covering weighted math and edge cases.
- Manual smoke test: run a flow, confirm UI shows renamed phases and overall progress curve looks right.

## Rollout Notes
- No schema changes or data backfills required; all updates safe to deploy quickly.
