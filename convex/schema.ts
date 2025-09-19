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
    crawlStatus: v.union(
      v.literal("idle"),
      v.literal("crawling"),
      v.literal("seeded"),
      v.literal("error"),
      v.literal("approved"),
    ),
    crawlError: v.optional(v.string()),
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
    crawlPhase: v.union(
      v.literal("starting"),
      v.literal("in_progress"),
      v.literal("done"),
      v.literal("error"),
    ),
    filterPhase: v.union(
      v.literal("starting"),
      v.literal("in_progress"),
      v.literal("done"),
      v.literal("error"),
    ),
    scrapePhase: v.union(
      v.literal("starting"),
      v.literal("in_progress"),
      v.literal("done"),
      v.literal("error"),
    ),
    summaryPhase: v.union(
      v.literal("starting"),
      v.literal("in_progress"),
      v.literal("done"),
      v.literal("error"),
    ),
    claimsPhase: v.union(
      v.literal("starting"),
      v.literal("in_progress"),
      v.literal("done"),
      v.literal("error"),
    ),
    verifyPhase: v.union(
      v.literal("starting"),
      v.literal("in_progress"),
      v.literal("done"),
      v.literal("error"),
    ),
    crawlProgress: v.number(),
    discoveredCount: v.number(),
    scrapedCount: v.number(),
    failedCount: v.number(),
    fastThreadId: v.optional(v.string()),
    smartThreadId: v.optional(v.string()),
    summaryMessageId: v.optional(v.string()),
    claimsCandidateIds: v.optional(v.array(v.string())),
    relevantPages: v.optional(v.array(v.string())),
  }).index("by_userId", ["userId"]).index("by_sellerBrainId", ["sellerBrainId"]),

  onboarding_events: defineTable({
    onboardingFlowId: v.id("onboarding_flow"),
    userId: v.string(),
    sellerBrainId: v.id("seller_brain"),
    type: v.string(),
    message: v.string(),
    detail: v.optional(v.string()),
    ts: v.number(),
  }).index("by_flow", ["onboardingFlowId"]).index("by_userId", ["userId"]),

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
    error: v.optional(v.string()),
    title: v.optional(v.string()),
  }).index("by_flow", ["onboardingFlowId"]).index("by_flow_and_url", ["onboardingFlowId", "url"]),
});
