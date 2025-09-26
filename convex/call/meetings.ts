import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { DateTime } from "luxon";
import type { Doc, Id } from "../_generated/dataModel";

export const finalizeBooking = internalMutation({
  args: {
    callId: v.id("calls"),
    isoTimestamp: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { callId, isoTimestamp }) => {
    console.log(`[Meeting Finalization] Processing booking for call ${callId} at ${isoTimestamp}`);

    // Load call record
    const call: Doc<"calls"> | null = await ctx.db.get(callId);
    if (!call) {
      console.error(`[Meeting Finalization] Call ${callId} not found`);
      return null;
    }

    // Load agency for timezone validation
    const agency: Doc<"agency_profile"> | null = await ctx.db.get(call.agencyId);
    if (!agency) {
      console.error(`[Meeting Finalization] Agency ${call.agencyId} not found`);
      return null;
    }

    const agencyTimeZone = agency.timeZone ?? "America/New_York";
    
    // Parse and validate the timestamp
    let meetingDateTime: DateTime;
    try {
      meetingDateTime = DateTime.fromISO(isoTimestamp, { zone: agencyTimeZone });
      if (!meetingDateTime.isValid) {
        throw new Error(`Invalid ISO timestamp: ${isoTimestamp}`);
      }
    } catch (error) {
      console.error(`[Meeting Finalization] Invalid timestamp ${isoTimestamp}:`, error);
      return null;
    }

    const meetingTimeMs = meetingDateTime.toMillis();
    
    // Double-check that the slot is still available by recomputing the availability grid
    console.log(`[Meeting Finalization] Validating slot availability`);
    const isStillAvailable = await ctx.runQuery(
      internal.call.availability.validateSlot,
      { agencyId: call.agencyId, slotIso: isoTimestamp }
    );

    if (!isStillAvailable) {
      console.warn(`[Meeting Finalization] Slot ${isoTimestamp} is no longer available`);
      // Update call with booking failure
      await ctx.db.patch(callId, {
        outcome: "booking_failed",
        currentStatus: "booking_failed",
      });
      return null;
    }

    // Check for existing meetings at the exact same time (race condition protection)
    const existingMeeting = await ctx.db
      .query("meetings")
      .withIndex("by_agency_and_time", (q) => 
        q.eq("agencyId", call.agencyId)
         .eq("meetingTime", meetingTimeMs)
      )
      .first();

    if (existingMeeting) {
      console.warn(`[Meeting Finalization] Meeting already exists at ${isoTimestamp} (${meetingTimeMs})`);
      await ctx.db.patch(callId, {
        outcome: "booking_failed",
        currentStatus: "booking_failed",
      });
      return null;
    }

    try {
      // Insert the meeting record
      const meetingId: Id<"meetings"> = await ctx.db.insert("meetings", {
        agencyId: call.agencyId,
        opportunityId: call.opportunityId,
        callId: callId,
        meetingTime: meetingTimeMs,
        source: "ai_call",
        createdBy: "atlas_ai",
      });

      console.log(`[Meeting Finalization] Created meeting ${meetingId} for ${meetingDateTime.toISO()}`);

      // Update the call record with booking success
      await ctx.db.patch(callId, {
        outcome: "booked",
        meeting_time: meetingTimeMs,
        currentStatus: "booked",
      });

      // Update the opportunity status
      await ctx.runMutation(internal.leadGen.audit.updateOpportunityStatus, {
        opportunityId: call.opportunityId,
        status: "Booked",
      });

      // Also update opportunity with meeting time for reference
      await ctx.db.patch(call.opportunityId, {
        meeting_time: meetingTimeMs,
      });

      console.log(`[Meeting Finalization] Updated opportunity ${call.opportunityId} status to Booked`);

      // Schedule follow-up confirmation (placeholder)
      await ctx.scheduler.runAfter(1000, internal.call.sendFollowUp.sendBookingConfirmation, {
        meetingId: meetingId,
      });

    } catch (error) {
      console.error(`[Meeting Finalization] Error creating meeting:`, error);
      await ctx.db.patch(callId, {
        outcome: "booking_failed",
        currentStatus: "booking_failed",
      });
    }

    return null;
  },
});

/**
 * Helper to mark opportunity as rejected when AI detects rejection in transcript
 */
export const markOpportunityRejected = internalMutation({
  args: {
    opportunityId: v.id("client_opportunities"),
    callId: v.id("calls"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { opportunityId, callId, reason }) => {
    console.log(`[Meeting Finalization] Marking opportunity ${opportunityId} as rejected`);
    
    // Update opportunity status
    await ctx.runMutation(internal.leadGen.audit.updateOpportunityStatus, {
      opportunityId,
      status: "Rejected",
    });

    // Update call outcome
    await ctx.db.patch(callId, {
      outcome: "rejected",
      currentStatus: "rejected",
    });

    console.log(`[Meeting Finalization] Opportunity ${opportunityId} marked as rejected${reason ? `: ${reason}` : ""}`);
    return null;
  },
});

export const getMeetingById = internalQuery({
  args: { meetingId: v.id("meetings") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, { meetingId }) => {
    return await ctx.db.get(meetingId);
  },
});
