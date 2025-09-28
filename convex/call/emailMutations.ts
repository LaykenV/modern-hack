import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const createQueuedEmail = internalMutation({
  args: {
    opportunityId: v.id("client_opportunities"),
    agencyId: v.optional(v.id("agency_profile")),
    from: v.string(),
    to: v.string(),
    bcc: v.optional(v.string()),
    subject: v.string(),
    html: v.string(),
    type: v.union(v.literal("prospect_confirmation"), v.literal("agency_summary")),
    storageRef: v.optional(v.id("_storage")),
  },
  returns: v.id("emails"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("emails", {
      ...args,
      status: "queued",
    });
  },
});

export const markEmailSent = internalMutation({
  args: {
    emailId: v.id("emails"),
  },
  returns: v.null(),
  handler: async (ctx, { emailId }) => {
    await ctx.db.patch(emailId, {
      status: "sent",
      sent_at: Date.now(),
    });
    return null;
  },
});

export const markEmailFailed = internalMutation({
  args: {
    emailId: v.id("emails"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { emailId, error }) => {
    await ctx.db.patch(emailId, {
      status: "failed",
      error,
    });
    return null;
  },
});

