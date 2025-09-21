## Onboarding UI Architecture Plan (vNext — Automated: 4 Steps, Manual: 3 Steps)

### Overview
- **Core offer generation**: First-class parallel phase alongside summary and claims (matches backend three-thread model).
- **New review step**: Dedicated Step 3 where users can edit/verify Summary, Core Offer, and Claims before final configuration.
- **Manual mode**: Step 1 offers Manual vs Automated. Manual skips crawl/scrape/workflow and jumps directly to Step 3 with empty fields.

### Onboarding Flows

#### Step 1: Initial Setup & Mode Selection
- Inputs: `companyName` (required)
- Mode: `manual` or `automated`
- Automated requires `sourceUrl` and kicks off the workflow via `api.agencyProfile.seedFromWebsite`
- Manual creates/ensures `agency_profile` without starting a workflow and immediately advances to Step 3

#### Step 2: Workflow Monitoring (Automated mode only)
- Real-time workflow visibility using subscriptions
- Phases include `crawl`, `filter`, `scrape`, `summary`, `coreOffer`, `claims`, `verify`
- Components: OverallProgress, PhaseTimeline, PageDiscoveryGrid, StreamingSummary, EventLog
- No claims editing here; upon `flow.status === "completed"`, advance to Step 3

#### Step 3: Review & Edit Generated Content (New)
- Editable: Summary (textarea), Core Offer (textarea), Claims (list editor: add/remove/edit `text` and `source_url`)
- Automated mode: prefilled from `agency_profile.summary`, `agency_profile.coreOffer`, `agency_profile.approvedClaims`
- Manual mode: empty defaults
- Single save action persists reviewed content, then advance to Step 4

#### Step 4: Final Configuration
- Tone, availability, timezone, target vertical, geography, lead qualification criteria
- Submit finalizes onboarding and redirects to dashboard

---

## Data Flow & Subscriptions

### Primary Reads
- `api.agencyProfile.getForCurrentUser` → `onboardingFlowId`, `summary`, `coreOffer`, `approvedClaims`, etc.
- `api.onboarding.queries.getOnboardingFlow` → phases, status, threads, `relevantPages`, `lastEvent` (Step 2 only)
- `api.onboarding.queries.listCrawlPages` → page grid (Step 2)
- `api.onboarding.queries.getOverallProgress` → single progress number (Step 2)
- `api.onboarding.summary.listSummaryMessages` → streaming summary text (Step 2)

### Writes
- Automated kickoff: `api.agencyProfile.seedFromWebsite({ companyName, sourceUrl })`
- Manual kickoff: `api.agencyProfile.startManualOnboarding({ companyName })` (no workflow)
- Step 3 save: `api.agencyProfile.saveReviewedContent({ agencyProfileId, summary, coreOffer, claims })`
- Finalize: `api.agencyProfile.finalizeOnboardingPublic({...})`

Notes:
- Keep heavy work server-side; Step 3 performs one idempotent save.
- Reuse existing subscriptions; avoid polling.

---

## Component Architecture

```
OnboardingPage
├── Step1_InitialSetupForm           // company name + manual/automated selection (+ URL if automated)
├── Step2_WorkflowMonitor            // automated only; phases incl. coreOffer
│   ├── OverallProgress
│   ├── PhaseTimeline
│   ├── PageDiscoveryGrid
│   ├── StreamingSummary
│   └── EventLog
├── Step3_ReviewAndEditGenerated     // editable summary, core offer, claims
│   └── ClaimEditor                  // list editor with add/remove/edit
└── Step4_FinalConfigurationForm     // tone, availability, target market, etc.
```

### Component Specs

#### 1) Step1_InitialSetupForm
```typescript
interface InitialSetupFormProps {
  onStarted: (params: { mode: "manual" | "automated"; agencyProfileId: string; onboardingFlowId?: string }) => void;
}
```
- Fields: `companyName` (required), `mode` radio, `sourceUrl` (required iff `mode === "automated"`)
- Automated: call `seedFromWebsite`; transition to Step 2 (onboarding flow id will be picked up by subscription)
- Manual: call `startManualOnboarding`; transition directly to Review (displayed as Step 2 of 3)

#### 2) Step2_WorkflowMonitor (Automated only)
```typescript
interface WorkflowMonitorProps {
  onboardingFlowId: string;
  onCompleted: () => void;
}
```
- Subscribes to `getOnboardingFlow`
- Renders: OverallProgress, PhaseTimeline (with `coreOffer`), PageDiscoveryGrid, StreamingSummary, EventLog
- When `status === "completed"`, call `onCompleted()` to go to Review (displayed as Step 3 of 4)

#### 3) Step3_ReviewAndEditGenerated (New)
```typescript
interface ReviewAndEditGeneratedProps {
  agencyProfileId: string;
  initialSummary?: string;
  initialCoreOffer?: string;
  initialClaims?: { id?: string; text: string; source_url?: string }[];
  onSaved: () => void;
}
```
- Controlled editors for Summary/Core Offer
- ClaimEditor: CRUD over claims, validate `text`; `source_url` optional (empty string allowed)
- Save invokes `saveReviewedContent`
- Step label: Manual shows "Step 2 of 3"; Automated shows "Step 3 of 4"

#### 4) Step4_FinalConfigurationForm
```typescript
interface FinalConfigurationFormProps {
  onComplete: () => void;
}
```
- Uses constants from `app/dashboard/onboarding/constants/formOptions.ts`
- Calls `finalizeOnboardingPublic`
- Step label: Manual shows "Step 3 of 3"; Automated shows "Step 4 of 4"

---

## Step State & Transitions

```typescript
type OnboardingStep = 1 | 2 | 3 | 4;
type Mode = "manual" | "automated";

interface ClaimDraft {
  id?: string;
  text: string;
  source_url?: string;
}

interface OnboardingState {
  currentStep: OnboardingStep;
  mode?: Mode;
  agencyProfileId?: string;
  onboardingFlowId?: string; // automated only
  draftSummary?: string;      // step 3 local state
  draftCoreOffer?: string;    // step 3 local state
  draftClaims?: ClaimDraft[]; // step 3 local state
}
```

### Transitions
- Step 1 → Step 2: Automated + `seedFromWebsite` success
- Step 1 → Review: Manual selected + `startManualOnboarding` success (displayed as Step 2 of 3)
- Step 2 → Review: Workflow `status === "completed"` (displayed as Step 3 of 4)
- Review → Final Configuration: `saveReviewedContent` success (Manual displays as Step 3 of 3; Automated as Step 4 of 4)
- Final Configuration → Dashboard: `finalizeOnboardingPublic` success

---

## Integration Points

### Step 1: Kickoff (Manual vs Automated)
```typescript
const seedWorkflow = useAction(api.agencyProfile.seedFromWebsite);
const startManual = useMutation(api.agencyProfile.startManualOnboarding);

if (mode === "automated") {
  const { agencyProfileId } = await seedWorkflow({ companyName, sourceUrl });
  onStarted({ mode, agencyProfileId }); // onboardingFlowId picked up by subscription later
} else {
  const { agencyProfileId } = await startManual({ companyName });
  onStarted({ mode, agencyProfileId });
}
```

### Step 2: Real-time Workflow
```typescript
const flow = useQuery(api.onboarding.queries.getOnboardingFlow, { onboardingFlowId });
useEffect(() => {
  if (flow?.status === "completed") onCompleted();
}, [flow?.status]);
```

### Step 3: Save Reviewed Content
```typescript
const saveReviewed = useMutation(api.agencyProfile.saveReviewedContent);
await saveReviewed({ agencyProfileId, summary, coreOffer, claims });
onSaved();
```

### Step 4: Finalize
```typescript
const finalize = useMutation(api.agencyProfile.finalizeOnboardingPublic);
await finalize({
  approvedClaims: claims,
  guardrails,
  tone,
  timeZone,
  availability,
  targetVertical,
  targetGeography,
  coreOffer,
  leadQualificationCriteria,
});
onComplete();
```

---

## UX & Validation
- Step 1: Require `companyName`. `sourceUrl` required only for Automated.
- Step 3: Require non-empty Summary and Core Offer; at least 1 claim for Automated; allow empty claims for Manual but warn.
- Provide pivot to Manual if Step 2 fails; keep wizard state intact.
- Debounce local edits in Step 3; single explicit Save & Continue.

## Performance
- Lazy-mount Step 2 heavy panels; unmount when leaving the step.
- Virtualize page grid; debounce progress rendering.
- Stream summary only in Step 2; Step 3 shows finalized editable text areas.

## Technical Requirements
- Keep using `@convex-dev/agent` for streaming summary.
- Use `constants/formOptions.ts` for selectable fields.
- Maintain internal vs public query pattern for workflow vs UI.

## Success Criteria
- Smooth 4-step progression with Manual/Automated branching.
- Accurate phase display including `coreOffer`.
- Users can edit and save Summary/Core Offer/Claims in Step 3.
- Finalization works with saved reviewed content.


