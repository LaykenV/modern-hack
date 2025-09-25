"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

type InlineAssistant = {
  name: string;
  model: {
    provider: string;
    model: string;
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  };
  voice: { provider: string; voiceId: string; model?: string };
  transcriber?: { provider: string; model: string };
  firstMessageMode?: "assistant-speaks-first" | "customer-speaks-first";
  server: { url: string; secret: string };
  serverMessages?: Array<
    | { type: "status-update" }
    | { type: "speech-update" }
    | { type: "transcript" }
    | { type: "end-of-call-report" }
  >;
  metadata?: Record<string, unknown>;
};

type CreateCallResponse = {
  id: string;
  monitor?: { listenUrl?: string };
};

async function createPhoneCall(
  token: string,
  phoneNumberId: string,
  customerNumber: string,
  inlineAssistant: InlineAssistant,
): Promise<CreateCallResponse> {
  const res = await fetch("https://api.vapi.ai/call/phone", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phoneNumberId,
      customer: { number: customerNumber },
      squad: { members: [{ assistant: inlineAssistant }] },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vapi create call failed (${res.status}): ${text}`);
  }
  return (await res.json()) as CreateCallResponse;
}

export const startPhoneCall = internalAction({
  args: {
    callId: v.id("calls"),
    customerNumber: v.string(),
    assistant: v.object({
      name: v.string(),
      model: v.object({
        provider: v.string(),
        model: v.string(),
        messages: v.array(
          v.object({
            role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant")),
            content: v.string(),
          }),
        ),
      }),
      voice: v.object({ provider: v.string(), voiceId: v.string(), model: v.optional(v.string()) }),
      transcriber: v.optional(v.object({ provider: v.string(), model: v.string() })),
      firstMessageMode: v.optional(v.union(v.literal("assistant-speaks-first"), v.literal("customer-speaks-first"))),
      serverMessages: v.optional(
        v.array(
          v.union(
            v.object({ type: v.literal("status-update") }),
            v.object({ type: v.literal("speech-update") }),
            v.object({ type: v.literal("transcript") }),
            v.object({ type: v.literal("end-of-call-report") }),
          ),
        ),
      ),
      metadata: v.optional(v.record(v.string(), v.any())),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { callId, customerNumber, assistant }) => {
    const token = process.env.VAPI_API_KEY ?? "";
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID ?? "";
    const SITE_URL = process.env.SITE_URL ?? "";
    const WEBHOOK_SECRET = process.env.VAPI_WEBHOOK_SECRET ?? "";
    if (!token || !phoneNumberId) throw new Error("Missing Vapi env configuration");
    if (!SITE_URL || !WEBHOOK_SECRET) throw new Error("Missing SITE_URL or VAPI_WEBHOOK_SECRET");

    // Inject secure server config only in Node runtime
    const inlineAssistant: InlineAssistant = {
      ...assistant,
      server: { url: `${SITE_URL}/api/vapi-webhook`, secret: WEBHOOK_SECRET },
      serverMessages: assistant.serverMessages ?? [
        { type: "status-update" },
        { type: "transcript" },
        { type: "end-of-call-report" },
      ],
    } as InlineAssistant;

    const response = await createPhoneCall(token, phoneNumberId, customerNumber, inlineAssistant);
    await ctx.runMutation((internal as typeof internal).calls._attachVapiDetails, {
      callId,
      vapiCallId: response.id,
      phoneNumberId,
      monitorUrls: { listenUrl: response.monitor?.listenUrl ?? null },
    });
    return null;
  },
});


