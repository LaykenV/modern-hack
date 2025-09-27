"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal, components } from "../_generated/api";
import { DateTime } from "luxon";
import type { Doc } from "../_generated/dataModel";
import { Resend } from "@convex-dev/resend";

export const resend: Resend = new Resend(components.resend, {
  apiKey: process.env.RESEND_API_KEY,
  testMode: false,
});

export const sendBookingConfirmation = internalAction({
  args: {
    meetingId: v.id("meetings"),
  },
  returns: v.null(),
  handler: async (ctx, { meetingId }) => {
    console.log(`[Follow-up] Processing booking confirmation for meeting ${meetingId}`);

    try {
      // Load meeting and related data
      const meeting: Doc<"meetings"> | null = await ctx.runQuery(
        internal.call.meetings.getMeetingById,
        { meetingId }
      );
      if (!meeting) {
        console.error(`[Follow-up] Meeting ${meetingId} not found`);
        return null;
      }

      const opportunity = await ctx.runQuery(
        internal.leadGen.queries.getOpportunityById,
        { opportunityId: meeting.opportunityId }
      );
      const agency = await ctx.runQuery(
        internal.leadGen.queries.getAgencyProfileInternal,
        { agencyId: meeting.agencyId }
      );
      const call = await ctx.runQuery(
        internal.call.calls.getCallByIdInternal,
        { callId: meeting.callId }
      );

      if (!opportunity || !agency || !call) {
        console.error(`[Follow-up] Missing related data for meeting ${meetingId}`);
        return null;
      }

      // Format meeting time for human-readable display
      const agencyTimeZone = agency.timeZone ?? "America/New_York";
      const meetingDateTime = DateTime.fromMillis(meeting.meetingTime, { zone: agencyTimeZone });
      const formattedTime = meetingDateTime.toLocaleString({
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      });
      const prospectEmail = opportunity.email;

      // Log structured confirmation details
      console.log(`[Follow-up] Meeting Booking Confirmed:`, {
        meetingId: meeting._id,
        agency: agency.companyName,
        prospect: opportunity.name,
        prospectPhone: opportunity.phone,
        prospectEmail: prospectEmail,
        triggeredByEmail: call.startedByEmail ?? "system",
        meetingTime: formattedTime,
        timeZone: agencyTimeZone,
        source: meeting.source,
        callDuration: call.billingSeconds ? `${call.billingSeconds}s` : "unknown"
      });

      if (!prospectEmail) {
        console.error(`[Follow-up] Prospect email not found for meeting ${meetingId}`);
        return null;
      }

      await resend.sendEmail(ctx, {
        from: "Atlas Outbound <notifications@scheduler.atlasoutbound.app>",
        to: prospectEmail,
        subject: "Meeting Booking Confirmation",
        html: `
        <p>Hello ${opportunity.name},</p>
        <p>Thank you for booking your meeting with ${agency.companyName}.</p>
        <p>The meeting will be held on ${formattedTime} in ${agencyTimeZone}.</p>
        <p>The meeting details are as follows:</p>
        <ul>
          <li>Meeting Time: ${formattedTime}</li>
          <li>Meeting Location: ${agency.companyName}</li>
        </ul>
        <p>Thank you for your time.</p>
        `,
      });

      // TODO: Future implementation will include:
      // 1. Send email confirmation to prospect (via Resend)
      // 2. Generate and attach ICS calendar file
      // 3. Send notification to agency
      // 4. Create calendar event in agency's calendar system
      // 5. Set up reminder notifications

      console.log(`[Follow-up] TODO: Implement email confirmation and calendar integration`);
      console.log(`[Follow-up] Meeting details logged for future integration`);

    } catch (error) {
      console.error(`[Follow-up] Error processing booking confirmation:`, error);
    }

    return null;
  },
});

/**
 * Placeholder for future rejection follow-up
 */
export const sendRejectionFollowUp = internalAction({
  args: {
    callId: v.id("calls"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { callId, reason }) => {
    console.log(`[Follow-up] Processing rejection follow-up for call ${callId}`);

    try {
      const call = await ctx.runQuery(
        internal.call.calls.getCallByIdInternal,
        { callId }
      );
      if (!call) {
        console.error(`[Follow-up] Call ${callId} not found`);
        return null;
      }

      const opportunity = await ctx.runQuery(
        internal.leadGen.queries.getOpportunityById,
        { opportunityId: call.opportunityId }
      );
      const agency = await ctx.runQuery(
        internal.leadGen.queries.getAgencyProfileInternal,
        { agencyId: call.agencyId }
      );

      if (!opportunity || !agency) {
        console.error(`[Follow-up] Missing related data for call ${callId}`);
        return null;
      }

      console.log(`[Follow-up] Rejection Follow-up:`, {
        callId: call._id,
        agency: agency.companyName,
        prospect: opportunity.name,
        reason: reason ?? "Not specified",
        callDuration: call.billingSeconds ? `${call.billingSeconds}s` : "unknown"
      });

      // TODO: Future implementation:
      // 1. Log rejection reason for analysis
      // 2. Update lead scoring/qualification
      // 3. Potentially schedule future follow-up
      // 4. Send internal notification to agency

      console.log(`[Follow-up] TODO: Implement rejection analysis and follow-up workflow`);

    } catch (error) {
      console.error(`[Follow-up] Error processing rejection follow-up:`, error);
    }

    return null;
  },
});
