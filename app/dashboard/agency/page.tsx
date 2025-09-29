"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function AgencyPage() {
  const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);
  const onboardingStatus = useQuery(api.onboarding.queries.getOnboardingStatus, { onboardingFlowId: agencyProfile?.onboardingFlowId });

  if (!agencyProfile) {
    return (
      <div className="max-w-4xl mx-auto w-full">
        <h1 className="text-3xl font-bold mb-6">Agency Profile</h1>
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            No agency profile found. Please complete the onboarding process.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agency Profile</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage your agency configuration and settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm ${
            onboardingStatus === "completed" 
              ? "bg-green-100 text-green-700" 
              : "bg-orange-100 text-orange-700"
          }`}>
            {onboardingStatus === "completed" ? "✓ Onboarding Complete" : "⚠ Onboarding Pending"}
          </span>
        </div>
      </div>

      {/* Company Information */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Company Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Company Name
            </label>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
              {agencyProfile.companyName}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Source URL
            </label>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
              <a 
                href={agencyProfile.sourceUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {agencyProfile.sourceUrl}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Core Offering */}
      {agencyProfile.coreOffer && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Core Offering</h2>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {agencyProfile.coreOffer}
            </p>
          </div>
        </div>
      )}

      {/* Target Market */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Target Market</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Target Vertical
            </label>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
              {Array.isArray(agencyProfile.targetVertical) && agencyProfile.targetVertical.length > 0 
                ? agencyProfile.targetVertical.join(", ") 
                : "Not specified"}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Target Geography
            </label>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
              {agencyProfile.targetGeography || "Not specified"}
            </div>
          </div>
        </div>
      </div>

      {/* Lead Qualification Criteria */}
      {Array.isArray(agencyProfile.leadQualificationCriteria) && agencyProfile.leadQualificationCriteria.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Lead Qualification Criteria</h2>
          <div className="flex flex-wrap gap-2">
            {agencyProfile.leadQualificationCriteria.map((criteria, index) => (
              <span
                key={index}
                className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900 px-3 py-1 text-sm text-blue-700 dark:text-blue-300"
              >
                {criteria.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Communication Preferences */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Communication Preferences</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Tone
            </label>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
              {agencyProfile.tone || "Not specified"}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Time Zone
            </label>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
              {agencyProfile.timeZone || "Not specified"}
            </div>
          </div>
        </div>
      </div>

      {/* Availability */}
      {Array.isArray(agencyProfile.availability) && agencyProfile.availability.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Availability</h2>
          <div className="flex flex-wrap gap-2">
            {agencyProfile.availability.map((slot, index) => (
              <span
                key={index}
                className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900 px-3 py-1 text-sm text-green-700 dark:text-green-300"
              >
                {slot}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Guardrails */}
      {Array.isArray(agencyProfile.guardrails) && agencyProfile.guardrails.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Guardrails</h2>
          <div className="space-y-2">
            {agencyProfile.guardrails.map((guardrail, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md"
              >
                <span className="text-orange-600 dark:text-orange-400 mt-0.5">⚠️</span>
                <p className="text-sm text-orange-800 dark:text-orange-200">{guardrail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved Claims */}
      {Array.isArray(agencyProfile.approvedClaims) && agencyProfile.approvedClaims.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Approved Claims</h2>
          <div className="space-y-3">
            {agencyProfile.approvedClaims.map((claim) => (
              <div
                key={claim.id}
                className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-md"
              >
                <p className="text-sm text-emerald-800 dark:text-emerald-200 mb-2">
                  {claim.text}
                </p>
                {claim.source_url && (
                  <a
                    href={claim.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Company Summary</h2>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {agencyProfile.summary}
            </p>
          </div>
        </div>
      )}

      {/* Edit Actions */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Profile Management</h2>
        <div className="flex gap-4">
          <button
            disabled
            className="px-4 py-2 bg-slate-300 text-slate-500 rounded-md cursor-not-allowed"
          >
            Edit Profile (Coming Soon)
          </button>
          <button
            disabled
            className="px-4 py-2 bg-slate-300 text-slate-500 rounded-md cursor-not-allowed"
          >
            Upload New Claims (Coming Soon)
          </button>
          <button
            disabled
            className="px-4 py-2 bg-slate-300 text-slate-500 rounded-md cursor-not-allowed"
          >
            Regenerate Summary (Coming Soon)
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Profile editing capabilities will be available in a future update. 
          For now, changes can be made through the onboarding process.
        </p>
      </div>
    </div>
  );
}