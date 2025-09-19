import { internalMutation, internalAction, query } from "../_generated/server";
import { v } from "convex/values";
// Phase status updates are now handled by the workflow
import { atlasAgent } from "../agent";
import { authComponent } from "../auth";
import { components } from "../_generated/api";
import { listMessages, syncStreams, extractText, vStreamArgs } from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { internal } from "../_generated/api";
import { normalizeUrl } from "./contentUtils";

export const markSummaryStreamingStarted = internalMutation({
  args: { onboardingFlowId: v.id("onboarding_flow") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { onboardingFlowId } = args;
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) throw new Error("Flow not found");
    // Phase status updates are now handled by the workflow
      return null;
  },
});

export const streamSummary = internalAction({
  args: { 
    onboardingFlowId: v.id("onboarding_flow"), 
    smartThreadId: v.string(), 
    companyName: v.string(), 
    sourceUrl: v.string(), 
    contextUrls: v.array(v.string()) 
  },
  returns: v.null(),
  handler: async (ctx, args) => {
  const { onboardingFlowId, smartThreadId, companyName, sourceUrl, contextUrls } = args;
    await ctx.runMutation(internal.onboarding.summary.markSummaryStreamingStarted, { onboardingFlowId });
    const prompt = `Create a concise, accurate company overview for ${companyName} (${sourceUrl}). Cite sources as [n] mapped to these URLs (in importance order):\n${contextUrls.slice(0, 10).map((u, i) => `[${i + 1}] ${u}`).join("\n")}`;
    await atlasAgent.streamText(
      ctx,
      { threadId: smartThreadId },
      { prompt },
      { saveStreamDeltas: true },
    );
      return null;
  },
});

export const finalizeSummary = internalAction({
  args: { smartThreadId: v.string() },
  returns: v.object({ summary: v.string() }),
  handler: async (ctx, args) => {
  const { smartThreadId } = args;
    const messages = await listMessages(ctx, components.agent, {
      threadId: smartThreadId,
      excludeToolMessages: true,
      paginationOpts: { cursor: null, numItems: 50 },
    });
    let summary = "";
    const page = (messages as unknown as { page?: Array<{ message: { role: "assistant" | "user" | "system"; content: unknown } }> }).page ?? [];
    const latestAssistant = [...page].reverse().find((m) => m.message.role === "assistant");
    if (latestAssistant) {
      const msg = latestAssistant.message as unknown as Parameters<typeof extractText>[0];
      summary = extractText(msg) ?? "";
    }
      return { summary };
  },
});

export const generateSummary = internalAction({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    companyName: v.string(),
    sourceUrl: v.string(),
    pageUrls: v.array(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
  const { companyName, sourceUrl, pageUrls } = args;
    const pagesSnippet = pageUrls.slice(0, 5).map((u, i) => `[${i + 1}] ${u}`).join("\n");
    const summary = `Company: ${companyName}\nWebsite: ${sourceUrl}\n\nOverview:\n${companyName} provides products and services documented on the following pages:\n${pagesSnippet}\n\nThis is an automatically generated initial summary.`;
      return summary;
  },
});

export const saveSummaryAndSeed = internalMutation({
  args: {
    sellerBrainId: v.id("seller_brain"),
    onboardingFlowId: v.id("onboarding_flow"),
    summary: v.string(),
    pagesList: v.optional(
      v.array(v.object({ url: v.string(), title: v.optional(v.string()), category: v.optional(v.string()) })),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { sellerBrainId, onboardingFlowId, summary, pagesList } = args;
    
    // Compute enriched pagesList if not provided
    let finalPagesList: Array<{ url: string; title?: string; category?: string }> = pagesList ?? [];
    if (!pagesList || pagesList.length === 0) {
      const flow = await ctx.db.get(onboardingFlowId);
      const relevantUrls: Array<string> = (flow?.relevantPages ?? []) as Array<string>;
      // Deduplicate while preserving order
      const seen = new Set<string>();
      const orderedUnique = relevantUrls.filter((u) => {
        const n = normalizeUrl(u);
        if (seen.has(n)) return false;
        seen.add(n);
        return true;
      });

      function categorize(url: string): string | undefined {
        const lower = url.toLowerCase();
        if (/\/docs|documentation|developers\//.test(lower)) return "docs";
        if (/\/pricing\//.test(lower) || /\/pricing$/.test(lower)) return "pricing";
        if (/\/product|platform|features|solutions|use-cases\//.test(lower)) return "product";
        if (/\/about|company\//.test(lower)) return "about";
        return undefined;
      }

      const enriched: Array<{ url: string; title?: string; category?: string }> = [];
      for (const url of orderedUnique) {
        const nurl = normalizeUrl(url);
        const existing = await ctx.db
          .query("crawl_pages")
          .withIndex("by_flow_and_url", (q) => q.eq("onboardingFlowId", onboardingFlowId).eq("url", nurl))
          .unique();
        enriched.push({ url: nurl, title: existing?.title ?? undefined, category: categorize(nurl) });
      }
      finalPagesList = enriched;
    }

    await ctx.db.patch(sellerBrainId, {
      summary,
      pagesList: finalPagesList,
    });
    // Phase status updates are now handled by the workflow
    return null;
  },
});

export const listSummaryMessages = query({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  returns: v.object({
    page: v.array(v.any()),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    streams: v.object({
      deltas: v.array(v.any()),
      hasActiveStream: v.boolean(),
    }),
  }),
  handler: async (ctx, args) => {
    const flow = await ctx.db.get(args.onboardingFlowId);
    const user = await authComponent.getAuthUser(ctx);
    if (!flow || !user || flow.userId !== user._id) throw new Error("Forbidden");
    if (flow.smartThreadId !== args.threadId) throw new Error("Forbidden");
    const agentArgs = {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
      streamArgs: args.streamArgs,
    };
    const paginated = await listMessages(ctx, components.agent, agentArgs);
    const rawStreams = await syncStreams(ctx, components.agent, agentArgs);
    const shapedStreams = {
      deltas: Array.isArray((rawStreams as unknown as { deltas?: Array<unknown> }).deltas)
        ? (rawStreams as unknown as { deltas: Array<unknown> }).deltas
        : [],
      hasActiveStream: Boolean(
        (rawStreams as unknown as { hasActiveStream?: boolean }).hasActiveStream ??
          (rawStreams as unknown as { active?: Array<unknown> }).active?.length,
      ),
    };
      return { ...paginated, streams: shapedStreams };
  },
});


