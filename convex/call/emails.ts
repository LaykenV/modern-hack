import { query } from "../_generated/server";
import { v } from "convex/values";

export const listByAgency = query({
  args: { agencyId: v.id("agency_profile") },
  returns: v.array(
    v.object({
      _id: v.id("emails"),
      _creationTime: v.number(),
      opportunityId: v.id("client_opportunities"),
      agencyId: v.optional(v.id("agency_profile")),
      from: v.string(),
      to: v.string(),
      subject: v.string(),
      type: v.union(
        v.literal("prospect_confirmation"),
        v.literal("agency_summary"),
      ),
      status: v.union(v.literal("queued"), v.literal("sent"), v.literal("failed")),
      error: v.optional(v.string()),
      sent_at: v.optional(v.number()),
      storageRef: v.optional(v.id("_storage")),
      icsUrl: v.union(v.string(), v.null()),

      // Prospect & campaign context for UX filters
      prospectName: v.optional(v.string()),
      prospectPhone: v.optional(v.string()),
      prospectEmail: v.optional(v.string()),
      prospectAddress: v.optional(v.string()),
      targetVertical: v.optional(v.string()),
      targetGeography: v.optional(v.string()),
      leadGenFlowId: v.optional(v.id("lead_gen_flow")),
    }),
  ),
  handler: async (ctx, { agencyId }) => {
    const rows = await ctx.db
      .query("emails")
      .withIndex("by_agency", (q) => q.eq("agencyId", agencyId))
      .order("desc")
      .collect();

    const results = [];

    for (const email of rows) {
      const opp = await ctx.db.get(email.opportunityId);
      const icsUrl = email.storageRef ? await ctx.storage.getUrl(email.storageRef) : null;

      results.push({
        _id: email._id,
        _creationTime: email._creationTime,
        opportunityId: email.opportunityId,
        agencyId: email.agencyId,
        from: email.from,
        to: email.to,
        subject: email.subject,
        type: email.type,
        status: email.status,
        error: email.error,
        sent_at: email.sent_at,
        storageRef: email.storageRef,
        icsUrl,
        prospectName: opp?.name,
        prospectPhone: opp?.phone,
        prospectEmail: opp?.email,
        prospectAddress: opp?.address,
        targetVertical: opp?.targetVertical,
        targetGeography: opp?.targetGeography,
        leadGenFlowId: opp?.leadGenFlowId,
      });
    }

    return results;
  },
});

export const getEmailById = query({
  args: { emailId: v.id("emails") },
  returns: v.union(
    v.object({
      _id: v.id("emails"),
      _creationTime: v.number(),
      opportunityId: v.id("client_opportunities"),
      agencyId: v.optional(v.id("agency_profile")),
      from: v.string(),
      to: v.string(),
      subject: v.string(),
      html: v.string(),
      type: v.union(
        v.literal("prospect_confirmation"),
        v.literal("agency_summary"),
      ),
      status: v.union(v.literal("queued"), v.literal("sent"), v.literal("failed")),
      error: v.optional(v.string()),
      sent_at: v.optional(v.number()),
      icsUrl: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, { emailId }) => {
    const e = await ctx.db.get(emailId);
    if (!e) return null;
    const icsUrl = e.storageRef ? await ctx.storage.getUrl(e.storageRef) : null;
    return {
      _id: e._id,
      _creationTime: e._creationTime,
      opportunityId: e.opportunityId,
      agencyId: e.agencyId,
      from: e.from,
      to: e.to,
      subject: e.subject,
      html: e.html,
      type: e.type,
      status: e.status,
      error: e.error,
      sent_at: e.sent_at,
      icsUrl,
    };
  },
});


