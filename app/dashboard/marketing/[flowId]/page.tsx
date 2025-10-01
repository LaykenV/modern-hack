"use client";

import { useQuery, useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { use, useState, useEffect, useMemo, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCustomer } from "autumn-js/react";
import PaywallDialog from "@/components/autumn/paywall-dialog";
import DemoCallModal from "./components/DemoCallModal";
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
  PlayCircle,
  Activity,
  ArrowRight,
  Search,
  FileSearch,
  Database,
  Workflow,
  Pause,
  CircleAlert
} from "lucide-react";

type Props = {
  params: Promise<{ flowId: string }>;
};

const PHASE_LABELS = {
  scrape_content: "Preparing Scrapes",
  generate_dossier: "Scrape Content & Generate Dossier",
} as const;

const PHASE_ICONS = {
  scrape_content: Search,
  generate_dossier: FileSearch,
} as const;

// Audit job phase labels for individual opportunities
const AUDIT_PHASE_LABELS = {
  map_urls: "Crawling",
  filter_urls: "Filtering URLs",
  scrape_content: "Scraping",
  generate_dossier: "Auditing",
} as const;

// Helper function to get the current running phase from an audit job
function getCurrentAuditPhase(job: { status: string; phases: Array<{ name: string; status: string }> }) {
  if (job.status !== "running") return null;
  
  const runningPhase = job.phases.find(p => p.status === "running");
  if (!runningPhase) return null;
  
  return runningPhase.name as keyof typeof AUDIT_PHASE_LABELS;
}

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
  const [demoCallModalOpen, setDemoCallModalOpen] = useState(false);
  const [demoCallOpportunityId, setDemoCallOpportunityId] = useState<Id<"client_opportunities"> | null>(null);
  const [workflowExpanded, setWorkflowExpanded] = useState<boolean | null>(null);
  const billingBlockKeyRef = useRef<string | null>(null);

  // Data queries
  const user = useQuery(api.auth.getCurrentUser);
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
    selectedAuditJob?._id ? { auditJobId: selectedAuditJob._id } : "skip"
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

  // Auto-expand workflow section based on status
  useEffect(() => {
    if (leadGenJob && workflowExpanded === null) {
      // Default to open if running, closed if completed
      const isRunning = leadGenJob.status === "running";
      setWorkflowExpanded(isRunning);
    }
    // Auto-collapse when workflow completes
    if (leadGenJob && leadGenJob.status === "completed" && workflowExpanded === true) {
      setWorkflowExpanded(false);
    }
  }, [leadGenJob, workflowExpanded]);

  // Show loading skeleton while data is loading
  if (leadGenJob === undefined) {
    return <PageLoadingSkeleton />;
  }

  // Show not found state
  if (!leadGenJob) {
    return (
      <main className="min-h-full p-6 md:p-8 flex flex-col gap-6">
        <div className="max-w-6xl mx-auto w-full">
          <div className="card-warm-static p-8 md:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--destructive))]/5 via-transparent to-[hsl(var(--destructive))]/5 -z-10" />
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[hsl(var(--destructive))]/20 to-[hsl(var(--destructive))]/10 flex items-center justify-center mx-auto mb-6 shadow-lg border-2 border-[hsl(var(--destructive))]/30">
              <CircleAlert className="h-12 w-12 text-destructive" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-3">Campaign Not Found</h1>
            <p className="text-muted-foreground mb-6 text-lg">
              The campaign you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
            </p>
            <Button asChild className="btn-primary">
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
        {/* Campaign Header */}
        <div className="card-warm-static p-6 md:p-8">
          <Link
            href="/dashboard/marketing"
            className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 mb-6"
          >
            ← Back to Campaigns
          </Link>
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-8">
            <div className="flex-1 w-full">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--radial-2))] flex items-center justify-center shadow-lg shadow-[hsl(var(--primary))]/30 flex-shrink-0">
                  <Workflow className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight break-words">
                    {leadGenJob.campaign.targetVertical}
                  </h1>
                  <p className="text-sm md:text-base text-muted-foreground flex items-center gap-2 mt-1 flex-wrap">
                    <Target className="h-4 w-4 flex-shrink-0" />
                    <span className="break-words">{leadGenJob.campaign.targetGeography}</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="w-full sm:w-auto">
              <StatusBadge status={leadGenJob.status} size="large" />
            </div>
          </div>

          {/* Key Stats Grid */}
          {leadGenCounts ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
              <div className="stat-card-primary p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Total Leads
                </p>
                <p className="text-3xl font-bold text-foreground">{leadGenCounts.totalOpportunities}</p>
                <p className="text-sm text-muted-foreground mt-2">Discovered</p>
              </div>
              <div className="stat-card-primary p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Ready to Call
                </p>
                <p className="text-3xl font-bold text-foreground">{leadGenCounts.readyOpportunities}</p>
                <p className="text-sm text-muted-foreground mt-2">Researched</p>
              </div>
              <div className="stat-card-accent p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Progress
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {leadGenJob.numLeadsFetched}/{leadGenJob.numLeadsRequested}
                </p>
                <p className="text-sm text-muted-foreground mt-2">Leads fetched</p>
              </div>
              <div className="stat-card-accent p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Completion
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {typeof leadGenProgress === "number" ? Math.round(leadGenProgress * 100) : 0}%
                </p>
                <p className="text-sm text-muted-foreground mt-2">Overall</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          )}
        </div>

        {/* Paused Status Banner */}
        {leadGenJob.status === "paused_for_upgrade" && billingBlock && (
          <Alert variant="default" className="border-2 border-[hsl(var(--primary))]/50 bg-gradient-to-r from-[hsl(var(--primary))]/10 to-[hsl(var(--primary))]/5">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--radial-2))] flex items-center justify-center shadow-lg shadow-[hsl(var(--primary))]/30">
              <Pause className="h-5 w-5 text-white" />
            </div>
            <AlertTitle className="text-lg font-bold">
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
                  className="btn-primary whitespace-nowrap"
                  aria-label="Upgrade to resume campaign"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Upgrade Now
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Campaign Progress - Collapsible */}
        <div className="card-warm-static overflow-hidden relative">
          {/* Background accent gradient */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[hsl(var(--primary))]/10 to-transparent rounded-full blur-3xl -z-10" />
          
          {/* Header - Always visible */}
          <Button
            variant="ghost"
            onClick={() => setWorkflowExpanded(!workflowExpanded)}
            className="w-full text-left p-6 md:p-8 hover:bg-transparent transition-colors h-auto justify-start rounded-none"
            aria-expanded={workflowExpanded ?? false}
            aria-label={`${workflowExpanded ? 'Collapse' : 'Expand'} workflow progress`}
          >
            <div className="w-full space-y-4 md:space-y-6">
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--radial-2))] flex items-center justify-center shadow-lg shadow-[hsl(var(--primary))]/30 flex-shrink-0">
                    <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground break-words">Workflow Progress</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Real-time campaign execution status</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                  {typeof leadGenProgress === "number" && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-right cursor-help">
                            <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--radial-2))] bg-clip-text text-transparent tabular-nums">
                              {Math.round(leadGenProgress * 100)}%
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 sm:mt-1 hidden sm:block">Complete</div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Overall workflow completion</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {workflowExpanded ? 
                    <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" /> : 
                    <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  }
                </div>
              </div>

              {/* Overall Progress Bar - Always visible */}
              {typeof leadGenProgress === "number" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Overall Progress</span>
                    <span className="text-xs font-bold text-primary tabular-nums">{Math.round(leadGenProgress * 100)}%</span>
                  </div>
                  <Progress 
                    value={Math.round(leadGenProgress * 100)} 
                    className="h-4 [&>div]:bg-gradient-to-r [&>div]:from-[hsl(var(--primary))] [&>div]:to-[hsl(var(--radial-2))] [&>div]:shadow-lg [&>div]:shadow-[hsl(var(--primary))]/30" 
                  />
                </div>
              )}

              {/* Latest Activity - Always visible when collapsed */}
              {!workflowExpanded && leadGenJob.lastEvent && (
                <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))]/10 via-[hsl(var(--primary))]/5 to-transparent border-2 border-[hsl(var(--primary))]/30 overflow-hidden">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--radial-2))] flex items-center justify-center shadow-lg shadow-[hsl(var(--primary))]/30 flex-shrink-0">
                      <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="text-xs sm:text-sm font-bold text-foreground mb-2 flex items-center gap-2 flex-wrap">
                        Latest Activity
                        <ArrowRight className="h-3 w-3 text-primary flex-shrink-0" />
                      </p>
                      <p className="text-xs sm:text-sm text-foreground/90 mb-2 leading-relaxed break-all overflow-wrap-anywhere">
                        {leadGenJob.lastEvent.message}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span className="break-all">{new Date(leadGenJob.lastEvent.timestamp).toLocaleString()}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Button>

          {/* Expandable Content - Workflow Phases */}
          {workflowExpanded && (
            <div className="border-t-2 border-border/40 p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
              <div className="space-y-3 sm:space-y-4">
            {leadGenJob.phases.map((phase, index) => {
              const PhaseIcon = PHASE_ICONS[phase.name as keyof typeof PHASE_ICONS] ?? Database;
              const isRunning = phase.status === "running";
              const isComplete = phase.status === "complete";
              const isError = phase.status === "error";
              const isPaused = leadGenJob.status === "paused_for_upgrade" && phase.name === billingBlock?.phase;
              const isActive = isRunning || isPaused;
              const isPending = phase.status === "pending";

              return (
                <div key={phase.name} className="relative">
                  {/* Connector Line */}
                  {index > 0 && (
                    <div className="absolute left-[26px] -top-4 w-1 h-4">
                      <div className={`w-full h-full transition-colors ${
                        leadGenJob.phases[index - 1].status === "complete" 
                          ? "bg-gradient-to-b from-[hsl(var(--success))] to-[hsl(var(--success))]/50" 
                          : "bg-border"
                      }`} />
                    </div>
                  )}
                  
                  {/* Phase Card */}
                  <div className={`rounded-xl border-2 transition-all duration-300 overflow-hidden ${
                    isActive 
                      ? "bg-gradient-to-br from-[hsl(var(--primary))]/8 via-[hsl(var(--primary))]/4 to-transparent border-[hsl(var(--primary))]/50 shadow-lg shadow-[hsl(var(--primary))]/20" 
                      : isComplete
                      ? "bg-gradient-to-br from-[hsl(var(--success))]/8 via-[hsl(var(--success))]/4 to-transparent border-[hsl(var(--success))]/40"
                      : isError
                      ? "bg-gradient-to-br from-[hsl(var(--destructive))]/8 to-transparent border-[hsl(var(--destructive))]/40"
                      : "bg-surface-overlay/50 border-border/40"
                  }`}>
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start gap-3 sm:gap-4">
                        {/* Icon with enhanced styling */}
                        <div className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                          isComplete 
                            ? "bg-gradient-to-br from-[hsl(var(--success))] to-[hsl(var(--success))]/80 text-white shadow-lg shadow-[hsl(var(--success))]/30" 
                            : isActive 
                            ? "bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))]/80 text-white shadow-lg shadow-[hsl(var(--primary))]/30 animate-pulse" 
                            : isError 
                            ? "bg-gradient-to-br from-[hsl(var(--destructive))] to-[hsl(var(--destructive))]/80 text-white shadow-lg shadow-[hsl(var(--destructive))]/30" 
                            : "bg-surface-muted border border-border text-muted-foreground"
                        }`}>
                          {isComplete ? (
                            <CheckCircle className="h-6 w-6 sm:h-7 sm:w-7" />
                          ) : (
                            <PhaseIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                          )}
                          {isActive && (
                            <div className="absolute inset-0 rounded-xl bg-[hsl(var(--primary))]/20 animate-ping" />
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className="font-bold text-base sm:text-lg text-foreground break-words">
                              {PHASE_LABELS[phase.name as keyof typeof PHASE_LABELS] ?? phase.name.replace(/_/g, " ")}
                            </h3>
                            {isRunning && (
                              <Badge className="bg-gradient-to-r from-[hsl(var(--primary))]/30 to-[hsl(var(--primary))]/20 text-primary border-[hsl(var(--primary))]/40">
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                Running
                              </Badge>
                            )}
                            {isPaused && (
                              <Badge className="bg-accent/60 text-accent-foreground border-accent-foreground/20">
                                <Clock className="mr-1 h-3 w-3" />
                                Paused
                              </Badge>
                            )}
                            {isComplete && (
                              <Badge className="bg-gradient-to-r from-[hsl(var(--success))]/30 to-[hsl(var(--success))]/20 text-[hsl(var(--success))] border-[hsl(var(--success))]/40">
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Complete
                              </Badge>
                            )}
                            {isPending && (
                              <Badge variant="secondary" className="bg-muted text-muted-foreground border-border">
                                <Clock className="mr-1 h-3 w-3" />
                                Pending
                              </Badge>
                            )}
                          </div>
                          
                          {/* Progress Bar for Active Steps */}
                          {isActive && (
                            <div className="mt-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-foreground">Processing...</span>
                                <span className="text-sm font-bold text-primary tabular-nums">
                                  {Math.round(phase.progress * 100)}%
                                </span>
                              </div>
                              <Progress 
                                value={Math.round(phase.progress * 100)} 
                                className="h-3 [&>div]:bg-gradient-to-r [&>div]:from-[hsl(var(--primary))] [&>div]:to-[hsl(var(--radial-2))] [&>div]:shadow-lg [&>div]:shadow-[hsl(var(--primary))]/30"
                              />
                            </div>
                          )}
                          
                          {/* Minimized Progress for Non-Active */}
                          {!isActive && !isComplete && phase.progress > 0 && (
                            <div className="flex items-center gap-3 mt-3">
                              <div className="h-2 flex-1 rounded-full bg-surface-muted border border-border overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-muted to-muted-foreground/30 transition-all"
                                  style={{ width: `${Math.round(phase.progress * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground tabular-nums font-medium">
                                {Math.round(phase.progress * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Error Message */}
                      {isError && phase.errorMessage && (
                        <Alert variant="destructive" className="mt-4">
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

              {/* Latest Activity - Show when expanded */}
              {leadGenJob.lastEvent && (
                <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))]/10 via-[hsl(var(--primary))]/5 to-transparent border-2 border-[hsl(var(--primary))]/30 overflow-hidden">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--radial-2))] flex items-center justify-center shadow-lg shadow-[hsl(var(--primary))]/30 flex-shrink-0">
                      <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="text-xs sm:text-sm font-bold text-foreground mb-2 flex items-center gap-2 flex-wrap">
                        Latest Activity
                        <ArrowRight className="h-3 w-3 text-primary flex-shrink-0" />
                      </p>
                      <p className="text-xs sm:text-sm text-foreground/90 mb-2 leading-relaxed break-all overflow-wrap-anywhere">
                        {leadGenJob.lastEvent.message}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span className="break-all">{new Date(leadGenJob.lastEvent.timestamp).toLocaleString()}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

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
          <div className="card-warm-static p-6 md:p-8 overflow-hidden relative">
            {/* Background accent */}
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-[hsl(var(--success))]/10 to-transparent rounded-full blur-3xl -z-10" />
            
            <div className="flex items-start sm:items-center gap-3 sm:gap-4 mb-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--success))] to-[hsl(var(--success))]/80 flex items-center justify-center shadow-lg shadow-[hsl(var(--success))]/30 flex-shrink-0">
                <Target className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground break-words">Opportunities</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">{opportunities.length} lead{opportunities.length !== 1 ? 's' : ''} ready for outreach</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[hsl(var(--success))] to-[hsl(var(--success))]/80 bg-clip-text text-transparent tabular-nums">
                  {opportunities.length}
                </div>
                <div className="text-xs text-muted-foreground mt-1 hidden sm:block">Total</div>
              </div>
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
              const currentPhase = job ? getCurrentAuditPhase(job) : null;
              const hasCredits = atlasCreditsBalance >= 1;

              return (
                <div
                  key={opp._id}
                  className={`rounded-xl overflow-hidden border-2 transition-all duration-200 relative ${
                    isReadyStatus
                      ? "bg-gradient-to-br from-[hsl(var(--success))]/8 via-[hsl(var(--success))]/4 to-transparent border-[hsl(var(--success))]/50 hover:border-[hsl(var(--success))]/70 hover:shadow-xl hover:shadow-[hsl(var(--success))]/20"
                      : "opp-card-gradient border-border/60 hover:border-border/80 hover:shadow-md"
                  }`}
                >
                  <Button
                    variant="ghost"
                    onClick={() => setExpandedOpportunityId(isExpanded ? null : opp._id)}
                    className="w-full text-left p-5 hover:bg-transparent transition-colors h-auto justify-start"
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details for ${opp.name}`}
                  >
                    <div className="flex items-start gap-3 sm:gap-4 w-full">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
                          <h3 className="font-bold text-base sm:text-lg text-foreground break-words">{opp.name}</h3>
                          {currentPhase && currentPhase !== "generate_dossier" ? (
                            <Badge className="bg-gradient-to-r from-[hsl(var(--primary))]/30 to-[hsl(var(--primary))]/20 text-primary border-[hsl(var(--primary))]/40">
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              {AUDIT_PHASE_LABELS[currentPhase]}
                            </Badge>
                          ) : (
                            <OpportunityStatusBadge status={opp.status} />
                          )}
                        </div>
                        {opp.domain && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="text-xs sm:text-sm text-muted-foreground mb-3 flex items-center gap-2 cursor-help">
                                  <Globe className="h-4 w-4 flex-shrink-0" />
                                  <span className="font-mono truncate max-w-[200px] sm:max-w-[300px]">{opp.domain}</span>
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
                      
                      {/* Chevron toggle */}
                      <div className="flex items-center flex-shrink-0">
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                      </div>
                    </div>
                  </Button>

                  {/* Call buttons on large screens - collapsed view only - outside the button to avoid nesting */}
                  {!isExpanded && oppStatusUpper === "READY" && agencyProfile && (
                    <div className="hidden lg:flex items-center gap-2 flex-shrink-0 absolute right-14 top-1/2 -translate-y-1/2">
                      <Button
                        onClick={async (e) => {
                          e.stopPropagation();
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
                        className="btn-primary font-semibold"
                        size="sm"
                        aria-label="Start AI call"
                      >
                        {startingCallOppId === opp._id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Starting...
                          </>
                        ) : (
                          <>
                            <Phone className="mr-2 h-4 w-4" />
                            Start Call
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDemoCallOpportunityId(opp._id);
                          setDemoCallModalOpen(true);
                        }}
                        disabled={!hasCredits}
                        className="btn-primary font-semibold"
                        size="sm"
                        aria-label="Start demo call"
                      >
                        <PlayCircle className="mr-2 h-4 w-4" />
                        Demo Call
                      </Button>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="border-t-2 border-border/40 p-5 md:p-6 space-y-5">
                      {/* Call Controls */}
                      {(() => {
                        const oppStatusUpper = typeof opp.status === "string" ? opp.status.toUpperCase() : "";
                        const isReady = oppStatusUpper === "READY";
                        const hasCredits = atlasCreditsBalance >= 1;

                        if (isReady && agencyProfile) {
                          return (
                            <div className="p-4 sm:p-5 md:p-6 lg:p-7 rounded-xl bg-gradient-to-br from-[hsl(var(--success))]/12 via-[hsl(var(--success))]/6 to-transparent border-2 border-[hsl(var(--success))]/40 shadow-lg shadow-[hsl(var(--success))]/10">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                                <div className="flex items-center gap-3 sm:gap-4 flex-1 w-full min-w-0">
                                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-[hsl(var(--success))] to-[hsl(var(--success))]/80 flex items-center justify-center shadow-xl shadow-[hsl(var(--success))]/30 flex-shrink-0">
                                    <Phone className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-foreground text-lg sm:text-xl mb-1 flex items-center gap-2 flex-wrap">
                                      Ready to Call
                                      <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-[hsl(var(--success))] flex-shrink-0" />
                                    </h4>
                                    <p className="text-xs sm:text-sm text-muted-foreground">All research complete • Dossier ready</p>
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-3">
                                {/* Call Action Buttons */}
                                <div className="flex flex-col sm:flex-row items-stretch gap-3">
                                  {/* Production Call Button */}
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
                                    className="btn-primary font-semibold px-6 py-2.5"
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

                                  {/* Demo Call Button */}
                                  <Button
                                    onClick={() => {
                                      setDemoCallOpportunityId(opp._id);
                                      setDemoCallModalOpen(true);
                                    }}
                                    disabled={!hasCredits}
                                    className="btn-primary font-semibold px-6 py-2.5"
                                    aria-label="Start demo call with test number"
                                  >
                                    <PlayCircle className="mr-2 h-5 w-5" />
                                    Demo Call
                                  </Button>
                                </div>

                                {/* Error and Warning Messages */}
                                {!hasCredits && (
                                  <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription className="text-sm">
                                      Need at least 1 credit to start a call
                                    </AlertDescription>
                                  </Alert>
                                )}
                                {callErrorByOpp[oppKey] && (
                                  <Alert variant="destructive">
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
                        <div className="p-4 sm:p-5 md:p-6 lg:p-7 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))]/10 via-[hsl(var(--primary))]/5 to-transparent border-2 border-[hsl(var(--primary))]/30 relative overflow-hidden">
                          {/* Subtle radial accent */}
                          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[hsl(var(--radial-2))]/20 to-transparent rounded-full blur-2xl -z-10" />
                          <div className="flex items-center gap-3 mb-3 sm:mb-4">
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--radial-2))] flex items-center justify-center shadow-lg shadow-[hsl(var(--primary))]/30 flex-shrink-0">
                              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                            </div>
                            <h4 className="font-bold text-foreground text-base sm:text-lg break-words flex-1">Why This Lead Fits</h4>
                          </div>
                          <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed break-words">
                            {opp.fit_reason}
                          </p>
                        </div>
                      )}

                      {/* Dossier */}
                      {job?.dossierId && (
                        <div className="rounded-xl bg-gradient-to-br from-surface-raised to-surface-muted border-2 border-border/50 overflow-hidden shadow-md relative">
                          {/* Header with gradient accent */}
                          <div className="p-5 md:p-6 bg-gradient-to-r from-accent/30 to-transparent border-b-2 border-border/40 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[hsl(var(--primary))]/10 to-transparent rounded-full blur-xl -z-10" />
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))]/90 to-[hsl(var(--radial-2))]/80 flex items-center justify-center shadow-lg shadow-[hsl(var(--primary))]/30 flex-shrink-0">
                                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-foreground text-lg sm:text-xl break-words">Research Dossier</h4>
                                  <p className="text-xs sm:text-sm text-muted-foreground">AI-generated insights & opportunities</p>
                                </div>
                              </div>
                          </div>
                          <div className="p-5 md:p-6">
                            {dossier ? (
                              <Accordion type="single" collapsible className="w-full space-y-3">
                                {dossier.summary && (
                                  <AccordionItem value="summary" className="border-none">
                                    <AccordionTrigger className="text-sm font-semibold hover:no-underline p-4 rounded-lg bg-surface-raised border-2 border-border/40 hover:border-[hsl(var(--primary))]/40 transition-colors [&[data-state=open]]:border-[hsl(var(--primary))]/50 [&[data-state=open]]:bg-gradient-to-r [&[data-state=open]]:from-[hsl(var(--primary))]/8 [&[data-state=open]]:to-transparent">
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-primary" />
                                        Summary
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-4 pb-2">
                                      <div className="p-4 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 border border-border/30">
                                        <p className="text-sm text-foreground leading-relaxed">{dossier.summary}</p>
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                )}

                                {dossier.identified_gaps.length > 0 && (
                                  <AccordionItem value="opportunities" className="border-none">
                                    <AccordionTrigger className="text-sm font-semibold hover:no-underline p-4 rounded-lg bg-surface-raised border-2 border-border/40 hover:border-[hsl(var(--primary))]/40 transition-colors [&[data-state=open]]:border-[hsl(var(--primary))]/50 [&[data-state=open]]:bg-gradient-to-r [&[data-state=open]]:from-[hsl(var(--primary))]/8 [&[data-state=open]]:to-transparent">
                                      <div className="flex items-center gap-2">
                                        <Target className="h-4 w-4 text-primary" />
                                        Identified Opportunities
                                        <Badge className="ml-2 bg-gradient-to-r from-[hsl(var(--primary))]/30 to-[hsl(var(--primary))]/20 text-primary border-[hsl(var(--primary))]/40">
                                          {dossier.identified_gaps.length}
                                        </Badge>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-4 pb-2">
                                      <div className="space-y-2">
                                        {dossier.identified_gaps.map((gap, idx) => (
                                          <div 
                                            key={`gap-${idx}`} 
                                            className="flex items-start gap-3 p-3 md:p-4 rounded-lg bg-gradient-to-r from-accent/15 to-accent/5 border border-border/30 hover:border-[hsl(var(--primary))]/30 hover:bg-gradient-to-r hover:from-[hsl(var(--primary))]/10 hover:to-transparent transition-all"
                                          >
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))]/80 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                                              <Target className="h-3.5 w-3.5 text-white" />
                                            </div>
                                            <div className="flex flex-col gap-1.5 flex-1">
                                              <span className="font-semibold text-sm text-foreground">{gap.key}</span>
                                              <span className="text-sm text-foreground/80">{gap.value}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                )}

                                {dossier.talking_points.length > 0 && (
                                  <AccordionItem value="talking-points" className="border-none">
                                    <AccordionTrigger className="text-sm font-semibold hover:no-underline p-4 rounded-lg bg-surface-raised border-2 border-border/40 hover:border-[hsl(var(--primary))]/40 transition-colors [&[data-state=open]]:border-[hsl(var(--primary))]/50 [&[data-state=open]]:bg-gradient-to-r [&[data-state=open]]:from-[hsl(var(--primary))]/8 [&[data-state=open]]:to-transparent">
                                      <div className="flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-primary" />
                                        Talking Points
                                        <Badge className="ml-2 bg-gradient-to-r from-[hsl(var(--primary))]/30 to-[hsl(var(--primary))]/20 text-primary border-[hsl(var(--primary))]/40">
                                          {dossier.talking_points.length}
                                        </Badge>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-4 pb-2">
                                      <div className="space-y-2">
                                        {dossier.talking_points.map((point, idx) => (
                                          <div 
                                            key={`tp-${idx}`} 
                                            className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-accent/15 to-accent/5 border border-border/30 hover:border-[hsl(var(--primary))]/30 hover:bg-gradient-to-r hover:from-[hsl(var(--primary))]/10 hover:to-transparent transition-all"
                                          >
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[hsl(var(--success))] to-[hsl(var(--success))]/80 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                                              <CheckCircle className="h-3.5 w-3.5 text-white" />
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
                        <div className="rounded-xl bg-surface-raised border-2 border-border/50 overflow-hidden shadow-sm hover:border-border/70 transition-all">
                          <Button
                            variant="ghost"
                            onClick={() => setViewSourcesForAuditId(
                              viewSourcesForAuditId === job._id ? null : job._id
                            )}
                            className="w-full text-sm font-semibold text-foreground hover:bg-gradient-to-r hover:from-accent/20 hover:to-transparent transition-all flex items-center justify-between p-5 md:p-6 h-auto rounded-none"
                            aria-expanded={viewSourcesForAuditId === job._id}
                            aria-label={viewSourcesForAuditId === job._id ? "Hide scraped sources" : "View scraped sources"}
                          >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center shadow-md flex-shrink-0">
                                  <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                  <div className="font-bold text-base sm:text-lg break-words">Scraped Sources</div>
                                  <div className="text-xs sm:text-sm text-muted-foreground font-normal">
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
                            <div className="border-t-2 border-border/40 p-5 md:p-6 bg-gradient-to-br from-surface-muted/50 to-transparent">
                              {scrapedPages ? (
                                scrapedPages.length > 0 ? (
                                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2 hide-scrollbar">
                                    {scrapedPages.map((page, idx) => (
                                      <div
                                        key={`scrape-${idx}`}
                                        className="group p-4 bg-surface-raised border-2 border-border/40 rounded-lg hover:border-[hsl(var(--primary))]/40 hover:bg-gradient-to-r hover:from-[hsl(var(--primary))]/8 hover:to-transparent transition-all"
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
          <div className="card-warm-static p-6 sm:p-8 md:p-12 text-center relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))]/5 via-transparent to-[hsl(var(--radial-2))]/5 -z-10" />
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))]/20 to-[hsl(var(--radial-2))]/10 flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg border-2 border-[hsl(var(--primary))]/30">
              <Clock className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3">No Opportunities Yet</h3>
            <p className="text-muted-foreground mb-4 sm:mb-6 text-base sm:text-lg px-4">
              Opportunities will appear here as the campaign progresses.
            </p>
            <Badge className="text-xs sm:text-sm bg-gradient-to-r from-[hsl(var(--primary))]/30 to-[hsl(var(--primary))]/20 text-primary border-[hsl(var(--primary))]/40 px-3 sm:px-4 py-1.5 sm:py-2">
              <Activity className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
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
          successUrl={new URL(
            `/dashboard/marketing/${flowId}?upgraded=1`,
            window.location.origin
          ).toString()}
        />

        {/* Demo Call Modal */}
        {demoCallModalOpen && demoCallOpportunityId && agencyProfile && (
          <DemoCallModal
            open={demoCallModalOpen}
            onOpenChange={setDemoCallModalOpen}
            opportunityId={demoCallOpportunityId}
            agencyId={agencyProfile.agencyProfileId}
            atlasCreditsBalance={atlasCreditsBalance}
            userEmail={user?.email || ""}
          />
        )}
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
        return "bg-gradient-to-r from-[hsl(var(--primary))]/30 to-[hsl(var(--primary))]/20 text-primary border-[hsl(var(--primary))]/40";
      case "completed":
      case "complete":
        return "bg-gradient-to-r from-[hsl(var(--success))] to-[hsl(var(--success))]/80 text-white border-[hsl(var(--success))] font-semibold shadow-md shadow-[hsl(var(--success))]/30";
      case "paused_for_upgrade":
        return "bg-accent/60 text-accent-foreground border-accent-foreground/20";
      case "failed":
      case "error":
        return "bg-gradient-to-r from-[hsl(var(--destructive))]/30 to-[hsl(var(--destructive))]/20 text-destructive border-[hsl(var(--destructive))]/40";
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
        return "bg-gradient-to-r from-[hsl(var(--success))] to-[hsl(var(--success))]/80 text-white border-[hsl(var(--success))] font-semibold shadow-md shadow-[hsl(var(--success))]/30";
      case "BOOKED":
        return "bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--radial-2))] text-white border-[hsl(var(--primary))] font-semibold shadow-md shadow-[hsl(var(--primary))]/30";
      case "COMPLETE":
        return "bg-gradient-to-r from-[hsl(var(--success))] to-[hsl(var(--success))]/80 text-white border-[hsl(var(--success))] font-semibold shadow-md shadow-[hsl(var(--success))]/30";
      case "REJECTED":
        return "bg-gradient-to-r from-[hsl(var(--destructive))]/30 to-[hsl(var(--destructive))]/20 text-destructive border-[hsl(var(--destructive))]/40";
      case "PENDING":
        return "bg-gradient-to-r from-[hsl(var(--primary))]/30 to-[hsl(var(--primary))]/20 text-primary border-[hsl(var(--primary))]/40";
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

