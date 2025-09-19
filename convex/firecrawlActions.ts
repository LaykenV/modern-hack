"use node";
import { firecrawl } from "./firecrawl";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

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
        "^/(product|platform|features)(/|$)",
        "^/(pricing)(/|$)",
        "^/(about|company)(/|$)",
        "^/(docs|documentation)(/|$)",
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


