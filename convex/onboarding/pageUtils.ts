/**
 * Consolidated page upsert utilities
 * Replaces separate logic in crawl.ts and scrape.ts
 */

import { internalMutation, internalAction } from "../_generated/server";
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
    const { onboardingFlowId, agencyProfileId, url, title, markdown, statusCode, preserveExistingContent } = args;
    
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
      // Insert new page
      await ctx.db.insert("crawl_pages", {
        onboardingFlowId,
        agencyProfileId,
        url: normalizedUrl,
        title,
        status: newStatus,
        httpStatus: httpStatus || undefined,
        contentRef: undefined,
      });
      
      // Store markdown content if available
      if (hasMarkdown && markdown) {
        await ctx.scheduler.runAfter(0, internal.onboarding.pageUtils.storePageMarkdown, {
          onboardingFlowId,
          agencyProfileId,
          url: normalizedUrl,
          markdown,
        });
      }
    } else {
      // Update existing page
      const updates: Record<string, unknown> = {
        title: title ?? existing.title,
        status: newStatus,
        httpStatus: httpStatus || existing.httpStatus,
      };
      
      // Store markdown content if available and not preserving existing content
      if (hasMarkdown && markdown && (!preserveExistingContent || !existing.contentRef)) {
        await ctx.scheduler.runAfter(0, internal.onboarding.pageUtils.storePageMarkdown, {
          onboardingFlowId,
          agencyProfileId,
          url: normalizedUrl,
          markdown,
        });
      }
      
      await ctx.db.patch(existing._id, updates);
    }
    
    return null;
  },
});

/**
 * Store markdown content as a blob and update page reference
 */
export const storePageMarkdown = internalAction({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    agencyProfileId: v.id("agency_profile"),
    url: v.string(),
    markdown: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { onboardingFlowId, agencyProfileId, url, markdown } = args;
    
    try {
      const contentRef = await ctx.storage.store(new Blob([markdown], { type: "text/markdown" }));
      
      await ctx.runMutation(internal.onboarding.pageUtils.applyStoredPageContent, {
        onboardingFlowId,
        agencyProfileId,
        url,
        contentRef,
      });
    } catch (e) {
      console.error("Storage operation failed for URL:", url, e);
      // Don't throw - just log and continue. Page will remain without contentRef
    }
    
    return null;
  },
});

/**
 * Apply stored content reference to a page
 */
export const applyStoredPageContent = internalMutation({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    agencyProfileId: v.id("agency_profile"),
    url: v.string(),
    contentRef: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { onboardingFlowId, url, contentRef } = args;
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) throw new Error("Flow not found");
    
    const normalizedUrl = normalizeUrl(url);
    const existing = await ctx.db
      .query("crawl_pages")
      .withIndex("by_flow_and_url", (q) => 
        q.eq("onboardingFlowId", onboardingFlowId).eq("url", normalizedUrl)
      )
      .unique();
    
    if (!existing) return null;
    
    await ctx.db.patch(existing._id, { 
      contentRef, 
      status: PageStatus.scraped 
    });
    
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
