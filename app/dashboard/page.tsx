"use client";

import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import Image from "next/image";
import Link from "next/link";
import { useCustomer } from "autumn-js/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Target, Phone, Calendar, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Type for call objects
type CallRecord = Doc<"calls">;

export default function DashboardPage() {
  return (
    <main className="min-h-full p-6 md:p-8 flex flex-col gap-6">
      <Unauthenticated>
        <RedirectToHome />
      </Unauthenticated>
      <Authenticated>
        <DashboardContent />
      </Authenticated>
    </main>
  );
}

function RedirectToHome() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}

function DashboardContent() {
  const user = useQuery(api.auth.getCurrentUser);
  const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);
  const router = useRouter();
  const { customer } = useCustomer();
  const onboardingStatus = useQuery(api.onboarding.queries.getOnboardingStatus, { onboardingFlowId: agencyProfile?.onboardingFlowId });
  
  // Query for recent data to show in overview
  const recentLeadGenJobs = useQuery(
    api.marketing.listLeadGenJobsByAgency,
    agencyProfile?.agencyProfileId ? { agencyId: agencyProfile.agencyProfileId } : "skip"
  );

  const recentCalls = useQuery(
    api.call.calls.getCallsByAgency,
    agencyProfile?.agencyProfileId ? { agencyId: agencyProfile.agencyProfileId } : "skip"
  );

  // Meetings API not available yet, using placeholder
  const upcomingMeetings = [];

  // Show loading state while data is being fetched
  const isLoading = user === undefined || agencyProfile === undefined || onboardingStatus === undefined;

  useEffect(() => {
    // Wait for all data to load before making redirect decisions
    if (!user || agencyProfile === undefined || onboardingStatus === undefined) {
      return; // Still loading
    }
    
    // If no agency profile or onboarding not completed, redirect to onboarding
    if (!agencyProfile || onboardingStatus !== "completed") {
      router.replace("/dashboard/onboarding");
    }
  }, [user, agencyProfile, router, onboardingStatus]);

  const atlasCreditsBalance = customer?.features?.atlas_credits?.balance ?? 0;
  
  // Calculate quick stats
  const completedCampaigns = recentLeadGenJobs?.filter(job => job.status === "completed")?.length ?? 0;
  const readyOpportunities = recentLeadGenJobs?.reduce((sum, job) => {
    // This would need to be calculated based on opportunities with "READY" status
    return sum + (job.numLeadsFetched || 0);
  }, 0) ?? 0;
  const completedCalls = recentCalls?.filter((call: CallRecord) => call.currentStatus === "completed" || call.status === "completed")?.length ?? 0;
  const upcomingMeetingsCount = upcomingMeetings?.length ?? 0;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="max-w-6xl mx-auto w-full space-y-8">
      {/* Hero Section with Stats */}
      <div className="card-warm-static p-6 md:p-8">
        <div className="flex items-center gap-6 mb-8">
          {user?.image && (
            <Image
              src={user.image}
              alt="User Image"
              width={72}
              height={72}
              className="rounded-full border-2 border-primary/30 shadow-lg"
              priority
            />
          )}
          <div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              Dashboard Overview
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Welcome back, {user?.name || user?.email}
            </p>
          </div>
        </div>

        {/* Quick Stats Grid - Integrated */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          <StatCard
            title="Atlas Credits"
            value={atlasCreditsBalance}
            subtitle="Available balance"
            variant="primary"
          />
          <StatCard
            title="Completed Campaigns"
            value={completedCampaigns}
            subtitle="Finished lead gen"
            variant="accent"
          />
          <StatCard
            title="Ready Opportunities"
            value={readyOpportunities}
            subtitle="Leads fetched"
            variant="accent"
          />
          <StatCard
            title="Completed Calls"
            value={completedCalls}
            subtitle="Finished calls"
            variant="accent"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card-warm-static p-6 md:p-8">
        <h2 className="text-2xl font-bold text-foreground mb-6">Quick Actions</h2>
        <TooltipProvider>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/dashboard/marketing" className="action-link">
                  <div className="action-link-icon">
                    <Target className="h-6 w-6 sm:h-8 sm:w-8" />
                  </div>
                  <span className="text-sm sm:text-base font-semibold text-foreground text-center">Start Lead Generation</span>
                  <span className="text-xs sm:text-sm text-muted-foreground text-center mt-1 sm:mt-2">
                    Launch new campaigns
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>Create and launch new lead generation campaigns</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/dashboard/calls" className="action-link">
                  <div className="action-link-icon">
                    <Phone className="h-6 w-6 sm:h-8 sm:w-8" />
                  </div>
                  <span className="text-sm sm:text-base font-semibold text-foreground text-center">View Calls</span>
                  <span className="text-xs sm:text-sm text-muted-foreground text-center mt-1 sm:mt-2">
                    Monitor call activity
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>Monitor and manage your call activity</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/dashboard/meetings" className="action-link">
                  <div className="action-link-icon">
                    <Calendar className="h-6 w-6 sm:h-8 sm:w-8" />
                  </div>
                  <span className="text-sm sm:text-base font-semibold text-foreground text-center">Upcoming Meetings</span>
                  <span className="text-xs sm:text-sm text-muted-foreground text-center mt-1 sm:mt-2">
                    {upcomingMeetingsCount} scheduled
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>View and manage your scheduled meetings</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/dashboard/agency" className="action-link">
                  <div className="action-link-icon">
                    <Building2 className="h-6 w-6 sm:h-8 sm:w-8" />
                  </div>
                  <span className="text-sm sm:text-base font-semibold text-foreground text-center">Agency Profile</span>
                  <span className="text-xs sm:text-sm text-muted-foreground text-center mt-1 sm:mt-2">
                    Manage settings
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>Update your agency profile and settings</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Recent Lead Gen Jobs */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">Recent Campaigns</h2>
            <Link
              href="/dashboard/marketing"
              className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              View all →
            </Link>
          </div>
          {recentLeadGenJobs && recentLeadGenJobs.length > 0 ? (
            <div className="space-y-3">
              {recentLeadGenJobs.slice(0, 3).map((job) => (
                <Link
                  key={job._id}
                  href={`/dashboard/marketing/${job._id}`}
                  className="flex items-center justify-between p-4 rounded-lg bg-surface-overlay/50 border border-border/40 hover:border-border hover:bg-surface-overlay/70 transition-all cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {job.campaign.targetVertical} in {job.campaign.targetGeography}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {job.numLeadsFetched}/{job.numLeadsRequested} leads
                    </p>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <StatusBadge status={job.status} />
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(job._creationTime).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Target}
              title="No campaigns yet"
              description="Start your first lead generation campaign to see results here"
              action={
                <Button asChild className="btn-primary mt-4">
                  <Link href="/dashboard/marketing">
                    Start Your First Campaign
                  </Link>
                </Button>
              }
            />
          )}
        </div>

        {/* Recent Calls */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">Recent Calls</h2>
            <Link
              href="/dashboard/calls"
              className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              View all →
            </Link>
          </div>
          {recentCalls && recentCalls.length > 0 ? (
            <div className="space-y-3">
              {recentCalls.slice(0, 3).map((call: CallRecord) => (
                <Link
                  key={call._id}
                  href={`/dashboard/calls/${call._id}`}
                  className="flex items-center justify-between p-4 rounded-lg bg-surface-overlay/50 border border-border/40 hover:border-border hover:bg-surface-overlay/70 transition-all cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">Call #{call._id.slice(-8)}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Duration: {call.duration ? Math.floor(call.duration / 60000) : 0}m
                    </p>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <StatusBadge status={call.currentStatus || call.status || "unknown"} />
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(call._creationTime).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Phone}
              title="No calls yet"
              description="Your recent calls will appear here once you start making them"
            />
          )}
        </div>
      </div>

    </div>
  );
}

type StatCardProps = {
  title: string;
  value: number;
  subtitle: string;
  variant: "primary" | "accent";
};

function StatCard({ title, value, subtitle, variant }: StatCardProps) {
  const cardClass = variant === "primary" ? "stat-card-primary" : "stat-card-accent";

  return (
    <div className={`${cardClass} p-4 sm:p-5`}>
      <p className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1 sm:mb-2">{title}</p>
      <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{value}</p>
      <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">{subtitle}</p>
    </div>
  );
}

type StatusBadgeProps = {
  status: string;
};

function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status?.toLowerCase()) {
      case "running":
      case "in-progress":
        return "default";
      case "completed":
        return "secondary";
      case "failed":
      case "error":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusClassName = (status: string) => {
    switch (status?.toLowerCase()) {
      case "running":
      case "in-progress":
        return "bg-accent/60 text-accent-foreground border-accent-foreground/20";
      case "completed":
        return "bg-[hsl(var(--success)/0.2)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)]";
      case "paused_for_upgrade":
        return "bg-muted text-muted-foreground border-border";
      case "failed":
      case "error":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "";
    }
  };

  return (
    <Badge variant={getStatusVariant(status)} className={getStatusClassName(status)}>
      {status?.replace(/_/g, " ") || "Unknown"}
    </Badge>
  );
}

type EmptyStateProps = {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
};

function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <Icon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6">{description}</p>
      {action}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="max-w-6xl mx-auto w-full space-y-8">
      {/* Hero Section Skeleton */}
      <div className="card-warm-static p-6 md:p-8">
        <div className="flex items-center gap-6 mb-8">
          <Skeleton className="h-[72px] w-[72px] rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-6 w-96" />
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="stat-card-accent p-4 sm:p-5">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions Skeleton */}
      <div className="card-warm-static p-6 md:p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="action-link">
              <Skeleton className="h-16 w-16 rounded-2xl mb-3" />
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="card-warm-static p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-3">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="p-4 rounded-lg bg-surface-overlay/50 border border-border/40">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Skeleton className="h-5 w-48 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="text-right ml-4">
                      <Skeleton className="h-6 w-20 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
