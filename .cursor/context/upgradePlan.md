# Onboarding Workflow Fix: Discovery-Only + Journal Size Resolution

## Problem Analysis

### 1. Journal Size Limit Exceeded (1MB Workflow Limit)
- **Root Cause**: Firecrawl's `crawl` mode with `formats: ["markdown", "links"]` scrapes FULL content during discovery
- **Impact**: 29 pages × ~40KB markdown each = ~1.2MB passed through workflow journal
- **Convex Limit**: Workflows can only pass 1MB total data between steps

### 2. Filter Phase Never Executed
- **Root Cause**: Workflow fails during crawl phase due to journal size limit
- **Impact**: All 29 pages get scraped instead of filtered ~10-15 relevant pages
- **Result**: Redundant scraping + massive data overhead

### 3. Redundant Scraping Architecture
- **Current**: Crawl (with content) → Filter → Scrape (same content again)
- **Problem**: Double scraping the same pages with `preserveExistingContent: true`

## Solution Architecture

### New Flow: Discovery → Filter → Targeted Scrape

```markdown:.cursor/context/upgradePlan.md
```
1. DISCOVERY ONLY: Crawl for URLs only (no content)
2. FILTER: Fast agent selects ~10-15 relevant URLs  
3. TARGETED SCRAPE: High-fidelity scrape of ONLY filtered URLs
```

### Key Benefits
- ✅ **Journal Size**: Only URL lists passed between steps (~1KB vs 1.2MB)
- ✅ **Efficiency**: Scrape only 10-15 pages instead of all 29
- ✅ **Filter Works**: Workflow completes crawl phase successfully
- ✅ **No Redundancy**: Each page scraped exactly once

## Implementation Plan

### Phase 1: Fix Firecrawl Discovery Mode

#### 1.1 Update `startCrawl` for Discovery-Only
```typescript
// convex/firecrawlActions.ts
export const startCrawl = internalAction({
  // ... existing args
  handler: async (ctx, { sourceUrl, limit }) => {
    const started = await firecrawl.startCrawl(sourceUrl, {
      limit: limit ?? 60,
      maxDiscoveryDepth: 3,
      allowSubdomains: false,
      crawlEntireDomain: false,
      // ... existing include/exclude paths
      scrapeOptions: { 
        formats: ["links"], // ⚠️ ONLY links - no markdown content
        onlyMainContent: true 
      },
    });
    return { crawlJobId: started.id };
  },
});
```

#### 1.2 Update Page Processing for URL-Only Mode
```typescript
// convex/onboarding/pageUtils.ts - modify upsertPageData
// When markdown is null/undefined, set status to "queued" instead of "scraped"
const newStatus = hasMarkdown ? PageStatus.scraped : PageStatus.queued;
```

### Phase 2: Fix Workflow Journal Size

#### 2.1 Create Combined Action for Status + Processing
```typescript
// convex/firecrawlActions.ts - NEW ACTION
export const getCrawlStatusAndStorePages = internalAction({
  args: {
    crawlJobId: v.string(),
    onboardingFlowId: v.id("onboarding_flow"),
    sellerBrainId: v.id("seller_brain"),
    autoPaginate: v.boolean(),
  },
  returns: v.object({
    status: v.string(),
    total: v.optional(v.number()),
    completed: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    // Get crawl status with page URLs
    const snapshot = await getCrawlStatus(ctx, {
      crawlJobId: args.crawlJobId,
      autoPaginate: args.autoPaginate,
    });
    
    // Store pages immediately - don't return them through workflow
    if (snapshot.pages && snapshot.pages.length > 0) {
      await ctx.runMutation(internal.onboarding.crawl.upsertCrawlPages, {
        onboardingFlowId: args.onboardingFlowId,
        sellerBrainId: args.sellerBrainId,
        pages: snapshot.pages, // Only URLs + titles, no markdown
        totals: { total: snapshot.total, completed: snapshot.completed },
      });
    }
    
    // Return ONLY minimal status data (not page content)
    return {
      status: snapshot.status,
      total: snapshot.total,
      completed: snapshot.completed,
    };
  },
});
```

#### 2.2 Update Workflow Polling Loop
```typescript
// convex/onboarding/workflow.ts - Replace crawl polling
for (let i = 0; i < maxIterations; i++) {
  const snapshot = await step.runAction(
    internal.firecrawlActions.getCrawlStatusAndStorePages,
    { 
      crawlJobId: started.crawlJobId, 
      onboardingFlowId,
      sellerBrainId: args.sellerBrainId,
      autoPaginate: i === 0 
    },
    // ... retry options
  );
  
  // Only minimal status data flows through workflow journal
  if (snapshot.total && snapshot.completed !== undefined) {
    await step.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
      onboardingFlowId,
      phaseName: "crawl",
      current: snapshot.completed,
      total: snapshot.total,
      subPhaseProgress: 0.1,
    });
  }
  
  if (snapshot.status === "completed") break;
  if (snapshot.status === "failed") throw new Error("Crawl job failed");
}
```

### Phase 3: Update Filter Phase for URL-Only Input

#### 3.1 Modify Filter Input Query
```typescript
// convex/onboarding/queries.ts - NEW QUERY
export const listDiscoveredUrls = internalQuery({
  args: { onboardingFlowId: v.id("onboarding_flow") },
  returns: v.array(v.object({ 
    url: v.string(), 
    title: v.optional(v.string()) 
  })),
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("crawl_pages")
      .withIndex("by_flow", (q) => q.eq("onboardingFlowId", args.onboardingFlowId))
      .collect();
    
    // Return only URL + title (no content)
    return pages.map(p => ({ url: p.url, title: p.title }));
  },
});
```

#### 3.2 Update Workflow Filter Phase
```typescript
// convex/onboarding/workflow.ts - Update filter phase
const discoveredUrls = await step.runQuery(
  internal.onboarding.queries.listDiscoveredUrls, 
  { onboardingFlowId }
);

// Filter passes only URL list (minimal data)
relevant = await step.runAction(
  internal.onboarding.filter.filterRelevantPages, 
  { pages: discoveredUrls } // Only URLs, not full page content
);
```

### Phase 4: Optimize Scrape Phase

#### 4.1 Enhanced Scraping with Progress Tracking
```typescript
// convex/firecrawlActions.ts - Update scrapeRelevantPages
export const scrapeRelevantPages = internalAction({
  args: { 
    onboardingFlowId: v.id("onboarding_flow"), 
    sellerBrainId: v.id("seller_brain"), 
    urls: v.array(v.string()) 
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { onboardingFlowId, sellerBrainId, urls } = args;
    const batchSize = 3; // Increased from 2 for better throughput
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const slice = urls.slice(i, i + batchSize);
      
      await Promise.all(
        slice.map(async (url, index) => {
          try {
            const res = await firecrawl.scrape(url, {
              formats: ["markdown"],
              onlyMainContent: false, // Get full content for relevant pages
              maxAge: 0, // Always fresh for important pages
            });
            
            const doc = res.data;
            await ctx.runMutation(internal.onboarding.scrape.saveScrapedPageContent, {
              onboardingFlowId,
              sellerBrainId,
              url: doc?.metadata?.sourceURL ?? url,
              title: doc?.metadata?.title,
              markdown: doc?.markdown,
              statusCode: doc?.metadata?.statusCode,
            });
            
            // Update progress after each page
            await ctx.runMutation(internal.onboarding.statusUtils.updatePhaseStatusWithProgress, {
              onboardingFlowId,
              phaseName: "scrape",
              current: i + index + 1,
              total: urls.length,
              subPhaseProgress: 0.2 + (0.6 * (i + index + 1) / urls.length),
            });
          } catch (error) {
            console.error(`Failed to scrape ${url}:`, error);
            // Continue with other URLs
          }
        })
      );
      
      // Small delay between batches to avoid rate limits
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    return null;
  },
});
```

## Expected Outcomes

### Performance Improvements
- **Journal Size**: ~99% reduction (1.2MB → ~1KB URL lists)
- **Scraping Efficiency**: ~65% reduction (29 pages → ~10-15 pages)
- **Workflow Reliability**: 100% completion rate (no more journal limits)

### User Experience
- **Filter Phase Works**: Users see intelligent page selection
- **Faster Completion**: Less scraping = faster onboarding
- **Better Progress**: Real-time scrape progress updates
- **Higher Quality**: Full content scraping only for relevant pages

### Architecture Benefits
- **Scalable**: Works with any website size
- **Efficient**: Minimal workflow journal usage
- **Reliable**: No more journal size failures
- **Maintainable**: Clear separation of discovery vs scraping

## Implementation Priority

1. **CRITICAL**: Fix journal size issue (Phase 2) - blocks all onboarding
2. **HIGH**: Discovery-only crawl (Phase 1) - enables proper filtering  
3. **MEDIUM**: Filter optimization (Phase 3) - improves relevance
4. **LOW**: Scrape enhancements (Phase 4) - UX improvements

## Testing Strategy

### Test Sites for Validation
- `https://stripe.com` (moderate size, ~25 pages)
- `https://vercel.com` (larger site, ~40+ pages) 
- `https://linear.app` (complex SPA, ~30 pages)

### Success Criteria
- ✅ Workflow completes without journal size errors
- ✅ Filter phase executes and reduces page count by ~60%
- ✅ Only filtered pages get scraped (not all discovered pages)
- ✅ Total onboarding time < 3 minutes for demo sites
- ✅ UI shows proper phase progression with live updates

## Risk Mitigation

### Fallback Strategies
- **Filter Failure**: Use smart fallback selection (product, pricing, docs, about)
- **Scrape Failures**: Continue with partial results, don't fail entire workflow
- **Rate Limits**: Implement exponential backoff and batch size reduction

### Monitoring
- **Journal Size**: Log workflow step sizes to prevent future issues
- **Phase Timing**: Track phase durations for performance optimization
- **Error Rates**: Monitor scraping success rates per site type
```

This comprehensive plan addresses both the immediate journal size issue and implements the proper discovery-only architecture that was originally intended. The key insight is that Firecrawl's crawl mode should be used for discovery only, then targeted scraping should handle content extraction for the filtered relevant pages.
