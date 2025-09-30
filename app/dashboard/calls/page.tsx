"use client";

import { useQuery } from "convex/react";
import { useState, useMemo } from "react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { Phone, Clock, Calendar, XCircle, PhoneOff, ExternalLink } from "lucide-react";

// Shadcn components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
//import { useIsMobile } from "@/hooks/use-mobile";

export default function CallsPage() {
  //const isMobile = useIsMobile();
  const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);
  const [selectedCallId, setSelectedCallId] = useState<Id<"calls"> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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
    if (!calls) return { total: 0, inProgress: 0, booked: 0, rejected: 0 };
    
    return {
      total: calls.length,
      inProgress: calls.filter(call => 
        (call.currentStatus || call.status) === "in-progress"
      ).length,
      booked: calls.filter(call => 
        (call.currentStatus || call.status) === "booked"
      ).length,
      rejected: calls.filter(call => 
        (call.currentStatus || call.status) === "rejected"
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

  // Handle call selection - open dialog
  const handleCallSelect = (callId: Id<"calls">) => {
    setSelectedCallId(callId);
    setDialogOpen(true);
  };

  // Loading state
  const isLoading = agencyProfile === undefined || calls === undefined || meetings === undefined;

  if (isLoading) {
    return <CallsPageSkeleton />;
  }

  return (
    <main className="min-h-full p-4 sm:p-6 md:p-8 flex flex-col gap-6">
      <div className="max-w-6xl mx-auto w-full space-y-6 md:space-y-8">
        {/* Hero Section with Stats */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                Calls
              </h1>
              <p className="text-muted-foreground mt-2 text-base sm:text-lg">
                Monitor and review your call activity
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Total Calls</p>
              <p className="text-3xl font-bold text-foreground mt-1">{callStats.total}</p>
            </div>
          </div>

          <Separator className="mb-6 md:mb-8" />

          {/* Stats Cards - Grid on all sizes */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="stat-card-primary p-4 sm:p-5 cursor-help">
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
                      <p className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Live Calls
                      </p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{callStats.inProgress}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {callStats.inProgress > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-primary font-semibold">
                          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" aria-label="Active indicator" />
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Calls currently in progress</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="stat-card-accent p-4 sm:p-5 cursor-help">
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="h-4 w-4 text-accent-foreground" aria-hidden="true" />
                      <p className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Total Calls
                      </p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{callStats.total}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2">All time</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total number of calls made</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="stat-card-accent p-4 sm:p-5 cursor-help">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
                      <p className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Rejected
                      </p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{callStats.rejected}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2">Not interested</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Calls that were rejected</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="stat-card-accent p-4 sm:p-5 cursor-help">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-accent-foreground" aria-hidden="true" />
                      <p className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Meetings
                      </p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{meetings?.length ?? 0}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2">Scheduled follow-ups</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Meetings booked from calls</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Live Calls Alert Banner */}
        {callStats.inProgress > 0 && (
          <Alert className="border-primary/40 bg-primary/5">
            <Phone className="h-4 w-4 text-primary animate-pulse" />
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">
                  {callStats.inProgress} Live Call{callStats.inProgress > 1 ? 's' : ''} in Progress
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click on any in-progress call to access the live workspace
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content - Full Width */}
        <div className="card-warm-static">
          <div className="px-4 sm:px-6 py-4 border-b border-border/40">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Recent Calls</h2>
          </div>

          <div className="divide-y divide-border/40 max-h-[600px] overflow-y-auto">
            {sortedCalls.length > 0 ? (
              sortedCalls.map((call) => (
                <CallListItem
                  key={call._id}
                  call={call}
                  isSelected={selectedCallId === call._id}
                  onClick={() => handleCallSelect(call._id)}
                  formatDuration={formatDuration}
                />
              ))
            ) : (
              <EmptyState
                icon={<PhoneOff className="h-12 w-12 text-muted-foreground" />}
                title="No calls found"
                description="No calls have been made yet. Calls will appear here once they start."
              />
            )}
          </div>
        </div>

        {/* Call Details Modal */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="call-details-modal max-w-2xl max-h-[85vh] overflow-y-auto p-6">
            <DialogHeader className="pb-4">
              <DialogTitle>Call Details</DialogTitle>
            </DialogHeader>
            <CallDetailsModal 
              selectedCall={selectedCall} 
              formatDuration={formatDuration}
            />
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}

// Call List Item Component
type CallListItemProps = {
  call: Doc<"calls">;
  isSelected: boolean;
  onClick: () => void;
  formatDuration: (ms: number | undefined) => string;
};

function CallListItem({ call, isSelected, onClick, formatDuration }: CallListItemProps) {
  const status = call.currentStatus || call.status;
  const isInProgress = status === "in-progress";

  return (
    <div
      className={`p-4 hover:bg-accent/30 cursor-pointer transition-colors touch-target border-l-4 ${
        isSelected ? "bg-primary/10" : ""
      }`}
      style={{
        borderLeftColor: isSelected ? "hsl(var(--primary))" : "transparent"
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Call ${call._id.slice(-8)}, status ${status}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <p className="font-semibold text-foreground">Call #{call._id.slice(-8)}</p>
            <CallStatusBadge status={status} />
            {isInProgress && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      size="sm"
                      variant="default"
                      className="h-6 px-2.5 text-xs font-semibold"
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      <Link href={`/dashboard/calls/${call._id}`}>
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Live
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open live workspace</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
            <span className="font-medium inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {formatDuration(call.billingSeconds ? call.billingSeconds * 1000 : call.duration)}
            </span>
            <span className="hidden sm:inline text-border" aria-hidden="true">•</span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              {new Date(call._creationTime ?? 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Call Details Modal Component
type CallDetailsModalProps = {
  selectedCall: Doc<"calls"> | null | undefined;
  formatDuration: (ms: number | undefined) => string;
};

function CallDetailsModal({ selectedCall, formatDuration }: CallDetailsModalProps) {
  if (!selectedCall) {
    return (
      <div className="py-8">
        <EmptyState
          icon={<span className="text-4xl">🔍</span>}
          title="No call selected"
          description="Select a call from the list to view its details"
          compact
        />
      </div>
    );
  }

  const status = selectedCall.currentStatus || selectedCall.status;
  const isInProgress = status === "in-progress";

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-start justify-between gap-4">
        <CallStatusBadge status={status} />
      </div>

      {/* Call Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-surface-muted/30 border border-border/40 rounded-lg">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Call ID</p>
          <p className="text-foreground font-medium font-mono text-sm">#{selectedCall._id.slice(-8)}</p>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Duration</p>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <p className="text-foreground font-medium text-sm">
              {formatDuration(selectedCall.billingSeconds ? selectedCall.billingSeconds * 1000 : selectedCall.duration)}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Started</p>
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <p className="text-foreground font-medium text-sm">
              {new Date(selectedCall._creationTime).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 pb-4">
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

        {/* Transcript Accordion */}
        {selectedCall.transcript && selectedCall.transcript.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="transcript" className="border border-border/40 rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <span className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Transcript ({selectedCall.transcript.length} messages)
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2 pb-4">
                  <div className="space-y-3 p-4 bg-surface-muted/30 border border-border/30 rounded-lg max-h-[400px] overflow-y-auto">
                    {selectedCall.transcript.map((message, index) => (
                      <div 
                        key={index} 
                        className="p-3 rounded-md border-l-2"
                        style={{
                          backgroundColor: message.role === "assistant" 
                            ? "hsl(var(--accent) / 0.2)" 
                            : "hsl(var(--primary) / 0.1)",
                          borderLeftColor: message.role === "assistant"
                            ? "hsl(var(--accent-foreground) / 0.4)"
                            : "hsl(var(--primary))"
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span 
                            className="text-xs font-semibold uppercase tracking-wide"
                            style={{
                              color: message.role === "assistant" 
                                ? "hsl(var(--muted-foreground))" 
                                : "hsl(var(--primary))"
                            }}
                          >
                            {message.role === "assistant" ? "AI" : "Prospect"}
                          </span>
                          {message.timestamp && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {message.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {isInProgress && (
          <>
            <Separator />
            <Button asChild className="w-full" size="lg">
              <Link href={`/dashboard/calls/${selectedCall._id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Live Workspace
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// Call Status Badge Component
type CallStatusBadgeProps = {
  status?: string;
};

function CallStatusBadge({ status }: CallStatusBadgeProps) {
  const getStatusStyles = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "in-progress":
        return {
          backgroundColor: "hsl(var(--primary) / 0.2)",
          color: "hsl(var(--primary))",
          borderColor: "hsl(var(--primary) / 0.3)",
          className: "animate-pulse"
        };
      case "booked":
        return {
          backgroundColor: "hsl(var(--success) / 0.2)",
          color: "hsl(var(--success))",
          borderColor: "hsl(var(--success) / 0.3)",
          className: ""
        };
      case "ringing":
        return {
          backgroundColor: "hsl(var(--primary) / 0.3)",
          color: "hsl(var(--primary))",
          borderColor: "hsl(var(--primary) / 0.4)",
          className: ""
        };
      case "rejected":
        return {
          backgroundColor: "hsl(var(--destructive) / 0.2)",
          color: "hsl(var(--destructive))",
          borderColor: "hsl(var(--destructive) / 0.3)",
          className: ""
        };
      default:
        return {
          backgroundColor: "hsl(var(--muted) / 0.2)",
          color: "hsl(var(--muted-foreground))",
          borderColor: "hsl(var(--border) / 0.3)",
          className: ""
        };
    }
  };

  const styles = getStatusStyles(status);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline"
            className={`cursor-help border ${styles.className}`}
            style={{
              backgroundColor: styles.backgroundColor,
              color: styles.color,
              borderColor: styles.borderColor
            }}
          >
            {status?.replace(/_/g, " ") || "Unknown"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Call status: {status?.replace(/_/g, " ") || "Unknown"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Empty State Component
type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
};

function EmptyState({ icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div className={`text-center ${compact ? 'py-8' : 'py-12 px-4'}`}>
      <div className={`${compact ? 'w-14 h-14' : 'w-16 h-16'} rounded-full flex items-center justify-center mx-auto mb-4 bg-accent/40`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">{description}</p>
      {action}
    </div>
  );
}

// Loading Skeleton Component
function CallsPageSkeleton() {
  return (
    <main className="min-h-full p-4 sm:p-6 md:p-8 flex flex-col gap-6">
      <div className="max-w-6xl mx-auto w-full space-y-6 md:space-y-8">
        {/* Hero Section Skeleton */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
            <div className="space-y-3">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-6 w-64" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>

          <Separator className="mb-6 md:mb-8" />

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="stat-card-accent p-4 sm:p-5">
                <Skeleton className="h-4 w-20 mb-3" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <div className="lg:col-span-2">
            <div className="card-warm-static">
              <div className="px-4 sm:px-6 py-4 border-b border-border/40">
                <Skeleton className="h-7 w-40" />
              </div>
              <div className="divide-y divide-border/40">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-5 w-20" />
                        </div>
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden lg:block lg:col-span-1">
            <div className="card-warm-static p-6">
              <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
              <Skeleton className="h-5 w-32 mx-auto mb-2" />
              <Skeleton className="h-4 w-48 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
