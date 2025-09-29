"use client";

import { useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { OverallProgress } from "./OverallProgress";
import { PhaseTimeline } from "./PhaseTimeline";
import { PageDiscoveryGrid } from "./PageDiscoveryGrid";
import { StreamingSummary } from "./StreamingSummary";
import { EventLog } from "./EventLog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface WorkflowWithApprovalProps {
  onCompleted: () => void;
}

export function WorkflowWithApproval({ onCompleted }: WorkflowWithApprovalProps) {

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
  
  // Auto-advance to step 3 when workflow is complete
  useEffect(() => {
    if (isWorkflowComplete) {
      onCompleted();
    }
  }, [isWorkflowComplete, onCompleted]);

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
    <div className="max-w-6xl mx-auto w-full space-y-6 md:space-y-8">
      {/* Header */}
      <div className="card-warm-static p-4 sm:p-6 md:p-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Loader2 className="h-6 w-6 md:h-8 md:w-8 text-primary animate-spin" />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Analyzing Your Website
          </h1>
        </div>
        <p className="text-sm sm:text-base md:text-lg text-muted-foreground">
          We&apos;re analyzing your website to understand your business and generate personalized content
        </p>
      </div>

      {/* Overall Progress */}
      <div className="card-warm-static p-4 sm:p-6">
        <OverallProgress onboardingFlowId={onboardingFlowId} />
      </div>

      <Separator />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Workflow Progress */}
        <div className="space-y-4 sm:space-y-6">
          {/* Phase Timeline */}
          <div className="card-warm-static p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Workflow Progress
            </h2>
            <PhaseTimeline phases={flow.phases} />
          </div>

          {/* Event Log */}
          <div className="card-warm-static p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-foreground mb-4">
              Recent Activity
            </h2>
            <EventLog lastEvent={flow.lastEvent} />
          </div>
        </div>

        {/* Right Column - Content Views */}
        <div className="space-y-4 sm:space-y-6">
          {/* Streaming Summary */}
          <div className="card-warm-static p-4 sm:p-6">
            <StreamingSummary 
              onboardingFlowId={onboardingFlowId}
              summaryThread={flow.summaryThread}
            />
          </div>

          {/* Page Discovery Grid */}
          <div className="card-warm-static p-4 sm:p-6">
            <PageDiscoveryGrid onboardingFlowId={onboardingFlowId} />
          </div>
        </div>
      </div>

      {/* Completion Status */}
      {isWorkflowComplete && (
        <Alert className="bg-gradient-to-br from-success/10 to-success/5 border-success/30">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <AlertTitle className="text-lg font-semibold">Analysis Complete!</AlertTitle>
          <AlertDescription className="text-sm mt-2">
            Your website has been analyzed and content has been generated. You can now review and edit the generated content.
          </AlertDescription>
          <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Proceeding to content review...
          </div>
        </Alert>
      )}

      {/* Error States */}
      {flow.status === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="text-lg font-semibold">Analysis Error</AlertTitle>
          <AlertDescription className="mt-2">
            There was an issue analyzing your website. Please try refreshing the page or contact support if the problem persists.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
