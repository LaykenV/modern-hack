"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { GuardrailsInput } from "./GuardrailsInput";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, AlertCircle, Plus, Trash2, FileText, Shield, Target, Briefcase } from "lucide-react";
import { toast } from "sonner";

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
  initialGuardrails?: string[];
  onSaved: () => void;
}

export function ReviewAndEditGenerated({ 
  agencyProfileId,
  mode = "automated",
  initialSummary = "",
  initialCoreOffer = "",
  initialClaims = [],
  initialGuardrails = [],
  onSaved 
}: ReviewAndEditGeneratedProps) {
  const saveReviewed = useMutation(api.sellerBrain.saveReviewedContentPublic);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [summary, setSummary] = useState(initialSummary);
  const [coreOffer, setCoreOffer] = useState(initialCoreOffer);
  const [claims, setClaims] = useState<ClaimDraft[]>(initialClaims);
  const [guardrails, setGuardrails] = useState<string[]>(initialGuardrails);
  
  // New claim form state
  const [newClaimText, setNewClaimText] = useState("");
  const [newClaimSourceUrl, setNewClaimSourceUrl] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; index?: number } | null>(null);

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
        guardrails,
      });

      toast.success("Content saved successfully!");
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
    toast.success("Claim added");
  };

  const handleEditClaim = (index: number, field: keyof ClaimDraft, value: string) => {
    const updatedClaims = [...claims];
    updatedClaims[index] = { ...updatedClaims[index], [field]: value };
    setClaims(updatedClaims);
  };

  const handleRemoveClaim = (index: number) => {
    setClaims(claims.filter((_, i) => i !== index));
    setDeleteTarget(null);
    toast.success("Claim removed");
  };

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="card-warm-static p-6 md:p-8 mb-6 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-3">
          Review & Edit Content
        </h1>
        <p className="text-base md:text-lg text-muted-foreground">
          Review and edit the generated content to ensure accuracy
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="overview" className="gap-2 cursor-pointer">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-2 cursor-pointer">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Content</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {/* Summary Section */}
              <div className="card-warm-static p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h2 className="text-base sm:text-lg font-semibold text-foreground">Business Summary</h2>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                  Edit the generated summary of your business to ensure accuracy.
                </p>
                <div>
                  <Label className="input-label">Summary</Label>
                  <Textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Enter a summary of your business, services, and value proposition..."
                    rows={6}
                    required
                    className="input-field"
                  />
                </div>
              </div>

              {/* Core Offer Section */}
              <div className="card-warm-static p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-5 w-5 text-primary" />
                  <h2 className="text-base sm:text-lg font-semibold text-foreground">Core Offer</h2>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                  Describe your main service offering or value proposition.
                </p>
                <div>
                  <Label className="input-label">Core Offer</Label>
                  <Textarea
                    value={coreOffer}
                    onChange={(e) => setCoreOffer(e.target.value)}
                    placeholder="Describe your main service offering, what problems you solve, and how you help clients..."
                    rows={4}
                    required
                    className="input-field"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-6">

            {/* Guardrails Section */}
            <div className="card-warm-static p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="text-base sm:text-lg font-semibold text-foreground">Guardrails</h2>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                Add rules or guidelines for your AI assistant to follow when engaging with prospects.
              </p>
              <GuardrailsInput guardrails={guardrails} onGuardrailsChange={setGuardrails} />
            </div>

            {/* Claims Section */}
            <div className="card-warm-static p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <h2 className="text-base sm:text-lg font-semibold text-foreground">Business Claims</h2>
                </div>
                {claims.length > 0 && (
                  <Badge variant="secondary">{claims.length} claim{claims.length !== 1 ? 's' : ''}</Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                Edit or add claims about your business that can be used to engage prospects. 
                Claims should be specific, measurable, and verifiable.
              </p>
              <Separator className="my-4" />

              {/* Existing Claims */}
              {claims.length > 0 && (
                <div className="space-y-3 sm:space-y-4 mb-6">
                  {claims.map((claim, index) => (
                    <div key={claim.id || index} className="border border-border rounded-lg p-3 sm:p-4 bg-surface-raised hover:border-ring/40 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="time-slot-badge">
                          <Briefcase className="h-3.5 w-3.5" />
                          <span>Claim {index + 1}</span>
                        </div>
                        <AlertDialog open={deleteTarget?.type === 'claim' && deleteTarget?.index === index} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setDeleteTarget({ type: 'claim', index })}
                              style={{ backgroundColor: 'hsl(var(--destructive) / 0.25)' }}
                              className="h-8 w-8 p-0 hover:bg-[hsl(var(--destructive)/0.4)] text-destructive border-0 rounded-lg transition-colors cursor-pointer"
                              aria-label={`Remove claim ${index + 1}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Claim?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove this business claim from your profile.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRemoveClaim(index)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <Label className="input-label">
                            Claim Text
                          </Label>
                          <Textarea
                            value={claim.text}
                            onChange={(e) => handleEditClaim(index, "text", e.target.value)}
                            rows={2}
                            required
                            className="input-field"
                          />
                        </div>
                        
                        {mode !== "manual" && (
                          <div>
                            <Label className="input-label">
                              Source URL (optional)
                            </Label>
                            <Input
                              type="url"
                              value={claim.source_url || ""}
                              onChange={(e) => handleEditClaim(index, "source_url", e.target.value)}
                              placeholder="https://example.com/source"
                              className="input-field"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Claim */}
              <div className="border border-dashed border-border rounded-lg p-3 sm:p-4 bg-surface-raised/50 hover:bg-surface-raised/80 transition-colors">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add New Claim
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <Label className="input-label">
                      Claim Text
                    </Label>
                    <Textarea
                      value={newClaimText}
                      onChange={(e) => setNewClaimText(e.target.value)}
                      placeholder="e.g., We helped 50+ businesses increase their revenue by 30% in 6 months"
                      rows={2}
                      className="input-field"
                    />
                  </div>
                  
                  {mode !== "manual" && (
                    <div>
                      <Label className="input-label">
                        Source URL (optional)
                      </Label>
                      <Input
                        type="url"
                        value={newClaimSourceUrl}
                        onChange={(e) => setNewClaimSourceUrl(e.target.value)}
                        placeholder="https://example.com/case-study"
                        className="input-field"
                      />
                    </div>
                  )}
                  
                  <Button
                    type="button"
                    onClick={handleAddClaim}
                    disabled={!newClaimText.trim()}
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Claim
                  </Button>
                </div>
              </div>

              {claims.length === 0 && (
                <Alert className="mt-4">
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    No claims added yet. Add claims to help your AI assistant engage prospects effectively.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Submit Button - Always visible at bottom */}
        <div className="card-warm-static p-6 sticky bottom-0 z-10">
          <Button
            type="submit"
            disabled={loading || !summary.trim() || !coreOffer.trim()}
            size="lg"
            className="btn-primary w-full px-8 py-6 text-base font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Saving Content...
              </>
            ) : (
              <>
                Save & Continue
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
