/**
 * Lead generation workflow finalization
 * Completes the workflow and updates final status
 */

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Finalize the lead generation workflow
 * Marks the finalize_rank phase as complete and triggers flow completion
 */
export const finalizeLeadGenWorkflow = internalAction({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { leadGenFlowId } = args;

    console.log(`[Lead Gen Finalize] Finalizing workflow for flow ${leadGenFlowId}`);

    try {
      // Update finalize_rank phase to running
      await ctx.runMutation(internal.leadGen.statusUtils.updatePhaseStatus, {
        leadGenFlowId,
        phaseName: "finalize_rank",
        status: "running",
        progress: 0.1,
        eventMessage: "Finalizing lead generation workflow",
      });

      // Get final counts for summary
      const opportunityCounts = await ctx.runQuery(internal.leadGen.persist.getOpportunityCountByFlow, {
        leadGenFlowId,
      });

      // Mark finalize_rank phase as complete
      await ctx.runMutation(internal.leadGen.statusUtils.updatePhaseStatus, {
        leadGenFlowId,
        phaseName: "finalize_rank",
        status: "complete",
        progress: 1.0,
        eventMessage: `Lead generation completed: ${opportunityCounts.total} opportunities created`,
      });

      // Complete the entire workflow
      await ctx.runMutation(internal.leadGen.statusUtils.completeFlow, {
        leadGenFlowId,
      });

      console.log(`[Lead Gen Finalize] Successfully completed workflow with ${opportunityCounts.total} opportunities`);

      return null;
    } catch (error) {
      console.error("[Lead Gen Finalize] Error finalizing workflow:", error);
      
      await ctx.runMutation(internal.leadGen.statusUtils.recordFlowError, {
        leadGenFlowId,
        phase: "finalize_rank",
        error: String(error),
      });

      throw new Error(`Finalize phase failed: ${String(error)}`);
    }
  },
});
