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
    <div className="max-w-6xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calls</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Monitor and review your call activity
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">Total Calls</p>
          <p className="text-2xl font-bold">{callStats.total}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Live Calls</p>
          <p className="text-2xl font-bold text-green-600">{callStats.inProgress}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Completed</p>
          <p className="text-2xl font-bold text-blue-600">{callStats.completed}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Failed</p>
          <p className="text-2xl font-bold text-red-600">{callStats.failed}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Meetings Booked</p>
          <p className="text-2xl font-bold text-purple-600">{meetings?.length ?? 0}</p>
        </div>
      </div>

      {/* Live Calls Banner */}
      {callStats.inProgress > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">
                🔴 {callStats.inProgress} Live Call{callStats.inProgress > 1 ? 's' : ''} in Progress
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Click on any in-progress call to access the live workspace
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calls List */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-semibold">Recent Calls</h2>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-96 overflow-y-auto">
              {sortedCalls.length > 0 ? (
                sortedCalls.map((call) => (
                  <div
                    key={call._id}
                    className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors ${
                      selectedCallId === call._id ? "bg-blue-50 dark:bg-blue-900/20" : ""
                    }`}
                    onClick={() => setSelectedCallId(call._id)}
                  >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-medium">Call #{call._id.slice(-8)}</p>
                        <CallStatusBadge status={call.currentStatus || call.status} />
                        {(call.currentStatus || call.status) === "in-progress" && (
                          <Link
                            href={`/dashboard/calls/${call._id}`}
                            className="text-xs bg-green-600 text-white px-2 py-1 rounded-full hover:bg-green-700"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Live →
                          </Link>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <span>
                          Duration: {formatDuration(call.billingSeconds ? call.billingSeconds * 1000 : call.duration)}
                        </span>
                        <span>
                          {new Date(call._creationTime ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📞</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No calls found</h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    No calls have been made yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Call Details Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
            {selectedCall ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Call Details</h3>
                  <CallStatusBadge status={selectedCall.currentStatus || selectedCall.status} />
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">Call ID</p>
                    <p className="text-slate-600 dark:text-slate-400">#{selectedCall._id.slice(-8)}</p>
                  </div>

                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">Duration</p>
                    <p className="text-slate-600 dark:text-slate-400">
                      {formatDuration(selectedCall.billingSeconds ? selectedCall.billingSeconds * 1000 : selectedCall.duration)}
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">Started</p>
                    <p className="text-slate-600 dark:text-slate-400">
                      {new Date(selectedCall._creationTime).toLocaleString()}
                    </p>
                  </div>

                  {selectedCall.summary && (
                    <div>
                      <p className="font-medium text-slate-700 dark:text-slate-300">Summary</p>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-md mt-1">
                        <p className="text-slate-600 dark:text-slate-300 text-sm whitespace-pre-wrap">
                          {selectedCall.summary}
                        </p>
                      </div>
                    </div>
                  )}

                  {(selectedCall.currentStatus || selectedCall.status) === "in-progress" && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                      <Link
                        href={`/dashboard/calls/${selectedCall._id}`}
                        className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-center block"
                      >
                        Open Live Workspace
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">👆</span>
                </div>
                <p className="text-slate-500 text-sm">
                  Select a call to view details
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type CallStatusBadgeProps = {
  status?: string;
};

function CallStatusBadge({ status }: CallStatusBadgeProps) {
  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "in-progress":
        return "bg-green-100 text-green-700 animate-pulse";
      case "completed":
        return "bg-blue-100 text-blue-700";
      case "ringing":
        return "bg-yellow-100 text-yellow-700";
      case "queued":
        return "bg-slate-100 text-slate-700";
      case "failed":
      case "no-answer":
      case "busy":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${getStatusColor(status)}`}>
      {status?.replace(/_/g, " ") || "Unknown"}
    </span>
  );
}
