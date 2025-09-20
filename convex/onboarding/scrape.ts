import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
// Phase status updates are now handled by the workflow
import { internal } from "../_generated/api";

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
    
    const normalizedUrl = url.replace(/\/$/, "").replace(/^https?:\/\/www\./, "https://");
    const httpStatus = statusCode ?? 0;
    
    // Determine status based on content and HTTP status
    const hasContent = !!contentRef && httpStatus >= 200 && httpStatus < 400;
    const isFailed = httpStatus >= 400 && httpStatus < 600;
    
    let newStatus: "queued" | "fetching" | "scraped" | "failed";
    if (hasContent) {
      newStatus = "scraped";
    } else if (isFailed) {
      newStatus = "failed";
    } else {
      newStatus = "queued";
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
      // Update existing page
      const finalContentRef = contentRef ?? existing.contentRef;
      console.log(`Updating existing page for ${normalizedUrl} with contentRef: ${finalContentRef}, status: ${newStatus}`);
      await ctx.db.patch(existing._id, {
        title: title ?? existing.title,
        status: newStatus,
        httpStatus: httpStatus || existing.httpStatus,
        contentRef: finalContentRef,
      });
    }
    
    return null;
  },
});



