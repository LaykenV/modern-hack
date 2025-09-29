"use client";
import { Authenticated, Unauthenticated } from "convex/react";
import { useCustomer, CheckoutDialog } from "autumn-js/react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PLANS } from "@/lib/autumn/plans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SubscriptionPage() {
  return (
    <main className="min-h-full p-6 md:p-8 flex flex-col gap-6">
      <Unauthenticated>
        <div className="max-w-6xl mx-auto w-full">
          <div className="card-warm-static p-6 md:p-8">
            <h1 className="text-2xl font-bold text-foreground mb-4">
              Sign In Required
            </h1>
            <p className="text-muted-foreground mb-6">
              You must sign in to manage your subscription.
            </p>
            <Button asChild className="btn-primary">
              <Link href="/">Go to Sign In</Link>
            </Button>
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>
        <Content />
      </Authenticated>
    </main>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-6xl mx-auto w-full space-y-8">
      {/* Hero Section Skeleton */}
      <div className="card-warm-static p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex-1">
            <Skeleton className="h-10 w-48 mb-2" />
            <Skeleton className="h-6 w-64" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      {/* Plans Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card-warm-static p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-9 w-20" />
              </div>
            </div>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-6 w-40 mb-6" />
            <div className="space-y-2 mb-6">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Content() {
  const { checkout, openBillingPortal, isLoading, customer, refetch } = useCustomer();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [justUpgraded, setJustUpgraded] = useState(false);

  const currentPlanId = useMemo(() => {
    const name = customer?.products?.[0]?.name?.toLowerCase();
    if (name === "pro" || name === "business") return name;
    return "free";
  }, [customer?.products]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const upgraded = params.get("upgraded");
    const plan = params.get("plan");
    
    if (upgraded === "1") {
      setJustUpgraded(true);
      const planName = plan === "pro" ? "Pro" : plan === "business" ? "Business" : "your plan";
      toast.success(`Successfully upgraded to ${planName}!`, {
        description: "Your new credits are now available.",
      });
      
      // Refresh customer state quickly
      Promise.resolve(refetch?.()).finally(() => {
        // Clean URL params to avoid re-trigger
        const url = new URL(window.location.href);
        url.searchParams.delete("upgraded");
        url.searchParams.delete("plan");
        url.searchParams.delete("portal");
        window.history.replaceState({}, "", url.toString());
      });
    }
  }, [refetch]);

  const currentPlanName = customer?.products?.[0]?.name ?? "Free";

  // Show loading skeleton while initially loading
  if (isLoading && !customer) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="max-w-6xl mx-auto w-full space-y-8">
      {/* Hero Section */}
      <div className="card-warm-static p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              Subscription
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Manage your plan and billing
            </p>
          </div>
          <Badge 
            variant="secondary" 
            className="self-start sm:self-center px-4 py-2 text-sm bg-primary/20 text-primary border-primary/30"
          >
            {currentPlanName}
          </Badge>
        </div>

        {justUpgraded && (
          <>
            <Separator className="my-6" />
            <Alert className="border-green-500/40 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                Subscription updated. Thanks for upgrading!
              </AlertDescription>
            </Alert>
          </>
        )}
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {PLANS.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          const isFree = plan.id === "free";
          const isCheckingOutThisPlan = checkingOut === plan.id;
          const successUrl = new URL(
            `/dashboard/subscription?upgraded=1&plan=${plan.id}`,
            window.location.origin
          ).toString();
          const returnUrl = new URL(
            "/dashboard/subscription?portal=1",
            window.location.origin
          ).toString();

          const cardClass = isCurrent 
            ? "card-warm-accent" 
            : "card-warm-static";

          return (
            <div key={plan.id} className={`${cardClass} p-6 flex flex-col`}>
              {/* Plan Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-foreground">
                    {plan.name}
                  </h2>
                  <p className="text-3xl font-bold text-primary mt-2">
                    {plan.price}
                  </p>
                </div>
                {isCurrent && (
                  <Badge 
                    variant="secondary" 
                    className="bg-primary/20 text-primary border-primary/30"
                  >
                    Current Plan
                  </Badge>
                )}
              </div>

              <Separator className="my-4" />

              {/* Credits Badge */}
              <div className="mb-4">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Included Credits
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {plan.includedCredits}
                </p>
              </div>

              {/* Perks List */}
              {plan.perks.length > 0 && (
                <div className="flex-1 mb-6">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Features
                  </p>
                  <ul className="space-y-2">
                    {plan.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-sm text-foreground">{perk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              {!isFree && (
                <div className="mt-auto pt-4">
                  {isCurrent ? (
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full"
                      disabled={loadingPortal}
                      onClick={async () => {
                        setLoadingPortal(true);
                        try {
                          await openBillingPortal({ returnUrl });
                        } catch (error) {
                          toast.error("Failed to open billing portal", {
                            description: "Please try again later.",
                          });
                        } finally {
                          setLoadingPortal(false);
                        }
                      }}
                      aria-label="Manage your subscription in the billing portal"
                    >
                      {loadingPortal && <Loader2 className="h-4 w-4 animate-spin" />}
                      {loadingPortal ? "Opening portal…" : "Manage Subscription"}
                    </Button>
                  ) : (
                    <Button
                      className="btn-primary w-full py-3"
                      disabled={isCheckingOutThisPlan || isLoading}
                      onClick={async () => {
                        setCheckingOut(plan.id);
                        try {
                          await checkout({
                            productId: plan.productId!,
                            dialog: CheckoutDialog,
                            successUrl,
                          });
                        } catch (error) {
                          toast.error(`Failed to upgrade to ${plan.name}`, {
                            description: "Please try again later.",
                          });
                        } finally {
                          setCheckingOut(null);
                        }
                      }}
                      aria-label={`Upgrade to ${plan.name} plan`}
                    >
                      {isCheckingOutThisPlan && <Loader2 className="h-4 w-4 animate-spin" />}
                      {isCheckingOutThisPlan ? "Processing…" : `Upgrade to ${plan.name}`}
                    </Button>
                  )}
                </div>
              )}

              {/* Free Plan CTA */}
              {isFree && isCurrent && (
                <div className="mt-auto pt-4 border-t border-border">
                  <p className="text-sm text-center text-muted-foreground">
                    Your current plan
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}