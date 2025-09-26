## Credit Metering (Autumn)

- **checkAndPause** – Called before each metered workflow step. It chooses an Autumn client: background workflow runs pass `customerId`, so we create an ephemeral `Autumn` instance with explicit `identify`; interactive paths fall back to the shared singleton. After `.check`, insufficient credits trigger `statusUtils.pauseForBilling` to write the pause context (phase, featureId, optional auditJobId, detailed `creditInfo`), then throw `BillingError` so the durable workflow exits cleanly without advancing.```52:113:convex/leadGen/billing.ts
export const checkAndPause = internalAction({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
    featureId: v.union(v.literal("lead_discovery"), v.literal("dossier_research")),
    requiredValue: v.number(),
    phase: v.union(v.literal("source"), v.literal("generate_dossier")),
    auditJobId: v.optional(v.id("audit_jobs")),
    customerId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let checkResult, error;
    if (args.customerId) {
      const ephemeralAutumn = new Autumn(components.autumn, {
        secretKey: process.env.AUTUMN_SECRET_KEY ?? "",
        identify: () => ({ customerId: args.customerId }),
      });
      ({ data: checkResult, error } = await ephemeralAutumn.check(ctx, {
        featureId: args.featureId,
      }));
    } else {
      ({ data: checkResult, error } = await autumn.check(ctx, {
        featureId: args.featureId,
      }));
    }
    // ... existing code ...
    if (!checkResult?.allowed) {
      const creditInfo = checkResult
        ? {
            allowed: checkResult.allowed || false,
            atlasFeatureId: "atlas_credits",
            requiredBalance: checkResult.required_balance || 0,
            balance: checkResult.balance || 0,
            deficit: Math.max(0, (checkResult.required_balance || 0) - (checkResult.balance || 0)),
            usage: checkResult.usage || 0,
            includedUsage: checkResult.included_usage || 0,
            interval: checkResult.interval || null,
            intervalCount:
              (checkResult as unknown as Record<string, unknown>).intervalCount as number ||
              (checkResult as unknown as Record<string, unknown>).interval_count as number ||
              0,
            unlimited: checkResult.unlimited || false,
            overageAllowed: checkResult.overage_allowed || false,
            creditSchema: checkResult.credit_schema || [],
          }
        : undefined;
      await ctx.runMutation(internal.leadGen.statusUtils.pauseForBilling, {
        leadGenFlowId: args.leadGenFlowId,
        phase: args.phase,
        featureId: args.featureId,
        preview: checkResult?.preview || undefined,
        auditJobId: args.auditJobId,
        creditInfo,
      });
      throw new BillingError(
        `Workflow paused for billing: insufficient credits for ${args.featureId}`,
      );
    }
  },
});
```
- **trackUsage** – Invoked only after a metered step succeeds. It mirrors the same client-selection logic, then calls `.track` with `value: 1`; Autumn multiplies that unit into the correct atlas-credit deduction. Errors bubble so callers can retry or surface issues.```124:160:convex/leadGen/billing.ts
export const trackUsage = internalAction({
  args: {
    featureId: v.union(v.literal("lead_discovery"), v.literal("dossier_research")),
    value: v.number(),
    customerId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let error;
    if (args.customerId) {
      const ephemeralAutumn = new Autumn(components.autumn, {
        secretKey: process.env.AUTUMN_SECRET_KEY ?? "",
        identify: () => ({ customerId: args.customerId }),
      });
      ({ error } = await ephemeralAutumn.track(ctx, {
        featureId: args.featureId,
        value: args.value,
      }));
    } else {
      ({ error } = await autumn.track(ctx, {
        featureId: args.featureId,
        value: args.value,
      }));
    }
    if (error) {
      throw new Error(`Usage tracking failed: ${error}`);
    }
  },
});
```
- **Workflow integration** – `leadGenWorkflow` wraps each metered phase with these guards: sourcing checks and bills once on successful Google Places fetch, while every dossier audit repeats the check/bill cycle and uses the fallback metering path if the per-audit action missed tracking.```105:406:convex/leadGen/workflow.ts
await step.runAction(internal.leadGen.billing.checkAndPause, {
  leadGenFlowId: args.leadGenFlowId,
  featureId: "lead_discovery",
  requiredValue: 1,
  phase: "source",
  customerId: args.customerId,
});
// ... existing code ...
await step.runAction(internal.leadGen.billing.trackUsage, {
  featureId: "lead_discovery",
  value: 1,
  customerId: args.customerId,
});
// ... existing code ...
try {
  await step.runAction(internal.leadGen.billing.checkAndPause, {
    leadGenFlowId: args.leadGenFlowId,
    featureId: "dossier_research",
    requiredValue: 1,
    phase: "generate_dossier",
    auditJobId: auditJob._id,
    customerId: args.customerId,
  });
} catch (error) {
  if (isBillingPauseError(error)) {
    return null;
  }
  throw error;
}
await step.runAction(
  internal.leadGen.audit.runAuditAction,
  {
    auditJobId: auditJob._id,
    opportunityId: auditJob.opportunityId,
    agencyId: auditJob.agencyId,
    targetUrl: auditJob.targetUrl,
    leadGenFlowId: auditJob.leadGenFlowId || args.leadGenFlowId,
    customerId: args.customerId,
  },
  { retry: RETRY_CONFIG.AI_OPERATIONS }
);
// ... existing code ...
if (!isMetered) {
  await step.runAction(internal.leadGen.billing.trackUsage, {
    featureId: "dossier_research",
    value: 1,
    customerId: args.customerId,
  });
  await step.runMutation(internal.leadGen.statusUtils.markAuditJobMetered, {
    auditJobId: auditJob._id,
  });
}
```
- **UI flow** – When `checkAndPause` writes a `billingBlock`, the dashboard opens the paywall dialog, surfaces Autumn plan options, and wires “Resume” to `api.marketing.resumeLeadGenWorkflow`, which restarts the durable workflow once credits return.```178:512:app/dashboard/page.tsx
<PaywallDialog
  open={paywallOpen}
  onOpenChange={(open) => {
    setPaywallOpen(open);
    if (!open) {
      setPaywallDismissed(true);
    }
  }}
  billingBlock={billingBlock}
  onResume={async () => {
    if (!currentJobId) return { ok: false, message: "No current job selected" };
    try {
      const result = await resumeWorkflow({ leadGenFlowId: currentJobId });
      return { ok: result.success, message: result.message };
    } catch (error) {
      return { ok: false, message: "Failed to resume workflow" };
    }
  }}
  onRefetchCustomer={async () => {
    await refetchCustomer();
  }}
/>
useEffect(() => {
  if (billingBlock && !paywallOpen && !paywallDismissed) {
    setPaywallOpen(true);
  }
}, [billingBlock, paywallOpen, paywallDismissed]);
```
