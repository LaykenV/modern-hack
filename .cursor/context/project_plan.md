# Atlas Outbound — Hackathon MVP Plan (Agency Pivot)

## MVP goal
- Solve the #1 prospecting bottleneck for digital agencies by providing an AI-powered outbound platform that finds qualified local clients, identifies their specific marketing pain points, and initiates a trust-based sales call.
- Ship a sub-3-minute gold-path demo: an agency owner pastes their site → defines their core service → finds 3 local businesses with identifiable gaps (e.g., no website) → the AI calls, references the gap, cites a case study, and books a discovery call.

## What’s in vs out (MVP scope)

### In
- **Agency Onboarding Wizard**: Agency name + website URL (Firecrawl ingest), approve claims (case studies), define `coreOffer`, set `targetVertical` + `targetGeography`, and select `leadQualificationCriteria` (pain points you solve).
- **Intelligent Lead Sourcing**: "Find 5 roofers in San Francisco" via Google Places, then automatically filter and rank them based on the agency's chosen qualification criteria. Return a list with a powerful, actionable `fit_reason` for each lead (e.g., "Opportunity: No website & low Google rating").
- **Instant Client Audit (Dossier)**: Combine Google Places data and a website crawl into a mini-audit that highlights the specific pain points the agency can solve. All facts are cited. Talking points map 1:1 to the agency's approved case studies.
- **Tailored AI Sales Call**: Call the business via Vapi. The AI's opening line is dynamically generated from the lead's `fit_reason` and the agency's `coreOffer`. It proposes time slots, creates an ICS, and has a voicemail fallback.
- **Professional Follow-up**: A React email sent via Resend includes a recap with cited case studies and the ICS file.
- **Agency-Ready Platform**: Convex-powered real-time timeline of all activities; Autumn credit meter for usage-based actions (`PaywallDialog` for scaling).

### Out (for now)
- White-labeling for agencies to resell.
- Full analytics suite (call connection rates, booking rates, etc.).
- A/B testing for call scripts or email templates.
- Direct integrations with agency-specific CRMs like HighLevel or GoHighLevel.

## User journey (gold path)
- Landing → Google sign-in → `/dashboard/onboarding`
- **Onboarding (as an Agency Owner)**:
  1) **Your Agency**: Enter "GrowthLocal" and `growthlocal.co` → Firecrawl ingests the site → Atlas extracts claims like *"We increased inbound leads by 40% for Bay Area Roofers."* → Approve 3 claims.
  2) **Your Service**: Define your `coreOffer`: "We build modern websites that generate more quote requests."
  3) **Your Ideal Client**: Set `targetVertical` ("Roofers"), `targetGeography` ("San Francisco"), and check boxes for `leadQualificationCriteria` like "Missing Website" and "Low Google Rating."
  4) **Your Calendar**: Set tone, time zone, and availability for discovery calls.
- **Lead Sourcing (Finding Clients)**:
  - Click “Find Qualified Clients” → Atlas finds roofers, filters them, and presents a list. The `fit_reason` column is the star: *"High-Priority: No website listed."* → You select 3 promising leads.
- **Research (Instant Audit)**:
  - Open a lead to see the "Client Opportunity Report." It clearly flags the pain points you can solve, like `GAP: Missing Website`.
- **Call (Automated Outreach)**:
  - Click “Call Business” → Vapi dials. The AI uses a tailored script: *"Hi, I'm calling from GrowthLocal. I noticed you don't have a website, which can make it hard for new customers to find you. We specialize in building websites for roofers that get more quote requests... In fact, we helped Bay Area Roofers increase their leads by 40%..."* → The AI books the discovery call.
- **Follow-up (Closing the Loop)**:
  - A professional recap email is sent to the roofer (and BCC'd to you) with the cited "40% claim" and the meeting invite.
- **Paywall (Ready to Scale)**:
  - As you use the tool, credits deplete, and the `PaywallDialog` appears, showing how a real agency could scale its outreach.

## Pages and flows (MVP)
- **Landing**: Headline: "Stop Prospecting. Start Closing." Sub-headline: "The AI outbound platform for digital agencies."
- **Auth + Onboarding**: Google OAuth; redirect to a multi-step onboarding wizard designed for agencies.
- **Onboarding Wizard**: Clear steps for "Your Agency," "Your Service," and "Your Ideal Client."
- **Dashboard**: "Client Pipeline" view with credit meter, next-step cards, and a live timeline of all outreach activities.
- **Leads List**: A table renamed to "Client Opportunities" with a prominent, color-coded `fit_reason` column.
- **Lead Detail**: Re-framed as a "Client Opportunity Report" with "Identified Gaps" and "Talking Points" sections.
- **Call View (inline)**: Live transcript panel.
- **Email Confirmation Banner**: "Recap email sent to [lead.name]".
- **Paywall Dialog** (Autumn).

## Sponsor integrations (exact touchpoints)
- **Better-Auth (Google)**: For agency owner sign-in.
- **Convex**: The backend for storing agency profiles, client opportunities, call logs, and powering the real-time dashboard.
- **Google Places API**: The discovery engine for finding local businesses that need the agency's services.
- **Firecrawl**: To ingest the agency's own website to extract proof points (case studies, testimonials) for cited claims. Also used to audit potential clients' websites.
- **OpenAI**: The brain for extracting claims, synthesizing the `fit_reason`, and generating talking points that connect an agency's strengths to a client's weaknesses.
- **Vapi**: To execute the outbound sales call with a dynamic, context-aware script.
- **Resend**: To send the professional, cited follow-up email and meeting invitation.
- **Autumn**: To manage the usage-based credit system, making it a real, scalable product.

## OpenAI prompts/patterns (strict)
- **Vapi System Prompt**: "You are a friendly and professional sales development representative for the digital agency, `[agency_profile.companyName]`. Their core service is `[agency_profile.coreOffer]`. You are calling `[lead.name]`. Your primary goal is to book a 15-minute discovery call. Start the conversation by referencing the specific marketing gap we identified: `[lead.fit_reason]`. You must use one of the approved claims from `[agency_profile.approvedClaims]` to build trust. Obey these guardrails: `[agency_profile.guardrails]`."
- **Talking points generator**: "Input: agency's `approved_claims`, client's `fit_reason` (pain point), agency's `coreOffer`. Instruction: Create 3 talking points. Each point must logically connect the client's pain point to the agency's core offer and be supported by exactly one `approved_claim_id`."
- **Verifier**: "For each talking point, confirm its `approved_claim_id` strongly supports the statement about solving the client's problem. If weak, reject the point."
- **Q&A**: "Only answer with snippets whose cosine similarity ≥ threshold; otherwise respond with 'That's a great question for the strategy session, which I can book for you now.'"

## Enhanced data model (Convex)
- `agency_profile`: `userId`, `companyName`, `sourceUrl`, `approvedClaims[{id, text, source_url}]`, `guardrails[]`, `tone`, `timeZone`, `availability[]`, `targetVertical`, `targetGeography`, `coreOffer`, `leadQualificationCriteria[]`.
- `client_opportunities`: `id`, `agencyId` (fk to `agency_profile`), `name`, `domain?`, `phone`, `place_id`, `address`, `city`, `rating`, `reviews_count`, `source="google_places"`, `fit_reason`, `status`, **`targetVertical`**, **`targetGeography`**, **`qualificationScore`**, **`signals[]`** (for campaign tracking, intelligent ranking, and UI badges).
- `audit_dossier`: `opportunityId`, **`auditJobId?`** (links to audit job), `summary`, `identified_gaps[{key, value, source_url}]`, `talking_points[{text, approved_claim_id, source_url}]`.
- **`audit_jobs`**: `opportunityId`, `agencyId`, `targetUrl`, `status` (queued/running/error/completed), `phases[{name, status}]` (map_urls, filter_urls, scrape_content, generate_dossier), `dossierId?` (tracks deep audit workflow state).
- `calls`: `id`, `opportunityId`, `agencyId`, `transcript[]`, `outcome`, `meeting_time`.
- `emails`: `id`, `opportunityId`, `subject`, `html`, `status`.
- `events` (timeline): `id`, `agencyId`, `type`, `refId`, `message`.
- `usage`: `agencyId`, `plan`, `credits`, `counters{...}`.

## Enhanced pipelines (jobs)
- **Onboarding**: Firecrawl agency site → Extract claims → Agency owner approves claims & completes the offer/client profile form.
- **Enhanced Lead Qualification**: Places search by `targetVertical`+`targetGeography` → **Hard filter** (require phone) → **Signal detection** (missing website, weak web presence, low ratings) → **Dynamic scoring** based on agency's `leadQualificationCriteria` → Store with `qualificationScore` and `signals[]` → **Queue top-scoring leads** for deep audit.
- **Deep Client Audit** (via `audit_jobs`): Create audit job → **Map URLs** (crawl discovery) → **Filter URLs** (AI-selected relevant pages) → **Scrape content** → **Generate dossier** (confirm signals, identify gaps) → Link to `audit_dossier` → Update opportunity status to "READY".
- **Outreach Call**: Start Vapi with the dynamic system prompt → Stream transcript → On outcome, generate ICS & log.
- **Follow-up Email**: On call outcome, render template → Send via Resend.
- **Credit Management**: Check allowance before each billable step; debit on completion.

## Enhanced UI specifics that sell the MVP
- The multi-step onboarding wizard feels tailored and intelligent, making the agency user feel understood.
- **Ranked "Client Opportunities" list**: Sorted by `qualificationScore` (highest first) with **multiple dynamic badges** from `signals[]` (e.g., red "NO WEBSITE" + yellow "LOW RATING" badges) - the central "Aha!" moment.
- **Campaign filtering**: Dropdowns to filter opportunities by historical `targetVertical` and `targetGeography` for managing multiple campaigns.
- **Transparent audit progress**: Real-time phase tracking from `audit_jobs` table shows "AUDITING: Scraping Content..." status.
- The "Client Opportunity Report" view, which clearly lays out "Identified Gaps" and how the agency's "Proof Points" (claims) solve them.
- "Trust Mode: Case Studies Cited" badges reinforce the core value prop.

## Tech stack
- Next.js + TypeScript + Tailwind (For the agency-facing dashboard)
- Better-Auth (Google) (Secure sign-in for agency owners)
- Convex (Real-time backend for a fluid, responsive UI)
- Google Places API (The source of all client opportunity data)
- Firecrawl (For both initial agency site ingest and client site auditing)
- OpenAI (The intelligence layer for analysis and conversation)
- Vapi (The voice that executes the outreach)
- Resend (For professional email follow-ups)
- Autumn (To monetize and manage usage like a real SaaS product)
- Vercel (For deployment)

## 3-minute demo script
1) **Setup (0:00-0:30)**: "Hi, I'm the founder of a small web dev agency. My biggest problem is finding time for sales. So I built Atlas. Let me show you how it works."
2) **Onboarding (0:30-1:15)**: Sign in. Paste your agency's URL. "Atlas reads my site and pulls out my case studies." Approve a claim like "Increased leads 40% for Bay Area Roofers." Quickly fill out the core service ("Websites for contractors") and ideal client profile (Roofers in SF with "No Website").
3) **Lead Gen (1:15-1:45)**: Click "Find Clients." A ranked list appears. "In seconds, Atlas found and scored roofers in SF. Look at this - they're ranked by qualification score, and you can see multiple pain points at a glance. This one has a 95/100 score with 'NO WEBSITE' and 'LOW RATING' badges. Let's call this one."
4) **The Call (1:45-2:30)**: Click call. A live transcript pops up. We hear the AI: *"Hi, I'm calling from GrowthLocal. I found you on Google but noticed you don't have a website, and I know how important that is for getting new projects. We actually helped another local company, Bay Area Roofers, increase their leads by 40% after we built their new site. Would you have 15 minutes next week for a quick chat about it?"* ... The call gets booked.
5) **Closing (2:30-3:00)**: "Boom. A qualified discovery call is booked. The follow-up email with the case study is already sent. The entire process was automated, trusted, and took less than 3 minutes. That's Atlas, the outbound platform for agencies."

## Build schedule (10–12 days)
- **Day 1**: Scaffold; Auth; Convex schema (with `agency_profile`); Landing page with new copy.
- **Day 2**: Firecrawl ingest for agency claims; Approve Claims UI.
- **Day 3**: Build the full agency onboarding wizard (Service, Ideal Client, Qualifiers).
- **Day 4**: Implement the intelligent lead sourcing pipeline (search, filter, rank, `fit_reason`).
- **Day 5**: Build the "Client Opportunity Report" UI and the research pipeline to populate it.
- **Day 6**: Integrate Vapi with the fully dynamic, agency-aware system prompt.
- **Day 7**: Integrate Resend for emails; build timeline view.
- **Day 8**: Integrate Autumn `PaywallDialog` and credit logic.
- **Day 9**: UI polish: loading states, error handling, `fit_reason` badges.
- **Day 10**: Cache demo data to ensure a smooth presentation.
- **Day 11**: Record the demo video; write the README; deploy.
- **Day 12**: Final bug fixes and presentation dry runs.

## Risk mitigation
- **Places quotas/latency**: Pre-cache a few agency profiles and client opportunity searches for demo cities.
- **Phone accuracy**: Use `international_phone_number`; if a call fails, the status updates to "Bad Number" and the agency isn't charged.
- **Website missing**: This is no longer a bug; it's a feature! It's a key qualification criterion.
- **Call compliance**: A consent note is still key. The niche focus on B2B service providers is lower risk than other categories.
- **Hallucinations**: The strict 1:1 mapping of talking points to an agency's approved claims is the core defense.

## Deliverables and checklist
- Live Vercel app URL
- GitHub repo + README (with the agency-focused Judge Path)
- 3-min demo video telling the agency owner story
- Social posts tagging sponsors, positioned as a tool for agencies

## Stretch (only if time remains)
- **Add more `leadQualificationCriteria`**: "Website not mobile friendly" (detectable via Firecrawl), or "No Google Analytics tag found."
- **"Simulate Call" button**: Allows the agency owner to receive the AI call on their own phone to test the script before going live.
- **Simple inbound demo**: A "Talk to AI Sales Rep" button on the Atlas landing page itself, powered by Vapi, to demo the tech instantly.