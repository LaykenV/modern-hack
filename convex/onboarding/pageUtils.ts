/**
 * Consolidated page upsert utilities
 * Replaces separate logic in crawl.ts and scrape.ts
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { PageStatus } from "./constants";
import { normalizeUrl } from "./contentUtils";
import { internal } from "../_generated/api";

/**
 * Consolidated function to upsert page data
 * Handles both crawl results and scraped content
 */
export const upsertPageData = internalMutation({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    agencyProfileId: v.id("agency_profile"),
    url: v.string(),
    title: v.optional(v.string()),
    markdown: v.optional(v.string()),
    statusCode: v.optional(v.number()),
    preserveExistingContent: v.optional(v.boolean()), // Don't overwrite existing contentRef
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { onboardingFlowId, agencyProfileId, url, title, markdown, statusCode } = args;
    
    // Validate flow exists
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) throw new Error("Flow not found");
    
    const normalizedUrl = normalizeUrl(url);
    const httpStatus = statusCode ?? 0;
    
    // Determine status based on content and HTTP status
    const hasMarkdown = !!markdown && httpStatus >= 200 && httpStatus < 400;
    const isFailed = httpStatus >= 400 && httpStatus < 600;
    
    let newStatus: typeof PageStatus[keyof typeof PageStatus];
    if (hasMarkdown) {
      newStatus = PageStatus.scraped;
    } else if (isFailed) {
      newStatus = PageStatus.failed;
    } else {
      // When markdown is null/undefined (discovery-only mode), set status to "queued" instead of "fetching"
      newStatus = PageStatus.queued;
    }
    
    // Check for existing page
    const existing = await ctx.db
      .query("crawl_pages")
      .withIndex("by_flow_and_url", (q) => 
        q.eq("onboardingFlowId", onboardingFlowId).eq("url", normalizedUrl)
      )
      .unique();
    
    if (!existing) {
      // Insert new page without contentRef initially
      await ctx.db.insert("crawl_pages", {
        onboardingFlowId,
        agencyProfileId,
        url: normalizedUrl,
        title,
        status: newStatus,
        httpStatus: httpStatus || undefined,
        contentRef: undefined,
      });
      
      // Note: Storage now happens synchronously in scraping actions - no async scheduling needed
    } else {
      // Update existing page
      const updates: Record<string, unknown> = {
        title: title ?? existing.title,
        status: newStatus,
        httpStatus: httpStatus || existing.httpStatus,
      };
      
      // Note: Storage now happens synchronously in scraping actions - no async scheduling needed
      
      await ctx.db.patch(existing._id, updates);
    }
    
    return null;
  },
});

/**
 * Mark a page as fetching before scraping
 */
export const markPageFetching = internalMutation({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    agencyProfileId: v.id("agency_profile"),
    url: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { onboardingFlowId, agencyProfileId, url } = args;
    
    // Validate flow exists
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) throw new Error("Flow not found");
    
    const normalizedUrl = normalizeUrl(url);
    
    // Check for existing page
    const existing = await ctx.db
      .query("crawl_pages")
      .withIndex("by_flow_and_url", (q) => 
        q.eq("onboardingFlowId", onboardingFlowId).eq("url", normalizedUrl)
      )
      .unique();
    
    if (!existing) {
      // Insert new page with fetching status
      await ctx.db.insert("crawl_pages", {
        onboardingFlowId,
        agencyProfileId,
        url: normalizedUrl,
        status: PageStatus.fetching,
        // Don't touch contentRef - will be set later
      });
    } else {
      // Update existing page to fetching status
      await ctx.db.patch(existing._id, {
        status: PageStatus.fetching,
      });
    }
    
    return null;
  },
});

/**
 * Mark a page as failed
 */
export const markPageFailed = internalMutation({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    url: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { onboardingFlowId, url } = args;
    
    const normalizedUrl = normalizeUrl(url);
    
    // Find existing page
    const existing = await ctx.db
      .query("crawl_pages")
      .withIndex("by_flow_and_url", (q) => 
        q.eq("onboardingFlowId", onboardingFlowId).eq("url", normalizedUrl)
      )
      .unique();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: PageStatus.failed,
      });
    }
    
    return null;
  },
});

/**
 * Batch upsert pages from crawl results
 */
export const batchUpsertCrawlPages = internalMutation({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    agencyProfileId: v.id("agency_profile"),
    pages: v.array(
      v.object({
        url: v.string(),
        title: v.optional(v.string()),
        markdown: v.optional(v.string()),
        statusCode: v.optional(v.number()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { onboardingFlowId, agencyProfileId, pages } = args;
    
    // Process each page using the consolidated upsert function
    for (const page of pages) {
      await ctx.runMutation(internal.onboarding.pageUtils.upsertPageData, {
        onboardingFlowId,
        agencyProfileId,
        url: page.url,
        title: page.title,
        markdown: page.markdown,
        statusCode: page.statusCode,
      });
    }
    
    return null;
  },
});
