"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCustomer, CheckoutDialog } from "autumn-js/react";
import { cn } from "@/lib/utils";
import { PLANS } from "@/lib/autumn/plans";

// Updated interface to work with billingBlock from backend
export interface PaywallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billingBlock: {
    phase: string;
    featureId: string;
    preview?: unknown;
    auditJobId?: string;
    createdAt: number;
    creditInfo?: {
      allowed: boolean;
      atlasFeatureId: string;
      requiredBalance: number;
      balance: number;
      deficit: number;
      usage: number;
      includedUsage: number;
      interval: string | null;
      intervalCount: number;
      unlimited: boolean;
      overageAllowed: boolean;
      creditSchema: Array<{ feature_id: string; credit_amount: number }>;
    };
  } | null | undefined;
  onResume: () => Promise<{ ok: boolean; message?: string }>;
  onRefetchCustomer: () => Promise<void>;
}

export default function PaywallDialog({
  open,
  onOpenChange,
  billingBlock,
  onResume,
  onRefetchCustomer,
}: PaywallDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [successState, setSuccessState] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [resumeMessage, setResumeMessage] = useState<string>("");
  const { checkout, openBillingPortal, isLoading: isCustomerLoading, customer, refetch } = useCustomer();

  const currentPlanId = useMemo(() => {
    const name = customer?.products?.[0]?.name?.toLowerCase();
    if (name === "pro" || name === "business") return name;
    return "free";
  }, [customer?.products]);

  const beginSuccessCountdown = useCallback(() => {
    setSuccessState(true);
    setCountdown(5);
  }, []);

  const handleAutoResume = useCallback(async () => {
    try {
      await onRefetchCustomer();
      const result = await onResume();
      
      if (result.ok) {
        setSuccessState(true);
        setCountdown(5);
      } else {
        setResumeMessage(result.message || "Still out of credits. Please finish your upgrade, then click 'Resume Now'.");
      }
    } catch (error) {
      console.error("Auto-resume failed:", error);
      setResumeMessage("Failed to resume workflow. Please try again.");
    }
  }, [onRefetchCustomer, onResume]);

  // Auto-detect upgrade and auto-resume logic
  useEffect(() => {
    if (!billingBlock || !open || successState) return;

    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        console.log("User returned to app, checking for upgrade...");
        const params = new URLSearchParams(window.location.search);
        if (params.get("upgraded") === "1") return; // countdown path will handle it
        await handleAutoResume();
      }
    };

    const handleFocus = async () => {
      console.log("Window focused, checking for upgrade...");
      const params = new URLSearchParams(window.location.search);
      if (params.get("upgraded") === "1") return; // countdown path will handle it
      await handleAutoResume();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [open, successState, billingBlock, onRefetchCustomer, onResume, handleAutoResume]);

  // Detect query param on return from checkout to immediately resume
  useEffect(() => {
    if (!open || successState) return;
    const params = new URLSearchParams(window.location.search);
    const upgraded = params.get("upgraded");
    if (upgraded === "1") {
      (async () => {
        try {
          await refetch?.();
          // Show success state and delay actual resume until countdown ends
          beginSuccessCountdown();
        } finally {
          const url = new URL(window.location.href);
          url.searchParams.delete("upgraded");
          url.searchParams.delete("plan");
          window.history.replaceState({}, "", url.toString());
        }
      })();
    }
  }, [open, successState, refetch, beginSuccessCountdown]);

  // Countdown timer: when it hits 0, try to resume then close
  useEffect(() => {
    if (successState && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (successState && countdown === 0) {
      (async () => {
        try {
          setIsLoading(true);
          const result = await onResume();
          if (!result.ok) {
            setSuccessState(false);
            setResumeMessage(result.message || "Failed to resume workflow. Please try again.");
            return;
          }
        } catch (error) {
          console.error("Final resume failed:", error);
          setSuccessState(false);
          setResumeMessage("Failed to resume workflow. Please try again.");
          return;
        } finally {
          setIsLoading(false);
        }
        onOpenChange(false);
      })();
    }
  }, [successState, countdown, onOpenChange, onResume]);

  if (!billingBlock && !successState) {
    return null; // Don't render unless showing success state
  }

  const handleManualResume = async () => {
    setIsLoading(true);
    setResumeMessage("");
    
    try {
      await onRefetchCustomer();
      // Start success countdown and resume when it ends
      beginSuccessCountdown();
    } catch (error) {
      console.error("Manual resume prep failed:", error);
      setResumeMessage("Failed to prepare resume. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Generate generic content based on billingBlock
  const featureName = billingBlock ? billingBlock.featureId.replace("_", " ") : "your workflow";
  const phaseName = billingBlock ? billingBlock.phase : "current";
  const title = successState ? "Thank you for upgrading!" : "Upgrade Required";
  
  let message = "";
  if (successState) {
    message = `Your workflow will resume in ${countdown}...`;
  } else {
    message = `You're out of credits for ${featureName} during the ${phaseName} phase. Please upgrade to continue your workflow.`;
    
    if (billingBlock?.creditInfo) {
      const { balance, requiredBalance, deficit } = billingBlock.creditInfo;
      message += ` Current balance: ${balance}, Required: ${requiredBalance}, Deficit: ${deficit}.`;
      
      // Add cost reminder based on memory
      if (billingBlock?.featureId === "lead_discovery") {
        message += " Lead discovery costs 1 credit per search.";
      } else if (billingBlock?.featureId === "dossier_research") {
        message += " Dossier research costs 2 credits per opportunity.";
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 pt-4 gap-0 text-foreground overflow-hidden text-sm max-w-2xl">
        <DialogTitle className={cn("font-bold text-xl px-6")}>{title}</DialogTitle>
        <div className="px-6 my-2">{message}</div>
        
        {/* Show resume message if any */}
        {resumeMessage && (
          <div className="px-6 my-2 p-2 bg-orange-100 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded">
            <p className="text-sm text-orange-800 dark:text-orange-200">{resumeMessage}</p>
          </div>
        )}
        
        {/* Custom Plan Buttons */}
        {!successState && (
          <div className="px-6 my-4 space-y-3">
            {PLANS.map((plan) => {
              const isCurrent = currentPlanId === plan.id;
              const isFree = plan.id === "free";
              const successUrl = new URL(
                `/dashboard?upgraded=1&plan=${plan.id}`,
                window.location.origin
              ).toString();
              const returnUrl = new URL(
                "/dashboard?portal=1",
                window.location.origin
              ).toString();

              return (
                <div key={plan.id} className={`border rounded p-3 ${isCurrent ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-slate-200 dark:border-slate-800"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{plan.name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{plan.price} • {plan.includedCredits}</p>
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] px-2 py-1 rounded bg-blue-600 text-white">Current</span>
                    )}
                  </div>
                  {/* Buttons (none for Free plan) */}
                  {!isFree && (
                    <div className="mt-3 flex gap-2">
                      {isCurrent ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isCustomerLoading}
                          onClick={async () => {
                            try {
                              await openBillingPortal({ returnUrl });
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                        >
                          Manage subscription
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="font-medium shadow transition"
                          disabled={isCustomerLoading}
                          onClick={() =>
                            checkout({
                              productId: plan.productId!,
                              dialog: CheckoutDialog,
                              successUrl,
                            })
                          }
                        >
                          {`Upgrade to ${plan.name}`}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        <DialogFooter className="flex flex-row justify-end gap-x-2 py-3 mt-4 px-6 bg-secondary border-t">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onOpenChange(false)} 
            disabled={isLoading}
          >
            Cancel
          </Button>
          
          {/* Manual resume button - only show when not in success state */}
          {!successState && (
            <Button 
              size="sm" 
              className="font-medium shadow transition min-w-32" 
              onClick={handleManualResume} 
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? "Processing..." : "I've Upgraded — Resume Now"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
