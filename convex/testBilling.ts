"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Test the billing integration by simulating a check and pause
 * This is for testing purposes only
 */
export const testBillingIntegration = action({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    billingBlocked: v.boolean(),
  }),
  handler: async (ctx, args) => {
    try {
      // Test the billing check - this will either pass or throw BillingError
      await ctx.runAction(internal.leadGen.billing.checkAndPause, {
        leadGenFlowId: args.leadGenFlowId,
        featureId: "lead_discovery",
        requiredValue: 1,
        phase: "source",
      });

      return {
        success: true,
        message: "Billing check passed - user has sufficient credits",
        billingBlocked: false,
      };
    } catch (error) {
      const errorMessage = String(error);
      
      if (errorMessage.includes("BillingError")) {
        return {
          success: true,
          message: "Billing check correctly blocked workflow due to insufficient credits",
          billingBlocked: true,
        };
      }

      return {
        success: false,
        message: `Billing test failed: ${errorMessage}`,
        billingBlocked: false,
      };
    }
  },
});
