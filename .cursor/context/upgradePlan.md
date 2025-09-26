## Lead Gen Email Capture Upgrade

### Goal
- Enrich each `client_opportunities` record with a best-effort contact email discovered during the existing audit/dossier phase.
- Ensure crawl + filtering steps always surface a contact page so AI has the necessary context.

### Schema & Types
- Add optional `email` field to `client_opportunities` in `convex/schema.ts`; keep optional for backward compatibility.
- When persisting new opportunities (`persistClientOpportunities`), initialize `email` to `undefined` so resumes retain a consistent document shape.
- Update generated types/validators that touch `client_opportunities` (status utils, marketing queries) to include `email`.

### Crawl & URL Selection
- Keep Firecrawl include rules for `/contact` paths and ensure exclusions do not remove them.
- Update `filterRelevantUrls` prompt (`convex/leadGen/audit.ts`) to explicitly request at least one contact-style page in the shortlist.


### Dossier AI Enhancement
- Extend the dossier prompt in `generateDossierAndFitReasonHelper` so the AI returns `primary_email` (best contact email) alongside existing fields; require a clear null/empty value when not found.
- Parse the AI JSON to capture the returned email.

### Persistence Flow
- Extend `createAuditDossier` args to accept an optional `email`.
- Inside the mutation, continue inserting the dossier, then patch the linked opportunity’s `email` when a new value exists and differs from the stored value.
- Maintain idempotency: repeated runs with the same email should no-op.

### UI / Query Updates
- Update lead-gen queries (`convex/leadGen/queries.ts`, `convex/marketing.ts`, etc.) to surface the `email` field so dashboards can display it with phone info.

### Documentation
- Revise `leadGen.md` and `leadGenPlan.md` to cover the new schema field, contact-page requirement, and AI email extraction step.


