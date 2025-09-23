import { action, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import { Id } from "./_generated/dataModel";
import { workflow } from "./workflows";
import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import { LEAD_GEN_PHASE_WEIGHTS } from "./leadGen/constants";

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

    const phases = leadGenFlow.phases;
    if (phases.length === 0) {
      return 0;
    }

    let totalWeight = 0;
    let progressSum = 0;

    for (const phase of phases) {
      const weight = LEAD_GEN_PHASE_WEIGHTS[phase.name] ?? 0;
      if (weight <= 0) {
        continue;
      }
      totalWeight += weight;

      const phaseCompletion = phase.status === "complete" ? 1 : phase.status === "running" ? Math.max(0, Math.min(1, phase.progress)) : 0;
      progressSum += weight * phaseCompletion;
    }

    if (totalWeight === 0) {
      return 0;
    }

    return progressSum / totalWeight;
  },
});

/**
 * List client opportunities for a lead generation flow
 */
export const listClientOpportunitiesByFlow = query({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
  },
  returns: v.array(v.object({
    _id: v.id("client_opportunities"),
    _creationTime: v.number(),
    name: v.string(),
    domain: v.optional(v.string()),
    phone: v.optional(v.string()),
    place_id: v.string(),
    address: v.optional(v.string()),
    rating: v.optional(v.number()),
    reviews_count: v.optional(v.number()),
    status: v.string(),
    qualificationScore: v.number(),
    signals: v.array(v.string()),
    fit_reason: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    // Get authenticated user
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Authentication required");
    }

    // Get the lead gen flow to verify ownership
    const leadGenFlow = await ctx.db.get(args.leadGenFlowId);
    if (!leadGenFlow) {
      throw new Error("Lead generation flow not found");
    }

    if (leadGenFlow.userId !== user._id) {
      throw new Error("Unauthorized access to lead generation flow");
    }

    const opportunities = await ctx.db
      .query("client_opportunities")
      .withIndex("by_leadGenFlow", (q) => q.eq("leadGenFlowId", args.leadGenFlowId))
      .order("desc")
      .collect();

    return opportunities.map((opp) => ({
      _id: opp._id,
      _creationTime: opp._creationTime,
      name: opp.name,
      domain: opp.domain,
      phone: opp.phone,
      place_id: opp.place_id,
      address: opp.address,
      rating: opp.rating,
      reviews_count: opp.reviews_count,
      status: opp.status,
      qualificationScore: opp.qualificationScore,
      signals: opp.signals,
      fit_reason: opp.fit_reason,
    }));
  },
});

/**
 * List audit jobs for a lead generation flow
 */
export const listAuditJobsByFlow = query({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
  },
  returns: v.array(v.object({
    _id: v.id("audit_jobs"),
    _creationTime: v.number(),
    opportunityId: v.id("client_opportunities"),
    targetUrl: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("error"),
      v.literal("completed")
    ),
    phases: v.array(v.object({
      name: v.union(
        v.literal("map_urls"),
        v.literal("filter_urls"),
        v.literal("scrape_content"),
        v.literal("generate_dossier"),
      ),
      status: v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("complete"),
        v.literal("error")
      ),
    })),
    dossierId: v.optional(v.id("audit_dossier")),
  })),
  handler: async (ctx, args) => {
    // Get authenticated user
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Authentication required");
    }

    // Get the lead gen flow to verify ownership
    const leadGenFlow = await ctx.db.get(args.leadGenFlowId);
    if (!leadGenFlow) {
      throw new Error("Lead generation flow not found");
    }

    if (leadGenFlow.userId !== user._id) {
      throw new Error("Unauthorized access to lead generation flow");
    }

    const auditJobs = await ctx.db
      .query("audit_jobs")
      .withIndex("by_leadGenFlow", (q) => q.eq("leadGenFlowId", args.leadGenFlowId))
      .order("desc")
      .collect();

    return auditJobs.map((job) => ({
      _id: job._id,
      _creationTime: job._creationTime,
      opportunityId: job.opportunityId,
      targetUrl: job.targetUrl,
      status: job.status,
      phases: job.phases,
      dossierId: job.dossierId,
    }));
  },
});

/**
 * Get count statistics for opportunities and audits by flow
 */
export const getLeadGenFlowCounts = query({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
  },
  returns: v.object({
    totalOpportunities: v.number(),
    opportunitiesWithWebsites: v.number(),
    opportunitiesWithoutWebsites: v.number(),
    queuedAudits: v.number(),
    runningAudits: v.number(),
    completedAudits: v.number(),
    readyOpportunities: v.number(),
  }),
  handler: async (ctx, args) => {
    // Get authenticated user
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Authentication required");
    }

    // Get the lead gen flow to verify ownership
    const leadGenFlow = await ctx.db.get(args.leadGenFlowId);
    if (!leadGenFlow) {
      throw new Error("Lead generation flow not found");
    }

    if (leadGenFlow.userId !== user._id) {
      throw new Error("Unauthorized access to lead generation flow");
    }

    // Get opportunities
    const opportunities = await ctx.db
      .query("client_opportunities")
      .withIndex("by_leadGenFlow", (q) => q.eq("leadGenFlowId", args.leadGenFlowId))
      .collect();

    // Get audit jobs
    const auditJobs = await ctx.db
      .query("audit_jobs")
      .withIndex("by_leadGenFlow", (q) => q.eq("leadGenFlowId", args.leadGenFlowId))
      .collect();

    const totalOpportunities = opportunities.length;
    const opportunitiesWithWebsites = opportunities.filter(opp => opp.domain).length;
    const opportunitiesWithoutWebsites = totalOpportunities - opportunitiesWithWebsites;
    const queuedAudits = auditJobs.filter(job => job.status === "queued").length;
    const runningAudits = auditJobs.filter(job => job.status === "running").length;
    const completedAudits = auditJobs.filter(job => job.status === "completed").length;
    const readyOpportunities = opportunities.filter(opp => opp.status === "READY").length;

    return {
      totalOpportunities,
      opportunitiesWithWebsites,
      opportunitiesWithoutWebsites,
      queuedAudits,
      runningAudits,
      completedAudits,
      readyOpportunities,
    };
  },
});

/**
 * Get dossier details for a completed audit job
 */
export const getAuditDossier = query({
  args: {
    dossierId: v.id("audit_dossier"),
  },
  returns: v.union(
    v.object({
      _id: v.id("audit_dossier"),
      summary: v.optional(v.string()),
      identified_gaps: v.array(
        v.object({
          key: v.string(),
          value: v.string(),
          source_url: v.optional(v.string()),
        }),
      ),
      talking_points: v.array(
        v.object({
          text: v.string(),
          approved_claim_id: v.string(),
          source_url: v.optional(v.string()),
        }),
      ),
      sources: v.array(
        v.object({
          url: v.string(),
          title: v.optional(v.string()),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Authentication required");
    }

    const dossier = await ctx.db.get(args.dossierId);
    if (!dossier) {
      return null;
    }

    const opportunity = await ctx.db.get(dossier.opportunityId);
    if (!opportunity) {
      throw new Error("Linked opportunity not found");
    }

    const agencyProfile = await ctx.db.get(opportunity.agencyId);
    const ownsViaAgency = Boolean(agencyProfile && agencyProfile.userId === user._id);

    let ownsViaFlow = false;
    if (opportunity.leadGenFlowId) {
      const leadGenFlow = await ctx.db.get(opportunity.leadGenFlowId);
      ownsViaFlow = Boolean(leadGenFlow && leadGenFlow.userId === user._id);
    }

    if (!ownsViaAgency && !ownsViaFlow) {
      throw new Error("Unauthorized access to audit dossier");
    }

    return {
      _id: dossier._id,
      summary: dossier.summary,
      identified_gaps: dossier.identified_gaps ?? [],
      talking_points: dossier.talking_points ?? [],
      sources: dossier.sources ?? [],
    };
  },
});

/**
 * List scraped pages for an audit job (without raw content)
 */
export const listScrapedPagesByAudit = query({
  args: {
    auditJobId: v.id("audit_jobs"),
  },
  returns: v.array(
    v.object({
      url: v.string(),
      title: v.optional(v.string()),
      httpStatus: v.optional(v.number()),
      contentUrl: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("Authentication required");
    }

    const auditJob = await ctx.db.get(args.auditJobId);
    if (!auditJob) {
      throw new Error("Audit job not found");
    }

    const agencyProfile = await ctx.db.get(auditJob.agencyId);
    const ownsViaAgency = Boolean(agencyProfile && agencyProfile.userId === user._id);

    let ownsViaFlow = false;
    if (auditJob.leadGenFlowId) {
      const leadGenFlow = await ctx.db.get(auditJob.leadGenFlowId);
      ownsViaFlow = Boolean(leadGenFlow && leadGenFlow.userId === user._id);
    }

    if (!ownsViaAgency && !ownsViaFlow) {
      throw new Error("Unauthorized access to audit job");
    }

    const pages = await ctx.db
      .query("audit_scraped_pages")
      .withIndex("by_auditJobId", (q) => q.eq("auditJobId", args.auditJobId))
      .collect();

    const result = await Promise.all(
      pages.map(async (page) => {
        const contentUrl = page.contentRef ? await ctx.storage.getUrl(page.contentRef) : null;
        return {
          url: page.url,
          title: page.title,
          httpStatus: page.httpStatus,
          contentUrl: contentUrl ?? undefined,
        };
      }),
    );

    return result;
  },
});
