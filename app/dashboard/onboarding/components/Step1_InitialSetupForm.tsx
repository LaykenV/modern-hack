"use client";

import { useAction, useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";

interface InitialSetupFormProps {
  onStarted: (params: { mode: "manual" | "automated"; agencyProfileId: string; onboardingFlowId?: string }) => void;
}

export function InitialSetupForm({ onStarted }: InitialSetupFormProps) {
  const seedWorkflow = useAction(api.sellerBrain.seedFromWebsite);
  const startManual = useMutation(api.sellerBrain.startManualOnboarding);
  
  const [companyName, setCompanyName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [mode, setMode] = useState<"manual" | "automated">("automated");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      if (!companyName.trim()) {
        throw new Error("Please provide a company name.");
      }
      
      if (mode === "automated") {
        if (!sourceUrl.trim()) {
          throw new Error("Please provide a website URL for automated analysis.");
        }
        
        // Normalize URL to include protocol
        const normalizedUrl = sourceUrl.startsWith("http") 
          ? sourceUrl 
          : `https://${sourceUrl}`;
        
        const result = await seedWorkflow({ 
          companyName: companyName.trim(), 
          sourceUrl: normalizedUrl 
        });
        
        onStarted({ 
          mode: "automated", 
          agencyProfileId: result.agencyProfileId,
        });
      } else {
        // Manual mode
        const result = await startManual({ 
          companyName: companyName.trim()
        });
        
        onStarted({ 
          mode: "manual", 
          agencyProfileId: result.agencyProfileId 
        });
      }
      
    } catch (err: unknown) {
      const message = typeof err === "object" && err && "message" in err
        ? String((err as { message?: unknown }).message)
        : null;
      setError(message ?? "Failed to start onboarding.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Welcome to Onboarding</h1>
        <p className="text-sm text-slate-500">
          Step 1 of {mode === "manual" ? 3 : 4}: Choose how you'd like to set up your AI assistant
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Name */}
        <div className="space-y-2">
          <label htmlFor="companyName" className="block text-sm font-medium">
            Company Name *
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

        {/* Mode Selection */}
        <div className="space-y-4">
          <label className="block text-sm font-medium">
            Setup Mode *
          </label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Automated Mode */}
            <div 
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                mode === "automated" 
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                  : "border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
              }`}
              onClick={() => setMode("automated")}
            >
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="radio"
                  id="automated"
                  name="mode"
                  value="automated"
                  checked={mode === "automated"}
                  onChange={(e) => setMode(e.target.value as "automated")}
                  className="w-4 h-4 text-blue-600"
                />
                <label htmlFor="automated" className="text-sm font-medium cursor-pointer">
                  🤖 Automated Analysis
                </label>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 ml-7">
                We'll analyze your website to automatically generate your business summary, core offer, and claims
              </p>
            </div>

            {/* Manual Mode */}
            <div 
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                mode === "manual" 
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                  : "border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
              }`}
              onClick={() => setMode("manual")}
            >
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="radio"
                  id="manual"
                  name="mode"
                  value="manual"
                  checked={mode === "manual"}
                  onChange={(e) => setMode(e.target.value as "manual")}
                  className="w-4 h-4 text-blue-600"
                />
                <label htmlFor="manual" className="text-sm font-medium cursor-pointer">
                  ✏️ Manual Setup
                </label>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 ml-7">
                Skip website analysis and manually enter your business details
              </p>
            </div>
          </div>
        </div>

        {/* Website URL (only for automated mode) */}
        {mode === "automated" && (
          <div className="space-y-2">
            <label htmlFor="sourceUrl" className="block text-sm font-medium">
              Website URL *
            </label>
            <input
              id="sourceUrl"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://example.com"
              disabled={loading}
              required={mode === "automated"}
            />
            <p className="text-xs text-slate-500">
              We&apos;ll analyze your website to understand your business and generate personalized content
            </p>
          </div>
        )}

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading || !companyName.trim() || (mode === "automated" && !sourceUrl.trim())}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {mode === "automated" ? "Starting Analysis..." : "Creating Profile..."}
              </div>
            ) : (
              mode === "automated" ? "Start Analysis" : "Continue to Setup"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
