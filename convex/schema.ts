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
    reviewedAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  // Client opportunities - leads found via Google Places
  client_opportunities: defineTable({
    agencyId: v.id("agency_profile"),
    name: v.string(),
    domain: v.optional(v.string()),
    phone: v.optional(v.string()), // Kept optional in schema, but will be required by our filter logic
    place_id: v.string(),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    rating: v.optional(v.number()),
    reviews_count: v.optional(v.number()),
    source: v.string(), // "google_places"
    fit_reason: v.optional(v.string()),
    status: v.string(), // e.g., "SOURCED", "SCRAPING", "DATA_READY", "AUDITING", "READY", "CONTACTED"

    // For lead generation workflow tracking
    leadGenFlowId: v.optional(v.id("lead_gen_flow")), // Link to parent run
    
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
  .index("by_agency_and_campaign", ["agencyId", "targetVertical", "targetGeography"])
  // New index for lead generation flow tracking
  .index("by_leadGenFlow", ["leadGenFlowId"]) 
  // New indexes for domain lookups without filters
  .index("by_agency_and_domain", ["agencyId", "domain"]) 
  .index("by_leadGenFlow_and_domain", ["leadGenFlowId", "domain"]),

  // Audit dossier - detailed analysis of each opportunity
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
    // Optional sources list for display (upgrade plan requirement)
    sources: v.optional(
      v.array(
        v.object({
          url: v.string(),
          title: v.optional(v.string()),
        }),
      ),
    ),
  }).index("by_opportunity", ["opportunityId"]),

  // Lead generation flow - parent run document (analogous to onboarding_flow)
  lead_gen_flow: defineTable({
    userId: v.string(),
    agencyId: v.id("agency_profile"),
    numLeadsRequested: v.number(),
    numLeadsFetched: v.number(),
    campaign: v.object({
      targetVertical: v.string(),
      targetGeography: v.string(),
    }),
    status: v.union(
      v.literal("idle"),
      v.literal("running"), 
      v.literal("paused_for_upgrade"),
      v.literal("error"),
      v.literal("completed"),
    ),
    workflowStatus: v.optional(v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"), 
      v.literal("cancelled")
    )),
    workflowId: v.optional(v.string()),
    // Billing block for paywall integration
    billingBlock: v.optional(v.object({
      phase: v.union(
        v.literal("source"),
        v.literal("generate_dossier"),
      ),
      featureId: v.union(
        v.literal("lead_discovery"),
        v.literal("dossier_research"),
      ),
      preview: v.optional(v.any()), // Autumn preview object (optional for backward compatibility)
      auditJobId: v.optional(v.id("audit_jobs")),
      createdAt: v.number(),
      creditInfo: v.optional(v.object({
        allowed: v.boolean(),
        atlasFeatureId: v.string(),
        requiredBalance: v.number(),
        balance: v.number(),
        deficit: v.number(),
        usage: v.number(),
        includedUsage: v.number(),
        interval: v.union(v.string(), v.null()),
        intervalCount: v.number(),
        unlimited: v.boolean(),
        overageAllowed: v.boolean(),
        creditSchema: v.array(v.object({
          feature_id: v.string(),
          credit_amount: v.number(),
        })),
      })),
    })),
    phases: v.array(v.object({
      name: v.union(
        v.literal("source"),
        v.literal("filter_rank"),
        v.literal("persist_leads"),
        v.literal("scrape_content"),
        v.literal("generate_dossier"),
        v.literal("finalize_rank"),
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
    // Key events embedded
    lastEvent: v.optional(v.object({
      type: v.string(),
      message: v.string(),
      timestamp: v.number(),
    })),
    // Minimal fields for UI preview (≤20 places)
    placesSnapshot: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      website: v.optional(v.string()),
      phone: v.optional(v.string()),
      rating: v.optional(v.number()),
      reviews: v.optional(v.number()),
      address: v.optional(v.string()),
    }))),
  })
  .index("by_userId", ["userId"])
  .index("by_agencyId", ["agencyId"]),

  // --- NEW TABLE ---
  // To track the state of a deep audit on a client opportunity (Point 4)
  audit_jobs: defineTable({
    opportunityId: v.id("client_opportunities"),
    agencyId: v.id("agency_profile"),
    leadGenFlowId: v.optional(v.id("lead_gen_flow")), // Link to parent run for aggregation
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
    // Thread/user context for AI calls (upgrade plan requirement)
    analysisThread: v.optional(v.string()), // Dedicated thread per audit job
    // Idempotent billing flag (upgrade plan requirement)
    metered: v.optional(v.boolean()), // Track if dossier research has been billed
  })
  .index("by_opportunity", ["opportunityId"])
  .index("by_agency", ["agencyId"])
  .index("by_leadGenFlow", ["leadGenFlowId"]),

  // --- NEW TABLE ---
  // Scraped pages with storage references (upgrade plan requirement)
  audit_scraped_pages: defineTable({
    auditJobId: v.id("audit_jobs"),
    opportunityId: v.id("client_opportunities"),
    url: v.string(),
    title: v.optional(v.string()),
    httpStatus: v.optional(v.number()),
    contentRef: v.optional(v.id("_storage")), // Reference to stored markdown content
  })
  .index("by_auditJobId", ["auditJobId"])
  .index("by_opportunityId", ["opportunityId"])
  .index("by_auditJobId_and_url", ["auditJobId", "url"]),

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
