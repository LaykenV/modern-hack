import { internalQuery, internalMutation, internalAction } from "../_generated/server";
import { v } from "convex/values";
// PhaseStatus import removed as it's no longer used
import { normalizeUrl, truncateContent } from "./contentUtils";
import { internal } from "../_generated/api";
import { atlasAgentGroq } from "../agent";
import type { Id } from "../_generated/dataModel";

export const loadClaimsContext = internalQuery({
  args: { onboardingFlowId: v.id("onboarding_flow") },
  returns: v.object({
    smartThreadId: v.string(),
    pages: v.array(
      v.object({ url: v.string(), contentRef: v.optional(v.id("_storage")) }),
    ),
  }),
  handler: async (ctx, args) => {
    const { onboardingFlowId } = args;
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow || !flow.smartThreadId) throw new Error("Flow not found");
    const relevant: Array<string> = (flow.relevantPages ?? []) as Array<string>;
    const top = relevant.slice(0, 8);
    const pages: Array<{ url: string; contentRef?: Id<"_storage"> }> = [];
    for (const u of top) {
      const n = normalizeUrl(u);
      const row = await ctx.db
        .query("crawl_pages")
        .withIndex("by_flow_and_url", (q) => q.eq("onboardingFlowId", onboardingFlowId).eq("url", n))
        .unique();
      pages.push({ url: n, contentRef: row?.contentRef ?? undefined });
    }
    return { smartThreadId: flow.smartThreadId, pages };
  },
});


export const generateClaims = internalAction({
  args: { onboardingFlowId: v.id("onboarding_flow") },
  returns: v.array(
    v.object({ id: v.string(), text: v.string(), source_url: v.string() }),
  ),
  handler: async (ctx, args) => {
    const { onboardingFlowId } = args;
    const { smartThreadId, pages } = await ctx.runQuery(internal.onboarding.claims.loadClaimsContext, { onboardingFlowId });
    const lines: Array<string> = [];

    // Limit pages to prevent memory issues during hackathon demo
    const limitedPages = pages.slice(0, 10);
  const concurrency = 2;
  let index = 0;
  const results: Array<{ i: number; line: string }> = [];

  async function worker() {
    while (true) {
      const i = index++;
      if (i >= limitedPages.length) break;
      const p = limitedPages[i];
      let snippet = "";
      if (p.contentRef) {
        try {
          console.log(`Attempting to load content for claims URL ${p.url}, contentRef: ${p.contentRef}`);
          const blob = await ctx.storage.get(p.contentRef);
          if (blob) {
            const text = await blob.text();
            snippet = truncateContent(text, 4000);
            console.log(`Successfully loaded content for ${p.url}: ${text.length} chars`);
          } else {
            console.warn(`No blob found for contentRef ${p.contentRef} at URL ${p.url}`);
          }
          // Small delay to avoid overwhelming storage API
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
          console.error(`Failed to load content for ${p.url}:`, e);
        }
      } else {
        console.warn(`No contentRef for URL ${p.url}, page data:`, p);
      }
      results.push({ i, line: `Source [${i + 1}]: ${p.url}\n${snippet}` });
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, limitedPages.length) }).map(() => worker()));
  results.sort((a, b) => a.i - b.i).forEach((r) => lines.push(r.line));

  const contextLines = lines.join("\n\n");
  const prompt = `You are generating factual, verifiable product/company claims based strictly on the provided sources.\n\nRules:\n- Only write claims that are directly supported by the sources.\n- Keep each claim short (<= 180 characters) and specific.\n- Output only JSON array, no extra text.\n- Each claim must include text and source_url (one of the provided sources).\n- 3 to 5 claims total.\n\nSources:\n${contextLines}\n\nOutput format:\n[{"text": "...", "source_url": "..."}]`;

  const result = await atlasAgentGroq.generateText(ctx, { threadId: smartThreadId }, { prompt });
  const raw = (result.text ?? "").trim();
  let claims: Array<{ text: string; source_url: string }> = [];
  try {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    const json = start >= 0 && end >= 0 ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      claims = parsed
        .filter((c) => c && typeof c.text === "string" && typeof c.source_url === "string")
        .slice(0, 5);
    }
  } catch (e) {
    console.warn("Claims JSON parse failed, using fallback:", e);
    // Fallback: create a simple claim from available data
    if (limitedPages.length > 0) {
      claims = [{
        text: `Company information available on website`,
        source_url: limitedPages[0].url
      }];
    }
  }

    const finalized = claims.map((c, idx) => ({ id: `claim_${idx + 1}`, text: c.text, source_url: normalizeUrl(c.source_url) }));
    return finalized;
  },
});


export const finishVerifyClaims = internalMutation({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    accepted: v.array(v.object({ id: v.string(), text: v.string(), source_url: v.string() })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { onboardingFlowId, accepted } = args;
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) return null;
    await ctx.db.patch(flow.agencyProfileId, { approvedClaims: accepted }); 
    // Phase status updates are now handled by the workflow
    return null;
  },
});

export const verifyClaims = internalAction({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    candidates: v.array(v.object({ id: v.string(), text: v.string(), source_url: v.string() })),
  },
  returns: v.array(v.object({ id: v.string(), text: v.string(), source_url: v.string() })),
  handler: async (ctx, args) => {
    const { onboardingFlowId, candidates } = args;
    
    // Get the onboarding flow to access the fastThreadId (using internal query)
    const flow = await ctx.runQuery(internal.onboarding.queries.getOnboardingFlowInternal, { onboardingFlowId });
    if (!flow) throw new Error("Onboarding flow not found");
    if (!flow.fastThreadId) throw new Error("Fast thread not initialized");
    
    // At this point, flow is guaranteed to be non-null
    
    // Verification phase tracking is now handled by the workflow

  const limit = 2;
  const accepted: Array<{ id: string; text: string; source_url: string }> = [];

  const work = candidates.map((c) => ({ c, n: normalizeUrl(c.source_url) }));
  const snippets: Record<string, string> = {};

  let idx = 0;
  async function loader() {
    while (true) {
      const i = idx++;
      if (i >= work.length) break;
      const { n } = work[i];
      try {
        const page = await ctx.runQuery(internal.onboarding.claims.getCrawlPageByUrl, { onboardingFlowId, url: n });
        if (page?.contentRef) {
          const blob = await ctx.storage.get(page.contentRef);
          if (blob) {
            const text = await blob.text();
            snippets[n] = truncateContent(text, 6000);
            console.log(`Successfully loaded verification content for ${n}: ${text.length} chars`);
          } else {
            console.warn(`No blob found for contentRef ${page.contentRef} at URL ${n}`);
            snippets[n] = "";
          }
        } else {
          console.warn(`No contentRef for verification URL ${n}`);
          snippets[n] = "";
        }
      } catch (e) {
        console.error(`Failed to load verification content for ${n}:`, e);
        snippets[n] = "";
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, work.length) }).map(() => loader()));

  let vi = 0;
  async function verifier() {
    while (true) {
      const i = vi++;
      if (i >= work.length) break;
      const { c, n } = work[i];
      const snippet = snippets[n] ?? "";

      const prompt = `Given the SOURCE TEXT (truncated) and a CLAIM, decide if the claim is strongly supported.\nReturn JSON only: {"accepted": boolean, "reason": string, "matched": string}\n\nCLAIM: ${c.text}\nSOURCE_URL: ${n}\nSOURCE TEXT:\n${snippet}`;

      let ok = false;
      try {
        const res = await atlasAgentGroq.generateText(ctx, { threadId: flow!.fastThreadId }, { prompt });
        const parsed = JSON.parse(res.text ?? "{}");
        ok = !!parsed.accepted;
        // Individual claim verification logging is now handled by the workflow
      } catch (e) {
        console.warn("Claim verification JSON parse failed:", e);
        // Conservative fallback - reject claim if parsing fails
        ok = false;
      }
      if (ok) accepted.push({ id: c.id, text: c.text, source_url: n });
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, work.length) }).map(() => verifier()));

    await ctx.runMutation(internal.onboarding.claims.finishVerifyClaims, { onboardingFlowId, accepted });
    return accepted;
  },
});

export const getCrawlPageByUrl = internalQuery({
  args: { onboardingFlowId: v.id("onboarding_flow"), url: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      url: v.string(),
      title: v.optional(v.string()),
      contentRef: v.optional(v.id("_storage")),
    }),
  ),
  handler: async (ctx, args) => {
    const { onboardingFlowId, url } = args;
  const n = normalizeUrl(url);
  const row = await ctx.db
    .query("crawl_pages")
    .withIndex("by_flow_and_url", (q) => q.eq("onboardingFlowId", onboardingFlowId).eq("url", n))
    .unique();
    if (!row) return null;
    return { url: row.url, title: row.title ?? undefined, contentRef: row.contentRef ?? undefined };
  },
});


