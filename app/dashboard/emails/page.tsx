"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type EmailListItem = {
  _id: Id<"emails">;
  _creationTime: number;
  opportunityId: Id<"client_opportunities">;
  agencyId?: Id<"agency_profile">;
  from: string;
  to: string;
  subject: string;
  type: "prospect_confirmation" | "agency_summary";
  status: "queued" | "sent" | "failed";
  error?: string;
  sent_at?: number;
  icsUrl: string | null;
  prospectName?: string;
  prospectPhone?: string;
  prospectEmail?: string;
  prospectAddress?: string;
  targetVertical?: string;
  targetGeography?: string;
  leadGenFlowId?: Id<"lead_gen_flow">;
};

export default function EmailsPage() {
  const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);
  const emails = useQuery(
    api.call.emails.listByAgency,
    agencyProfile?.agencyProfileId ? { agencyId: agencyProfile.agencyProfileId } : "skip"
  ) as EmailListItem[] | undefined;

  const [selectedEmailId, setSelectedEmailId] = useState<Id<"emails"> | null>(null);
  const selectedEmail = useQuery(
    api.call.emails.getEmailById,
    selectedEmailId ? { emailId: selectedEmailId } : "skip"
  );

  const [typeFilter, setTypeFilter] = useState<"all" | "prospect_confirmation" | "agency_summary">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "queued" | "sent" | "failed">("all");
  const [queryStr, setQueryStr] = useState("");
  const [copied, setCopied] = useState<"" | "subject" | "html">("");

  const filtered = useMemo(() => {
    if (!emails) return [] as EmailListItem[];
    const q = queryStr.trim().toLowerCase();
    return emails.filter((e) => {
      const typeOk = typeFilter === "all" || e.type === typeFilter;
      const statusOk = statusFilter === "all" || e.status === statusFilter;
      const text = `${e.subject} ${e.to} ${e.from} ${e.prospectName ?? ""} ${e.prospectEmail ?? ""}`.toLowerCase();
      const qOk = q.length === 0 || text.includes(q);
      return typeOk && statusOk && qOk;
    });
  }, [emails, typeFilter, statusFilter, queryStr]);

  const counts = useMemo(() => {
    const base = { total: emails?.length ?? 0, queued: 0, sent: 0, failed: 0 } as const;
    if (!emails) return base;
    return {
      total: emails.length,
      queued: emails.filter((e) => e.status === "queued").length,
      sent: emails.filter((e) => e.status === "sent").length,
      failed: emails.filter((e) => e.status === "failed").length,
    };
  }, [emails]);

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Emails</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Monitor recap and summary emails</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total" value={counts.total} color="slate" />
          <StatCard label="Sent" value={counts.sent} color="green" />
          <StatCard label="Failed" value={counts.failed} color="red" />
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <input
            value={queryStr}
            onChange={(e) => setQueryStr(e.target.value)}
            placeholder="Search subject, to/from, prospect..."
            className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
          >
            <option value="all">All types</option>
            <option value="prospect_confirmation">Prospect confirmation</option>
            <option value="agency_summary">Agency summary</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
          >
            <option value="all">All status</option>
            <option value="queued">Queued</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-semibold">Recent Emails</h2>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-96 overflow-y-auto">
              {filtered && filtered.length > 0 ? (
                filtered.map((e) => (
                  <div
                    key={e._id}
                    className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors ${
                      selectedEmailId === e._id ? "bg-blue-50 dark:bg-blue-900/20" : ""
                    }`}
                    onClick={() => setSelectedEmailId(e._id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <p className="font-medium truncate max-w-[480px]">{e.subject}</p>
                          <TypeBadge type={e.type} />
                          <StatusBadge status={e.status} />
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 flex flex-wrap gap-3">
                          <span>To: {e.to}</span>
                          {e.prospectName && <span>Prospect: {e.prospectName}</span>}
                          <span>{new Date(e.sent_at ?? e._creationTime).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📧</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No emails found</h3>
                  <p className="text-slate-600 dark:text-slate-400">No emails to show yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
            {selectedEmail ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Email Preview</h3>
                  <div className="flex items-center gap-2">
                    <TypeBadge type={selectedEmail.type} />
                    <StatusBadge status={selectedEmail.status} />
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">Subject</p>
                    <p className="text-slate-600 dark:text-slate-400">{selectedEmail.subject}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="text-blue-600 hover:text-blue-700 text-xs underline"
                        onClick={async () => {
                          await navigator.clipboard.writeText(selectedEmail.subject);
                          setCopied("subject");
                          setTimeout(() => setCopied(""), 1200);
                        }}
                      >
                        Copy subject
                      </button>
                      {copied === "subject" && <span className="text-xs text-slate-500">Copied</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="font-medium text-slate-700 dark:text-slate-300">From</p>
                      <p className="text-slate-600 dark:text-slate-400 break-all">{selectedEmail.from}</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-700 dark:text-slate-300">To</p>
                      <p className="text-slate-600 dark:text-slate-400 break-all">{selectedEmail.to}</p>
                    </div>
                  </div>

                  {selectedEmail.icsUrl && (
                    <a
                      href={selectedEmail.icsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Download .ics
                    </a>
                  )}

                  {selectedEmail.error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 text-sm text-red-700 dark:text-red-300">
                      Error: {selectedEmail.error}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {/* Render raw HTML safely */}
                    <div dangerouslySetInnerHTML={{ __html: selectedEmail.html }} />
                  </div>
                  <div className="mt-3">
                    <button
                      className="text-blue-600 hover:text-blue-700 text-xs underline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(selectedEmail.html);
                        setCopied("html");
                        setTimeout(() => setCopied(""), 1200);
                      }}
                    >
                      Copy HTML
                    </button>
                    {copied === "html" && <span className="ml-2 text-xs text-slate-500">Copied</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">👆</span>
                </div>
                <p className="text-slate-500 text-sm">Select an email to preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: "slate" | "green" | "red" }) {
  const colorClasses = {
    slate: "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800",
    green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    red: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
  } as const;
  return (
    <div className={`border rounded-lg p-3 text-center ${colorClasses[color]}`}>
      <p className="text-xs text-slate-600 dark:text-slate-400">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const get = (s: string) => {
    switch (s) {
      case "queued":
        return "bg-slate-100 text-slate-700";
      case "sent":
        return "bg-green-100 text-green-700";
      case "failed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${get(status)}`}>{status}</span>;
}

function TypeBadge({ type }: { type: "prospect_confirmation" | "agency_summary" }) {
  const label = type === "prospect_confirmation" ? "Prospect" : "Agency";
  const color = type === "prospect_confirmation" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${color}`}>{label}</span>;
}


