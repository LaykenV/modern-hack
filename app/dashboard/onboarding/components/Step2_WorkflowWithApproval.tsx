"use client";

import { useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { OverallProgress } from "./OverallProgress";
import { PhaseTimeline } from "./PhaseTimeline";
import { PageDiscoveryGrid } from "./PageDiscoveryGrid";
import { StreamingSummary } from "./StreamingSummary";
import { EventLog } from "./EventLog";

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
      <div className="max-w-4xl mx-auto w-full">
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-slate-500">Loading workflow status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Analyzing Your Website</h1>
        <p className="text-sm text-slate-500">
          Step 2 of 4: We&apos;re analyzing your website to understand your business
        </p>
      </div>

      {/* Overall Progress */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
        <OverallProgress onboardingFlowId={onboardingFlowId} />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Workflow Progress */}
        <div className="space-y-6">
          {/* Phase Timeline */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
            <PhaseTimeline phases={flow.phases} />
          </div>

          {/* Event Log */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Recent Activity
            </h2>
            <EventLog lastEvent={flow.lastEvent} />
          </div>
        </div>

        {/* Right Column - Content Views */}
        <div className="space-y-6">
          {/* Streaming Summary */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
            <StreamingSummary 
              onboardingFlowId={onboardingFlowId}
              summaryThread={flow.summaryThread}
            />
          </div>

          {/* Page Discovery Grid */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
            <PageDiscoveryGrid onboardingFlowId={onboardingFlowId} />
          </div>
        </div>
      </div>

      {/* Completion Status */}
      {isWorkflowComplete && (
        <div className="text-center pt-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
            <p className="text-green-800 dark:text-green-200 text-sm">
              <strong>Analysis Complete!</strong> Your website has been analyzed and content has been generated. 
              You can now review and edit the generated content.
            </p>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Proceeding to content review...
          </p>
        </div>
      )}

      {/* Loading States */}
      {!isWorkflowComplete && (
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">Analysis in progress... This may take a few minutes</span>
          </div>
        </div>
      )}

      {/* Error States */}
      {flow.status === "error" && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Analysis Error</span>
          </div>
          <p className="text-red-700 dark:text-red-300 text-sm mt-1">
            There was an issue analyzing your website. Please try refreshing the page or contact support if the problem persists.
          </p>
        </div>
      )}
    </div>
  );
}
