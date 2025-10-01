/**
 * Audit job management and workflow for lead generation
 * Handles per-opportunity deep analysis: URL discovery, filtering, scraping, and dossier generation
 */

import { internalMutation, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { atlasAgentGroq } from "../agent";
import type { GenericActionCtx } from "convex/server";
import type { Id, DataModel } from "../_generated/dataModel";
import { z } from "zod";

/**
 * Zod schema for audit dossier generation
 * Used with generateObject to ensure structured, validated output
 */
const DossierSchema = z.object({
  summary: z.string()
    .min(20)
    .describe("2-3 sentence business summary: what they do, who they serve, key value propositions"),
  
  primary_email: z.string()
    .email()
    .nullable()
    .describe("Best contact email found on website (info@, contact@, hello@, sales@, or named contact). Return null if not found."),
  
  gaps: z.array(
    z.object({
      key: z.string().describe("Gap category (e.g., 'SEO Optimization', 'Mobile UX', 'Content Strategy')"),
      value: z.string().describe("Specific gap description with actionable detail"),
      source_url: z.string().url().optional().describe("Supporting URL from scraped pages"),
    })
  )
    .min(2)
    .max(5)
    .describe("3-5 specific technical, marketing, operational, or strategic weaknesses we could address"),
  
  talking_points: z.array(
    z.object({
      text: z.string().describe("Specific conversation starter connecting our capabilities to their needs"),
      source_url: z.string().url().optional().describe("Supporting URL from scraped pages"),
    })
  )
    .min(2)
    .max(4)
    .describe("3-4 conversation starters for sales outreach"),
  
  fit_reason: z.string()
    .max(150)
    .describe("Concise 1-2 sentence explanation of why this prospect is a good fit, under 150 characters"),
});

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
    analysisThread: v.optional(v.string()), // Thread for AI analysis context
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
      analysisThread: args.analysisThread, // Store the analysis thread
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
    sources: v.optional(v.array(v.object({
      url: v.string(),
      title: v.optional(v.string()),
    }))),
    email: v.optional(v.string()), // Optional email extracted from website analysis
  },
  returns: v.id("audit_dossier"),
  handler: async (ctx, args) => {
    const dossierId = await ctx.db.insert("audit_dossier", {
      opportunityId: args.opportunityId,
      auditJobId: args.auditJobId,
      summary: args.summary,
      identified_gaps: args.identifiedGaps,
      talking_points: args.talkingPoints,
      sources: args.sources,
    });

    // Link dossier to audit job
    await ctx.db.patch(args.auditJobId, {
      dossierId,
    });

    // Update opportunity email if a new email was found and differs from stored value
    if (args.email) {
      const currentOpportunity = await ctx.db.get(args.opportunityId);
      if (currentOpportunity && currentOpportunity.email !== args.email) {
        await ctx.db.patch(args.opportunityId, {
          email: args.email,
        });
        console.log(`[Audit Dossier] Updated opportunity ${args.opportunityId} email to ${args.email}`);
      }
    }

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
 * Save scraped page with storage reference (upgrade plan requirement)
 */
export const saveScrapedPageWithStorage = internalMutation({
  args: {
    auditJobId: v.id("audit_jobs"),
    opportunityId: v.id("client_opportunities"),
    url: v.string(),
    title: v.optional(v.string()),
    httpStatus: v.optional(v.number()),
    contentRef: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { auditJobId, opportunityId, url, title, httpStatus, contentRef } = args;
    
    // Check for existing page and upsert
    const existing = await ctx.db
      .query("audit_scraped_pages")
      .withIndex("by_auditJobId_and_url", (q) => 
        q.eq("auditJobId", auditJobId).eq("url", url)
      )
      .unique();
    
    if (existing) {
      // Update existing page
      await ctx.db.patch(existing._id, {
        title: title ?? existing.title,
        httpStatus: httpStatus ?? existing.httpStatus,
        contentRef,
      });
    } else {
      // Insert new page
      await ctx.db.insert("audit_scraped_pages", {
        auditJobId,
        opportunityId,
        url,
        title,
        httpStatus,
        contentRef,
      });
    }
    
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
    const { auditJobId, pages, agencyId } = args;
    
    // Get audit job to access analysisThread
    const auditJob = await ctx.runQuery(internal.leadGen.queries.getAuditJobById, { 
      auditJobId 
    });
    if (!auditJob) throw new Error("Audit job not found");
    
    // Get agency profile to understand the context
    const agency = await ctx.runQuery(internal.leadGen.queries.getAgencyProfileInternal, { 
      agencyId 
    });
    if (!agency) throw new Error("Agency profile not found");
    
    // Get lead gen flow for userId fallback
    const leadGenFlow = auditJob.leadGenFlowId 
      ? await ctx.runQuery(internal.leadGen.queries.getLeadGenFlowInternal, { 
          leadGenFlowId: auditJob.leadGenFlowId 
        })
      : null;

    // Deduplicate pages
    const deduplicatedPages = pages.filter((page, index, arr) => 
      arr.findIndex(p => p.url === page.url) === index
    );
    
    const top = deduplicatedPages.slice(0, 40); // Limit for processing

    const prompt = `Rank the following website URLs by relevance for lead generation audit and sales intelligence.

Context: We're auditing a potential client website to understand their business, identify gaps, and create talking points for sales outreach. We also need to extract contact information for follow-up.

Instructions:
- PRIORITIZE: homepage, product/services/solutions, pricing, about/company, case studies/testimonials, team/leadership
- INCLUDE: contact/contact-us pages (essential for email discovery), key feature pages, integration/partner pages, resources/documentation if core to business
- ENSURE: At least one contact-style page is included in the selection when available (contact, contact-us, get-in-touch, etc.)
- DEPRIORITIZE: blog posts (unless recent and highly relevant), careers, legal/privacy
- EXCLUDE: URLs with query params, anchors, or duplicate content
- LIMIT: return exactly 4 most relevant URLs for comprehensive business understanding and contact discovery
- USE ONLY the provided URLs; do not invent new ones

Output (JSON only, no prose): {"urls": [string, ...]}

URLs:
${top.map((p, i) => `[${i + 1}] ${p.title ? `${p.title} — ` : ""}${p.url}`).join("\n")}`;

    try {
      // Use thread context for filtering with userId fallback (upgrade plan requirement)
      const threadContext = auditJob.analysisThread 
        ? { threadId: auditJob.analysisThread }
        : leadGenFlow?.userId 
        ? { userId: leadGenFlow.userId }
        : {};
      
      const res = await atlasAgentGroq.generateText(ctx, threadContext, { prompt });
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
          const hasContact = url.includes('/contact') || title.includes('contact') || 
                           url.includes('/get-in-touch') || title.includes('get in touch');
          
          return isHomepage || hasProduct || hasPricing || hasAbout || hasService || hasContact;
        })
        .slice(0, 4)
        .map(p => p.url);
        
      return fallbackUrls.length > 0 ? fallbackUrls : top.slice(0, 3).map(p => p.url);
    }
  },
});


/**
 * Helper function to generate dossier and fit reason
 */
async function generateDossierAndFitReasonHelper(
  ctx: GenericActionCtx<DataModel>,
  args: {
    auditJobId: Id<"audit_jobs">;
    opportunityId: Id<"client_opportunities">;
    agencyId: Id<"agency_profile">;
    scrapedPages: Array<{
      url: string;
      title?: string;
      contentRef?: Id<"_storage">;
    }>;
  }
): Promise<{ dossierId: Id<"audit_dossier">; fitReason: string }> {
    const { auditJobId, opportunityId, agencyId, scrapedPages } = args;
    
    // Get audit job to access analysisThread
    const auditJob = await ctx.runQuery(internal.leadGen.queries.getAuditJobById, { 
      auditJobId 
    });
    if (!auditJob) throw new Error("Audit job not found");
    
    // Get lead gen flow for userId fallback
    const leadGenFlow = auditJob.leadGenFlowId 
      ? await ctx.runQuery(internal.leadGen.queries.getLeadGenFlowInternal, { 
          leadGenFlowId: auditJob.leadGenFlowId 
        })
      : null;
    
    // Get opportunity and agency details
    const opportunity = await ctx.runQuery(internal.leadGen.queries.getOpportunityById, {
      opportunityId,
    });
    if (!opportunity) throw new Error("Opportunity not found");
    
    const agency = await ctx.runQuery(internal.leadGen.queries.getAgencyProfileInternal, {
      agencyId,
    });
    if (!agency) throw new Error("Agency profile not found");

    // Load and prepare context from storage references (upgrade plan requirement)
    const contextLines: Array<string> = [];
    const pagesWithContent = scrapedPages.filter(page => page.contentRef);
    
    let successfullyLoadedPages = 0;
    
    for (const page of pagesWithContent.slice(0, 8)) { // Limit to prevent memory issues
      try {
        if (page.contentRef) {
          const blob = await ctx.storage.get(page.contentRef);
          if (blob) {
            const text = await blob.text();
            // Truncate content for analysis (similar to onboarding pattern)
            const truncated = text.slice(0, 4000);
            contextLines.push(`URL: ${page.url}\nTitle: ${page.title || 'N/A'}\nContent:\n${truncated}\n\n---\n\n`);
            successfullyLoadedPages++;
          }
        }
      } catch (error) {
        console.error(`[Audit Dossier] Failed to load content for ${page.url}:`, error);
        contextLines.push(`URL: ${page.url}\nTitle: ${page.title || 'N/A'}\nContent: [Content loading failed]\n\n---\n\n`);
      }
    }
    
    const contextContent = contextLines.join('');
    
    // Early validation: ensure we have meaningful content
    if (contextContent.length < 100 || successfullyLoadedPages === 0) {
      console.error(`[Audit Dossier] Insufficient content loaded. Content length: ${contextContent.length}, Successful pages: ${successfullyLoadedPages}`);
      throw new Error("Insufficient content for analysis");
    }
    
    console.log(`[Audit Dossier] Loaded ${successfullyLoadedPages}/${pagesWithContent.length} pages successfully (${contextContent.length} chars) for ${opportunity.name}`);

    // Generate comprehensive dossier using generateText with Zod validation
    const dossierPrompt = `You are a sales intelligence analyst. Analyze this potential client's website and create a detailed sales dossier.

AGENCY CONTEXT:
- Company: ${agency.companyName}
- Core Offer: ${agency.coreOffer || 'Not specified'}
- Summary: ${agency.summary || 'Not available'}

PROSPECT CONTEXT:
- Company: ${opportunity.name}
- Qualification Signals: ${opportunity.signals.join(', ') || 'None'}
- Industry: ${opportunity.targetVertical}
- Location: ${opportunity.targetGeography}

WEBSITE CONTENT (${successfullyLoadedPages} pages analyzed):
${contextContent}

INSTRUCTIONS:
1. BUSINESS SUMMARY: Write 2-3 sentences explaining what they do, who they serve, and their key value propositions (minimum 20 characters)
2. IDENTIFIED GAPS: Find 3-5 SPECIFIC technical, marketing, operational, or strategic weaknesses we could address
   - Each gap must be actionable and verifiable from the content
   - Include source_url when possible
   - Example: {"key": "SEO Optimization", "value": "Homepage missing meta description and H1 tag", "source_url": "https://..."}
3. TALKING POINTS: Create 3-4 conversation starters that connect our capabilities to their needs
   - Be specific, reference actual content from their site
   - Include source_url when possible
4. PRIMARY EMAIL: Extract the best contact email found (info@, contact@, hello@, sales@, support@, or named contacts)
   - Return null if no email found
   - Must be a valid email format
5. FIT REASON: Write a concise 1-2 sentence explanation (under 150 characters) of why this prospect is a good fit
   - Reference their qualification signals: ${opportunity.signals.join(', ')}
   - Connect to our core offering

CRITICAL FORMATTING REQUIREMENTS:
- Return ONLY valid JSON, no additional text or explanation
- Do not wrap in markdown code blocks
- Use exactly this structure:
{
  "summary": "2-3 sentence business summary...",
  "primary_email": "contact@example.com or null",
  "gaps": [
    {"key": "Gap Category", "value": "Specific gap description", "source_url": "https://..."},
    ...
  ],
  "talking_points": [
    {"text": "Talking point text", "source_url": "https://..."},
    ...
  ],
  "fit_reason": "One sentence under 150 chars"
}

Generate the JSON now:`;

    try {
      // Use thread context with userId fallback (upgrade plan requirement)
      const threadContext: { threadId?: string; userId?: string } = auditJob.analysisThread 
        ? { threadId: auditJob.analysisThread }
        : leadGenFlow?.userId 
        ? { userId: leadGenFlow.userId }
        : {};
      
      console.log(`[Audit Dossier] Starting generateText for ${opportunity.name}`, {
        threadContext,
        contentLength: contextContent.length,
        pagesLoaded: successfullyLoadedPages,
        promptLength: dossierPrompt.length,
      });
      
      // Use generateText with Zod validation for structured output
      const result = await atlasAgentGroq.generateText(
        ctx,
        threadContext,
        {
          prompt: dossierPrompt,
        }
      );

      console.log(`[Audit Dossier] generateText completed for ${opportunity.name}`, {
        hasResult: !!result,
        hasText: !!result?.text,
        textLength: result?.text?.length || 0,
        textPreview: result?.text?.slice(0, 200),
      });

      // Parse and validate with Zod schema
      let parsedData;
      try {
        // Clean up common LLM formatting issues
        let cleanedText = (result.text ?? "").trim();
        
        // Remove markdown code blocks if present
        if (cleanedText.startsWith("```json")) {
          cleanedText = cleanedText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        } else if (cleanedText.startsWith("```")) {
          cleanedText = cleanedText.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }
        
        console.log(`[Audit Dossier] Cleaned text for parsing:`, {
          originalLength: result.text?.length || 0,
          cleanedLength: cleanedText.length,
          cleanedPreview: cleanedText.slice(0, 200),
        });
        
        parsedData = JSON.parse(cleanedText);
        console.log(`[Audit Dossier] JSON parsed successfully:`, {
          keys: Object.keys(parsedData),
        });
        
      } catch (parseError) {
        console.error(`[Audit Dossier] JSON parse failed for ${opportunity.name}:`, {
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
          rawText: result.text,
        });
        throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      // Validate with Zod schema
      const validatedData = DossierSchema.parse(parsedData);
      
      console.log(`[Audit Dossier] Zod validation successful for ${opportunity.name}:`, {
        gapsCount: validatedData.gaps.length,
        talkingPointsCount: validatedData.talking_points.length,
        hasEmail: !!validatedData.primary_email,
        summaryLength: validatedData.summary.length,
        fitReasonLength: validatedData.fit_reason.length,
      });

      // Extract email from AI response (validated by Zod schema)
      const extractedEmail = validatedData.primary_email ?? undefined;

      // Create dossier in database (upgrade plan: compact with optional sources)
      const dossierId = await ctx.runMutation(internal.leadGen.audit.createAuditDossier, {
        opportunityId,
        auditJobId: args.auditJobId,
        summary: validatedData.summary,
        identifiedGaps: validatedData.gaps.map(gap => ({
          key: gap.key,
          value: gap.value,
          source_url: gap.source_url,
        })),
        talkingPoints: validatedData.talking_points.map((tp, index) => ({
          text: tp.text,
          approved_claim_id: `generated_${index}`,
          source_url: tp.source_url,
        })),
        // Optional sources list for display (no embedded content)
        sources: pagesWithContent.slice(0, successfullyLoadedPages).map(page => ({
          url: page.url,
          title: page.title,
        })),
        email: extractedEmail,
      });

      // Save fit reason to opportunity
      await ctx.runMutation(internal.leadGen.audit.saveFitReason, {
        opportunityId,
        fitReason: validatedData.fit_reason,
      });

      console.log(`[Audit Dossier] Created dossier ${dossierId} for ${opportunity.name}`);
      
      return {
        dossierId,
        fitReason: validatedData.fit_reason,
      };
      
    } catch (error) {
      // This ONLY catches AI generation failures now, not content loading issues
      console.error(`[Audit Dossier] AI generation failed for ${opportunity.name}:`, {
        errorType: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        contentLength: contextContent.length,
        pagesLoaded: successfullyLoadedPages,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
      
      // Fallback: create minimal dossier
      const fallbackSummary: string = `${opportunity.name} is a ${opportunity.targetVertical} business in ${opportunity.targetGeography}. Qualification signals: ${opportunity.signals.join(', ')}.`;
      const fallbackFitReason: string = `${opportunity.name} shows ${opportunity.signals.length} qualification signals indicating potential for our services.`;
      
      const dossierId = await ctx.runMutation(internal.leadGen.audit.createAuditDossier, {
        opportunityId,
        auditJobId: args.auditJobId,
        summary: fallbackSummary,
        identifiedGaps: [
          {
            key: "Website Analysis",
            value: "Detailed analysis requires manual review",
            source_url: pagesWithContent[0]?.url,
          }
        ],
        talkingPoints: [
          {
            text: `Discuss ${opportunity.targetVertical} challenges and our solutions`,
            approved_claim_id: "fallback_1",
            source_url: pagesWithContent[0]?.url,
          }
        ],
        sources: pagesWithContent.map(page => ({
          url: page.url,
          title: page.title,
        })),
        email: undefined, // No email extraction in fallback case
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
}

/**
 * Generate dossier and fit reason using AI agent
 */
export const generateDossierAndFitReason = internalAction({
  args: {
    auditJobId: v.id("audit_jobs"),
    opportunityId: v.id("client_opportunities"),
    agencyId: v.id("agency_profile"),
    scrapedPages: v.array(v.object({
      url: v.string(),
      title: v.optional(v.string()),
      contentRef: v.optional(v.id("_storage")),
    })),
  },
  returns: v.object({
    dossierId: v.id("audit_dossier"),
    fitReason: v.string(),
  }),
  handler: async (ctx, args) => {
    return await generateDossierAndFitReasonHelper(ctx, args);
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
    customerId: v.optional(v.string()), // For background workflow billing context
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

      const scrapedPages = await ctx.runAction(internal.firecrawlActions.scrapeAuditUrls, {
        auditJobId: args.auditJobId,
        opportunityId: args.opportunityId,
        urls: relevantUrls,
      });

      await ctx.runMutation(internal.leadGen.audit.updateAuditPhaseStatus, {
        auditJobId: args.auditJobId,
        phaseName: "scrape_content",
        status: "complete",
      });

      console.log(`[Audit Action] Phase 3 complete: scraped ${scrapedPages.length} pages`);

      // Phase 4: Generate Dossier
      console.log(`[Audit Action] Phase 4: Generate Dossier`);
      
      await ctx.runMutation(internal.leadGen.audit.updateAuditPhaseStatus, {
        auditJobId: args.auditJobId,
        phaseName: "generate_dossier",
        status: "running",
      });

      const dossierResult = await generateDossierAndFitReasonHelper(ctx, {
        auditJobId: args.auditJobId,
        opportunityId: args.opportunityId,
        agencyId: args.agencyId,
        scrapedPages,
      });

      await ctx.runMutation(internal.leadGen.audit.updateAuditPhaseStatus, {
        auditJobId: args.auditJobId,
        phaseName: "generate_dossier",
        status: "complete",
      });

      // Idempotent billing: check if already metered before tracking usage
      const isAlreadyMetered = await ctx.runQuery(internal.leadGen.statusUtils.isAuditJobMetered, {
        auditJobId: args.auditJobId,
      });

      if (!isAlreadyMetered) {
        console.log(`[Audit Action] Tracking usage for audit ${args.auditJobId} (not yet metered)`);
        
        try {
          // Track usage for dossier research (1 unit, Autumn multiplies by 2 credits per unit)
          await ctx.runAction(internal.leadGen.billing.trackUsage, {
            featureId: "dossier_research",
            value: 1,
            customerId: args.customerId, // Pass customerId from workflow for background billing context
          });

          // Mark audit job as metered to prevent double-charging
          await ctx.runMutation(internal.leadGen.statusUtils.markAuditJobMetered, {
            auditJobId: args.auditJobId,
          });
          
          console.log(`[Audit Action] Successfully metered audit ${args.auditJobId}`);
        } catch (meteringError) {
          console.error(`[Audit Action] Failed to meter audit ${args.auditJobId}:`, meteringError);
          // Don't throw - let the workflow fallback handle metering
          // The audit job will remain unmetered and the workflow will catch it
        }
      } else {
        console.log(`[Audit Action] Skipping billing for audit ${args.auditJobId} (already metered)`);
      }

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

