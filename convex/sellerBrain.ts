import { v } from "convex/values";
import { query, internalMutation, internalQuery, action, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { workflow } from "./workflows";
import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";

const ClaimsValidator = v.array(
  v.object({
    id: v.string(),
    text: v.string(),
    source_url: v.string(),
  }),
);

export const getForCurrentUser = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      agencyProfileId: v.id("agency_profile"),
      userId: v.string(),
      companyName: v.string(),
      sourceUrl: v.string(),
      onboardingFlowId: v.optional(v.id("onboarding_flow")),
      pagesList: v.optional(
        v.array(
          v.object({
            url: v.string(),
            title: v.optional(v.string()),
            category: v.optional(v.string()),
          }),
        ),
      ),
      summary: v.optional(v.string()),
      approvedClaims: v.optional(ClaimsValidator),
      guardrails: v.optional(v.array(v.string())),
      tone: v.optional(v.string()),
      timeZone: v.optional(v.string()),
      availability: v.optional(v.array(v.string())),
      targetVertical: v.optional(v.string()),
      targetGeography: v.optional(v.string()),
      coreOffer: v.optional(v.string()),
      leadQualificationCriteria: v.optional(v.array(v.string())),
      reviewedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    const existing = await ctx.db
      .query("agency_profile")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!existing) return null;

    return {
      agencyProfileId: existing._id,
      userId: existing.userId,
      companyName: existing.companyName,
      sourceUrl: existing.sourceUrl,
      onboardingFlowId: existing.onboardingFlowId ?? undefined,
      pagesList: existing.pagesList ?? undefined,
      summary: existing.summary ?? undefined,
      approvedClaims: existing.approvedClaims ?? undefined,
      guardrails: existing.guardrails ?? undefined,
      tone: existing.tone ?? undefined,
      timeZone: existing.timeZone ?? undefined,
      availability: existing.availability ?? undefined,
      targetVertical: existing.targetVertical ?? undefined,
      targetGeography: existing.targetGeography ?? undefined,
      coreOffer: existing.coreOffer ?? undefined,
      leadQualificationCriteria: existing.leadQualificationCriteria ?? undefined,
      reviewedAt: existing.reviewedAt ?? undefined,
    };
  },
});

/**
 * Internal query to get agency profile by userId (for use in workflows)
 */
export const getByUserId = internalQuery({
  args: { userId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("agency_profile"),
      userId: v.string(),
      companyName: v.string(),
      sourceUrl: v.string(),
      onboardingFlowId: v.optional(v.id("onboarding_flow")),
      pagesList: v.optional(
        v.array(
          v.object({
            url: v.string(),
            title: v.optional(v.string()),
            category: v.optional(v.string()),
          }),
        ),
      ),
      summary: v.optional(v.string()),
      approvedClaims: v.optional(ClaimsValidator),
      guardrails: v.optional(v.array(v.string())),
      tone: v.optional(v.string()),
      timeZone: v.optional(v.string()),
      availability: v.optional(v.array(v.string())),
      targetVertical: v.optional(v.string()),
      targetGeography: v.optional(v.string()),
      coreOffer: v.optional(v.string()),
      leadQualificationCriteria: v.optional(v.array(v.string())),
      reviewedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agency_profile")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!existing) return null;

    return {
      _id: existing._id,
      userId: existing.userId,
      companyName: existing.companyName,
      sourceUrl: existing.sourceUrl,
      onboardingFlowId: existing.onboardingFlowId ?? undefined,
      pagesList: existing.pagesList ?? undefined,
      summary: existing.summary ?? undefined,
      approvedClaims: existing.approvedClaims ?? undefined,
      guardrails: existing.guardrails ?? undefined,
      tone: existing.tone ?? undefined,
      timeZone: existing.timeZone ?? undefined,
      availability: existing.availability ?? undefined,
      targetVertical: existing.targetVertical ?? undefined,
      targetGeography: existing.targetGeography ?? undefined,
      coreOffer: existing.coreOffer ?? undefined,
      leadQualificationCriteria: existing.leadQualificationCriteria ?? undefined,
      reviewedAt: existing.reviewedAt ?? undefined,
    };
  },
});

export const saveAgencyProfile = internalMutation({
  args: {
    companyName: v.string(),
    sourceUrl: v.string(),
    userId: v.string(), // Pass userId from authenticated action
    onboardingFlowId: v.optional(v.id("onboarding_flow")),
    pagesList: v.optional(
      v.array(
        v.object({
          url: v.string(),
          title: v.optional(v.string()),
          category: v.optional(v.string()),
        }),
      ),
    ),
    summary: v.optional(v.string()),
    approvedClaims: v.optional(ClaimsValidator),
    guardrails: v.optional(v.array(v.string())),
    tone: v.optional(v.string()),
    timeZone: v.optional(v.string()),
    availability: v.optional(v.array(v.string())),
    targetVertical: v.optional(v.string()),
    targetGeography: v.optional(v.string()),
    coreOffer: v.optional(v.string()),
    leadQualificationCriteria: v.optional(v.array(v.string())),
  },
  returns: v.object({ agencyProfileId: v.id("agency_profile") }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agency_profile")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!existing) {
      const id = await ctx.db.insert("agency_profile", {
        userId: args.userId,
        companyName: args.companyName,
        sourceUrl: args.sourceUrl,
        onboardingFlowId: args.onboardingFlowId,
        pagesList: args.pagesList,
        summary: args.summary,
        approvedClaims: args.approvedClaims,
        guardrails: args.guardrails,
        tone: args.tone,
        timeZone: args.timeZone,
        availability: args.availability,
        targetVertical: args.targetVertical,
        targetGeography: args.targetGeography,
        coreOffer: args.coreOffer,
        leadQualificationCriteria: args.leadQualificationCriteria,
      });
      return { agencyProfileId: id };
    }

    const update: Record<string, unknown> = {};
    // Always allow updating these base fields
    update.companyName = args.companyName;
    update.sourceUrl = args.sourceUrl;
    if (typeof args.onboardingFlowId !== "undefined") update.onboardingFlowId = args.onboardingFlowId;
    if (typeof args.pagesList !== "undefined") update.pagesList = args.pagesList;
    if (typeof args.summary !== "undefined") update.summary = args.summary;
    if (typeof args.approvedClaims !== "undefined") update.approvedClaims = args.approvedClaims;
    if (typeof args.guardrails !== "undefined") update.guardrails = args.guardrails;
    if (typeof args.tone !== "undefined") update.tone = args.tone;
    if (typeof args.timeZone !== "undefined") update.timeZone = args.timeZone;
    if (typeof args.availability !== "undefined") update.availability = args.availability;
    if (typeof args.targetVertical !== "undefined") update.targetVertical = args.targetVertical;
    if (typeof args.targetGeography !== "undefined") update.targetGeography = args.targetGeography;
    if (typeof args.coreOffer !== "undefined") update.coreOffer = args.coreOffer;

    await ctx.db.patch(existing._id, update);
    return { agencyProfileId: existing._id };
  },
});

export const seedFromWebsite = action({
  args: {
    companyName: v.string(),
    sourceUrl: v.string(),
  },
  returns: v.object({ agencyProfileId: v.id("agency_profile") }),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized");

    // Create agency profile record (status tracking moved to onboarding_flow)
    const first: { agencyProfileId: Id<"agency_profile"> } = await ctx.runMutation(
      internal.sellerBrain.saveAgencyProfile,
      {
        companyName: args.companyName,
        sourceUrl: args.sourceUrl,
        userId: user._id, // Pass the authenticated user ID
      },
    );
    // Kick off onboarding workflow (durable) with completion handler
    const workflowId = await workflow.start(
      ctx,
      internal.onboarding.workflow.onboardingWorkflow,
      {
        agencyProfileId: first.agencyProfileId,
        companyName: args.companyName,
        sourceUrl: args.sourceUrl,
        userId: user._id, // Pass the authenticated user ID
      },
      {
        onComplete: internal.sellerBrain.handleWorkflowComplete,
        context: { agencyProfileId: first.agencyProfileId },
      },
    );
    
    // Store workflow ID for tracking (best-effort; flow may not exist yet)
    try {
      await ctx.runMutation(internal.onboarding.init.setWorkflowId, {
        agencyProfileId: first.agencyProfileId,
        workflowId: String(workflowId),
      });
    } catch (e) {
      console.warn("setWorkflowId skipped (flow not yet initialized):", e);
    }
    return { agencyProfileId: first.agencyProfileId };
  },
});

export const finalizeOnboarding = internalMutation({
  args: {
    userId: v.string(), // Pass userId from authenticated public mutation
    approvedClaims: ClaimsValidator,
    guardrails: v.array(v.string()),
    tone: v.string(),
    targetVertical: v.string(),
    targetGeography: v.string(),
    coreOffer: v.string(),
    timeZone: v.string(),
    availability: v.array(v.string()),
    leadQualificationCriteria: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agency_profile")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!existing) throw new Error("Agency profile not found");

    await ctx.db.patch(existing._id, {
      approvedClaims: args.approvedClaims,
      guardrails: args.guardrails,
      tone: args.tone,
      targetVertical: args.targetVertical,
      targetGeography: args.targetGeography,
      coreOffer: args.coreOffer,
      timeZone: args.timeZone,
      availability: args.availability,
      leadQualificationCriteria: args.leadQualificationCriteria,
    });
    return null;
  },
});

export const finalizeOnboardingPublic = mutation({
  args: {
    approvedClaims: ClaimsValidator,
    guardrails: v.array(v.string()),
    tone: v.string(),
    targetVertical: v.string(),
    targetGeography: v.string(),
    coreOffer: v.string(),
    timeZone: v.string(),
    availability: v.array(v.string()),
    leadQualificationCriteria: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized");
    
    await ctx.runMutation(internal.sellerBrain.finalizeOnboarding, {
      ...args,
      userId: user._id,
    });
    return null;
  },
});

export const updateAgencyProfile = mutation({
  args: {
    summary: v.optional(v.string()),
    coreOffer: v.optional(v.string()),
    approvedClaims: v.optional(ClaimsValidator),
    guardrails: v.optional(v.array(v.string())),
    tone: v.optional(v.string()),
    targetVertical: v.optional(v.string()),
    targetGeography: v.optional(v.string()),
    leadQualificationCriteria: v.optional(v.array(v.string())),
    timeZone: v.optional(v.string()),
    availability: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized");
    
    const existing = await ctx.db
      .query("agency_profile")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    
    if (!existing) throw new Error("Agency profile not found");
    
    const updates: Record<string, unknown> = {};
    if (typeof args.summary !== "undefined") updates.summary = args.summary;
    if (typeof args.coreOffer !== "undefined") updates.coreOffer = args.coreOffer;
    if (typeof args.approvedClaims !== "undefined") updates.approvedClaims = args.approvedClaims;
    if (typeof args.guardrails !== "undefined") updates.guardrails = args.guardrails;
    if (typeof args.tone !== "undefined") updates.tone = args.tone;
    if (typeof args.targetVertical !== "undefined") updates.targetVertical = args.targetVertical;
    if (typeof args.targetGeography !== "undefined") updates.targetGeography = args.targetGeography;
    if (typeof args.leadQualificationCriteria !== "undefined") updates.leadQualificationCriteria = args.leadQualificationCriteria;
    if (typeof args.timeZone !== "undefined") updates.timeZone = args.timeZone;
    if (typeof args.availability !== "undefined") updates.availability = args.availability;
    
    await ctx.db.patch(existing._id, updates);
    return null;
  },
});

export const startManualOnboarding = mutation({
  args: { companyName: v.string() },
  returns: v.object({ agencyProfileId: v.id("agency_profile") }),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized");
    
    // Upsert agency_profile without starting a workflow
    const existing = await ctx.db
      .query("agency_profile")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        companyName: args.companyName,
        sourceUrl: existing.sourceUrl ?? "",
        onboardingFlowId: undefined,
      });
      return { agencyProfileId: existing._id };
    }
    
    const id = await ctx.db.insert("agency_profile", {
      userId: user._id,
      companyName: args.companyName,
      sourceUrl: "",
    });
    return { agencyProfileId: id };
  },
});

export const saveReviewedContentPublic = mutation({
  args: {
    agencyProfileId: v.id("agency_profile"),
    summary: v.string(),
    coreOffer: v.string(),
    claims: ClaimsValidator,
    guardrails: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized");
    await ctx.runMutation(internal.sellerBrain.saveReviewedContentInternal, {
      ...args,
      userId: user._id,
    });
    return null;
  },
});

export const saveReviewedContentInternal = internalMutation({
  args: {
    userId: v.string(),
    agencyProfileId: v.id("agency_profile"),
    summary: v.string(),
    coreOffer: v.string(),
    claims: ClaimsValidator,
    guardrails: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.agencyProfileId);
    if (!profile || profile.userId !== args.userId) throw new Error("Not found");
    await ctx.db.patch(args.agencyProfileId, {
      summary: args.summary,
      coreOffer: args.coreOffer,
      approvedClaims: args.claims,
      guardrails: args.guardrails,
      reviewedAt: Date.now(),
    });
    return null;
  },
});

export const handleWorkflowComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({ agencyProfileId: v.id("agency_profile") }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { workflowId, result, context } = args;
    
    // Find the onboarding flow by agencyProfileId since workflowId index was removed
    // (optional workflowId causes index issues in Convex)
    const flow = await ctx.db
      .query("onboarding_flow")
      .withIndex("by_agencyProfileId", (q) => q.eq("agencyProfileId", context.agencyProfileId))
      .order("desc")
      .first();
    
    // Verify this is the correct flow by checking workflowId if available
    if (flow && flow.workflowId && flow.workflowId !== String(workflowId)) {
      console.warn(`WorkflowId mismatch: expected ${workflowId}, got ${flow.workflowId}`);
    }
    
    // Update workflowId if missing
    if (flow && !flow.workflowId) {
      await ctx.db.patch(flow._id, { workflowId: String(workflowId) });
      console.log(`Set workflowId ${workflowId} for flow ${flow._id}`);
    }
    
    if (!flow) {
      console.error(`No onboarding flow found for workflow ${workflowId} or agencyProfileId ${context.agencyProfileId}`);
      return null;
    }
    
    // Update flow status based on result type
    const updates: Record<string, unknown> = {};
    
    if (result.kind === "success") {
      updates.status = "completed";
      updates.workflowStatus = "completed";
      updates.lastEvent = {
        type: "workflow.completed",
        message: "Onboarding workflow completed successfully",
        timestamp: Date.now(),
      };
    } else if (result.kind === "failed") {
      updates.status = "error";
      updates.workflowStatus = "failed";
      updates.lastEvent = {
        type: "workflow.failed",
        message: `Workflow failed: ${result.error}`,
        timestamp: Date.now(),
      };
    } else if (result.kind === "canceled") {
      updates.status = "error";
      updates.workflowStatus = "cancelled";
      updates.lastEvent = {
        type: "workflow.cancelled",
        message: "Workflow was cancelled",
        timestamp: Date.now(),
      };
    }
    
    await ctx.db.patch(flow._id, updates);
    
    // Log completion for monitoring
    console.log(`Workflow ${workflowId} completed with status: ${result.kind}`, {
      agencyProfileId: context.agencyProfileId,
      flowId: flow._id,
      error: result.kind === "failed" ? result.error : null,
    });
    
    return null;
  },
});


