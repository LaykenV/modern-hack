import { v } from "convex/values";
import { workflow } from "../workflows";
import { internal } from "../_generated/api";

// Onboarding Workflow Definition
export const onboardingWorkflow = workflow.define({
  args: { sellerBrainId: v.id("seller_brain"), companyName: v.string(), sourceUrl: v.string() },
  handler: async (step, args): Promise<null> => {
    const { onboardingFlowId } = await step.runMutation(internal.onboarding.init.initOnboarding, args);
    
    // Create threads for AI agents
    const threads = await step.runAction(internal.onboarding.init.createThreads, { onboardingFlowId });
    await step.runMutation(internal.onboarding.init.setThreads, { onboardingFlowId, ...threads });

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
          internal.firecrawlActions.getCrawlStatus,
          { crawlJobId: started.crawlJobId, autoPaginate: i === 0 },
          i === 0 ? 
            { retry: { maxAttempts: 3, initialBackoffMs: 1000, base: 2 } } : 
            { runAfter: 2000, retry: { maxAttempts: 2, initialBackoffMs: 500, base: 2 } },
        );
        await step.runMutation(internal.onboarding.crawl.upsertCrawlPages, { 
          onboardingFlowId, 
          sellerBrainId: args.sellerBrainId, 
          pages: snapshot.pages, 
          totals: { total: snapshot.total, completed: snapshot.completed } 
        });
        
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
      const finalSnapshot = await step.runAction(internal.firecrawlActions.getCrawlStatus, { crawlJobId: started.crawlJobId, autoPaginate: true });
      if (finalSnapshot.status !== "completed") {
        throw new Error(`Crawl timed out after ${MAX_CRAWL_MINUTES} minutes (demo timeout). Status: ${finalSnapshot.status}`);
      }
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

    // Filter relevant pages
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
      const allPages = await step.runQuery(internal.onboarding.queries.listFlowPages, { onboardingFlowId });
      await step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
        onboardingFlowId,
        phaseName: "filter",
        current: 0,
        total: 1,
        subPhaseProgress: 0.6,
      });
      relevant = await step.runAction(internal.onboarding.filter.filterRelevantPages, { pages: allPages });
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
        sellerBrainId: args.sellerBrainId, 
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

    // Smart agent streaming summary after scraping
    try {
      await step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
        onboardingFlowId,
        phaseName: "summary",
        status: "running",
        current: 0,
        total: 1,
        subPhaseProgress: 0.1,
        eventMessage: "Generating summary"
      });
      await step.runAction(internal.onboarding.summary.streamSummary, { 
        onboardingFlowId, 
        smartThreadId: threads.smartThreadId, 
        companyName: args.companyName, 
        sourceUrl: args.sourceUrl, 
        contextUrls: relevant 
      }, { retry: true });
      await step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
        onboardingFlowId,
        phaseName: "summary",
        current: 0,
        total: 1,
        subPhaseProgress: 0.7,
      });
      const { summary } = await step.runAction(internal.onboarding.summary.finalizeSummary, { 
        smartThreadId: threads.smartThreadId 
      }, { retry: true });
      await step.runMutation(internal.onboarding.summary.saveSummaryAndSeed, { 
        sellerBrainId: args.sellerBrainId, 
        onboardingFlowId, 
        summary 
      });
      await step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
        onboardingFlowId,
        phaseName: "summary",
        status: "complete",
        current: 1,
        total: 1,
        eventMessage: "Summary completed"
      });
    } catch (e) {
      await step.runMutation(internal.onboarding.statusUtils.recordFlowError, { onboardingFlowId, phase: "summary", error: String(e) });
      throw new Error(`Summary phase failed: ${String(e)}`);
    }

    // Claims generation phase
    try {
      await step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
        onboardingFlowId,
        phaseName: "claims",
        status: "running",
        current: 0,
        total: 1,
        subPhaseProgress: 0.2,
        eventMessage: "Generating claims"
      });
      const candidates = await step.runAction(internal.onboarding.claims.generateClaims, { onboardingFlowId }, { retry: true });
      await step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
        onboardingFlowId,
        phaseName: "claims",
        status: "complete",
        current: 1,
        total: 1,
        eventMessage: "Claims generated"
      });
      
      // Verification phase
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
      const phase = msg.includes("verify") ? "verify" : "claims";
      await step.runMutation(internal.onboarding.statusUtils.recordFlowError, { onboardingFlowId, phase, error: msg });
      throw new Error(`Claims/Verify phase failed: ${msg}`);
    }

    await step.runMutation(internal.onboarding.statusUtils.completeFlow, { onboardingFlowId });
    return null;
  },
});


