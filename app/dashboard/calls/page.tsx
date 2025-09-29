"use client";

import { useQuery } from "convex/react";
import { useState, useMemo } from "react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { Phone, Clock, Calendar, CheckCircle, XCircle, PhoneOff, ExternalLink } from "lucide-react";

// Shadcn components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useIsMobile } from "@/hooks/use-mobile";

export default function CallsPage() {
  const isMobile = useIsMobile();
  const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);
  const [selectedCallId, setSelectedCallId] = useState<Id<"calls"> | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  // Handle call selection - open sheet on mobile
  const handleCallSelect = (callId: Id<"calls">) => {
    setSelectedCallId(callId);
    if (isMobile) {
      setSheetOpen(true);
    }
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
                      <CheckCircle className="h-4 w-4 text-accent-foreground" aria-hidden="true" />
                      <p className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Completed
                      </p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{callStats.completed}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2">Successfully finished</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Calls that completed successfully</p>
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
                        Failed
                      </p>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{callStats.failed}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2">No answer or busy</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Calls that failed to connect</p>
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Calls List */}
          <div className="lg:col-span-2">
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
          </div>

          {/* Call Details Panel - Desktop Sidebar */}
          <div className="hidden lg:block lg:col-span-1">
            <CallDetailsPanel 
              selectedCall={selectedCall} 
              formatDuration={formatDuration}
            />
          </div>
        </div>

        {/* Call Details Panel - Mobile Sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
            <SheetHeader className="mb-6">
              <SheetTitle>Call Details</SheetTitle>
            </SheetHeader>
            <CallDetailsPanel 
              selectedCall={selectedCall} 
              formatDuration={formatDuration}
              isMobile
            />
          </SheetContent>
        </Sheet>
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
      className={`p-4 hover:bg-accent/30 cursor-pointer transition-colors touch-target ${
        isSelected ? "bg-primary/10 border-l-4 border-l-primary" : ""
      }`}
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

// Call Details Panel Component
type CallDetailsPanelProps = {
  selectedCall: Doc<"calls"> | null | undefined;
  formatDuration: (ms: number | undefined) => string;
  isMobile?: boolean;
};

function CallDetailsPanel({ selectedCall, formatDuration, isMobile = false }: CallDetailsPanelProps) {
  if (!selectedCall) {
    return (
      <div className={`${!isMobile && "card-warm-static p-6"}`}>
        <EmptyState
          icon={<span className="text-4xl">👆</span>}
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
    <div className={`${!isMobile && "card-warm-static p-6"}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Call Details</h3>
          <CallStatusBadge status={status} />
        </div>

        <Separator />

        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Call ID</p>
            <p className="text-foreground font-medium font-mono">#{selectedCall._id.slice(-8)}</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Duration</p>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-foreground font-medium">
                {formatDuration(selectedCall.billingSeconds ? selectedCall.billingSeconds * 1000 : selectedCall.duration)}
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Started</p>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-foreground font-medium">
                {new Date(selectedCall._creationTime).toLocaleString()}
              </p>
            </div>
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
    </div>
  );
}

// Call Status Badge Component
type CallStatusBadgeProps = {
  status?: string;
};

function CallStatusBadge({ status }: CallStatusBadgeProps) {
  const getStatusVariant = (status?: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status?.toLowerCase()) {
      case "in-progress":
      case "ringing":
        return "default";
      case "completed":
        return "secondary";
      case "failed":
      case "no-answer":
      case "busy":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusClassName = (status?: string): string => {
    switch (status?.toLowerCase()) {
      case "in-progress":
        return "bg-primary/20 text-primary border-primary/30 animate-pulse";
      case "completed":
        return "bg-accent/60 text-accent-foreground border-accent-foreground/20";
      case "ringing":
        return "bg-primary/30 text-primary border-primary/40";
      case "failed":
      case "no-answer":
      case "busy":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "";
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={getStatusVariant(status)} 
            className={`${getStatusClassName(status)} cursor-help`}
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
