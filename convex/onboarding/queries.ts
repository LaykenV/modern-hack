import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { authComponent } from "../auth";
import { paginationOptsValidator } from "convex/server";
import { internal } from "../_generated/api";
import { calculateOverallProgress } from "./statusUtils";
// EventTypes no longer needed with simplified event model

export const listFlowPages = internalQuery({
  args: { onboardingFlowId: v.id("onboarding_flow") },
  returns: v.array(v.object({ url: v.string(), title: v.optional(v.string()) })),
  handler: async (ctx, args) => {
    const { onboardingFlowId } = args;
    const rows = await ctx.db
      .query("crawl_pages")
      .withIndex("by_flow", (q) => q.eq("onboardingFlowId", onboardingFlowId))
      .collect();
    return rows.map((r) => ({ url: r.url, title: r.title ?? undefined }));
  },
});

// Internal: Compute dynamic counts from crawl_pages status
export const getFlowCounts = internalQuery({
  args: { onboardingFlowId: v.id("onboarding_flow") },
  returns: v.object({
    discoveredCount: v.number(),
    scrapedCount: v.number(),
    failedCount: v.number(),
    queuedCount: v.number(),
    fetchingCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("crawl_pages")
      .withIndex("by_flow", (q) => q.eq("onboardingFlowId", args.onboardingFlowId))
      .collect();
    
    const counts = {
      discoveredCount: pages.length,
      scrapedCount: pages.filter(p => p.status === "scraped").length,
      failedCount: pages.filter(p => p.status === "failed").length,
      queuedCount: pages.filter(p => p.status === "queued").length,
      fetchingCount: pages.filter(p => p.status === "fetching").length,
    };
    
    return counts;
  },
});

// Public: Paginated list of crawl pages for UI
export const listCrawlPages = query({
  args: { onboardingFlowId: v.id("onboarding_flow"), paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        url: v.string(),
        title: v.optional(v.string()),
        status: v.union(v.literal("queued"), v.literal("fetching"), v.literal("scraped"), v.literal("failed")),
        httpStatus: v.optional(v.number()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const { onboardingFlowId, paginationOpts } = args;
    const flow = await ctx.db.get(onboardingFlowId);
    const user = await authComponent.getAuthUser(ctx);
    if (!user || flow?.userId !== user._id) throw new Error("Forbidden");
    const result = await ctx.db
      .query("crawl_pages")
      .withIndex("by_flow", (q) => q.eq("onboardingFlowId", onboardingFlowId))
      .order("desc")
      .paginate(paginationOpts);
    return {
      page: result.page.map((r) => ({ url: r.url, title: r.title ?? undefined, status: r.status, httpStatus: r.httpStatus })),
      isDone: result.isDone,
      continueCursor: result.continueCursor ?? null,
    };
  },
});

// Public: Get onboarding flow by id with simplified structure
export const getOnboardingFlow = query({
  args: { onboardingFlowId: v.id("onboarding_flow") },
  returns: v.object({
    _id: v.id("onboarding_flow"),
    userId: v.string(),
    sellerBrainId: v.id("seller_brain"),
    companyName: v.string(),
    sourceUrl: v.string(),
    status: v.union(v.literal("idle"), v.literal("running"), v.literal("error"), v.literal("completed")),
    phases: v.array(v.object({
      name: v.union(
        v.literal("crawl"),
        v.literal("filter"),
        v.literal("scrape"),
        v.literal("summary"),
        v.literal("claims"),
        v.literal("verify"),
      ),
      status: v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("complete"),
        v.literal("error"),
      ),
      progress: v.number(),
      errorMessage: v.optional(v.string()),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
    })),
    counts: v.object({
      discoveredCount: v.number(),
      scrapedCount: v.number(),
      failedCount: v.number(),
      queuedCount: v.number(),
      fetchingCount: v.number(),
    }),
    fastThreadId: v.optional(v.string()),
    smartThreadId: v.optional(v.string()),
    relevantPages: v.optional(v.array(v.string())),
    lastEvent: v.optional(v.object({
      type: v.string(),
      message: v.string(),
      timestamp: v.number(),
    })),
  }),
  handler: async (ctx, args) => {
    const { onboardingFlowId } = args;
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) throw new Error("Onboarding flow not found");
    const user = await authComponent.getAuthUser(ctx);
    if (!user || flow.userId !== user._id) throw new Error("Forbidden");
    
    // Compute counts dynamically
    const counts: {
      discoveredCount: number;
      scrapedCount: number;
      failedCount: number;
      queuedCount: number;
      fetchingCount: number;
    } = await ctx.runQuery(internal.onboarding.queries.getFlowCounts, { onboardingFlowId });
    
    return {
      _id: flow._id,
      userId: flow.userId,
      sellerBrainId: flow.sellerBrainId,
      companyName: flow.companyName,
      sourceUrl: flow.sourceUrl,
      status: flow.status,
      phases: flow.phases,
      counts,
      fastThreadId: flow.fastThreadId,
      smartThreadId: flow.smartThreadId,
      relevantPages: flow.relevantPages,
      lastEvent: flow.lastEvent,
    };
  },
});

// Public: Get the latest event from the flow (embedded in flow document)
export const getLatestEvent = query({
  args: { onboardingFlowId: v.id("onboarding_flow") },
  returns: v.union(
    v.null(),
    v.object({
      type: v.string(),
      message: v.string(),
      timestamp: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const { onboardingFlowId } = args;
    const flow = await ctx.db.get(onboardingFlowId);
    const user = await authComponent.getAuthUser(ctx);
    if (!user || flow?.userId !== user._id) throw new Error("Forbidden");
    return flow?.lastEvent ?? null;
  },
});

// Public: Get overall progress as a single number (0-1)
export const getOverallProgress = query({
  args: { onboardingFlowId: v.id("onboarding_flow") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { onboardingFlowId } = args;
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) throw new Error("Onboarding flow not found");
    
    const user = await authComponent.getAuthUser(ctx);
    if (!user || flow.userId !== user._id) throw new Error("Forbidden");
    
    return calculateOverallProgress(flow.phases);
  },
});


