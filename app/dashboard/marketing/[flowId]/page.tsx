"use client";

import { useQuery, useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { use, useState, useEffect, useMemo, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCustomer } from "autumn-js/react";
import PaywallDialog from "@/components/autumn/paywall-dialog";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  Phone, 
  Sparkles, 
  FileText, 
  ExternalLink,
  Globe,
  AlertCircle,
  CheckCircle,
  Clock,
  Target,
  Zap,
  TrendingUp,
  PlayCircle
} from "lucide-react";

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

  // Show loading skeleton while data is loading
  if (leadGenJob === undefined) {
    return <PageLoadingSkeleton />;
  }

  // Show not found state
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
            <Button asChild variant="default">
              <Link href="/dashboard/marketing" className="inline-flex items-center gap-2">
                ← Back to Marketing
              </Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full p-6 md:p-8 flex flex-col gap-6">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Compact Header */}
        <div className="card-warm-static p-6 md:p-8">
          <Link
            href="/dashboard/marketing"
            className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 mb-4"
          >
            ← Back to Campaigns
          </Link>
          <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
            <div className="flex-1">
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
            {/* Key Stats */}
            {leadGenCounts ? (
              <div className="flex gap-3 w-full lg:w-auto">
                <div className="stat-card-primary p-5 flex-1 lg:flex-initial lg:w-40">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Total Leads
                  </p>
                  <p className="text-3xl font-bold text-foreground">{leadGenCounts.totalOpportunities}</p>
                </div>
                <div className="stat-card-primary p-5 flex-1 lg:flex-initial lg:w-40">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Ready to Call
                  </p>
                  <p className="text-3xl font-bold text-foreground">{leadGenCounts.readyOpportunities}</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <Skeleton className="h-24 w-40" />
                <Skeleton className="h-24 w-40" />
              </div>
            )}
          </div>
        </div>

        {/* Paused Status Banner */}
        {leadGenJob.status === "paused_for_upgrade" && billingBlock && (
          <Alert variant="default" className="border-2 border-primary/40 bg-accent/30">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="text-lg font-bold flex items-center gap-2">
              <span>⏸️</span>
              Campaign Paused
            </AlertTitle>
            <AlertDescription className="mt-2">
              <div className="flex items-start justify-between gap-6 flex-col sm:flex-row">
                <div className="flex-1">
                  <p className="text-sm mb-1">
                    Insufficient credits for <span className="font-semibold">{billingBlock.featureId.replace("_", " ")}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Phase: {billingBlock.phase.replace("_", " ")}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setPaywallDismissed(false);
                    setPaywallOpen(true);
                  }}
                  className="whitespace-nowrap"
                  aria-label="Upgrade to resume campaign"
                >
                  Upgrade Now
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Campaign Progress - Accordion */}
        <Accordion type="single" collapsible defaultValue="progress">
          <AccordionItem value="progress" className="card-warm-static border-0">
            <AccordionTrigger className="px-6 py-4 hover:no-underline [&[data-state=closed]]:pb-6">
              <div className="flex flex-col w-full pr-4 gap-3">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <span className="text-xl font-bold text-foreground">Campaign Progress</span>
                  </div>
                  {typeof leadGenProgress === "number" && (
                    <div className="text-right">
                      <span className="text-xl font-bold text-primary">{Math.round(leadGenProgress * 100)}%</span>
                    </div>
                  )}
                </div>
                {/* Show when collapsed */}
                <div className="[&[data-state=open]]:hidden w-full space-y-3">
                  {typeof leadGenProgress === "number" && (
                    <Progress value={Math.round(leadGenProgress * 100)} className="h-2" />
                  )}
                  {leadGenJob.lastEvent && (
                    <div className="flex items-start gap-2 text-left">
                      <Zap className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted-foreground truncate">
                          {leadGenJob.lastEvent.message}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              {/* Workflow Steps */}
              <div className="space-y-3">
                {leadGenJob.phases.map((phase, index) => {
                  const phaseIcon = PHASE_ICONS[phase.name as keyof typeof PHASE_ICONS] ?? "📋";
                  const isRunning = phase.status === "running";
                  const isComplete = phase.status === "complete";
                  const isError = phase.status === "error";
                  const isPaused = leadGenJob.status === "paused_for_upgrade" && phase.name === billingBlock?.phase;
                  const isActive = isRunning || isPaused;

                  return (
                    <div key={phase.name}>
                      {/* Connector Line */}
                      {index > 0 && (
                        <div className="flex items-center gap-4 pl-4 pb-2">
                          <div className={`w-0.5 h-6 ${
                            isComplete || leadGenJob.phases[index - 1].status === "complete" 
                              ? "bg-[hsl(var(--success))]" 
                              : "bg-border"
                          }`} />
                        </div>
                      )}
                      
                      {/* Step Card */}
                      <div className={`rounded-lg border-2 transition-all ${
                        isActive 
                          ? "bg-primary/5 border-primary/40 shadow-lg shadow-primary/10" 
                          : isComplete
                          ? "bg-[hsl(var(--success))]/5 border-[hsl(var(--success))]/30"
                          : isError
                          ? "bg-destructive/5 border-destructive/30"
                          : "bg-surface-overlay/30 border-border/40"
                      }`}>
                        <div className={`p-4 ${
                          isActive ? "pb-4" : ""
                        }`}>
                          <div className="flex items-center gap-4">
                            {/* Icon */}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                              isComplete ? "bg-[hsl(var(--success))] text-white" :
                              isActive ? "bg-primary text-white animate-pulse" :
                              isError ? "bg-destructive text-white" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {isComplete ? "✓" : phaseIcon}
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-base text-foreground">
                                  {PHASE_LABELS[phase.name as keyof typeof PHASE_LABELS] ?? phase.name.replace(/_/g, " ")}
                                </h3>
                                {isRunning && (
                                  <Badge className="bg-primary/20 text-primary border-primary/30">
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    Running
                                  </Badge>
                                )}
                                {isPaused && (
                                  <Badge variant="secondary" className="bg-accent/60">
                                    <Clock className="mr-1 h-3 w-3" />
                                    Paused
                                  </Badge>
                                )}
                                {isComplete && (
                                  <Badge className="bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border-[hsl(var(--success))]/30">
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    Complete
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Progress Bar for Active Steps */}
                              {isActive && (
                                <div className="flex items-center gap-3 mt-3">
                                  <Progress 
                                    value={Math.round(phase.progress * 100)} 
                                    className="h-2.5 flex-1 [&>div]:bg-primary"
                                  />
                                  <span className="text-sm font-bold text-primary tabular-nums whitespace-nowrap">
                                    {Math.round(phase.progress * 100)}%
                                  </span>
                                </div>
                              )}
                              
                              {/* Minimized Progress for Non-Active */}
                              {!isActive && !isComplete && (
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                                    <div 
                                      className="h-full bg-border transition-all"
                                      style={{ width: `${Math.round(phase.progress * 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground tabular-nums">
                                    {Math.round(phase.progress * 100)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Error Message */}
                          {isError && phase.errorMessage && (
                            <Alert variant="destructive" className="mt-3">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription className="text-sm">
                                {phase.errorMessage}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Last Event */}
              {leadGenJob.lastEvent && (
                <div className="mt-6 p-4 rounded-lg bg-accent/20 border border-primary/20">
                  <div className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground mb-1">
                        Latest Activity
                      </p>
                      <p className="text-sm text-muted-foreground mb-2">
                        {leadGenJob.lastEvent.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(leadGenJob.lastEvent.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Opportunities - Main Focus */}
        {opportunities === undefined ? (
          <div className="card-warm-static p-6 md:p-8">
            <Skeleton className="h-8 w-64 mb-6" />
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          </div>
        ) : opportunities && opportunities.length > 0 ? (
          <div className="card-warm-static p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <PlayCircle className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                Opportunities 
                <Badge variant="secondary" className="text-base">{opportunities.length}</Badge>
              </h2>
            </div>
            <div className="space-y-4">
            {opportunities.map((opp) => {
              const job = auditJobMap.get(opp._id);
              const completedPhases = job?.phases.filter((phase: { status: string }) => phase.status === "complete").length ?? 0;
              const phaseProgress = job ? Math.round((completedPhases / job.phases.length) * 100) : 0;
              const isExpanded = expandedOpportunityId === opp._id;
              const oppKey = String(opp._id);
              const oppStatusUpper = typeof opp.status === "string" ? opp.status.toUpperCase() : "";
              const isReadyStatus = ["READY", "BOOKED", "COMPLETE"].includes(oppStatusUpper);

              return (
                <div
                  key={opp._id}
                  className={`rounded-lg overflow-hidden border-2 transition-all duration-200 opp-card-gradient ${
                    isReadyStatus
                      ? "border-[hsl(var(--primary))]/40 hover:border-[hsl(var(--primary))]/60 hover:shadow-lg hover:shadow-[hsl(var(--primary))]/10"
                      : "border-border/60 hover:border-border"
                  }`}
                >
                  <Button
                    variant="ghost"
                    onClick={() => setExpandedOpportunityId(isExpanded ? null : opp._id)}
                    className="w-full text-left p-5 hover:bg-transparent transition-colors h-auto justify-start"
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details for ${opp.name}`}
                  >
                    <div className="flex justify-between items-start gap-4 flex-col sm:flex-row w-full">
                      <div className="flex-1 w-full">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <h3 className="font-bold text-lg text-foreground">{opp.name}</h3>
                          <OpportunityStatusBadge status={opp.status} />
                          {isExpanded ? <ChevronUp className="h-5 w-5 ml-auto text-muted-foreground" /> : <ChevronDown className="h-5 w-5 ml-auto text-muted-foreground" />}
                        </div>
                        {opp.domain && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="text-sm text-muted-foreground mb-3 flex items-center gap-2 cursor-help">
                                  <Globe className="h-4 w-4 flex-shrink-0" />
                                  <span className="font-mono truncate max-w-[300px]">{opp.domain}</span>
                                </p>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{opp.domain}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {opp.signals.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {opp.signals.map((signal) => (
                              <Badge 
                                key={signal}
                                variant="outline"
                                className="bg-[hsl(var(--primary))]/10 border-[hsl(var(--primary))]/30 text-[hsl(var(--primary))]"
                              >
                                <Target className="mr-1 h-3 w-3" />
                                {signal.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {job && (
                          <div className="flex items-center gap-3">
                            <Progress value={phaseProgress} className="h-2.5 flex-1 [&>div]:bg-[hsl(var(--success))]" />
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-muted-foreground font-semibold tabular-nums whitespace-nowrap cursor-help">
                                    {completedPhases}/{job.phases.length} phases
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Audit progress: {phaseProgress}% complete</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        )}
                      </div>
                    </div>
                  </Button>

                  {isExpanded && (
                    <div className="border-t-2 border-border/40 p-5 md:p-6 space-y-5">
                      {/* Call Controls */}
                      {(() => {
                        const oppStatusUpper = typeof opp.status === "string" ? opp.status.toUpperCase() : "";
                        const isReady = oppStatusUpper === "READY";
                        const hasCredits = atlasCreditsBalance >= 1;

                        if (isReady && agencyProfile) {
                          return (
                            <div className="p-5 md:p-6 rounded-xl bg-gradient-to-br from-[hsl(var(--success))]/10 via-[hsl(var(--success))]/5 to-transparent border-2 border-[hsl(var(--success))]/30">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-5">
                                <div className="flex items-center gap-3 flex-1">
                                  <div className="w-12 h-12 rounded-xl bg-[hsl(var(--success))] flex items-center justify-center shadow-lg shadow-[hsl(var(--success))]/20">
                                    <Phone className="h-6 w-6 text-white" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-bold text-foreground text-lg mb-0.5">Ready to Call</h4>
                                    <p className="text-sm text-muted-foreground">All research complete • Dossier ready</p>
                                  </div>
                                </div>
                                <CheckCircle className="h-7 w-7 text-[hsl(var(--success))] hidden sm:block" />
                              </div>
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                <Button
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
                                  className="bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white font-semibold px-6 py-2.5 rounded-lg transition-all hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-[hsl(var(--success))]/20"
                                  aria-label="Start AI call"
                                >
                                  {startingCallOppId === opp._id ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Starting call...
                                    </>
                                  ) : (
                                    <>
                                      <Phone className="mr-2 h-5 w-5" />
                                      Start Call
                                    </>
                                  )}
                                </Button>
                                {!hasCredits && (
                                  <Alert variant="destructive" className="flex-1">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription className="text-sm">
                                      Need at least 1 credit to start a call
                                    </AlertDescription>
                                  </Alert>
                                )}
                                {callErrorByOpp[oppKey] && (
                                  <Alert variant="destructive" className="flex-1">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription className="text-sm">
                                      {callErrorByOpp[oppKey]}
                                    </AlertDescription>
                                  </Alert>
                                )}
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })()}

                      {/* Fit Reason */}
                      {opp.fit_reason && (
                        <div className="p-5 md:p-6 rounded-xl bg-gradient-to-br from-accent/40 to-accent/20 border border-border/30">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-accent/60 flex items-center justify-center">
                              <Sparkles className="h-4 w-4 text-foreground" />
                            </div>
                            <h4 className="font-bold text-foreground text-base">Why This Lead Fits</h4>
                          </div>
                          <p className="text-sm text-foreground/90 leading-relaxed">
                            {opp.fit_reason}
                          </p>
                        </div>
                      )}

                      {/* Dossier */}
                      {job?.dossierId && (
                        <div className="rounded-xl bg-gradient-to-br from-accent/30 via-surface-raised to-surface-overlay border border-border/40 overflow-hidden shadow-sm">
                          <div className="p-5 md:p-6 bg-gradient-to-r from-accent/20 to-transparent border-b border-border/30">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-accent/50 flex items-center justify-center">
                                <FileText className="h-5 w-5 text-foreground" />
                              </div>
                              <div>
                                <h4 className="font-bold text-foreground text-lg">Research Dossier</h4>
                                <p className="text-xs text-muted-foreground">AI-generated insights & opportunities</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-5 md:p-6">
                            {dossier ? (
                              <Accordion type="single" collapsible className="w-full space-y-3">
                                {dossier.summary && (
                                  <AccordionItem value="summary" className="border-none">
                                    <AccordionTrigger className="text-sm font-semibold hover:no-underline p-4 rounded-lg bg-surface-raised/70 border border-border/30 hover:border-accent transition-colors [&[data-state=open]]:border-accent [&[data-state=open]]:bg-accent/20">
                                      <div className="flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 text-foreground" />
                                        Summary
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-4 pb-2">
                                      <div className="p-4 rounded-lg bg-accent/10 border border-border/20">
                                        <p className="text-sm text-foreground leading-relaxed">{dossier.summary}</p>
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                )}

                                {dossier.identified_gaps.length > 0 && (
                                  <AccordionItem value="opportunities" className="border-none">
                                    <AccordionTrigger className="text-sm font-semibold hover:no-underline p-4 rounded-lg bg-surface-raised/70 border border-border/30 hover:border-accent transition-colors [&[data-state=open]]:border-accent [&[data-state=open]]:bg-accent/20">
                                      <div className="flex items-center gap-2">
                                        <Target className="h-4 w-4 text-foreground" />
                                        Identified Opportunities
                                        <Badge variant="secondary" className="ml-2 bg-accent/40 text-foreground border-border/30">
                                          {dossier.identified_gaps.length}
                                        </Badge>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-4 pb-2">
                                      <div className="space-y-2">
                                        {dossier.identified_gaps.map((gap, idx) => (
                                          <div 
                                            key={`gap-${idx}`} 
                                            className="p-3 md:p-4 rounded-lg bg-gradient-to-r from-accent/20 to-surface-raised border border-border/30 hover:border-accent hover:bg-accent/10 transition-all"
                                          >
                                            <div className="flex flex-col gap-1.5">
                                              <span className="font-semibold text-sm text-foreground">{gap.key}</span>
                                              <span className="text-sm text-muted-foreground pl-0.5">{gap.value}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                )}

                                {dossier.talking_points.length > 0 && (
                                  <AccordionItem value="talking-points" className="border-none">
                                    <AccordionTrigger className="text-sm font-semibold hover:no-underline p-4 rounded-lg bg-surface-raised/70 border border-border/30 hover:border-accent transition-colors [&[data-state=open]]:border-accent [&[data-state=open]]:bg-accent/20">
                                      <div className="flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-foreground" />
                                        Talking Points
                                        <Badge variant="secondary" className="ml-2 bg-accent/40 text-foreground border-border/30">
                                          {dossier.talking_points.length}
                                        </Badge>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-4 pb-2">
                                      <div className="space-y-2">
                                        {dossier.talking_points.map((point, idx) => (
                                          <div 
                                            key={`tp-${idx}`} 
                                            className="flex items-start gap-3 p-3 rounded-lg bg-accent/10 border border-border/20 hover:bg-accent/15 transition-colors"
                                          >
                                            <div className="w-6 h-6 rounded-full bg-accent/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                              <CheckCircle className="h-3.5 w-3.5 text-foreground" />
                                            </div>
                                            <span className="text-sm text-foreground flex-1">{point.text}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                )}
                              </Accordion>
                            ) : (
                              <div className="space-y-3">
                                <Skeleton className="h-14" />
                                <Skeleton className="h-14" />
                                <Skeleton className="h-14" />
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Sources Toggle */}
                      {job && (
                        <div className="rounded-xl bg-surface-raised/70 border border-border/40 overflow-hidden shadow-sm">
                          <Button
                            variant="ghost"
                            onClick={() => setViewSourcesForAuditId(
                              viewSourcesForAuditId === job._id ? null : job._id
                            )}
                            className="w-full text-sm font-semibold text-foreground hover:bg-accent/30 transition-all flex items-center justify-between p-4 md:p-5 h-auto rounded-none"
                            aria-expanded={viewSourcesForAuditId === job._id}
                            aria-label={viewSourcesForAuditId === job._id ? "Hide scraped sources" : "View scraped sources"}
                          >
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-accent/50 flex items-center justify-center">
                                  <Globe className="h-4 w-4 text-foreground" />
                                </div>
                                <div className="text-left">
                                  <div className="font-bold text-base">Scraped Sources</div>
                                  <div className="text-xs text-muted-foreground font-normal">
                                    {scrapedPages ? `${scrapedPages.length} page${scrapedPages.length !== 1 ? 's' : ''} analyzed` : 'Loading...'}
                                  </div>
                                </div>
                              </div>
                            {viewSourcesForAuditId === job._id ? 
                              <ChevronUp className="h-5 w-5 text-muted-foreground" /> : 
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            }
                          </Button>

                          {viewSourcesForAuditId === job._id && (
                            <div className="border-t border-border/30 p-4 md:p-5 bg-accent/5">
                              {scrapedPages ? (
                                scrapedPages.length > 0 ? (
                                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2 hide-scrollbar">
                                    {scrapedPages.map((page, idx) => (
                                      <div
                                        key={`scrape-${idx}`}
                                        className="group p-4 bg-surface-raised border border-border/30 rounded-lg hover:border-accent hover:bg-accent/10 transition-all"
                                      >
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                          <p className="font-semibold text-sm text-foreground flex-1">
                                            {page.title || "Untitled Page"}
                                          </p>
                                          {page.contentUrl && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              asChild
                                              className="h-7 px-3 text-xs font-medium bg-accent/50 hover:bg-accent text-foreground transition-all opacity-0 group-hover:opacity-100"
                                            >
                                              <a
                                                href={page.contentUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label="View page content"
                                              >
                                                <ExternalLink className="h-3 w-3 mr-1" />
                                                View
                                              </a>
                                            </Button>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                          <p className="text-xs text-muted-foreground font-mono truncate">
                                            {page.url}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-8">
                                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                                      <FileText className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm font-medium text-foreground mb-1">No Sources Found</p>
                                    <p className="text-xs text-muted-foreground">No pages were scraped for this opportunity</p>
                                  </div>
                                )
                              ) : (
                                <div className="space-y-3">
                                  <Skeleton className="h-20" />
                                  <Skeleton className="h-20" />
                                  <Skeleton className="h-20" />
                                </div>
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
        ) : (
          <div className="card-warm-static p-8 md:p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-bold text-foreground mb-2">No Opportunities Yet</h3>
            <p className="text-muted-foreground mb-6">
              Opportunities will appear here as the campaign progresses.
            </p>
            <Badge variant="outline" className="text-sm">
              <Clock className="mr-2 h-3 w-3" />
              Campaign is still discovering leads
            </Badge>
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
function PageLoadingSkeleton() {
  return (
    <main className="min-h-full p-6 md:p-8 flex flex-col gap-6">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        {/* Header Skeleton */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="mb-8">
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-6 w-48 mb-4" />
            <div className="flex gap-3">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-32" />
            </div>
          </div>
          <Separator className="my-6" />
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>

        {/* Progress Skeleton */}
        <div className="card-warm-static p-6 md:p-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-3 w-full mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>

        {/* Opportunities Skeleton */}
        <div className="card-warm-static p-6 md:p-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

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
      case "complete":
        return "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] border-[hsl(var(--success))] font-semibold";
      case "paused_for_upgrade":
        return "bg-accent/60 text-accent-foreground border-accent-foreground/20";
      case "failed":
      case "error":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "running":
        return <Loader2 className="mr-1 h-3 w-3 animate-spin" />;
      case "completed":
      case "complete":
        return <CheckCircle className="mr-1 h-3 w-3" />;
      case "paused_for_upgrade":
        return <Clock className="mr-1 h-3 w-3" />;
      case "failed":
      case "error":
        return <AlertCircle className="mr-1 h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <Badge 
      className={`${getStatusStyles(status)} ${size === "large" ? "px-3 py-1.5 text-sm" : "text-xs"}`}
    >
      {getStatusIcon(status)}
      {status?.replace(/_/g, " ") || "Unknown"}
    </Badge>
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
        return "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] border-[hsl(var(--success))] font-semibold";
      case "BOOKED":
        return "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] border-[hsl(var(--success))] font-semibold";
      case "COMPLETE":
        return "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] border-[hsl(var(--success))] font-semibold";
      case "REJECTED":
        return "bg-destructive/20 text-destructive border-destructive/30";
      case "PENDING":
        return "bg-primary/20 text-primary border-primary/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getStatusIcon = (status: string) => {
    const upper = status?.toUpperCase();
    switch (upper) {
      case "READY":
        return <CheckCircle className="mr-1 h-3 w-3" />;
      case "BOOKED":
        return <CheckCircle className="mr-1 h-3 w-3" />;
      case "REJECTED":
        return <AlertCircle className="mr-1 h-3 w-3" />;
      case "PENDING":
        return <Clock className="mr-1 h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <Badge className={getStatusStyles(status)}>
      {getStatusIcon(status)}
      {status || "Unknown"}
    </Badge>
  );
}

