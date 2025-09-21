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
- Editable: Summary (textarea), Core Offer (textarea), Claims (list editor: add/remove/edit `text` and `source_url`), Guardrails (array input)
- Automated mode: prefilled from `agency_profile.summary`, `agency_profile.coreOffer`, `agency_profile.approvedClaims`, `agency_profile.guardrails`
- Manual mode: empty defaults
- Single save action persists reviewed content AND sets `reviewedAt` timestamp, then advance to Step 4
- **Critical**: Step 4 is ONLY accessible after Step 3 save (gated by `reviewedAt` field)

#### Step 4: Final Configuration
- Tone, availability, timezone, target vertical, geography, lead qualification criteria
- Submit finalizes onboarding and redirects to dashboard

---

## Data Flow & Subscriptions

### Primary Reads
- `api.sellerBrain.getForCurrentUser` → `onboardingFlowId`, `summary`, `coreOffer`, `approvedClaims`, `guardrails`, `reviewedAt`, etc.
- `api.onboarding.queries.getOnboardingFlow` → phases, status, threads, `relevantPages`, `lastEvent` (Step 2 only)
- `api.onboarding.queries.listCrawlPages` → page grid (Step 2)
- `api.onboarding.queries.getOverallProgress` → single progress number (Step 2)
- `api.onboarding.summary.listSummaryMessages` → streaming summary text (Step 2)

### Writes
- Automated kickoff: `api.sellerBrain.seedFromWebsite({ companyName, sourceUrl })`
- Manual kickoff: `api.sellerBrain.startManualOnboarding({ companyName })` (no workflow)
- Step 3 save: `api.sellerBrain.saveReviewedContentPublic({ agencyProfileId, summary, coreOffer, claims, guardrails })` (sets `reviewedAt`)
- Finalize: `api.sellerBrain.finalizeOnboardingPublic({...})`

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
  mode?: "manual" | "automated";
  initialSummary?: string;
  initialCoreOffer?: string;
  initialClaims?: { id?: string; text: string; source_url?: string }[];
  initialGuardrails?: string[];
  onSaved: () => void;
}
```
- Controlled editors for Summary/Core Offer/Guardrails
- ClaimEditor: CRUD over claims, validate `text`; `source_url` optional (empty string allowed)
- Save invokes `saveReviewedContentPublic` which sets `reviewedAt: Date.now()`
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

## Step Gating Logic

The onboarding flow uses `reviewedAt` timestamp to ensure users cannot skip Step 3 after automated generation:

### Step Detection Logic (in `page.tsx`)
```typescript
// If onboarding is completed → redirect to /dashboard
if (agencyProfile.tone && agencyProfile.targetVertical && agencyProfile.availability) {
  router.replace("/dashboard");
  return;
}

// If has onboardingFlowId → go to Step 2 (automated flow)
// Let Step 2 call onCompleted() to advance to Step 3
if (agencyProfile.onboardingFlowId) {
  setCurrentStep(2);
  return;
}

// If reviewedAt exists → go to Step 4 (Configure)
if (agencyProfile.reviewedAt) {
  setCurrentStep(4);
  return;
}

// If manual mode → go to Step 3 (Review)
if (agencyProfile.companyName && !agencyProfile.onboardingFlowId && !agencyProfile.sourceUrl) {
  setCurrentStep(3);
}
```

### Key Security Features
- **No Step Skipping**: Users cannot advance to Step 4 without explicitly saving in Step 3
- **Persistent State**: Page refresh respects the `reviewedAt` gating
- **Validation**: Step 4 validates that `coreOffer` exists (ensures Step 3 was completed)
- **Audit Trail**: `reviewedAt` timestamp provides audit trail of when content was reviewed

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
- Step 1 → Step 3: Manual selected + `startManualOnboarding` success (displayed as Step 2 of 3)
- Step 2 → Step 3: Workflow `status === "completed"` (displayed as Step 3 of 4)
- Step 3 → Step 4: `saveReviewedContentPublic` success (sets `reviewedAt`) - Manual displays as Step 3 of 3; Automated as Step 4 of 4
- Step 4 → Dashboard: `finalizeOnboardingPublic` success

### Gating Rules
- **Step 4 Access**: ONLY accessible if `reviewedAt` exists (set by Step 3 save)
- **Page Refresh**: Respects gating - cannot jump to Step 4 without `reviewedAt`
- **Validation**: Step 4 requires `coreOffer` to exist (ensures Step 3 completion)

---

## Integration Points

### Step 1: Kickoff (Manual vs Automated)
```typescript
const seedWorkflow = useAction(api.sellerBrain.seedFromWebsite);
const startManual = useMutation(api.sellerBrain.startManualOnboarding);

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
const saveReviewed = useMutation(api.sellerBrain.saveReviewedContentPublic);
await saveReviewed({ agencyProfileId, summary, coreOffer, claims, guardrails });
// This automatically sets reviewedAt: Date.now() in the backend
onSaved();
```

### Step 4: Finalize
```typescript
const finalize = useMutation(api.sellerBrain.finalizeOnboardingPublic);
// Step 4 reads coreOffer and guardrails from agencyProfile (set in Step 3)
const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);
const coreOffer = agencyProfile?.coreOffer;
const guardrails = agencyProfile?.guardrails || [];

await finalize({
  approvedClaims: agencyProfile?.approvedClaims || [],
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
- Users can edit and save Summary/Core Offer/Claims/Guardrails in Step 3.
- **Step 4 gating**: Users cannot skip Step 3 - must explicitly review and save content.
- **Persistent gating**: Page refresh respects `reviewedAt` and doesn't allow Step 4 bypass.
- Finalization works with saved reviewed content from agency profile.
- Step 4 validates required fields exist (ensures Step 3 completion).


