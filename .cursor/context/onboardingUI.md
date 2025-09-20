# Onboarding UI Architecture Plan

## Current State Analysis

The current `app/dashboard/onboarding/page.tsx` is **completely outdated** and incompatible with the new workflow system. It references old fields like `crawlStatus` and `crawlError` that no longer exist in the schema. The UI needs to be completely redesigned to work with the new workflow-based architecture.

## Key Problems with Current UI
- References deprecated `crawlStatus` field (removed from schema)
- Uses step-based approach instead of workflow phases
- No integration with `onboarding_flow` table
- No real-time progress tracking
- Missing AI streaming summary display
- No crawl pages visualization

## New Architecture Overview - Multi-Step Onboarding Flow

### 1. Three-Step Onboarding Process

**Step 1: Initial Setup**
- Company name and website URL input
- Kicks off the full workflow via `api.sellerBrain.seedFromWebsite`
- Transitions to Step 2 immediately after workflow starts

**Step 2: Workflow Monitoring + Claims/Guardrails**
- Real-time workflow progress display (all 6 phases)
- Claims approval interface (when claims phase completes)
- Guardrails input interface
- Transitions to Step 3 when workflow completes and user approves claims

**Step 3: Final Configuration**
- Tone selection
- Availability scheduling
- Timezone selection  
- Target vertical, geography, core offer, and lead qualification criteria configuration
- Calls `api.agencyProfile.finalizeOnboardingPublic` to complete

### 2. Data Flow & Subscriptions

**Primary Data Sources:**
- `api.agencyProfile.getForCurrentUser` - Get `onboardingFlowId` and final results  
- `api.onboarding.queries.getOnboardingFlow` - Main workflow status and phases
- `api.onboarding.queries.listCrawlPages` - Page-by-page crawling progress
- `api.onboarding.summary.listSummaryMessages` - Streaming AI summary
- `api.onboarding.queries.getOverallProgress` - Single progress number (0-1)

**Reactive Updates:**
All queries update automatically via Convex subscriptions, providing real-time workflow progress without polling.

### 3. Component Architecture

```
OnboardingPage
├── Step1: InitialSetupForm (company name + URL)
├── Step2: WorkflowWithApproval (main workflow component)
│   ├── OverallProgress (single progress bar)
│   ├── PhaseTimeline (6 phases with status)
│   │   ├── PhaseCard (crawl)
│   │   ├── PhaseCard (filter) 
│   │   ├── PhaseCard (scrape)
│   │   ├── PhaseCard (summary)
│   │   ├── PhaseCard (claims)
│   │   └── PhaseCard (verify)
│   ├── PageDiscoveryGrid (crawl_pages status)
│   ├── StreamingSummary (AI-generated content)
│   ├── EventLog (lastEvent display)
│   ├── ClaimsApproval (when claims ready)
│   └── GuardrailsInput (user-defined guardrails)
└── Step3: FinalConfigurationForm (tone, availability, ICP)
```

### 4. Detailed Component Specifications

#### 4.1 Step 1: InitialSetupForm Component
```typescript
interface InitialSetupFormProps {
  onWorkflowStarted: (agencyProfileId: string) => void;
}
```
- Form for company name + website URL input
- Calls `api.agencyProfile.seedFromWebsite` action
- Handles loading states and errors
- Transitions to Step 2 once workflow starts
- Validates URL format and company name

#### 4.2 Step 2: WorkflowWithApproval Component  
```typescript
interface WorkflowWithApprovalProps {
  agencyProfileId: string;
  onClaimsApproved: (approvedClaims: Claim[], guardrails: string[]) => void;
}

interface Claim {
  id: string;
  text: string;
  source_url: string;
}
```
- Subscribes to `api.onboarding.queries.getOnboardingFlow`
- Renders all workflow monitoring sub-components
- Shows ClaimsApproval interface when claims phase completes
- Shows GuardrailsInput interface throughout workflow
- Handles error states and retry logic
- Transitions to Step 3 when workflow completes AND user approves claims

#### 4.3 Step 3: FinalConfigurationForm Component
```typescript
interface FinalConfigurationFormProps {
  approvedClaims: Claim[];
  guardrails: string[];
  onComplete: () => void;
}
```
- Form for tone, availability, timezone, target vertical, geography, core offer, and lead qualification criteria
- Uses existing field options from current page.tsx
- Calls `api.agencyProfile.finalizeOnboardingPublic` to complete onboarding
- Redirects to dashboard on success

#### 4.4 ClaimsApproval Component
```typescript
interface ClaimsApprovalProps {
  claims: Claim[];
  onApproval: (selectedClaims: Claim[]) => void;
}
```
- Shows generated claims from workflow
- Checkbox interface for claim selection
- Shows source URLs for each claim
- Only appears when claims phase is complete
- Required for progression to Step 3

#### 4.5 GuardrailsInput Component
```typescript
interface GuardrailsInputProps {
  guardrails: string[];
  onGuardrailsChange: (guardrails: string[]) => void;
}
```
- Text input for adding custom guardrails
- Add/remove interface for guardrail management
- Available throughout Step 2 workflow
- Saved with claims approval

#### 4.6 OverallProgress Component
```typescript
interface OverallProgressProps {
  onboardingFlowId: string;
}
```
- Uses `api.onboarding.queries.getOverallProgress` (returns 0-1)
- Animated progress bar with percentage
- Color coding: blue (running), green (complete), red (error)

#### 4.7 PhaseTimeline Component
```typescript
interface Phase {
  name: "crawl" | "filter" | "scrape" | "summary" | "claims" | "verify";
  status: "pending" | "running" | "complete" | "error";
  progress: number; // 0-1
  errorMessage?: string;
  startedAt?: number;
  completedAt?: number;
  duration?: number;
}
```
- Maps over `flow.phases` array
- Each phase shows: icon, name, status badge, progress bar, duration
- Expandable error details for failed phases
- Real-time status updates

#### 4.8 PageDiscoveryGrid Component
```typescript
interface PageDiscoveryGridProps {
  onboardingFlowId: string;
}
```
- Uses `api.onboarding.queries.listCrawlPages` with pagination
- Shows: URL, title, status badge, HTTP status
- Status chips: "Queued" (gray), "Fetching" (blue), "Scraped" (green), "Failed" (red)
- Live count summary from `flow.counts`
- Virtualized for performance with many pages

#### 4.9 StreamingSummary Component
```typescript
interface StreamingSummaryProps {
  onboardingFlowId: string;
  smartThreadId?: string;
}
```
**Critical Integration Points:**
- Uses `useThreadMessages` from `@convex-dev/agent/react`
- Calls `api.onboarding.summary.listSummaryMessages`
- Streams with `{ stream: true }` option
- Uses `toUIMessages` helper for message formatting
- Implements `useSmoothText` for smooth streaming display

**Implementation:**
```typescript
import { useThreadMessages, toUIMessages } from "@convex-dev/agent/react";
import { api } from "@/convex/_generated/api";

const messages = useThreadMessages(
  api.onboarding.summary.listSummaryMessages,
  { onboardingFlowId, threadId: smartThreadId },
  { initialNumItems: 10, stream: true }
);

const uiMessages = toUIMessages(messages.results ?? []);
```

#### 4.10 EventLog Component
```typescript
interface EventLogProps {
  lastEvent?: {
    type: string;
    message: string; 
    timestamp: number;
  };
}
```
- Shows most recent workflow event
- Formatted timestamp and event type
- Auto-scroll to latest events

### 5. Step-by-Step State Management

#### 5.1 Step Progression Logic
```typescript
type OnboardingStep = 1 | 2 | 3;

interface OnboardingState {
  currentStep: OnboardingStep;
  sellerBrainId?: string;
  onboardingFlowId?: string;
  approvedClaims?: Claim[];
  guardrails?: string[];
}
```

**Step Transitions:**
- Step 1 → Step 2: When `seedFromWebsite` completes successfully
- Step 2 → Step 3: When workflow status === "completed" AND user has approved claims
- Step 3 → Dashboard: When `finalizeOnboardingPublic` completes successfully

#### 5.2 Form Field Configuration (Step 3)

**From existing page.tsx:**
```typescript
// Tone options
const TONE_OPTIONS = ["consultative", "professional", "friendly"];

// Target vertical options
const TARGET_VERTICALS = [
  "Software", "Fintech", "Healthcare", "E-commerce", "Education",
  "Manufacturing", "Retail", "Travel", "Real Estate", "Telecommunications",
  "Media", "Energy", "Logistics", "Professional Services", "Government"
];

// Lead qualification criteria options
const LEAD_QUALIFICATION_OPTIONS = [
  "LOW_GOOGLE_RATING",
  "FEW_GOOGLE_REVIEWS", 
  "MISSING_WEBSITE",
  "WEBSITE_NOT_MOBILE_FRIENDLY",
  "NO_ONLINE_BOOKING"
];

// Timezone options
const NA_TIMEZONES = [
  "America/Los_Angeles", "America/Denver", "America/Phoenix", "America/Chicago",
  "America/New_York", "America/Anchorage", "America/Honolulu", "America/Toronto",
  "America/Vancouver", "America/Mexico_City"
];

// Days for availability
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
```

### 6. State Management & Error Handling

#### 6.1 Loading States by Step
- **Step 1**: Form validation and workflow kickoff loading
- **Step 2**: Workflow progress with phase-specific loading states
- **Step 3**: Final form submission loading
- **Completion**: Redirect loading state

#### 6.2 Error Recovery by Step
- **Step 1**: Form validation errors, workflow start failures
- **Step 2**: Phase-level errors with retry buttons, workflow failures
- **Step 3**: Form validation errors, finalization failures
- **Global**: Network errors with auto-retry and exponential backoff

#### 6.3 Performance Optimizations
- Virtualized page grid for large crawls
- Debounced progress updates
- Memoized expensive calculations
- Lazy loading of non-critical components
- Step-based component mounting/unmounting

### 7. Integration Points

#### 7.1 Step 1: Workflow Kickoff
```typescript
// In InitialSetupForm component
const seedWorkflow = useAction(api.agencyProfile.seedFromWebsite);

const handleSubmit = async (companyName: string, sourceUrl: string) => {
  const { agencyProfileId } = await seedWorkflow({ companyName, sourceUrl });
  // Transition to Step 2 with agencyProfileId
  onWorkflowStarted(agencyProfileId);
};
```

#### 7.2 Step 2: Real-time Workflow Updates
```typescript
// In WorkflowWithApproval component
const flow = useQuery(api.onboarding.queries.getOnboardingFlow, 
  { onboardingFlowId }
);

// Check for workflow completion and claims availability
const canProceedToStep3 = flow?.status === "completed" && 
                          approvedClaims.length > 0 && 
                          guardrails.length > 0;
```

#### 7.3 Step 2: AI Streaming Integration
```typescript
// StreamingSummary component in Step 2
const messages = useThreadMessages(
  api.onboarding.summary.listSummaryMessages,
  { onboardingFlowId, threadId: smartThreadId },
  { initialNumItems: 10, stream: true }
);

const streamingText = useSmoothText(messages.results);
```

#### 7.4 Step 3: Final Form Submission
```typescript
// In FinalConfigurationForm component
const finalizeOnboarding = useMutation(api.agencyProfile.finalizeOnboardingPublic);

const handleSubmit = async (formData: FinalFormData) => {
  await finalizeOnboarding({
    approvedClaims,
    guardrails,
    tone: formData.tone,
    timeZone: formData.timeZone,
    availability: formData.availability,
    targetVertical: formData.targetVertical,
    targetGeography: formData.targetGeography,
    coreOffer: formData.coreOffer,
    leadQualificationCriteria: formData.leadQualificationCriteria,
  });
  onComplete(); // Redirect to dashboard
};
```

### 8. UI/UX Design Principles

#### 8.1 Step-Based Visual Hierarchy
**Step 1 (Initial Setup):**
- Simple, focused form layout
- Clear call-to-action button
- Minimal visual distractions

**Step 2 (Workflow + Approval):**
1. **Top**: Step indicator and overall progress bar
2. **Upper**: Phase timeline (shows current workflow step)
3. **Middle**: Detailed views (pages grid, streaming summary)
4. **Lower**: Claims approval and guardrails (when ready)
5. **Bottom**: Continue button (when workflow complete + claims approved)

**Step 3 (Final Configuration):**
- Multi-column form layout for efficiency
- Grouped related fields (target market, availability, etc.)
- Clear progress indication and completion

#### 8.2 Status Indicators
- **Colors**: Gray (pending), Blue (running), Green (complete), Red (error)
- **Icons**: Clock (pending), Spinner (running), Check (complete), X (error)
- **Progress**: Smooth animations, percentage display
- **Step indicators**: Numbered circles with completion states

#### 8.3 Information Architecture
- **Progressive disclosure**: Basic info visible, details on expand
- **Step-based flow**: Clear navigation between steps
- **Contextual help**: Tooltips explain each phase and form field
- **Error guidance**: Clear error messages with suggested actions
- **Claims presentation**: Source URLs, approval checkboxes, clear descriptions

### 9. Migration Strategy

#### 9.1 Current Page Replacement
1. **Backup**: Save current page.tsx as page.tsx.old
2. **Extract**: Preserve form field options and validation logic
3. **Replace**: Implement new 3-step architecture from scratch
4. **Test**: Verify all workflow phases and form steps work correctly
5. **Deploy**: Replace old onboarding flow

#### 9.2 Backward Compatibility
- Handle users with old `agency_profile` records gracefully
- Migrate old status fields if present
- Provide fallback UI for edge cases
- Support users who may be mid-workflow during deployment

### 10. Technical Requirements

#### 10.1 New Dependencies
```json
{
  "@convex-dev/agent": "latest", // For AI streaming
  "lucide-react": "latest",      // For icons
  "clsx": "latest"               // For conditional classes
}
```

#### 10.2 File Structure
```
app/dashboard/onboarding/
├── page.tsx                     // Main page (completely rewritten with 3 steps)
├── components/
│   ├── Step1_InitialSetupForm.tsx
│   ├── Step2_WorkflowWithApproval.tsx
│   ├── Step3_FinalConfigurationForm.tsx
│   ├── ClaimsApproval.tsx
│   ├── GuardrailsInput.tsx
│   ├── OverallProgress.tsx
│   ├── PhaseTimeline.tsx
│   ├── PhaseCard.tsx
│   ├── PageDiscoveryGrid.tsx
│   ├── StreamingSummary.tsx
│   └── EventLog.tsx
├── hooks/
│   ├── useOnboardingStep.ts
│   ├── useWorkflowStatus.ts
│   └── useStreamingText.ts
└── constants/
    └── formOptions.ts           // All form field options extracted
```

### 11. Implementation Priority

#### Phase 1: Step 1 Implementation
1. InitialSetupForm component
2. Basic step progression logic
3. Workflow kickoff integration
4. Step transition to Step 2

#### Phase 2: Step 2 Core Workflow UI
1. WorkflowWithApproval orchestrator
2. OverallProgress bar
3. PhaseTimeline with status
4. Basic claims approval interface

#### Phase 3: Step 2 Detailed Views
1. PageDiscoveryGrid with crawl_pages
2. StreamingSummary with AI integration
3. GuardrailsInput component
4. EventLog with lastEvent

#### Phase 4: Step 3 Final Form
1. FinalConfigurationForm component
2. All form fields with validation
3. Integration with finalizeOnboardingPublic
4. Completion and redirect logic

#### Phase 5: Polish & Performance
1. Loading states and transitions for all steps
2. Error boundaries and recovery
3. Performance optimizations
4. Mobile responsiveness across all steps

### 12. Success Metrics

- **Step Flow**: All 3 steps transition smoothly with proper validation
- **Workflow Display**: All 6 workflow phases display correctly in Step 2
- **Claims Approval**: Users can approve/reject claims with clear UI
- **Form Completion**: Step 3 form handles all seller brain fields correctly
- **Real-time**: UI updates within 1 second of backend changes
- **Performance**: Page grid handles 100+ URLs smoothly
- **Streaming**: AI summary streams smoothly without glitches
- **Error handling**: Graceful degradation on failures at each step
- **User experience**: Clear progress indication and step navigation

---

## Next Steps

1. **Review this updated plan** with the team
2. **Extract form options** from current page.tsx into constants
3. **Implement Phase 1** (Step 1: Initial setup form)
4. **Build Step 2** (Workflow monitoring with claims approval)
5. **Complete Step 3** (Final configuration form)
6. **Test complete flow** with real workflows using recommended demo sites
7. **Iterate based on feedback** and performance metrics

This updated architecture provides a complete 3-step onboarding experience that preserves the existing form functionality while integrating with the sophisticated workflow system and new agency profile schema. Users get the full workflow visibility in Step 2 while maintaining the familiar form-based approach for initial setup and final configuration with target market, geography, and lead qualification criteria.
