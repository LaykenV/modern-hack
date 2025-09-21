import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
// Phase status updates are now handled by the workflow
import { internal } from "../_generated/api";
import { normalizeUrl } from "./contentUtils";

export const saveScrapedPageContent = internalMutation({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    agencyProfileId: v.id("agency_profile"),
    url: v.string(),
    title: v.optional(v.string()),
    markdown: v.optional(v.string()),
    statusCode: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Use consolidated upsert function, preserving existing content
    await ctx.runMutation(internal.onboarding.pageUtils.upsertPageData, {
      onboardingFlowId: args.onboardingFlowId,
      agencyProfileId: args.agencyProfileId,
      url: args.url,
      title: args.title,
      markdown: args.markdown,
      statusCode: args.statusCode,
      preserveExistingContent: true, // Don't overwrite existing contentRef
    });
    
    return null;
  },
});

export const saveScrapedPageContentWithStorage = internalMutation({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    agencyProfileId: v.id("agency_profile"),
    url: v.string(),
    title: v.optional(v.string()),
    contentRef: v.optional(v.id("_storage")),
    statusCode: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { onboardingFlowId, agencyProfileId, url, title, contentRef, statusCode } = args;
    
    // Validate flow exists
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) throw new Error("Flow not found");
    
    const normalizedUrl = normalizeUrl(url);
    const httpStatus = statusCode ?? 0;
    
    // Check for existing page first to preserve current status
    const existing = await ctx.db
      .query("crawl_pages")
      .withIndex("by_flow_and_url", (q) => 
        q.eq("onboardingFlowId", onboardingFlowId).eq("url", normalizedUrl)
      )
      .unique();
    
    // Determine status based on content and HTTP status
    const hasContent = !!contentRef && httpStatus >= 200 && httpStatus < 400;
    const isFailed = httpStatus >= 400 && httpStatus < 600;
    
    let newStatus: "queued" | "fetching" | "scraped" | "failed";
    if (hasContent) {
      newStatus = "scraped";
    } else if (isFailed) {
      newStatus = "failed";
    } else {
      // For ambiguous outcomes (no content, no definitive status), preserve existing status
      // or mark as failed if no existing page to avoid stuck "fetching" states
      newStatus = existing?.status ?? "failed";
    }
    
    if (!existing) {
      // Insert new page
      console.log(`Inserting new page for ${normalizedUrl} with contentRef: ${contentRef}, status: ${newStatus}`);
      await ctx.db.insert("crawl_pages", {
        onboardingFlowId,
        agencyProfileId,
        url: normalizedUrl,
        title,
        status: newStatus,
        httpStatus: httpStatus || undefined,
        contentRef,
      });
    } else {
      // Update existing page - only update status if we have a definitive result
      const finalContentRef = contentRef ?? existing.contentRef;
      const updates: Record<string, unknown> = {
        title: title ?? existing.title,
        httpStatus: httpStatus || existing.httpStatus,
        contentRef: finalContentRef,
      };
      
      // Only update status if we have a definitive result (scraped or failed)
      // Otherwise preserve the current status (likely "fetching")
      if (hasContent || isFailed) {
        updates.status = newStatus;
      }
      
      console.log(`Updating existing page for ${normalizedUrl} with contentRef: ${finalContentRef}, status: ${updates.status ?? existing.status}`);
      await ctx.db.patch(existing._id, updates);
    }
    
    return null;
  },
});



