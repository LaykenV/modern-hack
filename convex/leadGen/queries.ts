/**
 * Internal queries for lead generation workflow
 * Provides data access for workflow steps without authentication requirements
 */

import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get lead generation flow for internal workflow use (no auth required)
 */
export const getLeadGenFlowInternal = internalQuery({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
  },
  returns: v.union(
    v.object({
      _id: v.id("lead_gen_flow"),
      _creationTime: v.number(),
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
        v.literal("paused_for_upgrade"),
        v.literal("completed"),
      ),
      workflowStatus: v.optional(v.union(
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("cancelled")
      )),
      workflowId: v.optional(v.string()),
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
      billingBlock: v.optional(v.object({
        phase: v.string(),
        featureId: v.string(),
        preview: v.any(),
        auditJobId: v.optional(v.id("audit_jobs")),
        createdAt: v.number(),
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
    return await ctx.db.get(args.leadGenFlowId);
  },
});

/**
 * Get agency profile by ID for internal use (no auth required)
 */
export const getAgencyProfileInternal = internalQuery({
  args: {
    agencyId: v.id("agency_profile"),
  },
  returns: v.union(
    v.object({
      _id: v.id("agency_profile"),
      _creationTime: v.number(),
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
      approvedClaims: v.optional(
        v.array(
          v.object({
            id: v.string(),
            text: v.string(),
            source_url: v.string(),
          }),
        ),
      ),
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
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.agencyId);
  },
});

/**
 * Get opportunities with websites for audit queueing
 */
export const getOpportunitiesWithWebsites = internalQuery({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
  },
  returns: v.array(v.object({
    _id: v.id("client_opportunities"),
    name: v.string(),
    domain: v.optional(v.string()),
    status: v.string(),
  })),
  handler: async (ctx, args) => {
    const opportunities = await ctx.db
      .query("client_opportunities")
      .withIndex("by_leadGenFlow", (q) => q.eq("leadGenFlowId", args.leadGenFlowId))
      .filter((q) => q.neq(q.field("domain"), undefined))
      .collect();

    return opportunities.map(opp => ({
      _id: opp._id,
      name: opp.name,
      domain: opp.domain,
      status: opp.status,
    }));
  },
});

/**
 * Get existing audit job for an opportunity
 */
export const getAuditJobByOpportunity = internalQuery({
  args: {
    opportunityId: v.id("client_opportunities"),
  },
  returns: v.union(
    v.object({
      _id: v.id("audit_jobs"),
      status: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const auditJob = await ctx.db
      .query("audit_jobs")
      .withIndex("by_opportunity", (q) => q.eq("opportunityId", args.opportunityId))
      .first();

    if (!auditJob) return null;

    return {
      _id: auditJob._id,
      status: auditJob.status,
    };
  },
});

/**
 * Get opportunity by ID for internal use
 */
export const getOpportunityById = internalQuery({
  args: {
    opportunityId: v.id("client_opportunities"),
  },
  returns: v.union(
    v.object({
      _id: v.id("client_opportunities"),
      _creationTime: v.number(),
      agencyId: v.id("agency_profile"),
      name: v.string(),
      domain: v.optional(v.string()),
      phone: v.optional(v.string()),
      place_id: v.string(),
      address: v.optional(v.string()),
      city: v.optional(v.string()),
      rating: v.optional(v.number()),
      reviews_count: v.optional(v.number()),
      source: v.string(),
      fit_reason: v.optional(v.string()),
      status: v.string(),
      leadGenFlowId: v.optional(v.id("lead_gen_flow")),
      targetVertical: v.string(),
      targetGeography: v.string(),
      qualificationScore: v.number(),
      signals: v.array(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.opportunityId);
  },
});

/**
 * Get audit jobs by lead gen flow ID
 */
export const getAuditJobsByFlow = internalQuery({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
  },
  returns: v.array(v.object({
    _id: v.id("audit_jobs"),
    opportunityId: v.id("client_opportunities"),
    agencyId: v.id("agency_profile"),
    leadGenFlowId: v.optional(v.id("lead_gen_flow")),
    targetUrl: v.string(),
    status: v.string(),
  })),
  handler: async (ctx, args) => {
    const auditJobs = await ctx.db
      .query("audit_jobs")
      .withIndex("by_leadGenFlow", (q) => q.eq("leadGenFlowId", args.leadGenFlowId))
      .filter((q) => q.eq(q.field("status"), "queued"))
      .collect();

    return auditJobs.map(job => ({
      _id: job._id,
      opportunityId: job.opportunityId,
      agencyId: job.agencyId,
      leadGenFlowId: job.leadGenFlowId,
      targetUrl: job.targetUrl,
      status: job.status,
    }));
  },
});

/**
 * Get audit job by ID (internal)
 */
export const getAuditJobById = internalQuery({
  args: {
    auditJobId: v.id("audit_jobs"),
  },
  returns: v.union(
    v.object({
      _id: v.id("audit_jobs"),
      _creationTime: v.number(),
      opportunityId: v.id("client_opportunities"),
      agencyId: v.id("agency_profile"),
      leadGenFlowId: v.optional(v.id("lead_gen_flow")),
      targetUrl: v.string(),
      status: v.string(),
      phases: v.array(v.object({
        name: v.string(),
        status: v.string(),
      })),
      dossierId: v.optional(v.id("audit_dossier")),
      analysisThread: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.auditJobId);
  },
});

