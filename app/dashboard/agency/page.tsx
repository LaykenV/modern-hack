"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";

export default function AgencyPage() {
  const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);
  const onboardingStatus = useQuery(api.onboarding.queries.getOnboardingStatus, { onboardingFlowId: agencyProfile?.onboardingFlowId });

  if (!agencyProfile) {
    return (
      <main className="min-h-full p-6 md:p-8 flex flex-col gap-6">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          <div className="card-warm-static p-6 md:p-8">
            <h1 className="text-4xl font-bold text-foreground tracking-tight mb-4">Agency Profile</h1>
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground mb-6">
                No agency profile found. Please complete the onboarding process to get started.
              </p>
              <Link href="/dashboard/onboarding" className="btn-contrast inline-flex">
                Start Onboarding
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full p-6 md:p-8 flex flex-col gap-6">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        {/* Hero Section */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground tracking-tight">
                Agency Profile
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Manage your agency configuration and settings
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold ${
                onboardingStatus === "completed" 
                  ? "bg-success/15 text-success border border-success/30" 
                  : "bg-accent/60 text-accent-foreground border border-accent-foreground/20"
              }`}>
                {onboardingStatus === "completed" ? "✓ Complete" : "⚠ Pending"}
              </span>
            </div>
          </div>
        </div>

        {/* Company Information */}
        <div className="card-warm-static p-6 md:p-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">Company Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Company Name
              </label>
              <div className="p-4 bg-surface-overlay/50 border border-border/40 rounded-lg">
                <p className="text-foreground font-medium">{agencyProfile.companyName}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Source URL
              </label>
              <div className="p-4 bg-surface-overlay/50 border border-border/40 rounded-lg">
                <a 
                  href={agencyProfile.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 transition-colors font-medium hover:underline break-all"
                >
                  {agencyProfile.sourceUrl}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Core Offering */}
        {agencyProfile.coreOffer && (
          <div className="card-warm-static p-6 md:p-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">Core Offering</h2>
            <div className="p-5 bg-surface-overlay/60 border border-border/40 rounded-lg">
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {agencyProfile.coreOffer}
              </p>
            </div>
          </div>
        )}

        {/* Target Market */}
        <div className="card-warm-static p-6 md:p-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">Target Market</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Target Vertical
              </label>
              <div className="p-4 bg-surface-overlay/50 border border-border/40 rounded-lg">
                <p className="text-foreground font-medium">
                  {Array.isArray(agencyProfile.targetVertical) && agencyProfile.targetVertical.length > 0 
                    ? agencyProfile.targetVertical.join(", ") 
                    : <span className="text-muted-foreground">Not specified</span>}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Target Geography
              </label>
              <div className="p-4 bg-surface-overlay/50 border border-border/40 rounded-lg">
                <p className="text-foreground font-medium">
                  {agencyProfile.targetGeography || <span className="text-muted-foreground">Not specified</span>}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lead Qualification Criteria */}
        {Array.isArray(agencyProfile.leadQualificationCriteria) && agencyProfile.leadQualificationCriteria.length > 0 && (
          <div className="card-warm-static p-6 md:p-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">Lead Qualification Criteria</h2>
            <div className="flex flex-wrap gap-2.5">
              {agencyProfile.leadQualificationCriteria.map((criteria, index) => (
                <span
                  key={index}
                  className="inline-flex items-center rounded-full bg-primary/15 text-primary border border-primary/25 px-4 py-2 text-sm font-semibold"
                >
                  {criteria.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Communication Preferences */}
        <div className="card-warm-static p-6 md:p-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">Communication Preferences</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Tone
              </label>
              <div className="p-4 bg-surface-overlay/50 border border-border/40 rounded-lg">
                <p className="text-foreground font-medium">
                  {agencyProfile.tone || <span className="text-muted-foreground">Not specified</span>}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Time Zone
              </label>
              <div className="p-4 bg-surface-overlay/50 border border-border/40 rounded-lg">
                <p className="text-foreground font-medium">
                  {agencyProfile.timeZone || <span className="text-muted-foreground">Not specified</span>}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Availability */}
        {Array.isArray(agencyProfile.availability) && agencyProfile.availability.length > 0 && (
          <div className="card-warm-static p-6 md:p-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">Availability</h2>
            <div className="flex flex-wrap gap-2.5">
              {agencyProfile.availability.map((slot, index) => (
                <span
                  key={index}
                  className="inline-flex items-center rounded-full bg-accent/60 text-accent-foreground border border-accent-foreground/20 px-4 py-2 text-sm font-semibold"
                >
                  {slot}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Guardrails */}
        {Array.isArray(agencyProfile.guardrails) && agencyProfile.guardrails.length > 0 && (
          <div className="card-warm-static p-6 md:p-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">Guardrails</h2>
            <div className="space-y-3">
              {agencyProfile.guardrails.map((guardrail, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 bg-accent/40 border border-accent-foreground/20 rounded-lg"
                >
                  <span className="text-2xl flex-shrink-0">⚠️</span>
                  <p className="text-foreground leading-relaxed">{guardrail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approved Claims */}
        {Array.isArray(agencyProfile.approvedClaims) && agencyProfile.approvedClaims.length > 0 && (
          <div className="card-warm-static p-6 md:p-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">Approved Claims</h2>
            <div className="space-y-4">
              {agencyProfile.approvedClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="p-5 bg-surface-overlay/60 border border-primary/20 rounded-lg hover:border-primary/40 transition-colors"
                >
                  <p className="text-foreground leading-relaxed mb-3">
                    {claim.text}
                  </p>
                  {claim.source_url && (
                    <a
                      href={claim.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
                    >
                      View Source →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Company Summary */}
        {agencyProfile.summary && (
          <div className="card-warm-static p-6 md:p-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">Company Summary</h2>
            <div className="p-5 bg-surface-overlay/60 border border-border/40 rounded-lg">
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {agencyProfile.summary}
              </p>
            </div>
          </div>
        )}

        {/* Edit Actions */}
        <div className="card-warm-static p-6 md:p-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">Profile Management</h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
            <button
              disabled
              className="px-4 py-2.5 bg-muted text-muted-foreground rounded-lg cursor-not-allowed opacity-60 font-medium"
            >
              Edit Profile (Coming Soon)
            </button>
            <button
              disabled
              className="px-4 py-2.5 bg-muted text-muted-foreground rounded-lg cursor-not-allowed opacity-60 font-medium"
            >
              Upload New Claims (Coming Soon)
            </button>
            <button
              disabled
              className="px-4 py-2.5 bg-muted text-muted-foreground rounded-lg cursor-not-allowed opacity-60 font-medium"
            >
              Regenerate Summary (Coming Soon)
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Profile editing capabilities will be available in a future update. 
            For now, changes can be made through the onboarding process.
          </p>
        </div>
      </div>
    </main>
  );
}