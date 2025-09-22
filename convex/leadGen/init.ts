import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { initializePhases } from "./statusUtils";

/**
 * Initialize a new lead generation flow
 */
export const initLeadGenFlow = internalMutation({
  args: {
    userId: v.string(),
    agencyId: v.id("agency_profile"),
    numLeads: v.number(),
    campaign: v.object({
      targetVertical: v.string(),
      targetGeography: v.string(),
    }),
  },
  returns: v.id("lead_gen_flow"),
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const leadGenFlowId = await ctx.db.insert("lead_gen_flow", {
      userId: args.userId,
      agencyId: args.agencyId,
      numLeadsRequested: args.numLeads,
      numLeadsFetched: 0,
      campaign: args.campaign,
      status: "idle",
      workflowStatus: undefined,
      workflowId: undefined,
      phases: initializePhases(),
      lastEvent: {
        type: "leadgen.initialized",
        message: "Lead generation initialized",
        timestamp: now,
      },
      placesSnapshot: undefined,
    });

    return leadGenFlowId;
  },
});

/**
 * Set workflow ID after workflow is started
 */
export const setWorkflowId = internalMutation({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
    workflowId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadGenFlowId, {
      workflowId: args.workflowId,
      status: "running",
      workflowStatus: "running",
      lastEvent: {
        type: "leadgen.started",
        message: "Lead generation workflow started",
        timestamp: Date.now(),
      },
    });
    
    return null;
  },
});

/**
 * Update places snapshot and fetched count after sourcing
 */
export const updatePlacesSnapshot = internalMutation({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
    places: v.array(v.object({
      id: v.string(),
      name: v.string(),
      website: v.optional(v.string()),
      phone: v.optional(v.string()),
      rating: v.optional(v.number()),
      reviews: v.optional(v.number()),
      address: v.optional(v.string()),
    })),
    numFetched: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadGenFlowId, {
      placesSnapshot: args.places.slice(0, 20), // Keep only first 20 for UI preview
      numLeadsFetched: args.numFetched,
    });
    
    return null;
  },
});
