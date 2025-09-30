"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
          <div className="w-6 h-6 rounded-full border-2 border-border bg-surface-raised flex items-center justify-center">
            <span className="text-xs font-medium text-muted-foreground">{index + 1}</span>
          </div>
        );
      case "running":
        return (
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <Loader2 className="w-3.5 h-3.5 text-primary-foreground animate-spin" />
          </div>
        );
      case "complete":
        return (
          <div className="w-6 h-6 rounded-full bg-[hsl(var(--success))] flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-success-foreground" />
          </div>
        );
      case "error":
        return (
          <div className="w-6 h-6 rounded-full bg-destructive flex items-center justify-center">
            <XCircle className="w-3.5 h-3.5 text-destructive-foreground" />
          </div>
        );
    }
  };

  const getStatusColor = () => {
    switch (phase.status) {
      case "pending": return "text-muted-foreground";
      case "running": return "text-primary";
      case "complete": return "text-[hsl(var(--success))]";
      case "error": return "text-destructive";
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
              <Badge variant="outline" className="text-xs">
                {percentage}%
              </Badge>
            )}
            {phase.duration && (
              <span className="text-xs text-muted-foreground">
                {formatDuration(phase.duration)}
              </span>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground mt-1">
            {PHASE_DESCRIPTIONS[phase.name]}
          </p>
          
          {phase.status === "running" && phase.progress > 0 && (
            <div className="mt-2 w-full rounded-full h-2 border border-border/40 overflow-hidden" style={{ backgroundColor: 'hsl(var(--surface-muted))' }}>
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{ 
                  width: `${percentage}%`,
                  backgroundColor: 'hsl(var(--primary))'
                }}
              ></div>
            </div>
          )}
          
          {phase.status === "error" && phase.errorMessage && (
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-auto p-0 text-xs text-destructive hover:text-destructive/80 font-semibold"
              >
                {isExpanded ? "Hide" : "Show"} Error Details
              </Button>
              {isExpanded && (
                <Alert variant="destructive" className="mt-2 p-2">
                  <AlertDescription className="text-xs">
                    {phase.errorMessage}
                  </AlertDescription>
                </Alert>
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
      <div className="space-y-4">
        {phases.map((phase, index) => (
          <PhaseCard key={phase.name} phase={phase} index={index} />
        ))}
      </div>
    </div>
  );
}
