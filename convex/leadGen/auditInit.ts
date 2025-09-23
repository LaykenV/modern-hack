/**
 * Audit initialization module
 * Queues audit jobs for client opportunities with websites
 */

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Queue audit jobs for opportunities with websites
 * This starts the per-opportunity audit workflow for deep analysis
 */
export const queueAuditsForWebsites = internalAction({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
    agencyProfileId: v.id("agency_profile"),
  },
  returns: v.object({
    queuedCount: v.number(),
    skippedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const { leadGenFlowId, agencyProfileId } = args;

    // Get all opportunities for this lead gen flow that have websites
    const opportunities = await ctx.runQuery(internal.leadGen.queries.getOpportunitiesWithWebsites, {
      leadGenFlowId,
    });

    console.log(`[Audit Init] Found ${opportunities.length} opportunities with websites to audit`);

    let queuedCount = 0;
    let skippedCount = 0;

    for (const opportunity of opportunities) {
      try {
        // Check if audit job already exists for this opportunity
        const existingAuditJob = await ctx.runQuery(internal.leadGen.queries.getAuditJobByOpportunity, {
          opportunityId: opportunity._id,
        });

        if (existingAuditJob) {
          console.log(`[Audit Init] Skipping ${opportunity.name} - audit job already exists`);
          skippedCount++;
          continue;
        }

        // Create audit job
        const auditJobId = await ctx.runMutation(internal.leadGen.audit.insertAuditJob, {
          opportunityId: opportunity._id,
          agencyId: agencyProfileId,
          leadGenFlowId,
          targetUrl: opportunity.domain ? `https://${opportunity.domain}` : "",
        });

        // Update opportunity status to AUDITING
        await ctx.runMutation(internal.leadGen.audit.updateOpportunityStatus, {
          opportunityId: opportunity._id,
          status: "AUDITING",
        });

        // Audit jobs are created and will be processed by individual audit workflows
        // The main workflow will start these via scheduler
        console.log(`[Audit Init] Queued audit job ${auditJobId} for ${opportunity.name}`);
        queuedCount++;

      } catch (error) {
        console.error(`[Audit Init] Error queuing audit for ${opportunity.name}:`, error);
        skippedCount++;
      }
    }

    console.log(`[Audit Init] Results: queued ${queuedCount}, skipped ${skippedCount}`);

    return {
      queuedCount,
      skippedCount,
    };
  },
});

