"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { Autumn } from "@useautumn/convex";
import { components } from "../_generated/api";
import { internal } from "../_generated/api";

type EnsureCreditsResult = {
  allowed: boolean;
  balance: number;
  error?: string;
};

const FEATURE_ID = "ai_call_minutes" as const;

function createBillingClient(customerId: string) {
  return new Autumn(components.autumn, {
    secretKey: process.env.AUTUMN_SECRET_KEY ?? "",
    identify: () => ({ customerId }),
  });
}

export const ensureAiCallCredits = internalAction({
  args: {
    customerId: v.string(),
    requiredMinutes: v.optional(v.number()),
  },
  returns: v.object({
    allowed: v.boolean(),
    balance: v.number(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<EnsureCreditsResult> => {
    const requiredMinutes = Math.max(1, Math.ceil(args.requiredMinutes ?? 1));
    const billingClient = createBillingClient(args.customerId);

    const { data, error } = await billingClient.check(ctx, {
      featureId: FEATURE_ID,
    });

    if (error) {
      console.error("[AI Call Billing] Failed to check credits", error);
      return { allowed: false, balance: 0, error: String(error) };
    }

    const balance = typeof data?.balance === "number" ? data.balance : 0;
    const allowed = Boolean(data?.allowed) && balance >= requiredMinutes;

    return { allowed, balance, error: undefined };
  },
});

export const meterAiCallUsage = internalAction({
  args: {
    callId: v.id("calls"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const call = await ctx.runQuery(internal.call.calls.getCallByIdInternal, {
      callId: args.callId,
    });

    if (!call) {
      console.warn("[AI Call Billing] Call not found", args.callId);
      return null;
    }

    const metadata = (call.metadata ?? {}) as Record<string, unknown>;
    const existingMetering = metadata.aiCallMetering as
      | {
          trackedAt?: number;
        }
      | undefined;
    if (existingMetering?.trackedAt) {
      return null;
    }

    const billingSeconds = typeof call.billingSeconds === "number" ? call.billingSeconds : 0;
    if (billingSeconds <= 0) {
      return null;
    }

    const billingCustomerId = metadata.billingCustomerId as string | undefined;
    if (!billingCustomerId) {
      console.warn("[AI Call Billing] Missing billingCustomerId metadata", call._id);
      return null;
    }

    const requestedMinutes = Math.max(0, Math.ceil(billingSeconds / 60));
    if (requestedMinutes === 0) {
      return null;
    }

    const billingClient = createBillingClient(billingCustomerId);
    const { data, error } = await billingClient.check(ctx, {
      featureId: FEATURE_ID,
    });

    if (error) {
      console.error("[AI Call Billing] Failed to refresh balance", error);
      return null;
    }

    const balance = typeof data?.balance === "number" ? data.balance : 0;
    const billableMinutes = Math.min(requestedMinutes, Math.max(0, Math.floor(balance)));
    const trackedAt = Date.now();

    if (billableMinutes > 0) {
      const { error: trackError } = await billingClient.track(ctx, {
        featureId: FEATURE_ID,
        value: billableMinutes,
      });

      if (trackError) {
        console.error("[AI Call Billing] Failed to track usage", trackError);
        return null;
      }
    }

    const nextMetadata = {
      ...metadata,
      aiCallMetering: {
        requestedMinutes,
        billedMinutes: billableMinutes,
        balanceAtCheck: balance,
        trackedAt,
      },
    } satisfies Record<string, unknown>;

    await ctx.runMutation(internal.call.calls._patchCallMetadata, {
      callId: args.callId,
      metadata: nextMetadata,
    });

    return null;
  },
});


