"use node";
import { firecrawl } from "./firecrawl";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

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
      scrapeOptions: { formats: ["links"], onlyMainContent: true },
    });
    return { crawlJobId: started.id };
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

// Get crawl status without storing pages - for discovery-only mode
export const getCrawlStatusOnly = internalAction({
  args: {
    crawlJobId: v.string(),
    autoPaginate: v.boolean(),
  },
  returns: v.object({
    status: v.string(),
    total: v.optional(v.number()),
    completed: v.optional(v.number()),
    pages: v.array(v.object({
      url: v.string(),
      title: v.optional(v.string()),
    })),
  }),
  handler: async (ctx, args): Promise<{ status: string; total?: number; completed?: number; pages: Array<{ url: string; title?: string; }>; }> => {
    // Get crawl status with page URLs
    const snapshot: { status: string; total?: number; completed?: number; pages: Array<{ url: string; title?: string; markdown?: string; statusCode?: number; }>; } = await ctx.runAction(internal.firecrawlActions.getCrawlStatus, {
      crawlJobId: args.crawlJobId,
      autoPaginate: args.autoPaginate,
    });
    
    // Return status and discovered URLs (no storage yet)
    return {
      status: snapshot.status,
      total: snapshot.total,
      completed: snapshot.completed,
      pages: snapshot.pages.map(p => ({ url: p.url, title: p.title })),
    };
  },
});

// Scrape multiple relevant pages in batches with enhanced progress tracking
export const scrapeRelevantPages = internalAction({
  args: { onboardingFlowId: v.id("onboarding_flow"), agencyProfileId: v.id("agency_profile"), urls: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { onboardingFlowId, agencyProfileId, urls } = args;
    const batchSize = 4; // Increased from 2 for better throughput
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const slice = urls.slice(i, i + batchSize);
      
      await Promise.all(
        slice.map(async (url, index) => {
          try {
            // Mark page as fetching before scraping
            await ctx.runMutation(internal.onboarding.pageUtils.markPageFetching, {
              onboardingFlowId,
              agencyProfileId,
              url,
            });
            
            const res = await firecrawl.scrape(url, {
              formats: ["markdown"],
              onlyMainContent: false, // Get full content for relevant pages
              maxAge: 0, // Always fresh for important pages
            });
            
            // Parse Firecrawl response - markdown is directly on response object
            const response = res as { markdown?: string; metadata?: { title?: string; statusCode?: number; sourceURL?: string; url?: string } };
            console.log(`Firecrawl response for ${url} - has markdown: ${!!response.markdown}, length: ${response.markdown?.length || 0}`);
            
            // Store markdown content directly in storage, then save to database
            let contentRef: Id<"_storage"> | undefined = undefined;
            if (response.markdown) {
              try {
                contentRef = await ctx.storage.store(new Blob([response.markdown], { type: "text/markdown" }));
                console.log(`Successfully stored content for ${url}: ${response.markdown.length} chars, contentRef: ${contentRef}`);
              } catch (e) {
                console.error(`Failed to store content for ${url}:`, e);
              }
            } else {
              console.warn(`No markdown content found for ${url}`);
            }
            
            await ctx.runMutation(internal.onboarding.scrape.saveScrapedPageContentWithStorage, {
              onboardingFlowId,
              agencyProfileId,
              url: response.metadata?.sourceURL ?? url,
              title: response.metadata?.title,
              contentRef,
              statusCode: response.metadata?.statusCode,
            });
            
            // Update progress after each page
            await ctx.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
              onboardingFlowId,
              phaseName: "scrape",
              current: i + index + 1,
              total: urls.length,
              subPhaseProgress: 0.2 + (0.6 * (i + index + 1) / urls.length),
            });
          } catch (error) {
            console.error(`Failed to scrape ${url}:`, error);
            // Mark page as failed on exception
            await ctx.runMutation(internal.onboarding.pageUtils.markPageFailed, {
              onboardingFlowId,
              url,
            });
            // Continue with other URLs
          }
        })
      );
      
      // Small delay between batches to avoid rate limits
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    return null;
  },
});

