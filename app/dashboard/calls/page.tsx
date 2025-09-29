"use client";

import { useQuery } from "convex/react";
import { useState, useMemo } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";

export default function CallsPage() {
  const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);
  const [selectedCallId, setSelectedCallId] = useState<Id<"calls"> | null>(null);

  // Query for calls
  const calls = useQuery(
    api.call.calls.getCallsByAgency,
    agencyProfile?.agencyProfileId ? { agencyId: agencyProfile.agencyProfileId } : "skip"
  );

  const meetings = useQuery(
    api.call.meetings.listByAgency,
    agencyProfile?.agencyProfileId ? { agencyId: agencyProfile.agencyProfileId } : "skip"
  );

  // Get detailed call data for selected call
  const selectedCall = useQuery(
    api.call.calls.getCallById,
    selectedCallId ? { callId: selectedCallId } : "skip"
  );


  // Sort calls by creation time, most recent first (non-mutating)
  const sortedCalls = useMemo(() => {
    if (!calls) return [];
    return [...calls].sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0));
  }, [calls]);

  // Group calls by status for stats
  const callStats = useMemo(() => {
    if (!calls) return { total: 0, inProgress: 0, completed: 0, failed: 0 };
    
    return {
      total: calls.length,
      inProgress: calls.filter(call => 
        (call.currentStatus || call.status) === "in-progress"
      ).length,
      completed: calls.filter(call => 
        (call.currentStatus || call.status) === "completed"
      ).length,
      failed: calls.filter(call => 
        ["failed", "no-answer", "busy"].includes(call.currentStatus || call.status || "")
      ).length,
    };
  }, [calls]);

  const formatDuration = (ms: number | undefined): string => {
    if (!ms || ms < 0) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <main className="min-h-full p-6 md:p-8 flex flex-col gap-6">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        {/* Hero Section with Stats */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold text-foreground tracking-tight">
                Calls
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Monitor and review your call activity
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Total Calls</p>
              <p className="text-3xl font-bold text-foreground mt-1">{callStats.total}</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            <div className="stat-card-primary p-5">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Live Calls
              </p>
              <p className="text-3xl font-bold text-foreground mt-1">{callStats.inProgress}</p>
              <div className="flex items-center gap-2 mt-2">
                {callStats.inProgress > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-primary font-semibold">
                    <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    Active
                  </span>
                )}
              </div>
            </div>
            
            <div className="stat-card-accent p-5">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Completed
              </p>
              <p className="text-3xl font-bold text-foreground mt-1">{callStats.completed}</p>
              <p className="text-sm text-muted-foreground mt-2">Successfully finished</p>
            </div>
            
            <div className="stat-card-accent p-5">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Failed
              </p>
              <p className="text-3xl font-bold text-foreground mt-1">{callStats.failed}</p>
              <p className="text-sm text-muted-foreground mt-2">No answer or busy</p>
            </div>
            
            <div className="stat-card-accent p-5">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Meetings Booked
              </p>
              <p className="text-3xl font-bold text-foreground mt-1">{meetings?.length ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-2">Scheduled follow-ups</p>
            </div>
          </div>
        </div>

        {/* Live Calls Banner */}
        {callStats.inProgress > 0 && (
          <div className="card-warm-accent p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground flex items-center gap-2">
                  <span className="w-3 h-3 bg-primary rounded-full animate-pulse" />
                  {callStats.inProgress} Live Call{callStats.inProgress > 1 ? 's' : ''} in Progress
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click on any in-progress call to access the live workspace
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Calls List */}
          <div className="lg:col-span-2">
            <div className="card-warm-static">
              <div className="px-6 py-4 border-b border-border/40">
                <h2 className="text-2xl font-bold text-foreground">Recent Calls</h2>
              </div>

              <div className="divide-y divide-border/40 max-h-[600px] overflow-y-auto">
                {sortedCalls.length > 0 ? (
                  sortedCalls.map((call) => (
                    <div
                      key={call._id}
                      className={`p-4 hover:bg-accent/30 cursor-pointer transition-colors ${
                        selectedCallId === call._id ? "bg-primary/10 border-l-4 border-l-primary" : ""
                      }`}
                      onClick={() => setSelectedCallId(call._id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <p className="font-semibold text-foreground">Call #{call._id.slice(-8)}</p>
                            <CallStatusBadge status={call.currentStatus || call.status} />
                            {(call.currentStatus || call.status) === "in-progress" && (
                              <Link
                                href={`/dashboard/calls/${call._id}`}
                                className="text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-full hover:bg-primary/90 transition-colors font-semibold"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Live →
                              </Link>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                            <span className="font-medium">
                              Duration: {formatDuration(call.billingSeconds ? call.billingSeconds * 1000 : call.duration)}
                            </span>
                            <span className="hidden sm:inline text-border">•</span>
                            <span>
                              {new Date(call._creationTime ?? 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 md:p-12 text-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-accent/40">
                      <span className="text-3xl">📞</span>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No calls found</h3>
                    <p className="text-muted-foreground">
                      No calls have been made yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Call Details Panel */}
          <div className="lg:col-span-1">
            <div className="card-warm-static p-6">
              {selectedCall ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">Call Details</h3>
                    <CallStatusBadge status={selectedCall.currentStatus || selectedCall.status} />
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Call ID</p>
                      <p className="text-foreground font-medium">#{selectedCall._id.slice(-8)}</p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Duration</p>
                      <p className="text-foreground font-medium">
                        {formatDuration(selectedCall.billingSeconds ? selectedCall.billingSeconds * 1000 : selectedCall.duration)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Started</p>
                      <p className="text-foreground font-medium">
                        {new Date(selectedCall._creationTime).toLocaleString()}
                      </p>
                    </div>

                    {selectedCall.summary && (
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Summary</p>
                        <div className="p-4 bg-surface-muted/50 border border-border/40 rounded-lg">
                          <p className="text-foreground text-sm whitespace-pre-wrap leading-relaxed">
                            {selectedCall.summary}
                          </p>
                        </div>
                      </div>
                    )}

                    {(selectedCall.currentStatus || selectedCall.status) === "in-progress" && (
                      <div className="pt-4 border-t border-border/40">
                        <Link
                          href={`/dashboard/calls/${selectedCall._id}`}
                          className="btn-contrast w-full justify-center"
                        >
                          Open Live Workspace →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 bg-accent/40">
                    <span className="text-2xl">👆</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Select a call to view details
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

type CallStatusBadgeProps = {
  status?: string;
};

function CallStatusBadge({ status }: CallStatusBadgeProps) {
  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "in-progress":
        return "bg-primary/20 text-primary border border-primary/30 animate-pulse font-semibold";
      case "completed":
        return "bg-accent/60 text-accent-foreground border border-accent-foreground/20 font-semibold";
      case "ringing":
        return "bg-primary/30 text-primary border border-primary/40 font-semibold";
      case "queued":
        return "bg-muted text-muted-foreground border border-border font-medium";
      case "failed":
      case "no-answer":
      case "busy":
        return "bg-destructive/20 text-destructive border border-destructive/30 font-semibold";
      default:
        return "bg-muted text-muted-foreground border border-border font-medium";
    }
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${getStatusColor(status)}`}>
      {status?.replace(/_/g, " ") || "Unknown"}
    </span>
  );
}
