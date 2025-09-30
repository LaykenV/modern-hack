# Demo Call Feature - Complete Implementation Plan

## Overview

Add demo call functionality that allows users to test the AI calling system with their own phone number and email, overriding the opportunity's contact information. This enables users to experience the call flow firsthand before using it with real prospects.

## Feature Requirements

### User Story
As a user, I want to test the AI call functionality with my own contact information, so I can verify the system works correctly and experience the call flow before contacting real prospects.

### Acceptance Criteria
- ✅ Demo call button available on "Ready" opportunities
- ✅ Modal dialog for inputting test phone number and email
- ✅ Phone validation (E.164 format: +1234567890)
- ✅ Email validation (standard email format)
- ✅ Same credit requirements as production calls (≥1 atlas_credit)
- ✅ Demo calls follow identical flow to production calls
- ✅ Demo calls tracked separately (isDemo flag) for future analytics
- ✅ Follow-up emails/calendar invites sent to override email
- ✅ Navigate to call detail page after starting demo call

## Current System Analysis

### Existing Call Flow (Production)
1. User clicks "Start Call" on opportunity card in `/app/dashboard/marketing/[flowId]/page.tsx`
2. Invokes `api.call.calls.startCall({ opportunityId, agencyId })`
3. Backend (`convex/call/calls.ts`):
   - Validates authentication required
   - Runs credit preflight check via `internal.call.billing.ensureAiCallCredits`
   - **Requires** `opportunity.phone` to exist (throws error if missing)
   - **Requires** `opportunity.email` for follow-ups
   - Captures `startedByEmail` from authenticated user (used for calendar invites)
   - Builds assistant prompt with agency/opportunity context
   - Creates call record with `dialedNumber: opportunity.phone`
   - Schedules `internal.vapi.startPhoneCall` to place the call
4. Returns `{ callId, vapiCallId }`
5. Frontend navigates to `/dashboard/calls/${callId}`

### Key Dependencies
- **Phone Number**: Hardcoded to `opportunity.phone` (line 74 in calls.ts throws if missing)
- **Email**: Hardcoded to `opportunity.email` for prospect confirmations
- **Organizer Email**: Uses `authUser.email` (startedByEmail) for calendar invites
- **No Override Mechanism**: Current system cannot substitute these values

## Implementation Plan

---

## Phase 1: Backend Changes

### 1.1 Create New Action: `startDemoCall`

**File:** `convex/call/calls.ts`

**Location:** Add after the existing `startCall` action (after line 251)

**Implementation Strategy:**
- Copy 90% of `startCall` logic
- Modify to use override phone/email instead of opportunity data
- Add demo tracking metadata
- Add input validation

**Code to Add:**

```typescript
export const startDemoCall = action({
  args: {
    opportunityId: v.id("client_opportunities"),
    agencyId: v.id("agency_profile"),
    overridePhone: v.string(),
    overrideEmail: v.string(),
  },
  returns: v.object({ callId: v.id("calls"), vapiCallId: v.string() }),
  handler: async (ctx, { opportunityId, agencyId, overridePhone, overrideEmail }) => {
    // Validate inputs
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(overridePhone)) {
      throw new Error("Invalid phone number format. Use E.164 format (e.g., +12025551234)");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(overrideEmail)) {
      throw new Error("Invalid email address");
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required to start a call");
    }

    const customerId = identity.subject;
    const preflight: { allowed: boolean; balance: number; error?: string } = await ctx.runAction(
      internal.call.billing.ensureAiCallCredits,
      { customerId, requiredMinutes: 1 },
    );

    if (!preflight.allowed) {
      throw new Error("Insufficient credits for AI call");
    }

    // Capture initiating user (if authenticated)
    const authUser = await authComponent.getAuthUser(ctx);

    // Load opportunity and agency (note: we DON'T require opportunity.phone for demo)
    const opportunity: Doc<"client_opportunities"> | null = await ctx.runQuery(
      internal.leadGen.queries.getOpportunityById,
      { opportunityId },
    );
    if (!opportunity) throw new Error("Opportunity not found");
    // Note: Skip phone validation - we're using overridePhone instead

    const agency: Doc<"agency_profile"> | null = await ctx.runQuery(
      internal.leadGen.queries.getAgencyProfileInternal,
      { agencyId },
    );
    if (!agency) throw new Error("Agency profile not found");

    // Get available meeting slots before building the prompt
    const availabilityData = await ctx.runQuery(
      internal.call.availability.getAvailableSlots,
      { agencyId }
    );
    
    // Get top 3-4 recommended slots
    const recommendedSlots = availabilityData.slots.slice(0, 4);
    
    // Prepare future meetings snapshot for context
    const futureMeetings = availabilityData.slots.slice(0, 10).map((slot: { iso: string }) => ({ iso: slot.iso }));

    // Build system prompt from agency + opportunity + availability
    const approvedClaims = (agency.approvedClaims ?? []).map((claim: { text: string }) => claim.text).join(" | ") || "";
    const guardrails = (agency.guardrails ?? []).join(", ") || "standard compliance";
    const systemContent = `# Identity & Purpose
You are a professional, friendly business development representative for "${agency.companyName}". You sound completely human - never robotic or scripted. Your goal is to have a natural conversation and, if there's mutual interest, schedule a brief discovery call.

# Context
- Your company: "${agency.companyName}"
- What you do: "${agency.coreOffer ?? ""}"
- Territory: ${agency.targetGeography ?? "their area"}
- Prospect business: "${opportunity.name}"
- Why you're calling (the gap you noticed): "${opportunity.fit_reason ?? ""}"
- Your guidelines: ${guardrails}
- Success stories you can share (pick ONE that's most relevant): ${approvedClaims || "<none provided>"}
- Timezone: ${agency.timeZone ?? "America/Chicago"}

# Available Times (Internal Reference Only)
- Your availability windows: ${(availabilityData.availabilityWindows ?? []).length > 0 ? availabilityData.availabilityWindows.join(", ") : "<none>"}
- Specific slots you can offer: ${recommendedSlots.map((slot: { label: string }) => slot.label).join(", ") || "<none>"}

# Your Personality
- ${agency.tone ?? "Warm, professional, genuinely helpful, and consultative"}
- Speak naturally with contractions, like a real person would
- Show genuine interest in their business
- Be confident but not pushy
- Never sound like you're reading from a script

# Meeting Booking Rules (Critical - Never Break These)
- ONLY suggest times from your available slots above
- NEVER agree to times outside your availability windows
- When confirming a meeting, after they agree, think to yourself: [BOOK_SLOT: <ISO_timestamp>] - but NEVER say this out loud
- State all times in ${agency.timeZone ?? "America/Chicago"} timezone
- If no times work, offer to coordinate via email rather than confirming unavailable times

# Natural Conversation Flow

## 1) Opening (Be Human & Direct)
"Hi there, this is [your name] with ${agency.companyName}. Do you have just a quick minute? I was looking at local businesses and noticed ${opportunity.fit_reason ?? "some opportunities with your online presence"}."

Wait for their response. If they say they're busy, offer to call back at a better time.

## 2) Build Interest Naturally
"The reason I'm reaching out is we specialize in ${agency.coreOffer ?? "helping businesses like yours grow"}, and I thought there might be a good fit here."

Then share ONE relevant success story from your approved claims to build credibility.

"Would it be worth having a quick 15-minute conversation to see if we might be able to help you with something similar?"

## 3) Handle Their Response Naturally
- If interested → Move to scheduling
- If hesitant → Ask one follow-up question to understand their situation better
- If not interested → Thank them politely and end the call
- If they want to know more → Give a brief answer, then pivot to scheduling: "That's exactly the kind of thing we'd dive into on a quick call. What does your calendar look like this week?"

## 4) Schedule Like a Human Would
DON'T immediately rattle off time slots. Instead:

"Great! I'd love to set up a brief chat. What day works better for you - earlier or later on {one of our recommended days}"

Listen to their preference, then offer 2 specific times from your available slots that match their preference.

## 5) Handle Scheduling Naturally
If they suggest a different time:
- If it's within your availability → Confirm it naturally
- If it's outside your availability → Respond like a human: "Ah, I'm not available then. How about [alternative time]? Or does [another alternative] work better?"

When they agree to a time:
"Perfect! So that's [day], [date] at [time] [timezone]. I'll send you a calendar invite. Does that work?"

After they confirm, think to yourself [BOOK_SLOT: <exact_ISO_timestamp>] but never say this phrase out loud.

## 6) Wrap Up Warmly
"Excellent! I'm looking forward to our chat. Have a great rest of your day!"

# Key Conversation Principles
- Sound genuinely interested in helping their business
- Use natural transitions between topics
- Don't rush to scheduling - let the conversation flow
- Acknowledge what they say before moving to your next point
- If they ask questions, answer briefly then redirect to the meeting
- Handle objections by understanding their concern first, then addressing it

# Voicemail Script
"Hi, this is [name] from ${agency.companyName}. I noticed ${opportunity.fit_reason ?? "some opportunities"} with your business and thought we might be able to help. We've had great results with similar businesses - [mention one success story briefly]. I'd love to chat for just 15 minutes about how we might be able to help you too. Give me a call back at [your number] or I'll try you again later. Thanks!"

# Remember
- This is a peer-to-peer business conversation
- You're offering value, not selling hard
- Let them talk and respond naturally to what they say
- Building rapport is more important than rushing to schedule`;

    const inlineAssistant: AssistantPayload = {
      name: `Atlas AI Rep for ${agency.companyName}`,
      model: {
        provider: "openai",
        model: "chatgpt-4o-latest",
        messages: [{ role: "system", content: systemContent }],
      },
      voice: { provider: "playht", voiceId: "jennifer", model: "PlayDialog" },
      transcriber: { provider: "deepgram", model: "nova-3-general" },
      firstMessageMode: "assistant-speaks-first",
      serverMessages: [
        "status-update",
        "transcript",
        "end-of-call-report",
      ],
      metadata: {
        convexOpportunityId: opportunity._id,
        convexAgencyId: agency._id,
        leadGenFlowId: opportunity.leadGenFlowId ?? null,
        offeredSlotsISO: recommendedSlots.map((slot: { iso: string }) => slot.iso),
        agencyAvailabilityWindows: availabilityData.availabilityWindows,
        futureMeetings: futureMeetings,
        isDemo: true, // Mark as demo in metadata
      },
    };

    // Create DB call row (initiated) with demo overrides
    const callId: Id<"calls"> = await ctx.runMutation(internal.call.calls._createInitiatedCall, {
      opportunityId,
      agencyId,
      dialedNumber: overridePhone, // Use override phone instead of opportunity.phone
      assistantSnapshot: inlineAssistant,
      startedByUserId: authUser?._id as string | undefined,
      startedByEmail: overrideEmail, // Use override email instead of authUser.email
      isDemo: true, // Mark as demo call
      demoOverrides: {
        phone: overridePhone,
        email: overrideEmail,
      },
      metadata: {
        billingCustomerId: customerId,
        aiCallPreflight: {
          requiredMinutes: 1,
          balance: preflight.balance,
          checkedAt: Date.now(),
        },
      },
    });

    // Patch call record with availability metadata
    await ctx.runMutation(internal.call.calls._patchCallMetadata, {
      callId,
      metadata: {
        offeredSlotsISO: recommendedSlots.map((slot: { iso: string }) => slot.iso),
        agencyAvailabilityWindows: availabilityData.availabilityWindows,
        futureMeetings: futureMeetings,
      },
    });

    // Schedule Vapi action to place the call (keeps Node-only code in vapi.ts)
    await ctx.scheduler.runAfter(0, (internal as typeof internal).vapi.startPhoneCall, {
      callId,
      customerNumber: overridePhone, // Use override phone for dialing
      assistant: inlineAssistant,
      // Pass availability metadata to vapi action
      offeredSlotsISO: recommendedSlots.map((slot: { iso: string }) => slot.iso),
      agencyAvailabilityWindows: availabilityData.availabilityWindows,
      futureMeetings: futureMeetings,
    });

    return { callId, vapiCallId: "pending" };
  },
});
```

### 1.2 Update Internal Mutation: `_createInitiatedCall`

**File:** `convex/call/calls.ts`

**Current Location:** Lines 253-279

**Changes Required:**

1. Add new optional arguments to args validator:
```typescript
export const _createInitiatedCall = internalMutation({
  args: {
    opportunityId: v.id("client_opportunities"),
    agencyId: v.id("agency_profile"),
    dialedNumber: v.string(),
    assistantSnapshot: v.any(),
    startedByUserId: v.optional(v.string()),
    startedByEmail: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
    // NEW: Demo call tracking
    isDemo: v.optional(v.boolean()),
    demoOverrides: v.optional(v.object({
      phone: v.string(),
      email: v.string(),
    })),
  },
  returns: v.id("calls"),
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("calls", {
      opportunityId: args.opportunityId,
      agencyId: args.agencyId,
      dialedNumber: args.dialedNumber,
      assistantSnapshot: args.assistantSnapshot,
      status: "initiated",
      startedAt: now,
      currentStatus: "queued",
      startedByUserId: args.startedByUserId,
      startedByEmail: args.startedByEmail,
      metadata: args.metadata,
      // NEW: Add demo fields
      isDemo: args.isDemo,
      demoOverrides: args.demoOverrides,
    });
  },
});
```

### 1.3 Schema Updates

**File:** `convex/schema.ts`

**Location:** `calls` table definition (lines 258-323)

**Changes Required:**

Add new optional fields after line 303 (after `startedByEmail`):

```typescript
calls: defineTable({
  opportunityId: v.id("client_opportunities"),
  agencyId: v.id("agency_profile"),
  // Vapi call identifier and dialing metadata
  vapiCallId: v.optional(v.string()),
  assistantId: v.optional(v.string()),
  phoneNumberId: v.optional(v.string()),
  dialedNumber: v.optional(v.string()),

  // Structured transcript fragments
  transcript: v.optional(
    v.array(
      v.object({
        role: v.string(),
        text: v.string(),
        timestamp: v.optional(v.number()),
        source: v.optional(v.string()),
      }),
    ),
  ),

  // Post-call data
  outcome: v.optional(v.string()),
  meeting_time: v.optional(v.number()),
  status: v.optional(v.string()),
  duration: v.optional(v.number()),
  summary: v.optional(v.string()),
  recordingUrl: v.optional(v.string()),
  endedReason: v.optional(v.string()),
  billingSeconds: v.optional(v.number()),
  metadata: v.optional(v.record(v.string(), v.any())),

  // Operational
  startedAt: v.optional(v.number()),
  lastWebhookAt: v.optional(v.number()),
  currentStatus: v.optional(v.string()),
  assistantSnapshot: v.optional(v.any()),
  monitorUrls: v.optional(
    v.object({
      listenUrl: v.optional(v.string()),
    }),
  ),

  // Initiating user context
  startedByUserId: v.optional(v.string()),
  startedByEmail: v.optional(v.string()),

  // NEW: Demo call tracking
  isDemo: v.optional(v.boolean()),
  demoOverrides: v.optional(v.object({
    phone: v.string(),
    email: v.string(),
  })),

  // Meeting booking metadata (Phase 2)
  offeredSlotsISO: v.optional(v.array(v.string())),
  agencyAvailabilityWindows: v.optional(v.array(v.string())),
  futureMeetings: v.optional(v.array(v.object({
    iso: v.string(),
  }))),
  
  // AI analysis results (Phase 3)
  bookingAnalysis: v.optional(v.object({
    meetingBooked: v.boolean(),
    slotIso: v.optional(v.string()),
    confidence: v.number(),
    reasoning: v.string(),
    rejectionDetected: v.boolean(),
  })),
})
  .index("by_opportunity", ["opportunityId"]) 
  .index("by_agency", ["agencyId"]) 
  .index("by_vapi_call_id", ["vapiCallId"]),
```

---

## Phase 2: Frontend Changes

### 2.1 Create New Component: DemoCallModal

**File:** `app/dashboard/marketing/[flowId]/components/DemoCallModal.tsx` (NEW FILE)

**Full Component Code:**

```typescript
"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Info, Phone, Mail } from "lucide-react";

type DemoCallModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: Id<"client_opportunities">;
  agencyId: Id<"agency_profile">;
  atlasCreditsBalance: number;
};

export default function DemoCallModal({
  open,
  onOpenChange,
  opportunityId,
  agencyId,
  atlasCreditsBalance,
}: DemoCallModalProps) {
  const router = useRouter();
  const startDemoCall = useAction(api.call.calls.startDemoCall);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isPhoneValid = phoneRegex.test(phoneNumber);
  const isEmailValid = emailRegex.test(email);
  const hasCredits = atlasCreditsBalance >= 1;
  const canSubmit = isPhoneValid && isEmailValid && hasCredits && !isStarting;

  const handleStartDemoCall = async () => {
    if (!canSubmit) return;

    setIsStarting(true);
    setError(null);

    try {
      const result = await startDemoCall({
        opportunityId,
        agencyId,
        overridePhone: phoneNumber,
        overrideEmail: email,
      });

      // Navigate to call detail page
      router.push(`/dashboard/calls/${result.callId}`);
      onOpenChange(false);
    } catch (err) {
      console.error("Start demo call failed:", err);
      const message = err instanceof Error ? err.message : "Failed to start demo call";
      setError(message);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Start Demo Call</DialogTitle>
          <DialogDescription className="text-base">
            Test the AI calling system with your own contact information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Info Alert */}
          <Alert className="border-primary/40 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm text-muted-foreground">
              This will start a real call to your number with the same AI assistant that would
              call prospects. <span className="font-semibold">1 atlas_credit</span> will be charged
              per minute.
            </AlertDescription>
          </Alert>

          {/* Phone Number Input */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-semibold">
              Your Phone Number
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                placeholder="+12025551234"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Use E.164 format: country code + number (e.g., +12025551234)
            </p>
            {phoneNumber && !isPhoneValid && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Invalid phone format. Example: +12025551234
              </p>
            )}
          </div>

          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-semibold">
              Your Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Used for calendar invite and follow-up if a meeting is booked
            </p>
            {email && !isEmailValid && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Invalid email format
              </p>
            )}
          </div>

          {/* Credits Warning */}
          {!hasCredits && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                You need at least 1 atlas_credit to start a demo call
              </AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isStarting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleStartDemoCall}
            disabled={!canSubmit}
            className="btn-primary"
          >
            {isStarting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting Call...
              </>
            ) : (
              <>
                <Phone className="mr-2 h-4 w-4" />
                Start Demo Call
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 2.2 Update Marketing Flow Page

**File:** `app/dashboard/marketing/[flowId]/page.tsx`

**Changes Required:**

#### 2.2.1 Add Import (top of file, after existing imports)

```typescript
import DemoCallModal from "./components/DemoCallModal";
```

#### 2.2.2 Add Action Hook (line 57, after existing hooks)

```typescript
const startDemoCall = useAction(api.call.calls.startDemoCall);
```

#### 2.2.3 Add State for Modal (line 60, after existing state)

```typescript
const [demoCallModalOpen, setDemoCallModalOpen] = useState(false);
const [demoCallOpportunityId, setDemoCallOpportunityId] = useState<Id<"client_opportunities"> | null>(null);
```

#### 2.2.4 Replace "Start Call" Button Section

**Location:** Lines 527-597 (inside "Ready to Call" section)

**Find this block:**
```typescript
<Button
  onClick={async () => {
    setStartingCallOppId(opp._id);
    setCallErrorByOpp((prev) => {
      const next = { ...prev };
      delete next[oppKey];
      return next;
    });
    try {
      const result = await startVapiCall({
        opportunityId: opp._id,
        agencyId: agencyProfile.agencyProfileId,
      });
      // Navigate to the call workspace
      router.push(`/dashboard/calls/${result.callId}`);
    } catch (err) {
      console.error("Start call failed", err);
      const message = err instanceof Error ? err.message : "Failed to start call";
      setCallErrorByOpp((prev) => ({ ...prev, [oppKey]: message }));
    } finally {
      setStartingCallOppId(null);
    }
  }}
  disabled={startingCallOppId === opp._id || !hasCredits}
  className="btn-primary font-semibold px-6 py-2.5"
  aria-label="Start AI call"
>
  {startingCallOppId === opp._id ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Starting call...
    </>
  ) : (
    <>
      <Phone className="mr-2 h-5 w-5" />
      Start Call
    </>
  )}
</Button>
```

**Replace with:**
```typescript
<div className="flex flex-col sm:flex-row items-stretch gap-3">
  {/* Production Call Button */}
  <Button
    onClick={async () => {
      setStartingCallOppId(opp._id);
      setCallErrorByOpp((prev) => {
        const next = { ...prev };
        delete next[oppKey];
        return next;
      });
      try {
        const result = await startVapiCall({
          opportunityId: opp._id,
          agencyId: agencyProfile.agencyProfileId,
        });
        // Navigate to the call workspace
        router.push(`/dashboard/calls/${result.callId}`);
      } catch (err) {
        console.error("Start call failed", err);
        const message = err instanceof Error ? err.message : "Failed to start call";
        setCallErrorByOpp((prev) => ({ ...prev, [oppKey]: message }));
      } finally {
        setStartingCallOppId(null);
      }
    }}
    disabled={startingCallOppId === opp._id || !hasCredits}
    className="btn-primary font-semibold px-6 py-2.5 flex-1"
    aria-label="Start AI call"
  >
    {startingCallOppId === opp._id ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Starting call...
      </>
    ) : (
      <>
        <Phone className="mr-2 h-5 w-5" />
        Start Call
      </>
    )}
  </Button>

  {/* Demo Call Button */}
  <Button
    onClick={() => {
      setDemoCallOpportunityId(opp._id);
      setDemoCallModalOpen(true);
    }}
    disabled={!hasCredits}
    variant="outline"
    className="font-semibold px-6 py-2.5 border-2 hover:bg-accent/50"
    aria-label="Start demo call with test number"
  >
    <PlayCircle className="mr-2 h-5 w-5" />
    Demo Call
  </Button>
</div>
```

#### 2.2.5 Add Modal Component (end of JSX, before closing `</main>`)

**Location:** After the PaywallDialog component (around line 855)

```typescript
        {/* Paywall Dialog */}
        <PaywallDialog
          open={paywallOpen}
          onOpenChange={(open) => {
            setPaywallOpen(open);
            if (!open) {
              setPaywallDismissed(true);
            }
          }}
          billingBlock={billingBlock}
          onResume={async () => {
            try {
              const result = await resumeWorkflow({ leadGenFlowId: flowId });
              return { ok: result.success, message: result.message };
            } catch (error) {
              console.error("Resume workflow error:", error);
              return { ok: false, message: "Failed to resume workflow" };
            }
          }}
          onRefetchCustomer={async () => {
            await refetchCustomer();
          }}
        />

        {/* Demo Call Modal */}
        {demoCallModalOpen && demoCallOpportunityId && agencyProfile && (
          <DemoCallModal
            open={demoCallModalOpen}
            onOpenChange={setDemoCallModalOpen}
            opportunityId={demoCallOpportunityId}
            agencyId={agencyProfile.agencyProfileId}
            atlasCreditsBalance={atlasCreditsBalance}
          />
        )}
      </div>
    </main>
  );
}
```

---

## Phase 3: Follow-up System Integration

### 3.1 Email Confirmation Updates (Future Consideration)

**File:** `convex/call/sendFollowUp.ts`

**Current Behavior:**
- Calendar invites use `call.startedByEmail` as organizer
- Confirmation emails sent to `opportunity.email`

**Demo Call Behavior:**
- Should use `call.demoOverrides.email` when `call.isDemo === true`
- Add `[DEMO]` prefix to email subject line

**Implementation Note:**
This is already handled correctly because:
1. We set `startedByEmail: overrideEmail` in `startDemoCall`
2. The existing follow-up system uses `call.startedByEmail` for organizer
3. For demo calls, there's no `opportunity.email` so it will use the override

**Optional Enhancement (not required for initial implementation):**
Add demo detection to email subject:

```typescript
// In sendBookingConfirmation action
const subjectPrefix = call.isDemo ? "[DEMO] " : "";
const subject = `${subjectPrefix}Meeting Confirmed: ${agency.companyName} & ${opportunity.name}`;
```

---

## Testing Plan

### Unit Tests (Manual Testing)

#### Phone Number Validation
Test these inputs in the modal:

✅ **Valid:**
- `+12025551234` (US)
- `+447911123456` (UK)
- `+33123456789` (France)
- `+61234567890` (Australia)

❌ **Invalid:**
- `123` (too short)
- `abc` (letters)
- `1-800-CALL-NOW` (non-numeric)
- `(555) 555-5555` (formatting)
- `555-5555` (no country code)

#### Email Validation
✅ **Valid:**
- `test@example.com`
- `user+tag@domain.co.uk`
- `first.last@company.io`

❌ **Invalid:**
- `notanemail`
- `@example.com`
- `user@`
- `user @example.com` (space)

### Integration Tests

#### End-to-End Demo Call Flow
1. Navigate to marketing campaign with "Ready" opportunities
2. Click "Demo Call" button
3. Enter valid phone and email
4. Verify credit requirement (≥1 credit)
5. Click "Start Demo Call"
6. Verify navigation to `/dashboard/calls/${callId}`
7. Verify call record has:
   - `isDemo: true`
   - `demoOverrides.phone` = entered phone
   - `demoOverrides.email` = entered email
   - `dialedNumber` = entered phone
   - `startedByEmail` = entered email

#### Credit Handling
1. With 0 credits: "Demo Call" button disabled
2. With 1+ credits: Button enabled
3. Starting call deducts credits same as production

#### Error Handling
1. Invalid phone format: Shows inline error, button disabled
2. Invalid email format: Shows inline error, button disabled
3. Backend validation error: Shows alert with error message
4. Network failure: Shows error alert, doesn't navigate

---

## Migration & Rollout

### Schema Migration
✅ **Zero-downtime migration**
- New fields are optional (`v.optional()`)
- Existing calls have `isDemo: undefined` (implicitly false)
- No backfill required

### Backward Compatibility
✅ **Production calls unaffected**
- `startCall` action unchanged
- Existing call flow identical
- New action is additive only

### Rollout Plan
1. Deploy schema changes (optional fields = safe)
2. Deploy backend action (`startDemoCall`)
3. Deploy frontend modal component
4. Deploy page updates with demo button
5. Monitor for errors in first 24 hours
6. Announce feature to users

---

## Future Enhancements (Out of Scope)

### Phase 2 Enhancements
1. **Pre-fill from user profile:** Auto-populate email from authenticated user
2. **Phone formatting:** Auto-format as user types (e.g., `2025551234` → `+1 (202) 555-1234`)
3. **Recent contacts:** Save last 3 phone/email pairs for quick access
4. **Call history filter:** "Show/Hide Demo Calls" toggle in dashboard analytics
5. **Demo call limits:** Rate limiting (e.g., max 5 demo calls per day) for abuse prevention
6. **Batch demo:** Start multiple demo calls to different numbers (team testing)

### Analytics Exclusion
**Future requirement:** Dashboard analytics should filter `isDemo: true` calls
- Conversion metrics exclude demo calls
- Revenue projections ignore demo billing
- Keep in admin/debug views for support

---

## Security & Privacy

### Security Considerations
✅ **Authentication:** Demo calls require authenticated user (same as production)
✅ **Billing:** Same credit checks and metering as production calls
✅ **PII Protection:** User's phone/email only visible in their own call records
✅ **Abuse Prevention:** Existing credit system limits excessive testing
✅ **Audit Trail:** `isDemo` flag and `demoOverrides` provide complete audit log

### Privacy Notes
- Demo calls create real Vapi calls (not simulated)
- User's phone number sent to Vapi for dialing
- Transcript stored same as production (includes user's voice)
- Recording URL stored if Vapi records the call
- Follow-up emails sent to override email address

---

## File Changes Summary

| File | Type | Lines Changed | Description |
|------|------|---------------|-------------|
| `convex/call/calls.ts` | Modified | ~200 added | Add `startDemoCall` action, update `_createInitiatedCall` |
| `convex/schema.ts` | Modified | ~7 added | Add `isDemo` and `demoOverrides` to `calls` table |
| `app/dashboard/marketing/[flowId]/page.tsx` | Modified | ~50 modified | Add demo button, modal integration, state management |
| `app/dashboard/marketing/[flowId]/components/DemoCallModal.tsx` | Created | ~250 new | New modal component for phone/email input |

**Total:** 1 new file, 3 modified files, ~500 lines of code

---

## Implementation Checklist

### Backend
- [ ] Add `startDemoCall` action to `convex/call/calls.ts`
- [ ] Update `_createInitiatedCall` mutation with demo args
- [ ] Add `isDemo` and `demoOverrides` fields to schema
- [ ] Test phone validation (E.164 format)
- [ ] Test email validation
- [ ] Test credit preflight check
- [ ] Verify call record creation with demo flags
- [ ] Verify Vapi call placement with override phone

### Frontend
- [ ] Create `DemoCallModal.tsx` component
- [ ] Add modal import to marketing page
- [ ] Add demo call action hook
- [ ] Add modal state management
- [ ] Update "Ready to Call" section with two-button layout
- [ ] Add modal render at bottom of page
- [ ] Test modal open/close
- [ ] Test input validation UI
- [ ] Test credit warning display
- [ ] Test error handling
- [ ] Verify navigation after call start

### Testing
- [ ] Test valid phone formats
- [ ] Test invalid phone formats
- [ ] Test valid email formats
- [ ] Test invalid email formats
- [ ] Test with 0 credits (button disabled)
- [ ] Test with 1+ credits (button enabled)
- [ ] Test end-to-end flow
- [ ] Test error scenarios
- [ ] Verify call appears in dashboard
- [ ] Verify demo flag in database
- [ ] Verify follow-up emails use override email

### Deployment
- [ ] Run schema validation
- [ ] Deploy to staging
- [ ] Test in staging environment
- [ ] Deploy to production
- [ ] Monitor error logs for 24 hours
- [ ] Update documentation

---

## Questions Resolved

### 1. Should demo calls skip opportunity phone requirement entirely?
**Answer:** YES - Demo calls use override phone regardless of `opportunity.phone` value. This allows testing even on opportunities without valid phone numbers.

### 2. Should demo call button be available on ALL opportunities or only "Ready" status?
**Answer:** Only on "Ready" opportunities - maintains consistency with production call flow and ensures full dossier/context is available for realistic testing.

### 3. Should we add a visual indicator on demo calls in call history?
**Answer:** YES - Add `isDemo` flag to database and plan for future `[DEMO]` badge in UI. Initial implementation focuses on backend tracking; UI badges can be added in Phase 2.

---

## Success Metrics

### Immediate (Week 1)
- Demo call feature deployed without errors
- 0 production call regressions
- Users can successfully start demo calls

### Short-term (Month 1)
- 50%+ of new users test demo call before first production call
- Average 2-3 demo calls per user during onboarding
- <5% error rate on demo call attempts

### Long-term (Quarter 1)
- Reduced support tickets about "how AI calls work"
- Increased confidence in call quality
- Higher conversion from trial to production usage

---

## Support & Troubleshooting

### Common Issues

**Issue:** "Invalid phone number format"
**Solution:** Ensure E.164 format with country code (e.g., +12025551234)

**Issue:** "Demo Call button disabled"
**Solution:** Check atlas_credits balance - minimum 1 credit required

**Issue:** "Call started but no audio"
**Solution:** Check phone settings, verify number is correct and reachable

**Issue:** "Email confirmation not received"
**Solution:** Verify email format, check spam folder, ensure email exists in call record

### Debug Checklist
1. Check browser console for frontend errors
2. Check Convex logs for backend errors
3. Verify call record has `isDemo: true` and `demoOverrides`
4. Verify Vapi call was created (check `vapiCallId`)
5. Check webhook logs for call status updates

---

## Conclusion

This implementation adds demo call functionality without modifying existing production call flow, ensuring zero risk to current operations. The feature provides users with hands-on experience of the AI calling system before contacting real prospects, increasing confidence and reducing support burden.

**Estimated implementation time:** 4-6 hours
**Risk level:** Low (additive changes only)
**Dependencies:** None (self-contained feature)

