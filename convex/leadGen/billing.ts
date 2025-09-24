"use node";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { autumn } from "../autumn";

/**
 * Custom error class for billing-related failures
 */
export class BillingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingError";
  }
}

/**
 * Check if user has sufficient credits and pause workflow if not
 * This is the core billing integration action
 */
export const checkAndPause = internalAction({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
    featureId: v.union(v.literal("lead_discovery"), v.literal("dossier_research")),
    requiredValue: v.number(),
    phase: v.union(v.literal("source"), v.literal("generate_dossier")),
    auditJobId: v.optional(v.id("audit_jobs")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log(`[Billing] Checking credits for ${args.featureId}, required: ${args.requiredValue}`);
    
    // Call Autumn's check API to verify credit availability
    const { data: checkResult, error } = await autumn.check(ctx, {
      featureId: args.featureId,
    });

    if (error) {
      console.error("[Billing] Autumn check API error:", error);
      throw new Error(`Credit check failed: ${error}`);
    }

    // If not allowed, pause the workflow and store the preview data
    if (!checkResult?.allowed) {
      console.log(`[Billing] Credits insufficient for ${args.featureId}, pausing workflow`);
      
      // Store the billing block and pause the workflow
      await ctx.runMutation(internal.leadGen.statusUtils.pauseForBilling, {
        leadGenFlowId: args.leadGenFlowId,
        phase: args.phase,
        featureId: args.featureId,
        preview: checkResult?.preview || {},
        auditJobId: args.auditJobId,
      });

      // Throw BillingError to halt the workflow
      throw new BillingError(`Workflow paused for billing: insufficient credits for ${args.featureId}`);
    }

    console.log(`[Billing] Credits check passed for ${args.featureId}`);
    return null;
  },
});

/**
 * Track usage after successful operation
 * Call this ONLY after the metered operation succeeds
 */
export const trackUsage = internalAction({
  args: {
    featureId: v.union(v.literal("lead_discovery"), v.literal("dossier_research")),
    value: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log(`[Billing] Tracking usage: ${args.featureId}, value: ${args.value}`);
    
    const { error } = await autumn.track(ctx, {
      featureId: args.featureId,
      value: args.value,
    });

    if (error) {
      console.error("[Billing] Autumn track API error:", error);
      throw new Error(`Usage tracking failed: ${error}`);
    }

    console.log(`[Billing] Successfully tracked usage for ${args.featureId}`);
    return null;
  },
});
