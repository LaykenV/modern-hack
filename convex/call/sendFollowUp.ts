"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal, components } from "../_generated/api";
import { DateTime } from "luxon";
import { createEvent } from "ics";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { Resend } from "@convex-dev/resend";

export const resend: Resend = new Resend(components.resend, {
  apiKey: process.env.RESEND_API_KEY,
  testMode: false,
});

/**
 * Generate ICS calendar file for meeting
 */
function generateICSFile(
  meetingTime: number,
  agencyTimeZone: string,
  agency: Doc<"agency_profile">,
  opportunity: Doc<"client_opportunities">,
  call: Doc<"calls">,
  agencyEmail: string,
): string | null {
  try {
    const meetingDateTime = DateTime.fromMillis(meetingTime, { zone: agencyTimeZone });
    
    // Convert to array format required by ICS: [year, month, day, hour, minute]
    const start: [number, number, number, number, number] = [
      meetingDateTime.year,
      meetingDateTime.month,
      meetingDateTime.day,
      meetingDateTime.hour,
      meetingDateTime.minute,
    ];

    const description = `
Call Summary: ${call.summary || "No summary available"}

Prospect Details:
- Company: ${opportunity.name}
- Phone: ${call.dialedNumber || opportunity.phone || "Not available"}
- Email: ${opportunity.email || "Not available"}

Meeting arranged through Atlas Outbound AI call.
Call Duration: ${call.billingSeconds ? `${Math.round(call.billingSeconds / 60)} minutes` : "Unknown"}
    `.trim();

    const organizerEmail = agencyEmail || "notifications@scheduler.atlasoutbound.app";

    const event = {
      start,
      duration: { minutes: 15 }, // Fixed 15-minute duration as per requirement
      title: `Discovery Call - ${opportunity.name}`,
      description,
      location: "Phone Call",
      organizer: { 
        name: agency.companyName,
        email: organizerEmail,
      },
      attendees: [
        { 
          name: agency.companyName,
          email: organizerEmail,
        }
      ],
      status: "CONFIRMED",
      categories: ["Business Meeting", "Discovery Call"],
      alarms: [
        {
          action: "display",
          trigger: { minutes: 15, before: true },
          description: "Meeting reminder - Discovery call starting in 15 minutes"
        }
      ]
    };

    // Use synchronous call without callback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = createEvent(event as any);
    
    if (result && typeof result === 'object' && result !== null) {
      const resultObj = result as { error?: Error | null; value?: string };
      if (resultObj.error) {
        console.error(`[Follow-up] ICS generation error:`, resultObj.error);
        return null;
      }
      return resultObj.value || null;
    }

    return null;
  } catch (error) {
    console.error(`[Follow-up] ICS generation failed:`, error);
    return null;
  }
}

/**
 * Send prospect confirmation email with meeting details
 */
async function sendProspectEmail(
  ctx: ActionCtx,
  opportunity: Doc<"client_opportunities">,
  agency: Doc<"agency_profile">,
  call: Doc<"calls">,
  meetingTime: number,
  agencyTimeZone: string
): Promise<void> {
  if (!opportunity.email) {
    console.error(`[Follow-up] No prospect email available for opportunity ${opportunity._id}`);
    return;
  }

  const formattedTime = DateTime.fromMillis(meetingTime, { zone: agencyTimeZone })
    .toLocaleString({
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });

  // Create queued email record
  const emailId = await ctx.runMutation(internal.call.emailMutations.createQueuedEmail, {
    opportunityId: opportunity._id,
    agencyId: agency._id,
    from: "Atlas Outbound <notifications@scheduler.atlasoutbound.app>",
    to: opportunity.email,
    subject: `Meeting Confirmation - ${agency.companyName}`,
    html: `
      <p>Hello ${opportunity.name},</p>
      <p>Thank you for booking your meeting with ${agency.companyName}.</p>
      <p>Visit our website <a href="${agency.sourceUrl}">here</a>.</p>
      <p>The meeting will be held on ${formattedTime}.</p>
      <p>We will give you a call back at ${call.dialedNumber || opportunity.phone}.</p>
      <p>Thank you for your time, and we look forward to speaking with you!</p>
    `,
    type: "prospect_confirmation",
  });

  try {
    // Send email using Resend component
    await resend.sendEmail(ctx, {
      from: "Atlas Outbound <notifications@scheduler.atlasoutbound.app>",
      to: opportunity.email,
      subject: `Meeting Confirmation - ${agency.companyName}`,
      html: `
        <p>Hello ${opportunity.name},</p>
        <p>Thank you for booking your meeting with ${agency.companyName}.</p>
        <p>Visit our website <a href="${agency.sourceUrl}">here</a>.</p>
        <p>The meeting will be held on ${formattedTime}.</p>
        <p>We will give you a call back at ${call.dialedNumber || opportunity.phone}.</p>
        <p>Thank you for your time, and we look forward to speaking with you!</p>
      `,
    });

    // Mark as sent
    await ctx.runMutation(internal.call.emailMutations.markEmailSent, { emailId });
    console.log(`[Follow-up] Prospect confirmation email sent to ${opportunity.email}`);
    
  } catch (error) {
    // Mark as failed
    const errorMessage = error instanceof Error ? error.message : String(error);
    await ctx.runMutation(internal.call.emailMutations.markEmailFailed, { 
      emailId, 
      error: errorMessage 
    });
    console.error(`[Follow-up] Failed to send prospect email:`, error);
  }
}

/**
 * Send agency summary email with ICS attachment
 */
async function sendAgencyEmail(
  ctx: ActionCtx,
  opportunity: Doc<"client_opportunities">,
  agency: Doc<"agency_profile">,
  call: Doc<"calls">,
  meetingTime: number,
  agencyTimeZone: string,
  agencyEmail: string
): Promise<void> {
  const formattedTime = DateTime.fromMillis(meetingTime, { zone: agencyTimeZone })
    .toLocaleString({
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });

  // Generate ICS file
  const icsContent = generateICSFile(
    meetingTime,
    agencyTimeZone,
    agency,
    opportunity,
    call,
    agencyEmail,
  );
  let storageRef: Id<"_storage"> | undefined;
  
  if (icsContent) {
    try {
      // Store ICS file in Convex storage
      const blob = new Blob([icsContent], { type: "text/calendar" });
      storageRef = await ctx.storage.store(blob);
      console.log(`[Follow-up] ICS file stored with ref: ${storageRef}`);
    } catch (error) {
      console.error(`[Follow-up] Failed to store ICS file:`, error);
    }
  }

  const emailHTML = `
    <h2>New Meeting Booked - ${opportunity.name}</h2>
    
    <h3>Meeting Details</h3>
    <ul>
      <li><strong>Time:</strong> ${formattedTime}</li>
      <li><strong>Duration:</strong> 15 minutes</li>
      <li><strong>Contact:</strong> ${call.dialedNumber || opportunity.phone}</li>
      <li><strong>Email:</strong> ${opportunity.email || "Not available"}</li>
    </ul>

    <h3>Prospect Information</h3>
    <ul>
      <li><strong>Company:</strong> ${opportunity.name}</li>
      <li><strong>Location:</strong> ${opportunity.address || "Not available"}</li>
      <li><strong>Phone:</strong> ${opportunity.phone || "Not available"}</li>
      <li><strong>Rating:</strong> ${opportunity.rating ? `${opportunity.rating}/5` : "Not available"}</li>
      <li><strong>Reviews:</strong> ${opportunity.reviews_count || "Not available"}</li>
    </ul>

    <h3>Call Summary</h3>
    <p>${call.summary || "No summary available"}</p>

    <h3>Call Details</h3>
    <ul>
      <li><strong>Duration:</strong> ${call.billingSeconds ? `${Math.round(call.billingSeconds / 60)} minutes` : "Unknown"}</li>
      <li><strong>Outcome:</strong> ${call.outcome || "Meeting Booked"}</li>
      <li><strong>Initiated by:</strong> ${call.startedByEmail || "System"}</li>
    </ul>

    ${icsContent ? '<p><strong>Calendar invite is attached as an ICS file.</strong></p>' : '<p><em>Note: Calendar invite could not be generated.</em></p>'}

    <p>This meeting was automatically booked through Atlas Outbound AI calling system.</p>
  `;

  // Create queued email record
  const emailId = await ctx.runMutation(internal.call.emailMutations.createQueuedEmail, {
    opportunityId: opportunity._id,
    agencyId: agency._id,
    from: "Atlas Outbound <notifications@scheduler.atlasoutbound.app>",
    to: agencyEmail,
    bcc: agencyEmail, // BCC the agency's Google OAuth email as required
    subject: `New Meeting Booked - ${opportunity.name}`,
    html: emailHTML,
    type: "agency_summary",
    storageRef,
  });

  try {
    const emailData: {
      from: string;
      to: string;
      bcc: string;
      subject: string;
      html: string;
      attachments?: Array<{
        filename: string;
        content: string;
        contentType: string;
        encoding: string;
      }>;
    } = {
      from: "Atlas Outbound <notifications@scheduler.atlasoutbound.app>",
      to: agencyEmail,
      bcc: agencyEmail,
      subject: `New Meeting Booked - ${opportunity.name}`,
      html: emailHTML,
    };

    // Attach ICS file if available
    if (icsContent) {
      emailData.attachments = [{
        filename: `meeting-${opportunity.name.replace(/[^a-zA-Z0-9]/g, '-')}.ics`,
        content: Buffer.from(icsContent).toString('base64'),
        contentType: "text/calendar",
        encoding: "base64",
      }];
    }

    // Send email using Resend component
    await resend.sendEmail(ctx, emailData);

    // Mark as sent
    await ctx.runMutation(internal.call.emailMutations.markEmailSent, { emailId });
    console.log(`[Follow-up] Agency summary email sent to ${agencyEmail}`);
    
  } catch (error) {
    // Mark as failed
    const errorMessage = error instanceof Error ? error.message : String(error);
    await ctx.runMutation(internal.call.emailMutations.markEmailFailed, { 
      emailId, 
      error: errorMessage 
    });
    console.error(`[Follow-up] Failed to send agency email:`, error);
  }
}

/**
 * Main booking confirmation handler with dual email flow
 */
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

      const agencyTimeZone = agency.timeZone ?? "America/New_York";
      
      // Extract agency email from Google OAuth (from startedByEmail or fallback)
      const agencyEmail = call.startedByEmail || "notifications@scheduler.atlasoutbound.app";

      // Log structured confirmation details
      console.log(`[Follow-up] Meeting Booking Confirmed:`, {
        meetingId: meeting._id,
        agency: agency.companyName,
        prospect: opportunity.name,
        prospectPhone: opportunity.phone,
        prospectEmail: opportunity.email,
        agencyEmail: agencyEmail,
        meetingTime: DateTime.fromMillis(meeting.meetingTime, { zone: agencyTimeZone }).toISO(),
        timeZone: agencyTimeZone,
        agencyUrl: agency.sourceUrl,
        source: meeting.source,
        callDuration: call.billingSeconds ? `${call.billingSeconds}s` : "unknown"
      });

      // Send both emails in parallel for efficiency
      const emailPromises = [];

      // 1. Send prospect confirmation email
      emailPromises.push(
        sendProspectEmail(ctx, opportunity, agency, call, meeting.meetingTime, agencyTimeZone)
      );

      // 2. Send agency summary email with ICS attachment
      emailPromises.push(
        sendAgencyEmail(ctx, opportunity, agency, call, meeting.meetingTime, agencyTimeZone, agencyEmail)
      );

      // Wait for both emails to complete
      await Promise.all(emailPromises);

      console.log(`[Follow-up] Booking confirmation flow completed for meeting ${meetingId}`);

    } catch (error) {
      console.error(`[Follow-up] Error processing booking confirmation:`, error);
    }

    return null;
  },
});

/**
 * Rejection follow-up handler
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
        callDuration: call.billingSeconds ? `${call.billingSeconds}s` : "unknown",
        initiatedBy: call.startedByEmail || "system"
      });

      // TODO: Future implementation:
      // 1. Log rejection reason for analysis in emails table
      // 2. Update lead scoring/qualification
      // 3. Schedule future follow-up workflows
      // 4. Send internal notification to agency
      // 5. Potentially send follow-up email to prospect for future consideration

      console.log(`[Follow-up] Rejection analysis logged. Future workflows not yet implemented.`);

    } catch (error) {
      console.error(`[Follow-up] Error processing rejection follow-up:`, error);
    }

    return null;
  },
});