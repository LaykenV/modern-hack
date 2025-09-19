import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  seller_brain: defineTable({
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
    icpIndustry: v.optional(v.array(v.string())),
    icpCompanySize: v.optional(v.array(v.string())),
    icpBuyerRole: v.optional(v.array(v.string())),
    // Legacy status fields removed - use onboarding_flow.status and phases instead
  }).index("by_userId", ["userId"]),

  onboarding_flow: defineTable({
    userId: v.string(),
    sellerBrainId: v.id("seller_brain"),
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
    // AI threads
    fastThreadId: v.optional(v.string()),
    smartThreadId: v.optional(v.string()),
    relevantPages: v.optional(v.array(v.string())),
    // Key events embedded (replacing events table)
    lastEvent: v.optional(v.object({
      type: v.string(),
      message: v.string(),
      timestamp: v.number(),
    })),
  }).index("by_userId", ["userId"]).index("by_sellerBrainId", ["sellerBrainId"]),
  // Note: Removed by_workflowId index since workflowId is optional and causes index issues
  // Using programmatic lookup with fallback to sellerBrainId instead


  crawl_pages: defineTable({
    onboardingFlowId: v.id("onboarding_flow"),
    sellerBrainId: v.id("seller_brain"),
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
