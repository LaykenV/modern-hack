import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Verify Vapi webhook either via shared secret header or HMAC-SHA256 of body
async function verifyVapiSignature(body: ArrayBuffer, signature: string | null, secretHeader: string | null): Promise<boolean> {
  try {
    const secret = process.env.VAPI_WEBHOOK_SECRET ?? "";
    if (!secret) return false;
    // Prefer simple shared secret header if provided by Vapi
    if (secretHeader && secretHeader.trim() === secret) return true;
    // Fallback to HMAC hex digest verification if header present
    if (!signature) return false;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, body);
    const digestHex = Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return signature.trim() === digestHex;
  } catch {
    return false;
  }
}

const vapiWebhook = httpAction(async (ctx, req) => {
  const bodyBytes = await req.arrayBuffer();
  const signature = req.headers.get("X-Vapi-Signature");
  // Vapi may send either X-Vapi-Secret (shared secret) or X-Vapi-Signature (HMAC)
  const shared = req.headers.get("X-Vapi-Secret");
  const ok = await verifyVapiSignature(bodyBytes, signature, shared);
  if (!ok) return new Response("unauthorized", { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(bodyBytes));
  } catch {
    return new Response("bad request", { status: 400 });
  }

  try {
    type TranscriptMessage = { role?: string; text?: string };
    type VapiWebhookPayload = {
      type?: string;
      call?: { id?: string };
      id?: string;
      callId?: string;
      status?: string;
      data?: {
        status?: string;
        text?: string;
        messages?: TranscriptMessage[];
        summary?: string;
        recordingUrl?: string;
        endedReason?: string;
        billingSeconds?: number;
      };
      from?: string;
      text?: string;
      messages?: TranscriptMessage[];
      summary?: string;
      recordingUrl?: string;
      endedReason?: string;
      billingSeconds?: number;
      // transcript-specific single fragment
      transcript?: string;
      transcriptType?: "partial" | "final" | string;
      role?: string;
    };

    // Type guard for envelope shape
    function hasMessageEnvelope(input: unknown): input is { message: unknown } {
      return typeof input === "object" && input !== null && "message" in (input as Record<string, unknown>);
    }

    // Unwrap Vapi's message envelope when present
    const raw: unknown = payload as unknown;
    const p: VapiWebhookPayload = hasMessageEnvelope(raw)
      ? ((raw as { message: unknown }).message as VapiWebhookPayload)
      : ((raw as VapiWebhookPayload));

    const type = p?.type;
    const headerCallId = req.headers.get("X-Call-Id");
    const vapiCallId: string | undefined = p?.call?.id ?? p?.id ?? p?.callId ?? headerCallId ?? undefined;

    if (!type || !vapiCallId) {
      // Guard: missing required identifiers; log once and return fast
      console.warn("[Vapi Webhook] Missing type or call id", { type, callHeader: headerCallId });
      return new Response("ok", { status: 200 });
    }

    switch (type) {
      case "status-update": {
        const status = p?.status ?? p?.data?.status ?? "unknown";
        await ctx.runMutation(internal.calls.updateStatusFromWebhook, { vapiCallId, status });
        break;
      }
      case "speech-update": {
        const fragment = {
          role: p?.from ?? "assistant",
          text: p?.text ?? p?.data?.text ?? "",
          timestamp: Date.now(),
          source: "speech",
        } as { role: string; text: string; timestamp?: number; source?: string };
        await ctx.runMutation(internal.calls.appendTranscriptChunk, { vapiCallId, fragment });
        break;
      }
      case "transcript": {
        const messages = (p?.messages ?? p?.data?.messages ?? []) as TranscriptMessage[];
        if (Array.isArray(messages) && messages.length > 0) {
          for (const m of messages) {
            const fragment = {
              role: m.role ?? "assistant",
              text: m.text ?? "",
              timestamp: Date.now(),
              source: "transcript",
            } as { role: string; text: string; timestamp?: number; source?: string };
            await ctx.runMutation(internal.calls.appendTranscriptChunk, { vapiCallId, fragment });
          }
        } else if (typeof p?.transcript === "string") {
          // Drop partial single-fragment transcripts; accept only finals
          if (p?.transcriptType === "partial") {
            break;
          }
          const fragment = {
            role: (p?.role as string | undefined) ?? "assistant",
            text: p.transcript,
            timestamp: Date.now(),
            source: "transcript",
          } as { role: string; text: string; timestamp?: number; source?: string };
          await ctx.runMutation(internal.calls.appendTranscriptChunk, { vapiCallId, fragment });
        }
        break;
      }
      case "end-of-call-report": {
        const summary = (p?.summary as string | undefined) ?? p?.data?.summary;
        const recordingUrl = (p?.recordingUrl as string | undefined) ?? p?.data?.recordingUrl;
        const endedReason = (p?.endedReason as string | undefined) ?? p?.data?.endedReason;
        const billingSeconds = (p?.billingSeconds as number | undefined) ?? p?.data?.billingSeconds;
        await ctx.runMutation(internal.calls.finalizeReport, {
          vapiCallId,
          summary,
          recordingUrl,
          endedReason,
          billingSeconds,
          messages: (p?.messages ?? p?.data?.messages ?? []) as unknown[],
        });
        break;
      }
      default: {
        // ignore unknown types for now
        break;
      }
    }
  } catch (err) {
    console.error("[Vapi Webhook] Error:", err);
  }

  return new Response("ok", { status: 200 });
});

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({ path: "/api/vapi-webhook", method: "POST", handler: vapiWebhook });

export default http;


