"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { OverallProgress } from "./OverallProgress";
import { PhaseTimeline } from "./PhaseTimeline";
import { PageDiscoveryGrid } from "./PageDiscoveryGrid";
import { StreamingSummary } from "./StreamingSummary";
import { EventLog } from "./EventLog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface WorkflowWithApprovalProps { 
  onCompleted: () => void;
  onWorkflowComplete?: (isComplete: boolean) => void;
}

export function WorkflowWithApproval({ onWorkflowComplete }: WorkflowWithApprovalProps) {
  const summaryRef = useRef<HTMLDivElement>(null);
  const [hasShownToast, setHasShownToast] = useState(false);
  const [hasScrolledToSummary, setHasScrolledToSummary] = useState(false);

  // Get seller brain data to find onboarding flow ID
  const sellerBrain = useQuery(api.sellerBrain.getForCurrentUser);
  const onboardingFlowId = sellerBrain?.onboardingFlowId;
  
  // Get the onboarding flow data
  const flow = useQuery(
    api.onboarding.queries.getOnboardingFlow,
    onboardingFlowId ? { onboardingFlowId } : "skip"
  );

  // Check if workflow is complete
  const isWorkflowComplete = flow?.status === "completed";

  // Notify parent of workflow completion status
  useEffect(() => {
    if (onWorkflowComplete) {
      onWorkflowComplete(isWorkflowComplete);
    }
  }, [isWorkflowComplete, onWorkflowComplete]);

  // Show success toast when workflow completes
  useEffect(() => {
    if (isWorkflowComplete && !hasShownToast) {
      toast.success("Analysis Complete!", {
        description: "Your website has been analyzed successfully. Review the generated content to continue.",
        duration: 5000,
      });
      setHasShownToast(true);
    }
  }, [isWorkflowComplete, hasShownToast]);

  // Callback to scroll when content actually starts rendering
  const handleContentStart = () => {
    if (!hasScrolledToSummary && summaryRef.current) {
      summaryRef.current.scrollIntoView({ 
        behavior: "smooth", 
        block: "start" 
      });
      setHasScrolledToSummary(true);
    }
  };

  if (!onboardingFlowId || !flow) {
    return (
      <div className="max-w-6xl mx-auto w-full space-y-6 md:space-y-8">
        <div className="card-warm-static p-6 md:p-8 text-center">
          <Skeleton className="h-10 w-64 mx-auto mb-3" />
          <Skeleton className="h-6 w-96 mx-auto" />
        </div>

        <div className="card-warm-static p-6">
          <Skeleton className="h-4 w-full mb-4" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="card-warm-static p-6">
              <Skeleton className="h-8 w-48 mb-4" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            </div>
            <div className="card-warm-static p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
          <div className="space-y-6">
            <div className="card-warm-static p-6">
              <Skeleton className="h-8 w-48 mb-4" />
              <Skeleton className="h-32 w-full" />
            </div>
            <div className="card-warm-static p-6">
              <Skeleton className="h-8 w-48 mb-4" />
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6 md:space-y-8 pb-24">
      {/* Header with Progress and Recent Activity */}
      <div className="card-warm-static p-6 md:p-8">
        <div className="text-center mb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Analyzing Your Website
          </h1>
        </div>
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto text-center mb-8">
          We&apos;re analyzing your website to understand your business and generate personalized content
        </p>
        
        {/* Progress Bar */}
        <div className="mb-6">
          <OverallProgress onboardingFlowId={onboardingFlowId} />
        </div>

        {/* Recent Activity */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Recent Activity</h3>
          <EventLog lastEvent={flow.lastEvent} />
        </div>
      </div>

      <Separator />

      {/* Workflow and Pages Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Workflow Progress */}
        <div className="card-warm-static p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
            Workflow Progress
          </h2>
          <PhaseTimeline phases={flow.phases} />
        </div>

        {/* Right Column - Page Discovery */}
        <div className="card-warm-static p-6">
          <PageDiscoveryGrid onboardingFlowId={onboardingFlowId} />
        </div>
      </div>

      {/* AI Summary - Full Width at Bottom */}
      <div ref={summaryRef} className="card-warm-static p-6">
        <StreamingSummary 
          onboardingFlowId={onboardingFlowId}
          summaryThread={flow.summaryThread}
          onContentStart={handleContentStart}
        />
      </div>

      {flow.status === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="text-lg font-semibold text-foreground">Analysis Error</AlertTitle>
          <AlertDescription className="mt-2 text-muted-foreground">
            There was an issue analyzing your website. Please try refreshing the page or contact support if the problem persists.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
