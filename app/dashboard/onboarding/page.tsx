"use client";

import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { InitialSetupForm } from "./components/Step1_InitialSetupForm";
import { WorkflowWithApproval } from "./components/Step2_WorkflowWithApproval";
import { ReviewAndEditGenerated } from "./components/Step3_ReviewAndEditGenerated";
import { Step4FinalConfigurationForm } from "./components/Step4_FinalConfigurationForm";

type OnboardingStep = 1 | 2 | 3 | 4;
type Mode = "manual" | "automated";

interface OnboardingState {
  currentStep: OnboardingStep;
  mode?: Mode;
  agencyProfileId?: Id<"agency_profile">;
  onboardingFlowId?: Id<"onboarding_flow">;
}

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4">
      <Unauthenticated>
        <RedirectToHome />
      </Unauthenticated>
      <Authenticated>
        <Content />
      </Authenticated>
    </main>
  );
}

function RedirectToHome() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}

function Content() {
  const router = useRouter();
  const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);
  console.log("agencyProfile", agencyProfile?.reviewedAt);
  
  const [onboardingState, setOnboardingState] = useState<OnboardingState>({
    currentStep: 1,
  });

  // Determine current step based on agency profile data
  useEffect(() => {
    if (!agencyProfile) return;

    // If onboarding is already completed, redirect to dashboard
    if (agencyProfile.tone && agencyProfile.targetVertical && agencyProfile.availability) {
      router.replace("/dashboard");
      return;
    }

    // If reviewedAt exists, go to Step 4 (Configure)
    // This takes precedence over onboardingFlowId to avoid bouncing back to Step 2 after review
    if (agencyProfile.reviewedAt) {
      console.log("reviewedAt", agencyProfile.reviewedAt);
      setOnboardingState(prev => ({
        ...prev,
        currentStep: 4,
        agencyProfileId: agencyProfile.agencyProfileId as Id<"agency_profile">,
      }));
      return;
    }

    // If we have an onboarding flow ID and haven't reviewed yet, go to step 2 (automated flow)
    // Let Step 2 call onCompleted() to advance to Step 3
    if (agencyProfile.onboardingFlowId) {
      setOnboardingState(prev => ({
        ...prev,
        currentStep: 2,
        mode: "automated",
        onboardingFlowId: agencyProfile.onboardingFlowId,
        agencyProfileId: agencyProfile.agencyProfileId as Id<"agency_profile">,
      }));
      return;
    }

    // If manual mode (has companyName, no onboardingFlowId, no sourceUrl), go to Step 3 (Review)
    if (agencyProfile.companyName && !agencyProfile.onboardingFlowId && !agencyProfile.sourceUrl) {
      setOnboardingState(prev => ({
        ...prev,
        currentStep: 3,
        mode: "manual",
        agencyProfileId: agencyProfile.agencyProfileId as Id<"agency_profile">,
      }));
    }
  }, [agencyProfile, router]);

  const handleStarted = (params: { mode: Mode; agencyProfileId: string; onboardingFlowId?: string }) => {
    if (params.mode === "automated") {
      setOnboardingState(prev => ({
        ...prev,
        currentStep: 2,
        mode: "automated",
        agencyProfileId: params.agencyProfileId as Id<"agency_profile">,
        onboardingFlowId: params.onboardingFlowId as Id<"onboarding_flow">,
      }));
    } else {
      // Manual mode - skip to step 3
      setOnboardingState(prev => ({
        ...prev,
        currentStep: 3,
        mode: "manual",
        agencyProfileId: params.agencyProfileId as Id<"agency_profile">,
      }));
    }
  };

  const handleWorkflowCompleted = () => {
    setOnboardingState(prev => ({
      ...prev,
      currentStep: 3,
    }));
  };

  const handleContentReviewed = () => {
    setOnboardingState(prev => ({
      ...prev,
      currentStep: 4,
    }));
  };

  const handleOnboardingComplete = () => {
    router.replace("/dashboard");
  };

  // Step indicator component
  const StepIndicator = () => {
    const isManual = onboardingState.mode === "manual";
    // Define steps to render with actual and display numbers
    const steps = isManual
      ? [
          { actual: 1 as OnboardingStep, display: 1, label: "Setup" },
          { actual: 3 as OnboardingStep, display: 2, label: "Review" },
          { actual: 4 as OnboardingStep, display: 3, label: "Configure" },
        ]
      : [
          { actual: 1 as OnboardingStep, display: 1, label: "Setup" },
          { actual: 2 as OnboardingStep, display: 2, label: "Analysis" },
          { actual: 3 as OnboardingStep, display: 3, label: "Review" },
          { actual: 4 as OnboardingStep, display: 4, label: "Configure" },
        ];

    return (
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center space-x-4">
          {steps.map((s, index) => (
            <div key={s.actual} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  s.actual < onboardingState.currentStep
                    ? 'bg-green-500 text-white'
                    : s.actual === onboardingState.currentStep
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-300 text-slate-600'
                }`}
              >
                {s.actual < onboardingState.currentStep ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  s.display
                )}
              </div>
              <div className="ml-2 text-xs text-slate-600 dark:text-slate-400">
                {s.label}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 ml-2 ${
                    s.actual < onboardingState.currentStep ? 'bg-green-500' : 'bg-slate-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      <StepIndicator />
      
      {onboardingState.currentStep === 1 && (
        <InitialSetupForm onStarted={handleStarted} />
      )}

      {onboardingState.currentStep === 2 && onboardingState.mode === "automated" && (
        <WorkflowWithApproval
          onCompleted={handleWorkflowCompleted}
        />
      )}

      {onboardingState.currentStep === 3 && onboardingState.agencyProfileId && (
        <ReviewAndEditGenerated
          agencyProfileId={onboardingState.agencyProfileId}
          mode={onboardingState.mode}
          initialSummary={agencyProfile?.summary}
          initialCoreOffer={agencyProfile?.coreOffer}
          initialGuardrails={agencyProfile?.guardrails || []}
          initialClaims={agencyProfile?.approvedClaims?.map(claim => ({
            id: claim.id,
            text: claim.text,
            source_url: claim.source_url,
          })) || []}
          onSaved={handleContentReviewed}
        />
      )}

      {onboardingState.currentStep === 4 && (
        <Step4FinalConfigurationForm
          mode={onboardingState.mode}
          onComplete={handleOnboardingComplete}
        />
      )}
    </div>
  );
}


