"use client";

import { useQuery } from "convex/react";
import { useState, useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCustomer } from "autumn-js/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import LiveListen from "@/components/LiveListen";
import Link from "next/link";

type Props = {
  params: Promise<{ callId: string }>;
};

type TranscriptFragment = { 
  role?: string; 
  text?: string; 
  timestamp?: number; 
  source?: string; 
};

export default function CallWorkspacePage({ params }: Props) {
  const { customer } = useCustomer();
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const [listenModalOpen, setListenModalOpen] = useState(false);
  const [callId, setCallId] = useState<Id<"calls"> | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  // Handle the Promise params
  useEffect(() => {
    params.then(({ callId: callIdString }) => {
      setCallId(callIdString as Id<"calls">);
    });
  }, [params]);

  // Query for call data
  const call = useQuery(api.call.calls.getCallById, callId ? { callId } : "skip");

  // Query for related opportunity data
  const opportunity = useQuery(
    api.marketing.getOpportunityById,
    call?.opportunityId ? { opportunityId: call.opportunityId } : "skip"
  );

  // Query for related marketing campaign
  const leadGenJob = useQuery(
    api.marketing.getLeadGenJob,
    opportunity?.leadGenFlowId ? { jobId: opportunity.leadGenFlowId } : "skip"
  );

  const atlasCreditsBalance = customer?.features?.atlas_credits?.balance ?? 0;

  // Ticking clock for live duration
  useEffect(() => {
    if (!call) return;
    
    const status = call.currentStatus ?? call.status ?? "unknown";
    if (status === "in-progress" && typeof call.startedAt === "number") {
      const id = setInterval(() => setNowTs(Date.now()), 1000);
      return () => clearInterval(id);
    }
  }, [call]);

  // Auto-scroll transcript when new fragments arrive
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [call?.transcript]);

  function formatDuration(ms: number | undefined): string {
    if (!ms || ms < 0) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  if (!callId) {
    return (
      <main className="min-h-full p-6 md:p-8">
        <div className="max-w-4xl mx-auto w-full">
          <div className="card-warm-static p-12 text-center">
            <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading call details...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!call) {
    return (
      <main className="min-h-full p-6 md:p-8">
        <div className="max-w-4xl mx-auto w-full">
          <div className="card-warm-static p-12 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Call Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The call you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
            </p>
            <Link href="/dashboard/calls" className="btn-contrast">
              ← Back to Calls
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const status = call.currentStatus ?? call.status ?? "unknown";
  const startedAt = call.startedAt;
  const isInProgress = status === "in-progress";
  
  // Calculate duration
  const billingDurationMs = typeof call.billingSeconds === "number" 
    ? Math.max(0, call.billingSeconds * 1000) 
    : undefined;
  
  let durationMs: number | undefined = undefined;
  if (typeof billingDurationMs === "number") {
    durationMs = billingDurationMs;
  } else if (isInProgress && startedAt) {
    durationMs = Math.max(0, nowTs - startedAt);
  } else if (typeof call.duration === "number") {
    durationMs = call.duration;
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold";
    
    if (status === "in-progress") {
      return (
        <span className={`${baseClasses} bg-success/20 text-success border border-success/30`}>
          <span className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse" />
          In Progress
        </span>
      );
    }
    if (status === "ringing") {
      return (
        <span className={`${baseClasses} bg-accent/60 text-accent-foreground border border-accent-foreground/20`}>
          Ringing
        </span>
      );
    }
    if (status === "queued") {
      return (
        <span className={`${baseClasses} bg-muted text-muted-foreground border border-border`}>
          Queued
        </span>
      );
    }
    if (status === "completed") {
      return (
        <span className={`${baseClasses} bg-primary/20 text-primary border border-primary/30`}>
          Completed
        </span>
      );
    }
    if (status === "failed") {
      return (
        <span className={`${baseClasses} bg-destructive/20 text-destructive border border-destructive/30`}>
          Failed
        </span>
      );
    }
    return (
      <span className={`${baseClasses} bg-muted text-muted-foreground border border-border`}>
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  return (
    <main className="min-h-full p-6 md:p-8">
      <div className="max-w-6xl mx-auto w-full space-y-6 md:space-y-8">
        {/* Header */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Link
                  href="/dashboard/calls"
                  className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  ← Calls
                </Link>
                {leadGenJob && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <Link
                      href={`/dashboard/marketing/${leadGenJob._id}`}
                      className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      Campaign: {leadGenJob.campaign.targetVertical} in {leadGenJob.campaign.targetGeography}
                    </Link>
                  </>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                {opportunity ? `Call with ${opportunity.name}` : `Call #${callId.slice(-8)}`}
              </h1>
              <p className="text-muted-foreground mt-2">
                Started {new Date(call._creationTime ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-col items-start lg:items-end gap-3">
              {getStatusBadge(status)}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Duration:</span>
                <span className="text-lg font-bold text-foreground">{formatDuration(durationMs)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Call Controls */}
        {isInProgress && (
          <div className="card-warm-accent p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
                  <span className="font-semibold text-foreground">Live Call in Progress</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Credits: <span className="font-semibold text-foreground">{atlasCreditsBalance}</span> remaining
                </div>
              </div>
              <div className="flex items-center gap-3">
                {call.monitorUrls?.listenUrl && (
                  <button
                    onClick={() => setListenModalOpen(true)}
                    className="btn-contrast text-sm"
                  >
                    🎧 Listen Live
                  </button>
                )}
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">
                    {formatDuration(durationMs)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Call Summary (for completed calls) */}
        {status === "completed" && call.summary && (
          <div className="card-warm-static p-6 md:p-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Call Summary</h2>
            <div className="prose prose-sm max-w-none">
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                {call.summary}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Transcript */}
          <div className="lg:col-span-2">
            <div className="card-warm-static overflow-hidden">
              <div className="p-4 md:p-6 border-b border-border/50">
                <h2 className="text-2xl font-bold text-foreground">Live Transcript</h2>
              </div>
              <div 
                ref={transcriptRef}
                className="p-4 md:p-6 max-h-[500px] overflow-y-auto space-y-3"
              >
                {Array.isArray(call.transcript) && call.transcript.length > 0 ? (
                  call.transcript.map((fragment: TranscriptFragment, idx: number) => (
                    <div
                      key={`frag-${idx}`}
                      className={`p-4 rounded-lg border transition-colors ${
                        fragment.role === "assistant" 
                          ? "bg-surface-muted/50 border-border/40" 
                          : "bg-accent/30 border-accent-foreground/20"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-semibold text-foreground capitalize">
                          {fragment.role === "assistant" ? "AI Assistant" : "Prospect"}
                        </span>
                        {fragment.source && (
                          <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                            {fragment.source}
                          </span>
                        )}
                        {fragment.timestamp && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(fragment.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                        {fragment.text}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-surface-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      {isInProgress ? (
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="text-3xl">💬</span>
                      )}
                    </div>
                    <p className="text-muted-foreground">
                      {isInProgress ? "Waiting for conversation to begin..." : "No transcript available"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Call Info & Opportunity Details */}
          <div className="lg:col-span-1 space-y-6">
            {/* Call Details */}
            <div className="card-warm-static p-6">
              <h3 className="text-lg font-bold text-foreground mb-4">Call Details</h3>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-semibold text-muted-foreground uppercase tracking-wide text-xs mb-1">Call ID</p>
                  <p className="text-foreground font-mono">#{callId.slice(-8)}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground uppercase tracking-wide text-xs mb-1">Status</p>
                  <div className="mt-1">
                    {getStatusBadge(status)}
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground uppercase tracking-wide text-xs mb-1">Duration</p>
                  <p className="text-foreground font-semibold">
                    {formatDuration(durationMs)}
                  </p>
                </div>
                {call.billingSeconds && (
                  <div>
                    <p className="font-semibold text-muted-foreground uppercase tracking-wide text-xs mb-1">Billing Duration</p>
                    <p className="text-foreground font-semibold">
                      {call.billingSeconds} seconds
                    </p>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-muted-foreground uppercase tracking-wide text-xs mb-1">Started</p>
                  <p className="text-foreground">
                    {new Date(call._creationTime ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Opportunity Info */}
            {opportunity && (
              <div className="card-warm-static p-6">
                <h3 className="text-lg font-bold text-foreground mb-4">Opportunity Details</h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-semibold text-muted-foreground uppercase tracking-wide text-xs mb-1">Company</p>
                    <p className="text-foreground font-semibold">{opportunity.name}</p>
                  </div>
                  {opportunity.domain && (
                    <div>
                      <p className="font-semibold text-muted-foreground uppercase tracking-wide text-xs mb-1">Website</p>
                      <a 
                        href={`https://${opportunity.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 transition-colors font-medium break-all"
                      >
                        {opportunity.domain}
                      </a>
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-muted-foreground uppercase tracking-wide text-xs mb-1">Qualification Score</p>
                    <p className="text-foreground font-semibold">
                      {Math.round(opportunity.qualificationScore * 100)}%
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground uppercase tracking-wide text-xs mb-2">Status</p>
                    <OpportunityStatusBadge status={opportunity.status} />
                  </div>
                  {opportunity.signals.length > 0 && (
                    <div>
                      <p className="font-semibold text-muted-foreground uppercase tracking-wide text-xs mb-2">Signals</p>
                      <div className="flex flex-wrap gap-2">
                        {opportunity.signals.map((signal: string) => (
                          <span
                            key={signal}
                            className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-1 text-xs border border-border"
                          >
                            {signal.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {opportunity.fit_reason && (
                    <div>
                      <p className="font-semibold text-muted-foreground uppercase tracking-wide text-xs mb-2">Why This Lead Fits</p>
                      <p className="text-foreground text-xs leading-relaxed p-3 bg-surface-muted/50 rounded-lg border border-border/40">
                        {opportunity.fit_reason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Credit Usage */}
            <div className="card-warm-accent p-4">
              <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <span>💳</span>
                Credit Usage
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This call consumes <span className="font-semibold text-foreground">1 credit per minute</span>. You have <span className="font-semibold text-foreground">{atlasCreditsBalance} credits</span> remaining.
              </p>
              {atlasCreditsBalance < 5 && (
                <p className="text-xs text-destructive mt-2 font-medium">
                  ⚠️ Low credit balance. Consider upgrading your plan.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Live Listen Modal */}
        <Dialog open={listenModalOpen} onOpenChange={setListenModalOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Live Listen</DialogTitle>
              <DialogDescription>
                Connect to the live audio stream for this call. Use Connect to start and Disconnect to stop.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <LiveListen listenUrl={call.monitorUrls?.listenUrl || null} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}

type OpportunityStatusBadgeProps = {
  status: string;
};

function OpportunityStatusBadge({ status }: OpportunityStatusBadgeProps) {
  const getStatusClasses = (status: string) => {
    const upper = status?.toUpperCase();
    const baseClasses = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold";
    
    switch (upper) {
      case "READY":
        return `${baseClasses} bg-success/20 text-success border border-success/30`;
      case "BOOKED":
        return `${baseClasses} bg-primary/20 text-primary border border-primary/30`;
      case "REJECTED":
        return `${baseClasses} bg-destructive/20 text-destructive border border-destructive/30`;
      case "PENDING":
        return `${baseClasses} bg-accent/60 text-accent-foreground border border-accent-foreground/20`;
      default:
        return `${baseClasses} bg-muted text-muted-foreground border border-border`;
    }
  };

  return (
    <span className={getStatusClasses(status)}>
      {status || "Unknown"}
    </span>
  );
}
