import { internalMutation, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { components } from "../_generated/api";
import { createThread } from "@convex-dev/agent";
import { EventTypes, createInitialPhases } from "./constants";

export const initOnboarding = internalMutation({
  args: {
    agencyProfileId: v.id("agency_profile"),
    companyName: v.string(),
    sourceUrl: v.string(),
    userId: v.string(), // Pass userId from the authenticated action
  },
  returns: v.object({ onboardingFlowId: v.id("onboarding_flow") }),
  handler: async (ctx, args) => {
    const { agencyProfileId, companyName, sourceUrl, userId } = args;
    
    const flowId = await ctx.db.insert("onboarding_flow", {
      userId,
      agencyProfileId,
      companyName,
      sourceUrl,
      workflowId: undefined,
      crawlJobId: undefined,
      status: "running",
      phases: createInitialPhases(),
      // Count fields removed - computed dynamically from crawl_pages
      summaryThread: undefined,
      coreOfferThread: undefined,
      claimThread: undefined,
      relevantPages: [],
    });
    
    await ctx.db.patch(agencyProfileId, { onboardingFlowId: flowId });
    
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
  returns: v.object({ summaryThread: v.string(), coreOfferThread: v.string(), claimThread: v.string() }),
  handler: async (ctx) => {
    const summaryThread = await createThread(ctx, components.agent);
    const coreOfferThread = await createThread(ctx, components.agent);
    const claimThread = await createThread(ctx, components.agent);
    return { summaryThread, coreOfferThread, claimThread };
  },
});

export const setThreads = internalMutation({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    summaryThread: v.string(),
    coreOfferThread: v.string(),
    claimThread: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.onboardingFlowId, {
      summaryThread: args.summaryThread,
      coreOfferThread: args.coreOfferThread,
      claimThread: args.claimThread,
    });
    return null;
  },
});

export const setWorkflowId = internalMutation({
  args: { 
    agencyProfileId: v.id("agency_profile"), 
    workflowId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find the onboarding flow for this agency profile
    const flow = await ctx.db
      .query("onboarding_flow")
      .withIndex("by_agencyProfileId", (q) => q.eq("agencyProfileId", args.agencyProfileId))
      .order("desc")
      .first();
    
    if (flow) {
      await ctx.db.patch(flow._id, { workflowId: args.workflowId });
      console.log(`Successfully set workflowId ${args.workflowId} for flow ${flow._id}`);
    } else {
      console.warn(`Flow not found for agencyProfileId ${args.agencyProfileId} - this is expected if called before flow creation`);
    }
    return null;
  },
});



