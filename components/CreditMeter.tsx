"use client";
import { useCustomer } from "autumn-js/react";

export function CreditMeter() {
  const { customer, isLoading } = useCustomer();

  const atlas = customer?.features?.atlas_credits as
    | { balance?: number; included_usage?: number }
    | undefined;

    console.log(customer);
    
  if (!customer || isLoading) {
    return <div className="text-sm text-slate-500">Loading credits…</div>;
  }

  const remaining = typeof atlas?.balance === "number" ? atlas.balance : undefined;
  const limit = typeof atlas?.included_usage === "number" ? atlas.included_usage : undefined;
  const pct =
    typeof remaining === "number" && typeof limit === "number" && limit > 0
      ? Math.min(100, Math.round((remaining / limit) * 100))
      : undefined;

  return (
    <div className="w-full max-w-md border border-slate-200 dark:border-slate-800 rounded-md p-3">
      <div className="text-sm font-medium mb-2">Atlas credits</div>
      {typeof pct === "number" ? (
        <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded">
          <div className="h-2 bg-blue-600 rounded" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <div className="text-xs mt-2">
        Remaining: <span className="font-semibold">{remaining ?? "—"}</span>
        {typeof limit === "number" ? <> / {limit}</> : null}
      </div>
    </div>
  );
}