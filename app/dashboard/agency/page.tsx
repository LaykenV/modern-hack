"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useState } from "react";
import { 
  Building2, 
  Target, 
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
  AlertTriangle,
  Loader2,
  Settings,
  Briefcase,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import form options from onboarding constants
const TONE_OPTIONS = ["consultative", "professional", "friendly"];
const TARGET_VERTICALS = [
  "Roofing", "Plumbing", "Electricians", "HVAC", "Landscaping & Lawn Care",
  "Tree Services", "Pest Control", "Garage Door Services", "Solar Installers",
  "General Contractors & Remodeling", "Painting", "Cleaning Services",
  "Restoration (Water/Fire/Mold)", "Window Cleaning", "Pressure Washing",
  "Handyman", "Auto Repair", "Auto Body & Collision", "Tire Shops",
  "Dentists", "Chiropractors", "Physical Therapy", "Optometrists", "Med Spas",
  "Hair Salons & Barbers", "Law Firms", "Accountants & CPAs", "Real Estate Agents",
  "Property Management", "Mortgage Brokers"
];
const LEAD_QUALIFICATION_OPTIONS = [
  { value: "LOW_GOOGLE_RATING", label: "Low Google Rating" },
  { value: "FEW_GOOGLE_REVIEWS", label: "Few Google Reviews" },
  { value: "MISSING_WEBSITE", label: "Missing Website" },
  { value: "WEAK_WEB_PRESENCE", label: "Website is Social Profile Only" },
];
const NA_TIMEZONES = [
  "America/Los_Angeles", "America/Denver", "America/Phoenix", "America/Chicago",
  "America/New_York", "America/Anchorage", "America/Honolulu", "America/Toronto",
  "America/Vancouver", "America/Mexico_City"
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface ClaimDraft {
  id: string;
  text: string;
  source_url: string;
}

function AgencyProfileSkeleton() {
  return (
    <main className="min-h-full p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Skeleton */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <Skeleton className="h-6 w-24" />
        </div>

        {/* Tabs Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function EmptyAgencyProfile() {
  return (
    <main className="min-h-full p-6 md:p-8 flex flex-col gap-6">
      <div className="max-w-7xl mx-auto w-full">
        <div className="card-warm-static p-16 text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-3">No Agency Profile Found</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Complete the onboarding process to create your agency profile and start using Atlas.
          </p>
          <Button asChild size="lg">
            <Link href="/dashboard/onboarding">Start Onboarding</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function AgencyPage() {
  const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);
  const updateProfile = useMutation(api.sellerBrain.updateAgencyProfile);

  const [editingSection, setEditingSection] = useState<string | null>(null);
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

  const [availabilityDay, setAvailabilityDay] = useState("Tue");
  const [availabilityStart, setAvailabilityStart] = useState("10:00");
  const [availabilityEnd, setAvailabilityEnd] = useState("12:00");
  const [newClaimText, setNewClaimText] = useState("");
  const [newClaimSourceUrl, setNewClaimSourceUrl] = useState("");
  const [newGuardrailText, setNewGuardrailText] = useState("");

  if (agencyProfile === undefined) return <AgencyProfileSkeleton />;
  if (agencyProfile === null) return <EmptyAgencyProfile />;

  const handleStartEdit = (section: string) => {
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
    setEditingSection(section);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingSection(null);
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
      setEditingSection(null);
      toast.success("Profile updated successfully!");
    } catch (err: unknown) {
      const message = typeof err === "object" && err && "message" in err ? String((err as { message?: unknown }).message) : null;
      const errorMsg = message ?? "Failed to update profile.";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddClaim = () => {
    if (!newClaimText.trim()) return;
    setEditClaims([...editClaims, { id: `claim_${Date.now()}`, text: newClaimText.trim(), source_url: newClaimSourceUrl.trim() }]);
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
      prev.includes(criteria) ? prev.filter(c => c !== criteria) : [...prev, criteria]
    );
  };

  return (
    <TooltipProvider>
      <main className="min-h-full p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Compact Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{agencyProfile.companyName}</h1>
                <p className="text-sm text-muted-foreground">Agency Profile & Settings</p>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error} <button onClick={handleSave} className="ml-2 underline">Try again</button></AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 max-w-2xl">
              <TabsTrigger value="overview" className="gap-2 cursor-pointer">
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="content" className="gap-2 cursor-pointer">
                <CheckCircle2 className="h-4 w-4" />
                <span className="hidden sm:inline">Content</span>
              </TabsTrigger>
              <TabsTrigger value="targeting" className="gap-2 cursor-pointer">
                <Target className="h-4 w-4" />
                <span className="hidden sm:inline">Targeting</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="card-warm-static p-6 md:p-8">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    <Building2 className="h-5 w-5 text-primary" />
                    Company Information
                  </h3>
                  <a href={agencyProfile.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                    {agencyProfile.sourceUrl} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Summary */}
                <div className="card-warm-static p-6 md:p-8">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Business Summary
                    </h3>
                    {editingSection !== 'summary' ? (
                      <Button onClick={() => handleStartEdit('summary')} variant="ghost" size="sm" aria-label="Edit summary">
                        <Edit className="h-4 w-4" />
                      </Button>
                    ) : (
                      <div className="flex gap-1">
                        <Button onClick={handleCancelEdit} variant="ghost" size="sm" disabled={isSaving} aria-label="Cancel editing">
                          <X className="h-4 w-4" />
                        </Button>
                        <Button onClick={handleSave} variant="ghost" size="sm" disabled={isSaving} aria-label="Save changes">
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        </Button>
                      </div>
                    )}
                  </div>
                  {editingSection === 'summary' ? (
                    <Textarea value={editSummary} onChange={(e) => setEditSummary(e.target.value)} placeholder="Enter a summary..." rows={8} className="input-field text-sm" />
                  ) : (
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{agencyProfile.summary || "No summary provided"}</p>
                  )}
                </div>

                {/* Core Offer */}
                <div className="card-warm-static p-6 md:p-8">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      Core Offer
                    </h3>
                    {editingSection !== 'offer' ? (
                      <Button onClick={() => handleStartEdit('offer')} variant="ghost" size="sm" aria-label="Edit core offer">
                        <Edit className="h-4 w-4" />
                      </Button>
                    ) : (
                      <div className="flex gap-1">
                        <Button onClick={handleCancelEdit} variant="ghost" size="sm" disabled={isSaving} aria-label="Cancel editing">
                          <X className="h-4 w-4" />
                        </Button>
                        <Button onClick={handleSave} variant="ghost" size="sm" disabled={isSaving} aria-label="Save changes">
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        </Button>
                      </div>
                    )}
                  </div>
                  {editingSection === 'offer' ? (
                    <Textarea value={editCoreOffer} onChange={(e) => setEditCoreOffer(e.target.value)} placeholder="Describe your main service..." rows={8} className="input-field text-sm" />
                  ) : (
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{agencyProfile.coreOffer || "No core offer provided"}</p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Content Tab */}
            <TabsContent value="content" className="space-y-6">
              {/* Guardrails */}
              <div className="card-warm-static p-6 md:p-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-amber-600" />
                    Guardrails
                    <Badge variant="secondary" className="ml-2">{agencyProfile.guardrails?.length || 0}</Badge>
                  </h3>
                  {editingSection !== 'guardrails' ? (
                    <Button onClick={() => handleStartEdit('guardrails')} variant="ghost" size="sm" aria-label="Edit guardrails">
                      <Edit className="h-4 w-4" />
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button onClick={handleCancelEdit} variant="ghost" size="sm" disabled={isSaving} aria-label="Cancel editing">
                        <X className="h-4 w-4" />
                      </Button>
                      <Button onClick={handleSave} variant="ghost" size="sm" disabled={isSaving} aria-label="Save changes">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </div>

                {editingSection === 'guardrails' ? (
                  <div className="space-y-3">
                    {editGuardrails.map((g, i) => (
                      <div key={i} className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <p className="text-sm flex-1">{g}</p>
                        <AlertDialog open={deleteTarget?.type === 'guardrail' && deleteTarget?.value === g} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
                          <AlertDialogTrigger asChild>
                            <Button type="button" size="sm" onClick={() => setDeleteTarget({ type: 'guardrail', value: g })} style={{ backgroundColor: 'hsl(var(--destructive) / 0.25)' }} className="h-8 w-8 p-0 hover:bg-[hsl(var(--destructive)/0.4)] text-destructive border-0 rounded-lg transition-colors cursor-pointer" aria-label="Remove guardrail">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Guardrail?</AlertDialogTitle>
                              <AlertDialogDescription>This will remove the guardrail rule.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRemoveGuardrail(g)} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Input value={newGuardrailText} onChange={(e) => setNewGuardrailText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddGuardrail())} placeholder="Add a business rule..." className="input-field flex-1" />
                      <Button onClick={handleAddGuardrail} disabled={!newGuardrailText.trim()} variant="outline"><Plus className="h-4 w-4 mr-1" />Add</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {agencyProfile.guardrails && agencyProfile.guardrails.length > 0 ? (
                      agencyProfile.guardrails.map((g, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                          <Shield className="h-4 w-4 text-amber-600 mt-0.5" />
                          <p className="text-sm flex-1">{g}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No guardrails set</p>
                    )}
                  </div>
                )}
              </div>

              {/* Claims */}
              <div className="card-warm-static p-6 md:p-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Business Claims
                    <Badge variant="secondary" className="ml-2">{agencyProfile.approvedClaims?.length || 0}</Badge>
                  </h3>
                  {editingSection !== 'claims' ? (
                    <Button onClick={() => handleStartEdit('claims')} variant="ghost" size="sm" aria-label="Edit claims">
                      <Edit className="h-4 w-4" />
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button onClick={handleCancelEdit} variant="ghost" size="sm" disabled={isSaving} aria-label="Cancel editing">
                        <X className="h-4 w-4" />
                      </Button>
                      <Button onClick={handleSave} variant="ghost" size="sm" disabled={isSaving} aria-label="Save changes">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </div>

                {editingSection === 'claims' ? (
                  <div className="space-y-4">
                    {editClaims.map((claim, i) => (
                      <div key={claim.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="time-slot-badge">
                            <Briefcase className="h-3.5 w-3.5" />
                            <span>Claim {i + 1}</span>
                          </div>
                          <AlertDialog open={deleteTarget?.type === 'claim' && deleteTarget?.index === i} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
                            <AlertDialogTrigger asChild>
                              <Button type="button" size="sm" onClick={() => setDeleteTarget({ type: 'claim', index: i })} style={{ backgroundColor: 'hsl(var(--destructive) / 0.25)' }} className="h-8 w-8 p-0 hover:bg-[hsl(var(--destructive)/0.4)] text-destructive border-0 rounded-lg transition-colors cursor-pointer" aria-label="Delete claim">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Claim?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently remove this business claim.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRemoveClaim(i)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                        <div className="space-y-2">
                          <label className="input-label text-xs">Claim Text</label>
                          <Textarea value={claim.text} onChange={(e) => handleEditClaim(i, "text", e.target.value)} rows={2} className="input-field" />
                        </div>
                        <div className="space-y-2">
                          <label className="input-label text-xs">Source URL (optional)</label>
                          <Input type="url" className="input-field" value={claim.source_url || ""} onChange={(e) => handleEditClaim(i, "source_url", e.target.value)} placeholder="https://..." />
                        </div>
                      </div>
                    ))}
                    <div className="border border-dashed rounded-lg p-4 space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2"><Plus className="h-4 w-4" />Add New Claim</h4>
                      <div className="space-y-2">
                        <label className="input-label text-xs">Claim Text</label>
                        <Textarea value={newClaimText} onChange={(e) => setNewClaimText(e.target.value)} placeholder="e.g., We helped 50+ businesses..." rows={2} className="input-field" />
                      </div>
                      <div className="space-y-2">
                        <label className="input-label text-xs">Source URL (optional)</label>
                        <Input type="url" className="input-field" value={newClaimSourceUrl} onChange={(e) => setNewClaimSourceUrl(e.target.value)} placeholder="https://..." />
                      </div>
                      <Button onClick={handleAddClaim} disabled={!newClaimText.trim()} variant="outline" size="sm"><Plus className="h-4 w-4 mr-2" />Add Claim</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {agencyProfile.approvedClaims && agencyProfile.approvedClaims.length > 0 ? (
                      agencyProfile.approvedClaims.map((claim, index) => (
                        <div key={claim.id} className="p-4 border rounded-lg">
                          <div className="flex items-start gap-3">
                            <div className="time-slot-badge flex-shrink-0">
                              <Briefcase className="h-3.5 w-3.5" />
                              <span>Claim {index + 1}</span>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm mb-2">{claim.text}</p>
                              {claim.source_url && (
                                <a href={claim.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                                  <ExternalLink className="h-3 w-3" />View Source
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No claims added</p>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Targeting Tab */}
            <TabsContent value="targeting" className="space-y-6">
              <div className="card-warm-static p-6 md:p-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Target Market
                  </h3>
                  {editingSection !== 'targeting' ? (
                    <Button onClick={() => handleStartEdit('targeting')} variant="ghost" size="sm" aria-label="Edit targeting">
                      <Edit className="h-4 w-4" />
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button onClick={handleCancelEdit} variant="ghost" size="sm" disabled={isSaving} aria-label="Cancel editing">
                        <X className="h-4 w-4" />
                      </Button>
                      <Button onClick={handleSave} variant="ghost" size="sm" disabled={isSaving} aria-label="Save changes">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </div>

                {editingSection === 'targeting' ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="input-label">Target Vertical</label>
                        <Select value={editTargetVertical} onValueChange={setEditTargetVertical}>
                          <SelectTrigger><SelectValue placeholder="Select industry..." /></SelectTrigger>
                          <SelectContent>{TARGET_VERTICALS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="input-label">Target Geography</label>
                        <Input className="input-field" value={editTargetGeography} onChange={(e) => setEditTargetGeography(e.target.value)} placeholder="e.g., Los Angeles, CA" />
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <label className="input-label">Lead Qualification Criteria</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {LEAD_QUALIFICATION_OPTIONS.map(opt => (
                          <label key={opt.value} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-surface-raised">
                            <Checkbox checked={editLeadQualificationCriteria.includes(opt.value)} onCheckedChange={() => handleQualificationCriteriaToggle(opt.value)} />
                            <span className="text-sm">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-sm text-muted-foreground">Target Vertical</label>
                        <div className="mt-1">{agencyProfile.targetVertical ? <Badge>{agencyProfile.targetVertical}</Badge> : <p className="text-sm text-muted-foreground">Not specified</p>}</div>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">Target Geography</label>
                        <p className="text-sm mt-1">{agencyProfile.targetGeography || "Not specified"}</p>
                      </div>
                    </div>
                    {agencyProfile.leadQualificationCriteria && agencyProfile.leadQualificationCriteria.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <label className="text-sm text-muted-foreground">Lead Qualification Criteria</label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {agencyProfile.leadQualificationCriteria.map((c, i) => (
                              <Badge key={i} variant="default">{c.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</Badge>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <div className="card-warm-static p-6 md:p-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Palette className="h-5 w-5 text-primary" />
                    Communication Settings
                  </h3>
                  {editingSection !== 'settings' ? (
                    <Button onClick={() => handleStartEdit('settings')} variant="ghost" size="sm" aria-label="Edit settings">
                      <Edit className="h-4 w-4" />
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button onClick={handleCancelEdit} variant="ghost" size="sm" disabled={isSaving} aria-label="Cancel editing">
                        <X className="h-4 w-4" />
                      </Button>
                      <Button onClick={handleSave} variant="ghost" size="sm" disabled={isSaving} aria-label="Save changes">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </div>

                {editingSection === 'settings' ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="input-label">Communication Tone</label>
                        <Select value={editTone} onValueChange={setEditTone}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{TONE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="input-label">Time Zone</label>
                        <Select value={editTimeZone} onValueChange={setEditTimeZone}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{NA_TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <label className="input-label">Availability Slots</label>
                        <Badge variant="secondary">{editAvailability.length}</Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-3 mb-3 p-4 border border-dashed rounded-lg bg-surface-muted/50">
                        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_auto_1fr_auto] gap-3 items-center">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Day</label>
                            <Select value={availabilityDay} onValueChange={setAvailabilityDay}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Start Time</label>
                            <Input type="time" value={availabilityStart} onChange={(e) => setAvailabilityStart(e.target.value)} className="input-field" />
                          </div>
                          <span className="text-sm text-muted-foreground self-end pb-2.5">to</span>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">End Time</label>
                            <Input type="time" value={availabilityEnd} onChange={(e) => setAvailabilityEnd(e.target.value)} className="input-field" />
                          </div>
                          <Button onClick={handleAddAvailabilitySlot} variant="outline" size="sm" className="self-end mb-0.5">
                            <Plus className="h-4 w-4 mr-1" />Add
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {editAvailability.map((slot, i) => (
                          <div key={i} className="time-slot-badge time-slot-badge-removable">
                            <span>{slot}</span>
                            <Button type="button" size="sm" onClick={() => handleRemoveAvailabilitySlot(slot)} style={{ backgroundColor: 'hsl(var(--destructive) / 0.25)' }} className="h-5 w-5 p-0 hover:bg-[hsl(var(--destructive)/0.4)] text-destructive border-0 rounded-sm transition-colors cursor-pointer" aria-label="Remove availability slot">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-sm text-muted-foreground">Communication Tone</label>
                        <p className="text-sm mt-1">{agencyProfile.tone || "Not specified"}</p>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">Time Zone</label>
                        <p className="text-sm mt-1">{agencyProfile.timeZone || "Not specified"}</p>
                      </div>
                    </div>
                    {agencyProfile.availability && agencyProfile.availability.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <label className="text-sm text-muted-foreground">Availability</label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {agencyProfile.availability.map((slot, i) => (
                              <div key={i} className="time-slot-badge">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{slot}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </TooltipProvider>
  );
}