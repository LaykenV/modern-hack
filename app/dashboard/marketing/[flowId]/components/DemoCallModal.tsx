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
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Phone, Mail, PhoneCall } from "lucide-react";

type DemoCallModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: Id<"client_opportunities">;
  agencyId: Id<"agency_profile">;
  atlasCreditsBalance: number;
  userEmail: string;
};

export default function DemoCallModal({
  open,
  onOpenChange,
  opportunityId,
  agencyId,
  atlasCreditsBalance,
  userEmail,
}: DemoCallModalProps) {
  const router = useRouter();
  const startDemoCall = useAction(api.call.calls.startDemoCall);

  const [phoneNumber, setPhoneNumber] = useState("+1");
  const [email, setEmail] = useState(userEmail);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation - allow formatted or unformatted phone numbers
  const phoneRegex = /^\+[1-9][\d\s()\-]{1,18}$/; // Require + at the start, allow formatting chars
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
      // Strip formatting and ensure phone number has country code
      let cleanedPhone = phoneNumber.replace(/[^\d+]/g, '');
      if (!cleanedPhone.startsWith('+')) {
        cleanedPhone = `+${cleanedPhone}`;
      }
      
      const result = await startDemoCall({
        opportunityId,
        agencyId,
        overridePhone: cleanedPhone,
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
      <DialogPortal>
        <DialogOverlay className="bg-black/95 backdrop-blur-md" />
        <DialogContent className="sm:max-w-[540px] bg-gradient-to-br from-[hsl(var(--surface-raised))] to-[hsl(var(--surface-muted))] border border-[hsl(var(--border)/0.6)] shadow-[var(--shadow-strong)]" showCloseButton={true}>
        <DialogHeader className="space-y-3 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-[hsl(var(--primary)/0.15)] to-[hsl(var(--primary)/0.08)] border border-[hsl(var(--primary)/0.25)]">
              <PhoneCall className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground">Start Demo Call</DialogTitle>
          </div>
          <DialogDescription className="text-base text-muted-foreground">
            Test the AI calling system with your own contact information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* Info Alert */}
          <div className="rounded-lg border border-[hsl(var(--primary)/0.25)] bg-gradient-to-br from-[hsl(var(--primary)/0.06)] to-[hsl(var(--primary)/0.03)] p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              This will start a real call to your number with the same AI assistant that would
              call prospects. <span className="font-semibold text-foreground">1 atlas_credit</span> will be charged
              per minute.
              <br />
              <br />
              <span className="font-semibold text-foreground">Note:</span> The business owner will NOT be contacted or notified in any way. 
              This is a private demo for testing only.
            </p>
          </div>

          {/* Phone Number Input */}
          <div className="space-y-2.5">
            <Label htmlFor="phone" className="input-label">
              Your Phone Number
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                id="phone"
                type="tel"
                placeholder="+1 (202) 555-1234"
                value={phoneNumber}
                onChange={(e) => {
                  const value = e.target.value;
                  // Remove all non-digit characters except + at the start
                  const digitsOnly = value.replace(/[^\d+]/g, '');
                  
                  // Auto-prepend + if user starts typing without it
                  let cleaned = digitsOnly;
                  if (cleaned && !cleaned.startsWith('+')) {
                    cleaned = '+' + cleaned.replace(/\+/g, ''); // Remove any other + signs
                  }
                  
                  // Format for US/Canada numbers (+1)
                  if (cleaned.startsWith('+1') && cleaned.length > 2) {
                    const countryCode = '+1';
                    const rest = cleaned.slice(2);
                    
                    if (rest.length <= 3) {
                      cleaned = `${countryCode} (${rest}`;
                    } else if (rest.length <= 6) {
                      cleaned = `${countryCode} (${rest.slice(0, 3)}) ${rest.slice(3)}`;
                    } else {
                      cleaned = `${countryCode} (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6, 10)}`;
                    }
                  }
                  
                  setPhoneNumber(cleaned);
                }}
                style={{ paddingLeft: '2.5rem' }}
                className="input-field"
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Auto-formatted for US/Canada. For other countries, start with country code.
            </p>
            {phoneNumber && !isPhoneValid && (
              <div className="flex items-center gap-1.5 text-destructive">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <p className="text-xs font-medium">
                  Invalid format. Example: +1 (202) 555-1234
                </p>
              </div>
            )}
          </div>

          {/* Email Input */}
          <div className="space-y-2.5">
            <Label htmlFor="email" className="input-label">
              Your Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
                className="input-field"
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              If a meeting is booked, you&apos;ll receive <span className="font-semibold text-foreground">both</span> the prospect confirmation 
              and agency summary emails here (for testing purposes)
            </p>
            {email && !isEmailValid && (
              <div className="flex items-center gap-1.5 text-destructive">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <p className="text-xs font-medium">
                  Invalid email format
                </p>
              </div>
            )}
          </div>

          {/* Credits Warning */}
          {!hasCredits && (
            <Alert variant="destructive" className="border-[hsl(var(--destructive)/0.3)] bg-gradient-to-br from-[hsl(var(--destructive)/0.08)] to-[hsl(var(--destructive)/0.04)]">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <AlertDescription className="text-sm font-medium text-destructive">
                You need at least 1 atlas_credit to start a demo call
              </AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="border-[hsl(var(--destructive)/0.3)] bg-gradient-to-br from-[hsl(var(--destructive)/0.08)] to-[hsl(var(--destructive)/0.04)]">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <AlertDescription className="text-sm font-medium text-destructive">
                {error}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-3 pt-3 border-t border-[hsl(var(--border)/0.4)]">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isStarting}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--surface-muted))] text-foreground hover:bg-[hsl(var(--surface-raised))] hover:border-[hsl(var(--border))] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </Button>
          <Button
            onClick={handleStartDemoCall}
            disabled={!canSubmit}
            className="btn-primary px-5 py-2.5"
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
      </DialogPortal>
    </Dialog>
  );
}

