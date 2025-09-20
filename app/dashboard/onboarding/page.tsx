"use client";

import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { InitialSetupForm } from "./components/Step1_InitialSetupForm";
import { WorkflowWithApproval } from "./components/Step2_WorkflowWithApproval";
import { FinalConfigurationForm } from "./components/Step3_FinalConfigurationForm";
import { Claim } from "./components/ClaimsApproval";

type OnboardingStep = 1 | 2 | 3;

interface OnboardingState {
  currentStep: OnboardingStep;
  agencyProfileId?: Id<"agency_profile">;
  onboardingFlowId?: Id<"onboarding_flow">;
  approvedClaims?: Claim[];
  guardrails?: string[];
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

    // If we have an onboarding flow, move to step 2
    if (agencyProfile.onboardingFlowId) {
      setOnboardingState(prev => ({
        ...prev,
        currentStep: 2,
        // We'll get the agencyProfileId from the workflow component
        onboardingFlowId: agencyProfile.onboardingFlowId,
      }));
    }
  }, [agencyProfile, router]);

  const handleWorkflowStarted = (agencyProfileId: string) => {
    setOnboardingState(prev => ({
      ...prev,
      currentStep: 2,
      agencyProfileId: agencyProfileId as Id<"agency_profile">,
    }));
  };

  const handleClaimsApproved = (approvedClaims: Claim[], guardrails: string[]) => {
    setOnboardingState(prev => ({
      ...prev,
      currentStep: 3,
      approvedClaims,
      guardrails,
    }));
  };

  const handleOnboardingComplete = () => {
    router.replace("/dashboard");
  };

  // Step indicator component
  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center space-x-4">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step < onboardingState.currentStep
                  ? 'bg-green-500 text-white'
                  : step === onboardingState.currentStep
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-300 text-slate-600'
              }`}
            >
              {step < onboardingState.currentStep ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                step
              )}
            </div>
            {step < 3 && (
              <div
                className={`w-12 h-0.5 ml-2 ${
                  step < onboardingState.currentStep ? 'bg-green-500' : 'bg-slate-300'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <StepIndicator />
      
      {onboardingState.currentStep === 1 && (
        <InitialSetupForm onWorkflowStarted={handleWorkflowStarted} />
      )}

      {onboardingState.currentStep === 2 && (
        <WorkflowWithApproval
          onClaimsApproved={handleClaimsApproved}
        />
      )}

      {onboardingState.currentStep === 3 && 
       onboardingState.approvedClaims && 
       onboardingState.guardrails && (
        <FinalConfigurationForm
          approvedClaims={onboardingState.approvedClaims}
          guardrails={onboardingState.guardrails}
          onComplete={handleOnboardingComplete}
        />
      )}
    </div>
  );
}


