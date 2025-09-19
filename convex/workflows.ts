import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal } from "./_generated/api";
import { internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { createThread } from "@convex-dev/agent";
import { atlasAgent } from "./agent";

export const workflow = new WorkflowManager(components.workflow);

function normalizeUrl(input: string): string {
  try {
    const url = new URL(input);
    let hostname = url.hostname.toLowerCase();
    if (hostname.startsWith("www.")) hostname = hostname.slice(4);
    let pathname = url.pathname.replace(/\/+/, "/");
    // Collapse duplicate slashes correctly
    pathname = pathname.replace(/\/+/g, "/");
    pathname = pathname.replace(/\/(index|default)\.(html?|php|aspx?)$/i, "/");
    if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
    const params = new URLSearchParams(url.search);
    const removeKeys: Array<string> = [
      "gclid",
      "fbclid",
      "ref",
      "referrer",
      "mc_cid",
      "mc_eid",
      "igshid",
    ];
    for (const key of [...params.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || removeKeys.includes(key.toLowerCase())) {
        params.delete(key);
      }
    }
    const sorted = new URLSearchParams();
    [...params.keys()].sort().forEach((k) => {
      for (const v of params.getAll(k)) sorted.append(k, v);
    });
    const query = sorted.toString();
    return `https://${hostname}${pathname}${query ? `?${query}` : ""}`;
  } catch {
    return input;
  }
}

// Init the onboarding flow document and emit an event
export const initOnboarding = internalMutation({
  args: {
    sellerBrainId: v.id("seller_brain"),
    companyName: v.string(),
    sourceUrl: v.string(),
  },
  returns: v.object({ onboardingFlowId: v.id("onboarding_flow") }),
  handler: async (ctx, { sellerBrainId, companyName, sourceUrl }) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const flowId = await ctx.db.insert("onboarding_flow", {
      userId: user._id,
      sellerBrainId,
      companyName,
      sourceUrl,
      workflowId: undefined,
      crawlJobId: undefined,
      status: "running",
      crawlPhase: "starting",
      filterPhase: "starting",
      scrapePhase: "starting",
      summaryPhase: "starting",
      claimsPhase: "starting",
      verifyPhase: "starting",
      crawlProgress: 0,
      discoveredCount: 0,
      scrapedCount: 0,
      failedCount: 0,
      fastThreadId: undefined,
      smartThreadId: undefined,
      summaryMessageId: undefined,
      claimsCandidateIds: undefined,
      relevantPages: [],
    });
    await ctx.db.patch(sellerBrainId, { onboardingFlowId: flowId });
    await ctx.db.insert("onboarding_events", {
      onboardingFlowId: flowId,
      userId: user._id,
      sellerBrainId,
      type: "onboarding.started",
      message: "Onboarding started",
      ts: Date.now(),
    });
    return { onboardingFlowId: flowId };
  },
});

export const createThreads = internalAction({
  args: { onboardingFlowId: v.id("onboarding_flow") },
  returns: v.object({ fastThreadId: v.string(), smartThreadId: v.string() }),
  handler: async (ctx) => {
    const fastThreadId = await createThread(ctx, components.agent);
    const smartThreadId = await createThread(ctx, components.agent);
    return { fastThreadId, smartThreadId };
  },
});

export const setThreads = internalMutation({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    fastThreadId: v.string(),
    smartThreadId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.onboardingFlowId, {
      fastThreadId: args.fastThreadId,
      smartThreadId: args.smartThreadId,
    });
    return null;
  },
});

export const markCrawlStarted = internalMutation({
  args: { onboardingFlowId: v.id("onboarding_flow"), crawlJobId: v.string() },
  returns: v.null(),
  handler: async (ctx, { onboardingFlowId, crawlJobId }) => {
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) throw new Error("Flow not found");
    await ctx.db.patch(onboardingFlowId, { crawlJobId, crawlPhase: "in_progress" });
    await ctx.db.insert("onboarding_events", {
      onboardingFlowId,
      userId: flow.userId,
      sellerBrainId: flow.sellerBrainId,
      type: "crawl.started",
      message: "Crawl started",
      ts: Date.now(),
    });
    return null;
  },
});

export const upsertCrawlPages = internalMutation({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    sellerBrainId: v.id("seller_brain"),
    pages: v.array(
      v.object({
        url: v.string(),
        title: v.optional(v.string()),
        markdown: v.optional(v.string()),
        statusCode: v.optional(v.number()),
      }),
    ),
    totals: v.object({ total: v.optional(v.number()), completed: v.optional(v.number()) }),
  },
  returns: v.null(),
  handler: async (ctx, { onboardingFlowId, sellerBrainId, pages, totals }) => {
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) throw new Error("Flow not found");

    let failedDelta = 0;

    for (const page of pages) {
      const normalizedUrl = normalizeUrl(page.url);
      const existing = await ctx.db
        .query("crawl_pages")
        .withIndex("by_flow_and_url", (q) => q.eq("onboardingFlowId", onboardingFlowId).eq("url", normalizedUrl))
        .unique();
      const statusCode = page.statusCode ?? 0;
      const hasMarkdown = !!page.markdown && statusCode >= 200 && statusCode < 400;
      const isFailed = statusCode >= 400 && statusCode < 600;

      if (!existing) {
        await ctx.db.insert("crawl_pages", {
          onboardingFlowId,
          sellerBrainId,
          url: normalizedUrl,
          title: page.title,
          status: hasMarkdown ? "scraped" : isFailed ? "failed" : "fetching",
          httpStatus: statusCode || undefined,
          contentRef: undefined,
        });
        if (isFailed) {
          failedDelta += 1;
          await ctx.db.insert("onboarding_events", {
            onboardingFlowId,
            userId: flow.userId,
            sellerBrainId,
            type: "crawl.page_failed",
            message: `Failed with status ${statusCode}`,
            detail: normalizedUrl,
            ts: Date.now(),
          });
        } else {
          await ctx.db.insert("onboarding_events", {
            onboardingFlowId,
            userId: flow.userId,
            sellerBrainId,
            type: "crawl.page_fetching",
            message: "Fetching page",
            detail: normalizedUrl,
            ts: Date.now(),
          });
        }
        if (hasMarkdown && page.markdown) {
          await ctx.scheduler.runAfter(0, internal.workflows.storePageMarkdown, {
            onboardingFlowId,
            sellerBrainId,
            url: normalizedUrl,
            markdown: page.markdown,
          });
        }
      } else {
        let newStatus = existing.status;
        if (hasMarkdown) newStatus = "scraped";
        if (isFailed) newStatus = "failed";
        const patch: Record<string, unknown> = {
          title: page.title ?? existing.title,
          status: newStatus,
          httpStatus: statusCode || existing.httpStatus,
        };
        let emitted = false;
        if (hasMarkdown && page.markdown && !existing.contentRef) {
          await ctx.scheduler.runAfter(0, internal.workflows.storePageMarkdown, {
            onboardingFlowId,
            sellerBrainId,
            url: normalizedUrl,
            markdown: page.markdown,
          });
          emitted = true;
        }
        if (isFailed && existing.status !== "failed") {
          failedDelta += 1;
          emitted = true;
          await ctx.db.insert("onboarding_events", {
            onboardingFlowId,
            userId: flow.userId,
            sellerBrainId,
            type: "crawl.page_failed",
            message: `Failed with status ${statusCode}`,
            detail: normalizedUrl,
            ts: Date.now(),
          });
        }
        if (!emitted && existing.status === "queued") {
          await ctx.db.insert("onboarding_events", {
            onboardingFlowId,
            userId: flow.userId,
            sellerBrainId,
            type: "crawl.page_fetching",
            message: "Fetching page",
            detail: normalizedUrl,
            ts: Date.now(),
          });
        }
        await ctx.db.patch(existing._id, patch);
      }
    }

    const total = totals.total ?? 0;
    const completed = totals.completed ?? 0;
    const crawlProgress = total > 0 ? Math.min(1, completed / total) : 0;
    await ctx.db.patch(onboardingFlowId, {
      discoveredCount: total,
      scrapedCount: completed,
      failedCount: (flow.failedCount ?? 0) + failedDelta,
      crawlProgress,
    });
    return null;
  },
});

export const markCrawlCompleted = internalMutation({
  args: { onboardingFlowId: v.id("onboarding_flow") },
  returns: v.null(),
  handler: async (ctx, { onboardingFlowId }) => {
    const flow = await ctx.db.get(onboardingFlowId);
    await ctx.db.patch(onboardingFlowId, { crawlPhase: "done" });
    if (flow) {
      await ctx.db.insert("onboarding_events", {
        onboardingFlowId,
        userId: flow.userId,
        sellerBrainId: flow.sellerBrainId,
        type: "crawl.completed",
        message: "Crawl completed",
        ts: Date.now(),
      });
    }
    return null;
  },
});

export const applyStoredPageContent = internalMutation({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    sellerBrainId: v.id("seller_brain"),
    url: v.string(),
    contentRef: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, { onboardingFlowId, sellerBrainId, url, contentRef }) => {
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) throw new Error("Flow not found");
    const normalizedUrl = normalizeUrl(url);
    const existing = await ctx.db
      .query("crawl_pages")
      .withIndex("by_flow_and_url", (q) => q.eq("onboardingFlowId", onboardingFlowId).eq("url", normalizedUrl))
      .unique();
    if (!existing) return null;
    await ctx.db.patch(existing._id, { contentRef, status: "scraped" });
    await ctx.db.insert("onboarding_events", {
      onboardingFlowId,
      userId: flow.userId,
      sellerBrainId,
      type: "crawl.page_done",
      message: "Page scraped",
      detail: normalizedUrl,
      ts: Date.now(),
    });
    return null;
  },
});

export const storePageMarkdown = internalAction({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    sellerBrainId: v.id("seller_brain"),
    url: v.string(),
    markdown: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { onboardingFlowId, sellerBrainId, url, markdown }) => {
    const contentRef = await ctx.storage.store(new Blob([markdown], { type: "text/markdown" }));
    await ctx.runMutation(internal.workflows.applyStoredPageContent, { onboardingFlowId, sellerBrainId, url, contentRef });
    return null;
  },
});

export const listFlowPages = internalQuery({
  args: { onboardingFlowId: v.id("onboarding_flow") },
  returns: v.array(v.object({ url: v.string(), title: v.optional(v.string()) })),
  handler: async (ctx, { onboardingFlowId }) => {
    const rows = await ctx.db
      .query("crawl_pages")
      .withIndex("by_flow", (q) => q.eq("onboardingFlowId", onboardingFlowId))
      .collect();
    return rows.map((r) => ({ url: r.url, title: r.title ?? undefined }));
  },
});

export const filterRelevantPages = internalAction({
  args: { pages: v.array(v.object({ url: v.string(), title: v.optional(v.string()) })) },
  returns: v.array(v.string()),
  handler: async (ctx, { pages }) => {
    const preferred = ["product", "pricing", "docs", "documentation", "about", "platform", "features"];
    const ranked = pages
      .map((p) => ({ p, score: preferred.reduce((s, k) => (p.url.toLowerCase().includes(k) ? s + 1 : s), 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((x) => x.p.url);
    return ranked.length > 0 ? ranked : pages.slice(0, 15).map((p) => p.url);
  },
});

export const setRelevantPages = internalMutation({
  args: { onboardingFlowId: v.id("onboarding_flow"), relevantPages: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { onboardingFlowId, relevantPages }) => {
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) throw new Error("Flow not found");
    await ctx.db.patch(onboardingFlowId, { relevantPages, filterPhase: "done" });
    await ctx.db.insert("onboarding_events", {
      onboardingFlowId,
      userId: flow.userId,
      sellerBrainId: flow.sellerBrainId,
      type: "filter.completed",
      message: "Relevant pages selected",
      ts: Date.now(),
    });
    return null;
  },
});

export const markScrapeStarted = internalMutation({
  args: { onboardingFlowId: v.id("onboarding_flow") },
  returns: v.null(),
  handler: async (ctx, { onboardingFlowId }) => {
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) throw new Error("Flow not found");
    await ctx.db.patch(onboardingFlowId, { scrapePhase: "in_progress" });
    await ctx.db.insert("onboarding_events", {
      onboardingFlowId,
      userId: flow.userId,
      sellerBrainId: flow.sellerBrainId,
      type: "scrape.started",
      message: "High-fidelity scrape started",
      ts: Date.now(),
    });
    return null;
  },
});

export const saveScrapedPageContent = internalMutation({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    sellerBrainId: v.id("seller_brain"),
    url: v.string(),
    title: v.optional(v.string()),
    markdown: v.optional(v.string()),
    statusCode: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { onboardingFlowId, sellerBrainId, url, title, markdown, statusCode }) => {
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) throw new Error("Flow not found");
    const normalizedUrl = normalizeUrl(url);
    const existing = await ctx.db
      .query("crawl_pages")
      .withIndex("by_flow_and_url", (q) => q.eq("onboardingFlowId", onboardingFlowId).eq("url", normalizedUrl))
      .unique();
    const ok = !!markdown && (statusCode ?? 0) >= 200 && (statusCode ?? 0) < 400;
    const contentRef = existing?.contentRef; // need to actually store the markdown in the storage
    if (!existing) {
      await ctx.db.insert("crawl_pages", {
        onboardingFlowId,
        sellerBrainId,
        url: normalizedUrl,
        title,
        status: ok ? "scraped" : (statusCode ?? 0) >= 400 ? "failed" : "fetching",
        httpStatus: statusCode ?? undefined,
        contentRef: contentRef ?? undefined,
      });
    } else {
      await ctx.db.patch(existing._id, {
        title: title ?? existing.title,
        status: ok ? "scraped" : existing.status,
        httpStatus: statusCode ?? existing.httpStatus,
        contentRef: contentRef ?? existing.contentRef,
      });
    }
    if (ok && markdown && !contentRef) {
      await ctx.scheduler.runAfter(0, internal.workflows.storePageMarkdown, {
        onboardingFlowId,
        sellerBrainId,
        url: normalizedUrl,
        markdown,
      });
    }
    await ctx.db.insert("onboarding_events", {
      onboardingFlowId,
      userId: flow.userId,
      sellerBrainId,
      type: ok ? "scrape.page_done" : "scrape.page_failed",
      message: ok ? "Page scraped (hi-fi)" : `Failed to scrape (status ${statusCode ?? 0})`,
      detail: normalizedUrl,
      ts: Date.now(),
    });
    return null;
  },
});

export const scrapeRelevantPages = internalAction({
  args: { onboardingFlowId: v.id("onboarding_flow"), sellerBrainId: v.id("seller_brain"), urls: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { onboardingFlowId, sellerBrainId, urls }) => {
    // Simple bounded concurrency: batches of 8
    const batchSize = 8;
    for (let i = 0; i < urls.length; i += batchSize) {
      const slice = urls.slice(i, i + batchSize);
      await Promise.all(
        slice.map(async (u) => {
          const res = await ctx.runAction(internal.firecrawlActions.scrapeUrl, { url: u });
          await ctx.runMutation(internal.workflows.saveScrapedPageContent, {
            onboardingFlowId,
            sellerBrainId,
            url: res.url,
            title: res.title,
            markdown: res.markdown,
            statusCode: res.statusCode,
          });
        }),
      );
    }
    return null;
  },
});

export const markScrapeCompleted = internalMutation({
  args: { onboardingFlowId: v.id("onboarding_flow") },
  returns: v.null(),
  handler: async (ctx, { onboardingFlowId }) => {
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) throw new Error("Flow not found");
    await ctx.db.patch(onboardingFlowId, { scrapePhase: "done" });
    await ctx.db.insert("onboarding_events", {
      onboardingFlowId,
      userId: flow.userId,
      sellerBrainId: flow.sellerBrainId,
      type: "scrape.completed",
      message: "High-fidelity scrape completed",
      ts: Date.now(),
    });
    return null;
  },
});

export const markSummaryStreamingStarted = internalMutation({
  args: { onboardingFlowId: v.id("onboarding_flow") },
  returns: v.null(),
  handler: async (ctx, { onboardingFlowId }) => {
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) throw new Error("Flow not found");
    await ctx.db.patch(onboardingFlowId, { summaryPhase: "in_progress" });
    await ctx.db.insert("onboarding_events", {
      onboardingFlowId,
      userId: flow.userId,
      sellerBrainId: flow.sellerBrainId,
      type: "summary.streaming_started",
      message: "Summary streaming started",
      ts: Date.now(),
    });
    return null;
  },
});

export const streamSummary = internalAction({
  args: { onboardingFlowId: v.id("onboarding_flow"), smartThreadId: v.string(), companyName: v.string(), sourceUrl: v.string(), contextUrls: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { onboardingFlowId, smartThreadId, companyName, sourceUrl, contextUrls }) => {
    await ctx.runMutation(internal.workflows.markSummaryStreamingStarted, { onboardingFlowId });
    const prompt = `Create a concise, accurate company overview for ${companyName} (${sourceUrl}). Cite sources as [n] mapped to these URLs (in importance order):\n${contextUrls.slice(0, 10).map((u, i) => `[${i + 1}] ${u}`).join("\n")}`;
    await atlasAgent.streamText(
      ctx,
      { threadId: smartThreadId },
      { prompt },
      { saveStreamDeltas: { returnImmediately: true } },
    );
    return null;
  },
});

export const saveSummaryAndSeed = internalMutation({
  args: {
    sellerBrainId: v.id("seller_brain"),
    onboardingFlowId: v.id("onboarding_flow"),
    summary: v.string(),
    pagesList: v.array(v.object({ url: v.string(), title: v.optional(v.string()), category: v.optional(v.string()) })),
  },
  returns: v.null(),
  handler: async (ctx, { sellerBrainId, onboardingFlowId, summary, pagesList }) => {
    await ctx.db.patch(sellerBrainId, {
      summary,
      pagesList,
      crawlStatus: "seeded",
      crawlError: undefined,
    });
    await ctx.db.patch(onboardingFlowId, { summaryPhase: "done" });
    return null;
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
  handler: async (ctx, { companyName, sourceUrl, pageUrls }) => {
    const pagesSnippet = pageUrls.slice(0, 5).map((u, i) => `[${i + 1}] ${u}`).join("\n");
    const summary = `Company: ${companyName}\nWebsite: ${sourceUrl}\n\nOverview:\n${companyName} provides products and services documented on the following pages:\n${pagesSnippet}\n\nThis is an automatically generated initial summary.`;
    return summary;
  },
});

export const onboardingWorkflow = workflow.define({
  args: { sellerBrainId: v.id("seller_brain"), companyName: v.string(), sourceUrl: v.string() },
  handler: async (step, args): Promise<null> => {
    const { onboardingFlowId } = await step.runMutation(internal.workflows.initOnboarding, args);
    const threads = await step.runAction(internal.workflows.createThreads, { onboardingFlowId });
    await step.runMutation(internal.workflows.setThreads, { onboardingFlowId, ...threads });

    const started = await step.runAction(internal.firecrawlActions.startCrawl, { sourceUrl: args.sourceUrl });
    await step.runMutation(internal.workflows.markCrawlStarted, { onboardingFlowId, crawlJobId: started.crawlJobId });

    for (let i = 0; i < 120; i++) {
      const snapshot = await step.runAction(internal.firecrawlActions.getCrawlStatus, { crawlJobId: started.crawlJobId, autoPaginate: false }, i === 0 ? undefined : { runAfter: 2000 });
      await step.runMutation(internal.workflows.upsertCrawlPages, { onboardingFlowId, sellerBrainId: args.sellerBrainId, pages: snapshot.pages, totals: { total: snapshot.total, completed: snapshot.completed } });
      if (snapshot.status === "completed") break;
    }
    await step.runMutation(internal.workflows.markCrawlCompleted, { onboardingFlowId });

    const allPages = await step.runQuery(internal.workflows.listFlowPages, { onboardingFlowId });
    const relevant = await step.runAction(internal.workflows.filterRelevantPages, { pages: allPages });
    await step.runMutation(internal.workflows.setRelevantPages, { onboardingFlowId, relevantPages: relevant });

    // High-fidelity scrape of relevant pages
    await step.runMutation(internal.workflows.markScrapeStarted, { onboardingFlowId });
    await step.runAction(internal.workflows.scrapeRelevantPages, { onboardingFlowId, sellerBrainId: args.sellerBrainId, urls: relevant });
    await step.runMutation(internal.workflows.markScrapeCompleted, { onboardingFlowId });

    // Smart agent streaming summary after scraping
    await step.runAction(internal.workflows.streamSummary, { onboardingFlowId, smartThreadId: threads.smartThreadId, companyName: args.companyName, sourceUrl: args.sourceUrl, contextUrls: relevant });

    // For now, finalize with simple summary text (placeholder until reading stream content)
    const summary = await step.runAction(internal.workflows.generateSummary, { onboardingFlowId, companyName: args.companyName, sourceUrl: args.sourceUrl, pageUrls: relevant });
    await step.runMutation(internal.workflows.saveSummaryAndSeed, { sellerBrainId: args.sellerBrainId, onboardingFlowId, summary, pagesList: relevant.map((url) => ({ url })) });
    return null;
  },
});