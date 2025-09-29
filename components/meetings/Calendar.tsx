"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { DateTime } from "luxon";
import { api } from "@/convex/_generated/api";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();
  const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<"week" | "agenda">(isMobile ? "agenda" : "week");

  const meetings = useQuery(
    api.call.meetings.listByAgency,
    agencyProfile?.agencyProfileId ? { agencyId: agencyProfile.agencyProfileId } : "skip"
  ) as unknown as Array<MeetingDoc> | undefined;

  const tz = agencyProfile?.timeZone || "America/New_York";
  const availabilityRanges = useMemo(() => parseAvailabilityWindows(agencyProfile?.availability), [agencyProfile]);

  const nowTz = DateTime.now().setZone(tz);
  const baseWeekStart = getWeekStart(nowTz).plus({ weeks: weekOffset });
  const weekDays: Array<DateTime> = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => baseWeekStart.plus({ days: i }));
  }, [baseWeekStart]);

  // Compute visible window
  const meetingMinutesThisWeek: Array<number> = useMemo(() => {
    if (!meetings) return [];
    const start = baseWeekStart.startOf("day").toMillis();
    const end = baseWeekStart.plus({ days: 7 }).endOf("day").toMillis();
    return meetings
      .map((m) => DateTime.fromMillis(m.meetingTime, { zone: tz }))
      .filter((dt) => dt.toMillis() >= start && dt.toMillis() <= end)
      .map((dt) => dt.hour * 60 + dt.minute);
  }, [meetings, baseWeekStart, tz]);

  const [minMinutes, maxMinutes] = useMemo(() => {
    const mins: Array<number> = [];
    for (const r of availabilityRanges) mins.push(r.startMinutes, r.endMinutes);
    mins.push(...meetingMinutesThisWeek);
    if (mins.length === 0) return [8 * 60, 18 * 60];
    let min = Math.min(...mins);
    let max = Math.max(...mins);
    min = Math.max(0, min - 60);
    max = Math.min(24 * 60, max + 60);
    min = Math.floor(min / 60) * 60;
    max = Math.ceil(max / 60) * 60;
    if (max <= min) max = min + 60;
    return [min, max];
  }, [availabilityRanges, meetingMinutesThisWeek]);

  const rowPx = 20; // 30-minute row height

  const timeSlots: Array<number> = useMemo(() => {
    const slots: Array<number> = [];
    for (let m = minMinutes; m <= maxMinutes; m += 60) slots.push(m);
    return slots;
  }, [minMinutes, maxMinutes]);

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

  const gridRowCount = Math.max(1, Math.round((maxMinutes - minMinutes) / 30));

  const RangeLabel = (
    <div className="text-slate-600 dark:text-slate-400">
      {baseWeekStart.toFormat("MMM d")} – {baseWeekStart.plus({ days: 6 }).toFormat("MMM d, yyyy")}
    </div>
  );

  const AvailabilityLegend = (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300" /> Availability</span>
      <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-200" /> Meeting</span>
      {Array.isArray(agencyProfile?.availability) && agencyProfile?.availability?.length > 0 && (
        <div className="ml-2 flex flex-wrap gap-2">
          {agencyProfile!.availability!.map((a, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  function WeekView() {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          {RangeLabel}
          {AvailabilityLegend}
        </div>
        <div className="grid" style={{ gridTemplateColumns: "80px repeat(7, 1fr)" }}>
          <div className="border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50" />
          {weekDays.map((d) => (
            <div key={d.toISODate()} className="px-3 py-2 text-sm font-medium border-b border-slate-200 dark:border-slate-800">
              {d.toFormat("ccc d")}
            </div>
          ))}
          <div className="border-r border-slate-200 dark:border-slate-800">
            {timeSlots.map((m) => (
              <div key={m} className="text-xs text-slate-500 flex items-start justify-end pr-2 border-b border-dashed border-slate-200 dark:border-slate-800" style={{ height: `${rowPx * 2}px` }}>
                <span className="translate-y-[-0.5rem]">{minutesToLabel(m)}</span>
              </div>
            ))}
          </div>
          {weekDays.map((d) => {
            const weekday = d.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7;
            const avails = availabilityByDay[weekday] || [];
            const dayMeetings = meetingsByDay[weekday] || [];
            const containerHeightPx = Math.max(1, gridRowCount) * rowPx;
            return (
              <div key={d.toISODate()} className="relative border-l border-slate-100 dark:border-slate-800" style={{ height: `${containerHeightPx}px` }}>
                <div className="grid" style={{ gridTemplateRows: `repeat(${gridRowCount}, ${rowPx}px)`, height: `${containerHeightPx}px` }}>
                  {Array.from({ length: gridRowCount }).map((_, idx) => (
                    <div key={idx} className="border-b border-dashed border-slate-200 dark:border-slate-800" />
                  ))}
                </div>
                {avails.map((r, i) => {
                  const top = ((r.startMinutes - minMinutes) / (maxMinutes - minMinutes)) * containerHeightPx;
                  const height = ((r.endMinutes - r.startMinutes) / (maxMinutes - minMinutes)) * containerHeightPx;
                  return (
                    <div key={i} className="absolute left-0 right-0 bg-green-100/60 dark:bg-green-900/30" style={{ top: `${top}px`, height: `${height}px` }} aria-hidden />
                  );
                })}
                {dayMeetings.map((m) => {
                  const dt = DateTime.fromMillis(m.meetingTime, { zone: tz });
                  const minutes = dt.hour * 60 + dt.minute;
                  const topPx = ((minutes - minMinutes) / (maxMinutes - minMinutes)) * containerHeightPx;
                  const defaultDuration = 30; // minutes
                  const heightPx = Math.max(12, (defaultDuration / (maxMinutes - minMinutes)) * containerHeightPx);
                  return (
                    <div key={m._id} className="absolute left-1 right-1 rounded-md bg-purple-200 dark:bg-purple-700 text-purple-900 dark:text-white text-xs p-2 shadow" style={{ top: `${topPx}px`, height: `${heightPx}px` }} title={dt.toFormat("fff")}>
                      <div className="font-semibold">{dt.toFormat("h:mm a")}</div>
                      <div className="opacity-80">{m.source || "meeting"}{m.callId ? ` • Call #${m.callId.slice(-6)}` : ""}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function AgendaView() {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          {RangeLabel}
          {AvailabilityLegend}
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {weekDays.map((d) => {
            const weekday = d.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7;
            const dayMeetings = meetingsByDay[weekday] || [];
            return (
              <div key={d.toISODate()} className="p-4">
                <div className="text-sm font-semibold mb-2">{d.toFormat("cccc, LLL d")}</div>
                {dayMeetings.length > 0 ? (
                  <div className="space-y-2">
                    {dayMeetings.map((m) => {
                      const dt = DateTime.fromMillis(m.meetingTime, { zone: tz });
                      return (
                        <div key={m._id} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-md">
                          <div>
                            <div className="font-medium">{dt.toFormat("h:mm a")}</div>
                            <div className="text-xs text-slate-500">{m.source || "meeting"}{m.callId ? ` • Call #${m.callId.slice(-6)}` : ""}</div>
                          </div>
                          <div className="text-xs text-slate-500">{dt.toFormat("ZZZZ")}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">No meetings</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Meetings</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Timezone: {tz}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setWeekOffset((w) => w - 1)}>← Prev</button>
          <button className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setWeekOffset(0)}>Today</button>
          <button className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setWeekOffset((w) => w + 1)}>Next →</button>
          <div className="ml-4 inline-flex items-center bg-slate-100 dark:bg-slate-800 rounded-md p-1">
            <button className={`px-3 py-1.5 rounded ${view === "week" ? "bg-white dark:bg-slate-900 shadow" : ""}`} onClick={() => setView("week")}>Week</button>
            <button className={`px-3 py-1.5 rounded ${view === "agenda" ? "bg-white dark:bg-slate-900 shadow" : ""}`} onClick={() => setView("agenda")}>Agenda</button>
          </div>
        </div>
      </div>

      {meetings === undefined ? (
        <div className="p-8 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
          <div className="animate-pulse text-slate-500">Loading meetings…</div>
        </div>
      ) : view === "week" ? (
        <WeekView />
      ) : (
        <AgendaView />)
      }
    </div>
  );
}
