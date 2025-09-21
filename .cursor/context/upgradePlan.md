## Onboarding Upgrade Plan (UI + Flow)

### Goals
- Add Manual mode (no crawl) with direct content entry.
- Reflect backend parallel generation: Summary, Core Offer, Claims.
- Introduce a dedicated Review & Edit step prior to final configuration.
- Maintain reactive UX with minimal API surface and strong reliability.

### High-Level Architecture
- 4-step wizard with branch at Step 1: Manual vs Automated.
- Automated path runs the existing workflow (crawl → filter → scrape → parallel generation).
- Manual path creates/ensures `agency_profile` and skips workflow.
- Review & Edit consolidates Summary/Core Offer/Claims into one editor step with a single save.

### Steps
1) Step 1 — Initial Setup & Mode Selection
   - Inputs: `companyName` (required), Mode: Manual | Automated
   - If Automated: also require `sourceUrl` and start workflow
   - If Manual: start manual onboarding (no workflow) and jump to Step 3

2) Step 2 — Workflow Monitoring (Automated only)
   - Phases include `coreOffer` alongside `summary` and `claims`
   - Components: OverallProgress, PhaseTimeline, PageDiscoveryGrid, StreamingSummary, EventLog
   - On `status === completed`, auto-advance to Step 3

3) Step 3 — Review & Edit Generated Content (New)
   - Editable: Summary (textarea), Core Offer (textarea), Claims (list editor with add/remove/edit)
   - Automated: prefilled from `agency_profile`
   - Manual: empty values
   - One save action persists content and advances to Step 4

4) Step 4 — Final Configuration
   - Tone, availability, timezone, target vertical, geography, lead qualification criteria
   - Submit finalizes onboarding and redirects

### API Surface (Minimal)
- `api.agencyProfile.seedFromWebsite({ companyName, sourceUrl })` — automated kickoff
- `api.agencyProfile.startManualOnboarding({ companyName })` — manual kickoff (no workflow)
- `api.agencyProfile.saveReviewedContent({ agencyProfileId, summary, coreOffer, claims })` — idempotent save from Step 3
- `api.agencyProfile.finalizeOnboardingPublic({...})` — final step submission

### Backend function plan (sellerBrain.ts)
All functions use the new Convex function syntax and validators per convex_rules.

1) startManualOnboarding (public mutation)
```ts
export const startManualOnboarding = mutation({
  args: { companyName: v.string() },
  returns: v.object({ agencyProfileId: v.id("agency_profile") }),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized");
    // Upsert agency_profile without starting a workflow
    const existing = await ctx.db
      .query("agency_profile")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        companyName: args.companyName,
        sourceUrl: existing.sourceUrl ?? "",
        onboardingFlowId: undefined,
      });
      return { agencyProfileId: existing._id };
    }
    const id = await ctx.db.insert("agency_profile", {
      userId: user._id,
      companyName: args.companyName,
      sourceUrl: "",
    });
    return { agencyProfileId: id };
  },
});
```

2) saveReviewedContent (public mutation → internal upsert)
```ts
const ClaimsValidator = v.array(
  v.object({ id: v.string(), text: v.string(), source_url: v.string() })
);

export const saveReviewedContentPublic = mutation({
  args: {
    agencyProfileId: v.id("agency_profile"),
    summary: v.string(),
    coreOffer: v.string(),
    claims: ClaimsValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Unauthorized");
    await ctx.runMutation(internal.sellerBrain.saveReviewedContentInternal, {
      ...args,
      userId: user._id,
    });
    return null;
  },
});

export const saveReviewedContentInternal = internalMutation({
  args: {
    userId: v.string(),
    agencyProfileId: v.id("agency_profile"),
    summary: v.string(),
    coreOffer: v.string(),
    claims: ClaimsValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.agencyProfileId);
    if (!profile || profile.userId !== args.userId) throw new Error("Not found");
    await ctx.db.patch(args.agencyProfileId, {
      summary: args.summary,
      coreOffer: args.coreOffer,
      approvedClaims: args.claims,
    });
    return null;
  },
});
```

Notes:
- Manual mode stores an empty `sourceUrl` and no `onboardingFlowId`.
- Reviewed content is written to `agency_profile` and reused by finalization.
- Keep validators strict; never return undefined.

### Data & Subscriptions
- Reads: `agencyProfile.getForCurrentUser`, `onboarding_flow.get`, `listCrawlPages`, `getOverallProgress`, `summary.listSummaryMessages`
- Writes: kickoff (manual/automated), review save, finalize
- Keep heavy content operations server-side; UI uses concise documents and streaming where relevant

### Component Changes
- New: `Step3_ReviewAndEditGenerated` with `ClaimEditor`
- Update: `Step1_InitialSetupForm` (mode selector), `Step2_WorkflowMonitor` (include `coreOffer`, remove claims approval), `PhaseTimeline` (add `coreOffer`)
- Keep: Final configuration component (now Step 4)

### Validation
- Step 1: `companyName` required; `sourceUrl` required only for Automated
- Step 3: require non-empty Summary and Core Offer; at least 1 claim for Automated; allow 0 for Manual (warn)

### UX & Performance
- Lazy mount heavy Step 2 subviews; unmount when leaving step
- Debounce Step 3 editors; single explicit Save & Continue
- Continue using subscriptions; avoid polling
- Stream summary only in Step 2; Step 3 uses finalized editable fields

### Acceptance Criteria
- Manual path skips workflow and lands in Step 3 with empty editors
- Automated path displays all phases with `coreOffer` and transitions to Step 3 on completion
- Users can edit and save Summary/Core Offer/Claims and proceed to final configuration
- Finalization works with reviewed content and redirects on success

### Out of Scope
- Backwards compatibility and migration for existing sessions


