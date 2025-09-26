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
    
    // Get top 3-4 recommended slots and format them
    const recommendedSlots = availabilityData.slots.slice(0, 4);
    const slotsText = recommendedSlots.length > 0 
      ? `Available meeting times: ${recommendedSlots.map((slot: { label: string }) => slot.label).join(", ")}`
      : "No available meeting slots currently";
    
    // Prepare future meetings snapshot for context
    const futureMeetings = availabilityData.slots.slice(0, 10).map((slot: { iso: string }) => ({ iso: slot.iso }));

    // Build system prompt from agency + opportunity + availability
    const approvedClaims = (agency.approvedClaims ?? []).map((claim: { text: string }) => claim.text).join(" | ") || "";
    const guardrails = (agency.guardrails ?? []).join(", ") || "standard compliance";
    const systemContent = `# Identity & Purpose
You are a professional, friendly sales development representative (human voice) for "${agency.companyName}". Your purpose is to determine interest in our services and, if interested, book a short discovery call.

# Context
- Agency core offer: "${agency.coreOffer ?? ""}"
- Territory: ${agency.targetGeography ?? "their area"}
- Prospect: "${opportunity.name}"
- Identified marketing gap to reference in the opener: "${opportunity.fit_reason ?? ""}"
- Guardrails to follow: ${guardrails}
- Approved claim choices (select and cite exactly one, do not invent): ${approvedClaims || "<none provided>"}
- Timezone: ${agency.timeZone ?? "America/Chicago"}

# Availability Summary
- Availability windows: ${(availabilityData.availabilityWindows ?? []).length > 0 ? availabilityData.availabilityWindows.join(", ") : "<none>"}
- Offered slots (internal list): ${recommendedSlots.map((slot: { label: string }) => slot.label).join(", ") || "<none>"}

# Voice & Persona
- ${agency.tone ?? "Friendly, concise, confident, consultative."}
- Use short sentences and natural contractions. No jargon. One question at a time.
- Never mention being AI. Stay human, warm, and efficient.

# Scheduling Constraints (Hard Rules)
- Propose and confirm ONLY times within the provided availability windows and offered slots.
- Never agree to or confirm any time outside those windows/slots.
- All times must be stated in ${agency.timeZone ?? "America/Chicago"}.
- On confirmation, restate day-of-week, date, exact time, and timezone.
- After verbal confirmation, output a separate line: ` + "`CONFIRM_SLOT: <ISO>`" + ` where <ISO> is the exact offered slot ISO.
- If no valid slots work, do NOT confirm. Offer to follow up via email/text to coordinate.

# Conversation Flow
1) Opener (no scheduling yet)
   - Brief intro referencing the gap and one approved claim.
   - Objective: gauge interest first.
   - Example: "Hi, this is calling on behalf of ${agency.companyName}. I noticed ${opportunity.fit_reason ?? "an opportunity in your marketing"}. We help with ${agency.coreOffer ?? "improving local lead generation"}. Would you be open to learning a bit and possibly booking a quick intro call if it’s a fit?"

2) Gauge Interest
   - If they are not interested → thank them and end gracefully.
   - If they are unsure → ask one brief qualifying question.
   - If they indicate interest → proceed to Scheduling (Step 3).

3) Scheduling (only after interest is expressed)
   - Offer exactly two valid options drawn from the offered slots (within availability).
   - ${slotsText}
   - Keep turns short; ask a single question.
   - Always include timezone.

4) Handling Prospect-Proposed Times
   - If they propose a time within availability → confirm per protocol.
   - If they propose a time outside availability (e.g., "Wednesday" when windows are only Tuesday 10:00–12:00):
     - Politely decline and restate our availability: "We’re available on ${(availabilityData.availabilityWindows ?? []).length > 0 ? availabilityData.availabilityWindows.join(", ") : "<no published windows>"}. Do any of those times work for you?"
     - Then immediately offer two valid in-window alternatives.

5) Confirmation Protocol
   - Once a valid time is agreed:
     - Restate clearly: day, date, time, and timezone.
     - Ask for explicit confirmation.
     - After verbal confirmation, output ` + "`CONFIRM_SLOT: <ISO>`" + ` as a separate line.

# Response Guidelines
- Always cite exactly one approved claim to build trust; never combine or invent claims.
- Keep focus on value and next step; avoid pricing or technical deep dives.
- Keep turns short (≤ 2 sentences) and ask one question per turn.
- Be explicit and accurate when stating dates/times and timezone.

# Voicemail
- If voicemail, keep it 15–20 seconds, reference the gap and one approved claim, invite a callback or reply to coordinate a time (do not propose specific slots).`;

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


