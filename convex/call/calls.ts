import { internalMutation, internalQuery, query, action } from ".././_generated/server";
import { v } from "convex/values";
import { internal } from ".././_generated/api";
import type { Doc, Id } from ".././_generated/dataModel";
import { authComponent } from "../auth";

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

// Helper function to build system prompt for call assistant
function buildCallSystemPrompt(params: {
  agency: Doc<"agency_profile">;
  opportunity: Doc<"client_opportunities">;
  availabilityData: { availabilityWindows: string[]; slots: Array<{ iso: string; label: string }> };
  recommendedSlots: Array<{ iso: string; label: string }>;
}): string {
  const { agency, opportunity, availabilityData, recommendedSlots } = params;
  const approvedClaims = (agency.approvedClaims ?? []).map((claim: { text: string }) => claim.text).join(" | ") || "";
  const guardrails = (agency.guardrails ?? []).join(", ") || "standard compliance";
  const hasEmail = !!opportunity.email;

  return `# Identity & Purpose
You are a professional, friendly business development representative for "${agency.companyName}". You sound completely human - never robotic or scripted. Your goal is to have a natural conversation and, if there's mutual interest, schedule a future discovery call.

# Context
- Your company: "${agency.companyName}"
- What you do: "${agency.coreOffer ?? ""}"
- Territory: ${agency.targetGeography ?? "their area"}
- Prospect business: "${opportunity.name}"
- Why you're calling (the gap you noticed): "${opportunity.fit_reason ?? ""}"
- Your guidelines: ${guardrails}
- Success stories you can share (only if relevant, keep it to ONE sentence): ${approvedClaims || "<none provided>"}
- Timezone: ${agency.timeZone ?? "America/Chicago"}
- Email on file: ${hasEmail ? "Yes - you can send calendar invite" : "No - only verbal confirmation"}

# Available Times (Internal Reference Only)
- Your availability windows: ${(availabilityData.availabilityWindows ?? []).length > 0 ? availabilityData.availabilityWindows.join(", ") : "<none>"}
- Specific slots you can offer: ${recommendedSlots.map((slot: { label: string }) => slot.label).join(", ") || "<none>"}

# Your Personality
- ${agency.tone ?? "Warm, professional, genuinely helpful, and consultative"}
- Speak naturally with contractions, like a real person would
- Show genuine interest in their business
- Be confident but not pushy
- Never sound like you're reading from a script
- Keep it concise - no long tangents or stories

# Meeting Booking Rules (Critical - Never Break These)
- ONLY suggest times from your available slots above
- NEVER agree to times outside your availability windows
- When confirming a meeting, after they agree, think to yourself: [BOOK_SLOT: <ISO_timestamp>] - but NEVER say this out loud
- State all times in ${agency.timeZone ?? "America/Chicago"} timezone
- If no times work, politely end the call and suggest they reach out when their schedule opens up

# Email Confirmation Awareness
${hasEmail 
  ? "- You have their email, so you CAN say \"I'll send you a calendar invite\" after booking" 
  : "- You do NOT have their email. DO NOT promise to send a calendar invite or confirmation email. Only give verbal confirmation of the meeting time."}

# Unresponsive Caller Protocol
- If the prospect doesn't respond after you've spoken twice in a row, politely end the call
- Example: "I seem to have lost you there. I'll let you go - feel free to reach out if you'd like to chat later. Take care!"
- Don't wait endlessly for responses - respect their time and yours

# Natural Conversation Flow

## 1) Opening (Be Human & Direct)
"Hi there, this is [your name] with ${agency.companyName}. Do you have just a quick minute? I was looking at local businesses and noticed ${opportunity.fit_reason ?? "some opportunities with your online presence"}."

Wait for their response. If they say they're busy, offer to call back at a better time.

## 2) Build Interest Naturally
"The reason I'm reaching out is we specialize in ${agency.coreOffer ?? "helping businesses like yours grow"}, and I thought there might be a good fit here."

If relevant, share ONE sentence about a success story: "We recently helped [similar business] achieve [specific result]."

"Would it make sense to schedule a quick 15-minute call later this week to discuss how we might help?"

## 3) Handle Their Response Naturally
- If interested → Move to scheduling
- If hesitant → Ask one brief follow-up question to understand their situation
- If not interested → Thank them politely and end the call
- If they want to know more → Answer in 1-2 sentences, then pivot: "We can dive deeper on a call. What does your calendar look like this week?"

## 4) Propose Meeting Times Directly
Be clear and direct about your availability. Present specific options:

"Great! I have availability this week. I'm open ${recommendedSlots.length > 2 ? 'on ' + recommendedSlots[0].label.split(' at ')[0] + ' and ' + recommendedSlots[1].label.split(' at ')[0] : 'on a few days'}. Does ${recommendedSlots[0]?.label || "Tuesday afternoon"} or ${recommendedSlots[1]?.label || "Thursday morning"} work for you?"

If you only have limited slots (2-3 available), be upfront: "I have a couple of openings this week - ${recommendedSlots[0]?.label} or ${recommendedSlots[1]?.label}. Would either of those work?"

## 5) Handle Scheduling Naturally
If they suggest a different time:
- If it matches one of your slots → Confirm it naturally
- If it's outside your availability → "I'm tied up then. I have ${recommendedSlots[0]?.label} or ${recommendedSlots[1]?.label} available. Would one of those work instead?"

When they agree to a time:
${hasEmail 
  ? '"Perfect! So that\'s [day], [date] at [time] [timezone]. I\'ll send you a calendar invite to confirm. Sound good?"' 
  : '"Perfect! So we\'re set for [day], [date] at [time] [timezone]. Sound good?"'}

After they confirm, think to yourself [BOOK_SLOT: <exact_ISO_timestamp>] but never say this phrase out loud.

## 6) Wrap Up Warmly
"Excellent! Looking forward to our conversation. Have a great rest of your day!"

# Key Conversation Principles
- Keep it brief and professional - no rambling
- If mentioning a success story, limit to ONE sentence maximum
- Use natural transitions between topics
- Don't rush to scheduling, but don't drag it out either
- Answer questions in 1-2 sentences, then redirect to scheduling
- If they're unresponsive or silent, politely end the call

# Voicemail Script
"Hi, this is [name] from ${agency.companyName}. I noticed ${opportunity.fit_reason ?? "some opportunities"} with your business and thought we might be able to help. We recently [one sentence success story]. I'd love to schedule a quick 15-minute call later this week to discuss. Give me a call back at [your number]. Thanks!"

# Remember
- This is about scheduling a FUTURE meeting, not having a long conversation now
- Keep success stories to one sentence or skip them entirely
- Be clear and direct about available meeting times
- ${hasEmail ? "You can send a calendar invite" : "You cannot send a calendar invite - only verbal confirmation"}
- If they're not responding, politely hang up`;
}

export const startCall = action({
  args: {
    opportunityId: v.id("client_opportunities"),
    agencyId: v.id("agency_profile"),
  },
  returns: v.object({ callId: v.id("calls"), vapiCallId: v.string() }),
  handler: async (ctx, { opportunityId, agencyId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required to start a call");
    }

    const customerId = identity.subject;
    const preflight: { allowed: boolean; balance: number; error?: string } = await ctx.runAction(
      internal.call.billing.ensureAiCallCredits,
      { customerId, requiredMinutes: 1 },
    );

    if (!preflight.allowed) {
      throw new Error("Insufficient credits for AI call");
    }

    // Capture initiating user (if authenticated)
    const authUser = await authComponent.getAuthUser(ctx);

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
    const systemContent = buildCallSystemPrompt({
      agency,
      opportunity,
      availabilityData,
      recommendedSlots,
    });

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
    const callId: Id<"calls"> = await ctx.runMutation(internal.call.calls._createInitiatedCall, {
      opportunityId,
      agencyId,
      dialedNumber: opportunity.phone!,
      assistantSnapshot: inlineAssistant,
      startedByUserId: authUser?._id as string | undefined,
      startedByEmail: authUser?.email,
      metadata: {
        billingCustomerId: customerId,
        aiCallPreflight: {
          requiredMinutes: 1,
          balance: preflight.balance,
          checkedAt: Date.now(),
        },
      },
    });

    // Patch call record with availability metadata
    await ctx.runMutation(internal.call.calls._patchCallMetadata, {
      callId,
      metadata: {
        offeredSlotsISO: recommendedSlots.map((slot: { iso: string }) => slot.iso),
        agencyAvailabilityWindows: availabilityData.availabilityWindows,
        futureMeetings: futureMeetings,
      },
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

export const startDemoCall = action({
  args: {
    opportunityId: v.id("client_opportunities"),
    agencyId: v.id("agency_profile"),
    overridePhone: v.string(),
    overrideEmail: v.string(),
  },
  returns: v.object({ callId: v.id("calls"), vapiCallId: v.string() }),
  handler: async (ctx, { opportunityId, agencyId, overridePhone, overrideEmail }) => {
    // Validate inputs
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(overridePhone)) {
      throw new Error("Invalid phone number format. Use E.164 format (e.g., +12025551234)");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(overrideEmail)) {
      throw new Error("Invalid email address");
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required to start a call");
    }

    const customerId = identity.subject;
    const preflight: { allowed: boolean; balance: number; error?: string } = await ctx.runAction(
      internal.call.billing.ensureAiCallCredits,
      { customerId, requiredMinutes: 1 },
    );

    if (!preflight.allowed) {
      throw new Error("Insufficient credits for AI call");
    }

    // Capture initiating user (if authenticated)
    const authUser = await authComponent.getAuthUser(ctx);

    // Load opportunity and agency (note: we DON'T require opportunity.phone for demo)
    const opportunity: Doc<"client_opportunities"> | null = await ctx.runQuery(
      internal.leadGen.queries.getOpportunityById,
      { opportunityId },
    );
    if (!opportunity) throw new Error("Opportunity not found");
    // Note: Skip phone validation - we're using overridePhone instead

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
    const systemContent = buildCallSystemPrompt({
      agency,
      opportunity,
      availabilityData,
      recommendedSlots,
    });

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
        isDemo: true, // Mark as demo in metadata
      },
    };

    // Create DB call row (initiated) with demo overrides
    const callId: Id<"calls"> = await ctx.runMutation(internal.call.calls._createInitiatedCall, {
      opportunityId,
      agencyId,
      dialedNumber: overridePhone, // Use override phone instead of opportunity.phone
      assistantSnapshot: inlineAssistant,
      startedByUserId: authUser?._id as string | undefined,
      startedByEmail: overrideEmail, // Use override email instead of authUser.email
      isDemo: true, // Mark as demo call
      demoOverrides: {
        phone: overridePhone,
        email: overrideEmail,
      },
      metadata: {
        billingCustomerId: customerId,
        aiCallPreflight: {
          requiredMinutes: 1,
          balance: preflight.balance,
          checkedAt: Date.now(),
        },
      },
    });

    // Patch call record with availability metadata
    await ctx.runMutation(internal.call.calls._patchCallMetadata, {
      callId,
      metadata: {
        offeredSlotsISO: recommendedSlots.map((slot: { iso: string }) => slot.iso),
        agencyAvailabilityWindows: availabilityData.availabilityWindows,
        futureMeetings: futureMeetings,
      },
    });

    // Schedule Vapi action to place the call (keeps Node-only code in vapi.ts)
    await ctx.scheduler.runAfter(0, (internal as typeof internal).vapi.startPhoneCall, {
      callId,
      customerNumber: overridePhone, // Use override phone for dialing
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
    startedByUserId: v.optional(v.string()),
    startedByEmail: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
    isDemo: v.optional(v.boolean()),
    demoOverrides: v.optional(v.object({
      phone: v.string(),
      email: v.string(),
    })),
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
      startedByUserId: args.startedByUserId,
      startedByEmail: args.startedByEmail,
      metadata: args.metadata,
      isDemo: args.isDemo,
      demoOverrides: args.demoOverrides,
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
    console.log(`[Attach Vapi Details] Patching call ${args.callId}:`, JSON.stringify({
      vapiCallId: args.vapiCallId,
      phoneNumberId: args.phoneNumberId,
      monitorUrls: args.monitorUrls,
      hasListenUrl: !!args.monitorUrls.listenUrl,
    }));
    
    await ctx.db.patch(args.callId, {
      vapiCallId: args.vapiCallId,
      phoneNumberId: args.phoneNumberId,
      monitorUrls: { listenUrl: args.monitorUrls.listenUrl ?? undefined },
    });
    
    // Verify the patch worked
    const updated = await ctx.db.get(args.callId);
    console.log(`[Attach Vapi Details] Verification - call ${args.callId} now has:`, JSON.stringify({
      hasMonitorUrls: !!updated?.monitorUrls,
      listenUrl: updated?.monitorUrls?.listenUrl,
    }));
    
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

    if (typeof safeBillingSeconds === "number" && safeBillingSeconds > 0) {
      await ctx.scheduler.runAfter(0, internal.call.billing.meterAiCallUsage, {
        callId: record._id,
      });
    }
    return null;
  },
});

// Queries for UI
export const getCallById = query({
  args: { callId: v.id("calls") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get(callId);
    // Log monitor URL info for debugging
    if (call) {
      console.log(`[Get Call] Call ${callId} monitor status:`, JSON.stringify({
        hasMonitorUrls: !!call.monitorUrls,
        hasListenUrl: !!call.monitorUrls?.listenUrl,
        listenUrl: call.monitorUrls?.listenUrl ? 'present' : 'missing',
      }));
    }
    return call;
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

export const getCallsByAgency = query({
  args: { agencyId: v.id("agency_profile") },
  returns: v.array(v.any()),
  handler: async (ctx, { agencyId }) => {
    const rows = await ctx.db
      .query("calls")
      .withIndex("by_agency", (q) => q.eq("agencyId", agencyId))
      .order("desc")
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

export const _patchCallMetadata = internalMutation({
  args: {
    callId: v.id("calls"),
    metadata: v.record(v.string(), v.any()),
  },
  returns: v.null(),
  handler: async (ctx, { callId, metadata }) => {
    const existing = await ctx.db.get(callId);
    if (!existing) return null;
    const currentMetadata = (existing.metadata ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...currentMetadata, ...metadata };
    await ctx.db.patch(callId, { metadata: merged });
    return null;
  },
});


