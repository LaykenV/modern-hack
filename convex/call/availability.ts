import { internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { DateTime } from "luxon";
import type { Doc } from "../_generated/dataModel";

type AvailabilitySlot = {
  iso: string;
  label: string;
};

type AvailabilityResult = {
  slots: AvailabilitySlot[];
  availabilityWindows: string[];
};

/**
 * Parse availability string like "Tue 10:00-12:00" into time slots
 * @param availabilityWindow - String like "Mon 09:00-17:00"
 * @param agencyTimeZone - Agency timezone (e.g., "America/New_York")
 * @param startDate - Date to start generating slots from
 * @param endDate - Date to stop generating slots
 * @returns Array of DateTime objects representing 15-minute slots
 */
function parseAvailabilityWindow(
  availabilityWindow: string,
  agencyTimeZone: string,
  startDate: DateTime,
  endDate: DateTime,
): DateTime[] {
  const slots: DateTime[] = [];
  
  // Parse format like "Tue 10:00-12:00"
  const match = availabilityWindow.match(/^(\w{3})\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
  if (!match) {
    console.warn(`[Availability] Invalid availability window format: ${availabilityWindow}`);
    return slots;
  }

  const [, dayAbbr, startTime, endTime] = match;
  
  // Map day abbreviations to Luxon weekday numbers (1=Monday, 7=Sunday)
  const dayMap: Record<string, number> = {
    'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7
  };
  
  const targetWeekday = dayMap[dayAbbr];
  if (!targetWeekday) {
    console.warn(`[Availability] Unknown day abbreviation: ${dayAbbr}`);
    return slots;
  }

  // Parse start and end times
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  // Generate slots for each occurrence of this weekday in the date range
  let current = startDate.setZone(agencyTimeZone).startOf('day');
  
  while (current <= endDate) {
    // Find the next occurrence of the target weekday
    if (current.weekday === targetWeekday) {
      // Create start and end times for this day
      const dayStart = current.set({ hour: startHour, minute: startMinute, second: 0, millisecond: 0 });
      const dayEnd = current.set({ hour: endHour, minute: endMinute, second: 0, millisecond: 0 });
      
      // Generate 15-minute slots
      let slotStart = dayStart;
      while (slotStart < dayEnd) {
        // Only include future slots (not past slots for today)
        if (slotStart > DateTime.now().setZone(agencyTimeZone)) {
          slots.push(slotStart);
        }
        slotStart = slotStart.plus({ minutes: 15 });
      }
    }
    current = current.plus({ days: 1 });
  }
  
  return slots;
}

/**
 * Check if a slot conflicts with existing meetings
 * @param slot - DateTime slot to check
 * @param existingMeetings - Array of existing meeting times in ms
 * @returns true if there's a conflict (meeting within 15 minutes)
 */
function hasConflict(slot: DateTime, existingMeetings: number[]): boolean {
  const slotMs = slot.toMillis();
  const buffer = 15 * 60 * 1000; // 15 minutes in milliseconds
  
  return existingMeetings.some(meetingMs => {
    const timeDiff = Math.abs(slotMs - meetingMs);
    return timeDiff < buffer;
  });
}

export const getAvailableSlots = internalQuery({
  args: {
    agencyId: v.id("agency_profile"),
  },
  returns: v.object({
    slots: v.array(v.object({
      iso: v.string(),
      label: v.string(),
    })),
    availabilityWindows: v.array(v.string()),
  }),
  handler: async (ctx, { agencyId }): Promise<AvailabilityResult> => {
    // Load agency profile
    const agency: Doc<"agency_profile"> | null = await ctx.db.get(agencyId);
    if (!agency) {
      throw new Error("Agency profile not found");
    }

    const agencyTimeZone = agency.timeZone ?? "America/New_York";
    const availability = agency.availability ?? [];
    
    console.log(`[Availability] Generating slots for agency ${agency.companyName} in ${agencyTimeZone}`);
    console.log(`[Availability] Availability windows:`, availability);

    // Define date range: next 5-7 business days
    const now = DateTime.now().setZone(agencyTimeZone);
    const startDate = now.startOf('day');
    const endDate = startDate.plus({ days: 7 });

    // Generate all potential slots from availability windows
    const allSlots: DateTime[] = [];
    for (const window of availability) {
      const windowSlots = parseAvailabilityWindow(window, agencyTimeZone, startDate, endDate);
      allSlots.push(...windowSlots);
    }

    // Sort slots chronologically
    allSlots.sort((a, b) => a.toMillis() - b.toMillis());

    // Load existing meetings in the next 14 days to check for conflicts
    const futureDate = startDate.plus({ days: 14 });
    const existingMeetings = await ctx.db
      .query("meetings")
      .withIndex("by_agency_and_time", (q) => 
        q.eq("agencyId", agencyId)
         .gte("meetingTime", startDate.toMillis())
         .lte("meetingTime", futureDate.toMillis())
      )
      .collect();

    const existingMeetingTimes = existingMeetings.map(m => m.meetingTime);
    
    console.log(`[Availability] Found ${existingMeetings.length} existing meetings`);
    console.log(`[Availability] Generated ${allSlots.length} potential slots before filtering`);

    // Filter out conflicting slots
    const availableSlots = allSlots.filter(slot => !hasConflict(slot, existingMeetingTimes));

    console.log(`[Availability] ${availableSlots.length} available slots after filtering conflicts`);

    // Convert to result format with human-readable labels
    const slots: AvailabilitySlot[] = availableSlots.map(slot => ({
      iso: slot.toISO() || "",
      label: slot.toLocaleString({
        weekday: 'short',
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      })
    }));

    return {
      slots,
      availabilityWindows: availability,
    };
  },
});

/**
 * Helper function to validate if a given ISO string represents an available slot
 * Used by transcript analysis to validate AI-suggested meeting times
 */
export const validateSlot = internalQuery({
  args: {
    agencyId: v.id("agency_profile"),
    slotIso: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, { agencyId, slotIso }): Promise<boolean> => {
    try {
      const agency = await ctx.db.get(agencyId);
      if (!agency) return false;

      const agencyTimeZone = agency.timeZone ?? "America/New_York";
      const slotDateTime = DateTime.fromISO(slotIso, { zone: agencyTimeZone });
      
      if (!slotDateTime.isValid) {
        console.warn(`[Availability] Invalid ISO string: ${slotIso}`);
        return false;
      }

      // Re-generate current availability to check against
      const { slots }: AvailabilityResult = await ctx.runQuery(
        internal.call.availability.getAvailableSlots,
        { agencyId }
      );
      
      // Check if the slot matches any available slot (within 1 minute tolerance)
      return slots.some((availableSlot: AvailabilitySlot) => {
        const available = DateTime.fromISO(availableSlot.iso);
        const diff = Math.abs(slotDateTime.toMillis() - available.toMillis());
        return diff < 60000; // 1 minute tolerance
      });
    } catch (error) {
      console.error(`[Availability] Error validating slot ${slotIso}:`, error);
      return false;
    }
  },
});
