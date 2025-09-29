"use client";

import { useQuery, useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCustomer } from "autumn-js/react";
import PaywallDialog from "@/components/autumn/paywall-dialog";
import Link from "next/link";

export default function MarketingPage() {
  const router = useRouter();
  const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);
  const { customer, refetch: refetchCustomer } = useCustomer();
  const startLeadGenWorkflow = useAction(api.marketing.startLeadGenWorkflow);
  //const resumeWorkflow = useAction(api.marketing.resumeLeadGenWorkflow);

  // State for lead generation form
  const [numLeads, setNumLeads] = useState(5);
  const [targetVertical, setTargetVertical] = useState("");
  const [targetGeography, setTargetGeography] = useState("");
  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false);

  // Paywall state
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Query for lead gen jobs
  const leadGenJobs = useQuery(
    api.marketing.listLeadGenJobsByAgency,
    agencyProfile?.agencyProfileId ? { agencyId: agencyProfile.agencyProfileId } : "skip"
  );
  console.log(leadGenJobs);

  const atlasCreditsBalance = customer?.features?.atlas_credits?.balance ?? 0;

  const handleStartLeadGen = async () => {
    if (!agencyProfile?.agencyProfileId) return;
    
    setIsStartingWorkflow(true);
    try {
      const result = await startLeadGenWorkflow({
        numLeads,
        targetVertical: targetVertical || undefined,
        targetGeography: targetGeography || undefined,
      });
      
      // Redirect to the new flow detail page
      router.push(`/dashboard/marketing/${result.jobId}`);
    } catch (err) {
      console.error("Failed to start lead generation:", err);
      alert("Failed to start lead generation. Check console for details.");
    } finally {
      setIsStartingWorkflow(false);
    }
  };

  // Group jobs by status
  const runningJobs = leadGenJobs?.filter(job => job.status === "running") ?? [];
  const pausedJobs = leadGenJobs?.filter(job => job.status === "paused_for_upgrade") ?? [];
  const completedJobs = leadGenJobs?.filter(job => job.status === "completed") ?? [];

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Marketing Campaigns</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage your lead generation campaigns
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">Atlas Credits</p>
          <p className="text-2xl font-bold">{atlasCreditsBalance}</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Running</p>
          <p className="text-2xl font-bold text-blue-600">{runningJobs.length}</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Paused</p>
          <p className="text-2xl font-bold text-orange-600">{pausedJobs.length}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Completed</p>
          <p className="text-2xl font-bold text-green-600">{completedJobs.length}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Total Leads</p>
          <p className="text-2xl font-bold text-purple-600">
            {leadGenJobs?.reduce((sum, job) => sum + (job.numLeadsFetched || 0), 0) ?? 0}
          </p>
        </div>
      </div>

      {/* Start New Campaign */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Start New Lead Generation Campaign</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Number of Leads (1-20)</label>
            <input
              type="number"
              min="1"
              max="20"
              value={numLeads}
              onChange={(e) => setNumLeads(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Target Vertical (optional)</label>
            <input
              type="text"
              value={targetVertical}
              onChange={(e) => setTargetVertical(e.target.value)}
              placeholder="e.g., roofers, dentists"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Target Geography (optional)</label>
            <input
              type="text"
              value={targetGeography}
              onChange={(e) => setTargetGeography(e.target.value)}
              placeholder="e.g., San Francisco, CA"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
            />
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleStartLeadGen}
            disabled={isStartingWorkflow || !agencyProfile?.agencyProfileId}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-2 rounded-md font-medium"
          >
            {isStartingWorkflow ? "Starting Campaign..." : "Start Lead Generation"}
          </button>
          {atlasCreditsBalance < 5 && (
            <button
              onClick={() => setPaywallOpen(true)}
              className="border border-orange-300 text-orange-700 hover:bg-orange-50 px-4 py-2 rounded-md text-sm"
            >
              Need More Credits?
            </button>
          )}
        </div>
        {atlasCreditsBalance < 5 && (
          <p className="text-sm text-orange-600 mt-2">
            ⚠️ You have {atlasCreditsBalance} credits remaining. Lead generation typically requires 5+ credits.
          </p>
        )}
      </div>

      {/* Campaign List */}
      <div className="space-y-6">
        {/* Running Campaigns */}
        {runningJobs.length > 0 && (
          <CampaignSection
            title="Running Campaigns"
            jobs={runningJobs}
            statusColor="blue"
          />
        )}

        {/* Paused Campaigns */}
        {pausedJobs.length > 0 && (
          <CampaignSection
            title="Paused Campaigns"
            jobs={pausedJobs}
            statusColor="orange"
          />
        )}

        {/* Completed Campaigns */}
        {completedJobs.length > 0 && (
          <CampaignSection
            title="Completed Campaigns"
            jobs={completedJobs}
            statusColor="green"
          />
        )}

        {/* Empty State */}
        {!leadGenJobs || leadGenJobs.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Start your first lead generation campaign to begin finding qualified prospects.
            </p>
          </div>
        ) : null}
      </div>

      {/* Paywall Dialog */}
      <PaywallDialog
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        billingBlock={null}
        onResume={async () => ({ ok: false, message: "No workflow to resume" })}
        onRefetchCustomer={async () => {
          await refetchCustomer();
        }}
      />
    </div>
  );
}

type CampaignSectionProps = {
  title: string;
  jobs: Array<{
    _id: Id<"lead_gen_flow">;
    _creationTime: number;
    status: string;
    numLeadsRequested: number;
    numLeadsFetched: number;
    campaign: {
      targetVertical: string;
      targetGeography: string;
    };
    lastEvent?: {
      message: string;
      timestamp: number;
    };
  }>;
  statusColor: "blue" | "orange" | "green";
};

function CampaignSection({ title, jobs, statusColor }: CampaignSectionProps) {
  const colorClasses = {
    blue: "border-blue-200 dark:border-blue-800",
    orange: "border-orange-200 dark:border-orange-800", 
    green: "border-green-200 dark:border-green-800",
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="space-y-3">
        {jobs.map((job) => (
          <Link
            key={job._id}
            href={`/dashboard/marketing/${job._id}`}
            className={`block p-4 border ${colorClasses[statusColor]} rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-medium">
                    {job.campaign.targetVertical} in {job.campaign.targetGeography}
                  </h3>
                  <StatusBadge status={job.status} />
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                  <span>
                    {job.numLeadsFetched}/{job.numLeadsRequested} leads
                  </span>
                  <span>
                    Started {new Date(job._creationTime).toLocaleDateString()}
                  </span>
                </div>
                {job.lastEvent && (
                  <p className="text-xs text-slate-500 mt-1">
                    {job.lastEvent.message}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="text-sm text-blue-600 dark:text-blue-400">
                  View Details →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
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
        return "bg-blue-100 text-blue-700";
      case "completed":
        return "bg-green-100 text-green-700";
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