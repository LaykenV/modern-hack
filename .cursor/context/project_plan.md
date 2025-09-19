# Atlas Outbound — Hackathon MVP Plan (Local SMB Pivot)

## MVP goal
- Eliminate the trust gap in AI sales agents with citations to approved claims, and showcase a real outbound call to a public business phone.
- Ship a sub-3-minute gold-path demo: paste your site → approve claims → find 3 local businesses → research → click call → book → cited recap email → live timeline + credit meter.

## What’s in vs out (MVP scope)

### In
- **Onboarding wizard**: company name + website URL (Firecrawl ingest), approve claims, tone, simple ICP (vertical + city), time zone + availability, default sender.
- **Lead sourcing (local)**: “Find 5 dentists in San Francisco” via Google Places → returns name, phone, website, address → pick 3.
- **Dossier**: combine Google Places facts (hours, rating, address, phone) and website crawl (if present). All buyer facts cited (Places URL or website). Talking points map 1:1 to Approved Claims.
- **Call**: call the business main line via Vapi; live transcript; propose predefined time slots; create ICS; voicemail fallback.
- **Follow-up**: React email via Resend with citations + ICS; webhooks update UI.
- **Real-time + credits**: Convex live timeline; Autumn credit meter + `PaywallDialog` (can trigger mid-run). Debit for Places lookup, crawl, AI actions, call minutes.

### Out (for now)
- Team/SSO, analytics suite, template editor, CRM/Slack/calendar integrations.
- Direct-dial persona discovery; compliance screens beyond a single consent note + unsubscribe footer.

## User journey (gold path)
- Landing → Google sign-in → `/dashboard/onboarding`
- **Onboarding**:
  1) Company + website → Firecrawl → Seed Brain + extracted claims with citations → toggle 3–5 Approved; add 1–2 guardrails (e.g., “don’t discuss pricing”).
  2) Profile: tone, ICP vertical (e.g., “Dentists”) + city, time zone, 2–3 slot options, default sender.
- **Lead sourcing**:
  - “Find 5 dentists in San Francisco” → Google Places results with phone + website → pick 3. Credit meter decrements on accepted leads.
- **Research & dossier**:
  - “Research” → fetch Places details → crawl website (if present) → show dossier (summary, place/website facts with citations, talking points mapped to Approved Claims).
- **Call**:
  - “Call business” → Vapi dials main line → short qualify → propose slots → “booked” toast. Timeline shows live transcript and outcome.
- **Follow-up**:
  - Resend recap email with cited bullets + ICS → timeline updates with delivered/opened.
- **Paywall**:
  - Credits near zero → `PaywallDialog` → upgrade → job resumes.

## Pages and flows (MVP)
- **Landing**: promise for local SMB outreach; “Start free.”
- **Auth + Onboarding**: Google OAuth; redirect to `/dashboard/onboarding`.
- **Onboarding Wizard** (≤5 steps).
- **Dashboard**: credit meter, next-step cards, live timeline.
- **Leads List**: minimal table (name, phone, website, fit reason, status).
- **Lead Detail**: “Trust mode: citations only” badge, dossier cards, citations, Q&A, Call button.
- **Call View (inline)**: transcript panel, tool toasts, outcome tag.
- **Email Confirmation Banner**: link to preview recap.
- **Paywall Dialog** (Autumn).

## Sponsor integrations (exact touchpoints)

### Auth (Better-Auth + Google)
- Google sign-in only.
- Expose `userId`; store on all records.

### Convex
- Data store (`seller_brain`, `leads`, `dossiers`, `calls`, `emails`, `events`, `usage`).
- Actions for background jobs; idempotent steps; real-time timeline + usage.

### Google Places API
- Lead discovery by vertical + city. Fields: `name`, `place_id`, `formatted_address`, `website`, `international_phone_number`, `rating`, `user_ratings_total`, `opening_hours`.
- Detail endpoint for reliable phone/website. Store `phone_source="google_places"`, `phone_confidence=0.9`.

### Firecrawl
- Seller Brain ingest from seller’s site (no PDFs).
- Lead website crawl if website exists; cache demo domains.

### OpenAI
- Claim extraction from seller site; verifier.
- Dossier summarization (merge Places + website facts) with citations.
- Talking points strictly mapped to Approved Claims (each includes `approved_claim_id` + `source_url`).
- Q&A over embedded snippets with cosine similarity threshold to trigger safe “not found” fallback.

### Vapi
- Outbound call to `leads.phone`. System prompt includes guardrails.
- Tools: `proposeTimeSlots` -> `bookMeeting` -> `logOutcome`.
- Voicemail detection → “Voicemail left” outcome → send modified recap email.

### Resend
- Send recap email to user by default; include plain-text + ICS (`METHOD:REQUEST`).
- Webhooks for delivered/opened → timeline updates.

### Autumn
- Debit credits: per Places acceptance, crawl, AI action, call minute.
- Show credit bar; trigger `PaywallDialog`; resume jobs. Keys by `userId`.

## OpenAI prompts/patterns (strict)

### Guardrail enforcement
- Include user guardrails in all prompts (talking points, Q&A, Vapi persona, email). Consistent refusal: “I can’t discuss pricing, but I can send details by email.”

### Talking points generator
- **Input**: `approved_claims` `[{id, text, source_url}]`, buyer facts (from Places/website), guardrails, tone.
- **Instruction**: “Produce 3–5 points. Each must map to exactly one `approved_claim_id` and include its `source_url`. If no suitable claim exists, omit the point. Obey all guardrails.”

### Verifier
- **Instruction**: “For each talking point, confirm its `approved_claim_id` text strongly supports the statement. If weak, unrelated, or violating a guardrail, reject the point.”

### Q&A
- Only answer with snippets whose cosine similarity ≥ threshold; otherwise “I couldn’t find that.”

## Minimal data model (Convex)
- `seller_brain`: `userId`, `companyName`, `sourceUrl`, `approvedClaims[{id, text, source_url}]`, `guardrails[]`, `tone`, `timeZone`, `availability[]`
- `leads`: `id`, `userId`, `name`, `domain?`, `phone`, `phone_source`, `phone_confidence`, `place_id`, `address`, `city`, `rating`, `reviews_count`, `source="google_places"`, `fit_reason`, `status`
- `dossier`: `leadId`, `summary`, `facts[{key, value, source_url}]`, `talking_points[{text, approved_claim_id, source_url}]`, `embeddingsRef`
- `calls`: `id`, `leadId`, `userId`, `transcript[]`, `outcome`, `meeting_time`, `icsUrl`
- `emails`: `id`, `leadId`, `subject`, `html`, `status`, `deliveredAt`, `openedAt`
- `events` (timeline): `id`, `userId`, `type`, `subtype`, `refId`, `message`, `ts`
- `usage`: `userId`, `plan`, `credits`, `counters {places_lookups, crawl_pages, ai_actions, call_minutes}`

## Pipelines (jobs)
- **Onboarding**: Firecrawl crawl → OpenAI ExtractClaims + Seed Brain summary → Verifier → store approved subset + summary.
- **Lead discovery**: Places text search by vertical + city → details per result → synthesize `fit_reason` (e.g., “High rating; website lists online booking”) → accept 3.
- **Research**: For each lead → collect Places facts; if website exists → Firecrawl homepage → Extract facts → OpenAI summarize/talking_points → Verifier → store.
- **Call**: Start Vapi → stream transcript → tool events → on outcome, generate ICS & log.
- **Email**: On call outcome → render template → Resend send → webhook updates.
- **Credits**: Check allowance before each step; debit on completion; idempotent; trigger Paywall when near zero.

## UI specifics that sell the MVP
- Trust mode badges on Dossier and Call.
- Interactive citations (hover shows “Source Claim” or “Source: Google Places/lead website”).
- Progressive states (“Finding local businesses…”, “Verifying claims…”, “Calling…”).
- Live Timeline showing each step.
- Credit Meter visibly decrementing per action.

## Tech stack
- Next.js + TypeScript + Tailwind
- Better-Auth (Google)
- Convex (data, jobs, RT)
- Google Places API
- Firecrawl
- OpenAI
- Vapi
- Resend
- Autumn
- Deployed to Vercel

## 3-minute demo script
1) Sign in with Google → `/dashboard/onboarding`.
2) Enter Company + website → watch Seed Brain + claims with citations → approve 3–5; add guardrail “no pricing.”
3) Set ICP: Vertical “Dentists”, City “San Francisco”; Tone “Consultative”; TZ + availability.
4) Leads: click “Find dentists in San Francisco” → pick 3 with phone + website → note `fit_reasons`.
5) Open a lead → “Research” → dossier fills with Places + website facts; hover a citation tooltip.
6) Click “Call business” → live transcript; ask about price → agent refuses per guardrail; propose time → booked toast.
7) Show recap email with cited bullets + ICS; timeline updates delivered/opened.
8) Credits hit threshold → `PaywallDialog` → upgrade → job resumes.

## Build schedule (10–12 days)
- **Day 1**: Scaffold; Google OAuth; Convex schema; Landing + Onboarding route.
- **Day 2**: Firecrawl ingest + ExtractClaims + Verifier; Approve Claims UI.
- **Day 3**: ICP mini-form (vertical + city); Guardrail enforcement; Autumn meter basics.
- **Day 4**: Google Places discovery (search + details); lead table; `fit_reason` synthesis; store phone/website/`place_id`.
- **Day 5**: Research pipeline merging Places facts + optional website crawl; interactive citation tooltips.
- **Day 6**: Vapi outbound call to `leads.phone`; tools; voicemail fallback; ICS generation.
- **Day 7**: Resend recap email (HTML + plaintext + ICS); webhooks; timeline view.
- **Day 8**: `PaywallDialog`; idempotent debit rules; resume jobs.
- **Day 9**: UI polish: skeletons, spinners, error toasts; Trust Mode badges; phone source badges.
- **Day 10**: Cache demo `place_ids` and crawls; flaky network safeguards.
- **Day 11**: Record demo; README with Judge Path; deploy; social posts.
- **Day 12**: Buffer for bugs/perf; dry runs.

## Risk mitigation
- **Places quotas/latency**: Cache a few `place_ids` and details server-side for demo cities.
- **Phone accuracy**: Use `international_phone_number`; validate format; if call failure, log outcome and send adjusted email.
- **Website missing**: Dossier still works with Places facts alone.
- **Call compliance**: Keep a consent note; avoid sensitive categories; for live demo, call a hotline or your secondary line if needed.
- **Hallucinations**: Maintain 1:1 mapping of talking points to Approved Claims; strict Verifier; “not found” fallback in Q&A.
- **Email deliverability**: Include plaintext; correct ICS headers.
- **Credit double-charging**: Idempotent jobs.

## Deliverables and checklist
- Live Vercel app URL
- GitHub repo + README:
  - Judge Path from fresh signup
  - Integration notes and file paths
  - Google OAuth and Places setup notes
- 3–4 min demo video showing the gold path
- Social posts tagging sponsors

## Stretch (only if time remains)
- Simulate Call toggle (agent role-plays buyer to your phone) as a fallback if outbound is flaky.
- “Copy recap to clipboard” on Lead Detail.
- Simple inbound web voice demo button with Vapi.
