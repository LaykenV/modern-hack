# Atlas Outbound — Hackathon MVP Plan (Final)

## MVP Goal
- Our core mission: Eliminate the trust gap in AI sales agents. Every talking point and email is verifiably cited from your own approved claims, protecting your brand from hallucinations.
- Ship a flawless, sub-3-minute gold-path demo: paste your site → approve claims → get 3 leads → research a dossier → click call → book a time → instant, cited recap email → live timeline + credit meter.
- Depth over breadth: make sponsor integrations feel essential and real-time.

## What’s in vs out (MVP scope)

### In:
- Onboarding wizard (short): company name + 1 website URL (no PDFs), Firecrawl ingest, Approve Claims (simple UI), choose tone, simple ICP (industry, size, role), time zone + availability, default sender
- Lead sourcing: paste/upload domains; simple “Find companies in X industry” discovery (Firecrawl Search) returning 5–10 candidates
- Dossier: research with citations, talking points that map 1:1 with Approved Claims, Q&A with a trustworthy “not found” fallback
- Call: single lead call via Vapi to your phone; live transcript; propose pre-defined time slots; create ICS
- Follow-up: one React email template via Resend with citations + ICS; webhooks update UI
- Real-time: Convex timeline stream; Autumn credit meter + PaywallDialog (trigger mid-run)

### Out (for now):
- Campaigns, team roles/SSO, analytics suite, template editor, deep monitoring/re-engagement, CRM/Slack/calendar integrations
- Complex compliance screens (keep a single consent note + default unsubscribe footer)

## User Journey (Gold Path)
Landing → Google sign-in → /dashboard/onboarding

### Onboarding wizard (flow):
- Step 1 (Company): Company name + website URL → kick off Firecrawl to build Seed Brain summary + extract draft claims
- Step 2 (Approve): See extracted draft claims with citations; toggle 3–5 “Approved” and add 1–2 guardrails (e.g., “don’t mention price or discounts”)
- Step 3 (Profile): Select tone (professional/consultative), ICP mini-form (Industry, Company Size, Buyer Role), time zone, and 2–3 slot options for availability; set default sender (skip domain verification)
- Save full Seed Brain → redirect to Dashboard; start with trial credits; visible credit meter appears

### Lead sourcing:
- Option A: Paste 3 domains (prepped for demo)
- Option B: Simple search (“Find 5 fintech SMBs”) → Firecrawl Search → returns 5 candidates → add 3

### Research and dossier:
- Click “Research” → crawl target → see dossier cards (summary, tech stack, talking points with citations)
- Q&A: ask 1–2 questions to demonstrate understanding and safety

### Call:
- Click “Call decision-maker” → Vapi calls your phone → short qualify → propose slots → “booked” toast
- Timeline shows live transcript events; call outcome updates status

### Follow-up:
- Resend sends recap email with cited bullets and ICS → webhook updates timeline (“delivered”, “opened”)

### Paywall:
- Credits drop near zero → PaywallDialog appears → upgrade → job resumes automatically

## Pages and Flows (MVP)
- Landing: promise, 60s explainer, “Start free”
- Auth + Onboarding: Google OAuth via Better-Auth; post-sign-in redirect to /dashboard/onboarding (personal workspace; no org creation)
- Onboarding Wizard (5 steps max as above)
- Dashboard: credit meter, next steps cards, live timeline
- Leads List: minimal table (domain, fit reason, status, last action)
- Lead Detail: “Trust mode: citations only” badge, dossier cards, citations, Q&A, Start Call button
- Call View (inline on Lead Detail): “Trust mode: citations only” badge, transcript panel, toasts, outcome tag
- Email Confirmation Banner: “Recap sent” with link to preview
- Paywall Dialog (Autumn): upgrade mid-run

## Sponsor Integrations (Exact Touchpoints)

### Auth (Better-Auth + Google OAuth):
- Google sign-in only (no magic links; no orgs/members)
- Expose authenticated userId; store userId on all records

### Convex:
- Data store for all entities (leads, seller_brain, dossiers, calls, emails, events, usage)
- Actions for background jobs, ensuring each step is idempotent to prevent double-charging on resume
- Real-time subscriptions to timeline and usage meter

### Firecrawl:
- Seller Brain ingest: crawl site (no PDFs)
- Lead discovery: Search endpoint. Synthesize fit_reason from results (e.g., “Mentions Stripe; frequent product updates”)
- Dossier crawl: resilient fetch of homepage. Cache demo domain results server-side

### OpenAI:
- Claim extraction, dossier summarization, and talking points, all strictly constrained by Approved Claims and Guardrails
- Q&A over embedded snippets with a defined cosine similarity threshold (e.g., 0.4) to trigger the “I couldn’t find that” response

### Vapi:
- Single outbound call to user phone, with a system prompt that includes user-defined Guardrails
- Minimal tools: proposeTimeSlots -> bookMeeting -> logOutcome
- Resilience: If call fails or goes to voicemail, log outcome as “Voicemail left” and proceed to send a modified recap email

### Resend:
- Send recap email to the signed-in user’s address by default. Include plain-text part and correctly formatted ICS (METHOD:REQUEST) for calendar integration
- Webhooks for delivered/opened update Convex timeline

### Autumn:
- Usage: Debit credits after successful completion of a step (crawl, AI action, call minute)
- Show credit bar; trigger PaywallDialog; upgrade resumes job
- Meters keyed by userId

## OpenAI Prompts/Patterns (Strictly Enforced)

### Guardrail Enforcement:
- All prompts (talking points, Q&A, Vapi persona, email recap) must include the user's guardrails (e.g., "NEVER mention pricing"). Refusal language should be consistent: “I can’t discuss pricing, but I can send details by email.”

### Talking Points Generator:
- Input: approved_claims [{id, text, source_url}], buyer facts, guardrails, tone
- Instruction: “Produce 3–5 points. Each must map to exactly one approved_claim_id and include its source_url. If no suitable claim exists, omit the point. Obey all guardrails.”

### Verifier:
- Instruction: “For each talking point, confirm its approved_claim_id text strongly supports the statement. If weak, unrelated, or violating a guardrail, reject the point.”

## Minimal Data Model (Convex)
- seller_brain: userId, companyName, sourceUrl, approvedClaims[{id, text, source_url}], guardrails[], tone, timeZone, availability[]
- leads: id, userId, domain, source, fit_reason, status
- dossier: leadId, summary, facts[{key, value, source_url}], talking_points[{text, approved_claim_id, source_url}], embeddingsRef
- calls: id, leadId, userId, transcript[], outcome, meeting_time, icsUrl
- emails: id, leadId, subject, html, status, deliveredAt, openedAt
- events (timeline): id, userId, type, subtype? (e.g., "call.transcript"), refId, message, ts
- usage: userId, plan, credits, counters {crawl_pages, ai_actions, call_minutes}

## Pipelines (Jobs)
- Onboarding: Firecrawl crawl (from company URL) → OpenAI ExtractClaims + Seed Brain summary → Verifier → store approved subset + summary → ready
- Research: For each lead → Firecrawl crawl homepage. If fails, show error. → Extract facts → OpenAI summarize/talking_points → Verifier → store
- Call: Start Vapi → stream transcript → on tool use, update UI → on outcome, generate ICS & log
- Email: On call outcome → render React template → Resend send → webhooks update status
- Credits: Before each step, check allowance. Debit on completion. Make jobs idempotent. If near zero, show Paywall.

## UI Specifics That Sell the MVP
- Unmistakable Trust: A small “Trust mode: citations only” badge on Dossier and Call views
- Interactive Citations: Dossier cards show [1], [2]. Hover reveals a tooltip: “Source Claim: ‘Atlas offers a native Salesforce sync.’ • Source: yoursite.com/integrations”
- Progressive States: Show skeletons and status labels (“Crawling…”, “Verifying claims…”, “Dossier ready…”) to make the experience feel fast and responsive
- Live Timeline: “Ingest started” → “Claims verified” → “Dossier ready” → “Calling…” → “Meeting booked” → “Email delivered/opened”
- Credit Meter: e.g., 8/10 credits; decrements visibly per action

## Tech Stack
- Next.js + TypeScript + Tailwind for fast UI
- Better-Auth (Google OAuth) for authentication
- Convex for backend, data, real-time, background jobs
- Deployed to Vercel (production URL; no localhost)
- Resend domain: use default sender for demo; domain verification optional

## 3-Minute Demo Script (Record This)
1. Sign in with Google → redirected to /dashboard/onboarding.
2. Enter Company name + website URL → watch crawl → see Seed Brain summary + claims with citations → toggle 3, add guardrail (“no pricing”).
3. Set ICP: “Fintech”, “10–200”, “Head of Ops”; Tone: “Consultative”; Time zone + availability: “Tu/Th 10–12 PT”.
4. Leads: click “Find fintech SMBs” → pick 3 from results with smart fit_reasons → add.
5. Open a lead → click “Research” → watch dossier fill → hover over a citation to show the interactive "Source Claim" tooltip.
6. Ask Q&A; see a valid answer, then see the safe “not found” response.
7. Click “Call decision-maker” → your phone rings → short qualify → propose time → booked toast.
8. Show recap email arrived with citations + ICS; timeline updates with delivered/opened.
9. Credits hit threshold → PaywallDialog → click upgrade → job resumes.

## Build Schedule (10–12 build days + polish)
- Day 1: Project scaffolding; Better-Auth (Google OAuth); Convex schema (no orgs/users tables); Landing + Auth + Onboarding route
- Day 2: Seller Brain ingest (Firecrawl) + ExtractClaims (OpenAI) + Verifier; Approve Claims UI
- Day 3: ICP mini-form; Guardrail enforcement in prompts; connect Autumn meter (userId)
- Day 4: Lead sourcing; leads table; fit_reason synthesis
- Day 5: Research pipeline + Data model update for approved_claim_id; interactive citation tooltip UI
- Day 6: Vapi call integration; define tools; ICS generation; voicemail fallback logic
- Day 7: Resend recap email (template + webhooks); timeline view
- Day 8: Autumn PaywallDialog; idempotent debit rules; resume jobs logic
- Day 9: Polish UI/UX; skeletons, spinners; error toasts; "Trust Mode" badge
- Day 10: Cache all demo domain crawls & embeddings; flaky network safeguards
- Day 11: Record demo video; write README with “Judge Path”; deploy; social posts
- Day 12: Buffer for bugs/perf; run throughs

## Risk Mitigation
- Crawling Latency: Cache demo crawls; fallback to homepage-only if search is slow
- Hallucinations: Mandatory 1:1 mapping of talking points to approved_claim_id; strict Verifier step; "not found" defaults
- Vapi Flakiness: Call your own phone; short script; voicemail fallback path with email
- Credit Double-Charging: Make all credit-debiting jobs idempotent
- Email Deliverability: Use a default shared sender; include plain-text part; correct ICS headers

## Deliverables and Submission Checklist
- Live app URL (Vercel)
- GitHub repo with clear README:
  - Judge Path steps from a fresh signup (Google OAuth)
  - Sponsor integration notes with file paths
  - OAuth configuration/testing notes (e.g., allowed domains/test account)
- 3–4 minute demo video showing gold path
- Social posts tagging sponsors

## Stretch (Only if time remains)
- “Copy recap to clipboard” button on Lead Detail page
- “Simulate call” toggle in a settings panel that runs a scripted transcript if live telephony is acting up during a demo
