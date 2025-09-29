"use client";

import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import Image from "next/image";
import Link from "next/link";
import { useCustomer } from "autumn-js/react";

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
    api.call.calls.getCallsByOpportunity,
    "skip" // Will fix this when we have the proper API
  );

  // Meetings API not available yet, using placeholder
  const upcomingMeetings = [];

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
  const activeLeadGenJobs = recentLeadGenJobs?.filter(job => job.status === "running" || job.status === "paused_for_upgrade")?.length ?? 0;
  const readyOpportunities = recentLeadGenJobs?.reduce((sum, job) => {
    // This would need to be calculated based on opportunities with "READY" status
    return sum + (job.numLeadsFetched || 0);
  }, 0) ?? 0;
  const inProgressCalls = recentCalls?.filter((call: CallRecord) => call.currentStatus === "in-progress" || call.status === "in-progress")?.length ?? 0;
  const upcomingMeetingsCount = upcomingMeetings?.length ?? 0;

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
            title="Active Campaigns"
            value={activeLeadGenJobs}
            subtitle="Running lead gen"
            variant="accent"
          />
          <StatCard
            title="Ready Opportunities"
            value={readyOpportunities}
            subtitle="Leads fetched"
            variant="accent"
          />
          <StatCard
            title="Live Calls"
            value={inProgressCalls}
            subtitle="In progress"
            variant="accent"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card-warm-static p-6 md:p-8">
        <h2 className="text-2xl font-bold text-foreground mb-6">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          <Link href="/dashboard/marketing" className="action-link">
            <div className="action-link-icon">
              <span className="text-2xl sm:text-3xl">🎯</span>
            </div>
            <span className="text-sm sm:text-base font-semibold text-foreground text-center">Start Lead Generation</span>
            <span className="text-xs sm:text-sm text-muted-foreground text-center mt-1 sm:mt-2">
              Launch new campaigns
            </span>
          </Link>

          <Link href="/dashboard/calls" className="action-link">
            <div className="action-link-icon">
              <span className="text-2xl sm:text-3xl">📞</span>
            </div>
            <span className="text-sm sm:text-base font-semibold text-foreground text-center">View Calls</span>
            <span className="text-xs sm:text-sm text-muted-foreground text-center mt-1 sm:mt-2">
              Monitor call activity
            </span>
          </Link>

          <Link href="/dashboard/meetings" className="action-link">
            <div className="action-link-icon">
              <span className="text-2xl sm:text-3xl">📅</span>
            </div>
            <span className="text-sm sm:text-base font-semibold text-foreground text-center">Upcoming Meetings</span>
            <span className="text-xs sm:text-sm text-muted-foreground text-center mt-1 sm:mt-2">
              {upcomingMeetingsCount} scheduled
            </span>
          </Link>

          <Link href="/dashboard/agency" className="action-link">
            <div className="action-link-icon">
              <span className="text-2xl sm:text-3xl">🏢</span>
            </div>
            <span className="text-sm sm:text-base font-semibold text-foreground text-center">Agency Profile</span>
            <span className="text-xs sm:text-sm text-muted-foreground text-center mt-1 sm:mt-2">
              Manage settings
            </span>
          </Link>
        </div>
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
                <div
                  key={job._id}
                  className="flex items-center justify-between p-4 rounded-lg bg-surface-overlay/50 border border-border/40 hover:border-border transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">
                      {job.campaign.targetVertical} in {job.campaign.targetGeography}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {job.numLeadsFetched}/{job.numLeadsRequested} leads
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <StatusBadge status={job.status} />
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(job._creationTime).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No campaigns yet</p>
              <Link
                href="/dashboard/marketing"
                className="btn-contrast inline-flex mt-4"
              >
                Start Your First Campaign
              </Link>
            </div>
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
                <div
                  key={call._id}
                  className="flex items-center justify-between p-4 rounded-lg bg-surface-overlay/50 border border-border/40 hover:border-border transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">Call #{call._id.slice(-8)}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Duration: {call.duration ? Math.floor(call.duration / 60000) : 0}m
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <StatusBadge status={call.currentStatus || call.status || "unknown"} />
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(call._creationTime).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No calls yet</p>
            </div>
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
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "running":
      case "in-progress":
        return "bg-accent/60 text-accent-foreground border border-accent-foreground/20";
      case "completed":
        return "bg-primary/20 text-primary border border-primary/30";
      case "paused_for_upgrade":
        return "bg-muted text-muted-foreground border border-border";
      case "failed":
      case "error":
        return "bg-destructive/20 text-destructive border border-destructive/30";
      default:
        return "bg-muted text-muted-foreground border border-border";
    }
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusColor(status)}`}>
      {status?.replace(/_/g, " ") || "Unknown"}
    </span>
  );
}
