"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { 
  Building2, 
  Globe, 
  Target, 
  MapPin, 
  Shield, 
  CheckCircle2, 
  ExternalLink,
  FileText,
  Clock,
  Palette,
  Edit,
  Upload,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Loading skeleton component
function AgencyProfileSkeleton() {
  return (
    <main className="min-h-full p-6 md:p-8 flex flex-col gap-6">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        {/* Hero Section Skeleton */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <Skeleton className="h-10 w-64 mb-3" />
              <Skeleton className="h-6 w-96" />
            </div>
            <Skeleton className="h-8 w-28" />
          </div>
        </div>

        {/* Content Skeleton */}
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card-warm-static p-6 md:p-8">
            <Skeleton className="h-8 w-48 mb-6" />
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

// Empty state component
function EmptyAgencyProfile() {
  return (
    <main className="min-h-full p-6 md:p-8 flex flex-col gap-6">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        <div className="card-warm-static p-6 md:p-8">
          <h1 className="text-4xl font-bold text-foreground tracking-tight mb-4">
            Agency Profile
          </h1>
          <div className="text-center py-16">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              No Agency Profile Found
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
              Complete the onboarding process to create your agency profile and start using Atlas.
            </p>
            <Button asChild size="lg" className="btn-primary">
              <Link href="/dashboard/onboarding">
                Start Onboarding
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AgencyPage() {
  const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);
  const onboardingStatus = useQuery(api.onboarding.queries.getOnboardingStatus, { onboardingFlowId: agencyProfile?.onboardingFlowId });

  // Show loading skeleton while data is being fetched
  if (agencyProfile === undefined) {
    return <AgencyProfileSkeleton />;
  }

  // Show empty state if no profile exists
  if (agencyProfile === null) {
    return <EmptyAgencyProfile />;
  }

  return (
    <main className="min-h-full p-6 md:p-8 flex flex-col gap-6">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Hero Section */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                  Agency Profile
                </h1>
              </div>
              <p className="text-muted-foreground text-base md:text-lg ml-[52px]">
                Your agency configuration and settings
              </p>
            </div>
            <Badge 
              variant={onboardingStatus === "completed" ? "default" : "outline"}
              className={onboardingStatus === "completed" 
                ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400" 
                : "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400"
              }
            >
              {onboardingStatus === "completed" ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Complete
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3" />
                  Pending
                </>
              )}
            </Badge>
          </div>
        </div>

        {/* Company Information & Core Offering */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl md:text-2xl font-bold text-foreground">Company Overview</h2>
          </div>

          <div className="space-y-6">
            {/* Company Name & URL */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  Company Name
                </label>
                <div className="p-4 bg-surface-overlay/50 border border-border/40 rounded-lg">
                  <p className="text-foreground font-medium">{agencyProfile.companyName}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  Website
                </label>
                <div className="p-4 bg-surface-overlay/50 border border-border/40 rounded-lg">
                  <a 
                    href={agencyProfile.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 transition-colors font-medium inline-flex items-center gap-1.5 break-all group"
                  >
                    <span className="group-hover:underline">{agencyProfile.sourceUrl}</span>
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                </div>
              </div>
            </div>

            {/* Core Offering */}
            {agencyProfile.coreOffer && (
              <>
                <Separator className="my-6" />
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    Core Offering
                  </label>
                  <div className="p-5 bg-surface-overlay/60 border border-border/40 rounded-lg">
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                      {agencyProfile.coreOffer}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Target Market & Lead Qualification */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex items-center gap-2 mb-6">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-xl md:text-2xl font-bold text-foreground">Target Market</h2>
          </div>

          <div className="space-y-6">
            {/* Target Vertical & Geography */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Target className="h-4 w-4" />
                  Target Vertical
                </label>
                <div className="p-4 bg-surface-overlay/50 border border-border/40 rounded-lg min-h-[56px] flex items-center">
                  {Array.isArray(agencyProfile.targetVertical) && agencyProfile.targetVertical.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {agencyProfile.targetVertical.map((vertical, index) => (
                        <Badge key={index} variant="outline" className="bg-primary/5">
                          {vertical}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Not specified</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  Target Geography
                </label>
                <div className="p-4 bg-surface-overlay/50 border border-border/40 rounded-lg min-h-[56px] flex items-center">
                  <p className="text-foreground font-medium">
                    {agencyProfile.targetGeography || <span className="text-muted-foreground text-sm">Not specified</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Lead Qualification Criteria */}
            {Array.isArray(agencyProfile.leadQualificationCriteria) && agencyProfile.leadQualificationCriteria.length > 0 && (
              <>
                <Separator className="my-6" />
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                    Lead Qualification Criteria
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                    {agencyProfile.leadQualificationCriteria.map((criteria, index) => (
                      <Badge
                        key={index}
                        variant="default"
                        className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 whitespace-nowrap flex-shrink-0"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {criteria.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Communication Preferences & Availability */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex items-center gap-2 mb-6">
            <Palette className="h-5 w-5 text-primary" />
            <h2 className="text-xl md:text-2xl font-bold text-foreground">Communication Settings</h2>
          </div>

          <div className="space-y-6">
            {/* Tone & Time Zone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Palette className="h-4 w-4" />
                  Communication Tone
                </label>
                <div className="p-4 bg-surface-overlay/50 border border-border/40 rounded-lg min-h-[56px] flex items-center">
                  <p className="text-foreground font-medium">
                    {agencyProfile.tone || <span className="text-muted-foreground text-sm">Not specified</span>}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Time Zone
                </label>
                <div className="p-4 bg-surface-overlay/50 border border-border/40 rounded-lg min-h-[56px] flex items-center">
                  <p className="text-foreground font-medium">
                    {agencyProfile.timeZone || <span className="text-muted-foreground text-sm">Not specified</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Availability */}
            {Array.isArray(agencyProfile.availability) && agencyProfile.availability.length > 0 && (
              <>
                <Separator className="my-6" />
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Availability Windows
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                    {agencyProfile.availability.map((slot, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="bg-accent/30 text-accent-foreground border-accent-foreground/30 whitespace-nowrap flex-shrink-0"
                      >
                        <Clock className="h-3 w-3" />
                        {slot}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Guardrails */}
        {Array.isArray(agencyProfile.guardrails) && agencyProfile.guardrails.length > 0 && (
          <div className="card-warm-static p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6">
              <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <h2 className="text-xl md:text-2xl font-bold text-foreground">Guardrails</h2>
            </div>
            <div className="space-y-3">
              {agencyProfile.guardrails.map((guardrail, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg group hover:bg-amber-500/15 transition-colors"
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-foreground leading-relaxed flex-1 pt-1">{guardrail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approved Claims */}
        {Array.isArray(agencyProfile.approvedClaims) && agencyProfile.approvedClaims.length > 0 && (
          <div className="card-warm-static p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-xl md:text-2xl font-bold text-foreground">Approved Claims</h2>
              <Badge variant="outline" className="ml-auto">
                {agencyProfile.approvedClaims.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {agencyProfile.approvedClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="p-5 bg-surface-overlay/60 border border-border/40 rounded-lg hover:border-primary/40 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center mt-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground leading-relaxed mb-3">
                        {claim.text}
                      </p>
                      {claim.source_url && (
                        <a
                          href={claim.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1.5 group/link"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span className="group-hover/link:underline">View Source</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Company Summary */}
        {agencyProfile.summary && (
          <div className="card-warm-static p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-xl md:text-2xl font-bold text-foreground">Company Summary</h2>
            </div>
            <div className="p-5 bg-surface-overlay/60 border border-border/40 rounded-lg">
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {agencyProfile.summary}
              </p>
            </div>
          </div>
        )}

        {/* Profile Management */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex items-center gap-2 mb-6">
            <Edit className="h-5 w-5 text-primary" />
            <h2 className="text-xl md:text-2xl font-bold text-foreground">Profile Management</h2>
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">
                Profile editing capabilities will be available in a future update. 
                For now, changes can be made through the onboarding process.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  disabled
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Edit className="h-4 w-4" />
                  Edit Profile
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Coming soon</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  disabled
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Upload className="h-4 w-4" />
                  Upload Claims
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Coming soon</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  disabled
                  variant="outline"
                  className="w-full justify-start"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate Summary
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Coming soon</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </main>
  );
}