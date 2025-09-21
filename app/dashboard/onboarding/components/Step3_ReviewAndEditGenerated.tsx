"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface ClaimDraft {
  id?: string;
  text: string;
  source_url?: string;
}

interface ReviewAndEditGeneratedProps {
  agencyProfileId: Id<"agency_profile">;
  mode?: "manual" | "automated";
  initialSummary?: string;
  initialCoreOffer?: string;
  initialClaims?: ClaimDraft[];
  onSaved: () => void;
}

export function ReviewAndEditGenerated({ 
  agencyProfileId,
  mode = "automated",
  initialSummary = "",
  initialCoreOffer = "",
  initialClaims = [],
  onSaved 
}: ReviewAndEditGeneratedProps) {
  const saveReviewed = useMutation(api.sellerBrain.saveReviewedContentPublic);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [summary, setSummary] = useState(initialSummary);
  const [coreOffer, setCoreOffer] = useState(initialCoreOffer);
  const [claims, setClaims] = useState<ClaimDraft[]>(initialClaims);
  
  // New claim form state
  const [newClaimText, setNewClaimText] = useState("");
  const [newClaimSourceUrl, setNewClaimSourceUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate required fields
      if (!summary.trim()) {
        throw new Error("Please provide a summary.");
      }
      if (!coreOffer.trim()) {
        throw new Error("Please describe your core offer.");
      }

      // Convert claims to the expected format with generated IDs
      const formattedClaims = claims.map((claim, index) => ({
        id: claim.id || `claim_${index + 1}`,
        text: claim.text,
        source_url: claim.source_url || "",
      }));

      await saveReviewed({
        agencyProfileId,
        summary: summary.trim(),
        coreOffer: coreOffer.trim(),
        claims: formattedClaims,
      });

      onSaved();
    } catch (err: unknown) {
      const message = typeof err === "object" && err && "message" in err
        ? String((err as { message?: unknown }).message)
        : null;
      setError(message ?? "Failed to save reviewed content.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddClaim = () => {
    if (!newClaimText.trim()) return;
    
    const newClaim: ClaimDraft = {
      id: `claim_${claims.length + 1}`,
      text: newClaimText.trim(),
      source_url: newClaimSourceUrl.trim() || undefined,
    };
    
    setClaims([...claims, newClaim]);
    setNewClaimText("");
    setNewClaimSourceUrl("");
  };

  const handleEditClaim = (index: number, field: keyof ClaimDraft, value: string) => {
    const updatedClaims = [...claims];
    updatedClaims[index] = { ...updatedClaims[index], [field]: value };
    setClaims(updatedClaims);
  };

  const handleRemoveClaim = (index: number) => {
    setClaims(claims.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Review & Edit Generated Content</h1>
        <p className="text-sm text-slate-500">
          {mode === "manual" ? "Step 2 of 3" : "Step 3 of 4"}: Review and edit the content
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Summary Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Business Summary</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Edit the generated summary of your business to ensure accuracy.
          </p>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Enter a summary of your business, services, and value proposition..."
            className="w-full border border-slate-300 dark:border-slate-700 rounded-md px-3 py-3 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={6}
            required
          />
        </div>

        {/* Core Offer Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Core Offer</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Describe your main service offering or value proposition.
          </p>
          <textarea
            value={coreOffer}
            onChange={(e) => setCoreOffer(e.target.value)}
            placeholder="Describe your main service offering, what problems you solve, and how you help clients..."
            className="w-full border border-slate-300 dark:border-slate-700 rounded-md px-3 py-3 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={4}
            required
          />
        </div>

        {/* Claims Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Business Claims</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Edit or add claims about your business that can be used to engage prospects. 
            Claims should be specific, measurable, and verifiable.
          </p>

          {/* Existing Claims */}
          {claims.length > 0 && (
            <div className="space-y-4 mb-6">
              {claims.map((claim, index) => (
                <div key={claim.id || index} className="border border-slate-200 dark:border-slate-700 rounded-md p-4">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Claim {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveClaim(index)}
                      className="text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                      aria-label={`Remove claim ${index + 1}`}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Claim Text
                      </label>
                      <textarea
                        value={claim.text}
                        onChange={(e) => handleEditClaim(index, "text", e.target.value)}
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={2}
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Source URL (optional)
                      </label>
                      <input
                        type="url"
                        value={claim.source_url || ""}
                        onChange={(e) => handleEditClaim(index, "source_url", e.target.value)}
                        placeholder="https://example.com/source"
                        className="w-full border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add New Claim */}
          <div className="border border-dashed border-slate-300 dark:border-slate-600 rounded-md p-4">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Add New Claim
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Claim Text
                </label>
                <textarea
                  value={newClaimText}
                  onChange={(e) => setNewClaimText(e.target.value)}
                  placeholder="e.g., We helped 50+ businesses increase their revenue by 30% in 6 months"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Source URL (optional)
                </label>
                <input
                  type="url"
                  value={newClaimSourceUrl}
                  onChange={(e) => setNewClaimSourceUrl(e.target.value)}
                  placeholder="https://example.com/case-study"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <button
                type="button"
                onClick={handleAddClaim}
                disabled={!newClaimText.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-sm font-medium rounded-md transition-colors disabled:cursor-not-allowed"
              >
                Add Claim
              </button>
            </div>
          </div>

          {claims.length === 0 && (
            <div className="text-center py-6 text-slate-500 text-sm">
              No claims added yet. Add claims to help your AI assistant engage prospects effectively.
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="text-center pt-4">
          <button
            type="submit"
            disabled={loading || !summary.trim() || !coreOffer.trim()}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium rounded-md transition-colors duration-200 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving Content...
              </div>
            ) : (
              "Save & Continue"
            )}
          </button>
          <p className="text-xs text-slate-500 mt-2">
            This will save your reviewed content and proceed to final configuration
          </p>
        </div>
      </form>
    </div>
  );
}
