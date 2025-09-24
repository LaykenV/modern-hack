"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PricingTable } from "autumn-js/react";
import { cn } from "@/lib/utils";

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
        await handleAutoResume();
      }
    };

    const handleFocus = async () => {
      console.log("Window focused, checking for upgrade...");
      await handleAutoResume();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [open, successState, billingBlock, onRefetchCustomer, onResume, handleAutoResume]);

  // Countdown timer for auto-close
  useEffect(() => {
    if (successState && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (successState && countdown === 0) {
      onOpenChange(false);
    }
  }, [successState, countdown, onOpenChange]);

  if (!billingBlock) {
    return null; // Don't render if there's no billing block data
  }

  const handleManualResume = async () => {
    setIsLoading(true);
    setResumeMessage("");
    
    try {
      await onRefetchCustomer();
      const result = await onResume();
      
      if (result.ok) {
        setSuccessState(true);
        setCountdown(5);
      } else {
        setResumeMessage(result.message || "Still out of credits. Please finish your upgrade, then try again.");
      }
    } catch (error) {
      console.error("Manual resume failed:", error);
      setResumeMessage("Failed to resume workflow. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Generate generic content based on billingBlock
  const featureName = billingBlock.featureId.replace("_", " ");
  const phaseName = billingBlock.phase;
  const title = successState ? "Thank you for upgrading!" : "Upgrade Required";
  
  let message = "";
  if (successState) {
    message = `Your workflow will resume in ${countdown}...`;
  } else {
    message = `You're out of credits for ${featureName} during the ${phaseName} phase. Please upgrade to continue your workflow.`;
    
    if (billingBlock.creditInfo) {
      const { balance, requiredBalance, deficit } = billingBlock.creditInfo;
      message += ` Current balance: ${balance}, Required: ${requiredBalance}, Deficit: ${deficit}.`;
      
      // Add cost reminder based on memory
      if (billingBlock.featureId === "lead_discovery") {
        message += " Lead discovery costs 1 credit per search.";
      } else if (billingBlock.featureId === "dossier_research") {
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
        
        {/* Embed PricingTable directly when not in success state */}
        {!successState && (
          <div className="px-6 my-4">
            <PricingTable />
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
