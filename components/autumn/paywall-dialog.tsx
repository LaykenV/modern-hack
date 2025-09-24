"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCustomer } from "autumn-js/react"; // We need this for the checkout function
import { getPaywallContent } from "@/lib/autumn/paywall-content"; // We will use the existing helper
import { cn } from "@/lib/utils";
import { CheckFeaturePreview } from "autumn-js";

// MODIFIED: Props are changed to accept data from our backend
export interface PaywallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: CheckFeaturePreview | null | undefined;
  onSuccess: () => Promise<void>;
}

export default function PaywallDialog({
  open,
  onOpenChange,
  preview,
  onSuccess,
}: PaywallDialogProps) {
  // REMOVED: The `usePaywall` hook is gone.
  const { checkout } = useCustomer();
  const [isLoading, setIsLoading] = useState(false);

  if (!preview) {
    return null; // Don't render if there's no preview data
  }

  // This part remains the same, using the helper you already have.
  const { title, message } = getPaywallContent(preview);

  // ADDED: Real logic for the confirm button
  const handleConfirm = async () => {
    const upgradeProductId = (preview as { upgrade_product_id?: string })?.upgrade_product_id;
    if (!upgradeProductId) {
      console.error("Paywall Error: No upgrade_product_id provided in the preview object.");
      return;
    }
    setIsLoading(true);
    try {
      // Triggers the Stripe checkout flow
      await checkout({ productId: upgradeProductId });
      // If checkout succeeds, this calls our `resumeWorkflow` mutation
      await onSuccess();
    } catch (error) {
      console.error("Autumn checkout failed:", error);
    } finally {
      setIsLoading(false);
      onOpenChange(false); // Close the dialog
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 pt-4 gap-0 text-foreground overflow-hidden text-sm">
        <DialogTitle className={cn("font-bold text-xl px-6")}>{title}</DialogTitle>
        <div className="px-6 my-2">{message}</div>
        <DialogFooter className="flex flex-row justify-end gap-x-2 py-3 mt-4 px-6 bg-secondary border-t">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          {/* MODIFIED: Button is now fully functional */}
          <Button size="sm" className="font-medium shadow transition min-w-24" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Processing..." : "Confirm & Upgrade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
