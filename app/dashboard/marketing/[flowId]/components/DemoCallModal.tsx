"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Info, Phone, Mail } from "lucide-react";

type DemoCallModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: Id<"client_opportunities">;
  agencyId: Id<"agency_profile">;
  atlasCreditsBalance: number;
};

export default function DemoCallModal({
  open,
  onOpenChange,
  opportunityId,
  agencyId,
  atlasCreditsBalance,
}: DemoCallModalProps) {
  const router = useRouter();
  const startDemoCall = useAction(api.call.calls.startDemoCall);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isPhoneValid = phoneRegex.test(phoneNumber);
  const isEmailValid = emailRegex.test(email);
  const hasCredits = atlasCreditsBalance >= 1;
  const canSubmit = isPhoneValid && isEmailValid && hasCredits && !isStarting;

  const handleStartDemoCall = async () => {
    if (!canSubmit) return;

    setIsStarting(true);
    setError(null);

    try {
      const result = await startDemoCall({
        opportunityId,
        agencyId,
        overridePhone: phoneNumber,
        overrideEmail: email,
      });

      // Navigate to call detail page
      router.push(`/dashboard/calls/${result.callId}`);
      onOpenChange(false);
    } catch (err) {
      console.error("Start demo call failed:", err);
      const message = err instanceof Error ? err.message : "Failed to start demo call";
      setError(message);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Start Demo Call</DialogTitle>
          <DialogDescription className="text-base">
            Test the AI calling system with your own contact information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Info Alert */}
          <Alert className="border-primary/40 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm text-muted-foreground">
              This will start a real call to your number with the same AI assistant that would
              call prospects. <span className="font-semibold">1 atlas_credit</span> will be charged
              per minute.
            </AlertDescription>
          </Alert>

          {/* Phone Number Input */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-semibold">
              Your Phone Number
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                placeholder="+12025551234"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Use E.164 format: country code + number (e.g., +12025551234)
            </p>
            {phoneNumber && !isPhoneValid && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Invalid phone format. Example: +12025551234
              </p>
            )}
          </div>

          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-semibold">
              Your Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Used for calendar invite and follow-up if a meeting is booked
            </p>
            {email && !isEmailValid && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Invalid email format
              </p>
            )}
          </div>

          {/* Credits Warning */}
          {!hasCredits && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                You need at least 1 atlas_credit to start a demo call
              </AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isStarting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleStartDemoCall}
            disabled={!canSubmit}
            className="btn-primary"
          >
            {isStarting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting Call...
              </>
            ) : (
              <>
                <Phone className="mr-2 h-4 w-4" />
                Start Demo Call
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

