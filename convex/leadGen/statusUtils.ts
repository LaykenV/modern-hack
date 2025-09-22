import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

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
