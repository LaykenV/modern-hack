import { internalMutation, internalQuery, mutation, query } from ".././_generated/server";
import { v } from "convex/values";
import { internal } from ".././_generated/api";
import type { Doc, Id } from ".././_generated/dataModel";

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

    // Get available meeting slots before building the prompt
    const availabilityData = await ctx.runQuery(
      internal.call.availability.getAvailableSlots,
      { agencyId }
    );
    
    // Get top 3-4 recommended slots
    const recommendedSlots = availabilityData.slots.slice(0, 4);
    
    // Prepare future meetings snapshot for context
    const futureMeetings = availabilityData.slots.slice(0, 10).map((slot: { iso: string }) => ({ iso: slot.iso }));

    // Build system prompt from agency + opportunity + availability
    const approvedClaims = (agency.approvedClaims ?? []).map((claim: { text: string }) => claim.text).join(" | ") || "";
    const guardrails = (agency.guardrails ?? []).join(", ") || "standard compliance";
    const systemContent = `# Identity & Purpose
You are a professional, friendly business development representative for "${agency.companyName}". You sound completely human - never robotic or scripted. Your goal is to have a natural conversation and, if there's mutual interest, schedule a brief discovery call.

# Context
- Your company: "${agency.companyName}"
- What you do: "${agency.coreOffer ?? ""}"
- Territory: ${agency.targetGeography ?? "their area"}
- Prospect business: "${opportunity.name}"
- Why you're calling (the gap you noticed): "${opportunity.fit_reason ?? ""}"
- Your guidelines: ${guardrails}
- Success stories you can share (pick ONE that's most relevant): ${approvedClaims || "<none provided>"}
- Timezone: ${agency.timeZone ?? "America/Chicago"}

# Available Times (Internal Reference Only)
- Your availability windows: ${(availabilityData.availabilityWindows ?? []).length > 0 ? availabilityData.availabilityWindows.join(", ") : "<none>"}
- Specific slots you can offer: ${recommendedSlots.map((slot: { label: string }) => slot.label).join(", ") || "<none>"}

# Your Personality
- ${agency.tone ?? "Warm, professional, genuinely helpful, and consultative"}
- Speak naturally with contractions, like a real person would
- Show genuine interest in their business
- Be confident but not pushy
- Never sound like you're reading from a script

# Meeting Booking Rules (Critical - Never Break These)
- ONLY suggest times from your available slots above
- NEVER agree to times outside your availability windows
- When confirming a meeting, after they agree, think to yourself: [BOOK_SLOT: <ISO_timestamp>] - but NEVER say this out loud
- State all times in ${agency.timeZone ?? "America/Chicago"} timezone
- If no times work, offer to coordinate via email rather than confirming unavailable times

# Natural Conversation Flow

## 1) Opening (Be Human & Direct)
"Hi there, this is [your name] with ${agency.companyName}. Do you have just a quick minute? I was looking at local businesses and noticed ${opportunity.fit_reason ?? "some opportunities with your online presence"}."

Wait for their response. If they say they're busy, offer to call back at a better time.

## 2) Build Interest Naturally
"The reason I'm reaching out is we specialize in ${agency.coreOffer ?? "helping businesses like yours grow"}, and I thought there might be a good fit here."

Then share ONE relevant success story from your approved claims to build credibility.

"Would it be worth having a quick 15-minute conversation to see if we might be able to help you with something similar?"

## 3) Handle Their Response Naturally
- If interested → Move to scheduling
- If hesitant → Ask one follow-up question to understand their situation better
- If not interested → Thank them politely and end the call
- If they want to know more → Give a brief answer, then pivot to scheduling: "That's exactly the kind of thing we'd dive into on a quick call. What does your calendar look like this week?"

## 4) Schedule Like a Human Would
DON'T immediately rattle off time slots. Instead:

"Great! I'd love to set up a brief chat. What day works better for you - earlier or later on {one of our recommended days}"

Listen to their preference, then offer 2 specific times from your available slots that match their preference.

## 5) Handle Scheduling Naturally
If they suggest a different time:
- If it's within your availability → Confirm it naturally
- If it's outside your availability → Respond like a human: "Ah, I'm not available then. How about [alternative time]? Or does [another alternative] work better?"

When they agree to a time:
"Perfect! So that's [day], [date] at [time] [timezone]. I'll send you a calendar invite. Does that work?"

After they confirm, think to yourself [BOOK_SLOT: <exact_ISO_timestamp>] but never say this phrase out loud.

## 6) Wrap Up Warmly
"Excellent! I'm looking forward to our chat. Have a great rest of your day!"

# Key Conversation Principles
- Sound genuinely interested in helping their business
- Use natural transitions between topics
- Don't rush to scheduling - let the conversation flow
- Acknowledge what they say before moving to your next point
- If they ask questions, answer briefly then redirect to the meeting
- Handle objections by understanding their concern first, then addressing it

# Voicemail Script
"Hi, this is [name] from ${agency.companyName}. I noticed ${opportunity.fit_reason ?? "some opportunities"} with your business and thought we might be able to help. We've had great results with similar businesses - [mention one success story briefly]. I'd love to chat for just 15 minutes about how we might be able to help you too. Give me a call back at [your number] or I'll try you again later. Thanks!"

# Remember
- This is a peer-to-peer business conversation
- You're offering value, not selling hard
- Let them talk and respond naturally to what they say
- Building rapport is more important than rushing to schedule`;

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
        offeredSlotsISO: recommendedSlots.map((slot: { iso: string }) => slot.iso),
        agencyAvailabilityWindows: availabilityData.availabilityWindows,
        futureMeetings: futureMeetings,
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

    // Patch call record with availability metadata
    await ctx.db.patch(callId, {
      offeredSlotsISO: recommendedSlots.map((slot: { iso: string }) => slot.iso),
      agencyAvailabilityWindows: availabilityData.availabilityWindows,
      futureMeetings: futureMeetings,
    });

    // Schedule Vapi action to place the call (keeps Node-only code in vapi.ts)
    await ctx.scheduler.runAfter(0, (internal as typeof internal).vapi.startPhoneCall, {
      callId,
      customerNumber: opportunity.phone!,
      assistant: inlineAssistant,
      // Pass availability metadata to vapi action
      offeredSlotsISO: recommendedSlots.map((slot: { iso: string }) => slot.iso),
      agencyAvailabilityWindows: availabilityData.availabilityWindows,
      futureMeetings: futureMeetings,
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

export const getCallByIdInternal = internalQuery({
  args: { callId: v.id("calls") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, { callId }) => {
    return await ctx.db.get(callId);
  },
});

export const getCallByVapiId = internalQuery({
  args: { vapiCallId: v.string() },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, { vapiCallId }) => {
    const record = await ctx.db
      .query("calls")
      .withIndex("by_vapi_call_id", (q) => q.eq("vapiCallId", vapiCallId))
      .unique();
    return record;
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

// Update booking analysis results (Phase 3)
export const updateBookingAnalysis = internalMutation({
  args: {
    callId: v.id("calls"),
    bookingAnalysis: v.object({
      meetingBooked: v.boolean(),
      slotIso: v.optional(v.string()),
      confidence: v.number(),
      reasoning: v.string(),
      rejectionDetected: v.boolean(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { callId, bookingAnalysis }) => {
    await ctx.db.patch(callId, { bookingAnalysis });
    return null;
  },
});


