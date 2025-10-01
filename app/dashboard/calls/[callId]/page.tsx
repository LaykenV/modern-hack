"use client";

import { useQuery } from "convex/react";
import { useState, useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCustomer } from "autumn-js/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import LiveListen from "@/components/LiveListen";
import Link from "next/link";
import { ArrowLeft, Phone, Clock, AlertCircle, ExternalLink, TrendingUp, Calendar, Headphones, CreditCard } from "lucide-react";

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
    return <CallDetailSkeleton />;
  }

  if (call === undefined) {
    return <CallDetailSkeleton />;
  }

  if (call === null) {
    return (
      <main className="min-h-full p-4 sm:p-6 md:p-8">
        <div className="max-w-4xl mx-auto w-full">
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Call Not Found</AlertTitle>
            <AlertDescription>
              The call you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
            </AlertDescription>
          </Alert>
          <Link href="/dashboard/calls">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Calls
            </Button>
          </Link>
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
    // Check if we should show a loading spinner
    // Show spinner for in-progress, ended, and recently completed (within 5 seconds of ending)
    const shouldShowSpinner = () => {
      if (status === "in-progress" || status === "ended") return true;
      if (status === "completed") {
        // Calculate when the call ended
        let callEndTime: number | undefined = undefined;
        if (startedAt && durationMs !== undefined) {
          callEndTime = startedAt + durationMs;
        }
        
        if (callEndTime) {
          const timeSinceEnded = Date.now() - callEndTime;
          // Show spinner if call ended within last 5 seconds
          return timeSinceEnded < 10 * 1000;
        }
      }
      return false;
    };

    const spinner = shouldShowSpinner() ? (
      <span className="w-2 h-2 border border-primary-foreground border-t-transparent rounded-full animate-spin" />
    ) : null;

    if (status === "in-progress") {
      return (
        <Badge className="badge-in-progress gap-2">
          {spinner}
          In Progress
        </Badge>
      );
    }
    if (status === "ended") {
      return (
        <Badge className="badge-in-progress gap-2">
          {spinner}
          Processing
        </Badge>
      );
    }
    if (status === "completed") {
      return (
        <Badge className="badge-in-progress gap-2">
          {spinner}
          Completed
        </Badge>
      );
    }
    if (status === "booked") {
      return (
        <Badge className="badge-booked gap-2">
          <span className="w-2 h-2 bg-primary-foreground rounded-full" />
          Booked
        </Badge>
      );
    }
    if (status === "ringing") {
      return (
        <Badge className="bg-accent/60 text-accent-foreground border-accent-foreground/20">
          Ringing
        </Badge>
      );
    }
    if (status === "queued") {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Queued
        </Badge>
      );
    }
    if (status === "failed") {
      return (
        <Badge variant="destructive">
          Failed
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        {status.replace(/_/g, " ")}
      </Badge>
    );
  };

  return (
    <TooltipProvider>
      <main className="min-h-full p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-4 sm:space-y-6 md:space-y-8">
          {/* Header */}
          <div className="card-warm-static p-4 sm:p-6 md:p-8">
            <div className="flex flex-col gap-6">
              {/* Top Row - Breadcrumb and Title */}
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Link href="/dashboard/calls">
                      <Button variant="ghost" size="sm" className="gap-2 -ml-2">
                        <ArrowLeft className="h-4 w-4" />
                        Calls
                      </Button>
                    </Link>
                    {leadGenJob && (
                      <>
                        <span className="text-muted-foreground hidden sm:inline">•</span>
                        <Link
                          href={`/dashboard/marketing/${leadGenJob._id}`}
                          className="text-xs sm:text-sm font-medium text-primary hover:text-primary/80 transition-colors truncate max-w-[200px] sm:max-w-none"
                        >
                          Campaign: {leadGenJob.campaign.targetVertical} in {leadGenJob.campaign.targetGeography}
                        </Link>
                      </>
                    )}
                  </div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-2">
                    {opportunity ? `Call with ${opportunity.name}` : `Call #${callId.slice(-8)}`}
                  </h1>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(call._creationTime ?? 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex flex-row lg:flex-col items-center lg:items-end gap-3">
                  {getStatusBadge(status)}
                  {status === "booked" && (
                    <Link href="/dashboard/meetings">
                      <button className="btn-primary text-sm">
                        View Booking
                      </button>
                    </Link>
                  )}
                </div>
              </div>

              <Separator />

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* Call Details */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    Call Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Duration</p>
                      <p className="text-foreground font-semibold flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {formatDuration(durationMs)}
                      </p>
                    </div>
                    {call.billingSeconds && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Billed</p>
                        <p className="text-foreground font-semibold flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          {call.billingSeconds}s
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Opportunity Details */}
                {opportunity && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Opportunity
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Company</p>
                        <p className="text-foreground font-semibold truncate">{opportunity.name}</p>
                      </div>
                      {opportunity.domain && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Website</p>
                          <a 
                            href={`https://${opportunity.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 transition-colors font-medium break-all flex items-center gap-1 text-xs"
                            aria-label={`Visit ${opportunity.domain}`}
                          >
                            {opportunity.domain}
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Signals */}
                {opportunity && opportunity.signals.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-foreground">Signals</h3>
                    <div className="flex flex-wrap gap-2">
                      {opportunity.signals.map((signal: string) => (
                        <Badge key={signal} variant="outline" className="text-xs">
                          {signal.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Credit Usage */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Credits
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Balance</p>
                      <p className="text-foreground font-semibold">{atlasCreditsBalance}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      1 credit per minute
                    </p>
                    {atlasCreditsBalance < 5 && (
                      <Badge variant="destructive" className="text-xs">Low Balance</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Fit Reason - Full Width */}
              {opportunity && opportunity.fit_reason && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Why This Lead Fits</p>
                  <p className="text-sm text-foreground leading-relaxed p-3 bg-surface-muted/50 rounded-lg border border-border/40">
                    {opportunity.fit_reason}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Live Call Controls */}
          {isInProgress && (
            <div className="card-warm-accent p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
                    <Phone className="h-4 w-4 text-foreground" />
                    <span className="font-semibold text-foreground">Live Call in Progress</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CreditCard className="h-4 w-4" />
                    <span><span className="font-semibold text-foreground">{atlasCreditsBalance}</span> credits remaining</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {call.monitorUrls?.listenUrl && (
                    <button
                      onClick={() => setListenModalOpen(true)}
                      className="btn-primary gap-2"
                    >
                      <Headphones className="h-4 w-4" />
                      <span className="hidden sm:inline">Listen Live</span>
                    </button>
                  )}
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      {formatDuration(durationMs)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Call Summary (for completed calls) */}
          {status === "completed" && call.summary && (
            <div className="card-warm-static p-4 sm:p-6 md:p-8">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-primary" />
                Call Summary
              </h2>
              <Separator className="mb-4" />
              <div className="prose prose-sm max-w-none">
                <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                  {call.summary}
                </p>
              </div>
            </div>
          )}

          {/* Transcript - Full Width */}
          <div className="card-warm-static overflow-hidden">
            <div className="p-4 md:p-6 border-b border-border/50">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">Live Transcript</h2>
            </div>
            <div 
              ref={transcriptRef}
              className="p-4 md:p-6 max-h-[400px] sm:max-h-[500px] overflow-y-auto space-y-3"
            >
              {Array.isArray(call.transcript) && call.transcript.length > 0 ? (
                call.transcript.map((fragment: TranscriptFragment, idx: number) => (
                  <div
                    key={`frag-${idx}`}
                    className={`p-3 sm:p-4 rounded-lg border transition-colors ${
                      fragment.role === "assistant" 
                        ? "bg-surface-muted/50 border-border/40" 
                        : "transcript-prospect-message"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant={fragment.role === "assistant" ? "secondary" : "default"} className="text-xs">
                        {fragment.role === "assistant" ? "AI Assistant" : "Prospect"}
                      </Badge>
                      {fragment.source && (
                        <Badge variant="outline" className="text-xs">
                          {fragment.source}
                        </Badge>
                      )}
                      {fragment.timestamp && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
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
                <div className="text-center py-12 sm:py-16">
                  <div className="w-16 h-16 bg-surface-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    {isInProgress ? (
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="text-3xl">💬</span>
                    )}
                  </div>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    {isInProgress ? "Waiting for conversation to begin..." : "No transcript available"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Live Listen Modal */}
          <Dialog open={listenModalOpen} onOpenChange={setListenModalOpen}>
            <DialogContent className="sm:max-w-xl" variant="glass">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-primary" />
                  Live Listen
                </DialogTitle>
                <DialogDescription>
                  Connect to the live audio stream for this call. Use Connect to start and Disconnect to stop.
                </DialogDescription>
              </DialogHeader>
              <Separator />
              <div className="mt-4">
                <LiveListen listenUrl={call.monitorUrls?.listenUrl || null} />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </TooltipProvider>
  );
}

// Loading skeleton component
function CallDetailSkeleton() {
  return (
    <main className="min-h-full p-4 sm:p-6 md:p-8">
      <div className="max-w-6xl mx-auto w-full space-y-4 sm:space-y-6 md:space-y-8">
        {/* Header Skeleton */}
        <div className="card-warm-static p-4 sm:p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          {/* Transcript Skeleton */}
          <div className="lg:col-span-2">
            <div className="card-warm-static overflow-hidden">
              <div className="p-4 md:p-6 border-b border-border/50">
                <Skeleton className="h-8 w-40" />
              </div>
              <div className="p-4 md:p-6 space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Skeleton */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            <div className="card-warm-static p-4 sm:p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                ))}
              </div>
            </div>
            <div className="card-warm-static p-4 sm:p-6">
              <Skeleton className="h-6 w-40 mb-4" />
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
