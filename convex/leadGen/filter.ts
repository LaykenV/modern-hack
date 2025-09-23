/**
 * Lead filtering and scoring module
 * Filters places data and applies qualification scoring based on agency criteria
 */

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { processLead, passesHardFilter, type PlaceData, type ProcessedLead } from "./signals";

/**
 * Filter and score leads based on hard filters and qualification signals
 * Input: uses lead_gen_flow.placesSnapshot from Step 1
 * Output: returns filtered leads with signals and qualification scores
 */
export const filterAndScoreLeads = internalAction({
  args: {
    leadGenFlowId: v.id("lead_gen_flow"),
    agencyProfileId: v.id("agency_profile"),
  },
  returns: v.array(v.object({
    place_id: v.string(),
    name: v.string(),
    website: v.optional(v.string()),
    phone: v.string(), // Required after hard filter
    rating: v.optional(v.number()),
    reviews_count: v.optional(v.number()),
    address: v.optional(v.string()),
    signals: v.array(v.string()),
    qualificationScore: v.number(),
  })),
  handler: async (ctx, args) => {
    // Get the lead gen flow to access places snapshot
    const leadGenFlow = await ctx.runQuery(internal.leadGen.queries.getLeadGenFlowInternal, {
      leadGenFlowId: args.leadGenFlowId,
    });

    if (!leadGenFlow) {
      throw new Error("Lead generation flow not found");
    }

    if (!leadGenFlow.placesSnapshot || leadGenFlow.placesSnapshot.length === 0) {
      throw new Error("No places data found to filter");
    }

    // Get agency profile for lead qualification criteria
    const agencyProfile = await ctx.runQuery(internal.leadGen.queries.getAgencyProfileInternal, {
      agencyId: args.agencyProfileId,
    });

    if (!agencyProfile) {
      throw new Error("Agency profile not found");
    }

    const agencyCriteria = agencyProfile.leadQualificationCriteria || [];
    const totalPlaces = leadGenFlow.placesSnapshot.length;
    
    console.log(`[Lead Gen Filter] Starting to filter ${totalPlaces} places with criteria:`, agencyCriteria);

    // Update phase status to running
    await ctx.runMutation(internal.leadGen.statusUtils.updatePhaseStatus, {
      leadGenFlowId: args.leadGenFlowId,
      phaseName: "filter_rank",
      status: "running",
      progress: 0.1,
      eventMessage: `Filtering ${totalPlaces} places`,
    });

    const filteredLeads: ProcessedLead[] = [];
    let processedCount = 0;

    // Process each place
    for (const place of leadGenFlow.placesSnapshot) {
      processedCount++;
      
      // Convert place snapshot to PlaceData format
      const placeData: PlaceData = {
        id: place.id,
        name: place.name,
        website: place.website,
        phone: place.phone,
        rating: place.rating,
        reviews: place.reviews,
        address: place.address,
      };

      // Apply hard filter: must have phone number
      if (!passesHardFilter(placeData)) {
        console.log(`[Lead Gen Filter] Filtered out ${place.name} - no phone number`);
        continue;
      }

      // Process lead to detect signals and calculate score
      const processedLead = processLead(placeData, agencyCriteria);
      filteredLeads.push(processedLead);

      // Update progress periodically
      if (processedCount % 5 === 0 || processedCount === totalPlaces) {
        const progress = 0.1 + (0.8 * processedCount / totalPlaces);
        await ctx.runMutation(internal.leadGen.statusUtils.updatePhaseStatus, {
          leadGenFlowId: args.leadGenFlowId,
          phaseName: "filter_rank",
          status: "running",
          progress,
          eventMessage: `Processed ${processedCount}/${totalPlaces} places`,
        });
      }
    }

    const keptCount = filteredLeads.length;
    const droppedCount = totalPlaces - keptCount;

    console.log(`[Lead Gen Filter] Filter results: kept ${keptCount}, dropped ${droppedCount}`);

    // Mark phase as complete
    await ctx.runMutation(internal.leadGen.statusUtils.updatePhaseStatus, {
      leadGenFlowId: args.leadGenFlowId,
      phaseName: "filter_rank",
      status: "complete",
      progress: 1.0,
      eventMessage: `Filtered leads: kept ${keptCount}, dropped ${droppedCount}`,
    });

    // Return filtered leads in the expected format
    return filteredLeads.map(lead => ({
      place_id: lead.id,
      name: lead.name,
      website: lead.website,
      phone: lead.phone!, // Safe after hard filter
      rating: lead.rating,
      reviews_count: lead.reviews,
      address: lead.address,
      signals: lead.signals,
      qualificationScore: lead.qualificationScore,
    }));
  },
});
