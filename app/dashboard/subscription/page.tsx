"use client";
import { Authenticated, Unauthenticated } from "convex/react";
import { PricingTable, useCustomer, CheckoutDialog } from "autumn-js/react";
import { useState } from "react";
import Link from "next/link";

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
  const { checkout, openBillingPortal, isLoading } = useCustomer();
  const [loadingPortal, setLoadingPortal] = useState(false);

  return (
    <div className="max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-bold mb-4">Subscription</h1>
      <Link href="/dashboard">Back to dashboard</Link>

      {isLoading ? (
        <div className="mt-6 text-sm text-slate-500">Loading subscription…</div>
      ) : (
        <div className="mb-6">
          <PricingTable />
        </div>
      )}

      <div className="flex gap-3">
        <button
          className="border border-slate-300 dark:border-slate-700 text-sm px-4 py-2 rounded-md disabled:opacity-50"
          disabled={isLoading}
          onClick={() =>
            checkout({
              // Example upgrade flow; replace with your product ids (pro/business)
              productId: "pro",
              dialog: CheckoutDialog,
            })
          }
        >
          Change plan
        </button>
        <button
          className="border border-slate-300 dark:border-slate-700 text-sm px-4 py-2 rounded-md disabled:opacity-50"
          disabled={loadingPortal}
          onClick={async () => {
            setLoadingPortal(true);
            try {
              const returnUrl = new URL(
                "/dashboard/subscription",
                window.location.origin,
              ).toString();
              await openBillingPortal({ returnUrl });
            } finally {
              setLoadingPortal(false);
            }
          }}
        >
          {loadingPortal ? "Opening…" : "Open billing portal"}
        </button>
      </div>
    </div>
  );
}