import { internalAction, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { atlasAgentGroq } from "../agent";
import { internal } from "../_generated/api";
// Events are now handled by the workflow's updatePhaseStatus
import { deduplicateUrls } from "./contentUtils";

export const filterRelevantPages = internalAction({
  args: { 
    pages: v.array(v.object({ url: v.string(), title: v.optional(v.string()) })),
    onboardingFlowId: v.id("onboarding_flow")
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const { pages, onboardingFlowId } = args;
    
    // Get the onboarding flow to access the fastThreadId (using internal query)
    const flow = await ctx.runQuery(internal.onboarding.queries.getOnboardingFlowInternal, { onboardingFlowId });
    if (!flow) throw new Error("Onboarding flow not found");
    if (!flow.coreOfferThread) throw new Error("Core offer thread not initialized");
    
    // First deduplicate the input pages
    const deduplicatedPages = pages.filter((page, index, arr) => 
      arr.findIndex(p => p.url === page.url) === index
    );
    
    const top = deduplicatedPages.slice(0, 80);
    const prompt = `Rank the following URLs for sales relevance. Prefer product/platform/features/solutions/about/homepage/pricing/docs. Exclude routes with query params and careers/legal/blog unless core.
Return only JSON: {"urls":[string...]}, max 10 items.

URLs:
${top.map((p, i) => `[${i + 1}] ${p.title ? `${p.title} — ` : ""}${p.url}`).join("\n")}`;

    const res = await atlasAgentGroq.generateText(ctx, { threadId: flow.coreOfferThread }, { prompt });
    let urls: Array<string> = [];
    try {
      const parsed = JSON.parse(res.text ?? "{}");
      urls = Array.isArray(parsed.urls) ? parsed.urls.slice(0, 20) : [];
    } catch (e) {
      console.warn("Filter JSON parse failed, using fallback:", e);
    }
    
    if (urls.length === 0) {
      // Fallback: use top pages prioritizing common important pages
      urls = top
        .filter(p => {
          const url = p.url.toLowerCase();
          return url.includes('/product') || url.includes('/pricing') || 
                 url.includes('/about') || url.includes('/docs') || 
                 url === top[0]?.url; // Always include homepage
        })
        .slice(0, 15)
        .map((p) => p.url);
      
      // If still empty, just take first 10 pages
      if (urls.length === 0) {
        urls = top.slice(0, 10).map((p) => p.url);
      }
    }
    
    // Deduplicate the final result
    return deduplicateUrls(urls);
  },
});

export const setRelevantPages = internalMutation({
  args: { onboardingFlowId: v.id("onboarding_flow"), relevantPages: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { onboardingFlowId, relevantPages } = args;
  const flow = await ctx.db.get(onboardingFlowId);
  if (!flow) throw new Error("Flow not found");
  await ctx.db.patch(onboardingFlowId, { relevantPages });
  // Phase status updates are now handled by the workflow
    return null;
  },
});

// Save filtered relevant pages to database as "queued"
export const saveFilteredPages = internalAction({
  args: { 
    onboardingFlowId: v.id("onboarding_flow"),
    agencyProfileId: v.id("agency_profile"),
    relevantPages: v.array(v.string()),
    discoveredPages: v.array(v.object({ url: v.string(), title: v.optional(v.string()) }))
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { onboardingFlowId, agencyProfileId, relevantPages, discoveredPages } = args;
    
    // Create a map of URL to title for quick lookup
    const urlToTitle = new Map(discoveredPages.map(p => [p.url, p.title]));
    
    // Save only the filtered relevant pages to database
    const pagesToSave = relevantPages.map(url => ({
      url,
      title: urlToTitle.get(url),
      markdown: undefined, // No content yet - will be scraped later
      statusCode: undefined,
    }));
    
    await ctx.runMutation(internal.onboarding.crawl.upsertCrawlPages, {
      onboardingFlowId,
      agencyProfileId,
      pages: pagesToSave,
      totals: { total: relevantPages.length, completed: 0 },
    });
    
    return null;
  },
});


