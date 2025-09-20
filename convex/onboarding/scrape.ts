import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
// Phase status updates are now handled by the workflow
import { internal } from "../_generated/api";

export const saveScrapedPageContent = internalMutation({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    agencyProfileId: v.id("agency_profile"),
    url: v.string(),
    title: v.optional(v.string()),
    markdown: v.optional(v.string()),
    statusCode: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Use consolidated upsert function, preserving existing content
    await ctx.runMutation(internal.onboarding.pageUtils.upsertPageData, {
      onboardingFlowId: args.onboardingFlowId,
      agencyProfileId: args.agencyProfileId,
      url: args.url,
      title: args.title,
      markdown: args.markdown,
      statusCode: args.statusCode,
      preserveExistingContent: true, // Don't overwrite existing contentRef
    });
    
    return null;
  },
});



