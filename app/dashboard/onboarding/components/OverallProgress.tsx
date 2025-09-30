"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2 } from "lucide-react";

interface OverallProgressProps {
  onboardingFlowId: Id<"onboarding_flow">;
}

export function OverallProgress({ onboardingFlowId }: OverallProgressProps) {
  const progress = useQuery(api.onboarding.queries.getOverallProgress, { 
    onboardingFlowId 
  });
  
  if (progress === undefined) {
    return (
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    );
  }

  const percentage = Math.round(progress * 100);
  const isComplete = progress >= 1;
  const hasStarted = progress > 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-foreground">
          Overall Progress
        </span>
        <span className="text-sm font-semibold text-foreground">
          {percentage}%
        </span>
      </div>
      
      <div className="w-full rounded-full h-2 border border-border/40 overflow-hidden" style={{ backgroundColor: 'hsl(var(--surface-muted))' }}>
        <div 
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ 
            width: `${percentage}%`,
            backgroundColor: isComplete 
              ? 'hsl(var(--success))' 
              : hasStarted 
                ? 'hsl(var(--primary))' 
                : 'hsl(var(--muted))'
          }}
        ></div>
      </div>
      
      {isComplete && (
        <div className="flex items-center gap-2 mt-3">
          <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
          <span className="text-sm text-[hsl(var(--success))] font-semibold">
            Analysis Complete
          </span>
        </div>
      )}
    </div>
  );
}
