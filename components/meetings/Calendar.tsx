"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { DateTime } from "luxon";
import { api } from "@/convex/_generated/api";

// Minimal doc shape for display purposes
export type MeetingDoc = {
  _id: string;
  _creationTime: number;
  agencyId: string;
  opportunityId: string;
  callId: string;
  meetingTime: number; // ms
  createdBy?: string;
  source?: string;
};

type AvailabilityRange = {
  day: number; // 1=Mon ... 7=Sun
  startMinutes: number; // minutes from 00:00
  endMinutes: number;
  raw: string;
};

const dayMap: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function parseAvailabilityWindows(windows: Array<string> | undefined): Array<AvailabilityRange> {
  if (!Array.isArray(windows)) return [];
  const ranges: Array<AvailabilityRange> = [];
  for (const win of windows) {
    const match = win.match(/^(\w{3})\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (!match) continue;
    const [, dayAbbr, sh, sm, eh, em] = match;
    const day = dayMap[dayAbbr];
    if (!day) continue;
    const startMinutes = parseInt(sh, 10) * 60 + parseInt(sm, 10);
    const endMinutes = parseInt(eh, 10) * 60 + parseInt(em, 10);
    if (Number.isFinite(startMinutes) && Number.isFinite(endMinutes) && endMinutes > startMinutes) {
      ranges.push({ day, startMinutes, endMinutes, raw: win });
    }
  }
  return ranges;
}

function getWeekStart(dt: DateTime): DateTime {
  const weekday = dt.weekday; // 1..7 (Mon..Sun)
  const diff = weekday - 1; // days since Monday
  return dt.minus({ days: diff }).startOf("day");
}

function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const dt = DateTime.utc().set({ hour: h, minute: m });
  return dt.toFormat("h:mm a");
}

export default function MeetingsCalendar() {
  const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);
  const [weekOffset, setWeekOffset] = useState(0);

  const meetings = useQuery(
    api.call.meetings.listByAgency,
    agencyProfile?.agencyProfileId ? { agencyId: agencyProfile.agencyProfileId } : "skip"
  ) as unknown as Array<MeetingDoc> | undefined;

  const tz = agencyProfile?.timeZone || "America/New_York";
  const availabilityRanges = useMemo(() => parseAvailabilityWindows(agencyProfile?.availability), [agencyProfile]);

  const nowTz = DateTime.now().setZone(tz);
  const baseWeekStart = getWeekStart(nowTz).plus({ weeks: weekOffset });

  // Get all 7 days of the week
  const allWeekDays: Array<DateTime> = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => baseWeekStart.plus({ days: i }));
  }, [baseWeekStart]);

  // Get unique days that have availability
  const daysWithAvailability = useMemo(() => {
    const uniqueDays = new Set(availabilityRanges.map(r => r.day));
    return Array.from(uniqueDays).sort((a, b) => a - b);
  }, [availabilityRanges]);

  // Filter to only show days with availability
  const visibleDays: Array<DateTime> = useMemo(() => {
    if (daysWithAvailability.length === 0) return allWeekDays; // Show all if no availability set
    return allWeekDays.filter(day => daysWithAvailability.includes(day.weekday));
  }, [allWeekDays, daysWithAvailability]);

  const meetingsByDay: Record<number, Array<MeetingDoc>> = useMemo(() => {
    const map: Record<number, Array<MeetingDoc>> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
    if (!meetings) return map;
    const start = baseWeekStart.startOf("day").toMillis();
    const end = baseWeekStart.plus({ days: 7 }).endOf("day").toMillis();
    for (const m of meetings) {
      const dt = DateTime.fromMillis(m.meetingTime, { zone: tz });
      const ms = dt.toMillis();
      if (ms < start || ms > end) continue;
      (map[dt.weekday] = map[dt.weekday] || []).push(m);
    }
    for (const k of Object.keys(map)) map[Number(k)]?.sort((a, b) => a.meetingTime - b.meetingTime);
    return map;
  }, [meetings, baseWeekStart, tz]);

  const availabilityByDay: Record<number, Array<AvailabilityRange>> = useMemo(() => {
    const by: Record<number, Array<AvailabilityRange>> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
    for (const r of availabilityRanges) (by[r.day] = by[r.day] || []).push(r);
    return by;
  }, [availabilityRanges]);

  const totalMeetings = useMemo(() => {
    return visibleDays.reduce((sum, day) => {
      return sum + (meetingsByDay[day.weekday]?.length || 0);
    }, 0);
  }, [visibleDays, meetingsByDay]);

  const isCurrentWeek = weekOffset === 0;

  return (
    <main className="min-h-full p-4 sm:p-6 md:p-8 flex flex-col gap-6">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Hero Section */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                Meetings
              </h1>
              <p className="text-muted-foreground mt-2 text-base sm:text-lg">
                {baseWeekStart.toFormat("MMMM d")} – {baseWeekStart.plus({ days: 6 }).toFormat("MMMM d, yyyy")}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {tz}
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold border border-primary/20">
                  {totalMeetings} {totalMeetings === 1 ? 'meeting' : 'meetings'}
                </span>
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => setWeekOffset((w) => w - 1)}
                className="px-3 sm:px-4 py-2 rounded-lg border border-border/60 bg-surface-raised hover:bg-accent/20 hover:border-border transition-all text-foreground font-medium text-sm"
              >
                ← Prev
              </button>
              <button
                onClick={() => setWeekOffset(0)}
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  isCurrentWeek
                    ? 'bg-primary text-primary-foreground border border-primary/30 shadow-sm'
                    : 'border border-border/60 bg-surface-raised hover:bg-accent/20 hover:border-border text-foreground'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setWeekOffset((w) => w + 1)}
                className="px-3 sm:px-4 py-2 rounded-lg border border-border/60 bg-surface-raised hover:bg-accent/20 hover:border-border transition-all text-foreground font-medium text-sm"
              >
                Next →
              </button>
            </div>
          </div>

          {/* Availability Legend */}
          {Array.isArray(agencyProfile?.availability) && agencyProfile.availability.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border/40">
              <p className="text-sm font-semibold text-foreground mb-3">Your Availability</p>
              <div className="flex flex-wrap gap-2">
                {agencyProfile.availability.map((slot, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/30 text-accent-foreground text-sm font-medium border border-accent-foreground/20"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {slot}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Meetings List */}
        {meetings === undefined ? (
          <div className="card-warm-static p-12 text-center">
            <div className="inline-flex items-center gap-3 text-muted-foreground">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-base font-medium">Loading meetings…</span>
            </div>
          </div>
        ) : visibleDays.length === 0 ? (
          <div className="card-warm-static p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="text-5xl mb-4">📅</div>
              <h3 className="text-xl font-bold text-foreground mb-2">No Availability Set</h3>
              <p className="text-muted-foreground">
                Configure your availability in settings to start scheduling meetings.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleDays.map((day) => {
              const weekday = day.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7;
              const dayMeetings = meetingsByDay[weekday] || [];
              const dayAvailability = availabilityByDay[weekday] || [];
              const isToday = day.hasSame(nowTz, 'day');

              return (
                <div
                  key={day.toISODate()}
                  className={`card-warm-static p-4 sm:p-6 transition-all ${
                    isToday ? 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background' : ''
                  }`}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-border/40">
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                        {day.toFormat("cccc, MMMM d")}
                        {isToday && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold border border-primary/30">
                            Today
                          </span>
                        )}
                      </h3>
                      {dayAvailability.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                          <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {dayAvailability.map((avail, i) => (
                            <span key={i}>
                              {minutesToLabel(avail.startMinutes)} - {minutesToLabel(avail.endMinutes)}
                              {i < dayAvailability.length - 1 && ', '}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                        {dayMeetings.length}
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </span>
                    </div>
                  </div>

                  {/* Meetings */}
                  {dayMeetings.length > 0 ? (
                    <div className="space-y-2">
                      {dayMeetings.map((meeting) => {
                        const dt = DateTime.fromMillis(meeting.meetingTime, { zone: tz });
                        return (
                          <div
                            key={meeting._id}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-surface-overlay/50 border border-border/40 hover:border-primary/40 hover:bg-accent/10 transition-all"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="inline-flex items-center gap-2 text-base font-bold text-foreground">
                                  <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                  </svg>
                                  {dt.toFormat("h:mm a")}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold border border-primary/25">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                                  </svg>
                                  {meeting.source || "meeting"}
                                </span>
                              </div>
                              {meeting.callId && (
                                <p className="text-sm text-muted-foreground mt-2 font-mono">
                                  Call ID: {meeting.callId.slice(-8)}
                                </p>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground sm:text-right">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted/50">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {dt.toFormat("ZZZZ")}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="text-3xl mb-2">✨</div>
                      <p className="text-sm text-muted-foreground">No meetings scheduled</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
