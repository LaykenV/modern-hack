"use node";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { autumn } from "../autumn";
import { Autumn } from "@useautumn/convex";
import { components } from "../_generated/api";

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
 * Robust billing pause error detector that works across runtimes
 * Handles prototype loss when BillingError crosses action→workflow boundary
 */
export function isBillingPauseError(err: unknown): boolean {
  if (err instanceof BillingError) {
    return true;
  }
  
  // Check error name (works when prototype is lost)
  if ((err as Error)?.name === "BillingError") {
    return true;
  }
  
  // Check error message substring (additional safety)
  if (String(err).includes("Workflow paused for billing")) {
    return true;
  }
  
  return false;
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
    customerId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log(`[Billing] Checking credits for ${args.featureId}, required: ${args.requiredValue}, phase: ${args.phase}, auditJobId: ${args.auditJobId || 'N/A'}, customerId: ${args.customerId ? 'provided' : 'not provided'}`);
    
    // Use ephemeral Autumn instance if customerId is provided (for background workflows)
    // Otherwise fall back to shared autumn instance (for interactive actions)
    let checkResult, error;
    if (args.customerId) {
      const ephemeralAutumn = new Autumn(components.autumn, {
        secretKey: process.env.AUTUMN_SECRET_KEY ?? "",
        identify: () => ({ customerId: args.customerId }),
      });
      ({ data: checkResult, error } = await ephemeralAutumn.check(ctx, {
        featureId: args.featureId,
      }));
    } else {
      ({ data: checkResult, error } = await autumn.check(ctx, {
        featureId: args.featureId,
      }));
    }

    if (error) {
      console.error("[Billing] Autumn check API error:", error);
      throw new Error(`Credit check failed: ${error}`);
    }

    // If not allowed, pause the workflow and store the preview data + creditInfo
    if (!checkResult?.allowed) {
      console.log('checkResult', checkResult);
      console.log(`[Billing] Credits insufficient for ${args.featureId}, pausing workflow`);
      
      // Derive creditInfo from Autumn check payload
      const creditInfo = checkResult ? {
        allowed: checkResult.allowed || false,
        atlasFeatureId: "atlas_credits", // Standard atlas feature ID
        requiredBalance: checkResult.required_balance || 0,
        balance: checkResult.balance || 0,
        deficit: Math.max(0, (checkResult.required_balance || 0) - (checkResult.balance || 0)),
        usage: checkResult.usage || 0,
        includedUsage: checkResult.included_usage || 0,
        interval: checkResult.interval || null,
        intervalCount: (checkResult as unknown as Record<string, unknown>).intervalCount as number || (checkResult as unknown as Record<string, unknown>).interval_count as number || 0,
        unlimited: checkResult.unlimited || false,
        overageAllowed: checkResult.overage_allowed || false,
        creditSchema: checkResult.credit_schema || [],
      } : undefined;
      
      // Store the billing block and pause the workflow
      await ctx.runMutation(internal.leadGen.statusUtils.pauseForBilling, {
        leadGenFlowId: args.leadGenFlowId,
        phase: args.phase,
        featureId: args.featureId,
        preview: checkResult?.preview || undefined,
        auditJobId: args.auditJobId,
        creditInfo,
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
    customerId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log(`[Billing] Tracking usage: ${args.featureId}, value: ${args.value}, customerId: ${args.customerId ? 'provided' : 'not provided'}`);
    
    // Use ephemeral Autumn instance if customerId is provided (for background workflows)
    // Otherwise fall back to shared autumn instance (for interactive actions)
    let error;
    if (args.customerId) {
      const ephemeralAutumn = new Autumn(components.autumn, {
        secretKey: process.env.AUTUMN_SECRET_KEY ?? "",
        identify: () => ({ customerId: args.customerId }),
      });
      ({ error } = await ephemeralAutumn.track(ctx, {
        featureId: args.featureId,
        value: args.value,
      }));
    } else {
      ({ error } = await autumn.track(ctx, {
        featureId: args.featureId,
        value: args.value,
      }));
    }

    if (error) {
      console.error("[Billing] Autumn track API error:", error);
      throw new Error(`Usage tracking failed: ${error}`);
    }

    console.log(`[Billing] Successfully tracked usage for ${args.featureId}`);
    return null;
  },
});
