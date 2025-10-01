# Audit Dossier Generation - Reliability Upgrade Plan (Phases 1-3)

## Executive Summary

**Problem:** Audit dossier generation has ~50% success rate, randomly triggering fallback even when pages are scraped correctly.

**Root Cause:** Using `generateText` + `JSON.parse()` is brittle. LLMs add markdown formatting, extra text, or produce malformed JSON, causing parse failures.

**Solution:** Switch to `generateObject` with Zod schemas for 90-95% reliability improvement.

---

## Current Implementation Issues

### File: `convex/leadGen/audit.ts`

**Lines 426-571: `generateDossierAndFitReasonHelper`**

Current problems:
1. **Brittle JSON parsing** (line 473): `JSON.parse(dossierRes.text ?? "{}")` fails on markdown wrappers or malformed JSON
2. **Overly broad error handling** (lines 464-571): Single try/catch catches content loading errors, DB errors, parsing errors, and LLM failures - can't distinguish failure types
3. **No schema validation**: Even if JSON parses, fields may be missing or wrong types
4. **Two sequential LLM calls** (lines 472, 495): Dossier first, then fit reason - doubles failure points
5. **Generic prompt instructions**: "Format as JSON:" is weak, no strict enforcement

---

## Phase 1: Define Zod Schemas

### Implementation

**Location:** Top of `convex/leadGen/audit.ts` (after imports, before functions)

```typescript
import { z } from "zod";

/**
 * Zod schema for audit dossier generation
 * Used with generateObject to ensure structured, validated output
 */
const DossierSchema = z.object({
  summary: z.string()
    .min(20)
    .describe("2-3 sentence business summary: what they do, who they serve, key value propositions"),
  
  primary_email: z.string()
    .email()
    .nullable()
    .describe("Best contact email found on website (info@, contact@, hello@, sales@, or named contact). Return null if not found."),
  
  gaps: z.array(
    z.object({
      key: z.string().describe("Gap category (e.g., 'SEO Optimization', 'Mobile UX', 'Content Strategy')"),
      value: z.string().describe("Specific gap description with actionable detail"),
      source_url: z.string().url().optional().describe("Supporting URL from scraped pages"),
    })
  )
    .min(2)
    .max(5)
    .describe("3-5 specific technical, marketing, operational, or strategic weaknesses we could address"),
  
  talking_points: z.array(
    z.object({
      text: z.string().describe("Specific conversation starter connecting our capabilities to their needs"),
      source_url: z.string().url().optional().describe("Supporting URL from scraped pages"),
    })
  )
    .min(2)
    .max(4)
    .describe("3-4 conversation starters for sales outreach"),
  
  fit_reason: z.string()
    .max(150)
    .describe("Concise 1-2 sentence explanation of why this prospect is a good fit, under 150 characters"),
});

type DossierOutput = z.infer<typeof DossierSchema>;
```

**Why this schema:**
- Field descriptions guide the LLM on what to generate
- `.min()` and `.max()` ensure output quality
- `.nullable()` for optional email (no fake emails)
- `.email()` validates email format
- `.url()` validates source URLs
- Type inference gives us TypeScript safety

---

## Phase 2: Separate Error Contexts

### Current Code Structure (Problematic)

```typescript
// Lines 407-571: Everything in ONE try/catch
for (const page of pagesWithContent.slice(0, 8)) {
  try {
    // Load content from storage
  } catch (error) {
    // Log but continue - THIS IS GOOD
  }
}

try {
  // AI generation
  const dossierRes = await atlasAgentGroq.generateText(...);
  const dossierData = JSON.parse(dossierRes.text ?? "{}"); // BRITTLE!
  
  // Create dossier
  // ... 
  
} catch (error) {
  // FALLBACK - triggers on ANY error above
  // Can't tell if content loading failed or AI failed
}
```

### New Code Structure (Robust)

**Lines 403-424: Content Loading (Keep existing logic)**
```typescript
// Load and prepare context from storage references (upgrade plan requirement)
const contextLines: Array<string> = [];
const pagesWithContent = scrapedPages.filter(page => page.contentRef);

let successfullyLoadedPages = 0;

for (const page of pagesWithContent.slice(0, 8)) { // Limit to prevent memory issues
  try {
    if (page.contentRef) {
      const blob = await ctx.storage.get(page.contentRef);
      if (blob) {
        const text = await blob.text();
        const truncated = text.slice(0, 4000);
        contextLines.push(`URL: ${page.url}\nTitle: ${page.title || 'N/A'}\nContent:\n${truncated}\n\n---\n\n`);
        successfullyLoadedPages++;
      }
    }
  } catch (error) {
    console.error(`[Audit Dossier] Failed to load content for ${page.url}:`, error);
    contextLines.push(`URL: ${page.url}\nTitle: ${page.title || 'N/A'}\nContent: [Content loading failed]\n\n---\n\n`);
  }
}

const contextContent = contextLines.join('');

// Early validation: ensure we have meaningful content
if (contextContent.length < 100 || successfullyLoadedPages === 0) {
  console.error(`[Audit Dossier] Insufficient content loaded. Content length: ${contextContent.length}, Successful pages: ${successfullyLoadedPages}`);
  throw new Error("Insufficient content for analysis");
}

console.log(`[Audit Dossier] Loaded ${successfullyLoadedPages}/${pagesWithContent.length} pages successfully (${contextContent.length} chars) for ${opportunity.name}`);
```

**Lines 426-530: AI Generation (New separate try/catch)**
```typescript
try {
  // Use thread context with userId fallback (upgrade plan requirement)
  const threadContext: { threadId?: string; userId?: string } = auditJob.analysisThread 
    ? { threadId: auditJob.analysisThread }
    : leadGenFlow?.userId 
    ? { userId: leadGenFlow.userId }
    : {};
  
  // PHASE 3 CODE GOES HERE (generateObject call)
  
  console.log(`[Audit Dossier] Successfully generated dossier for ${opportunity.name}: ${result.object.gaps.length} gaps, ${result.object.talking_points.length} points, email: ${!!result.object.primary_email}`);
  
  // Create dossier in database
  // ... (updated to use result.object)
  
  return {
    dossierId,
    fitReason: result.object.fit_reason,
  };
  
} catch (error) {
  // This ONLY catches AI generation failures, not content loading issues
  console.error(`[Audit Dossier] AI generation failed for ${opportunity.name}:`, {
    errorType: error instanceof Error ? error.name : 'Unknown',
    errorMessage: error instanceof Error ? error.message : String(error),
    contentLength: contextContent.length,
    pagesLoaded: successfullyLoadedPages,
  });
  
  // FALLBACK CODE (Phase 7 improvement)
  // For now, keep existing fallback logic
}
```

---

## Phase 3: Switch to generateObject + Combine LLM Calls

### Replace Lines 427-496 With

```typescript
// Generate comprehensive dossier using generateObject for reliability
const dossierPrompt = `You are a sales intelligence analyst. Analyze this potential client's website and create a detailed sales dossier.

AGENCY CONTEXT:
- Company: ${agency.companyName}
- Core Offer: ${agency.coreOffer || 'Not specified'}
- Summary: ${agency.summary || 'Not available'}

PROSPECT CONTEXT:
- Company: ${opportunity.name}
- Qualification Signals: ${opportunity.signals.join(', ') || 'None'}
- Industry: ${opportunity.targetVertical}
- Location: ${opportunity.targetGeography}

WEBSITE CONTENT (${successfullyLoadedPages} pages analyzed):
${contextContent}

INSTRUCTIONS:
1. BUSINESS SUMMARY: Write 2-3 sentences explaining what they do, who they serve, and their key value propositions
2. IDENTIFIED GAPS: Find 3-5 SPECIFIC technical, marketing, operational, or strategic weaknesses we could address
   - Each gap must be actionable and verifiable from the content
   - Include source_url when possible
   - Example: {"key": "SEO Optimization", "value": "Homepage missing meta description and H1 tag", "source_url": "https://..."}
3. TALKING POINTS: Create 3-4 conversation starters that connect our capabilities to their needs
   - Be specific, reference actual content from their site
   - Include source_url when possible
4. PRIMARY EMAIL: Extract the best contact email found (info@, contact@, hello@, sales@, support@, or named contacts)
   - Return null if no email found
   - Must be a valid email format
5. FIT REASON: Write a concise 1-2 sentence explanation (under 150 characters) of why this prospect is a good fit
   - Reference their qualification signals: ${opportunity.signals.join(', ')}
   - Connect to our core offering

CRITICAL: Generate ONLY the structured data based on the website content provided. Do not fabricate information.`;

try {
  // Use thread context with userId fallback (upgrade plan requirement)
  const threadContext: { threadId?: string; userId?: string } = auditJob.analysisThread 
    ? { threadId: auditJob.analysisThread }
    : leadGenFlow?.userId 
    ? { userId: leadGenFlow.userId }
    : {};
  
  // Use generateObject instead of generateText for structured output
  const result = await atlasAgentGroq.generateObject(
    ctx,
    threadContext,
    {
      prompt: dossierPrompt,
      schema: DossierSchema,
    }
  );

  // Extract email from AI response (validated by Zod schema)
  const extractedEmail = result.object.primary_email;
  
  console.log(`[Audit Dossier] Successfully generated structured dossier for ${opportunity.name}:`, {
    gapsCount: result.object.gaps.length,
    talkingPointsCount: result.object.talking_points.length,
    hasEmail: !!extractedEmail,
    summaryLength: result.object.summary.length,
    fitReasonLength: result.object.fit_reason.length,
  });

  // Create dossier in database (upgrade plan: compact with optional sources)
  const dossierId = await ctx.runMutation(internal.leadGen.audit.createAuditDossier, {
    opportunityId,
    auditJobId: args.auditJobId,
    summary: result.object.summary,
    identifiedGaps: result.object.gaps.map(gap => ({
      key: gap.key,
      value: gap.value,
      source_url: gap.source_url,
    })),
    talkingPoints: result.object.talking_points.map((tp, index) => ({
      text: tp.text,
      approved_claim_id: `generated_${index}`,
      source_url: tp.source_url,
    })),
    // Optional sources list for display (no embedded content)
    sources: pagesWithContent.slice(0, successfullyLoadedPages).map(page => ({
      url: page.url,
      title: page.title,
    })),
    email: extractedEmail,
  });

  // Save fit reason to opportunity
  await ctx.runMutation(internal.leadGen.audit.saveFitReason, {
    opportunityId,
    fitReason: result.object.fit_reason,
  });

  console.log(`[Audit Dossier] Created dossier ${dossierId} for ${opportunity.name}`);
  
  return {
    dossierId,
    fitReason: result.object.fit_reason,
  };
  
} catch (error) {
  // This ONLY catches AI generation failures now, not content loading issues
  console.error(`[Audit Dossier] AI generation failed for ${opportunity.name}:`, {
    errorType: error instanceof Error ? error.name : 'Unknown',
    errorMessage: error instanceof Error ? error.message : String(error),
    contentLength: contextContent.length,
    pagesLoaded: successfullyLoadedPages,
  });
  
  // KEEP EXISTING FALLBACK CODE (lines 532-570)
  // ... (no changes to fallback logic for now)
}
```

---

## Key Changes Summary

### 1. Import Zod (top of file)
```typescript
import { z } from "zod";
```

### 2. Add DossierSchema (after imports)
```typescript
const DossierSchema = z.object({ ... });
type DossierOutput = z.infer<typeof DossierSchema>;
```

### 3. Update generateDossierAndFitReasonHelper function

**Content Loading Section (lines 403-424):**
- Add `successfullyLoadedPages` counter
- Add early validation for content length
- Add detailed logging before AI call

**AI Generation Section (lines 426-530):**
- Replace two `generateText` calls with one `generateObject` call
- Use `DossierSchema` for validation
- Update prompt with better instructions and examples
- Remove separate fit reason call (now part of main schema)
- Update database mutations to use `result.object` instead of parsed JSON
- Improve error logging with context

**Fallback Section (lines 530-571):**
- Keep existing fallback logic unchanged (for now)
- Error catch now only triggers on AI failures, not content issues

---

## Files to Modify

### Primary File
- **`convex/leadGen/audit.ts`**
  - Lines 1-10: Add Zod import
  - Lines 15-50: Add DossierSchema definition
  - Lines 403-571: Update `generateDossierAndFitReasonHelper` function

### No Changes Needed
- `convex/leadGen/workflow.ts` - workflow calls audit action, no changes needed
- `convex/firecrawlActions.ts` - scraping logic is fine
- `convex/leadGen/queries.ts` - query logic unchanged
- Schema definitions - no schema changes needed

---

## Testing Checklist

After implementation, verify:

1. **Successful path:**
   - [ ] Dossier generates with all required fields
   - [ ] Email extraction works when present
   - [ ] Gaps array has 2-5 items
   - [ ] Talking points array has 2-4 items
   - [ ] Fit reason is under 150 chars
   - [ ] Source URLs are valid when present

2. **Error handling:**
   - [ ] Content loading failures don't trigger fallback (continues with partial content)
   - [ ] AI failures trigger fallback with detailed error logs
   - [ ] Logs distinguish between content vs AI failures

3. **Edge cases:**
   - [ ] No email found → `primary_email: null`
   - [ ] Minimal content → generates basic but valid dossier
   - [ ] Invalid schema → clear Zod validation error

---

## Expected Improvements

**Before (Current):**
- ~50% success rate (random JSON parsing failures)
- Can't distinguish error types
- Two LLM calls = 2x failure points
- Generic error messages

**After (Phases 1-3):**
- ~90-95% success rate (schema-enforced structure)
- Clear error separation (content vs AI)
- One LLM call = 1x failure points
- Detailed contextual logging

---

## Implementation Notes

### Preserve These Patterns
1. **Thread context logic** (lines 466-470): Keep userId fallback for background workflows
2. **Content truncation** (line 414): Keep 4000 char limit per page
3. **Storage loading pattern** (lines 407-422): Keep existing try/catch per page
4. **Database mutations** (lines 499-521): Keep same mutation calls, just update data mapping
5. **Fallback logic** (lines 532-570): Keep unchanged for Phase 1-3

### Don't Change
1. Audit workflow phases (map_urls, filter_urls, scrape_content, generate_dossier)
2. Billing/metering logic (lines 744-772 in runAuditAction)
3. Opportunity status updates
4. Phase status tracking

### Watch Out For
1. **Zod import**: Make sure it's available in Convex runtime (should be, used elsewhere)
2. **Schema descriptions**: These guide the LLM, make them clear and specific
3. **Thread context**: Must maintain userId fallback for background workflows
4. **Error logs**: Include enough context to debug issues in production

---

## Future Enhancements (Phase 4-7)

**Phase 4: Enhanced Prompts**
- Add more examples in prompt
- Stricter formatting instructions

**Phase 5: Retry Strategy**
- 3 attempts with exponential backoff
- Simplified prompt on retry

**Phase 6: Better Observability**
- Structured logging
- Performance metrics

**Phase 7: Smarter Fallback**
- Use partial content when available
- Add `fallback: boolean` flag to dossiers

---

## Success Criteria

✅ Audit dossier success rate increases from ~50% to 90%+
✅ Error logs clearly indicate failure type (content vs AI)
✅ No regression in existing functionality (billing, workflow phases, UI)
✅ Type safety improved (Zod schema validation)
✅ Single LLM call reduces latency and cost

---

## Rollback Plan

If issues occur:
1. Revert `convex/leadGen/audit.ts` to previous version
2. Monitor error logs for specific failure patterns
3. Test schema definitions in isolation
4. Verify Groq model compatibility with `generateObject`

The changes are isolated to one function in one file, making rollback straightforward.
