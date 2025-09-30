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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Rocket, Search, FileText, Settings, Loader2 } from "lucide-react";

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
    <main className="min-h-full p-4 md:p-6 lg:p-8">
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
  const isLoading = agencyProfile === undefined;
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  const [onboardingState, setOnboardingState] = useState<OnboardingState>({
    currentStep: 1,
  });

  // Determine current step based on agency profile data
  useEffect(() => {
    if (!agencyProfile) return;

    // Note: Redirect to dashboard if onboarding is complete is handled in layout.tsx
    
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
  }, [agencyProfile]);

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
    setIsRedirecting(true);
    router.replace("/dashboard");
  };

  // Step indicator component with enhanced UX
  const StepIndicator = () => {
    const isManual = onboardingState.mode === "manual";
    
    // Define steps to render with actual and display numbers
    const steps = isManual
      ? [
          { actual: 1 as OnboardingStep, display: 1, label: "Setup", description: "Basic information", icon: Rocket },
          { actual: 3 as OnboardingStep, display: 2, label: "Review", description: "Review content", icon: FileText },
          { actual: 4 as OnboardingStep, display: 3, label: "Configure", description: "Final settings", icon: Settings },
        ]
      : [
          { actual: 1 as OnboardingStep, display: 1, label: "Setup", description: "Basic information", icon: Rocket },
          { actual: 2 as OnboardingStep, display: 2, label: "Analysis", description: "AI analysis", icon: Search },
          { actual: 3 as OnboardingStep, display: 3, label: "Review", description: "Review content", icon: FileText },
          { actual: 4 as OnboardingStep, display: 4, label: "Configure", description: "Final settings", icon: Settings },
        ];

    const currentStepIndex = steps.findIndex(s => s.actual === onboardingState.currentStep);
    const progressPercentage = ((currentStepIndex + 1) / steps.length) * 100;

    return (
      <div className="card-warm-static p-4 sm:p-6 md:p-8 mb-6 md:mb-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
              {steps[currentStepIndex]?.label || "Getting Started"}
            </h1>
            <Badge variant="secondary" className="text-xs sm:text-sm">
              Step {currentStepIndex + 1} of {steps.length}
            </Badge>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">
            {steps[currentStepIndex]?.description || "Complete your profile setup"}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <Progress value={progressPercentage} className="h-2" />
        </div>

        <Separator className="mb-6" />

        {/* Desktop: Horizontal step indicators */}
        <div className="hidden md:flex items-center justify-between">
          {steps.map((s, index) => {
            const Icon = s.icon;
            const isCompleted = s.actual < onboardingState.currentStep;
            const isCurrent = s.actual === onboardingState.currentStep;

            return (
              <div key={s.actual} className="flex items-center flex-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col items-center gap-2 flex-1">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                            isCompleted
                              ? 'bg-success text-success-foreground shadow-sm'
                              : isCurrent
                              ? 'bg-gradient-to-br from-[hsl(var(--primary)/0.85)] to-[hsl(var(--primary)/0.95)] text-primary-foreground shadow-[0_2px_12px_hsl(var(--primary)/0.4)] scale-110'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-6 h-6" />
                          ) : (
                            <Icon className="w-6 h-6" />
                          )}
                        </div>
                        <div className="text-center">
                          <p className={`text-sm font-semibold ${
                            isCurrent ? 'text-primary' : isCompleted ? 'text-success' : 'text-muted-foreground'
                          }`}>
                            {s.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {s.description}
                          </p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isCompleted ? 'Completed' : isCurrent ? 'Current step' : 'Upcoming'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {index < steps.length - 1 && (
                  <div className="flex items-center justify-center px-4">
                    <div
                      className={`h-0.5 w-full min-w-[40px] transition-all duration-300 ${
                        s.actual < onboardingState.currentStep 
                          ? 'bg-success' 
                          : 'bg-border'
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile: Compact step indicators */}
        <div className="flex md:hidden gap-2 justify-center">
          {steps.map((s) => {
            const Icon = s.icon;
            const isCompleted = s.actual < onboardingState.currentStep;
            const isCurrent = s.actual === onboardingState.currentStep;

            return (
              <TooltipProvider key={s.actual}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isCompleted
                          ? 'bg-success text-success-foreground shadow-sm'
                          : isCurrent
                          ? 'bg-gradient-to-br from-[hsl(var(--primary)/0.85)] to-[hsl(var(--primary)/0.95)] text-primary-foreground shadow-[0_2px_12px_hsl(var(--primary)/0.4)] scale-110'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-semibold">{s.label}</p>
                    <p className="text-xs">{s.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>
    );
  };

  // Centered loading spinner - shows while auth/data resolves and before potential redirects
  const CenteredLoader = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your profile...</p>
      </div>
    </div>
  );

  // Show loading state while data resolves and before any redirects
  if (isLoading || isRedirecting) {
    return <CenteredLoader />;
  }

  return (
    <div className="max-w-7xl mx-auto w-full">
      <StepIndicator />
      
      {/* Step content with smooth transitions */}
      <div className="animate-in fade-in duration-500">
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
    </div>
  );
}


