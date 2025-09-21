"use client";

import { useState } from "react";

interface Phase {
  name: "crawl" | "filter" | "scrape" | "summary" | "claims" | "coreOffer" | "verify";
  status: "pending" | "running" | "complete" | "error";
  progress: number; // 0-1
  errorMessage?: string;
  startedAt?: number;
  completedAt?: number;
  duration?: number;
}

interface PhaseTimelineProps {
  phases: Phase[];
}

const PHASE_LABELS = {
  crawl: "Discovering Pages",
  filter: "Filtering Content", 
  scrape: "Extracting Data",
  summary: "Generating Summary",
  claims: "Creating Claims",
  coreOffer: "Generating Core Offer",
  verify: "Verifying Claims"
} as const;

const PHASE_DESCRIPTIONS = {
  crawl: "Crawling your website to discover all pages",
  filter: "Analyzing content relevance and filtering pages",
  scrape: "Extracting detailed content from relevant pages", 
  summary: "AI is generating a comprehensive business summary",
  claims: "Creating factual claims about your business",
  coreOffer: "Generating a core offer for your business",
  verify: "Verifying claims against source content"
} as const;

function PhaseCard({ phase, index }: { phase: Phase; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const getStatusIcon = () => {
    switch (phase.status) {
      case "pending":
        return (
          <div className="w-6 h-6 rounded-full border-2 border-slate-300 bg-white flex items-center justify-center">
            <span className="text-xs font-medium text-slate-500">{index + 1}</span>
          </div>
        );
      case "running":
        return (
          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        );
      case "complete":
        return (
          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case "error":
        return (
          <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        );
    }
  };

  const getStatusColor = () => {
    switch (phase.status) {
      case "pending": return "text-slate-500";
      case "running": return "text-blue-600";
      case "complete": return "text-green-600";
      case "error": return "text-red-600";
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return null;
    const seconds = Math.round(duration / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const percentage = Math.round(phase.progress * 100);

  return (
    <div className="relative">
      <div className="flex items-start gap-3">
        {getStatusIcon()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-medium ${getStatusColor()}`}>
              {PHASE_LABELS[phase.name]}
            </h3>
            {phase.status === "running" && (
              <span className="text-xs text-slate-500">{percentage}%</span>
            )}
            {phase.duration && (
              <span className="text-xs text-slate-500">
                {formatDuration(phase.duration)}
              </span>
            )}
          </div>
          
          <p className="text-xs text-slate-500 mt-1">
            {PHASE_DESCRIPTIONS[phase.name]}
          </p>
          
          {phase.status === "running" && phase.progress > 0 && (
            <div className="mt-2 w-full bg-slate-200 rounded-full h-1">
              <div 
                className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
          )}
          
          {phase.status === "error" && phase.errorMessage && (
            <div className="mt-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-red-600 hover:text-red-700 underline"
              >
                {isExpanded ? "Hide" : "Show"} Error Details
              </button>
              {isExpanded && (
                <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {phase.errorMessage}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PhaseTimeline({ phases }: PhaseTimelineProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
        Analysis Progress
      </h2>
      <div className="space-y-4">
        {phases.map((phase, index) => (
          <PhaseCard key={phase.name} phase={phase} index={index} />
        ))}
      </div>
    </div>
  );
}
