"use node";
import { firecrawl } from "./firecrawl";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Start a Firecrawl crawl job and return the job id
export const startCrawl = internalAction({
  args: { sourceUrl: v.string(), limit: v.optional(v.number()) },
  returns: v.object({ crawlJobId: v.string() }),
  handler: async (ctx, { sourceUrl, limit }) => {
    const started = await firecrawl.startCrawl(sourceUrl, {
      limit: limit ?? 60,
      maxDiscoveryDepth: 3,
      allowSubdomains: false,
      crawlEntireDomain: false,
      includePaths: [
        "^/(product|platform|features|solutions|use-cases)(/|$)",
        "^/(pricing)(/|$)",
        "^/(about|company)(/|$)",
        "^/(docs|documentation|developers)(/|$)",
        "^/(customers|case-studies)(/|$)",
        "^/(security|trust|compliance)(/|$)",
        "^/(resources)(/|$)",
      ],
      excludePaths: [
        "^/(privacy|legal|terms|tos|cookies|gdpr|dpa)(/|$)",
        "^/(careers|jobs)(/|$)",
        "^/(press|media|newsroom)(/|$)",
        "^/blog/.*$",
        "^/wp-.*",
        "^/tag/.*",
        "^/category/.*",
      ],
      scrapeOptions: { formats: ["markdown", "links"], onlyMainContent: true },
    });
    return { crawlJobId: started.id };
  },
});

// Scrape a single URL with high-fidelity markdown
export const scrapeUrl = internalAction({
  args: { url: v.string() },
  returns: v.object({
    url: v.string(),
    title: v.optional(v.string()),
    markdown: v.optional(v.string()),
    statusCode: v.optional(v.number()),
  }),
  handler: async (ctx, { url }) => {
    const res = await firecrawl.scrape(url, {
      formats: ["markdown"],
      onlyMainContent: false,
      maxAge: 0,
    });
    const doc = (res as unknown as { data?: { markdown?: string; metadata?: { title?: string; statusCode?: number; sourceURL?: string; url?: string } } }).data;
    return {
      url: doc?.metadata?.sourceURL ?? doc?.metadata?.url ?? url,
      title: doc?.metadata?.title ?? undefined,
      markdown: doc?.markdown ?? undefined,
      statusCode: doc?.metadata?.statusCode ?? undefined,
    };
  },
});

// Get the current status and latest page batch for a Firecrawl crawl job
export const getCrawlStatus = internalAction({
  args: { crawlJobId: v.string(), autoPaginate: v.optional(v.boolean()) },
  returns: v.object({
    status: v.string(),
    total: v.optional(v.number()),
    completed: v.optional(v.number()),
    next: v.optional(v.union(v.string(), v.null())),
    pages: v.array(
      v.object({
        url: v.string(),
        title: v.optional(v.string()),
        markdown: v.optional(v.string()),
        statusCode: v.optional(v.number()),
      }),
    ),
  }),
  handler: async (ctx, { crawlJobId, autoPaginate }) => {
    const status = await firecrawl.getCrawlStatus(crawlJobId, {
      autoPaginate: autoPaginate ?? true,
    });
    type FirecrawlDoc = { markdown?: string; html?: string; metadata?: { sourceURL?: string; url?: string; title?: string; statusCode?: number } };
    const rawDocs: Array<FirecrawlDoc> = (status as unknown as { data?: Array<FirecrawlDoc> }).data ?? [];
    const pages = rawDocs
      .map((d) => ({
        url: d.metadata?.sourceURL ?? d.metadata?.url ?? "",
        title: d.metadata?.title ?? undefined,
        markdown: d.markdown ?? undefined,
        statusCode: d.metadata?.statusCode ?? undefined,
      }))
      .filter((p) => !!p.url);
    return {
      status: String(status.status ?? "unknown"),
      total: typeof status.total === "number" ? status.total : undefined,
      completed: typeof status.completed === "number" ? status.completed : undefined,
      next: (status as unknown as { next?: string | null }).next ?? null,
      pages,
    };
  },
});

// Scrape multiple relevant pages in batches
export const scrapeRelevantPages = internalAction({
  args: { onboardingFlowId: v.id("onboarding_flow"), sellerBrainId: v.id("seller_brain"), urls: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { onboardingFlowId, sellerBrainId, urls } = args;
    const batchSize = 2;
    for (let i = 0; i < urls.length; i += batchSize) {
      const slice = urls.slice(i, i + batchSize);
      await Promise.all(
        slice.map(async (u) => {
          const res = await firecrawl.scrape(u, {
            formats: ["markdown"],
            onlyMainContent: false,
            maxAge: 0,
          });
          const doc = (res as unknown as { data?: { markdown?: string; metadata?: { title?: string; statusCode?: number; sourceURL?: string; url?: string } } }).data;
          const result = {
            url: doc?.metadata?.sourceURL ?? doc?.metadata?.url ?? u,
            title: doc?.metadata?.title ?? undefined,
            markdown: doc?.markdown ?? undefined,
            statusCode: doc?.metadata?.statusCode ?? undefined,
          };
          await ctx.runMutation(internal.onboarding.scrape.saveScrapedPageContent, {
            onboardingFlowId,
            sellerBrainId,
            url: result.url,
            title: result.title,
            markdown: result.markdown,
            statusCode: result.statusCode,
          });
        }),
      );
    }
    return null;
  },
});

