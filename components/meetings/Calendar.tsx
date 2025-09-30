"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { DateTime } from "luxon";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  Globe,
  CalendarX2,
  Settings,
  Info
} from "lucide-react";

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

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="space-y-6">
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="card-warm-static p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-border/40">
              <div className="flex-1">
                <Skeleton className="h-7 w-48 mb-2" />
                <Skeleton className="h-5 w-64" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <TooltipProvider>
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
                  <Clock className="w-4 h-4" />
                  {tz}
                </span>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  <CalendarIcon className="w-3 h-3 mr-1" />
                  {totalMeetings} {totalMeetings === 1 ? 'meeting' : 'meetings'}
                </Badge>
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWeekOffset((w) => w - 1)}
                    aria-label="Previous week"
                  >
                    <ChevronLeft className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Prev</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Previous week</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isCurrentWeek ? "default" : "outline"}
                    size="sm"
                    onClick={() => setWeekOffset(0)}
                    aria-label="Go to current week"
                  >
                    This Week
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Jump to current week</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWeekOffset((w) => w + 1)}
                    aria-label="Next week"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-4 h-4 sm:ml-1" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Next week</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Availability Legend */}
          {Array.isArray(agencyProfile?.availability) && agencyProfile.availability.length > 0 && (
            <>
              <Separator className="my-6" />
              <div>
                <p className="text-sm font-semibold text-foreground mb-3">Your Availability</p>
                <div className="flex flex-wrap gap-2">
                  {agencyProfile.availability.map((slot, i) => (
                    <span key={i} className="time-slot-badge">
                      <CheckCircle2 className="w-3 h-3" />
                      {slot}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Info Alert for Availability */}
        {agencyProfile && (!agencyProfile.availability || agencyProfile.availability.length === 0) && (
          <Alert variant="default" className="border-blue-500/50 bg-blue-500/10">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-900 dark:text-blue-100">Set Your Availability</AlertTitle>
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              Configure your availability in settings to allow prospects to schedule meetings with you automatically.
              <Button variant="link" className="p-0 h-auto ml-1 text-blue-600" asChild>
                <a href="/dashboard/settings">Go to Settings</a>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Meetings List */}
        {meetings === undefined ? (
          <LoadingSkeleton />
        ) : visibleDays.length === 0 ? (
          <div className="card-warm-static p-12 text-center">
            <div className="max-w-md mx-auto">
              <CalendarX2 className="mx-auto h-16 w-16 text-muted-foreground/40 mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">No Availability Set</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Configure your availability in settings to start scheduling meetings automatically.
              </p>
              <Button className="btn-primary" asChild>
                <a href="/dashboard/settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Go to Settings
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleDays.map((day) => {
              const weekday = day.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7;
              const dayMeetings = meetingsByDay[weekday] || [];
              const dayAvailability = availabilityByDay[weekday] || [];
              const isToday = day.hasSame(nowTz, 'day');
              const hasMeetings = dayMeetings.length > 0;

              return (
                <div
                  key={day.toISODate()}
                  className={`card-warm-static p-4 sm:p-6 transition-all ${
                    isToday ? 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background' : ''
                  }`}
                >
                  {/* Day Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-4 border-b border-border/40">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg sm:text-xl font-bold text-foreground">
                          {day.toFormat("cccc, MMMM d")}
                        </h3>
                        {isToday && (
                          <Badge variant="default" className="text-xs">
                            Today
                          </Badge>
                        )}
                      </div>
                      {dayAvailability.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-2 flex flex-wrap items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {dayAvailability.map((avail, i) => (
                            <span key={i}>
                              {minutesToLabel(avail.startMinutes)} - {minutesToLabel(avail.endMinutes)}
                              {i < dayAvailability.length - 1 && ', '}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge 
                          variant="secondary" 
                          className={`self-start sm:self-center ${
                            hasMeetings ? 'bg-primary/15 text-primary border-primary/25' : ''
                          }`}
                        >
                          <CalendarIcon className="w-3 h-3 mr-1" />
                          {dayMeetings.length}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{dayMeetings.length} {dayMeetings.length === 1 ? 'meeting' : 'meetings'} scheduled</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Meetings */}
                  {dayMeetings.length > 0 ? (
                    <div className="space-y-2">
                      {dayMeetings.map((meeting) => {
                        const dt = DateTime.fromMillis(meeting.meetingTime, { zone: tz });
                        const isPast = dt < nowTz;
                        return (
                          <div
                            key={meeting._id}
                            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg border ${
                              isPast 
                                ? 'bg-surface-overlay/30 border-border/20 opacity-75' 
                                : 'bg-surface-overlay/50 border-border/40'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <span className="inline-flex items-center gap-1.5 text-base font-bold text-foreground">
                                  <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                                  {dt.toFormat("h:mm a")}
                                </span>
                                {isPast && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs"
                                    style={{ 
                                      backgroundColor: 'hsl(150 65% 42% / 0.15)',
                                      color: 'hsl(150 65% 32%)',
                                      borderColor: 'hsl(150 65% 42% / 0.3)'
                                    }}
                                  >
                                    Completed
                                  </Badge>
                                )}
                              </div>
                              {meeting.callId && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  Call ID: {meeting.callId.slice(-8)}
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className="self-start sm:self-center flex-shrink-0">
                              <Globe className="w-3 h-3 mr-1" />
                              {dt.toFormat("ZZZZ")}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 px-4">
                      <CalendarX2 className="mx-auto h-10 w-10 text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No meetings scheduled</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Available slots are open for booking</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </main>
    </TooltipProvider>
  );
}
