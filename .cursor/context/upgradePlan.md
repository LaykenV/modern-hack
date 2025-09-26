## AI Call Credit Metering Plan

- **Backend billing utilities (`convex/call/billing.ts`)**
  - Add a module housing Convex `internalAction`s so credit logic stays modular. Follow the `convex/leadGen/billing.ts` pattern with an ephemeral Autumn client that accepts an explicit `customerId`.
  - `ensureAiCallCredits` (args: `customerId`, `requiredMinutes` = 1) calls `autumn.check`. It returns `{ allowed, balance, error? }`, logging errors but never throwing to avoid leaking secrets; callers decide how to react.
  - `meterAiCallUsage` (args: `callId`) re-loads the call document, verifies `billingSeconds > 0`, and uses `metadata.billingCustomerId` captured up front. Compute `requestedMinutes = Math.ceil(billingSeconds / 60)`; if zero, exit early.
  - Before tracking, run another `autumn.check` to read the latest balance. Clamp to `billableMinutes = Math.min(requestedMinutes, balance)` so we never bill more than the user has left.
  - Only call `autumn.track` when `billableMinutes > 0`. Persist metering info back onto the call via `ctx.db.patch`, writing `metadata.aiCallMetering = { requestedMinutes, billedMinutes, balanceAtCheck, trackedAt }` to reuse the existing `metadata` field (no schema change).
  - Short-circuit if the call already has `metadata.aiCallMetering?.trackedAt` to keep the action idempotent, since the webhook path may re-run.

- **Preflight enforcement in `startCall` (`convex/call/calls.ts`)**
  - Require an authenticated identity (`await ctx.auth.getUserIdentity()`); if absent, throw.
  - Extract `customerId = identity.subject`. Immediately call `ctx.runAction(internal.call.billing.ensureAiCallCredits, { customerId, requiredMinutes: 1 })`.
  - If the response marks `allowed === false`, throw an error like `"Insufficient credits for AI call"` so the client can surface the paywall.
  - When inserting the call row, include `billingCustomerId` and the preflight balance inside `metadata`. Merge with existing metadata rather than overwriting.

- **Metering after webhook completion**
  - In `finalizeReport`, after patching `billingSeconds`, schedule `ctx.scheduler.runAfter(0, internal.call.billing.meterAiCallUsage, { callId })`.
  - The action will load the call, read `billingSeconds`, `status`, and `metadata.billingCustomerId`, and meter if the call is completed. Handle missing data gracefully (log + drop).

- **UI safeguards in `app/dashboard/page.tsx`**
  - Update the `useCustomer` call to capture `customer` and `refetch` alongside `isLoading`.
  - Derive `atlasCreditsBalance = customer?.features?.atlas_credits?.balance ?? 0`.
  - When rendering the Call button:
    - Disable it if the balance is `< 1`, add helper text (“Need at least 1 credit to start a call”), and render a secondary “Open Paywall” button that simply calls `setPaywallOpen(true)`.
    - While `isLoading`, optionally keep the button disabled to avoid flicker.
  - After a successful call (or on relevant state changes), call `refetchCustomer()` so the UI reflects the new balance.

- **Paywall dialog interaction (`components/autumn/paywall-dialog.tsx`)**
  - No structural change is required. Ensure it remains the single source of upgrade flows. Optionally allow a custom message prop if we want AI-call-specific context, but not mandatory for the first pass.

- **Documentation touch-up (`.cursor/context/vapi.md`)**
  - Add a short “Credit Metering” subsection covering the 1-credit preflight check, post-call billing based on `billingSeconds`, balance clamping, and the disabled call button behavior.

- **Testing & monitoring**
  - Manual test cases:
    - User with 0 credits: button disabled, paywall opens; attempting to call via API yields error.
    - User with ≥1 credit: preflight succeeds, short call (<60 s) bills 1 credit max.
    - Limited credits scenario: user with 2 credits, 3-minute call → only 2 credits deducted.
  - Confirm Autumn dashboard reflects deductions and that repeated webhook deliveries do not double-bill (thanks to idempotence check).

