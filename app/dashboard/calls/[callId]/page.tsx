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
      <div className="max-w-4xl mx-auto w-full">
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-12 text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading call...</p>
        </div>
      </div>
    );
  }

  if (!call) {
    return (
      <div className="max-w-4xl mx-auto w-full">
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-12 text-center">
          <h1 className="text-2xl font-bold mb-2">Call Not Found</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            The call you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Link
            href="/dashboard/calls"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            ← Back to Calls
          </Link>
        </div>
      </div>
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

  const statusColor = 
    status === "in-progress" ? "bg-green-100 text-green-700" :
    status === "ringing" ? "bg-yellow-100 text-yellow-700" :
    status === "queued" ? "bg-slate-100 text-slate-700" :
    status === "completed" ? "bg-blue-100 text-blue-700" :
    status === "failed" ? "bg-red-100 text-red-700" :
    "bg-slate-100 text-slate-700";

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/dashboard/calls"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Calls
            </Link>
            {leadGenJob && (
              <>
                <span className="text-slate-400">•</span>
                <Link
                  href={`/dashboard/marketing/${leadGenJob._id}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Campaign: {leadGenJob.campaign.targetVertical} in {leadGenJob.campaign.targetGeography}
                </Link>
              </>
            )}
          </div>
          <h1 className="text-3xl font-bold">
            {opportunity ? `Call with ${opportunity.name}` : `Call #${callId.slice(-8)}`}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Started {new Date(call._creationTime ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="text-right">
          <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusColor} mb-2`}>
            {isInProgress && <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />}
            {status.replace(/_/g, " ")}
          </div>
          <p className="text-sm text-slate-500">
            Duration: {formatDuration(durationMs)}
          </p>
        </div>
      </div>

      {/* Live Call Controls */}
      {isInProgress && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="font-medium text-green-800 dark:text-green-200">Live Call in Progress</span>
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">
                Credits: {atlasCreditsBalance} remaining
              </div>
            </div>
            <div className="flex items-center gap-3">
              {call.monitorUrls?.listenUrl && (
                <button
                  onClick={() => setListenModalOpen(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm"
                >
                  🎧 Listen Live
                </button>
              )}
              <div className="text-right">
                <p className="text-lg font-bold text-green-800 dark:text-green-200">
                  {formatDuration(durationMs)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Call Summary (for completed calls) */}
      {status === "completed" && call.summary && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-3">Call Summary</h2>
          <div className="prose prose-sm max-w-none">
            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {call.summary}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transcript */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-semibold">Live Transcript</h2>
            </div>
            <div 
              ref={transcriptRef}
              className="p-4 max-h-96 overflow-y-auto space-y-3"
            >
              {Array.isArray(call.transcript) && call.transcript.length > 0 ? (
                call.transcript.map((fragment: TranscriptFragment, idx: number) => (
                  <div
                    key={`frag-${idx}`}
                    className={`p-3 rounded-lg ${
                      fragment.role === "assistant" 
                        ? "bg-slate-100 dark:bg-slate-800" 
                        : "bg-blue-50 dark:bg-blue-900/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium capitalize">
                        {fragment.role === "assistant" ? "AI Assistant" : "Prospect"}
                      </span>
                      {fragment.source && (
                        <span className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700">
                          {fragment.source}
                        </span>
                      )}
                      {fragment.timestamp && (
                        <span className="text-xs text-slate-500">
                          {new Date(fragment.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm">
                      {fragment.text}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    {isInProgress ? (
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="text-2xl">💬</span>
                    )}
                  </div>
                  <p className="text-slate-500">
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Call Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">Call ID</p>
                <p className="text-slate-600 dark:text-slate-400">#{callId.slice(-8)}</p>
              </div>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">Status</p>
                <div className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${statusColor}`}>
                  {status.replace(/_/g, " ")}
                </div>
              </div>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">Duration</p>
                <p className="text-slate-600 dark:text-slate-400">
                  {formatDuration(durationMs)}
                </p>
              </div>
              {call.billingSeconds && (
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-300">Billing Duration</p>
                  <p className="text-slate-600 dark:text-slate-400">
                    {call.billingSeconds} seconds
                  </p>
                </div>
              )}
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">Started</p>
                <p className="text-slate-600 dark:text-slate-400">
                  {new Date(call._creationTime ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Opportunity Info */}
          {opportunity && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Opportunity Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-300">Company</p>
                  <p className="text-slate-600 dark:text-slate-400">{opportunity.name}</p>
                </div>
                {opportunity.domain && (
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">Website</p>
                    <a 
                      href={`https://${opportunity.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {opportunity.domain}
                    </a>
                  </div>
                )}
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-300">Qualification Score</p>
                  <p className="text-slate-600 dark:text-slate-400">
                    {Math.round(opportunity.qualificationScore * 100)}%
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-300">Status</p>
                  <OpportunityStatusBadge status={opportunity.status} />
                </div>
                {opportunity.signals.length > 0 && (
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300 mb-2">Signals</p>
                    <div className="flex flex-wrap gap-1">
                      {opportunity.signals.map((signal: string) => (
                        <span
                          key={signal}
                          className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-1 text-xs"
                        >
                          {signal.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {opportunity.fit_reason && (
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">Why This Lead Fits</p>
                    <p className="text-slate-600 dark:text-slate-300 text-xs mt-1 p-2 bg-slate-50 dark:bg-slate-800 rounded">
                      {opportunity.fit_reason}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Credit Usage */}
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-2">
              Credit Usage
            </h4>
            <p className="text-sm text-orange-700 dark:text-orange-300">
              This call consumes 1 credit per minute. You have {atlasCreditsBalance} credits remaining.
            </p>
            {atlasCreditsBalance < 5 && (
              <p className="text-xs text-orange-600 mt-2">
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
  );
}

type OpportunityStatusBadgeProps = {
  status: string;
};

function OpportunityStatusBadge({ status }: OpportunityStatusBadgeProps) {
  const getStatusColor = (status: string) => {
    const upper = status?.toUpperCase();
    switch (upper) {
      case "READY":
        return "bg-emerald-100 text-emerald-700";
      case "BOOKED":
        return "bg-green-100 text-green-700";
      case "REJECTED":
        return "bg-red-100 text-red-700";
      case "PENDING":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${getStatusColor(status)}`}>
      {status || "Unknown"}
    </span>
  );
}
