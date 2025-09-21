import { v } from "convex/values";
import { workflow } from "../workflows";
import { internal } from "../_generated/api";

// Onboarding Workflow Definition
export const onboardingWorkflow = workflow.define({
  args: { agencyProfileId: v.id("agency_profile"), companyName: v.string(), sourceUrl: v.string(), userId: v.string() },
  handler: async (step, args): Promise<null> => {
    const { onboardingFlowId } = await step.runMutation(internal.onboarding.init.initOnboarding, {
      agencyProfileId: args.agencyProfileId,
      companyName: args.companyName,
      sourceUrl: args.sourceUrl,
      userId: args.userId,
    });
    
    // Create threads for AI agents
    const threads = await step.runAction(internal.onboarding.init.createThreads, { onboardingFlowId });
    await step.runMutation(internal.onboarding.init.setThreads, { onboardingFlowId, ...threads });

    // Discovered pages from crawl phase (used in filter phase)
    let discoveredPages: Array<{ url: string; title?: string }> = [];

    try {
      // Start crawl phase with custom retry for network operations
      const started = await step.runAction(internal.firecrawlActions.startCrawl, { sourceUrl: args.sourceUrl }, { 
        retry: { maxAttempts: 5, initialBackoffMs: 2000, base: 2 }
      });
      await step.runMutation(internal.onboarding.crawl.markCrawlStarted, { onboardingFlowId, crawlJobId: started.crawlJobId });
      await step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
        onboardingFlowId,
        phaseName: "crawl",
        status: "running",
        current: 0,
        total: 1,
        subPhaseProgress: 0.1,
        eventMessage: "Crawl started"
      });
      
      // Monitor crawl progress with configurable timeout - reduced for hackathon demo reliability
      const MAX_CRAWL_MINUTES = 5;
      const POLL_INTERVAL_MS = 2000;
      const maxIterations = (MAX_CRAWL_MINUTES * 60 * 1000) / POLL_INTERVAL_MS;
      
      for (let i = 0; i < maxIterations; i++) {
        const snapshot = await step.runAction(
          internal.firecrawlActions.getCrawlStatusOnly,
          { 
            crawlJobId: started.crawlJobId, 
            autoPaginate: i === 0 
          },
          i === 0 ? 
            { retry: { maxAttempts: 3, initialBackoffMs: 1000, base: 2 } } : 
            { runAfter: 2000, retry: { maxAttempts: 2, initialBackoffMs: 500, base: 2 } },
        );
        
        // Store discovered pages for filtering (don't save to DB yet)
        discoveredPages = snapshot.pages;
        
        // Update crawl progress using Firecrawl's completed/total directly
        if (snapshot.total && snapshot.completed !== undefined) {
          await step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
            onboardingFlowId,
            phaseName: "crawl",
            current: snapshot.completed,
            total: snapshot.total,
            subPhaseProgress: 0.1, // Initial discovery complete
          });
        }
        
        if (snapshot.status === "completed") break;
        if (snapshot.status === "failed") throw new Error("Crawl job failed");
      }
      
      // Check if we timed out
      const finalSnapshot = await step.runAction(internal.firecrawlActions.getCrawlStatusOnly, { 
        crawlJobId: started.crawlJobId, 
        autoPaginate: true 
      });
      if (finalSnapshot.status !== "completed") {
        throw new Error(`Crawl timed out after ${MAX_CRAWL_MINUTES} minutes (demo timeout). Status: ${finalSnapshot.status}`);
      }
      discoveredPages = finalSnapshot.pages;
      await step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
        onboardingFlowId,
        phaseName: "crawl",
        status: "complete",
        current: 1,
        total: 1,
        eventMessage: "Crawl completed"
      });
    } catch (e) {
      await step.runMutation(internal.onboarding.statusUtils.recordFlowError, { onboardingFlowId, phase: "crawl", error: String(e) });
      throw new Error(`Crawl phase failed: ${String(e)}`);
    }

    // Filter relevant pages and save them to database
    let relevant: Array<string> = [];
    try {
      await step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
        onboardingFlowId,
        phaseName: "filter",
        status: "running",
        current: 0,
        total: 1,
        subPhaseProgress: 0.2,
        eventMessage: "Filtering relevant pages"
      });
      
      // Filter using the discovered pages from crawl (not from database)
      relevant = await step.runAction(internal.onboarding.filter.filterRelevantPages, { 
        pages: discoveredPages, 
        onboardingFlowId 
      });
      
      await step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
        onboardingFlowId,
        phaseName: "filter",
        current: 0,
        total: 1,
        subPhaseProgress: 0.6,
      });
      
      // Save filtered pages to database and set relevant pages list
      await step.runAction(internal.onboarding.filter.saveFilteredPages, {
        onboardingFlowId,
        agencyProfileId: args.agencyProfileId,
        relevantPages: relevant,
        discoveredPages: discoveredPages
      });
      await step.runMutation(internal.onboarding.filter.setRelevantPages, { onboardingFlowId, relevantPages: relevant });
      
      await step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
        onboardingFlowId,
        phaseName: "filter",
        status: "complete",
        current: 1,
        total: 1,
        eventMessage: "Filtering completed"
      });
    } catch (e) {
      await step.runMutation(internal.onboarding.statusUtils.recordFlowError, { onboardingFlowId, phase: "filter", error: String(e) });
      throw new Error(`Filter phase failed: ${String(e)}`);
    }

    // High-fidelity scrape of relevant pages
    try {
      await step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
        onboardingFlowId,
        phaseName: "scrape",
        status: "running",
        current: 0,
        total: relevant.length,
        subPhaseProgress: 0.2,
        eventMessage: "Scraping relevant pages"
      });
      await step.runAction(internal.firecrawlActions.scrapeRelevantPages, { 
        onboardingFlowId, 
        agencyProfileId: args.agencyProfileId, 
        urls: relevant 
      }, { retry: { maxAttempts: 4, initialBackoffMs: 1500, base: 2 } });
      await step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
        onboardingFlowId,
        phaseName: "scrape",
        status: "complete",
        current: relevant.length,
        total: relevant.length,
        eventMessage: "Scraping completed"
      });
    } catch (e) {
      await step.runMutation(internal.onboarding.statusUtils.recordFlowError, { onboardingFlowId, phase: "scrape", error: String(e) });
      throw new Error(`Scrape phase failed: ${String(e)}`);
    }

    // Parallel generation phase - Summary, Core Offer, and Claims
    try {
      // Mark all three phases as running
      await Promise.all([
        step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
          onboardingFlowId,
          phaseName: "summary",
          status: "running",
          current: 0,
          total: 1,
          subPhaseProgress: 0.1,
          eventMessage: "Generating summary"
        }),
        step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
          onboardingFlowId,
          phaseName: "coreOffer",
          status: "running",
          current: 0,
          total: 1,
          subPhaseProgress: 0.1,
          eventMessage: "Generating core offer"
        }),
        step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
          onboardingFlowId,
          phaseName: "claims",
          status: "running",
          current: 0,
          total: 1,
          subPhaseProgress: 0.1,
          eventMessage: "Generating claims"
        })
      ]);

      // Run all three generations in parallel
      const [summaryResult, coreOfferResult, claimsResult] = await Promise.all([
        step.runAction(internal.onboarding.summary.streamSummary, { 
          onboardingFlowId, 
          summaryThread: threads.summaryThread, 
          companyName: args.companyName, 
          sourceUrl: args.sourceUrl, 
          contextUrls: relevant 
        }, { retry: true }),
        step.runAction(internal.onboarding.offer.generateCoreOffer, { 
          onboardingFlowId, 
          coreOfferThread: threads.coreOfferThread, 
          companyName: args.companyName, 
          sourceUrl: args.sourceUrl, 
          contextUrls: relevant 
        }, { retry: true }),
        step.runAction(internal.onboarding.claims.generateClaims, { onboardingFlowId }, { retry: true })
      ]);

      // Finalization group - run in parallel where safe
      const [finalizedSummary] = await Promise.all([
        // Summary finalization
        step.runAction(internal.onboarding.summary.finalizeSummary, { 
          summaryThread: threads.summaryThread 
        }, { retry: true }),
        // Core offer is already finalized from generation
        Promise.resolve(coreOfferResult)
      ]);

      // Save results and mark phases complete
      await Promise.all([
        // Save summary
        step.runMutation(internal.onboarding.summary.saveSummaryAndSeed, { 
          agencyProfileId: args.agencyProfileId, 
          onboardingFlowId, 
          summary: finalizedSummary.summary 
        }).then(() => 
          step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
            onboardingFlowId,
            phaseName: "summary",
            status: "complete",
            current: 1,
            total: 1,
            eventMessage: "Summary completed"
          })
        ),
        // Save core offer
        step.runMutation(internal.onboarding.offer.saveCoreOffer, { 
          agencyProfileId: args.agencyProfileId, 
          coreOffer: coreOfferResult.coreOffer 
        }).then(() =>
          step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
            onboardingFlowId,
            phaseName: "coreOffer",
            status: "complete",
            current: 1,
            total: 1,
            eventMessage: "Core offer completed"
          })
        ),
        // Mark claims generation complete (verification happens next)
        step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
          onboardingFlowId,
          phaseName: "claims",
          status: "complete",
          current: 1,
          total: 1,
          eventMessage: "Claims generated"
        })
      ]);

      // Claims verification phase (sequential to avoid thread contention)
      const candidates = claimsResult;
      await step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
        onboardingFlowId,
        phaseName: "verify",
        status: "running",
        current: 0,
        total: candidates.length,
        subPhaseProgress: 0.2,
        eventMessage: "Verifying claims"
      });
      await step.runAction(internal.onboarding.claims.verifyClaims, { onboardingFlowId, candidates }, { retry: true });
      await step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
        onboardingFlowId,
        phaseName: "verify",
        status: "complete",
        current: candidates.length,
        total: candidates.length,
        eventMessage: "Claims verified"
      });

    } catch (e) {
      // Determine which phase failed based on message
      const msg = String(e ?? "");
      let phase = "summary"; // default
      if (msg.includes("core offer") || msg.includes("coreOffer")) phase = "coreOffer";
      else if (msg.includes("claims")) phase = "claims";
      else if (msg.includes("verify")) phase = "verify";
      
      await step.runMutation(internal.onboarding.statusUtils.recordFlowError, { onboardingFlowId, phase: phase as "crawl" | "filter" | "scrape" | "summary" | "coreOffer" | "claims" | "verify", error: msg });
      throw new Error(`Generation/Verification phase failed: ${msg}`);
    }

    await step.runMutation(internal.onboarding.statusUtils.completeFlow, { onboardingFlowId });
    return null;
  },
});


