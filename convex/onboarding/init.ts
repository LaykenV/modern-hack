import { internalMutation, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { authComponent } from "../auth";
import { components } from "../_generated/api";
import { createThread } from "@convex-dev/agent";
import { EventTypes, createInitialPhases } from "./constants";

export const initOnboarding = internalMutation({
  args: {
    sellerBrainId: v.id("seller_brain"),
    companyName: v.string(),
    sourceUrl: v.string(),
  },
  returns: v.object({ onboardingFlowId: v.id("onboarding_flow") }),
  handler: async (ctx, args) => {
    const { sellerBrainId, companyName, sourceUrl } = args;
  const user = await authComponent.getAuthUser(ctx);
  if (!user) throw new Error("Unauthorized");
  const flowId = await ctx.db.insert("onboarding_flow", {
    userId: user._id,
    sellerBrainId,
    companyName,
    sourceUrl,
    workflowId: undefined,
    crawlJobId: undefined,
    status: "running",
    phases: createInitialPhases(),
    // Count fields removed - computed dynamically from crawl_pages
    fastThreadId: undefined,
    smartThreadId: undefined,
    relevantPages: [],
  });
  await ctx.db.patch(sellerBrainId, { onboardingFlowId: flowId });
  // Set initial event in the flow document (no separate events table)
  await ctx.db.patch(flowId, {
    lastEvent: {
      type: EventTypes.OnboardingStarted,
      message: "Onboarding started",
      timestamp: Date.now(),
    },
  });
    return { onboardingFlowId: flowId };
  },
});

export const createThreads = internalAction({
  args: { onboardingFlowId: v.id("onboarding_flow") },
  returns: v.object({ fastThreadId: v.string(), smartThreadId: v.string() }),
  handler: async (ctx) => {
    const fastThreadId = await createThread(ctx, components.agent);
    const smartThreadId = await createThread(ctx, components.agent);
    return { fastThreadId, smartThreadId };
  },
});

export const setThreads = internalMutation({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    fastThreadId: v.string(),
    smartThreadId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.onboardingFlowId, {
      fastThreadId: args.fastThreadId,
      smartThreadId: args.smartThreadId,
    });
    return null;
  },
});

export const setWorkflowId = internalMutation({
  args: { 
    sellerBrainId: v.id("seller_brain"), 
    workflowId: v.string(),
    retryCount: v.optional(v.number())
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const retryCount = args.retryCount ?? 0;
    
    // Find the onboarding flow for this seller brain
    const flow = await ctx.db
      .query("onboarding_flow")
      .withIndex("by_sellerBrainId", (q) => q.eq("sellerBrainId", args.sellerBrainId))
      .order("desc")
      .first();
    
    if (flow) {
      await ctx.db.patch(flow._id, { workflowId: args.workflowId });
      console.log(`Successfully set workflowId ${args.workflowId} for flow ${flow._id}`);
    } else if (retryCount < 5) {
      // Retry up to 5 times with exponential backoff
      console.warn(`Flow not found for sellerBrainId ${args.sellerBrainId}, retry ${retryCount + 1}/5`);
      // Schedule a retry after a small delay (this would need to be called from an action with setTimeout)
      throw new Error(`Flow not found, retry ${retryCount + 1}/5`);
    } else {
      console.error(`Failed to find flow for sellerBrainId ${args.sellerBrainId} after 5 retries`);
    }
    return null;
  },
});



