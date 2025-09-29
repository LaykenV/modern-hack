"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useState } from "react";
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
  Save,
  X,
  Plus,
  Trash2,
  MessageSquare,
  AlertTriangle,
  Loader2,
  RefreshCw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

// Import form options from onboarding constants
const TONE_OPTIONS = ["consultative", "professional", "friendly"];
const TARGET_VERTICALS = [
  "Roofing",
  "Plumbing",
  "Electricians",
  "HVAC",
  "Landscaping & Lawn Care",
  "Tree Services",
  "Pest Control",
  "Garage Door Services",
  "Solar Installers",
  "General Contractors & Remodeling",
  "Painting",
  "Cleaning Services",
  "Restoration (Water/Fire/Mold)",
  "Window Cleaning",
  "Pressure Washing",
  "Handyman",
  "Auto Repair",
  "Auto Body & Collision",
  "Tire Shops",
  "Dentists",
  "Chiropractors",
  "Physical Therapy",
  "Optometrists",
  "Med Spas",
  "Hair Salons & Barbers",
  "Law Firms",
  "Accountants & CPAs",
  "Real Estate Agents",
  "Property Management",
  "Mortgage Brokers"
];
const LEAD_QUALIFICATION_OPTIONS = [
  { value: "LOW_GOOGLE_RATING", label: "Low Google Rating" },
  { value: "FEW_GOOGLE_REVIEWS", label: "Few Google Reviews" },
  { value: "MISSING_WEBSITE", label: "Missing Website" },
  { value: "WEAK_WEB_PRESENCE", label: "Website is Social Profile Only" },
];
const NA_TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver", 
  "America/Phoenix",
  "America/Chicago",
  "America/New_York",
  "America/Anchorage",
  "America/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City"
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface ClaimDraft {
  id: string;
  text: string;
  source_url: string;
}

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
  const updateProfile = useMutation(api.sellerBrain.updateAgencyProfile);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; index?: number; value?: string } | null>(null);

  // Edit form state
  const [editSummary, setEditSummary] = useState("");
  const [editCoreOffer, setEditCoreOffer] = useState("");
  const [editClaims, setEditClaims] = useState<ClaimDraft[]>([]);
  const [editGuardrails, setEditGuardrails] = useState<string[]>([]);
  const [editTone, setEditTone] = useState("");
  const [editTargetVertical, setEditTargetVertical] = useState("");
  const [editTargetGeography, setEditTargetGeography] = useState("");
  const [editLeadQualificationCriteria, setEditLeadQualificationCriteria] = useState<string[]>([]);
  const [editTimeZone, setEditTimeZone] = useState("");
  const [editAvailability, setEditAvailability] = useState<string[]>([]);

  // Availability slot builder
  const [availabilityDay, setAvailabilityDay] = useState("Tue");
  const [availabilityStart, setAvailabilityStart] = useState("10:00");
  const [availabilityEnd, setAvailabilityEnd] = useState("12:00");

  // New claim/guardrail inputs
  const [newClaimText, setNewClaimText] = useState("");
  const [newClaimSourceUrl, setNewClaimSourceUrl] = useState("");
  const [newGuardrailText, setNewGuardrailText] = useState("");

  // Show loading skeleton while data is being fetched
  if (agencyProfile === undefined) {
    return <AgencyProfileSkeleton />;
  }

  // Show empty state if no profile exists
  if (agencyProfile === null) {
    return <EmptyAgencyProfile />;
  }

  const handleStartEdit = () => {
    setEditSummary(agencyProfile.summary || "");
    setEditCoreOffer(agencyProfile.coreOffer || "");
    setEditClaims(agencyProfile.approvedClaims || []);
    setEditGuardrails(agencyProfile.guardrails || []);
    setEditTone(agencyProfile.tone || "consultative");
    setEditTargetVertical(agencyProfile.targetVertical || "");
    setEditTargetGeography(agencyProfile.targetGeography || "");
    setEditLeadQualificationCriteria(agencyProfile.leadQualificationCriteria || []);
    setEditTimeZone(agencyProfile.timeZone || "America/Los_Angeles");
    setEditAvailability(agencyProfile.availability || []);
    setIsEditing(true);
    setError(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);

    try {
      await updateProfile({
        summary: editSummary.trim(),
        coreOffer: editCoreOffer.trim(),
        approvedClaims: editClaims,
        guardrails: editGuardrails,
        tone: editTone,
        targetVertical: editTargetVertical,
        targetGeography: editTargetGeography.trim(),
        leadQualificationCriteria: editLeadQualificationCriteria,
        timeZone: editTimeZone,
        availability: editAvailability,
      });
      setIsEditing(false);
      toast.success("Profile updated successfully!");
    } catch (err: unknown) {
      const message = typeof err === "object" && err && "message" in err
        ? String((err as { message?: unknown }).message)
        : null;
      const errorMsg = message ?? "Failed to update profile.";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddClaim = () => {
    if (!newClaimText.trim()) return;
    const newClaim: ClaimDraft = {
      id: `claim_${Date.now()}`,
      text: newClaimText.trim(),
      source_url: newClaimSourceUrl.trim(),
    };
    setEditClaims([...editClaims, newClaim]);
    setNewClaimText("");
    setNewClaimSourceUrl("");
    toast.success("Claim added");
  };

  const handleRemoveClaim = (index: number) => {
    setEditClaims(editClaims.filter((_, i) => i !== index));
    setDeleteTarget(null);
    toast.success("Claim removed");
  };

  const handleEditClaim = (index: number, field: keyof ClaimDraft, value: string) => {
    const updated = [...editClaims];
    updated[index] = { ...updated[index], [field]: value };
    setEditClaims(updated);
  };

  const handleAddGuardrail = () => {
    if (!newGuardrailText.trim()) return;
    if (editGuardrails.includes(newGuardrailText.trim())) {
      setNewGuardrailText("");
      toast.info("This guardrail already exists");
      return;
    }
    setEditGuardrails([...editGuardrails, newGuardrailText.trim()]);
    setNewGuardrailText("");
    toast.success("Guardrail added");
  };

  const handleRemoveGuardrail = (guardrail: string) => {
    setEditGuardrails(editGuardrails.filter(g => g !== guardrail));
    setDeleteTarget(null);
    toast.success("Guardrail removed");
  };

  const handleAddAvailabilitySlot = () => {
    if (!availabilityStart || !availabilityEnd) return;
    const slot = `${availabilityDay} ${availabilityStart}-${availabilityEnd}`;
    if (!editAvailability.includes(slot)) {
      setEditAvailability([...editAvailability, slot]);
      toast.success("Availability slot added");
    } else {
      toast.info("This slot already exists");
    }
  };

  const handleRemoveAvailabilitySlot = (slot: string) => {
    setEditAvailability(editAvailability.filter(s => s !== slot));
    toast.success("Availability slot removed");
  };

  const handleQualificationCriteriaToggle = (criteria: string) => {
    setEditLeadQualificationCriteria(prev => 
      prev.includes(criteria) 
        ? prev.filter(c => c !== criteria)
        : [...prev, criteria]
    );
  };

  return (
    <TooltipProvider>
      <main className="min-h-full p-4 sm:p-6 md:p-8 flex flex-col gap-4 sm:gap-6">
        <div className="max-w-6xl mx-auto w-full space-y-4 sm:space-y-6">
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
            <div className="flex items-center gap-2">
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
              {!isEditing ? (
                <Button onClick={handleStartEdit} variant="default" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Edit Profile</span>
                  <span className="sm:hidden">Edit</span>
                </Button>
              ) : (
                <>
                  <Button onClick={handleCancelEdit} variant="outline" size="sm" disabled={isSaving}>
                    <X className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Cancel</span>
                  </Button>
                  <Button onClick={handleSave} variant="default" size="sm" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                        <span className="hidden sm:inline">Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Save Changes</span>
                        <span className="sm:hidden">Save</span>
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <button 
                onClick={() => handleSave()} 
                className="ml-2 underline hover:no-underline"
              >
                Try again
              </button>
            </AlertDescription>
          </Alert>
        )}

        {/* Company Information (Read-only) */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl md:text-2xl font-bold text-foreground">Company Information</h2>
            <Badge variant="outline" className="ml-2 text-xs">Read-only</Badge>
          </div>

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
        </div>

        {/* Summary & Core Offer */}
        {isEditing ? (
          <>
            <div className="card-warm-static p-6 md:p-8">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-xl md:text-2xl font-bold text-foreground">Business Summary</h2>
              </div>
              <Label className="text-sm text-muted-foreground mb-2 block">
                Edit the summary of your business to ensure accuracy.
              </Label>
              <Textarea
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                placeholder="Enter a summary of your business..."
                rows={6}
                className="w-full"
              />
            </div>

            <div className="card-warm-static p-6 md:p-8">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="text-xl md:text-2xl font-bold text-foreground">Core Offer</h2>
              </div>
              <Label className="text-sm text-muted-foreground mb-2 block">
                Describe your main service offering or value proposition.
              </Label>
              <Textarea
                value={editCoreOffer}
                onChange={(e) => setEditCoreOffer(e.target.value)}
                placeholder="Describe your main service offering..."
                rows={4}
                className="w-full"
              />
            </div>
          </>
        ) : (
          <>
            {agencyProfile.summary && (
              <div className="card-warm-static p-6 md:p-8">
                <div className="flex items-center gap-2 mb-6">
                  <FileText className="h-5 w-5 text-primary" />
                  <h2 className="text-xl md:text-2xl font-bold text-foreground">Business Summary</h2>
                </div>
                <div className="p-5 bg-surface-overlay/60 border border-border/40 rounded-lg">
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                    {agencyProfile.summary}
                  </p>
                </div>
              </div>
            )}

            {agencyProfile.coreOffer && (
              <div className="card-warm-static p-6 md:p-8">
                <div className="flex items-center gap-2 mb-6">
                  <Target className="h-5 w-5 text-primary" />
                  <h2 className="text-xl md:text-2xl font-bold text-foreground">Core Offer</h2>
                </div>
                <div className="p-5 bg-surface-overlay/60 border border-border/40 rounded-lg">
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                    {agencyProfile.coreOffer}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Guardrails */}
        {isEditing ? (
          <div className="card-warm-static p-6 md:p-8">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <h2 className="text-xl md:text-2xl font-bold text-foreground">Guardrails</h2>
              <Badge variant="secondary">{editGuardrails.length} rule{editGuardrails.length !== 1 ? 's' : ''}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Add rules or guidelines for your AI assistant to follow when engaging with prospects.
            </p>

            {/* Existing Guardrails */}
            {editGuardrails.length > 0 && (
              <div className="space-y-2 mb-4">
                {editGuardrails.map((guardrail, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg"
                  >
                    <p className="text-foreground text-sm flex-1">{guardrail}</p>
                    <AlertDialog open={deleteTarget?.type === 'guardrail' && deleteTarget?.value === guardrail} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget({ type: 'guardrail', value: guardrail })}
                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                          aria-label="Delete guardrail"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Guardrail?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the guardrail rule. This action can be undone by re-adding the rule.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRemoveGuardrail(guardrail)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}

            {/* Add Guardrail */}
            <div className="flex gap-2">
              <Input
                value={newGuardrailText}
                onChange={(e) => setNewGuardrailText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddGuardrail())}
                placeholder="Add a business rule or guideline..."
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleAddGuardrail}
                disabled={!newGuardrailText.trim()}
                variant="outline"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
        ) : (
          Array.isArray(agencyProfile.guardrails) && agencyProfile.guardrails.length > 0 && (
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
          )
        )}

        {/* Claims */}
        {isEditing ? (
          <div className="card-warm-static p-6 md:p-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-xl md:text-2xl font-bold text-foreground">Business Claims</h2>
              </div>
              <Badge variant="secondary">{editClaims.length} claim{editClaims.length !== 1 ? 's' : ''}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Edit or add claims about your business that can be used to engage prospects.
            </p>

            {/* Existing Claims */}
            {editClaims.length > 0 && (
              <div className="space-y-4 mb-6">
                {editClaims.map((claim, index) => (
                  <div key={claim.id} className="border border-border rounded-lg p-4 bg-surface-raised">
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant="outline" className="text-xs">Claim {index + 1}</Badge>
                      <AlertDialog open={deleteTarget?.type === 'claim' && deleteTarget?.index === index} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget({ type: 'claim', index })}
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            aria-label="Delete claim"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Claim?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove this business claim. This action can be undone by re-adding the claim.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRemoveClaim(index)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">Claim Text</Label>
                        <Textarea
                          value={claim.text}
                          onChange={(e) => handleEditClaim(index, "text", e.target.value)}
                          rows={2}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">Source URL (optional)</Label>
                        <Input
                          type="url"
                          value={claim.source_url || ""}
                          onChange={(e) => handleEditClaim(index, "source_url", e.target.value)}
                          placeholder="https://example.com/source"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Claim */}
            <div className="border border-dashed border-border rounded-lg p-4 bg-surface-raised/50">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add New Claim
              </h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Claim Text</Label>
                  <Textarea
                    value={newClaimText}
                    onChange={(e) => setNewClaimText(e.target.value)}
                    placeholder="e.g., We helped 50+ businesses increase their revenue by 30%"
                    rows={2}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Source URL (optional)</Label>
                  <Input
                    type="url"
                    value={newClaimSourceUrl}
                    onChange={(e) => setNewClaimSourceUrl(e.target.value)}
                    placeholder="https://example.com/case-study"
                    className="mt-1"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleAddClaim}
                  disabled={!newClaimText.trim()}
                  variant="outline"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Claim
                </Button>
              </div>
            </div>
          </div>
        ) : (
          Array.isArray(agencyProfile.approvedClaims) && agencyProfile.approvedClaims.length > 0 && (
            <div className="card-warm-static p-6 md:p-8">
              <div className="flex items-center gap-2 mb-6">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-xl md:text-2xl font-bold text-foreground">Business Claims</h2>
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
          )
        )}

        {/* Communication Settings */}
        {isEditing ? (
          <div className="card-warm-static p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6">
              <Palette className="h-5 w-5 text-primary" />
              <h2 className="text-xl md:text-2xl font-bold text-foreground">Communication Settings</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="flex items-center gap-2 text-sm font-semibold mb-2">
                  <MessageSquare className="h-4 w-4" />
                  Communication Tone
                </Label>
                <Select value={editTone} onValueChange={setEditTone}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map(option => (
                      <SelectItem key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="flex items-center gap-2 text-sm font-semibold mb-2">
                  <Clock className="h-4 w-4" />
                  Time Zone
                </Label>
                <Select value={editTimeZone} onValueChange={setEditTimeZone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NA_TIMEZONES.map(tz => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Availability */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <Label className="text-sm font-semibold">Availability Slots</Label>
                <Badge variant={editAvailability.length > 0 ? "default" : "secondary"}>
                  {editAvailability.length} slot{editAvailability.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              
              {/* Add Slot Form */}
              <div className="flex flex-col sm:flex-row gap-2 mb-3 p-3 border border-dashed border-border rounded-lg bg-surface-raised/50">
                <Select value={availabilityDay} onValueChange={setAvailabilityDay}>
                  <SelectTrigger className="w-full sm:w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map(day => (
                      <SelectItem key={day} value={day}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Input
                  type="time"
                  value={availabilityStart}
                  onChange={(e) => setAvailabilityStart(e.target.value)}
                  className="w-full sm:flex-1"
                />
                
                <span className="flex items-center justify-center text-sm text-muted-foreground px-2">
                  to
                </span>
                
                <Input
                  type="time"
                  value={availabilityEnd}
                  onChange={(e) => setAvailabilityEnd(e.target.value)}
                  className="w-full sm:flex-1"
                />
                
                <Button
                  type="button"
                  onClick={handleAddAvailabilitySlot}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              {/* Availability Slots Display */}
              {editAvailability.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editAvailability.map((slot, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="pl-3 pr-1 py-1.5 text-sm gap-2"
                    >
                      <span className="font-medium">{slot}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAvailabilitySlot(slot)}
                            className="h-5 w-5 p-0 hover:bg-destructive/20 hover:text-destructive rounded-full"
                            aria-label="Remove availability slot"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Remove slot</p>
                        </TooltipContent>
                      </Tooltip>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card-warm-static p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6">
              <Palette className="h-5 w-5 text-primary" />
              <h2 className="text-xl md:text-2xl font-bold text-foreground">Communication Settings</h2>
            </div>

            <div className="space-y-6">
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

              {Array.isArray(agencyProfile.availability) && agencyProfile.availability.length > 0 && (
                <>
                  <Separator className="my-6" />
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Availability Windows
                    </label>
                    <div className="flex flex-wrap gap-2">
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
        )}

        {/* Target Market */}
        {isEditing ? (
          <div className="card-warm-static p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6">
              <Target className="h-5 w-5 text-primary" />
              <h2 className="text-xl md:text-2xl font-bold text-foreground">Target Market</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <Label className="flex items-center gap-2 text-sm font-semibold mb-2">
                  <span className="text-xl">🏢</span>
                  Target Vertical
                </Label>
                <Select value={editTargetVertical} onValueChange={setEditTargetVertical}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an industry..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_VERTICALS.map(vertical => (
                      <SelectItem key={vertical} value={vertical}>{vertical}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="flex items-center gap-2 text-sm font-semibold mb-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Target Geography
                </Label>
                <Input
                  type="text"
                  value={editTargetGeography}
                  onChange={(e) => setEditTargetGeography(e.target.value)}
                  placeholder="e.g., Los Angeles, CA"
                />
              </div>
            </div>

            <Separator className="my-6" />

            {/* Lead Qualification Criteria */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <Label className="text-sm font-semibold">Lead Qualification Criteria</Label>
                <Badge variant={editLeadQualificationCriteria.length > 0 ? "default" : "secondary"}>
                  {editLeadQualificationCriteria.length} selected
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {LEAD_QUALIFICATION_OPTIONS.map(option => (
                  <label key={option.value} className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-surface-raised hover:border-ring/40 cursor-pointer transition-all group">
                    <Checkbox
                      checked={editLeadQualificationCriteria.includes(option.value)}
                      onCheckedChange={() => handleQualificationCriteriaToggle(option.value)}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-foreground group-hover:text-primary transition-colors flex-1">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="card-warm-static p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6">
              <Target className="h-5 w-5 text-primary" />
              <h2 className="text-xl md:text-2xl font-bold text-foreground">Target Market</h2>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Target className="h-4 w-4" />
                    Target Vertical
                  </label>
                  <div className="p-4 bg-surface-overlay/50 border border-border/40 rounded-lg min-h-[56px] flex items-center">
                    {agencyProfile.targetVertical ? (
                      <Badge variant="outline" className="bg-primary/5">
                        {agencyProfile.targetVertical}
                      </Badge>
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

              {Array.isArray(agencyProfile.leadQualificationCriteria) && agencyProfile.leadQualificationCriteria.length > 0 && (
                <>
                  <Separator className="my-6" />
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4" />
                      Lead Qualification Criteria
                    </label>
                    <div className="flex flex-wrap gap-2">
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
        )}
        </div>
      </main>
    </TooltipProvider>
  );
}