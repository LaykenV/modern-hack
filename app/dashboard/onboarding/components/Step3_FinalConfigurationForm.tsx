"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Claim } from "./ClaimsApproval";
import { 
  TONE_OPTIONS, 
  TARGET_VERTICALS, 
  LEAD_QUALIFICATION_OPTIONS,
  CORE_OFFER_EXAMPLES,
  NA_TIMEZONES, 
  DAYS
} from "../constants/formOptions";

interface FinalConfigurationFormProps {
  approvedClaims: Claim[];
  guardrails: string[];
  onComplete: () => void;
}

export function FinalConfigurationForm({ 
  approvedClaims, 
  guardrails, 
  onComplete 
}: FinalConfigurationFormProps) {
  const finalizeOnboarding = useMutation(api.sellerBrain.finalizeOnboardingPublic);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [tone, setTone] = useState<string>("consultative");
  const [targetVertical, setTargetVertical] = useState<string>("");
  const [targetGeography, setTargetGeography] = useState<string>("");
  const [coreOffer, setCoreOffer] = useState<string>("");
  const [leadQualificationCriteria, setLeadQualificationCriteria] = useState<string[]>([]);
  const [timeZone, setTimeZone] = useState<string>("America/Los_Angeles");
  
  // Availability state
  const [availabilityDay, setAvailabilityDay] = useState<string>("Tue");
  const [availabilityStart, setAvailabilityStart] = useState("10:00");
  const [availabilityEnd, setAvailabilityEnd] = useState("12:00");
  const [availabilitySlots, setAvailabilitySlots] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate required fields
      if (!targetVertical) {
        throw new Error("Please select a target vertical.");
      }
      if (!targetGeography.trim()) {
        throw new Error("Please enter your target geography.");
      }
      if (!coreOffer.trim()) {
        throw new Error("Please describe your core offer.");
      }
      if (leadQualificationCriteria.length === 0) {
        throw new Error("Please select at least one lead qualification criteria.");
      }
      if (availabilitySlots.length === 0) {
        throw new Error("Please add at least one availability slot.");
      }

      await finalizeOnboarding({
        approvedClaims,
        guardrails,
        tone,
        targetVertical,
        targetGeography: targetGeography.trim(),
        coreOffer: coreOffer.trim(),
        leadQualificationCriteria,
        timeZone,
        availability: availabilitySlots,
      });

      onComplete();
    } catch (err: unknown) {
      const message = typeof err === "object" && err && "message" in err
        ? String((err as { message?: unknown }).message)
        : null;
      setError(message ?? "Failed to finalize onboarding.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAvailabilitySlot = () => {
    if (!availabilityStart || !availabilityEnd) return;
    
    const slot = `${availabilityDay} ${availabilityStart}-${availabilityEnd}`;
    if (!availabilitySlots.includes(slot)) {
      setAvailabilitySlots([...availabilitySlots, slot]);
    }
  };

  const handleRemoveAvailabilitySlot = (slotToRemove: string) => {
    setAvailabilitySlots(availabilitySlots.filter(slot => slot !== slotToRemove));
  };

  const handleQualificationCriteriaToggle = (criteria: string) => {
    setLeadQualificationCriteria(prev => 
      prev.includes(criteria) 
        ? prev.filter(c => c !== criteria)
        : [...prev, criteria]
    );
  };

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Final Configuration</h1>
        <p className="text-sm text-slate-500">
          Step 3 of 3: Configure your AI assistant&apos;s personality and target market
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Summary of Approved Claims */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3">
            Your Approved Claims
          </h2>
          <div className="space-y-2">
            {approvedClaims.map((claim, index) => (
              <div key={claim.id} className="text-sm text-blue-700 dark:text-blue-300">
                <span className="font-medium">{index + 1}.</span> {claim.text}
              </div>
            ))}
          </div>
          {guardrails.length > 0 && (
            <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Guardrails: {guardrails.length} rule{guardrails.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

        {/* Tone Selection */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Communication Tone</h2>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              How should your AI assistant communicate?
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {TONE_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Target Market Configuration */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Target Market</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Define your target market to help your AI assistant qualify leads better.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Target Vertical */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Target Vertical *
              </label>
              <select
                value={targetVertical}
                onChange={(e) => setTargetVertical(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select an industry...</option>
                {TARGET_VERTICALS.map(vertical => (
                  <option key={vertical} value={vertical}>{vertical}</option>
                ))}
              </select>
            </div>

            {/* Target Geography */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Target Geography *
              </label>
              <input
                type="text"
                value={targetGeography}
                onChange={(e) => setTargetGeography(e.target.value)}
                placeholder="e.g., Los Angeles, CA or United States"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Specify city, state, country, or region
              </p>
            </div>
          </div>

          {/* Core Offer */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Core Offer *
            </label>
            <textarea
              value={coreOffer}
              onChange={(e) => setCoreOffer(e.target.value)}
              placeholder="Describe your main service offering..."
              className="w-full border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              required
            />
            <div className="mt-2">
              <p className="text-xs text-slate-500 mb-2">Examples:</p>
              <div className="flex flex-wrap gap-1">
                {CORE_OFFER_EXAMPLES.map((example, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setCoreOffer(example)}
                    className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-600 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Lead Qualification Criteria */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Lead Qualification Criteria</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Select criteria that indicate a business might need your services ({leadQualificationCriteria.length} selected)
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {LEAD_QUALIFICATION_OPTIONS.map(option => (
              <label key={option.value} className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={leadQualificationCriteria.includes(option.value)}
                  onChange={() => handleQualificationCriteriaToggle(option.value)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Timezone and Availability */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Availability Settings</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Time Zone
              </label>
              <select
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {NA_TIMEZONES.map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            {/* Availability Slots */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Availability ({availabilitySlots.length} slot{availabilitySlots.length !== 1 ? 's' : ''}) *
              </label>
              <div className="flex gap-2 mb-3">
                <select
                  value={availabilityDay}
                  onChange={(e) => setAvailabilityDay(e.target.value)}
                  className="border border-slate-300 dark:border-slate-700 rounded-md px-2 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {DAYS.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
                <input
                  type="time"
                  value={availabilityStart}
                  onChange={(e) => setAvailabilityStart(e.target.value)}
                  className="border border-slate-300 dark:border-slate-700 rounded-md px-2 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="flex items-center text-sm text-slate-500">to</span>
                <input
                  type="time"
                  value={availabilityEnd}
                  onChange={(e) => setAvailabilityEnd(e.target.value)}
                  className="border border-slate-300 dark:border-slate-700 rounded-md px-2 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleAddAvailabilitySlot}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  Add
                </button>
              </div>

              {/* Availability Slots Display */}
              {availabilitySlots.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {availabilitySlots.map((slot, index) => (
                    <div
                      key={index}
                      className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1 text-sm"
                    >
                      <span className="text-slate-700 dark:text-slate-300">{slot}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAvailabilitySlot(slot)}
                        className="text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        aria-label={`Remove ${slot}`}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="text-center pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white font-medium rounded-md transition-colors duration-200 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Finalizing Setup...
              </div>
            ) : (
              "Complete Onboarding"
            )}
          </button>
          <p className="text-xs text-slate-500 mt-2">
            This will finalize your AI assistant configuration and redirect you to the dashboard
          </p>
        </div>
      </form>
    </div>
  );
}