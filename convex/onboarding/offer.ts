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
    const prompt = `Task: Write a crisp Core Offer for ${companyName} (${sourceUrl}) using only the sources below.

Format:
- 2–4 sentences, active voice, <= 75 words total

Content:
- Who they help (audience) + primary outcome/value + what they do (service/product)

Constraints:
- No fluff or superlatives; avoid generic claims
- No numbers/metrics unless stated verbatim in the sources
- If audience is unclear, keep it generic (e.g., "businesses") without inventing specifics

Content sources:
${contextContent}

Return the core offer text only (no quotes or preface).`;
    
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
