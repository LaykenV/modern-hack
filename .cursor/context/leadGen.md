## Lead Generation Workflow — Architecture Update (Parent Run + Per-Opportunity)

- Parent run document: `lead_gen_flow` (analogous to `onboarding_flow`) tracks the full pipeline phases and emits UI-friendly events.
- Per-opportunity: `client_opportunities` holds row-level lifecycle (`SOURCED` → `SCRAPING` → `DATA_READY` → `AUDITING` → `READY`; skip `SCRAPING` when no website). Each opportunity links back to the run via `leadGenFlowId` and retains campaign fields.
- Deep audit: reuse `audit_jobs` per selected opportunity; optionally include `leadGenFlowId` for aggregation.
- UI pattern: subscribe to the parent run for the phase timeline and counts; subscribe to `client_opportunities` by `leadGenFlowId` for the table.

### Workflow phases (parent)
- `source` → `filter_rank` → `persist_leads` → `scrape_content` → `generate_dossier` → `finalize_rank`.
- Progress comes from phase weights plus dynamic counts over `client_opportunities` scoped by `leadGenFlowId`.

### Step 1 (to implement first)
- Public action `marketing.startLeadGenWorkflow({ numLeads, targetVertical?, targetGeography? })` starts a `lead_gen_flow` using `workflow.start` with `{ onComplete: internal.marketing.handleLeadGenWorkflowComplete, context: { leadGenFlowId } }`, stores `workflowId`, and returns `{ jobId }`.
- Phase `source`: build `textQuery = "{targetVertical} in {targetGeography}"`, call an internal action reusing the existing Places implementation; clamp to ≤20; dedupe by Google id or canonical domain (drop if either duplicates); save `placesSnapshot` and `numLeadsFetched`; mark phase complete and emit `lastEvent`.
- Resilience: retries with exponential backoff; phase error + lastEvent on failure; onComplete handler updates `workflowStatus` ("completed" | "failed" | "cancelled"); no writes to `client_opportunities` yet (defer to `persist_leads`).

---

## Atlas Outbound — Lead Pipeline v2 Integration Plan

This plan details the architecture for an intelligent lead sourcing, scoring, and auditing pipeline. It builds upon the completed onboarding flow by adding sophisticated qualification logic, campaign tracking, and a reusable deep-audit workflow.

### 1. Updated Convex Schema

To support the new features, we'll introduce a new `audit_jobs` table and enhance the `client_opportunities` table.

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ... (agency_profile, calls, emails, onboarding_flow, crawl_pages remain the same) ...
  agency_profile: defineTable({
    // ... no changes needed here
  }),

  client_opportunities: defineTable({
    agencyId: v.id("agency_profile"),
    name: v.string(),
    domain: v.optional(v.string()),
    phone: v.optional(v.string()), // Kept optional in schema, but will be required by our filter logic
    email: v.optional(v.string()), // Contact email discovered during audit/dossier phase
    place_id: v.string(),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    rating: v.optional(v.number()),
    reviews_count: v.optional(v.number()),
    source: v.string(), // "google_places"
    fit_reason: v.optional(v.string()),
    status: v.string(), // e.g., "SOURCED", "AUDITING", "READY", "CONTACTED"
    meeting_time: v.optional(v.number()), // Unix ms timestamp for booked meetings

    // --- NEW & ENHANCED FIELDS ---
    // For campaign tracking & filtering (Point 5)
    targetVertical: v.string(), 
    targetGeography: v.string(), 
    
    // For intelligent ranking (Point 3)
    qualificationScore: v.number(), // The calculated score (e.g., 85/100)

    // For detailed UI badges & reasoning (Points 1 & 3)
    signals: v.array(v.string()), // Stores raw signals like "MISSING_WEBSITE", "WEAK_WEB_PRESENCE"
    
  })
  .index("by_agency", ["agencyId"])
  .index("by_place_id", ["place_id"])
  // New index for campaign-based filtering
  .index("by_agency_and_campaign", ["agencyId", "targetVertical", "targetGeography"]),

  audit_dossier: defineTable({
    opportunityId: v.id("client_opportunities"),
    // --- NEW FIELD ---
    auditJobId: v.optional(v.id("audit_jobs")), // Link to the job that generated this dossier
    summary: v.optional(v.string()),
    identified_gaps: v.optional(
      v.array(
        v.object({
          key: v.string(),
          value: v.string(),
          source_url: v.optional(v.string()),
        }),
      ),
    ),
    talking_points: v.optional(
      v.array(
        v.object({
          text: v.string(),
          approved_claim_id: v.string(),
          source_url: v.optional(v.string()),
        }),
      ),
    ),
  }).index("by_opportunity", ["opportunityId"]),
  
  // --- NEW TABLE ---
  // To track the state of a deep audit on a client opportunity (Point 4)
  audit_jobs: defineTable({
    opportunityId: v.id("client_opportunities"),
    agencyId: v.id("agency_profile"),
    targetUrl: v.string(),
    status: v.union(v.literal("queued"), v.literal("running"), v.literal("error"), v.literal("completed")),
    phases: v.array(v.object({ // Mirrors your onboarding_flow for consistency
      name: v.union(
        v.literal("map_urls"),
        v.literal("filter_urls"),
        v.literal("scrape_content"),
        v.literal("generate_dossier"),
      ),
      status: v.union(v.literal("pending"), v.literal("running"), v.literal("complete"), v.literal("error")),
    })),
    dossierId: v.optional(v.id("audit_dossier")), // The final output
  })
  .index("by_opportunity", ["opportunityId"])
  .index("by_agency", ["agencyId"]),

  // ... (calls, emails, onboarding_flow, crawl_pages) ...
});
```

---

### 2. The Revised Lead Generation & Audit Pipeline

This pipeline is a Convex `action` triggered by the user. It finds, filters, scores, and queues leads for deep analysis.

#### **Phase 1: Sourcing, Triage, and Scoring**

**Trigger**: User clicks "Find Qualified Clients". This calls a Convex action `sourceAndScoreLeads(agencyId)`.

1.  **Fetch Agency Profile**: Get the current `agency_profile`, including `targetVertical`, `targetGeography`, and `leadQualificationCriteria`.

2.  **Source from Google Places**: Query the Google Places `textSearch` API with a query like `"[targetVertical]" in "[targetGeography]"`. Request `place_id`, `name`, `website`, `international_phone_number`, `rating`, `user_ratings_total`.

3.  **Triage and Score Each Lead**: This is the core logic enhancement. For each result from Google Places, perform the following steps in memory before writing to the database:

    *   **Hard Filter (Point 2)**: If `international_phone_number` is missing or invalid, **discard the lead immediately** and continue to the next one.
    *   **Signal Detection**: Create an empty `signals` array.
        *   `if (!place.website)`: Add `"MISSING_WEBSITE"` to `signals`.
        *   `else if (isSocialMediaLink(place.website))`: Add `"WEAK_WEB_PRESENCE"` to `signals` (Point 1). `isSocialMediaLink` is a helper function that checks the domain against a list like `['facebook.com', 'yelp.com', 'instagram.com']`.
        *   `if (place.rating < 4.0 && place.user_ratings_total > 5)`: Add `"LOW_GOOGLE_RATING"` to `signals`.
        *   For other criteria in `agency_profile.leadQualificationCriteria` like `"WEBSITE_NOT_MOBILE_FRIENDLY"`, add a placeholder signal like `"NEEDS_WEB_AUDIT"`. These will be confirmed in Phase 2.

    *   **Dynamic Scoring (Point 3)**: Calculate a `qualificationScore`.
        *   Define a base weight map: `{ "MISSING_WEBSITE": 50, "WEAK_WEB_PRESENCE": 35, "LOW_GOOGLE_RATING": 30, "NEEDS_WEB_AUDIT": 15 }`. These values represent maximum potential points.
        *   Initialize `score = 0`.
        *   Iterate through the `signals` detected for the lead.
        *   **Crucially**, only add points if the signal is something the agency wants to solve.
            ```typescript
            // Example scoring logic
            const agencyWants = agencyProfile.leadQualificationCriteria; // e.g., ["MISSING_WEBSITE", "LOW_GOOGLE_RATING"]
            
            for (const signal of detectedSignals) {
              if (agencyWants.includes(signal)) {
                 score += weights[signal];
              }
            }
            ```
        *   The final `score` is the `qualificationScore`.

4.  **Save Opportunities**: For each lead that passes the phone filter, create a `client_opportunities` record with the calculated data:
    *   `agencyId`
    *   Google Places data (`name`, `place_id`, etc.)
    *   `status: "SOURCED"`
    *   **`targetVertical` and `targetGeography`** from the agency profile at this moment (Point 5).
    *   **`qualificationScore`**: The calculated score.
    *   **`signals`**: The array of detected pain points.

5.  **Queue for Deep Audit**: After all leads are saved, query the top N highest-scoring leads (e.g., top 10 or any with `score > 50`) that have the `"NEEDS_WEB_AUDIT"` signal. For each of these, trigger the deep audit pipeline.

#### **Phase 2: Deep Audit (Leveraging Your Existing Workflow)**

**Trigger**: Called from the end of Phase 1 for high-potential leads with a website. Calls a Convex action `runDeepAudit(opportunityId)`.

1.  **Create an `audit_jobs` Record (Point 4)**:
    *   Create a new record in the `audit_jobs` table linked to the `opportunityId`.
    *   Set `status: "queued"` and initialize the `phases`.
    *   This gives the user real-time visibility into the audit process for each lead.

2.  **Execute Reusable Crawl Workflow**: Adapt your existing `map -> filter -> scrape -> structure` workflow.
    *   **`map_urls`**: Start with the lead's `domain`. Crawl it to find related pages (About, Services, etc.).
    *   **`filter_urls`**: Use your AI agent to select the most relevant pages for a business audit (e.g., prioritize services pages over blog posts).
    *   **`scrape_content`**: Use Firecrawl to get the markdown for the filtered URLs.
    *   **`generate_dossier`**: This is the final AI step.
        *   Combine all scraped markdown with the Google Places data.
        *   Use your AI agent with a prompt to analyze everything and generate the `identified_gaps` JSON (confirming things like "WEBSITE_NOT_MOBILE_FRIENDLY", "NO_CALL_TO_ACTION", etc.).
        *   Create the `audit_dossier` record in Convex.
        *   Update the `audit_jobs` record with the `dossierId` and set `status: "completed"`.

3.  **Finalize the Opportunity**: Once the audit job is complete:
    *   Update the `client_opportunities` record. Change `status` to `"READY"`.
    *   Use another AI agent call to synthesize the final `fit_reason` based on the *combination* of initial signals (from Google) and deep signals (from the dossier). Example: `"Opportunity: Low Google rating & no clear call-to-action on website."`

### 3. UI/UX Implications of the New Plan

*   **Ranked Opportunities**: The "Client Opportunities" list is now a prioritized work queue, sorted by `qualificationScore` descending. The agency instantly knows where to focus.
*   **Dynamic Badges**: The `signals` array can be used to render multiple, specific badges on each lead row (e.g., a red "NO WEBSITE" badge next to a yellow "LOW RATING" badge). This provides at-a-glance context.
*   **Campaign Filtering**: A new set of dropdowns on the dashboard will allow the agency owner to filter their opportunities by the historical `targetVertical` and `targetGeography` they were generated for. This is essential for managing multiple campaigns.
*   **Transparent Auditing**: If a lead's status is `"AUDITING"`, the UI can show the current active phase from the `audit_jobs` table, making the user feel like the system is actively working for them.
*   **Richer Dossiers**: The "Client Opportunity Report" is now built from a much more robust process, increasing the quality of the `identified_gaps` and the resulting AI call script.
*   **Email Discovery**: Contact emails are automatically extracted from prospect websites during the audit phase, providing additional contact options beyond phone numbers for follow-up communications.