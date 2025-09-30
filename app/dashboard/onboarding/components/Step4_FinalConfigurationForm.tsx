"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { 
  TONE_OPTIONS, 
  TARGET_VERTICALS, 
  LEAD_QUALIFICATION_OPTIONS,
  NA_TIMEZONES, 
  DAYS
} from "../constants/formOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle2, AlertCircle, X, Plus, MessageSquare, Target, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Step4FinalConfigurationFormProps {
  mode?: "manual" | "automated";
  onComplete: () => void;
}

export function Step4FinalConfigurationForm({ 
  mode = "automated", // eslint-disable-line @typescript-eslint/no-unused-vars
  onComplete 
}: Step4FinalConfigurationFormProps) {
  const finalizeOnboarding = useMutation(api.sellerBrain.finalizeOnboardingPublic);
  const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [tone, setTone] = useState<string>("consultative");
  const [targetVertical, setTargetVertical] = useState<string>("");
  const [targetGeography, setTargetGeography] = useState<string>("");
  const [leadQualificationCriteria, setLeadQualificationCriteria] = useState<string[]>([]);
  const [timeZone, setTimeZone] = useState<string>("America/Los_Angeles");
  // Guardrails and core offer are now reviewed in Step 3; use profile values
  
  // Availability state
  const [availabilityDay, setAvailabilityDay] = useState<string>("Tue");
  const [availabilityStart, setAvailabilityStart] = useState("10:00");
  const [availabilityEnd, setAvailabilityEnd] = useState("12:00");
  const [availabilitySlots, setAvailabilitySlots] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; value?: string } | null>(null);

  // Form validation
  const isFormValid = 
    targetVertical.trim() !== "" &&
    targetGeography.trim() !== "" &&
    leadQualificationCriteria.length > 0 &&
    availabilitySlots.length > 0 &&
    (agencyProfile?.coreOffer?.trim() || "") !== "";

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
      if (leadQualificationCriteria.length === 0) {
        throw new Error("Please select at least one lead qualification criteria.");
      }
      if (availabilitySlots.length === 0) {
        throw new Error("Please add at least one availability slot.");
      }

      // Get approved claims from agency profile
      const approvedClaims = agencyProfile?.approvedClaims || [];
      const guardrails = agencyProfile?.guardrails || [];
      const coreOffer = agencyProfile?.coreOffer?.trim() || "";
      if (!coreOffer) {
        throw new Error("Missing core offer. Please complete Step 3.");
      }

      await finalizeOnboarding({
        approvedClaims,
        guardrails,
        tone,
        targetVertical,
        targetGeography: targetGeography.trim(),
        coreOffer,
        leadQualificationCriteria,
        timeZone,
        availability: availabilitySlots,
      });

      toast.success("Onboarding completed successfully!");
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
      toast.success("Availability slot added");
    } else {
      toast.info("This slot already exists");
    }
  };

  const handleRemoveAvailabilitySlot = (slotToRemove: string) => {
    setAvailabilitySlots(availabilitySlots.filter(slot => slot !== slotToRemove));
    setDeleteTarget(null);
    toast.success("Availability slot removed");
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
      <div className="card-warm-static p-6 md:p-8 mb-6 md:mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-3">
          Final Configuration
        </h1>
        <p className="text-base md:text-lg text-muted-foreground">
          Configure your AI assistant&apos;s personality and target market
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Tone Selection */}
        <div className="card-warm-static p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-base sm:text-lg font-semibold text-foreground">Communication Tone</h2>
          </div>
          <div className="space-y-2">
            <Label className="input-label">
              How should your AI assistant communicate?
            </Label>
            <Select value={tone} onValueChange={setTone}>
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
        </div>

        {/* Target Market Configuration */}
        <div className="card-warm-static p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-base sm:text-lg font-semibold text-foreground">Target Market</h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mb-6">
            Define your target market to help your AI assistant qualify leads better.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Target Vertical */}
            <div>
              <Label className="input-label">
                Target Vertical *
              </Label>
              <Select value={targetVertical} onValueChange={setTargetVertical} required>
                <SelectTrigger className="h-[42px]">
                  <SelectValue placeholder="Select an industry..." />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_VERTICALS.map(vertical => (
                    <SelectItem key={vertical} value={vertical}>{vertical}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Geography */}
            <div>
              <Label className="input-label">
                Target Geography *
              </Label>
              <Input
                type="text"
                value={targetGeography}
                onChange={(e) => setTargetGeography(e.target.value)}
                placeholder="e.g., Los Angeles, CA or United States"
                className="input-field h-[42px]"
                required
              />
            </div>
          </div>
        </div>

        {/* Lead Qualification Criteria */}
        <div className="card-warm-static p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">✅</span>
              <h2 className="text-base sm:text-lg font-semibold text-foreground">Lead Qualification Criteria</h2>
            </div>
            <Badge variant={leadQualificationCriteria.length > 0 ? "default" : "secondary"}>
              {leadQualificationCriteria.length} selected
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mb-4">
            Select criteria that indicate a business might need your services
          </p>
          
          <Separator className="mb-4" />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {LEAD_QUALIFICATION_OPTIONS.map(option => (
              <label key={option.value} className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-surface-raised hover:border-ring/40 cursor-pointer transition-all group">
                <Checkbox
                  checked={leadQualificationCriteria.includes(option.value)}
                  onCheckedChange={() => handleQualificationCriteriaToggle(option.value)}
                  className="mt-0.5 data-[state=checked]:bg-[hsl(var(--primary))] data-[state=checked]:border-[hsl(var(--primary))]"
                />
                <span className="text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors flex-1">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Timezone and Availability */}
        <div className="card-warm-static p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-base sm:text-lg font-semibold text-foreground">Availability Settings</h2>
          </div>
          
          <div className="space-y-6">
            {/* Timezone */}
            <div>
              <Label className="input-label">
                Time Zone
              </Label>
              <Select value={timeZone} onValueChange={setTimeZone}>
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

            <Separator />

            {/* Availability Slots */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="input-label">
                  Availability Slots *
                </Label>
                <Badge variant={availabilitySlots.length > 0 ? "default" : "secondary"}>
                  {availabilitySlots.length} slot{availabilitySlots.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              
              {/* Add Slot Form */}
              <div className="p-4 border border-dashed border-border rounded-lg bg-surface-raised/50 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Day
                    </Label>
                    <Select value={availabilityDay} onValueChange={setAvailabilityDay}>
                      <SelectTrigger className="h-[42px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS.map(day => (
                          <SelectItem key={day} value={day}>{day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Start Time
                    </Label>
                    <Input
                      type="time"
                      value={availabilityStart}
                      onChange={(e) => setAvailabilityStart(e.target.value)}
                      className="input-field h-[42px]"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      End Time
                    </Label>
                    <Input
                      type="time"
                      value={availabilityEnd}
                      onChange={(e) => setAvailabilityEnd(e.target.value)}
                      className="input-field h-[42px]"
                    />
                  </div>
                </div>
                
                <Button
                  type="button"
                  onClick={handleAddAvailabilitySlot}
                  size="sm"
                  className="btn-primary w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Time Slot
                </Button>
              </div>

              {/* Availability Slots Display */}
              {availabilitySlots.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {availabilitySlots.map((slot, index) => (
                    <div
                      key={index}
                      className="time-slot-badge time-slot-badge-removable"
                    >
                      <span>{slot}</span>
                      <AlertDialog open={deleteTarget?.type === 'slot' && deleteTarget?.value === slot} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setDeleteTarget({ type: 'slot', value: slot })}
                            style={{ backgroundColor: 'hsl(var(--destructive) / 0.25)' }}
                            className="h-6 w-6 p-0 hover:bg-[hsl(var(--destructive)/0.4)] text-destructive border-0 rounded-sm ml-1 transition-colors cursor-pointer"
                            aria-label={`Remove ${slot}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Availability Slot?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the time slot "{slot}" from your availability.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRemoveAvailabilitySlot(slot)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert className="mt-4">
                  <Clock className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Add at least one availability slot to continue
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="card-warm-static p-6 sticky bottom-0 z-10">
          <Button
            type="submit"
            disabled={loading || !isFormValid}
            size="lg"
            className="btn-primary w-full px-8 py-6 text-base font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Finalizing Setup...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Complete Onboarding
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}