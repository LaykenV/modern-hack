import { action, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import { Id } from "./_generated/dataModel";
import { workflow } from "./workflows";
import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";

// Type for agency profile returned by getByUserId
type AgencyProfile = {
  _id: Id<"agency_profile">;
  userId: string;
  companyName: string;
  sourceUrl: string;
  onboardingFlowId?: Id<"onboarding_flow">;
  pagesList?: Array<{
    url: string;
    title?: string;
    category?: string;
  }>;
  summary?: string;
  approvedClaims?: Array<{
    id: string;
    text: string;
    source_url: string;
  }>;
  guardrails?: Array<string>;
  tone?: string;
  timeZone?: string;
  availability?: Array<string>;
  targetVertical?: string;
  targetGeography?: string;
  coreOffer?: string;
  leadQualificationCriteria?: Array<string>;
  reviewedAt?: number;
} | null;

// Public API for lead generation workflow

/**
 * Start a lead generation workflow
 * Creates a lead_gen_flow document and starts the workflow
 */
export const startLeadGenWorkflow = action({
  args: {
    numLeads: v.number(), // 1-20
    targetVertical: v.optional(v.string()),
    targetGeography: v.optional(v.string()),
  },
  returns: v.object({
    jobId: v.id("lead_gen_flow"),
  }),
  handler: async (ctx, args) => {
    // Get authenticated user
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Authentication required");
    }

    // Clamp numLeads to [1, 20]
    const numLeads = Math.max(1, Math.min(args.numLeads, 20));

    // Get agency profile to resolve campaign if needed
    const agencyProfile: AgencyProfile = await ctx.runQuery(internal.sellerBrain.getByUserId, {
      userId: user._id,
    });
    if (!agencyProfile) {
      throw new Error("Agency profile not found. Complete onboarding first.");
    }

    // Resolve campaign from args or agency_profile
    const targetVertical = args.targetVertical || agencyProfile.targetVertical;
    const targetGeography = args.targetGeography || agencyProfile.targetGeography;

    if (!targetVertical || !targetGeography) {
      throw new Error(
        "Campaign details missing. Please provide targetVertical and targetGeography or complete your agency profile."
      );
    }

    // Create lead_gen_flow with initialized phases
    const leadGenFlowId: Id<"lead_gen_flow"> = await ctx.runMutation(internal.leadGen.init.initLeadGenFlow, {
      userId: user._id,
      agencyId: agencyProfile._id,
      numLeads,
      campaign: {
        targetVertical,
        targetGeography,
      },
    });

    // Start the workflow via WorkflowManager (durable, with onComplete)
    const workflowId = await workflow.start(
      ctx,
      internal.leadGen.workflow.leadGenWorkflow,
      {
        leadGenFlowId,
        agencyProfileId: agencyProfile._id,
        userId: user._id,
        numLeads,
        campaign: {
          targetVertical,
          targetGeography,
        },
      },
      {
        onComplete: internal.marketing.handleLeadGenWorkflowComplete,
        context: { leadGenFlowId },
      },
    );

    // Update flow with workflow ID
    await ctx.runMutation(internal.leadGen.init.setWorkflowId, {
      leadGenFlowId,
      workflowId: String(workflowId),
    });

    return {
      jobId: leadGenFlowId,
    };
  },
});

/**
 * Handle lead gen workflow completion to update flow status
 */
export const handleLeadGenWorkflowComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({ leadGenFlowId: v.id("lead_gen_flow") }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { workflowId, result, context } = args;

    const flow = await ctx.db.get(context.leadGenFlowId);
    if (!flow) {
      console.error(
        `No lead_gen_flow found for workflow ${workflowId} or leadGenFlowId ${context.leadGenFlowId}`,
      );
      return null;
    }

    const updates: Record<string, unknown> = {};

    if (result.kind === "success") {
      updates.status = "completed";
      updates.workflowStatus = "completed";
      updates.lastEvent = {
        type: "leadgen.workflow.completed",
        message: "Lead generation workflow completed successfully",
        timestamp: Date.now(),
      };
    } else if (result.kind === "failed") {
      updates.status = "error";
      updates.workflowStatus = "failed";
      updates.lastEvent = {
        type: "leadgen.workflow.failed",
        message: `Workflow failed: ${result.error}`,
        timestamp: Date.now(),
      };
    } else if (result.kind === "canceled") {
      updates.status = "error";
      updates.workflowStatus = "cancelled";
      updates.lastEvent = {
        type: "leadgen.workflow.cancelled",
        message: "Workflow was cancelled",
        timestamp: Date.now(),
      };
    }

    await ctx.db.patch(flow._id, updates);
    return null;
  },
});

/**
 * Get lead generation job status for UI
 */
export const getLeadGenJob = query({
  args: {
    jobId: v.id("lead_gen_flow"),
  },
  returns: v.union(
    v.object({
      _id: v.id("lead_gen_flow"),
      userId: v.string(),
      agencyId: v.id("agency_profile"),
      numLeadsRequested: v.number(),
      numLeadsFetched: v.number(),
      campaign: v.object({
        targetVertical: v.string(),
        targetGeography: v.string(),
      }),
      status: v.union(
        v.literal("idle"),
        v.literal("running"),
        v.literal("error"),
        v.literal("completed"),
      ),
      workflowStatus: v.optional(v.union(
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("cancelled")
      )),
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
        errorMessage: v.optional(v.string()),
        startedAt: v.optional(v.number()),
        completedAt: v.optional(v.number()),
        duration: v.optional(v.number()),
      })),
      lastEvent: v.optional(v.object({
        type: v.string(),
        message: v.string(),
        timestamp: v.number(),
      })),
      placesSnapshot: v.optional(v.array(v.object({
        id: v.string(),
        name: v.string(),
        website: v.optional(v.string()),
        phone: v.optional(v.string()),
        rating: v.optional(v.number()),
        reviews: v.optional(v.number()),
        address: v.optional(v.string()),
      }))),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Get authenticated user
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Authentication required");
    }

    const leadGenFlow = await ctx.db.get(args.jobId);
    if (!leadGenFlow) {
      return null;
    }

    // Check ownership
    if (leadGenFlow.userId !== user._id) {
      throw new Error("Unauthorized access to lead generation job");
    }

    return {
      _id: leadGenFlow._id,
      userId: leadGenFlow.userId,
      agencyId: leadGenFlow.agencyId,
      numLeadsRequested: leadGenFlow.numLeadsRequested,
      numLeadsFetched: leadGenFlow.numLeadsFetched,
      campaign: leadGenFlow.campaign,
      status: leadGenFlow.status,
      workflowStatus: leadGenFlow.workflowStatus,
      phases: leadGenFlow.phases,
      lastEvent: leadGenFlow.lastEvent,
      placesSnapshot: leadGenFlow.placesSnapshot,
    };
  },
});

/**
 * List lead generation jobs by agency for dashboard
 */
export const listLeadGenJobsByAgency = query({
  args: {
    agencyId: v.id("agency_profile"),
  },
  returns: v.array(v.object({
    _id: v.id("lead_gen_flow"),
    _creationTime: v.number(),
    numLeadsRequested: v.number(),
    numLeadsFetched: v.number(),
    campaign: v.object({
      targetVertical: v.string(),
      targetGeography: v.string(),
    }),
    status: v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("error"),
      v.literal("completed"),
    ),
    lastEvent: v.optional(v.object({
      type: v.string(),
      message: v.string(),
      timestamp: v.number(),
    })),
  })),
  handler: async (ctx, args) => {
    // Get authenticated user
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Authentication required");
    }

    // Verify agency ownership
    const agencyProfile = await ctx.db.get(args.agencyId);
    if (!agencyProfile || agencyProfile.userId !== user._id) {
      throw new Error("Unauthorized access to agency");
    }

    const leadGenFlows = await ctx.db
      .query("lead_gen_flow")
      .withIndex("by_agencyId", (q) => q.eq("agencyId", args.agencyId))
      .order("desc")
      .collect();

    return leadGenFlows.map((flow) => ({
      _id: flow._id,
      _creationTime: flow._creationTime,
      numLeadsRequested: flow.numLeadsRequested,
      numLeadsFetched: flow.numLeadsFetched,
      campaign: flow.campaign,
      status: flow.status,
      lastEvent: flow.lastEvent,
    }));
  },
});

/**
 * Get overall progress for a lead generation job (0-1)
 */
export const getLeadGenProgress = query({
  args: {
    jobId: v.id("lead_gen_flow"),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const leadGenFlow = await ctx.db.get(args.jobId);
    if (!leadGenFlow) {
      return 0;
    }

    // Calculate progress based on phase completion
    const totalPhases = leadGenFlow.phases.length;
    if (totalPhases === 0) return 0;

    let totalProgress = 0;
    for (const phase of leadGenFlow.phases) {
      if (phase.status === "complete") {
        totalProgress += 1;
      } else if (phase.status === "running") {
        totalProgress += phase.progress;
      }
    }

    return totalProgress / totalPhases;
  },
});
