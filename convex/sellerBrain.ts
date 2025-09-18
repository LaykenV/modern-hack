import { v } from "convex/values";
import { query, internalMutation, action, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { authComponent } from "./auth";

const ClaimsValidator = v.array(
  v.object({
    id: v.string(),
    text: v.string(),
    source_url: v.string(),
  }),
);

export const getForCurrentUser = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      userId: v.string(),
      companyName: v.string(),
      sourceUrl: v.string(),
      summary: v.optional(v.string()),
      approvedClaims: v.optional(ClaimsValidator),
      guardrails: v.optional(v.array(v.string())),
      tone: v.optional(v.string()),
      timeZone: v.optional(v.string()),
      availability: v.optional(v.array(v.string())),
      icpIndustry: v.optional(v.array(v.string())),
      icpCompanySize: v.optional(v.array(v.string())),
      icpBuyerRole: v.optional(v.array(v.string())),
      crawlStatus: v.union(
        v.literal("idle"),
        v.literal("crawling"),
        v.literal("seeded"),
        v.literal("error"),
        v.literal("approved"),
      ),
      crawlError: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    const existing = await ctx.db
      .query("seller_brain")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!existing) return null;

    return {
      userId: existing.userId,
      companyName: existing.companyName,
      sourceUrl: existing.sourceUrl,
      summary: existing.summary ?? undefined,
      approvedClaims: existing.approvedClaims ?? undefined,
      guardrails: existing.guardrails ?? undefined,
      tone: existing.tone ?? undefined,
      timeZone: existing.timeZone ?? undefined,
      availability: existing.availability ?? undefined,
      icpIndustry: existing.icpIndustry ?? undefined,
      icpCompanySize: existing.icpCompanySize ?? undefined,
      icpBuyerRole: existing.icpBuyerRole ?? undefined,
      crawlStatus: existing.crawlStatus,
      crawlError: existing.crawlError ?? undefined,
    };
  },
});

export const saveSellerBrain = internalMutation({
  args: {
    companyName: v.string(),
    sourceUrl: v.string(),
    summary: v.optional(v.string()),
    approvedClaims: v.optional(ClaimsValidator),
    guardrails: v.optional(v.array(v.string())),
    tone: v.optional(v.string()),
    timeZone: v.optional(v.string()),
    availability: v.optional(v.array(v.string())),
    icpIndustry: v.optional(v.array(v.string())),
    icpCompanySize: v.optional(v.array(v.string())),
    icpBuyerRole: v.optional(v.array(v.string())),
    crawlStatus: v.optional(
      v.union(
        v.literal("idle"),
        v.literal("crawling"),
        v.literal("seeded"),
        v.literal("error"),
        v.literal("approved"),
      ),
    ),
    crawlError: v.optional(v.string()),
  },
  returns: v.object({ sellerBrainId: v.id("seller_brain") }),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("seller_brain")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!existing) {
      const id = await ctx.db.insert("seller_brain", {
        userId: user._id,
        companyName: args.companyName,
        sourceUrl: args.sourceUrl,
        summary: args.summary,
        approvedClaims: args.approvedClaims,
        guardrails: args.guardrails,
        tone: args.tone,
        timeZone: args.timeZone,
        availability: args.availability,
        icpIndustry: args.icpIndustry,
        icpCompanySize: args.icpCompanySize,
        icpBuyerRole: args.icpBuyerRole,
        crawlStatus: args.crawlStatus ?? "idle",
        crawlError: args.crawlError,
      });
      return { sellerBrainId: id };
    }

    const update: Record<string, unknown> = {};
    // Always allow updating these base fields
    update.companyName = args.companyName;
    update.sourceUrl = args.sourceUrl;
    if (typeof args.summary !== "undefined") update.summary = args.summary;
    if (typeof args.approvedClaims !== "undefined") update.approvedClaims = args.approvedClaims;
    if (typeof args.guardrails !== "undefined") update.guardrails = args.guardrails;
    if (typeof args.tone !== "undefined") update.tone = args.tone;
    if (typeof args.timeZone !== "undefined") update.timeZone = args.timeZone;
    if (typeof args.availability !== "undefined") update.availability = args.availability;
    if (typeof args.icpIndustry !== "undefined") update.icpIndustry = args.icpIndustry;
    if (typeof args.icpCompanySize !== "undefined") update.icpCompanySize = args.icpCompanySize;
    if (typeof args.icpBuyerRole !== "undefined") update.icpBuyerRole = args.icpBuyerRole;
    if (typeof args.crawlStatus !== "undefined") update.crawlStatus = args.crawlStatus;
    if (typeof args.crawlError !== "undefined") update.crawlError = args.crawlError;

    await ctx.db.patch(existing._id, update);
    return { sellerBrainId: existing._id };
  },
});

export const seedFromWebsite = action({
  args: {
    companyName: v.string(),
    sourceUrl: v.string(),
  },
  returns: v.object({ sellerBrainId: v.id("seller_brain") }),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized");

    // Mark as crawling first
    const first: { sellerBrainId: Id<"seller_brain"> } = await ctx.runMutation(
      internal.sellerBrain.saveSellerBrain,
      {
      companyName: args.companyName,
      sourceUrl: args.sourceUrl,
      crawlStatus: "crawling",
      crawlError: undefined,
      },
    );

    try {
      // Placeholder ingest (no Firecrawl yet)
      const summary = `Seeded placeholder summary for ${args.companyName} from ${args.sourceUrl}.`;
      const approvedClaims = [
        {
          id: "claim-1",
          text: `${args.companyName} offers reliable AI sales agent tooling with cited responses.`,
          source_url: args.sourceUrl,
        },
        {
          id: "claim-2",
          text: `All messaging is grounded in your approved claims to prevent hallucinations.`,
          source_url: args.sourceUrl,
        },
        {
          id: "claim-3",
          text: `Simple onboarding: paste your site and approve claims.`,
          source_url: args.sourceUrl,
        },
      ];

      const _resultSeeded: { sellerBrainId: Id<"seller_brain"> } = await ctx.runMutation(
        internal.sellerBrain.saveSellerBrain,
        {
        companyName: args.companyName,
        sourceUrl: args.sourceUrl,
        summary,
        approvedClaims,
        crawlStatus: "seeded",
        crawlError: undefined,
        },
      );
      console.log(_resultSeeded);
    } catch (err) {
      const message =
        typeof err === "object" && err && "message" in err
          ? String((err as { message?: unknown }).message)
          : "Seeding failed";
      const _resultError: { sellerBrainId: Id<"seller_brain"> } = await ctx.runMutation(
        internal.sellerBrain.saveSellerBrain,
        {
        companyName: args.companyName,
        sourceUrl: args.sourceUrl,
        crawlStatus: "error",
        crawlError: message,
        },
      );
      console.error(message, _resultError);
    }

    return { sellerBrainId: first.sellerBrainId };
  },
});

export const finalizeOnboarding = internalMutation({
  args: {
    approvedClaims: ClaimsValidator,
    guardrails: v.array(v.string()),
    tone: v.string(),
    icpIndustry: v.array(v.string()),
    icpCompanySize: v.array(v.string()),
    icpBuyerRole: v.array(v.string()),
    timeZone: v.string(),
    availability: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const existing = await ctx.db
      .query("seller_brain")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (!existing) throw new Error("Seller brain not found");

    await ctx.db.patch(existing._id, {
      approvedClaims: args.approvedClaims,
      guardrails: args.guardrails,
      tone: args.tone,
      icpIndustry: args.icpIndustry,
      icpCompanySize: args.icpCompanySize,
      icpBuyerRole: args.icpBuyerRole,
      timeZone: args.timeZone,
      availability: args.availability,
      crawlStatus: "approved",
      crawlError: undefined,
    });
    return null;
  },
});

export const finalizeOnboardingPublic = mutation({
  args: {
    approvedClaims: ClaimsValidator,
    guardrails: v.array(v.string()),
    tone: v.string(),
    icpIndustry: v.array(v.string()),
    icpCompanySize: v.array(v.string()),
    icpBuyerRole: v.array(v.string()),
    timeZone: v.string(),
    availability: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.sellerBrain.finalizeOnboarding, args);
    return null;
  },
});


