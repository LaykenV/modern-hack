import { internalMutation, internalAction, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { workflow } from "../workflows";
import { BillingError } from "./billing";

/**
 * Update phase status with progress tracking
 * Mirrors the onboarding flow pattern for consistency
 */
export const updatePhaseStatus = internalMutation({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
    phaseName: v.union(
      v.literal("source"),
      v.literal("filter_rank"),
      v.literal("persist_leads"),
      v.literal("scrape_content"),
      v.literal("generate_dossier"),
      v.literal("finalize_rank"),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("complete"),
      v.literal("error"),
    ),
    progress: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    eventMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const flow = await ctx.db.get(args.leadGenFlowId);
    if (!flow) {
      throw new Error("Lead generation flow not found");
    }

    const now = Date.now();
    const updatedPhases = flow.phases.map((phase) => {
      if (phase.name === args.phaseName) {
        const updatedPhase = {
          ...phase,
          status: args.status,
          progress: args.progress ?? phase.progress,
          errorMessage: args.errorMessage,
        };

        // Set startedAt when transitioning to running
        if (args.status === "running" && !phase.startedAt) {
          updatedPhase.startedAt = now;
        }

        // Set completedAt and duration when transitioning to complete
        if (args.status === "complete" && !phase.completedAt) {
          updatedPhase.completedAt = now;
          if (phase.startedAt) {
            updatedPhase.duration = now - phase.startedAt;
          }
        }

        return updatedPhase;
      }
      return phase;
    });

    // Update last event if provided
    const lastEvent = args.eventMessage
      ? {
          type: `leadgen.${args.phaseName}.${args.status}`,
          message: args.eventMessage,
          timestamp: now,
        }
      : flow.lastEvent;

    await ctx.db.patch(args.leadGenFlowId, {
      phases: updatedPhases,
      lastEvent,
    });

    return null;
  },
});

/**
 * Record flow error and update status
 */
export const recordFlowError = internalMutation({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
    phase: v.union(
      v.literal("source"),
      v.literal("filter_rank"),
      v.literal("persist_leads"),
      v.literal("scrape_content"),
      v.literal("generate_dossier"),
      v.literal("finalize_rank"),
    ),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const flow = await ctx.db.get(args.leadGenFlowId);
    if (!flow) {
      throw new Error("Lead generation flow not found");
    }

    const now = Date.now();
    const updatedPhases = flow.phases.map((phase) => {
      if (phase.name === args.phase) {
        return {
          ...phase,
          status: "error" as const,
          errorMessage: args.error,
          completedAt: now,
          duration: phase.startedAt ? now - phase.startedAt : undefined,
        };
      }
      return phase;
    });

    await ctx.db.patch(args.leadGenFlowId, {
      status: "error",
      phases: updatedPhases,
      lastEvent: {
        type: `leadgen.${args.phase}.error`,
        message: `Error in ${args.phase}: ${args.error}`,
        timestamp: now,
      },
    });

    return null;
  },
});

/**
 * Complete the entire flow
 */
export const completeFlow = internalMutation({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const flow = await ctx.db.get(args.leadGenFlowId);
    if (!flow) {
      throw new Error("Lead generation flow not found");
    }

    const now = Date.now();
    const updatedPhases = flow.phases.map((phase) => ({
      ...phase,
      status: phase.status === "error" ? phase.status : ("complete" as const),
      progress: phase.status === "error" ? phase.progress : 1,
      completedAt: phase.completedAt || now,
      duration: phase.duration || (phase.startedAt ? now - phase.startedAt : 0),
    }));

    await ctx.db.patch(args.leadGenFlowId, {
      status: "completed",
      workflowStatus: "completed",
      phases: updatedPhases,
      lastEvent: {
        type: "leadgen.completed",
        message: "Lead generation completed successfully",
        timestamp: now,
      },
    });

    return null;
  },
});

/**
 * Pause workflow for billing and store paywall data
 */
export const pauseForBilling = internalMutation({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
    phase: v.union(v.literal("source"), v.literal("generate_dossier")),
    featureId: v.union(v.literal("lead_discovery"), v.literal("dossier_research")),
    preview: v.any(),
    auditJobId: v.optional(v.id("audit_jobs")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const flow = await ctx.db.get(args.leadGenFlowId);
    if (!flow) {
      throw new Error("Lead generation flow not found");
    }

    const now = Date.now();
    const billingBlock = {
      phase: args.phase,
      featureId: args.featureId,
      preview: args.preview,
      auditJobId: args.auditJobId,
      createdAt: now,
    };

    await ctx.db.patch(args.leadGenFlowId, {
      status: "paused_for_upgrade",
      billingBlock,
      lastEvent: {
        type: `leadgen.${args.phase}.paused_for_billing`,
        message: `Workflow paused: insufficient credits for ${args.featureId}`,
        timestamp: now,
      },
    });

    console.log(`[StatusUtils] Paused workflow ${args.leadGenFlowId} for billing in phase ${args.phase}`);
    return null;
  },
});

/**
 * Resume lead generation workflow after successful upgrade
 * This needs to be an action because it calls other actions
 */
export const resumeLeadGenWorkflow = internalAction({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Get flow data using a query
    const flow = await ctx.runQuery(internal.leadGen.statusUtils.getFlowForRelaunch, {
      leadGenFlowId: args.leadGenFlowId,
    });
    
    if (!flow) {
      throw new Error("Lead generation flow not found");
    }

    if (flow.status !== "paused_for_upgrade") {
      return {
        success: false,
        message: "Workflow is not paused for billing",
      };
    }

    // Get the full flow with billing block using another query
    const fullFlow = await ctx.runQuery(internal.leadGen.statusUtils.getFullFlowForResume, {
      leadGenFlowId: args.leadGenFlowId,
    });

    if (!fullFlow || !fullFlow.billingBlock) {
      return {
        success: false,
        message: "Missing billing block information",
      };
    }

    const billingBlock = fullFlow.billingBlock;
    
    // Re-check billing before clearing the pause so we don't relaunch without credits
    const requiredValue = billingBlock.featureId === "lead_discovery" ? 1 : 2;
    try {
      await ctx.runAction(internal.leadGen.billing.checkAndPause, {
        leadGenFlowId: args.leadGenFlowId,
        featureId: billingBlock.featureId,
        requiredValue,
        phase: billingBlock.phase,
        auditJobId: billingBlock.auditJobId,
      });
    } catch (error) {
      if (error instanceof BillingError) {
        return {
          success: false,
          message: "Workflow still paused: insufficient credits to resume",
        };
      }
      throw error;
    }

    // Reset the paused phase and clear billing block via mutation
    await ctx.runMutation(internal.leadGen.statusUtils.resetPhasesAndClearBilling, {
      leadGenFlowId: args.leadGenFlowId,
      pausedPhase: billingBlock.phase,
      billingBlock,
    });

    // Relaunch the durable workflow via workflow.start using stored args
    try {
      await ctx.runAction(internal.leadGen.statusUtils.relaunchWorkflow, {
        leadGenFlowId: args.leadGenFlowId,
      });
      
      console.log(`[StatusUtils] Successfully resumed and relaunched workflow ${args.leadGenFlowId} after upgrade`);
      
      return {
        success: true,
        message: "Workflow resumed and relaunched successfully",
      };
    } catch (error) {
      console.error(`[StatusUtils] Failed to relaunch workflow ${args.leadGenFlowId}:`, error);
      
      // Revert the status back to paused if relaunch fails
      await ctx.runMutation(internal.leadGen.statusUtils.revertToPausedStatus, {
        leadGenFlowId: args.leadGenFlowId,
        billingBlock,
        error: String(error),
      });
      
      return {
        success: false,
        message: `Failed to relaunch workflow: ${String(error)}`,
      };
    }
  },
});

/**
 * Initialize phases for a new lead generation flow
 */
export const initializePhases = () => {
  
  return [
    {
      name: "source" as const,
      status: "pending" as const,
      progress: 0,
      startedAt: undefined,
      completedAt: undefined,
      duration: undefined,
      errorMessage: undefined,
    },
    {
      name: "filter_rank" as const,
      status: "pending" as const,
      progress: 0,
      startedAt: undefined,
      completedAt: undefined,
      duration: undefined,
      errorMessage: undefined,
    },
    {
      name: "persist_leads" as const,
      status: "pending" as const,
      progress: 0,
      startedAt: undefined,
      completedAt: undefined,
      duration: undefined,
      errorMessage: undefined,
    },
    {
      name: "scrape_content" as const,
      status: "pending" as const,
      progress: 0,
      startedAt: undefined,
      completedAt: undefined,
      duration: undefined,
      errorMessage: undefined,
    },
    {
      name: "generate_dossier" as const,
      status: "pending" as const,
      progress: 0,
      startedAt: undefined,
      completedAt: undefined,
      duration: undefined,
      errorMessage: undefined,
    },
    {
      name: "finalize_rank" as const,
      status: "pending" as const,
      progress: 0,
      startedAt: undefined,
      completedAt: undefined,
      duration: undefined,
      errorMessage: undefined,
    },
  ];
};

/**
 * Relaunch workflow action - called from resumeLeadGenWorkflow
 * This needs to be an action because it calls workflow.start()
 */
export const relaunchWorkflow = internalAction({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get the flow document to extract workflow arguments
    const flow = await ctx.runQuery(internal.leadGen.statusUtils.getFlowForRelaunch, {
      leadGenFlowId: args.leadGenFlowId,
    });

    if (!flow) {
      throw new Error("Lead generation flow not found");
    }

    // Guard against concurrent resumes by checking status
    if (flow.status !== "running") {
      throw new Error(`Cannot relaunch workflow: flow status is ${flow.status}, expected "running"`);
    }

    // Start a new workflow instance with the same arguments
    const workflowId = await workflow.start(
      ctx,
      internal.leadGen.workflow.leadGenWorkflow,
      {
        leadGenFlowId: flow._id,
        agencyProfileId: flow.agencyId,
        userId: flow.userId,
        numLeads: flow.numLeadsRequested,
        campaign: flow.campaign,
      },
      {
        onComplete: internal.marketing.handleLeadGenWorkflowComplete,
        context: { leadGenFlowId: flow._id },
      },
    );

    // Update the workflowId in the flow document
    await ctx.runMutation(internal.leadGen.statusUtils.updateWorkflowId, {
      leadGenFlowId: args.leadGenFlowId,
      workflowId: String(workflowId),
    });

    console.log(`[StatusUtils] Relaunched workflow ${args.leadGenFlowId} with new workflowId: ${workflowId}`);
    return null;
  },
});

/**
 * Helper query to get full flow data including billing block for resume
 */
export const getFullFlowForResume = internalQuery({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
  },
  returns: v.union(
    v.object({
      _id: v.id("lead_gen_flow"),
      phases: v.array(v.object({
        name: v.union(
          v.literal("source"),
          v.literal("filter_rank"),
          v.literal("persist_leads"),
          v.literal("scrape_content"),
          v.literal("generate_dossier"),
          v.literal("finalize_rank"),
        ),
        status: v.union(
          v.literal("pending"),
          v.literal("running"),
          v.literal("complete"),
          v.literal("error"),
        ),
        progress: v.number(),
        startedAt: v.optional(v.number()),
        completedAt: v.optional(v.number()),
        duration: v.optional(v.number()),
        errorMessage: v.optional(v.string()),
      })),
      billingBlock: v.optional(v.object({
        phase: v.union(v.literal("source"), v.literal("generate_dossier")),
        featureId: v.union(v.literal("lead_discovery"), v.literal("dossier_research")),
        preview: v.any(),
        auditJobId: v.optional(v.id("audit_jobs")),
        createdAt: v.number(),
      })),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const flow = await ctx.db.get(args.leadGenFlowId);
    if (!flow) {
      return null;
    }

    return {
      _id: flow._id,
      phases: flow.phases,
      billingBlock: flow.billingBlock,
    };
  },
});

/**
 * Helper mutation to reset phases and clear billing block
 */
export const resetPhasesAndClearBilling = internalMutation({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
    pausedPhase: v.union(v.literal("source"), v.literal("generate_dossier")),
    billingBlock: v.object({
      phase: v.union(v.literal("source"), v.literal("generate_dossier")),
      featureId: v.union(v.literal("lead_discovery"), v.literal("dossier_research")),
      preview: v.any(),
      auditJobId: v.optional(v.id("audit_jobs")),
      createdAt: v.number(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const flow = await ctx.db.get(args.leadGenFlowId);
    if (!flow) {
      throw new Error("Lead generation flow not found");
    }

    const now = Date.now();
    
    // Reset the paused phase (and any dependent phases) to pending with zero progress
    const updatedPhases = flow.phases.map((phase) => {
      if (phase.name === args.pausedPhase) {
        return {
          ...phase,
          status: "pending" as const,
          progress: 0,
          startedAt: undefined,
          completedAt: undefined,
          duration: undefined,
          errorMessage: undefined,
        };
      }
      // Reset any phases that come after the paused phase
      const phaseOrder = ["source", "filter_rank", "persist_leads", "scrape_content", "generate_dossier", "finalize_rank"];
      const pausedPhaseIndex = phaseOrder.indexOf(args.pausedPhase);
      const currentPhaseIndex = phaseOrder.indexOf(phase.name);
      
      if (currentPhaseIndex > pausedPhaseIndex) {
        return {
          ...phase,
          status: "pending" as const,
          progress: 0,
          startedAt: undefined,
          completedAt: undefined,
          duration: undefined,
          errorMessage: undefined,
        };
      }
      
      return phase;
    });

    // Clear the billing block, set status back to running, and update phases
    await ctx.db.patch(args.leadGenFlowId, {
      status: "running",
      billingBlock: undefined,
      phases: updatedPhases,
      lastEvent: {
        type: "leadgen.resumed_after_upgrade",
        message: "Workflow resumed after successful upgrade",
        timestamp: now,
      },
    });

    return null;
  },
});

/**
 * Helper mutation to revert status back to paused if relaunch fails
 */
export const revertToPausedStatus = internalMutation({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
    billingBlock: v.object({
      phase: v.union(v.literal("source"), v.literal("generate_dossier")),
      featureId: v.union(v.literal("lead_discovery"), v.literal("dossier_research")),
      preview: v.any(),
      auditJobId: v.optional(v.id("audit_jobs")),
      createdAt: v.number(),
    }),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadGenFlowId, {
      status: "paused_for_upgrade",
      billingBlock: args.billingBlock,
      lastEvent: {
        type: "leadgen.relaunch_failed",
        message: `Failed to relaunch workflow: ${args.error}`,
        timestamp: Date.now(),
      },
    });
    return null;
  },
});

/**
 * Helper query to get flow data for relaunching
 */
export const getFlowForRelaunch = internalQuery({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
  },
  returns: v.union(
    v.object({
      _id: v.id("lead_gen_flow"),
      userId: v.string(),
      agencyId: v.id("agency_profile"),
      numLeadsRequested: v.number(),
      campaign: v.object({
        targetVertical: v.string(),
        targetGeography: v.string(),
      }),
      status: v.union(
        v.literal("idle"),
        v.literal("running"),
        v.literal("paused_for_upgrade"),
        v.literal("error"),
        v.literal("completed"),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const flow = await ctx.db.get(args.leadGenFlowId);
    if (!flow) {
      return null;
    }

    return {
      _id: flow._id,
      userId: flow.userId,
      agencyId: flow.agencyId,
      numLeadsRequested: flow.numLeadsRequested,
      campaign: flow.campaign,
      status: flow.status,
    };
  },
});

/**
 * Helper mutation to update workflow ID
 */
export const updateWorkflowId = internalMutation({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
    workflowId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadGenFlowId, {
      workflowId: args.workflowId,
      workflowStatus: "running",
    });
    return null;
  },
});
