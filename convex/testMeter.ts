"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { autumn } from "./autumn";

export const testLeadDiscoveryMeter = action({
  args: {},
  returns: v.object({
    ok: v.boolean(),
    allowed: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    // Step 1: Pre-run check to ensure the customer can use 1 unit of lead_discovery
    const { data: checkData, error: checkError } = await autumn.check(ctx, {
      featureId: "lead_discovery",
    });
    console.log('checkData', checkData);

    if (checkError) {
      console.error("Autumn check error:", checkError);
      return { ok: false, allowed: false, message: "Check failed" };
    }

    const allowed = Boolean(checkData?.allowed);
    if (!allowed) {
      return { ok: false, allowed: false, message: "Insufficient credits or access denied" };
    }

    // Step 2: Do any pre-metering work (just logging for this test)
    console.log("Pre-meter log: About to meter 1 credit for lead_discovery");

    // Step 3: Track usage of 1 credit for lead_discovery
    const { error: trackError } = await autumn.track(ctx, {
      featureId: "lead_discovery",
      value: 1,
    });

    if (trackError) {
      console.error("Autumn track error:", trackError);
      return { ok: false, allowed: true, message: "Track failed" };
    }

    return { ok: true, allowed: true, message: "Metered 1 credit for lead_discovery" };
  },
});


