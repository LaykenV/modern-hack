import { v } from "convex/values";
import { workflow } from "../workflows";
import { internal } from "../_generated/api";
import { RETRY_CONFIG } from "./constants";

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

    // Phase 2: Filter and rank leads
    console.log("[Lead Gen Workflow] Starting Phase 2: Filter and Rank");
    const filteredLeads = await step.runAction(
      internal.leadGen.filter.filterAndScoreLeads,
      {
        leadGenFlowId: args.leadGenFlowId,
        agencyProfileId: args.agencyProfileId,
      },
      {
        retry: RETRY_CONFIG.AI_OPERATIONS,
      }
    );

    console.log(`[Lead Gen Workflow] Phase 2 completed: ${filteredLeads.length} leads passed filter`);

    // Phase 3: Persist leads as client opportunities
    console.log("[Lead Gen Workflow] Starting Phase 3: Persist Leads");
    
    await step.runMutation(internal.leadGen.statusUtils.updatePhaseStatus, {
      leadGenFlowId: args.leadGenFlowId,
      phaseName: "persist_leads",
      status: "running",
      progress: 0.1,
      eventMessage: `Persisting ${filteredLeads.length} filtered leads`,
    });

    const persistResult = await step.runMutation(internal.leadGen.persist.persistClientOpportunities, {
      leadGenFlowId: args.leadGenFlowId,
      agencyProfileId: args.agencyProfileId,
      campaign: args.campaign,
      leads: filteredLeads,
    });

    await step.runMutation(internal.leadGen.statusUtils.updatePhaseStatus, {
      leadGenFlowId: args.leadGenFlowId,
      phaseName: "persist_leads",
      status: "complete",
      progress: 1.0,
      eventMessage: `Persisted ${persistResult.created} opportunities (${persistResult.skipped} skipped)`,
    });

    console.log(`[Lead Gen Workflow] Phase 3 completed: created ${persistResult.created}, skipped ${persistResult.skipped}`);

    // Phase 4: Queue audits for opportunities with websites (scrape_content phase)
    console.log("[Lead Gen Workflow] Starting Phase 4: Queue Audits");
    
    await step.runMutation(internal.leadGen.statusUtils.updatePhaseStatus, {
      leadGenFlowId: args.leadGenFlowId,
      phaseName: "scrape_content",
      status: "running",
      progress: 0.1,
      eventMessage: "Queueing audit jobs for opportunities with websites",
    });

    const auditResult = await step.runAction(
      internal.leadGen.auditInit.queueAuditsForWebsites,
      {
        leadGenFlowId: args.leadGenFlowId,
        agencyProfileId: args.agencyProfileId,
      },
      {
        retry: RETRY_CONFIG.AI_OPERATIONS,
      }
    );

    await step.runMutation(internal.leadGen.statusUtils.updatePhaseStatus, {
      leadGenFlowId: args.leadGenFlowId,
      phaseName: "scrape_content",
      status: "complete",
      progress: 1.0,
      eventMessage: `Queued ${auditResult.queuedCount} audit jobs (${auditResult.skippedCount} skipped)`,
    });

    console.log(`[Lead Gen Workflow] Phase 4 completed: queued ${auditResult.queuedCount} audits, skipped ${auditResult.skippedCount}`);

    // Phase 5: Generate dossiers (per-opportunity audit workflows)
    console.log("[Lead Gen Workflow] Starting Phase 5: Generate Dossiers");
    
    await step.runMutation(internal.leadGen.statusUtils.updatePhaseStatus, {
      leadGenFlowId: args.leadGenFlowId,
      phaseName: "generate_dossier",
      status: "running",
      progress: 0.1,
      eventMessage: "Starting audit workflows for opportunities with websites",
    });

    // Get all queued audit jobs for this lead gen flow
    const auditJobs = await step.runQuery(internal.leadGen.queries.getAuditJobsByFlow, {
      leadGenFlowId: args.leadGenFlowId,
    });

    console.log(`[Lead Gen Workflow] Found ${auditJobs.length} audit jobs to process`);

    // Process audit jobs sequentially (each runAuditAction already batches URL scraping internally)
    try {
      for (let i = 0; i < auditJobs.length; i++) {
        const auditJob = auditJobs[i];
        
        console.log(`[Lead Gen Workflow] Processing audit ${i + 1}/${auditJobs.length} for opportunity ${auditJob.opportunityId}`);
        
        const progressFraction = auditJobs.length > 0
          ? Math.min(0.99, 0.1 + 0.9 * ((i + 1) / auditJobs.length))
          : 1;

        await step.runMutation(internal.leadGen.statusUtils.updatePhaseStatus, {
          leadGenFlowId: args.leadGenFlowId,
          phaseName: "generate_dossier",
          status: "running",
          progress: progressFraction,
          eventMessage: `Processing audit ${i + 1}/${auditJobs.length}`,
        });

        // Run audit action sequentially
        await step.runAction(
          internal.leadGen.audit.runAuditAction,
          {
            auditJobId: auditJob._id,
            opportunityId: auditJob.opportunityId,
            agencyId: auditJob.agencyId,
            targetUrl: auditJob.targetUrl,
            leadGenFlowId: auditJob.leadGenFlowId || args.leadGenFlowId,
          },
          { retry: RETRY_CONFIG.AI_OPERATIONS }
        );

        console.log(`[Lead Gen Workflow] Completed audit ${i + 1}/${auditJobs.length}`);
      }
      
      await step.runMutation(internal.leadGen.statusUtils.updatePhaseStatus, {
        leadGenFlowId: args.leadGenFlowId,
        phaseName: "generate_dossier",
        status: "complete",
        progress: 1.0,
        eventMessage: `Completed ${auditJobs.length} audit workflows`,
      });

      console.log(`[Lead Gen Workflow] Phase 5 completed: ${auditJobs.length} audits processed`);
      
    } catch (error) {
      console.error("[Lead Gen Workflow] Some audit workflows failed:", error);
      
      await step.runMutation(internal.leadGen.statusUtils.updatePhaseStatus, {
        leadGenFlowId: args.leadGenFlowId,
        phaseName: "generate_dossier",
        status: "complete", // Continue workflow even if some audits fail
        progress: 1.0,
        eventMessage: "Audit workflows completed with some failures",
      });
    }

    // Phase 6: Finalize workflow
    console.log("[Lead Gen Workflow] Starting Phase 6: Finalize");
    
    await step.runAction(
      internal.leadGen.finalize.finalizeLeadGenWorkflow,
      {
        leadGenFlowId: args.leadGenFlowId,
      },
      {
        retry: RETRY_CONFIG.AI_OPERATIONS,
      }
    );

    console.log("[Lead Gen Workflow] All phases completed successfully");
    return null;
  },
});
