import { v } from "convex/values";
import { query, internalMutation, action, mutation } from "./_generated/server";
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
      icpIndustry: v.optional(v.array(v.string())),
      icpCompanySize: v.optional(v.array(v.string())),
      icpBuyerRole: v.optional(v.array(v.string())),
      // Legacy status fields removed - check onboarding_flow.status instead
    }),
  ),
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    const existing = await ctx.db
      .query("seller_brain")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!existing) return null;

    return {
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
      icpIndustry: existing.icpIndustry ?? undefined,
      icpCompanySize: existing.icpCompanySize ?? undefined,
      icpBuyerRole: existing.icpBuyerRole ?? undefined,
    };
  },
});

export const saveSellerBrain = internalMutation({
  args: {
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
    icpIndustry: v.optional(v.array(v.string())),
    icpCompanySize: v.optional(v.array(v.string())),
    icpBuyerRole: v.optional(v.array(v.string())),
  },
  returns: v.object({ sellerBrainId: v.id("seller_brain") }),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("seller_brain")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!existing) {
      const id = await ctx.db.insert("seller_brain", {
        userId: user._id,
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
        icpIndustry: args.icpIndustry,
        icpCompanySize: args.icpCompanySize,
        icpBuyerRole: args.icpBuyerRole,
      });
      return { sellerBrainId: id };
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
    if (typeof args.icpIndustry !== "undefined") update.icpIndustry = args.icpIndustry;
    if (typeof args.icpCompanySize !== "undefined") update.icpCompanySize = args.icpCompanySize;
    if (typeof args.icpBuyerRole !== "undefined") update.icpBuyerRole = args.icpBuyerRole;

    await ctx.db.patch(existing._id, update);
    return { sellerBrainId: existing._id };
  },
});

export const seedFromWebsite = action({
  args: {
    companyName: v.string(),
    sourceUrl: v.string(),
  },
  returns: v.object({ sellerBrainId: v.id("seller_brain") }),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized");

    // Create seller brain record (status tracking moved to onboarding_flow)
    const first: { sellerBrainId: Id<"seller_brain"> } = await ctx.runMutation(
      internal.sellerBrain.saveSellerBrain,
      {
        companyName: args.companyName,
        sourceUrl: args.sourceUrl,
      },
    );
    // Kick off onboarding workflow (durable) with completion handler
    const workflowId = await workflow.start(
      ctx,
      internal.onboarding.workflow.onboardingWorkflow,
      {
        sellerBrainId: first.sellerBrainId,
        companyName: args.companyName,
        sourceUrl: args.sourceUrl,
      },
      {
        onComplete: internal.sellerBrain.handleWorkflowComplete,
        context: { sellerBrainId: first.sellerBrainId },
      },
    );
    
    // Store workflow ID for tracking
    await ctx.runMutation(internal.onboarding.init.setWorkflowId, {
      sellerBrainId: first.sellerBrainId,
      workflowId: String(workflowId),
    });
    return { sellerBrainId: first.sellerBrainId };
  },
});

export const finalizeOnboarding = internalMutation({
  args: {
    approvedClaims: ClaimsValidator,
    guardrails: v.array(v.string()),
    tone: v.string(),
    icpIndustry: v.array(v.string()),
    icpCompanySize: v.array(v.string()),
    icpBuyerRole: v.array(v.string()),
    timeZone: v.string(),
    availability: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const existing = await ctx.db
      .query("seller_brain")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (!existing) throw new Error("Seller brain not found");

    await ctx.db.patch(existing._id, {
      approvedClaims: args.approvedClaims,
      guardrails: args.guardrails,
      tone: args.tone,
      icpIndustry: args.icpIndustry,
      icpCompanySize: args.icpCompanySize,
      icpBuyerRole: args.icpBuyerRole,
      timeZone: args.timeZone,
      availability: args.availability,
      // Status tracking moved to onboarding_flow
    });
    return null;
  },
});

export const finalizeOnboardingPublic = mutation({
  args: {
    approvedClaims: ClaimsValidator,
    guardrails: v.array(v.string()),
    tone: v.string(),
    icpIndustry: v.array(v.string()),
    icpCompanySize: v.array(v.string()),
    icpBuyerRole: v.array(v.string()),
    timeZone: v.string(),
    availability: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.sellerBrain.finalizeOnboarding, args);
    return null;
  },
});

export const handleWorkflowComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({ sellerBrainId: v.id("seller_brain") }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { workflowId, result, context } = args;
    
    // Find the onboarding flow by sellerBrainId since workflowId index was removed
    // (optional workflowId causes index issues in Convex)
    const flow = await ctx.db
      .query("onboarding_flow")
      .withIndex("by_sellerBrainId", (q) => q.eq("sellerBrainId", context.sellerBrainId))
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
      console.error(`No onboarding flow found for workflow ${workflowId} or sellerBrainId ${context.sellerBrainId}`);
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
      sellerBrainId: context.sellerBrainId,
      flowId: flow._id,
      error: result.kind === "failed" ? result.error : null,
    });
    
    return null;
  },
});


