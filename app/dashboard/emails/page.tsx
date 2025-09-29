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
  }, [emails, typeFilter, statusFilter, queryStr]);

  return (
    <main className="min-h-full p-6 md:p-8 flex flex-col gap-6">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        {/* Hero Section */}
        <div className="card-warm-static p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold text-foreground tracking-tight">Email Activity</h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Monitor confirmation and summary emails sent to prospects and your team
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mt-8">
            <div className="stat-card-accent p-5">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Total Emails
              </p>
              <p className="text-3xl font-bold text-foreground mt-1">{counts.total}</p>
              <p className="text-sm text-muted-foreground mt-2">All time</p>
            </div>
            <div className="stat-card-primary p-5">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Queued
              </p>
              <p className="text-3xl font-bold text-foreground mt-1">{counts.queued}</p>
              <p className="text-sm text-muted-foreground mt-2">Pending send</p>
            </div>
            <div className="stat-card-accent p-5">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Sent
              </p>
              <p className="text-3xl font-bold text-foreground mt-1">{counts.sent}</p>
              <p className="text-sm text-muted-foreground mt-2">Successfully delivered</p>
            </div>
            <div className="stat-card-accent p-5">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Failed
              </p>
              <p className="text-3xl font-bold text-foreground mt-1">{counts.failed}</p>
              <p className="text-sm text-muted-foreground mt-2">Need attention</p>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="card-warm-static p-4 md:p-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-foreground mb-2">Search & Filter</h2>
            <div className="flex flex-col md:flex-row gap-3">
              <input
                value={queryStr}
                onChange={(e) => setQueryStr(e.target.value)}
                placeholder="Search subject, recipient, prospect..."
                className="flex-1 px-4 py-2.5 border border-input rounded-lg bg-surface-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                className="px-4 py-2.5 border border-input rounded-lg bg-surface-muted/50 text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              >
                <option value="all">All types</option>
                <option value="prospect_confirmation">Prospect confirmation</option>
                <option value="agency_summary">Agency summary</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="px-4 py-2.5 border border-input rounded-lg bg-surface-muted/50 text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              >
                <option value="all">All status</option>
                <option value="queued">Queued</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Email List */}
          <div className="lg:col-span-2">
            <div className="card-warm-static">
              <div className="p-4 md:p-6 border-b border-border/60">
                <h2 className="text-2xl font-bold text-foreground">Recent Emails</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {filtered.length} {filtered.length === 1 ? "email" : "emails"} found
                </p>
              </div>
              <div className="divide-y divide-border/40 max-h-[600px] overflow-y-auto">
                {filtered && filtered.length > 0 ? (
                  filtered.map((e) => (
                    <button
                      key={e._id}
                      className={`w-full text-left p-4 md:p-5 transition-all ${
                        selectedEmailId === e._id
                          ? "bg-primary/10 border-l-4 border-l-primary"
                          : "hover:bg-surface-overlay/50 border-l-4 border-l-transparent"
                      }`}
                      onClick={() => setSelectedEmailId(e._id)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <p className="font-semibold text-foreground truncate">{e.subject}</p>
                            <TypeBadge type={e.type} />
                            <StatusBadge status={e.status} />
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              <span className="truncate">To: {e.to}</span>
                              {e.prospectName && <span className="truncate">Prospect: {e.prospectName}</span>}
                            </div>
                            <span className="text-xs">
                              {new Date(e.sent_at ?? e._creationTime).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-8 md:p-12 text-center">
                    <div className="w-16 h-16 bg-surface-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">📧</span>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No emails found</h3>
                    <p className="text-muted-foreground">
                      {queryStr || typeFilter !== "all" || statusFilter !== "all"
                        ? "Try adjusting your filters"
                        : "No emails to show yet"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Email Preview */}
          <div className="lg:col-span-1">
            <div className="card-warm-static p-6 sticky top-6">
              {selectedEmail ? (
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-foreground">Email Details</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <TypeBadge type={selectedEmail.type} />
                      <StatusBadge status={selectedEmail.status} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Subject */}
                    <div className="p-4 rounded-lg bg-surface-muted/50 border border-border/40">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Subject
                      </p>
                      <p className="text-sm text-foreground font-medium">{selectedEmail.subject}</p>
                      <button
                        className="mt-3 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                        onClick={async () => {
                          await navigator.clipboard.writeText(selectedEmail.subject);
                          setCopied("subject");
                          setTimeout(() => setCopied(""), 1200);
                        }}
                      >
                        {copied === "subject" ? "✓ Copied" : "Copy subject"}
                      </button>
                    </div>

                    {/* From/To Grid */}
                    <div className="grid grid-cols-1 gap-3">
                      <div className="p-4 rounded-lg bg-surface-muted/50 border border-border/40">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          From
                        </p>
                        <p className="text-sm text-foreground break-all">{selectedEmail.from}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-surface-muted/50 border border-border/40">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          To
                        </p>
                        <p className="text-sm text-foreground break-all">{selectedEmail.to}</p>
                      </div>
                    </div>

                    {/* ICS Download */}
                    {selectedEmail.icsUrl && (
                      <a
                        href={selectedEmail.icsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/40 hover:bg-accent/60 border border-border/40 text-sm font-semibold text-foreground transition-all"
                      >
                        📅 Download Calendar Event
                      </a>
                    )}

                    {/* Error */}
                    {selectedEmail.error && (
                      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                        <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-2">
                          Error
                        </p>
                        <p className="text-sm text-destructive">{selectedEmail.error}</p>
                      </div>
                    )}

                    {/* HTML Content */}
                    <div className="border-t border-border/60 pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Email Preview
                        </p>
                        <button
                          className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                          onClick={async () => {
                            await navigator.clipboard.writeText(selectedEmail.html);
                            setCopied("html");
                            setTimeout(() => setCopied(""), 1200);
                          }}
                        >
                          {copied === "html" ? "✓ Copied" : "Copy HTML"}
                        </button>
                      </div>
                      <div className="p-4 rounded-lg bg-surface-overlay/50 border border-border/40 max-h-96 overflow-y-auto">
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: selectedEmail.html }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-surface-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">👈</span>
                  </div>
                  <p className="text-muted-foreground font-medium">Select an email to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    queued: "bg-accent/60 text-accent-foreground border-accent-foreground/20",
    sent: "bg-success/20 text-success border-success/30",
    failed: "bg-destructive/20 text-destructive border-destructive/30",
  };
  const style = styles[status as keyof typeof styles] || styles.queued;
  
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${style}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function TypeBadge({ type }: { type: "prospect_confirmation" | "agency_summary" }) {
  const label = type === "prospect_confirmation" ? "Prospect" : "Agency";
  const style = type === "prospect_confirmation" 
    ? "bg-primary/20 text-primary border-primary/30"
    : "bg-accent/60 text-accent-foreground border-accent-foreground/20";
  
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${style}`}>
      {label}
    </span>
  );
}


