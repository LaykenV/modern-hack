"use client";

import { useQuery } from "convex/react";
import { useThreadMessages, toUIMessages } from "@convex-dev/agent/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useEffect } from "react";

interface StreamingSummaryProps {
  onboardingFlowId: Id<"onboarding_flow">;
  summaryThread?: string;
}

// Simple smooth text hook for streaming display
function useSmoothText(text: string, speed: number = 50) {
  const [displayText, setDisplayText] = useState("");
  
  useEffect(() => {
    if (!text) {
      setDisplayText("");
      return;
    }
    
    let currentIndex = 0;
    setDisplayText("");
    
    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayText(text.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, speed);
    
    return () => clearInterval(interval);
  }, [text, speed]);
  
  return displayText;
}

export function StreamingSummary({ onboardingFlowId, summaryThread }: StreamingSummaryProps) {
  const flow = useQuery(api.onboarding.queries.getOnboardingFlow, {
    onboardingFlowId
  });

  // Always call the hook; pass a dummy threadId when absent to keep call order stable
  const effectiveThreadId = summaryThread ?? "";
  const shouldStream = Boolean(summaryThread);
  const messages = useThreadMessages(
    api.onboarding.summary.listSummaryMessages,
    { onboardingFlowId, threadId: effectiveThreadId },
    { initialNumItems: 10, stream: shouldStream }
  );

  // Get the seller brain summary (final result)
  const sellerBrain = useQuery(api.sellerBrain.getForCurrentUser);

  const summaryPhase = flow?.phases.find(p => p.name === "summary");
  const isSummaryActive = summaryPhase?.status === "running";
  const isSummaryComplete = summaryPhase?.status === "complete";

  // Prepare streaming content from agent messages
  const uiMessages = toUIMessages(shouldStream ? (messages?.results ?? []) : []);
  const latestAssistant = [...uiMessages]
    .reverse()
    .find((m) => m.role === "assistant");
  const streamingContent = latestAssistant?.text ?? "";

  // Use final summary if available, otherwise streaming content
  const finalSummary = sellerBrain?.summary;
  const displayContent = finalSummary || streamingContent;
  
  // Use smooth text for streaming effect when actively streaming
  const smoothContent = useSmoothText(
    isSummaryActive ? displayContent : "",
    30
  );

  const contentToShow = isSummaryActive ? smoothContent : displayContent;

  if (!summaryPhase || summaryPhase.status === "pending") {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          AI Summary
        </h2>
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-500">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">Waiting for content analysis to begin...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          AI Summary
        </h2>
        {isSummaryActive && (
          <div className="flex items-center gap-2 text-blue-600">
            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium">Generating...</span>
          </div>
        )}
        {isSummaryComplete && (
          <div className="flex items-center gap-2 text-green-600">
            <div className="w-3 h-3 rounded-full bg-green-600"></div>
            <span className="text-sm font-medium">Complete</span>
          </div>
        )}
      </div>

      <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 min-h-[200px]">
        {contentToShow ? (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <div className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {contentToShow}
              {isSummaryActive && (
                <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse"></span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-slate-500">
            <div className="text-center">
              <div className="w-8 h-8 mx-auto mb-2 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-sm">Analyzing your website content...</p>
            </div>
          </div>
        )}
      </div>

      {summaryPhase.errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm">
            <strong>Error:</strong> {summaryPhase.errorMessage}
          </p>
        </div>
      )}
    </div>
  );
}
