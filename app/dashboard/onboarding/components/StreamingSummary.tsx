"use client";

import { useQuery } from "convex/react";
import { useThreadMessages, toUIMessages, useSmoothText } from "@convex-dev/agent/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEffect } from "react";

interface StreamingSummaryProps {
  onboardingFlowId: Id<"onboarding_flow">;
  summaryThread?: string;
  onContentStart?: () => void;
}

export function StreamingSummary({ onboardingFlowId, summaryThread, onContentStart }: StreamingSummaryProps) {
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
  
  // Use the agent's built-in smooth text for better streaming performance
  const [smoothContent] = useSmoothText(displayContent, {
    startStreaming: isSummaryActive,
  });

  const contentToShow = smoothContent;

  // Notify parent when content actually starts rendering
  useEffect(() => {
    if (contentToShow && contentToShow.length > 0 && onContentStart) {
      onContentStart();
    }
  }, [contentToShow, onContentStart]);

  if (!summaryPhase || summaryPhase.status === "pending") {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          AI Summary
        </h2>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          AI Summary
        </h2>
        {isSummaryActive && (
          <Badge 
            variant="outline" 
            className="bg-gradient-to-b from-[hsl(var(--primary)/0.24)] to-[hsl(var(--primary)/0.42)] text-[hsl(var(--primary-foreground))] border-[hsl(var(--ring)/0.5)] shadow-[0_0_0_1px_hsl(var(--ring)/0.35)_inset,_var(--shadow-soft)]"
          >
            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
            Generating
          </Badge>
        )}
        {isSummaryComplete && (
          <Badge variant="outline" className="bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30">
            <CheckCircle2 className="w-3 h-3 mr-1.5" />
            Complete
          </Badge>
        )}
      </div>

      <div className="border border-border/60 rounded-lg p-4 bg-surface-raised/50 min-h-[200px]">
        {contentToShow ? (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
              {contentToShow}
              {isSummaryActive && (
                <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse rounded-sm"></span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <div className="text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-3 text-primary animate-spin" />
              <p className="text-sm font-medium">Analyzing your website content...</p>
            </div>
          </div>
        )}
      </div>

      {summaryPhase.errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>
            <strong>Error:</strong> {summaryPhase.errorMessage}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
