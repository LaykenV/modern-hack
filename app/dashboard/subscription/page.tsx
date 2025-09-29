"use client";
import { Authenticated, Unauthenticated } from "convex/react";
import { useCustomer, CheckoutDialog } from "autumn-js/react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PLANS } from "@/lib/autumn/plans";

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
            <Link href="/" className="btn-primary">
              Go to Sign In
            </Link>
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>
        <Content />
      </Authenticated>
    </main>
  );
}

function Content() {
  const { checkout, openBillingPortal, isLoading, customer, refetch } = useCustomer();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [justUpgraded, setJustUpgraded] = useState(false);

  const currentPlanId = useMemo(() => {
    const name = customer?.products?.[0]?.name?.toLowerCase();
    if (name === "pro" || name === "business") return name;
    return "free";
  }, [customer?.products]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const upgraded = params.get("upgraded");
    if (upgraded === "1") {
      setJustUpgraded(true);
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

  return (
    <div className="max-w-6xl mx-auto w-full space-y-8">
      {/* Hero Section */}
      <div className="card-warm-static p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              Subscription
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Manage your plan and billing
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold bg-primary/20 text-primary border border-primary/30">
              {currentPlanName}
            </span>
          </div>
        </div>

        {justUpgraded && (
          <div className="p-4 rounded-lg border border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.1)]">
            <p className="text-sm font-semibold text-[hsl(var(--success))]">
              ✓ Subscription updated. Thanks for upgrading!
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            <span className="text-sm">Loading subscription details…</span>
          </div>
        )}
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {PLANS.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          const isFree = plan.id === "free";
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
                  <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-primary/20 text-primary border border-primary/30 whitespace-nowrap">
                    Current Plan
                  </span>
                )}
              </div>

              {/* Credits Badge */}
              <div className="mb-6">
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
                        <span className="text-primary mt-0.5">✓</span>
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
                    <button
                      className="w-full rounded-lg px-4 py-3 text-sm font-semibold border border-border bg-surface-muted text-foreground hover:bg-surface-raised transition-colors disabled:opacity-50"
                      disabled={loadingPortal}
                      onClick={async () => {
                        setLoadingPortal(true);
                        try {
                          await openBillingPortal({ returnUrl });
                        } finally {
                          setLoadingPortal(false);
                        }
                      }}
                    >
                      {loadingPortal ? "Opening portal…" : "Manage Subscription"}
                    </button>
                  ) : (
                    <button
                      className="btn-primary w-full py-3 text-sm font-semibold disabled:opacity-50"
                      disabled={isLoading}
                      onClick={() =>
                        checkout({
                          productId: plan.productId!,
                          dialog: CheckoutDialog,
                          successUrl,
                        })
                      }
                    >
                      {`Upgrade to ${plan.name}`}
                    </button>
                  )}
                </div>
              )}

              {/* Free Plan CTA */}
              {isFree && isCurrent && (
                <div className="mt-auto pt-4">
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