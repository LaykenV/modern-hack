"use client";

import { useQuery, useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCustomer } from "autumn-js/react";
import PaywallDialog from "@/components/autumn/paywall-dialog";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TARGET_VERTICALS = [
  "Roofing",
  "Plumbing",
  "Electricians",
  "HVAC",
  "Landscaping & Lawn Care",
  "Tree Services",
  "Pest Control",
  "Garage Door Services",
  "Solar Installers",
  "General Contractors & Remodeling",
  "Painting",
  "Cleaning Services",
  "Restoration (Water/Fire/Mold)",
  "Window Cleaning",
  "Pressure Washing",
  "Handyman",
  "Auto Repair",
  "Auto Body & Collision",
  "Tire Shops",
  "Dentists",
  "Chiropractors",
  "Physical Therapy",
  "Optometrists",
  "Med Spas",
  "Hair Salons & Barbers",
  "Law Firms",
  "Accountants & CPAs",
  "Real Estate Agents",
  "Property Management",
  "Mortgage Brokers"
];

export default function MarketingPage() {
  const router = useRouter();
  const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);
  const { customer, refetch: refetchCustomer } = useCustomer();
  const startLeadGenWorkflow = useAction(api.marketing.startLeadGenWorkflow);

  // State for lead generation form
  const [numLeads, setNumLeads] = useState(5);
  const [targetVertical, setTargetVertical] = useState("");
  const [targetGeography, setTargetGeography] = useState("");
  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false);

  // Paywall state
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Prefill form fields from agency profile when it loads
  useEffect(() => {
    if (agencyProfile) {
      if (agencyProfile.targetVertical && !targetVertical) {
        setTargetVertical(agencyProfile.targetVertical);
      }
      if (agencyProfile.targetGeography && !targetGeography) {
        setTargetGeography(agencyProfile.targetGeography);
      }
    }
  }, [agencyProfile, targetVertical, targetGeography]);

  // Query for lead gen jobs
  const leadGenJobs = useQuery(
    api.marketing.listLeadGenJobsByAgency,
    agencyProfile?.agencyProfileId ? { agencyId: agencyProfile.agencyProfileId } : "skip"
  );

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
  const totalLeads = leadGenJobs?.reduce((sum, job) => sum + (job.numLeadsFetched || 0), 0) ?? 0;

  return (
    <main className="min-h-full p-6 md:p-8 flex flex-col gap-6">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        {/* Hero Section */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground tracking-tight">
                Marketing Campaigns
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Manage your lead generation campaigns
              </p>
            </div>
            <div className="flex flex-col gap-1 p-5 rounded-lg border border-[hsl(var(--ring)/0.35)] bg-gradient-to-br from-[hsl(var(--primary)/0.18)] via-[hsl(var(--accent)/0.25)] to-[hsl(var(--surface-raised))] shadow-[0_0_0_1px_hsl(var(--ring)/0.25)_inset,var(--shadow-soft)]">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Atlas Credits
              </p>
              <p className="text-4xl font-bold text-foreground leading-none">
                {atlasCreditsBalance}
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mt-6">
            <div className="stat-card-primary p-5">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Running
              </p>
              <p className="text-3xl font-bold text-foreground mt-1">
                {runningJobs.length}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Active campaigns</p>
            </div>
            <div className="stat-card-accent p-5">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Paused
              </p>
              <p className="text-3xl font-bold text-foreground mt-1">
                {pausedJobs.length}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Awaiting action</p>
            </div>
            <div className="stat-card-accent p-5">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Completed
              </p>
              <p className="text-3xl font-bold text-foreground mt-1">
                {completedJobs.length}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Finished runs</p>
            </div>
            <div className="stat-card-accent p-5">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Total Leads
              </p>
              <p className="text-3xl font-bold text-foreground mt-1">
                {totalLeads}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Prospects found</p>
            </div>
          </div>
        </div>

        {/* Start New Campaign */}
        <div className="card-warm-static p-6 md:p-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">
            Start New Lead Generation Campaign
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="input-label">
                Number of Leads (1-20)
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={numLeads}
                onChange={(e) => setNumLeads(parseInt(e.target.value) || 1)}
                className="input-field"
              />
            </div>
            <div>
              <label className="input-label">
                Target Vertical
              </label>
              <Select value={targetVertical} onValueChange={setTargetVertical}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an industry..." />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_VERTICALS.map(vertical => (
                    <SelectItem key={vertical} value={vertical}>{vertical}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="input-label">
                Target Geography
              </label>
              <input
                type="text"
                value={targetGeography}
                onChange={(e) => setTargetGeography(e.target.value)}
                placeholder="e.g., San Francisco, CA"
                className="input-field"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleStartLeadGen}
              disabled={isStartingWorkflow || !agencyProfile?.agencyProfileId}
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg font-semibold text-[hsl(var(--primary-foreground))] bg-gradient-to-b from-[hsl(var(--primary)/0.24)] to-[hsl(var(--primary)/0.42)] border border-[hsl(var(--ring)/0.5)] shadow-[0_0_0_1px_hsl(var(--ring)/0.35)_inset,var(--shadow-soft)] hover:from-[hsl(var(--primary)/0.30)] hover:to-[hsl(var(--primary)/0.50)] hover:shadow-[0_0_0_1px_hsl(var(--ring)/0.40)_inset,var(--shadow-strong)] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:from-[hsl(var(--primary)/0.24)] disabled:hover:to-[hsl(var(--primary)/0.42)]"
            >
              {isStartingWorkflow ? "Starting Campaign..." : "Start Lead Generation"}
            </button>
          </div>

        </div>

        {/* Campaign List */}
        <div className="space-y-8">
          {/* Running Campaigns */}
          {runningJobs.length > 0 && (
            <CampaignSection
              title="Running Campaigns"
              jobs={runningJobs}
            />
          )}

          {/* Paused Campaigns */}
          {pausedJobs.length > 0 && (
            <CampaignSection
              title="Paused Campaigns"
              jobs={pausedJobs}
            />
          )}

          {/* Completed Campaigns */}
          {completedJobs.length > 0 && (
            <CampaignSection
              title="Completed Campaigns"
              jobs={completedJobs}
            />
          )}

          {/* Empty State */}
          {!leadGenJobs || leadGenJobs.length === 0 ? (
            <div className="card-warm-static p-12 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-primary/10">
                <span className="text-3xl">🎯</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                No campaigns yet
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
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
    </main>
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
};

function CampaignSection({ title, jobs }: CampaignSectionProps) {
  return (
    <div className="card-warm-static p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <span className="text-sm text-muted-foreground">
          {jobs.length} {jobs.length === 1 ? "campaign" : "campaigns"}
        </span>
      </div>
      <div className="space-y-3">
        {jobs.map((job) => (
          <Link
            key={job._id}
            href={`/dashboard/marketing/${job._id}`}
            className="flex items-center justify-between p-4 rounded-lg bg-surface-overlay/50 border border-border/40 hover:border-border hover:bg-surface-raised transition-all group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <h3 className="font-semibold text-foreground truncate">
                  {job.campaign.targetVertical} in {job.campaign.targetGeography}
                </h3>
                <StatusBadge status={job.status} />
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted-foreground">
                <span className="font-medium">
                  {job.numLeadsFetched}/{job.numLeadsRequested} leads
                </span>
                <span>
                  Started {new Date(job._creationTime).toLocaleDateString()}
                </span>
              </div>
              {job.lastEvent && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
                  {job.lastEvent.message}
                </p>
              )}
            </div>
            <div className="ml-4 flex-shrink-0">
              <span className="text-sm font-semibold text-primary group-hover:text-primary/80 transition-colors">
                View Details →
              </span>
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
  const getStatusClasses = (status: string) => {
    switch (status?.toLowerCase()) {
      case "running":
        return "bg-accent/60 text-accent-foreground border-accent-foreground/20";
      case "completed":
        return "bg-[hsl(var(--success)/0.20)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.30)]";
      case "paused_for_upgrade":
      case "paused":
        return "bg-muted text-muted-foreground border-border";
      case "failed":
      case "error":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const displayText = status?.replace(/_/g, " ") || "Unknown";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${getStatusClasses(status)}`}>
      {displayText}
    </span>
  );
}