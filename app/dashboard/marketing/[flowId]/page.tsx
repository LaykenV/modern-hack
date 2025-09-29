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

const PHASE_ICONS = {
  scrape_content: "🔍",
  generate_dossier: "📊",
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
      <main className="min-h-full p-6 md:p-8 flex flex-col gap-6">
        <div className="max-w-6xl mx-auto w-full">
          <div className="card-warm-static p-8 md:p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h1 className="text-3xl font-bold text-foreground mb-3">Campaign Not Found</h1>
            <p className="text-muted-foreground mb-6 text-lg">
              The campaign you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
            </p>
            <Link href="/dashboard/marketing" className="btn-contrast inline-flex items-center gap-2">
              ← Back to Marketing
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full p-6 md:p-8 flex flex-col gap-6">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        {/* Header with Summary */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex items-start justify-between gap-6 flex-col md:flex-row mb-8">
            <div className="flex-1">
              <Link
                href="/dashboard/marketing"
                className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 mb-4"
              >
                ← Back to Campaigns
              </Link>
              <h1 className="text-4xl font-bold text-foreground tracking-tight mb-2">
                {leadGenJob.campaign.targetVertical}
              </h1>
              <p className="text-lg text-muted-foreground mb-4">
                Targeting {leadGenJob.campaign.targetGeography}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={leadGenJob.status} size="large" />
                <span className="text-sm text-muted-foreground">
                  {leadGenJob.numLeadsFetched}/{leadGenJob.numLeadsRequested} leads discovered
                </span>
              </div>
            </div>
          </div>

          {/* Campaign Summary */}
          {leadGenCounts && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Campaign Summary</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                <SummaryStatCard
                  label="Total Leads"
                  value={leadGenCounts.totalOpportunities}
                  variant="primary"
                />
                <SummaryStatCard
                  label="With Websites"
                  value={leadGenCounts.opportunitiesWithWebsites}
                  variant="accent"
                />
                <SummaryStatCard
                  label="No Websites"
                  value={leadGenCounts.opportunitiesWithoutWebsites}
                  variant="accent"
                />
                <SummaryStatCard
                  label="Ready to Call"
                  value={leadGenCounts.readyOpportunities}
                  variant="primary"
                />
                <SummaryStatCard
                  label="Queued Audits"
                  value={leadGenCounts.queuedAudits}
                  variant="accent"
                />
                <SummaryStatCard
                  label="Running Audits"
                  value={leadGenCounts.runningAudits}
                  variant="accent"
                />
                <SummaryStatCard
                  label="Completed Audits"
                  value={leadGenCounts.completedAudits}
                  variant="accent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Paused Status Banner */}
        {leadGenJob.status === "paused_for_upgrade" && billingBlock && (
          <div className="card-warm-accent p-6 md:p-8 border-2 border-primary/40">
            <div className="flex items-start justify-between gap-6 flex-col sm:flex-row">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">⏸️</span>
                  <h3 className="text-lg font-bold text-foreground">Campaign Paused</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-1">
                  Insufficient credits for <span className="font-semibold">{billingBlock.featureId.replace("_", " ")}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Phase: {billingBlock.phase.replace("_", " ")}
                </p>
              </div>
              <button
                onClick={() => {
                  setPaywallDismissed(false);
                  setPaywallOpen(true);
                }}
                className="btn-contrast whitespace-nowrap"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        )}

        {/* Phase Progress */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">Campaign Progress</h2>
            {typeof leadGenProgress === "number" && (
              <div className="text-right">
                <span className="text-2xl font-bold text-foreground">{Math.round(leadGenProgress * 100)}%</span>
                <p className="text-xs text-muted-foreground">Complete</p>
              </div>
            )}
          </div>
          
          {/* Overall Progress Bar */}
          {typeof leadGenProgress === "number" && (
            <div className="mb-6">
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-3 rounded-full transition-all duration-500 relative overflow-hidden"
                  style={{ 
                    width: `${Math.round(leadGenProgress * 100)}%`,
                    backgroundImage: 'linear-gradient(90deg, hsl(var(--primary) / 0.95) 0%, hsl(var(--primary) / 0.85) 60%, hsl(var(--accent) / 0.70) 100%)'
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                </div>
              </div>
            </div>
          )}

          {/* Phase Details - Horizontal Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {leadGenJob.phases.map((phase) => {
              const phaseIcon = PHASE_ICONS[phase.name as keyof typeof PHASE_ICONS] ?? "📋";
              const isRunning = phase.status === "running";
              const isComplete = phase.status === "complete";
              const isError = phase.status === "error";
              const isPaused = leadGenJob.status === "paused_for_upgrade" && phase.name === billingBlock?.phase;

              return (
                <div key={phase.name} className="p-4 rounded-lg bg-surface-overlay/50 border border-border/40">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${
                      isComplete ? "bg-success/20 border-2 border-success/50" :
                      isRunning ? "bg-primary/20 border-2 border-primary/50 animate-pulse" :
                      isError ? "bg-destructive/20 border-2 border-destructive/50" :
                      isPaused ? "bg-accent/40 border-2 border-primary/40" :
                      "bg-muted border-2 border-border"
                    }`}>
                      {phaseIcon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-foreground truncate">
                        {PHASE_LABELS[phase.name as keyof typeof PHASE_LABELS] ?? phase.name.replace(/_/g, " ")}
                      </h3>
                    </div>
                    {isRunning && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
                        Running
                      </span>
                    )}
                    {isPaused && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-accent/60 text-accent-foreground border border-accent-foreground/20">
                        Paused
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          isComplete ? "bg-success" :
                          isError ? "bg-destructive" :
                          "bg-primary"
                        }`}
                        style={{ width: `${Math.round(phase.progress * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      {Math.round(phase.progress * 100)}%
                    </span>
                  </div>
                  {isError && phase.errorMessage && (
                    <p className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded-md mt-2">
                      {phase.errorMessage}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Last Event */}
          {leadGenJob.lastEvent && (
            <div className="mt-6 p-3 rounded-lg bg-accent/20 border border-border/50">
              <div className="flex items-start gap-2">
                <span className="text-base">⚡</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground mb-1">
                    {leadGenJob.lastEvent.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(leadGenJob.lastEvent.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Opportunities */}
        {opportunities && opportunities.length > 0 && (
          <div className="card-warm-static p-6 md:p-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">
              Opportunities <span className="text-muted-foreground">({opportunities.length})</span>
            </h2>
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
                  className="rounded-lg overflow-hidden border border-border/60 bg-surface-overlay/30 hover:border-border transition-all duration-200"
                >
                  <button
                    onClick={() => setExpandedOpportunityId(isExpanded ? null : opp._id)}
                    className="w-full text-left p-4 md:p-5 hover:bg-accent/10 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-4 flex-col sm:flex-row">
                      <div className="flex-1 w-full">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <h3 className="font-semibold text-lg text-foreground">{opp.name}</h3>
                          <OpportunityStatusBadge status={opp.status} />
                        </div>
                        {opp.domain && (
                          <p className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
                            <span>🌐</span>
                            <span className="font-mono">{opp.domain}</span>
                          </p>
                        )}
                        {opp.signals.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {opp.signals.map((signal) => (
                              <span
                                key={signal}
                                className="inline-flex items-center rounded-full bg-accent/40 text-accent-foreground px-2.5 py-1 text-xs font-medium border border-border/30"
                              >
                                {signal.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        )}
                        {job && (
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-2 bg-success rounded-full transition-all duration-300"
                                style={{ width: `${phaseProgress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground font-medium tabular-nums whitespace-nowrap">
                              {completedPhases}/{job.phases.length} phases
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Score</span>
                          <span className="text-lg font-bold text-primary">{Math.round(opp.qualificationScore * 100)}%</span>
                        </div>
                        {job && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Audit: <span className="font-medium">{job.status}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border/60 bg-accent/5 p-4 md:p-6 space-y-6">
                      {/* Call Controls */}
                      {(() => {
                        const oppStatusUpper = typeof opp.status === "string" ? opp.status.toUpperCase() : "";
                        const isReady = oppStatusUpper === "READY";
                        const hasCredits = atlasCreditsBalance >= 1;

                        if (isReady && agencyProfile) {
                          return (
                            <div className="p-4 rounded-lg bg-success/10 border border-success/30">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-xl">📞</span>
                                <h4 className="font-semibold text-foreground">Ready to Call</h4>
                              </div>
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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
                                  className="btn-contrast disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  {startingCallOppId === opp._id ? "Starting call..." : "🚀 Start Call"}
                                </button>
                                {!hasCredits && (
                                  <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                                    Need at least 1 credit to start a call
                                  </p>
                                )}
                                {callErrorByOpp[oppKey] && (
                                  <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                                    {callErrorByOpp[oppKey]}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })()}

                      {/* Fit Reason */}
                      {opp.fit_reason && (
                        <div className="p-4 rounded-lg bg-surface-raised border border-border/40">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xl">✨</span>
                            <h4 className="font-semibold text-foreground">Why This Lead Fits</h4>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {opp.fit_reason}
                          </p>
                        </div>
                      )}

                      {/* Dossier */}
                      {job?.dossierId && (
                        <div className="p-4 rounded-lg bg-surface-raised border border-border/40">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-xl">📋</span>
                            <h4 className="font-semibold text-foreground">Research Dossier</h4>
                          </div>
                          {dossier ? (
                            <div className="space-y-4">
                              {dossier.summary && (
                                <div className="p-3 bg-accent/10 rounded-md border border-border/30">
                                  <h5 className="font-medium text-foreground mb-2">Summary</h5>
                                  <p className="text-sm text-muted-foreground leading-relaxed">{dossier.summary}</p>
                                </div>
                              )}

                              {dossier.identified_gaps.length > 0 && (
                                <div className="p-3 bg-primary/5 rounded-md border border-primary/20">
                                  <h5 className="font-medium text-foreground mb-3">Identified Opportunities</h5>
                                  <ul className="space-y-2">
                                    {dossier.identified_gaps.map((gap, idx) => (
                                      <li key={`gap-${idx}`} className="flex flex-col sm:flex-row sm:justify-between gap-1 text-sm">
                                        <span className="font-semibold text-foreground">{gap.key}:</span>
                                        <span className="text-muted-foreground">{gap.value}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {dossier.talking_points.length > 0 && (
                                <div className="p-3 bg-accent/10 rounded-md border border-border/30">
                                  <h5 className="font-medium text-foreground mb-3">Talking Points</h5>
                                  <ul className="space-y-2">
                                    {dossier.talking_points.map((point, idx) => (
                                      <li key={`tp-${idx}`} className="flex items-start gap-2 text-sm">
                                        <span className="text-primary mt-0.5">•</span>
                                        <span className="text-muted-foreground">{point.text}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">Loading dossier...</p>
                          )}
                        </div>
                      )}

                      {/* Sources Toggle */}
                      {job && (
                        <div className="p-4 rounded-lg bg-surface-raised border border-border/40">
                          <button
                            onClick={() => setViewSourcesForAuditId(
                              viewSourcesForAuditId === job._id ? null : job._id
                            )}
                            className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-2"
                          >
                            <span>{viewSourcesForAuditId === job._id ? "▼" : "▶"}</span>
                            <span>{viewSourcesForAuditId === job._id ? "Hide Sources" : "View Scraped Sources"}</span>
                          </button>

                          {viewSourcesForAuditId === job._id && (
                            <div className="mt-4 space-y-3">
                              {scrapedPages ? (
                                scrapedPages.length > 0 ? (
                                  scrapedPages.map((page, idx) => (
                                    <div
                                      key={`scrape-${idx}`}
                                      className="p-3 bg-accent/10 border border-border/30 rounded-md hover:bg-accent/15 transition-colors"
                                    >
                                      <p className="font-medium text-sm text-foreground mb-1">
                                        {page.title || "Untitled Page"}
                                      </p>
                                      <p className="text-xs text-muted-foreground font-mono mb-2 break-all">
                                        {page.url}
                                      </p>
                                      {page.contentUrl && (
                                        <a
                                          href={page.contentUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
                                        >
                                          <span>Download content</span>
                                          <span>→</span>
                                        </a>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-muted-foreground text-center py-4">No scraped pages recorded</p>
                                )
                              ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">Loading sources...</p>
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
    </main>
  );
}

// Helper Components
type StatusBadgeProps = {
  status: string;
  size?: "normal" | "large";
};

function StatusBadge({ status, size = "normal" }: StatusBadgeProps) {
  const getStatusStyles = (status: string) => {
    switch (status?.toLowerCase()) {
      case "running":
        return "bg-primary/20 text-primary border-primary/30";
      case "completed":
        return "bg-success/20 text-success border-success/30";
      case "paused_for_upgrade":
        return "bg-accent/60 text-accent-foreground border-accent-foreground/20";
      case "failed":
      case "error":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const sizeClass = size === "large" ? "px-3 py-1.5 text-sm font-semibold" : "px-2.5 py-1 text-xs font-semibold";

  return (
    <span className={`inline-flex items-center rounded-full border ${sizeClass} ${getStatusStyles(status)}`}>
      {status?.replace(/_/g, " ") || "Unknown"}
    </span>
  );
}

type OpportunityStatusBadgeProps = {
  status: string;
};

function OpportunityStatusBadge({ status }: OpportunityStatusBadgeProps) {
  const getStatusStyles = (status: string) => {
    const upper = status?.toUpperCase();
    switch (upper) {
      case "READY":
        return "bg-success/20 text-success border-success/30";
      case "BOOKED":
        return "bg-success/30 text-success border-success/40";
      case "REJECTED":
        return "bg-destructive/20 text-destructive border-destructive/30";
      case "PENDING":
        return "bg-primary/20 text-primary border-primary/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${getStatusStyles(status)}`}>
      {status || "Unknown"}
    </span>
  );
}

type SummaryStatCardProps = {
  label: string;
  value: number;
  variant: "primary" | "accent";
};

function SummaryStatCard({ label, value, variant }: SummaryStatCardProps) {
  const cardClass = variant === "primary" ? "stat-card-primary" : "stat-card-accent";
  
  return (
    <div className={`${cardClass} p-5`}>
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        {label}
      </p>
      <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}
