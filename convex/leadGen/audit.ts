/**
 * Audit job management and workflow for lead generation
 * Handles per-opportunity deep analysis: URL discovery, filtering, scraping, and dossier generation
 */

import { internalMutation, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { atlasAgentGroq } from "../agent";

/**
 * Initialize audit job phases
 */
function initializeAuditPhases() {
  return [
    {
      name: "map_urls" as const,
      status: "pending" as const,
    },
    {
      name: "filter_urls" as const,
      status: "pending" as const,
    },
    {
      name: "scrape_content" as const,
      status: "pending" as const,
    },
    {
      name: "generate_dossier" as const,
      status: "pending" as const,
    },
  ];
}

/**
 * Insert new audit job
 */
export const insertAuditJob = internalMutation({
  args: {
    opportunityId: v.id("client_opportunities"),
    agencyId: v.id("agency_profile"),
    leadGenFlowId: v.id("lead_gen_flow"),
    targetUrl: v.string(),
  },
  returns: v.id("audit_jobs"),
  handler: async (ctx, args) => {
    const auditJobId = await ctx.db.insert("audit_jobs", {
      opportunityId: args.opportunityId,
      agencyId: args.agencyId,
      leadGenFlowId: args.leadGenFlowId,
      targetUrl: args.targetUrl,
      status: "queued",
      phases: initializeAuditPhases(),
      dossierId: undefined,
    });

    return auditJobId;
  },
});

/**
 * Update opportunity status
 */
export const updateOpportunityStatus = internalMutation({
  args: {
    opportunityId: v.id("client_opportunities"),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.opportunityId, {
      status: args.status,
    });
    return null;
  },
});

/**
 * Update audit job status
 */
export const updateAuditJobStatus = internalMutation({
  args: {
    auditJobId: v.id("audit_jobs"),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.auditJobId, {
      status: args.status as "running" | "error" | "completed" | "queued",
    });
    return null;
  },
});

/**
 * Update audit job phase status
 */
export const updateAuditPhaseStatus = internalMutation({
  args: {
    auditJobId: v.id("audit_jobs"),
    phaseName: v.string(),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auditJob = await ctx.db.get(args.auditJobId);
    if (!auditJob) throw new Error("Audit job not found");

    const updatedPhases = auditJob.phases.map(phase => 
      phase.name === args.phaseName 
        ? { ...phase, status: args.status as "pending" | "running" | "complete" | "error" }
        : phase
    );

    await ctx.db.patch(args.auditJobId, {
      phases: updatedPhases,
    });

    return null;
  },
});

/**
 * Create audit dossier
 */
export const createAuditDossier = internalMutation({
  args: {
    opportunityId: v.id("client_opportunities"),
    auditJobId: v.id("audit_jobs"),
    summary: v.string(),
    identifiedGaps: v.array(v.object({
      key: v.string(),
      value: v.string(),
      source_url: v.optional(v.string()),
    })),
    talkingPoints: v.array(v.object({
      text: v.string(),
      approved_claim_id: v.string(),
      source_url: v.optional(v.string()),
    })),
  },
  returns: v.id("audit_dossier"),
  handler: async (ctx, args) => {
    const dossierId = await ctx.db.insert("audit_dossier", {
      opportunityId: args.opportunityId,
      auditJobId: args.auditJobId,
      summary: args.summary,
      identified_gaps: args.identifiedGaps,
      talking_points: args.talkingPoints,
    });

    // Link dossier to audit job
    await ctx.db.patch(args.auditJobId, {
      dossierId,
    });

    return dossierId;
  },
});

/**
 * Save fit reason to opportunity
 */
export const saveFitReason = internalMutation({
  args: {
    opportunityId: v.id("client_opportunities"),
    fitReason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.opportunityId, {
      fit_reason: args.fitReason,
    });
    return null;
  },
});


/**
 * Filter relevant URLs using AI agent (similar to onboarding pattern)
 */
export const filterRelevantUrls = internalAction({
  args: {
    auditJobId: v.id("audit_jobs"),
    agencyId: v.id("agency_profile"),
    pages: v.array(v.object({ url: v.string(), title: v.optional(v.string()) })),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const { pages, agencyId } = args;
    
    // Get agency profile to understand the context
    const agency = await ctx.runQuery(internal.leadGen.queries.getAgencyProfileInternal, { 
      agencyId 
    });
    if (!agency) throw new Error("Agency profile not found");

    // Deduplicate pages
    const deduplicatedPages = pages.filter((page, index, arr) => 
      arr.findIndex(p => p.url === page.url) === index
    );
    
    const top = deduplicatedPages.slice(0, 40); // Limit for processing

    const prompt = `Rank the following website URLs by relevance for lead generation audit and sales intelligence.

Context: We're auditing a potential client website to understand their business, identify gaps, and create talking points for sales outreach.

Instructions:
- PRIORITIZE: homepage, product/services/solutions, pricing, about/company, case studies/testimonials, team/leadership
- INCLUDE: key feature pages, integration/partner pages, resources/documentation if core to business
- DEPRIORITIZE: blog posts (unless recent and highly relevant), careers, legal/privacy, generic contact pages
- EXCLUDE: URLs with query params, anchors, or duplicate content
- LIMIT: return exactly 4 most relevant URLs for comprehensive business understanding
- USE ONLY the provided URLs; do not invent new ones

Output (JSON only, no prose): {"urls": [string, ...]}

URLs:
${top.map((p, i) => `[${i + 1}] ${p.title ? `${p.title} — ` : ""}${p.url}`).join("\n")}`;

    try {
      // Use a simple agent call without thread context for filtering
      const res = await atlasAgentGroq.generateText(ctx, {}, { prompt });
      const parsed = JSON.parse(res.text ?? "{}");
      let urls: Array<string> = Array.isArray(parsed.urls) ? parsed.urls.slice(0, 4) : [];
      
      if (urls.length === 0) {
        // Fallback: prioritize important pages
        urls = top
          .filter(p => {
            const url = p.url.toLowerCase();
            return url.includes('/product') || url.includes('/service') || 
                   url.includes('/pricing') || url.includes('/about') || 
                   url.includes('/solution') || url === top[0]?.url; // Always include homepage
          })
          .slice(0, 4)
          .map(p => p.url);
      }

      console.log(`[Audit Filter] Selected ${urls.length} URLs for scraping`);
      return urls;
      
    } catch (error) {
      console.warn("AI filtering failed, using fallback selection:", error);
      
      // Fallback to rule-based selection
      const fallbackUrls = top
        .filter(p => {
          const url = p.url.toLowerCase();
          const title = (p.title || "").toLowerCase();
          
          // Priority scoring
          const isHomepage = url === top[0]?.url;
          const hasProduct = url.includes('/product') || title.includes('product');
          const hasPricing = url.includes('/pricing') || title.includes('pricing');
          const hasAbout = url.includes('/about') || title.includes('about');
          const hasService = url.includes('/service') || title.includes('service');
          
          return isHomepage || hasProduct || hasPricing || hasAbout || hasService;
        })
        .slice(0, 4)
        .map(p => p.url);
        
      return fallbackUrls.length > 0 ? fallbackUrls : top.slice(0, 3).map(p => p.url);
    }
  },
});


/**
 * Generate dossier and fit reason using AI agent
 */
export const generateDossierAndFitReason = internalAction({
  args: {
    auditJobId: v.id("audit_jobs"),
    opportunityId: v.id("client_opportunities"),
    agencyId: v.id("agency_profile"),
    scrapedContent: v.array(v.object({
      url: v.string(),
      title: v.optional(v.string()),
      content: v.string(),
    })),
  },
  returns: v.object({
    dossierId: v.id("audit_dossier"),
    fitReason: v.string(),
  }),
  handler: async (ctx, args) => {
    const { opportunityId, agencyId, scrapedContent } = args;
    
    // Get opportunity and agency details
    const opportunity: any = await ctx.runQuery(internal.leadGen.queries.getOpportunityById, {
      opportunityId,
    });
    if (!opportunity) throw new Error("Opportunity not found");
    
    const agency: any = await ctx.runQuery(internal.leadGen.queries.getAgencyProfileInternal, {
      agencyId,
    });
    if (!agency) throw new Error("Agency profile not found");

    // Prepare context for AI analysis
    const contextContent = scrapedContent.map(page => 
      `URL: ${page.url}\nTitle: ${page.title || 'N/A'}\nContent:\n${page.content}\n\n---\n\n`
    ).join('');

    // Generate comprehensive dossier
    const dossierPrompt = `Analyze this potential client's website and create a detailed sales dossier.

AGENCY CONTEXT:
- Company: ${agency.companyName}
- Core Offer: ${agency.coreOffer || 'Not specified'}
- Summary: ${agency.summary || 'Not available'}

PROSPECT CONTEXT:
- Company: ${opportunity.name}
- Qualification Signals: ${opportunity.signals.join(', ') || 'None'}
- Industry: ${opportunity.targetVertical}
- Location: ${opportunity.targetGeography}

WEBSITE ANALYSIS:
${contextContent}

Create a comprehensive sales dossier with:

1. BUSINESS SUMMARY (2-3 sentences): What they do, who they serve, key value propositions
2. IDENTIFIED GAPS (3-5 specific gaps): Technical, marketing, operational, or strategic weaknesses we could address
3. TALKING POINTS (3-4 points): Specific conversation starters that connect our capabilities to their needs

Format as JSON:
{
  "summary": "Business summary here",
  "gaps": [
    {"key": "Gap category", "value": "Specific gap description", "source_url": "supporting URL"},
    ...
  ],
  "talking_points": [
    {"text": "Talking point connecting to our capabilities", "source_url": "supporting URL"},
    ...
  ]
}`;

    try {
      const dossierRes = await atlasAgentGroq.generateText(ctx, {}, { prompt: dossierPrompt });
      const dossierData = JSON.parse(dossierRes.text ?? "{}");
      
      // Generate fit reason separately for brevity
      const fitPrompt: string = `Based on this analysis, write a concise 1-2 sentence "fit reason" explaining why ${opportunity.name} is a good prospect for ${agency.companyName}.

Focus on:
- Their qualification signals: ${opportunity.signals.join(', ')}
- Key gaps we identified
- How our core offering aligns

Keep it under 150 characters for UI display.

Context: ${dossierData.summary || 'Business analysis not available'}

Fit Reason:`;

      const fitRes = await atlasAgentGroq.generateText(ctx, {}, { prompt: fitPrompt });
      const fitReason = (fitRes.text || '').trim().slice(0, 150);

      // Create dossier in database
      const dossierId: any = await ctx.runMutation(internal.leadGen.audit.createAuditDossier, {
        opportunityId,
        auditJobId: args.auditJobId,
        summary: dossierData.summary || 'Analysis completed',
        identifiedGaps: dossierData.gaps || [],
        talkingPoints: (dossierData.talking_points || []).map((tp: { text?: string; source_url?: string } | string, index: number) => ({
          text: typeof tp === 'string' ? tp : (tp.text || ''),
          approved_claim_id: `generated_${index}`, // Link to agency claims if available
          source_url: typeof tp === 'string' ? undefined : tp.source_url,
        })),
      });

      // Save fit reason to opportunity
      await ctx.runMutation(internal.leadGen.audit.saveFitReason, {
        opportunityId,
        fitReason,
      });

      console.log(`[Audit Dossier] Generated dossier ${dossierId} for ${opportunity.name}`);
      
      return {
        dossierId,
        fitReason,
      };
      
    } catch (error) {
      console.error("[Audit Dossier] AI generation failed:", error);
      
      // Fallback: create minimal dossier
      const fallbackSummary: string = `${opportunity.name} is a ${opportunity.targetVertical} business in ${opportunity.targetGeography}. Qualification signals: ${opportunity.signals.join(', ')}.`;
      const fallbackFitReason = `${opportunity.name} shows ${opportunity.signals.length} qualification signals indicating potential for our services.`;
      
      const dossierId: any = await ctx.runMutation(internal.leadGen.audit.createAuditDossier, {
        opportunityId,
        auditJobId: args.auditJobId,
        summary: fallbackSummary,
        identifiedGaps: [
          {
            key: "Website Analysis",
            value: "Detailed analysis requires manual review",
            source_url: scrapedContent[0]?.url,
          }
        ],
        talkingPoints: [
          {
            text: `Discuss ${opportunity.targetVertical} challenges and our solutions`,
            approved_claim_id: "fallback_1",
            source_url: scrapedContent[0]?.url,
          }
        ],
      });

      await ctx.runMutation(internal.leadGen.audit.saveFitReason, {
        opportunityId,
        fitReason: fallbackFitReason,
      });

      return {
        dossierId,
        fitReason: fallbackFitReason,
      };
    }
  },
});

/**
 * Run audit action (replaces runAuditWorkflow - workflows can't run other workflows)
 * Performs the audit steps: discovery → filter → scrape → dossier
 */
export const runAuditAction = internalAction({
  args: {
    auditJobId: v.id("audit_jobs"),
    opportunityId: v.id("client_opportunities"),
    agencyId: v.id("agency_profile"),
    targetUrl: v.string(),
    leadGenFlowId: v.id("lead_gen_flow"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      console.log(`[Audit Action] Starting audit for opportunity ${args.opportunityId}`);

      // Update audit job to running
      await ctx.runMutation(internal.leadGen.audit.updateAuditJobStatus, {
        auditJobId: args.auditJobId,
        status: "running",
      });

      // Phase 1: Map URLs (Discovery-only crawl)
      console.log(`[Audit Action] Phase 1: Map URLs for ${args.targetUrl}`);
      
      await ctx.runMutation(internal.leadGen.audit.updateAuditPhaseStatus, {
        auditJobId: args.auditJobId,
        phaseName: "map_urls",
        status: "running",
      });

      // Start Firecrawl discovery-only crawl
      const crawlResult = await ctx.runAction(internal.firecrawlActions.startCrawl, {
        sourceUrl: args.targetUrl,
        limit: 40,
      });

      // Poll for completion with shorter timeout for individual audits
      const MAX_CRAWL_MINUTES = 3;
      const POLL_INTERVAL_MS = 2000;
      const maxIterations = (MAX_CRAWL_MINUTES * 60 * 1000) / POLL_INTERVAL_MS;
      let discoveredUrls: Array<{ url: string; title?: string }> = [];

      for (let i = 0; i < maxIterations; i++) {
        const snapshot = await ctx.runAction(internal.firecrawlActions.getCrawlStatusOnly, {
          crawlJobId: crawlResult.crawlJobId,
          autoPaginate: i === 0,
        });

        discoveredUrls = snapshot.pages;

        if (snapshot.status === "completed") break;
        if (snapshot.status === "failed") throw new Error("Crawl job failed");

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      // Check final status
      const finalSnapshot = await ctx.runAction(internal.firecrawlActions.getCrawlStatusOnly, {
        crawlJobId: crawlResult.crawlJobId,
        autoPaginate: true,
      });
      if (finalSnapshot.status !== "completed") {
        throw new Error(`Crawl timed out after ${MAX_CRAWL_MINUTES} minutes. Status: ${finalSnapshot.status}`);
      }
      discoveredUrls = finalSnapshot.pages;

      await ctx.runMutation(internal.leadGen.audit.updateAuditPhaseStatus, {
        auditJobId: args.auditJobId,
        phaseName: "map_urls",
        status: "complete",
      });

      console.log(`[Audit Action] Phase 1 complete: discovered ${discoveredUrls.length} URLs`);

      // Phase 2: Filter URLs
      console.log(`[Audit Action] Phase 2: Filter URLs`);
      
      await ctx.runMutation(internal.leadGen.audit.updateAuditPhaseStatus, {
        auditJobId: args.auditJobId,
        phaseName: "filter_urls",
        status: "running",
      });

      const relevantUrls = await ctx.runAction(internal.leadGen.audit.filterRelevantUrls, {
        auditJobId: args.auditJobId,
        agencyId: args.agencyId,
        pages: discoveredUrls,
      });

      await ctx.runMutation(internal.leadGen.audit.updateAuditPhaseStatus, {
        auditJobId: args.auditJobId,
        phaseName: "filter_urls",
        status: "complete",
      });

      console.log(`[Audit Action] Phase 2 complete: filtered to ${relevantUrls.length} relevant URLs`);

      // Phase 3: Scrape Content (using the proper firecrawlActions pattern)
      console.log(`[Audit Action] Phase 3: Scrape Content`);
      
      await ctx.runMutation(internal.leadGen.audit.updateAuditPhaseStatus, {
        auditJobId: args.auditJobId,
        phaseName: "scrape_content",
        status: "running",
      });

      const scrapedContent = await ctx.runAction(internal.firecrawlActions.scrapeAuditUrls, {
        auditJobId: args.auditJobId,
        urls: relevantUrls,
      });

      await ctx.runMutation(internal.leadGen.audit.updateAuditPhaseStatus, {
        auditJobId: args.auditJobId,
        phaseName: "scrape_content",
        status: "complete",
      });

      console.log(`[Audit Action] Phase 3 complete: scraped ${scrapedContent.length} pages`);

      // Phase 4: Generate Dossier
      console.log(`[Audit Action] Phase 4: Generate Dossier`);
      
      await ctx.runMutation(internal.leadGen.audit.updateAuditPhaseStatus, {
        auditJobId: args.auditJobId,
        phaseName: "generate_dossier",
        status: "running",
      });

      const dossierResult = await ctx.runAction(internal.leadGen.audit.generateDossierAndFitReason, {
        auditJobId: args.auditJobId,
        opportunityId: args.opportunityId,
        agencyId: args.agencyId,
        scrapedContent,
      });

      await ctx.runMutation(internal.leadGen.audit.updateAuditPhaseStatus, {
        auditJobId: args.auditJobId,
        phaseName: "generate_dossier",
        status: "complete",
      });

      // Mark audit job as completed
      await ctx.runMutation(internal.leadGen.audit.updateAuditJobStatus, {
        auditJobId: args.auditJobId,
        status: "completed",
      });

      // Update opportunity status to READY
      await ctx.runMutation(internal.leadGen.audit.updateOpportunityStatus, {
        opportunityId: args.opportunityId,
        status: "READY",
      });

      console.log(`[Audit Action] Complete: created dossier ${dossierResult.dossierId} for opportunity ${args.opportunityId}`);

    } catch (error) {
      const errorMessage = String(error);
      console.error(`[Audit Action] Failed for opportunity ${args.opportunityId}:`, errorMessage);
      
      // Mark audit job as failed
      await ctx.runMutation(internal.leadGen.audit.updateAuditJobStatus, {
        auditJobId: args.auditJobId,
        status: "error",
      });

      // Update opportunity status to indicate audit failure
      await ctx.runMutation(internal.leadGen.audit.updateOpportunityStatus, {
        opportunityId: args.opportunityId,
        status: "DATA_READY", // Fall back to basic data ready state
      });

      throw new Error(`Audit action failed: ${errorMessage}`);
    }

    return null;
  },
});

