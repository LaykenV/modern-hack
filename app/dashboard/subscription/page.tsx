"use client";
import { Authenticated, Unauthenticated } from "convex/react";
import { useCustomer, CheckoutDialog } from "autumn-js/react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PLANS } from "@/lib/autumn/plans";

export default function SubscriptionPage() {
  return (
    <main className="p-8 flex flex-col gap-6">
      <Unauthenticated>
        <div>
          <p className="mb-4 text-sm">You must sign in to manage your subscription.</p>
          <Link href="/" className="underline">Go to sign in</Link>
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
  console.log(customer);
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

  return (
    <div className="max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-bold mb-4">Subscription</h1>
      <Link href="/dashboard">Back to dashboard</Link>
      <div>current plan: {customer?.products?.[0]?.name ?? "free"}</div>

      {justUpgraded && (
        <div className="mt-4 p-3 text-sm rounded border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200">
          Subscription updated. Thanks for upgrading!
        </div>
      )}

      {isLoading && (
        <div className="mt-6 text-sm text-slate-500">Loading subscription…</div>
      )}

      {/* Plans Grid */}
      <div className="my-6 grid grid-cols-1 gap-4">
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

          return (
            <div key={plan.id} className={`border rounded p-4 ${isCurrent ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-slate-200 dark:border-slate-800"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold">{plan.name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{plan.price} • {plan.includedCredits}</p>
                  {plan.perks.length > 0 && (
                    <ul className="mt-2 text-sm text-slate-600 dark:text-slate-300 list-disc ml-5">
                      {plan.perks.map((perk) => (
                        <li key={perk}>{perk}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {isCurrent && (
                  <span className="text-xs px-2 py-1 rounded bg-blue-600 text-white">Current plan</span>
                )}
              </div>
              {/* Buttons (none for Free plan) */}
              {!isFree && (
                <div className="mt-4 flex gap-3">
                  {isCurrent ? (
                    <button
                      className="border border-slate-300 dark:border-slate-700 text-sm px-4 py-2 rounded-md"
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
                      {loadingPortal ? "Opening portal…" : "Manage subscription"}
                    </button>
                  ) : (
                    <button
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-md disabled:opacity-50"
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
            </div>
          );
        })}
      </div>

      {/* Bottom billing portal button removed as requested */}
    </div>
  );
}