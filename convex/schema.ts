import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  // Agency profile - updated from seller brain
  agency_profile: defineTable({
    userId: v.string(),
    companyName: v.string(),
    sourceUrl: v.string(),
    onboardingFlowId: v.optional(v.id("onboarding_flow")),
    pagesList: v.optional(
      v.array(
        v.object({
          url: v.string(),
          title: v.optional(v.string()),
          category: v.optional(v.string()),
        }),
      ),
    ),
    summary: v.optional(v.string()),
    approvedClaims: v.optional(
      v.array(
        v.object({
          id: v.string(),
          text: v.string(),
          source_url: v.string(),
        }),
      ),
    ),
    guardrails: v.optional(v.array(v.string())),
    tone: v.optional(v.string()),
    timeZone: v.optional(v.string()),
    availability: v.optional(v.array(v.string())),
    targetVertical: v.optional(v.string()),
    targetGeography: v.optional(v.string()),
    coreOffer: v.optional(v.string()),
    leadQualificationCriteria: v.optional(v.array(v.string())),
  }).index("by_userId", ["userId"]),

  // Client opportunities - leads found via Google Places
  client_opportunities: defineTable({
    agencyId: v.id("agency_profile"),
    name: v.string(),
    domain: v.optional(v.string()),
    phone: v.optional(v.string()),
    place_id: v.string(),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    rating: v.optional(v.number()),
    reviews_count: v.optional(v.number()),
    source: v.string(), // "google_places"
    fit_reason: v.optional(v.string()),
    status: v.optional(v.string()),
  }).index("by_agency", ["agencyId"]).index("by_place_id", ["place_id"]),

  // Audit dossier - detailed analysis of each opportunity
  audit_dossier: defineTable({
    opportunityId: v.id("client_opportunities"),
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

  // Call records
  calls: defineTable({
    opportunityId: v.id("client_opportunities"),
    agencyId: v.id("agency_profile"),
    transcript: v.optional(v.array(v.any())), // Flexible transcript format
    outcome: v.optional(v.string()),
    meeting_time: v.optional(v.string()),
    status: v.optional(v.string()),
    duration: v.optional(v.number()),
  }).index("by_opportunity", ["opportunityId"]).index("by_agency", ["agencyId"]),

  // Email records
  emails: defineTable({
    opportunityId: v.id("client_opportunities"),
    subject: v.string(),
    html: v.string(),
    status: v.optional(v.string()),
    sent_at: v.optional(v.number()),
  }).index("by_opportunity", ["opportunityId"]),

  onboarding_flow: defineTable({
    userId: v.string(),
    agencyProfileId: v.id("agency_profile"),
    companyName: v.string(),
    sourceUrl: v.string(),
    workflowId: v.optional(v.string()),
    crawlJobId: v.optional(v.string()),
    status: v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("error"),
      v.literal("completed"),
    ),
    workflowStatus: v.optional(v.union(
      v.literal("running"),
      v.literal("completed"), 
      v.literal("failed"),
      v.literal("cancelled")
    )),
    // Simplified phase tracking - single source of truth
    phases: v.array(v.object({
      name: v.union(
        v.literal("crawl"),
        v.literal("filter"),
        v.literal("scrape"),
        v.literal("summary"),
        v.literal("coreOffer"),
        v.literal("claims"),
        v.literal("verify"),
      ),
      status: v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("complete"),
        v.literal("error"),
      ),
      progress: v.number(), // 0-1
      errorMessage: v.optional(v.string()),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      duration: v.optional(v.number()), // completedAt - startedAt in milliseconds
    })),
    // Count fields removed - computed dynamically from crawl_pages
    // AI threads - three dedicated threads for parallel processing
    summaryThread: v.optional(v.string()),
    coreOfferThread: v.optional(v.string()),
    claimThread: v.optional(v.string()),
    relevantPages: v.optional(v.array(v.string())),
    // Key events embedded (replacing events table)
    lastEvent: v.optional(v.object({
      type: v.string(),
      message: v.string(),
      timestamp: v.number(),
    })),
  }).index("by_userId", ["userId"]).index("by_agencyProfileId", ["agencyProfileId"]),
  // Note: Removed by_workflowId index since workflowId is optional and causes index issues
  // Using programmatic lookup with fallback to agencyProfileId instead


  crawl_pages: defineTable({
    onboardingFlowId: v.id("onboarding_flow"),
    agencyProfileId: v.id("agency_profile"),
    url: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("fetching"),
      v.literal("scraped"),
      v.literal("failed"),
    ),
    httpStatus: v.optional(v.number()),
    contentRef: v.optional(v.id("_storage")),
    title: v.optional(v.string()),
  })
    .index("by_flow", ["onboardingFlowId"])
    .index("by_flow_and_url", ["onboardingFlowId", "url"])
    .index("by_flow_and_status", ["onboardingFlowId", "status"]),
});
