import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

type AssistantMessage = { role: "system"; content: string };
type AssistantPayload = {
  name: string;
  model: { provider: string; model: string; messages: Array<AssistantMessage> };
  voice: { provider: string; voiceId: string; model?: string };
  transcriber?: { provider: string; model: string };
  firstMessageMode?: "assistant-speaks-first" | "customer-speaks-first";
  // Vapi expects string enum serverMessages, not objects
  serverMessages?: Array<
    | "conversation-update"
    | "end-of-call-report"
    | "function-call"
    | "hang"
    | "language-changed"
    | "language-change-detected"
    | "model-output"
    | "phone-call-control"
    | "speech-update"
    | "status-update"
    | "transcript"
    | "transcript[transcriptType=\"final\"]"
    | "tool-calls"
    | "transfer-destination-request"
    | "handoff-destination-request"
    | "transfer-update"
    | "user-interrupted"
    | "voice-input"
    | "chat.created"
    | "chat.deleted"
    | "session.created"
    | "session.updated"
    | "session.deleted"
  >;
  metadata?: Record<string, unknown>;
};

export const startCall = mutation({
  args: {
    opportunityId: v.id("client_opportunities"),
    agencyId: v.id("agency_profile"),
  },
  returns: v.object({ callId: v.id("calls"), vapiCallId: v.string() }),
  handler: async (ctx, { opportunityId, agencyId }) => {
    // Load opportunity and agency
    const opportunity: Doc<"client_opportunities"> | null = await ctx.runQuery(
      internal.leadGen.queries.getOpportunityById,
      { opportunityId },
    );
    if (!opportunity) throw new Error("Opportunity not found");
    if (!opportunity.phone) throw new Error("Opportunity missing phone number");

    const agency: Doc<"agency_profile"> | null = await ctx.runQuery(
      internal.leadGen.queries.getAgencyProfileInternal,
      { agencyId },
    );
    if (!agency) throw new Error("Agency profile not found");

    // Build system prompt from agency + opportunity
    const approvedClaims = (agency.approvedClaims ?? []).map((claim: { text: string }) => claim.text).join(" | ") || "";
    const guardrails = (agency.guardrails ?? []).join(", ") || "standard compliance";
    const systemContent = `You are a friendly sales rep for "${agency.companyName}". Their core offer is "${agency.coreOffer ?? ""}". You are calling "${opportunity.name}" in ${agency.targetGeography ?? "their area"}. Reference their gap: "${opportunity.fit_reason ?? ""}". You MUST cite one approved claim: ${approvedClaims}. Follow guardrails: ${guardrails}.`;

    const inlineAssistant: AssistantPayload = {
      name: `Atlas AI Rep for ${agency.companyName}`,
      model: {
        provider: "openai",
        model: "chatgpt-4o-latest",
        messages: [{ role: "system", content: systemContent }],
      },
      voice: { provider: "playht", voiceId: "jennifer", model: "PlayDialog" },
      transcriber: { provider: "deepgram", model: "nova-3-general" },
      firstMessageMode: "assistant-speaks-first",
      serverMessages: [
        "status-update",
        "transcript",
        "end-of-call-report",
      ],
      metadata: {
        convexOpportunityId: opportunity._id,
        convexAgencyId: agency._id,
        leadGenFlowId: opportunity.leadGenFlowId ?? null,
      },
    };

    // Create DB call row (initiated)
    const callId: Id<"calls"> = await ctx.db.insert("calls", {
      opportunityId,
      agencyId,
      dialedNumber: opportunity.phone!,
      assistantSnapshot: inlineAssistant,
      status: "initiated",
      startedAt: Date.now(),
      currentStatus: "queued",
    });

    // Schedule Vapi action to place the call (keeps Node-only code in vapi.ts)
    await ctx.scheduler.runAfter(0, (internal as typeof internal).vapi.startPhoneCall, {
      callId,
      customerNumber: opportunity.phone!,
      assistant: inlineAssistant,
    });

    return { callId, vapiCallId: "pending" };
  },
});

export const _createInitiatedCall = internalMutation({
  args: {
    opportunityId: v.id("client_opportunities"),
    agencyId: v.id("agency_profile"),
    dialedNumber: v.string(),
    assistantSnapshot: v.any(),
  },
  returns: v.id("calls"),
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("calls", {
      opportunityId: args.opportunityId,
      agencyId: args.agencyId,
      dialedNumber: args.dialedNumber,
      assistantSnapshot: args.assistantSnapshot,
      status: "initiated",
      startedAt: now,
      currentStatus: "queued",
    });
  },
});

export const _attachVapiDetails = internalMutation({
  args: {
    callId: v.id("calls"),
    vapiCallId: v.string(),
    phoneNumberId: v.string(),
    monitorUrls: v.object({ listenUrl: v.union(v.string(), v.null()) }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.callId, {
      vapiCallId: args.vapiCallId,
      phoneNumberId: args.phoneNumberId,
      monitorUrls: { listenUrl: args.monitorUrls.listenUrl ?? undefined },
    });
    return null;
  },
});

export const updateStatusFromWebhook = internalMutation({
  args: {
    vapiCallId: v.string(),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { vapiCallId, status }) => {
    const record = await ctx.db
      .query("calls")
      .withIndex("by_vapi_call_id", (q) => q.eq("vapiCallId", vapiCallId))
      .unique();
    if (!record) return null;
    await ctx.db.patch(record._id, {
      status,
      currentStatus: status,
      lastWebhookAt: Date.now(),
    });
    return null;
  },
});

export const appendTranscriptChunk = internalMutation({
  args: {
    vapiCallId: v.string(),
    fragment: v.object({ role: v.string(), text: v.string(), timestamp: v.optional(v.number()), source: v.optional(v.string()) }),
  },
  returns: v.null(),
  handler: async (ctx, { vapiCallId, fragment }) => {
    const record = await ctx.db
      .query("calls")
      .withIndex("by_vapi_call_id", (q) => q.eq("vapiCallId", vapiCallId))
      .unique();
    if (!record) return null;
    const transcript = [...(record.transcript ?? []), fragment];
    await ctx.db.patch(record._id, { transcript, lastWebhookAt: Date.now() });
    return null;
  },
});

export const finalizeReport = internalMutation({
  args: {
    vapiCallId: v.string(),
    summary: v.optional(v.string()),
    recordingUrl: v.optional(v.string()),
    endedReason: v.optional(v.string()),
    billingSeconds: v.optional(v.number()),
    messages: v.optional(v.array(v.any())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("calls")
      .withIndex("by_vapi_call_id", (q) => q.eq("vapiCallId", args.vapiCallId))
      .unique();
    if (!record) return null;
    const safeBillingSeconds =
      typeof args.billingSeconds === "number" && Number.isFinite(args.billingSeconds)
        ? Math.max(0, Math.round(args.billingSeconds))
        : undefined;
    await ctx.db.patch(record._id, {
      summary: args.summary,
      recordingUrl: args.recordingUrl,
      endedReason: args.endedReason,
      billingSeconds: safeBillingSeconds,
      status: "completed",
      currentStatus: "completed",
      lastWebhookAt: Date.now(),
    });
    return null;
  },
});

// Queries for UI
export const getCallById = query({
  args: { callId: v.id("calls") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, { callId }) => {
    return await ctx.db.get(callId);
  },
});

export const getCallsByOpportunity = query({
  args: { opportunityId: v.id("client_opportunities") },
  returns: v.array(v.any()),
  handler: async (ctx, { opportunityId }) => {
    const rows = await ctx.db
      .query("calls")
      .withIndex("by_opportunity", (q) => q.eq("opportunityId", opportunityId))
      .collect();
    return rows;
  },
});


