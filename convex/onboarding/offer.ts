import { internalMutation, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { atlasAgentGroq } from "../agent";
import { internal } from "../_generated/api";
import { truncateContent } from "./contentUtils";

export const generateCoreOffer = internalAction({
  args: { 
    onboardingFlowId: v.id("onboarding_flow"), 
    coreOfferThread: v.string(), 
    companyName: v.string(), 
    sourceUrl: v.string(), 
    contextUrls: v.array(v.string()) 
  },
  returns: v.object({ coreOffer: v.string() }),
  handler: async (ctx, args) => {
    const { onboardingFlowId, coreOfferThread, companyName, sourceUrl, contextUrls } = args;
    
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
          console.log(`Attempting to load content for core offer URL ${url}, contentRef: ${page.contentRef}`);
          const blob = await ctx.storage.get(page.contentRef);
          if (blob) {
            const text = await blob.text();
            const truncated = truncateContent(text, 3500); // Slightly more content for core offer
            contentLines.push(`Source [${i + 1}]: ${url}\n${truncated}`);
            console.log(`Successfully loaded core offer content for ${url}: ${text.length} chars`);
          } else {
            console.warn(`No blob found for core offer URL ${url}, contentRef: ${page.contentRef}`);
            contentLines.push(`Source [${i + 1}]: ${url}\n[Content not available]`);
          }
        } else {
          console.warn(`No contentRef for core offer URL ${url}, page data:`, page);
          contentLines.push(`Source [${i + 1}]: ${url}\n[Content not available]`);
        }
      } catch (e) {
        console.error(`Failed to load core offer content for ${url}:`, e);
        contentLines.push(`Source [${i + 1}]: ${url}\n[Content loading failed]`);
      }
    }
    
    const contextContent = contentLines.join("\n\n");
    const prompt = `Based on the provided content about ${companyName} (${sourceUrl}), create a concise 1-2 sentence "Core Offer" that clearly describes:
1. What service/product the agency provides
2. Who their target audience is

Focus on the main value proposition and target market. Be specific and actionable.

Content sources:
${contextContent}

Return only the core offer text, no additional formatting or explanation.`;
    
    const result = await atlasAgentGroq.generateText(
      ctx,
      { threadId: coreOfferThread },
      { prompt }
    );
    
    const coreOffer = (result.text ?? "").trim();
    return { coreOffer };
  },
});

export const saveCoreOffer = internalMutation({
  args: {
    agencyProfileId: v.id("agency_profile"),
    coreOffer: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { agencyProfileId, coreOffer } = args;
    
    await ctx.db.patch(agencyProfileId, {
      coreOffer,
    });
    
    return null;
  },
});
