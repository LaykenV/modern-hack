"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface OverallProgressProps {
  onboardingFlowId: Id<"onboarding_flow">;
}

export function OverallProgress({ onboardingFlowId }: OverallProgressProps) {
  const progress = useQuery(api.onboarding.queries.getOverallProgress, { 
    onboardingFlowId 
  });
  
  if (progress === undefined) {
    return (
      <div className="w-full bg-slate-200 rounded-full h-2 animate-pulse">
        <div className="bg-slate-300 h-2 rounded-full"></div>
      </div>
    );
  }

  const percentage = Math.round(progress * 100);
  const isComplete = progress >= 1;
  const hasStarted = progress > 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Overall Progress
        </span>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {percentage}%
        </span>
      </div>
      
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-500 ease-out ${
            isComplete 
              ? 'bg-green-500' 
              : hasStarted 
                ? 'bg-blue-500' 
                : 'bg-slate-300'
          }`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      
      {isComplete && (
        <div className="flex items-center gap-1 mt-2">
          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-sm text-green-600 dark:text-green-400 font-medium">
            Analysis Complete
          </span>
        </div>
      )}
    </div>
  );
}
