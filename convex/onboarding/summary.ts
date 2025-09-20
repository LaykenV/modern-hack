import { internalMutation, internalAction, query } from "../_generated/server";
import { v } from "convex/values";
// Phase status updates are now handled by the workflow
import { atlasAgentGroq } from "../agent";
import { authComponent } from "../auth";
import { components } from "../_generated/api";
import { listMessages, syncStreams, extractText, vStreamArgs, type SyncStreamsReturnValue } from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { internal } from "../_generated/api";
import { normalizeUrl, truncateContent } from "./contentUtils";

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
    
    // Load actual content from storage instead of just URLs
    const contentLines: Array<string> = [];
    const limitedUrls = contextUrls.slice(0, 8); // Limit to prevent memory issues
    
    for (let i = 0; i < limitedUrls.length; i++) {
      const url = limitedUrls[i];
      try {
        // Get the page data from the database
        const page = await ctx.runQuery(internal.onboarding.claims.getCrawlPageByUrl, { 
          onboardingFlowId, 
          url 
        });
        
        if (page?.contentRef) {
          console.log(`Attempting to load content for summary URL ${url}, contentRef: ${page.contentRef}`);
          const blob = await ctx.storage.get(page.contentRef);
          if (blob) {
            const text = await blob.text();
            const truncated = truncateContent(text, 3000);
            contentLines.push(`Source [${i + 1}]: ${url}\n${truncated}`);
            console.log(`Successfully loaded summary content for ${url}: ${text.length} chars`);
          } else {
            console.warn(`No blob found for summary URL ${url}, contentRef: ${page.contentRef}`);
            contentLines.push(`Source [${i + 1}]: ${url}\n[Content not available]`);
          }
        } else {
          console.warn(`No contentRef for summary URL ${url}, page data:`, page);
          contentLines.push(`Source [${i + 1}]: ${url}\n[Content not available]`);
        }
      } catch (e) {
        console.error(`Failed to load summary content for ${url}:`, e);
        contentLines.push(`Source [${i + 1}]: ${url}\n[Content loading failed]`);
      }
    }
    
    const contextContent = contentLines.join("\n\n");
    const prompt = `Create a concise, accurate company overview for ${companyName} (${sourceUrl}) based on the provided content. Cite sources as [n] where n corresponds to the source numbers below:\n\n${contextContent}`;
    
    await atlasAgentGroq.streamText(
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

export const saveSummaryAndSeed = internalMutation({
  args: {
    agencyProfileId: v.id("agency_profile"),
    onboardingFlowId: v.id("onboarding_flow"),
    summary: v.string(),
    pagesList: v.optional(
      v.array(v.object({ url: v.string(), title: v.optional(v.string()), category: v.optional(v.string()) })),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { agencyProfileId, onboardingFlowId, summary, pagesList } = args;
    
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

    await ctx.db.patch(agencyProfileId, {
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
  returns: v.any(),
  handler: async (ctx, args) => {
    const flow = await ctx.db.get(args.onboardingFlowId);
    const user = await authComponent.getAuthUser(ctx);
    if (!flow || !user || flow.userId !== user._id) throw new Error("Forbidden");

    // If thread isn't ready yet or doesn't match, return empty results for the UI hook
    if (!args.threadId || !flow.smartThreadId || flow.smartThreadId !== args.threadId) {
      const emptyStreams: SyncStreamsReturnValue = { kind: "deltas", deltas: [] };
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        streams: emptyStreams,
      };
    }
    const agentArgs = {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
      streamArgs: args.streamArgs,
    };
    const paginated = await listMessages(ctx, components.agent, agentArgs);
    const streams = await syncStreams(ctx, components.agent, agentArgs);
    return { ...paginated, streams };
  },
});


