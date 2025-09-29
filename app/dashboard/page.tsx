"use client";

import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import Image from "next/image";
import { CreditMeter } from "@/components/CreditMeter";
import Link from "next/link";
import { useCustomer } from "autumn-js/react";

// Type for call objects
type CallRecord = Doc<"calls">;

export default function DashboardPage() {
  return (
    <main className="p-8 flex flex-col gap-6">
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
    <div className="max-w-4xl mx-auto w-full space-y-6">
      {/* Hero Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Overview</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Welcome back, {user?.name || user?.email}
          </p>
        </div>
        {user?.image && (
          <Image
            src={user.image}
            alt="User Image"
            width={64}
            height={64}
            className="rounded-full"
            priority
          />
        )}
      </div>

      {/* Credit Meter */}
      <CreditMeter />

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Atlas Credits"
          value={atlasCreditsBalance}
          subtitle="Available balance"
          color="blue"
        />
        <StatCard
          title="Active Campaigns"
          value={activeLeadGenJobs}
          subtitle="Running lead gen"
          color="green"
        />
        <StatCard
          title="Ready Opportunities"
          value={readyOpportunities}
          subtitle="Leads fetched"
          color="purple"
        />
        <StatCard
          title="Live Calls"
          value={inProgressCalls}
          subtitle="In progress"
          color="orange"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/dashboard/marketing"
            className="flex flex-col items-center p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-3">
              <span className="text-2xl">🎯</span>
            </div>
            <span className="font-medium">Start Lead Generation</span>
            <span className="text-sm text-slate-500 text-center mt-1">
              Launch new campaigns
            </span>
          </Link>

          <Link
            href="/dashboard/calls"
            className="flex flex-col items-center p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-3">
              <span className="text-2xl">📞</span>
            </div>
            <span className="font-medium">View Calls</span>
            <span className="text-sm text-slate-500 text-center mt-1">
              Monitor call activity
            </span>
          </Link>

          <Link
            href="/dashboard/meetings"
            className="flex flex-col items-center p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-3">
              <span className="text-2xl">📅</span>
            </div>
            <span className="font-medium">Upcoming Meetings</span>
            <span className="text-sm text-slate-500 text-center mt-1">
              {upcomingMeetingsCount} scheduled
            </span>
          </Link>

          <Link
            href="/dashboard/agency"
            className="flex flex-col items-center p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mb-3">
              <span className="text-2xl">🏢</span>
            </div>
            <span className="font-medium">Agency Profile</span>
            <span className="text-sm text-slate-500 text-center mt-1">
              Manage settings
            </span>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Lead Gen Jobs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Campaigns</h2>
            <Link
              href="/dashboard/marketing"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View all
            </Link>
          </div>
          {recentLeadGenJobs && recentLeadGenJobs.length > 0 ? (
            <div className="space-y-3">
              {recentLeadGenJobs.slice(0, 3).map((job) => (
                <div
                  key={job._id}
                  className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {job.campaign.targetVertical} in {job.campaign.targetGeography}
                    </p>
                    <p className="text-xs text-slate-500">
                      {job.numLeadsFetched}/{job.numLeadsRequested} leads
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={job.status} />
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(job._creationTime).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No campaigns yet</p>
          )}
        </div>

        {/* Recent Calls */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Calls</h2>
            <Link
              href="/dashboard/calls"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View all
            </Link>
          </div>
          {recentCalls && recentCalls.length > 0 ? (
            <div className="space-y-3">
              {recentCalls.slice(0, 3).map((call: CallRecord) => (
                <div
                  key={call._id}
                  className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">Call #{call._id.slice(-8)}</p>
                    <p className="text-xs text-slate-500">
                      Duration: {call.duration ? Math.floor(call.duration / 60000) : 0}m
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={call.currentStatus || call.status || "unknown"} />
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(call._creationTime).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No calls yet</p>
          )}
        </div>
      </div>

      {/* Agency Profile Summary */}
      {agencyProfile && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Agency Profile</h2>
            <Link
              href="/dashboard/agency"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Edit profile
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Company</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{agencyProfile.companyName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Target Geography</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{agencyProfile.targetGeography || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Target Vertical</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {Array.isArray(agencyProfile.targetVertical) && agencyProfile.targetVertical.length > 0 
                  ? agencyProfile.targetVertical.join(", ") 
                  : "Not set"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type StatCardProps = {
  title: string;
  value: number;
  subtitle: string;
  color: "blue" | "green" | "purple" | "orange";
};

function StatCard({ title, value, subtitle, color }: StatCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
    green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    purple: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800",
    orange: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800",
  };

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[color]}`}>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
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
        return "bg-green-100 text-green-700";
      case "completed":
        return "bg-blue-100 text-blue-700";
      case "paused_for_upgrade":
        return "bg-orange-100 text-orange-700";
      case "failed":
      case "error":
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
