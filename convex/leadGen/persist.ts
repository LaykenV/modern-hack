/**
 * Lead persistence module
 * Saves filtered leads as client_opportunities with deduplication
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { canonicalDomain } from "./signals";

/**
 * Persist filtered leads as client_opportunities
 * Uses upsert logic with place_id and domain deduplication
 */
export const persistClientOpportunities = internalMutation({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
    agencyProfileId: v.id("agency_profile"),
    campaign: v.object({
      targetVertical: v.string(),
      targetGeography: v.string(),
    }),
    leads: v.array(v.object({
      place_id: v.string(),
      name: v.string(),
      website: v.optional(v.string()),
      phone: v.string(),
      rating: v.optional(v.number()),
      reviews_count: v.optional(v.number()),
      address: v.optional(v.string()),
      signals: v.array(v.string()),
      qualificationScore: v.number(),
    })),
  },
  returns: v.object({
    created: v.number(),
    updated: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const { leadGenFlowId, agencyProfileId, campaign, leads } = args;
    
    let created = 0;
    let updated = 0;
    let skipped = 0;

    console.log(`[Lead Gen Persist] Persisting ${leads.length} leads for flow ${leadGenFlowId}`);

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      
      try {
        // Check for existing opportunity by place_id
        const existingByPlaceId = await ctx.db
          .query("client_opportunities")
          .withIndex("by_place_id", (q) => q.eq("place_id", lead.place_id))
          .first();

        if (existingByPlaceId) {
          console.log(`[Lead Gen Persist] Skipping ${lead.name} - already exists by place_id`);
          skipped++;
          continue;
        }

        // Check for existing opportunity by canonical domain (if website exists)
        let existingByDomain = null;
        const domain = canonicalDomain(lead.website);
        if (domain) {
          existingByDomain = await ctx.db
            .query("client_opportunities")
            .withIndex("by_agency", (q) => q.eq("agencyId", agencyProfileId))
            .filter((q) => q.eq(q.field("domain"), domain))
            .first();
        }

        if (existingByDomain) {
          console.log(`[Lead Gen Persist] Skipping ${lead.name} - already exists by domain ${domain}`);
          skipped++;
          continue;
        }

        // Create new client opportunity
        const opportunityData = {
          agencyId: agencyProfileId,
          name: lead.name,
          domain: domain,
          phone: lead.phone,
          place_id: lead.place_id,
          address: lead.address,
          rating: lead.rating,
          reviews_count: lead.reviews_count,
          source: "google_places",
          status: "SOURCED",
          leadGenFlowId,
          targetVertical: campaign.targetVertical,
          targetGeography: campaign.targetGeography,
          qualificationScore: lead.qualificationScore,
          signals: lead.signals,
          fit_reason: undefined, // Will be populated later in audit phase
        };

        await ctx.db.insert("client_opportunities", opportunityData);
        created++;
        
        console.log(`[Lead Gen Persist] Created opportunity for ${lead.name} (${lead.place_id})`);
        
      } catch (error) {
        console.error(`[Lead Gen Persist] Error persisting lead ${lead.name}:`, error);
        skipped++;
      }
    }

    console.log(`[Lead Gen Persist] Results: created ${created}, updated ${updated}, skipped ${skipped}`);

    return { created, updated, skipped };
  },
});

/**
 * Get count of client opportunities for a lead gen flow
 */
export const getOpportunityCountByFlow = internalMutation({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
  },
  returns: v.object({
    total: v.number(),
    withWebsites: v.number(),
    withoutWebsites: v.number(),
  }),
  handler: async (ctx, args) => {
    const opportunities = await ctx.db
      .query("client_opportunities")
      .withIndex("by_leadGenFlow", (q) => q.eq("leadGenFlowId", args.leadGenFlowId))
      .collect();

    const total = opportunities.length;
    const withWebsites = opportunities.filter(opp => opp.domain).length;
    const withoutWebsites = total - withWebsites;

    return {
      total,
      withWebsites,
      withoutWebsites,
    };
  },
});
