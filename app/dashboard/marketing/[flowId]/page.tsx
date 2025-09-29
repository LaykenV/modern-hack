"use client";

import { useQuery, useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { use, useState, useEffect, useMemo, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCustomer } from "autumn-js/react";
import PaywallDialog from "@/components/autumn/paywall-dialog";
import Link from "next/link";

type Props = {
  params: Promise<{ flowId: string }>;
};

const PHASE_LABELS = {
  scrape_content: "Preparing Scrapes",
  generate_dossier: "Scrape Content & Generate Dossier",
} as const;

export default function MarketingFlowPage({ params }: Props) {
  const router = useRouter();
  const resolvedParams = use(params);
  const flowId = resolvedParams.flowId as Id<"lead_gen_flow">;
  const { customer, refetch: refetchCustomer } = useCustomer();
  const resumeWorkflow = useAction(api.marketing.resumeLeadGenWorkflow);
  const startVapiCall = useAction(api.call.calls.startCall);

  // State management
  const [expandedOpportunityId, setExpandedOpportunityId] = useState<Id<"client_opportunities"> | null>(null);
  const [viewSourcesForAuditId, setViewSourcesForAuditId] = useState<Id<"audit_jobs"> | null>(null);
  const [startingCallOppId, setStartingCallOppId] = useState<Id<"client_opportunities"> | null>(null);
  const [callErrorByOpp, setCallErrorByOpp] = useState<Record<string, string>>({});
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallDismissed, setPaywallDismissed] = useState(false);
  const billingBlockKeyRef = useRef<string | null>(null);

  // Data queries
  const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);
  const leadGenJob = useQuery(api.marketing.getLeadGenJob, { jobId: flowId });
  const leadGenProgress = useQuery(api.marketing.getLeadGenProgress, { jobId: flowId });
  const leadGenCounts = useQuery(api.marketing.getLeadGenFlowCounts, { leadGenFlowId: flowId });
  const opportunities = useQuery(api.marketing.listClientOpportunitiesByFlow, { leadGenFlowId: flowId });
  const auditJobs = useQuery(api.marketing.listAuditJobsByFlow, { leadGenFlowId: flowId });

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
    if (!auditJobs) return new Map();
    return new Map(auditJobs.map((job) => [job.opportunityId, job]));
  }, [auditJobs]);

  const atlasCreditsBalance = customer?.features?.atlas_credits?.balance ?? 0;
  const billingBlock = leadGenJob?.billingBlock;

  // Effects
  useEffect(() => {
    if (!expandedOpportunityId) {
      setViewSourcesForAuditId(null);
    }
  }, [expandedOpportunityId]);

  useEffect(() => {
    const key = billingBlock
      ? `${billingBlock.featureId}:${billingBlock.phase}:${billingBlock.createdAt}`
      : null;
    if (key && key !== billingBlockKeyRef.current) {
      billingBlockKeyRef.current = key;
      setPaywallDismissed(false);
    }
  }, [billingBlock]);

  // Auto-open paywall when billing block exists, unless user dismissed it
  useEffect(() => {
    if (billingBlock && !paywallOpen && !paywallDismissed) {
      setPaywallOpen(true);
    }
  }, [billingBlock, paywallOpen, paywallDismissed]);

  // Reset dismissal when job changes
  useEffect(() => {
    setPaywallDismissed(false);
  }, [flowId]);

  if (!leadGenJob) {
    return (
      <div className="max-w-6xl mx-auto w-full">
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-12 text-center">
          <h1 className="text-2xl font-bold mb-2">Campaign Not Found</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            The campaign you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Link
            href="/dashboard/marketing"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            ← Back to Marketing
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/dashboard/marketing"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Marketing
            </Link>
          </div>
          <h1 className="text-3xl font-bold">
            {leadGenJob.campaign.targetVertical} in {leadGenJob.campaign.targetGeography}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Campaign ID: {leadGenJob._id}
          </p>
        </div>
        <div className="text-right">
          <StatusBadge status={leadGenJob.status} size="large" />
          <p className="text-sm text-slate-500 mt-1">
            {leadGenJob.numLeadsFetched}/{leadGenJob.numLeadsRequested} leads
          </p>
        </div>
      </div>

      {/* Paused Status Banner */}
      {leadGenJob.status === "paused_for_upgrade" && billingBlock && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-orange-800 dark:text-orange-200">
                ⏸️ Campaign Paused - Upgrade Required
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                Insufficient credits for {billingBlock.featureId.replace("_", " ")} in {billingBlock.phase} phase
              </p>
            </div>
            <button
              onClick={() => {
                setPaywallDismissed(false);
                setPaywallOpen(true);
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      )}

      {/* Phase Progress */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Campaign Progress</h2>
        
        {/* Overall Progress Bar */}
        {typeof leadGenProgress === "number" && (
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span>Overall Progress</span>
              <span>{Math.round(leadGenProgress * 100)}%</span>
            </div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full">
              <div
                className="h-3 bg-blue-600 rounded-full transition-all"
                style={{ width: `${Math.round(leadGenProgress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Phase Details */}
        <div className="space-y-3">
          {leadGenJob.phases.map((phase) => (
            <div key={phase.name} className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full flex-shrink-0 ${
                phase.status === "complete" ? "bg-green-500" :
                phase.status === "running" ? "bg-blue-500 animate-pulse" :
                phase.status === "error" ? "bg-red-500" :
                leadGenJob.status === "paused_for_upgrade" && phase.name === billingBlock?.phase ? "bg-orange-500" :
                "bg-slate-300"
              }`} />
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {PHASE_LABELS[phase.name as keyof typeof PHASE_LABELS] ?? phase.name.replace(/_/g, " ")}
                  </span>
                  <span className="text-sm text-slate-500">({Math.round(phase.progress * 100)}%)</span>
                  {phase.status === "running" && <span className="text-blue-600 text-sm">Running...</span>}
                  {leadGenJob.status === "paused_for_upgrade" && phase.name === billingBlock?.phase && (
                    <span className="text-orange-600 text-sm">Paused for upgrade</span>
                  )}
                </div>
                {phase.status === "error" && phase.errorMessage && (
                  <p className="text-red-600 text-sm mt-1">Error: {phase.errorMessage}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Last Event */}
        {leadGenJob.lastEvent && (
          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
            <p className="text-sm">
              <span className="font-medium">Latest:</span> {leadGenJob.lastEvent.message}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {new Date(leadGenJob.lastEvent.timestamp).toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Flow Summary */}
      {leadGenCounts && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Campaign Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <SummaryCard label="Total opportunities" value={leadGenCounts.totalOpportunities} />
            <SummaryCard label="With websites" value={leadGenCounts.opportunitiesWithWebsites} />
            <SummaryCard label="Without websites" value={leadGenCounts.opportunitiesWithoutWebsites} />
            <SummaryCard label="Queued audits" value={leadGenCounts.queuedAudits} />
            <SummaryCard label="Running audits" value={leadGenCounts.runningAudits} />
            <SummaryCard label="Completed audits" value={leadGenCounts.completedAudits} />
            <SummaryCard label="Ready opportunities" value={leadGenCounts.readyOpportunities} />
          </div>
        </div>
      )}

      {/* Opportunities */}
      {opportunities && opportunities.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Opportunities ({opportunities.length})</h2>
          <div className="space-y-4">
            {opportunities.map((opp) => {
              const job = auditJobMap.get(opp._id);
              const completedPhases = job?.phases.filter((phase: { status: string }) => phase.status === "complete").length ?? 0;
              const phaseProgress = job ? Math.round((completedPhases / job.phases.length) * 100) : 0;
              const isExpanded = expandedOpportunityId === opp._id;
              const oppKey = String(opp._id);

              return (
                <div
                  key={opp._id}
                  className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedOpportunityId(isExpanded ? null : opp._id)}
                    className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-lg">{opp.name}</h3>
                          <OpportunityStatusBadge status={opp.status} />
                        </div>
                        <p className="text-sm text-slate-500 mb-2">{opp.domain ?? "No website"}</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {opp.signals.map((signal) => (
                            <span
                              key={signal}
                              className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-1 text-xs"
                            >
                              {signal.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                        {job && (
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full">
                              <div
                                className="h-2 bg-emerald-500 rounded-full"
                                style={{ width: `${phaseProgress}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500">
                              {completedPhases}/{job.phases.length} phases
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">Score: {Math.round(opp.qualificationScore * 100)}%</p>
                        {job && <p className="text-xs text-slate-500">Audit: {job.status}</p>}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-4">
                      {/* Call Controls */}
                      {(() => {
                        const oppStatusUpper = typeof opp.status === "string" ? opp.status.toUpperCase() : "";
                        const isReady = oppStatusUpper === "READY";
                        const hasCredits = atlasCreditsBalance >= 1;

                        if (isReady && agencyProfile) {
                          return (
                            <div className="flex items-center gap-4">
                              <button
                                onClick={async () => {
                                  setStartingCallOppId(opp._id);
                                  setCallErrorByOpp((prev) => {
                                    const next = { ...prev };
                                    delete next[oppKey];
                                    return next;
                                  });
                                  try {
                                    const result = await startVapiCall({
                                      opportunityId: opp._id,
                                      agencyId: agencyProfile.agencyProfileId,
                                    });
                                    // Navigate to the call workspace
                                    router.push(`/dashboard/calls/${result.callId}`);
                                  } catch (err) {
                                    console.error("Start call failed", err);
                                    const message = err instanceof Error ? err.message : "Failed to start call";
                                    setCallErrorByOpp((prev) => ({ ...prev, [oppKey]: message }));
                                  } finally {
                                    setStartingCallOppId(null);
                                  }
                                }}
                                disabled={startingCallOppId === opp._id || !hasCredits}
                                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md"
                              >
                                {startingCallOppId === opp._id ? "Starting call..." : "Start Call"}
                              </button>
                              {!hasCredits && (
                                <p className="text-sm text-orange-600">Need at least 1 credit to start a call.</p>
                              )}
                              {callErrorByOpp[oppKey] && (
                                <p className="text-sm text-red-600">{callErrorByOpp[oppKey]}</p>
                              )}
                            </div>
                          );
                        }

                        return null;
                      })()}

                      {/* Fit Reason */}
                      {opp.fit_reason && (
                        <div>
                          <h4 className="font-medium mb-2">Why This Lead Fits</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-300 p-3 bg-white dark:bg-slate-800 rounded-md">
                            {opp.fit_reason}
                          </p>
                        </div>
                      )}

                      {/* Dossier */}
                      {job?.dossierId && (
                        <div>
                          <h4 className="font-medium mb-2">Research Dossier</h4>
                          {dossier ? (
                            <div className="space-y-3 text-sm">
                              {dossier.summary && (
                                <div className="p-3 bg-white dark:bg-slate-800 rounded-md">
                                  <h5 className="font-medium mb-1">Summary</h5>
                                  <p className="text-slate-600 dark:text-slate-300">{dossier.summary}</p>
                                </div>
                              )}

                              {dossier.identified_gaps.length > 0 && (
                                <div className="p-3 bg-white dark:bg-slate-800 rounded-md">
                                  <h5 className="font-medium mb-2">Identified Opportunities</h5>
                                  <ul className="space-y-2">
                                    {dossier.identified_gaps.map((gap, idx) => (
                                      <li key={`gap-${idx}`} className="flex justify-between">
                                        <span className="font-medium">{gap.key}:</span>
                                        <span className="text-slate-600 dark:text-slate-300">{gap.value}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {dossier.talking_points.length > 0 && (
                                <div className="p-3 bg-white dark:bg-slate-800 rounded-md">
                                  <h5 className="font-medium mb-2">Talking Points</h5>
                                  <ul className="list-disc ml-4 space-y-1">
                                    {dossier.talking_points.map((point, idx) => (
                                      <li key={`tp-${idx}`} className="text-slate-600 dark:text-slate-300">
                                        {point.text}
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

                      {/* Sources Toggle */}
                      {job && (
                        <div>
                          <button
                            onClick={() => setViewSourcesForAuditId(
                              viewSourcesForAuditId === job._id ? null : job._id
                            )}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {viewSourcesForAuditId === job._id ? "Hide sources" : "View scraped sources"}
                          </button>

                          {viewSourcesForAuditId === job._id && (
                            <div className="mt-3 space-y-2">
                              {scrapedPages ? (
                                scrapedPages.length > 0 ? (
                                  scrapedPages.map((page, idx) => (
                                    <div
                                      key={`scrape-${idx}`}
                                      className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md"
                                    >
                                      <p className="font-medium text-sm">{page.title || page.url}</p>
                                      <p className="text-xs text-slate-500">{page.url}</p>
                                      {page.contentUrl && (
                                        <a
                                          href={page.contentUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                                        >
                                          Download content →
                                        </a>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-xs text-slate-500">No scraped pages recorded.</p>
                                )
                              ) : (
                                <p className="text-xs text-slate-500">Loading sources...</p>
                              )}
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

      {/* Paywall Dialog */}
      <PaywallDialog
        open={paywallOpen}
        onOpenChange={(open) => {
          setPaywallOpen(open);
          if (!open) {
            setPaywallDismissed(true);
          }
        }}
        billingBlock={billingBlock}
        onResume={async () => {
          try {
            const result = await resumeWorkflow({ leadGenFlowId: flowId });
            return { ok: result.success, message: result.message };
          } catch (error) {
            console.error("Resume workflow error:", error);
            return { ok: false, message: "Failed to resume workflow" };
          }
        }}
        onRefetchCustomer={async () => {
          await refetchCustomer();
        }}
      />
    </div>
  );
}

// Helper Components
type StatusBadgeProps = {
  status: string;
  size?: "normal" | "large";
};

function StatusBadge({ status, size = "normal" }: StatusBadgeProps) {
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

  const sizeClass = size === "large" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span className={`inline-flex items-center rounded-full ${sizeClass} ${getStatusColor(status)}`}>
      {status?.replace(/_/g, " ") || "Unknown"}
    </span>
  );
}

type OpportunityStatusBadgeProps = {
  status: string;
};

function OpportunityStatusBadge({ status }: OpportunityStatusBadgeProps) {
  const getStatusColor = (status: string) => {
    const upper = status?.toUpperCase();
    switch (upper) {
      case "READY":
        return "bg-emerald-100 text-emerald-700";
      case "BOOKED":
        return "bg-green-100 text-green-700";
      case "REJECTED":
        return "bg-red-100 text-red-700";
      case "PENDING":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${getStatusColor(status)}`}>
      {status || "Unknown"}
    </span>
  );
}

type SummaryCardProps = {
  label: string;
  value: number;
};

function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
