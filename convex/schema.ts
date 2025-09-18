import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  numbers: defineTable({
    value: v.number(),
  }),
  seller_brain: defineTable({
    userId: v.string(),
    companyName: v.string(),
    sourceUrl: v.string(),
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
});
