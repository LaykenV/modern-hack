import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

export const markCrawlStarted = internalMutation({
  args: { onboardingFlowId: v.id("onboarding_flow"), crawlJobId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { onboardingFlowId, crawlJobId } = args;
    const flow = await ctx.db.get(onboardingFlowId);
  if (!flow) throw new Error("Flow not found");
  await ctx.db.patch(onboardingFlowId, { crawlJobId });
  // Event tracking now handled by updatePhaseStatus in workflow
    return null;
  },
});

export const upsertCrawlPages = internalMutation({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    agencyProfileId: v.id("agency_profile"),
    pages: v.array(
      v.object({
        url: v.string(),
        title: v.optional(v.string()),
        markdown: v.optional(v.string()),
        statusCode: v.optional(v.number()),
      }),
    ),
    totals: v.object({ total: v.optional(v.number()), completed: v.optional(v.number()) }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Use consolidated batch upsert function
    await ctx.runMutation(internal.onboarding.pageUtils.batchUpsertCrawlPages, {
      onboardingFlowId: args.onboardingFlowId,
      agencyProfileId: args.agencyProfileId,
      pages: args.pages,
    });
    
    return null;
  },
});
