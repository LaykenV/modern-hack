"use client";

import { useAction, useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, AlertCircle, ArrowRight, Info, Sparkles } from "lucide-react";

interface InitialSetupFormProps {
  onStarted: (params: { mode: "manual" | "automated"; agencyProfileId: string; onboardingFlowId?: string }) => void;
}

export function InitialSetupForm({ onStarted }: InitialSetupFormProps) {
  const seedWorkflow = useAction(api.sellerBrain.seedFromWebsite);
  const startManual = useMutation(api.sellerBrain.startManualOnboarding);
  
  const [companyName, setCompanyName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [mode, setMode] = useState<"manual" | "automated">("automated");
  
  const handleModeChange = (value: string) => {
    const newMode = value as "manual" | "automated";
    setMode(newMode);
    // Clear URL when switching to manual mode
    if (newMode === "manual") {
      setSourceUrl("");
    }
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDemoPath = () => {
    setMode("automated");
    setCompanyName("GrowthLocal");
    setSourceUrl("https://fine-newt-884.convex.app");
  };

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
    <div className="max-w-3xl mx-auto w-full">
      <div className="card-warm-static p-6 md:p-8 mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-3">
          Welcome to Atlas Outbound
        </h1>
        <p className="text-base md:text-lg text-muted-foreground mb-6">
          Let&apos;s set up your AI assistant to start generating qualified leads
        </p>
        
        {/* Mode Selection */}
        <div className="mt-6">
          <label className="input-label mb-4 block">
            Setup Mode *
          </label>
          
          <RadioGroup value={mode} onValueChange={handleModeChange} className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* Automated Mode */}
            <label 
              htmlFor="automated"
              className={`rounded-lg p-4 sm:p-5 cursor-pointer transition-all ${
                mode === "automated" 
                  ? "card-warm-accent" 
                  : "card-warm-static hover:border-ring/40 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem 
                  value="automated" 
                  id="automated" 
                  className="mt-0.5" 
                  style={{
                    backgroundColor: mode === "automated" ? "hsl(var(--primary))" : undefined,
                    borderColor: mode === "automated" ? "hsl(var(--primary))" : undefined,
                  }}
                />
                <div className="flex-1">
                  <div className="mb-2">
                    <span className="text-base font-semibold text-foreground">Automated Analysis</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We&apos;ll analyze your website to automatically generate your business summary, core offer, and claims
                  </p>
                </div>
              </div>
            </label>

            {/* Manual Mode */}
            <label 
              htmlFor="manual"
              className={`rounded-lg p-4 sm:p-5 cursor-pointer transition-all ${
                mode === "manual" 
                  ? "card-warm-accent" 
                  : "card-warm-static hover:border-ring/40 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem 
                  value="manual" 
                  id="manual" 
                  className="mt-0.5"
                  style={{
                    backgroundColor: mode === "manual" ? "hsl(var(--primary))" : undefined,
                    borderColor: mode === "manual" ? "hsl(var(--primary))" : undefined,
                  }}
                />
                <div className="flex-1">
                  <div className="mb-2">
                    <span className="text-base font-semibold text-foreground">Manual Setup</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Skip website analysis and manually enter your business details
                  </p>
                </div>
              </div>
            </label>
          </RadioGroup>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Name & Website URL */}
        <div className="card-warm-static p-4 sm:p-6 space-y-4">
          {/* Card Header with Demo Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2">
            <h2 className="text-lg font-semibold text-foreground">Company Information</h2>
            <button
              type="button"
              onClick={handleDemoPath}
              disabled={loading}
              className="btn-primary shrink-0 px-3 py-2 text-sm font-medium flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="hidden lg:inline">Demo Path - Use our dummy agency website</span>
              <span className="lg:hidden">Demo Path</span>
            </button>
          </div>

          <div>
            <label htmlFor="companyName" className="input-label">
              Company Name *
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Corp"
              disabled={loading}
              required
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="sourceUrl" className="input-label">
              Website URL {mode === "automated" && "*"}
            </label>
            <input
              id="sourceUrl"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={loading || mode === "manual"}
              required={mode === "automated"}
              className="input-field"
            />
            <TooltipProvider>
              <div className={`flex items-start gap-2 mt-2 transition-opacity ${
                mode === "automated" ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Our AI will crawl your website to extract key information about your business</p>
                  </TooltipContent>
                </Tooltip>
                <p className="text-xs text-muted-foreground">
                  We&apos;ll analyze your website to understand your business and generate personalized content
                </p>
              </div>
            </TooltipProvider>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || !companyName.trim() || (mode === "automated" && !sourceUrl.trim())}
            className="btn-primary w-full py-6 text-base font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {mode === "automated" ? "Starting Analysis..." : "Creating Profile..."}
              </>
            ) : (
              <>
                {mode === "automated" ? "Start Analysis" : "Continue to Setup"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
