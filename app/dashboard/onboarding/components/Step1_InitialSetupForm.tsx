"use client";

import { useAction } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";

interface InitialSetupFormProps {
  onWorkflowStarted: (agencyProfileId: string) => void;
}

export function InitialSetupForm({ onWorkflowStarted }: InitialSetupFormProps) {
  const seedWorkflow = useAction(api.sellerBrain.seedFromWebsite);
  
  const [companyName, setCompanyName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      if (!companyName.trim() || !sourceUrl.trim()) {
        throw new Error("Please provide both company name and website URL.");
      }
      
      // Normalize URL to include protocol
      const normalizedUrl = sourceUrl.startsWith("http") 
        ? sourceUrl 
        : `https://${sourceUrl}`;
      
      const result = await seedWorkflow({ 
        companyName: companyName.trim(), 
        sourceUrl: normalizedUrl 
      });
      
      // Transition to Step 2 with the seller brain ID
      onWorkflowStarted(result.agencyProfileId);
      
    } catch (err: unknown) {
      const message = typeof err === "object" && err && "message" in err
        ? String((err as { message?: unknown }).message)
        : null;
      setError(message ?? "Failed to start onboarding workflow.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Welcome to Onboarding</h1>
        <p className="text-sm text-slate-500">
          Step 1 of 3: Enter your company details to begin analyzing your website
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="companyName" className="block text-sm font-medium">
            Company Name
          </label>
          <input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Acme Corp"
            disabled={loading}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="sourceUrl" className="block text-sm font-medium">
            Website URL
          </label>
          <input
            id="sourceUrl"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="https://example.com"
            disabled={loading}
            required
          />
          <p className="text-xs text-slate-500">
            We&apos;ll analyze your website to understand your business and generate personalized content
          </p>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading || !companyName.trim() || !sourceUrl.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Starting Analysis...
              </div>
            ) : (
              "Start Analysis"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
