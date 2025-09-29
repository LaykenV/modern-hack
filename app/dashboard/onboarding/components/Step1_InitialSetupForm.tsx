"use client";

import { useAction, useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, AlertCircle, ArrowRight, Sparkles, Info } from "lucide-react";

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
    <div className="max-w-3xl mx-auto w-full">
      <div className="card-warm-static p-6 md:p-8 mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-3">
          Welcome to Atlas Outbound
        </h1>
        <p className="text-base md:text-lg text-muted-foreground">
          Let&apos;s set up your AI assistant to start generating qualified leads
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Name */}
        <div className="card-warm-static p-4 sm:p-6">
          <Label htmlFor="companyName" className="text-sm font-semibold">
            Company Name *
          </Label>
          <Input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Corp"
            disabled={loading}
            required
            className="mt-2"
          />
        </div>

        {/* Mode Selection */}
        <div className="card-warm-static p-4 sm:p-6">
          <Label className="text-sm font-semibold mb-4 block">
            Setup Mode *
          </Label>
          
          <RadioGroup value={mode} onValueChange={(value) => setMode(value as "manual" | "automated")} className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* Automated Mode */}
            <label 
              htmlFor="automated"
              className={`rounded-lg p-4 sm:p-5 cursor-pointer transition-all border-2 ${
                mode === "automated" 
                  ? "border-primary bg-gradient-to-br from-[hsl(var(--primary)/0.12)] to-[hsl(var(--primary)/0.06)] shadow-md" 
                  : "border-border bg-surface-raised hover:border-ring/40 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem value="automated" id="automated" className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-primary" />
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
              className={`rounded-lg p-4 sm:p-5 cursor-pointer transition-all border-2 ${
                mode === "manual" 
                  ? "border-primary bg-gradient-to-br from-[hsl(var(--primary)/0.12)] to-[hsl(var(--primary)/0.06)] shadow-md" 
                  : "border-border bg-surface-raised hover:border-ring/40 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem value="manual" id="manual" className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">✏️</span>
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

        {/* Website URL (only for automated mode) */}
        {mode === "automated" && (
          <div className="card-warm-static p-4 sm:p-6">
            <Label htmlFor="sourceUrl" className="text-sm font-semibold">
              Website URL *
            </Label>
            <Input
              id="sourceUrl"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={loading}
              required={mode === "automated"}
              className="mt-2"
            />
            <TooltipProvider>
              <div className="flex items-start gap-2 mt-3">
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
        )}

        <div className="pt-2">
          <Button
            type="submit"
            disabled={loading || !companyName.trim() || (mode === "automated" && !sourceUrl.trim())}
            className="w-full py-6 text-base font-semibold"
            size="lg"
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
          </Button>
        </div>
      </form>
    </div>
  );
}
