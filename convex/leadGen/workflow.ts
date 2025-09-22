import { v } from "convex/values";
import { workflow } from "../workflows";
import { internal } from "../_generated/api";

/**
 * Lead Generation Workflow Definition
 * Implements Step 1: Google Places sourcing with deduplication and error handling
 */
export const leadGenWorkflow = workflow.define({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
    agencyProfileId: v.id("agency_profile"),
    userId: v.string(),
    numLeads: v.number(),
    campaign: v.object({
      targetVertical: v.string(),
      targetGeography: v.string(),
    }),
  },
  handler: async (step, args): Promise<null> => {
    // Phase 1: Source leads from Google Places
    try {
      // Update phase to running
      await step.runMutation(internal.leadGen.statusUtils.updatePhaseStatus, {
        leadGenFlowId: args.leadGenFlowId,
        phaseName: "source",
        status: "running",
        progress: 0.1,
        eventMessage: "Starting Google Places search",
      });

      // Build text query from campaign
      const textQuery = `${args.campaign.targetVertical} in ${args.campaign.targetGeography}`;
      console.log(`[Lead Gen Workflow] Searching for: "${textQuery}"`);

      // Call Google Places API with retries
      const sourcingResult = await step.runAction(
        internal.leadGen.source.sourcePlaces,
        {
          leadGenFlowId: args.leadGenFlowId,
          textQuery,
          maxResultCount: args.numLeads,
        },
        {
          retry: {
            maxAttempts: 3,
            initialBackoffMs: 800,
            base: 2,
          },
        }
      );

      // Update progress
      await step.runMutation(internal.leadGen.statusUtils.updatePhaseStatus, {
        leadGenFlowId: args.leadGenFlowId,
        phaseName: "source",
        status: "running",
        progress: 0.7,
        eventMessage: `Found ${sourcingResult.numFetched} places`,
      });

      // Check if we got any results
      if (sourcingResult.numFetched === 0) {
        throw new Error(`No places found for query: "${textQuery}". Try adjusting your target vertical or geography.`);
      }

      // Update places snapshot and fetched count
      await step.runMutation(internal.leadGen.init.updatePlacesSnapshot, {
        leadGenFlowId: args.leadGenFlowId,
        places: sourcingResult.places,
        numFetched: sourcingResult.numFetched,
      });

      // Mark source phase as complete
      await step.runMutation(internal.leadGen.statusUtils.updatePhaseStatus, {
        leadGenFlowId: args.leadGenFlowId,
        phaseName: "source",
        status: "complete",
        progress: 1.0,
        eventMessage: `Fetched ${sourcingResult.numFetched} places from Google Places`,
      });

      console.log(`[Lead Gen Workflow] Successfully sourced ${sourcingResult.numFetched} places`);

    } catch (error) {
      const errorMessage = String(error);
      console.error("[Lead Gen Workflow] Source phase failed:", errorMessage);
      
      await step.runMutation(internal.leadGen.statusUtils.recordFlowError, {
        leadGenFlowId: args.leadGenFlowId,
        phase: "source",
        error: errorMessage,
      });
      
      throw new Error(`Source phase failed: ${errorMessage}`);
    }

    // TODO: Phase 2-6 will be implemented in future steps
    // For now, mark remaining phases as pending and complete the workflow
    
    // Temporary completion for Step 1 implementation
    await step.runMutation(internal.leadGen.statusUtils.completeFlow, {
      leadGenFlowId: args.leadGenFlowId,
    });

    console.log("[Lead Gen Workflow] Step 1 implementation completed successfully");
    return null;
  },
});
