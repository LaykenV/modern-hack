"use client";

import { Authenticated, Unauthenticated, useQuery, useAction, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import Image from "next/image";
import { CreditMeter } from "@/components/CreditMeter";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import PaywallDialog from "@/components/autumn/paywall-dialog";
import { useCustomer } from "autumn-js/react";

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

const PHASE_LABELS = {
  scrape_content: "Preparing Scrapes",
  generate_dossier: "Scrape Content & Generate Dossier",
} as const;

function DashboardContent() {
  const user = useQuery(api.auth.getCurrentUser);
  const sellerBrain = useQuery(api.sellerBrain.getForCurrentUser);
  const router = useRouter();
  const testMeter = useAction(api.testMeter.testLeadDiscoveryMeter);
  const startLeadGenWorkflow = useAction(api.marketing.startLeadGenWorkflow);
  const resumeWorkflow = useMutation(api.marketing.resumeLeadGenWorkflow);
  const { refetch: refetchCustomer } = useCustomer();
  const onboardingStatus = useQuery(api.onboarding.queries.getOnboardingStatus, { onboardingFlowId: sellerBrain?.onboardingFlowId });
  
  // State for lead generation
  const [currentJobId, setCurrentJobId] = useState<Id<"lead_gen_flow"> | null>(null);
  const [numLeads, setNumLeads] = useState(5);
  const [targetVertical, setTargetVertical] = useState("");
  const [targetGeography, setTargetGeography] = useState("");
  
  // Query for lead gen job status
  const leadGenJob = useQuery(
    api.marketing.getLeadGenJob,
    currentJobId ? { jobId: currentJobId } : "skip"
  );

  const leadGenProgress = useQuery(
    api.marketing.getLeadGenProgress,
    currentJobId ? { jobId: currentJobId } : "skip"
  );

  const leadGenCounts = useQuery(
    api.marketing.getLeadGenFlowCounts,
    currentJobId ? { leadGenFlowId: currentJobId } : "skip"
  );

  const opportunities = useQuery(
    api.marketing.listClientOpportunitiesByFlow,
    currentJobId ? { leadGenFlowId: currentJobId } : "skip"
  );

  const auditJobs = useQuery(
    api.marketing.listAuditJobsByFlow,
    currentJobId ? { leadGenFlowId: currentJobId } : "skip"
  );

  // Query for lead gen jobs history
  const leadGenJobs = useQuery(
    api.marketing.listLeadGenJobsByAgency,
    sellerBrain?.agencyProfileId ? { agencyId: sellerBrain.agencyProfileId } : "skip"
  );

  const [expandedOpportunityId, setExpandedOpportunityId] = useState<Id<"client_opportunities"> | null>(null);
  const [viewSourcesForAuditId, setViewSourcesForAuditId] = useState<Id<"audit_jobs"> | null>(null);
  
  // Paywall state
  const [paywallOpen, setPaywallOpen] = useState(false);
  
  // Get billing block from current job
  const billingBlock = leadGenJob?.billingBlock;

  const selectedAuditJob = auditJobs && expandedOpportunityId
    ? auditJobs.find((job) => job.opportunityId === expandedOpportunityId)
    : undefined;

  const dossier = useQuery(
    api.marketing.getAuditDossier,
    selectedAuditJob?.dossierId ? { dossierId: selectedAuditJob.dossierId } : "skip"
  );

  const scrapedPages = useQuery(
    api.marketing.listScrapedPagesByAudit,
    viewSourcesForAuditId ? { auditJobId: viewSourcesForAuditId } : "skip"
  );

  const auditJobMap = useMemo(() => {
    if (!auditJobs) {
      return new Map();
    }
    return new Map(auditJobs.map((job) => [job.opportunityId, job]));
  }, [auditJobs]);

  useEffect(() => {
    if (!currentJobId && leadGenJobs && leadGenJobs.length > 0) {
      setCurrentJobId(leadGenJobs[0]._id);
    }
  }, [currentJobId, leadGenJobs]);

  useEffect(() => {
    if (!expandedOpportunityId) {
      setViewSourcesForAuditId(null);
    }
  }, [expandedOpportunityId]);

  useEffect(() => {
    if (user && (!sellerBrain || (onboardingStatus !== "completed" && onboardingStatus !== null))) {
      router.replace("/dashboard/onboarding");
    }
  }, [user, sellerBrain, router, onboardingStatus]);

  // Auto-open paywall when billing block exists
  useEffect(() => {
    if (billingBlock && !paywallOpen) {
      setPaywallOpen(true);
    }
  }, [billingBlock, paywallOpen]);

  // Handle successful upgrade and workflow resume
  const handleUpgradeSuccess = async () => {
    if (!currentJobId) return;
    
    try {
      // Refetch customer data to get updated credits
      await refetchCustomer();
      
      // Resume the workflow
      const result = await resumeWorkflow({ leadGenFlowId: currentJobId });
      
      if (result.success) {
        console.log("Workflow resumed successfully:", result.message);
      } else {
        console.error("Failed to resume workflow:", result.message);
        alert(`Failed to resume workflow: ${result.message}`);
      }
    } catch (error) {
      console.error("Error resuming workflow:", error);
      alert("Failed to resume workflow. Please try again.");
    }
  };
  return (
    <div className="max-w-2xl mx-auto w-full">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <div className="mb-4">
        <button
          className="border border-slate-300 dark:border-slate-700 text-sm px-4 py-2 rounded-md"
          onClick={async () => {
            await authClient.signOut();
          }}
        >
          Sign out
        </button>
        <button
          className="border border-slate-300 dark:border-slate-700 text-sm px-4 py-2 rounded-md ml-2"
          onClick={async () => {
            try {
              const res = await testMeter({});
              alert(res.message);
            } catch (err) {
              console.error("Test meter failed", err);
              alert("Test metering failed. Check console for details.");
            }
          }}
        >
          Test Autumn Meter
        </button>
        <Link href="/dashboard/subscription">Subscription</Link>
      </div>
      <p className="mb-2">You are signed in.</p>
      <p className="mb-2">Email: {user?.email}</p>
      <p className="mb-2">Name: {user?.name}</p>
      <p className="mb-2">ID: {user?._id}</p>
      <p className="mb-2">Created At: {user?.createdAt}</p>
      <p className="mb-2">Updated At: {user?.updatedAt}</p>
      {user?.image && <Image
                      src={user.image}
                      alt="User Image"
                      width={96}
                      height={96}
                      className="mb-2 rounded-full"
                      priority
                    />}
      <CreditMeter />
      {sellerBrain && (
        <div className="mt-8 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-3">Seller Brain</h2>
          <div className="grid grid-cols-1 gap-2">
            <p>
              <span className="font-medium">Company:</span> {sellerBrain.companyName}
            </p>
            <p>
              <span className="font-medium">Source URL:</span> {sellerBrain.sourceUrl}
            </p>
            {typeof sellerBrain.summary !== "undefined" && (
              <p>
                <span className="font-medium">Summary:</span> {sellerBrain.summary}
              </p>
            )}
            <p>
              <span className="font-medium">Status:</span> {onboardingStatus ?? "Not started"}
            </p>
            {typeof sellerBrain.tone !== "undefined" && (
              <p>
                <span className="font-medium">Tone:</span> {sellerBrain.tone}
              </p>
            )}
            {typeof sellerBrain.timeZone !== "undefined" && (
              <p>
                <span className="font-medium">Time Zone:</span> {sellerBrain.timeZone}
              </p>
            )}
            {Array.isArray(sellerBrain.availability) && sellerBrain.availability.length > 0 && (
              <p>
                <span className="font-medium">Availability:</span> {sellerBrain.availability.join(", ")}
              </p>
            )}
            {Array.isArray(sellerBrain.targetVertical) && sellerBrain.targetVertical.length > 0 && (
              <p>
                <span className="font-medium">Target Vertical:</span> {sellerBrain.targetVertical.join(", ")}
              </p>
            )}
            {sellerBrain.targetGeography && (
              <p>
                <span className="font-medium">Target Geography:</span> {sellerBrain.targetGeography}
              </p>
            )}
            {sellerBrain.coreOffer && (
              <p>
                <span className="font-medium">Core Offer:</span> {sellerBrain.coreOffer}
              </p>
            )}
            {Array.isArray(sellerBrain.leadQualificationCriteria) && sellerBrain.leadQualificationCriteria.length > 0 && (
              <p>
                <span className="font-medium">Lead Qualification Criteria:</span> {sellerBrain.leadQualificationCriteria.join(", ")}
              </p>
            )}
            {Array.isArray(sellerBrain.guardrails) && sellerBrain.guardrails.length > 0 && (
              <div>
                <p className="font-medium">Guardrails:</p>
                <ul className="list-disc ml-6 mt-1">
                  {sellerBrain.guardrails.map((g, idx) => (
                    <li key={`guardrail-${idx}`}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(sellerBrain.approvedClaims) && sellerBrain.approvedClaims.length > 0 && (
              <div>
                <p className="font-medium">Approved Claims:</p>
                <ul className="list-disc ml-6 mt-1">
                  {sellerBrain.approvedClaims.map((c) => (
                    <li key={c.id}>
                      <span>{c.text}</span>
                      {c.source_url && (
                        <>
                          {" "}
                          <a
                            href={c.source_url}
                            className="text-blue-600 dark:text-blue-400 underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            source
                          </a>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Lead Generation Workflow Section */}
      <div className="mt-8 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-3">Lead Generation Workflow</h2>
        
        {/* Start Workflow Form */}
        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900 rounded">
          <h3 className="text-lg font-medium mb-3">Start New Lead Generation</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Number of Leads (1-20)</label>
              <input
                type="number"
                min="1"
                max="20"
                value={numLeads}
                onChange={(e) => setNumLeads(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Target Vertical (optional)</label>
              <input
                type="text"
                value={targetVertical}
                onChange={(e) => setTargetVertical(e.target.value)}
                placeholder="e.g., roofers, dentists"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Target Geography (optional)</label>
              <input
                type="text"
                value={targetGeography}
                onChange={(e) => setTargetGeography(e.target.value)}
                placeholder="e.g., San Francisco, CA"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md"
              />
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                const result = await startLeadGenWorkflow({
                  numLeads,
                  targetVertical: targetVertical || undefined,
                  targetGeography: targetGeography || undefined,
                });
                setCurrentJobId(result.jobId);
                alert(`Lead generation started! Job ID: ${result.jobId}`);
              } catch (err) {
                console.error("Failed to start lead generation:", err);
                alert("Failed to start lead generation. Check console for details.");
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Start Lead Generation
          </button>
        </div>

        {/* Paywall Dialog */}
        <PaywallDialog
          open={paywallOpen}
          onOpenChange={setPaywallOpen}
          preview={billingBlock?.preview}
          onSuccess={handleUpgradeSuccess}
        />

        {/* Current Job Status */}
        {leadGenJob && (
          <div className={`mb-6 p-4 rounded ${
            leadGenJob.status === "paused_for_upgrade" 
              ? "bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800" 
              : "bg-blue-50 dark:bg-blue-900/20"
          }`}>
            <h3 className="text-lg font-medium mb-3">Current Job Status</h3>
            
            {/* Paused Status Banner */}
            {leadGenJob.status === "paused_for_upgrade" && billingBlock && (
              <div className="mb-4 p-3 bg-orange-100 dark:bg-orange-900/30 rounded border border-orange-300 dark:border-orange-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-orange-800 dark:text-orange-200">
                      ⏸️ Workflow Paused - Upgrade Required
                    </p>
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      Insufficient credits for {billingBlock.featureId.replace("_", " ")} in {billingBlock.phase} phase
                    </p>
                  </div>
                  <button
                    onClick={() => setPaywallOpen(true)}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Upgrade Now
                  </button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p><strong>Job ID:</strong> {leadGenJob._id}</p>
                <p><strong>Status:</strong> {leadGenJob.status}</p>
                <p><strong>Workflow Status:</strong> {leadGenJob.workflowStatus || "N/A"}</p>
                <p><strong>Leads Requested:</strong> {leadGenJob.numLeadsRequested}</p>
                <p><strong>Leads Fetched:</strong> {leadGenJob.numLeadsFetched}</p>
              </div>
              <div>
                <p><strong>Target Vertical:</strong> {leadGenJob.campaign.targetVertical}</p>
                <p><strong>Target Geography:</strong> {leadGenJob.campaign.targetGeography}</p>
                {leadGenJob.lastEvent && (
                  <div className="mt-2">
                    <p><strong>Last Event:</strong></p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {leadGenJob.lastEvent.message} ({new Date(leadGenJob.lastEvent.timestamp).toLocaleString()})
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Phase Progress */}
            <div className="mt-4">
              <h4 className="font-medium mb-2">Phase Progress:</h4>
              <div className="space-y-2">
                {leadGenJob.phases.map((phase) => (
                  <div key={phase.name} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      phase.status === "complete" ? "bg-green-500" :
                      phase.status === "running" ? "bg-blue-500" :
                      phase.status === "error" ? "bg-red-500" :
                      leadGenJob.status === "paused_for_upgrade" && phase.name === billingBlock?.phase ? "bg-orange-500" :
                      "bg-gray-300"
                    }`} />
                    <span className="capitalize">{PHASE_LABELS[phase.name as keyof typeof PHASE_LABELS] ?? phase.name.replace(/_/g, " ")}</span>
                    <span className="text-sm text-slate-500">({Math.round(phase.progress * 100)}%)</span>
                    {phase.status === "running" && <span className="text-blue-600">Running...</span>}
                    {leadGenJob.status === "paused_for_upgrade" && phase.name === billingBlock?.phase && (
                      <span className="text-orange-600">Paused for upgrade</span>
                    )}
                    {phase.status === "error" && phase.errorMessage && (
                      <span className="text-red-600 text-sm">Error: {phase.errorMessage}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {typeof leadGenProgress === "number" && (
              <div className="mt-4">
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded">
                  <div
                    className="h-2 bg-blue-600 rounded"
                    style={{ width: `${Math.round(leadGenProgress * 100)}%` }}
                  />
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Overall progress: {Math.round(leadGenProgress * 100)}%
                </p>
              </div>
            )}

            {/* Places Snapshot */}
            {leadGenJob.placesSnapshot && leadGenJob.placesSnapshot.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Places Found ({leadGenJob.placesSnapshot.length}):</h4>
                <div className="max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-1 gap-2">
                    {leadGenJob.placesSnapshot.map((place) => (
                      <div key={place.id} className="p-2 bg-white dark:bg-slate-800 rounded border">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{place.name}</p>
                            {place.address && <p className="text-sm text-slate-600">{place.address}</p>}
                            {place.phone && <p className="text-sm">📞 {place.phone}</p>}
                            {place.website && (
                              <p className="text-sm">
                                🌐 <a href={place.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                  {place.website}
                                </a>
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            {place.rating && (
                              <p className="text-sm">⭐ {place.rating}</p>
                            )}
                            {place.reviews && (
                              <p className="text-sm text-slate-500">({place.reviews} reviews)</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Counts Summary */}
        {leadGenCounts && (
          <div className="mb-6 p-4 bg-slate-100 dark:bg-slate-900 rounded">
            <h3 className="text-lg font-medium mb-3">Flow Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <SummaryChip label="Total opportunities" value={leadGenCounts.totalOpportunities} />
              <SummaryChip label="With websites" value={leadGenCounts.opportunitiesWithWebsites} />
              <SummaryChip label="Without websites" value={leadGenCounts.opportunitiesWithoutWebsites} />
              <SummaryChip label="Queued audits" value={leadGenCounts.queuedAudits} />
              <SummaryChip label="Running audits" value={leadGenCounts.runningAudits} />
              <SummaryChip label="Completed audits" value={leadGenCounts.completedAudits} />
              <SummaryChip label="Ready opportunities" value={leadGenCounts.readyOpportunities} />
            </div>
          </div>
        )}

        {/* Opportunities Table */}
        {opportunities && opportunities.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Opportunities</h3>
            <div className="space-y-3">
              {opportunities.map((opp) => {
                const job = auditJobMap.get(opp._id);
                const completedPhases = job?.phases.filter((phase: { status: string }) => phase.status === "complete").length ?? 0;
                const phaseProgress = job ? Math.round((completedPhases / job.phases.length) * 100) : 0;

                const isExpanded = expandedOpportunityId === opp._id;

                return (
                  <div
                    key={opp._id}
                    className="border border-slate-200 dark:border-slate-800 rounded"
                  >
                    <button
                      onClick={() => setExpandedOpportunityId(isExpanded ? null : opp._id)}
                      className="w-full text-left p-4 flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <p className="font-medium text-lg">{opp.name}</p>
                          <p className="text-sm text-slate-500">{opp.domain ?? "No website"}</p>
                          <p className="text-sm">Status: {opp.status}</p>
                        </div>
                        <div className="text-right text-sm text-slate-500">
                          <p>Score: {Math.round(opp.qualificationScore * 100)}%</p>
                          {job && <p>Audit: {job.status}</p>}
                        </div>
                      </div>
                      <div className="text-sm flex flex-wrap gap-2">
                        {opp.signals.map((signal) => (
                          <span
                            key={signal}
                            className="inline-flex items-center rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5"
                          >
                            {signal.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                      {job && (
                        <div className="w-full">
                          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded">
                            <div
                              className="h-2 bg-emerald-500 rounded"
                              style={{ width: `${phaseProgress}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {completedPhases}/{job.phases.length} phases complete
                          </p>
                        </div>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-4">
                        {opp.fit_reason && (
                          <div>
                            <h4 className="font-medium mb-1">Fit Reason</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-300">{opp.fit_reason}</p>
                          </div>
                        )}

                        {job && (
                          <div>
                            <h4 className="font-medium mb-2">Audit Phases</h4>
                            <div className="space-y-1 text-sm">
                              {job.phases.map((phase: { name: string; status: string }) => (
                                <div key={phase.name} className="flex justify-between">
                                  <span>{phase.name.replace(/_/g, " ")}</span>
                                  <span className="text-slate-500">{phase.status}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {job?.dossierId && (
                          <div>
                            <h4 className="font-medium mb-2">Dossier</h4>
                            {dossier ? (
                              <div className="space-y-3 text-sm">
                                {dossier.summary && (
                                  <div>
                                    <h5 className="font-medium mb-1">Summary</h5>
                                    <p className="text-slate-600 dark:text-slate-300">{dossier.summary}</p>
                                  </div>
                                )}

                                {dossier.identified_gaps.length > 0 && (
                                  <div>
                                    <h5 className="font-medium mb-1">Identified Gaps</h5>
                                    <ul className="list-disc ml-5 space-y-1">
                                      {dossier.identified_gaps.map((gap, idx) => (
                                        <li key={`gap-${idx}`}>
                                          <span className="font-medium">{gap.key}:</span> {gap.value}
                                          {gap.source_url && (
                                            <>
                                              {" "}
                                              <a
                                                href={gap.source_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-blue-600 dark:text-blue-400 underline"
                                              >
                                                Source
                                              </a>
                                            </>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {dossier.talking_points.length > 0 && (
                                  <div>
                                    <h5 className="font-medium mb-1">Talking Points</h5>
                                    <ul className="list-disc ml-5 space-y-1">
                                      {dossier.talking_points.map((point, idx) => (
                                        <li key={`tp-${idx}`}>
                                          {point.text}
                                          {point.source_url && (
                                            <>
                                              {" "}
                                              <a
                                                href={point.source_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-blue-600 dark:text-blue-400 underline"
                                              >
                                                Source
                                              </a>
                                            </>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {dossier.sources.length > 0 && (
                                  <div>
                                    <h5 className="font-medium mb-1">Sources</h5>
                                    <ul className="list-disc ml-5 space-y-1">
                                      {dossier.sources.map((source, idx) => (
                                        <li key={`source-${idx}`}>
                                          <a
                                            href={source.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-blue-600 dark:text-blue-400 underline"
                                          >
                                            {source.title || source.url}
                                          </a>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">Loading dossier...</p>
                            )}
                          </div>
                        )}

                        {job && (
                          <div>
                            <button
                              onClick={() =>
                                setViewSourcesForAuditId((id) =>
                                  id === job._id ? null : job._id
                                )
                              }
                              className="text-sm text-blue-600 dark:text-blue-400 underline"
                            >
                              {viewSourcesForAuditId === job._id
                                ? "Hide scraped sources"
                                : "View scraped sources"}
                            </button>

                            {viewSourcesForAuditId === job._id && (
                              <div className="mt-3 space-y-2 text-sm">
                                {scrapedPages
                                  ? scrapedPages.length > 0
                                    ? scrapedPages.map((page, idx) => (
                                        <div
                                          key={`scrape-${idx}`}
                                          className="border border-slate-200 dark:border-slate-700 rounded p-2"
                                        >
                                          <p className="font-medium">{page.title || page.url}</p>
                                          <p className="text-xs text-slate-500">{page.url}</p>
                                          {typeof page.httpStatus !== "undefined" && (
                                            <p className="text-xs text-slate-500">HTTP {page.httpStatus}</p>
                                          )}
                                          {page.contentUrl && (
                                            <p className="text-xs mt-1">
                                              <a
                                                href={page.contentUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-blue-600 dark:text-blue-400 underline"
                                              >
                                                Download content snapshot
                                              </a>
                                            </p>
                                          )}
                                        </div>
                                      ))
                                    : <p className="text-xs text-slate-500">No scraped pages recorded.</p>
                                  : <p className="text-xs text-slate-500">Loading sources...</p>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Job History */}
        {leadGenJobs && leadGenJobs.length > 0 && (
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded">
            <h3 className="text-lg font-medium mb-3">Recent Jobs</h3>
            <div className="space-y-2">
              {leadGenJobs.slice(0, 5).map((job) => (
                <div 
                  key={job._id} 
                  className={`p-3 rounded border cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    currentJobId === job._id ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-slate-200 dark:border-slate-700"
                  }`}
                  onClick={() => setCurrentJobId(job._id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        {job.campaign.targetVertical} in {job.campaign.targetGeography}
                      </p>
                      <p className="text-sm text-slate-600">
                        {job.numLeadsFetched}/{job.numLeadsRequested} leads • {job.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">
                        {new Date(job._creationTime).toLocaleDateString()}
                      </p>
                      {job.lastEvent && (
                        <p className="text-xs text-slate-400">
                          {job.lastEvent.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type SummaryChipProps = {
  label: string;
  value: number;
};

function SummaryChip({ label, value }: SummaryChipProps) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}


