"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Mail,
  Send,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Calendar,
  Search,
  Filter,
  FileQuestion,
} from "lucide-react";

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
  const isMobile = useIsMobile();
  const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);
  const emails = useQuery(
    api.call.emails.listByAgency,
    agencyProfile?.agencyProfileId ? { agencyId: agencyProfile.agencyProfileId } : "skip"
  ) as EmailListItem[] | undefined;

  const [selectedEmailId, setSelectedEmailId] = useState<Id<"emails"> | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
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
    if (!emails) return { total: 0, queued: 0, sent: 0, failed: 0 };
    return {
      total: emails.length,
      queued: emails.filter((e) => e.status === "queued").length,
      sent: emails.filter((e) => e.status === "sent").length,
      failed: emails.filter((e) => e.status === "failed").length,
    };
  }, [emails]);

  const handleEmailClick = (emailId: Id<"emails">) => {
    setSelectedEmailId(emailId);
    if (isMobile) {
      setSheetOpen(true);
    }
  };

  const handleCopy = async (text: string, type: "subject" | "html") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(""), 1200);
  };

  // Loading state
  if (agencyProfile === undefined || emails === undefined) {
    return <EmailsPageSkeleton />;
  }

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

          {/* Stats Grid - 2 columns on mobile, 4 on desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mt-8">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="stat-card-primary p-5 cursor-help">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Total Emails
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-foreground mt-1">{counts.total}</p>
                  <p className="text-sm text-muted-foreground mt-2">All time</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Total number of emails sent through the system</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="stat-card-accent p-5 cursor-help">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Queued
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-foreground mt-1">{counts.queued}</p>
                  <p className="text-sm text-muted-foreground mt-2">Pending send</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Emails waiting to be sent</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="stat-card-accent p-5 cursor-help">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Sent
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-foreground mt-1">{counts.sent}</p>
                  <p className="text-sm text-muted-foreground mt-2">Successfully delivered</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Emails successfully delivered</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="stat-card-accent p-5 cursor-help">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Failed
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-foreground mt-1">{counts.failed}</p>
                  <p className="text-sm text-muted-foreground mt-2">Need attention</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Emails that failed to send</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Filters Section */}
        <div className="card-warm-static p-4 md:p-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Search & Filter</h2>
            </div>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={queryStr}
                  onChange={(e) => setQueryStr(e.target.value)}
                  placeholder="Search subject, recipient, prospect..."
                  className="pl-10"
                />
              </div>
              
              <Select value={typeFilter} onValueChange={(value: typeof typeFilter) => setTypeFilter(value)}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="prospect_confirmation">Prospect confirmation</SelectItem>
                  <SelectItem value="agency_summary">Agency summary</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(value: typeof statusFilter) => setStatusFilter(value)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
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
                      onClick={() => handleEmailClick(e._id)}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <p className="font-semibold text-foreground truncate flex-1 min-w-0">{e.subject}</p>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <TypeBadge type={e.type} />
                              <StatusBadge status={e.status} />
                            </div>
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
                  <EmptyState
                    icon={<FileQuestion className="h-12 w-12 text-muted-foreground" />}
                    title="No emails found"
                    description={
                      queryStr || typeFilter !== "all" || statusFilter !== "all"
                        ? "Try adjusting your filters to see more results"
                        : "No emails to show yet. Emails will appear here once prospects schedule calls."
                    }
                  />
                )}
              </div>
            </div>
          </div>

          {/* Email Preview - Desktop */}
          {!isMobile && (
            <div className="lg:col-span-1">
              <div className="card-warm-static p-6 sticky top-6">
                {selectedEmail ? (
                  <EmailDetails email={selectedEmail} copied={copied} onCopy={handleCopy} />
                ) : (
                  <EmptyState
                    icon={<span className="text-4xl">👈</span>}
                    title="Select an email"
                    description="Click on an email from the list to view its details"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Email Preview - Mobile Sheet */}
      {isMobile && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Email Details</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              {selectedEmail && <EmailDetails email={selectedEmail} copied={copied} onCopy={handleCopy} />}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </main>
  );
}

// Loading Skeleton Component
function EmailsPageSkeleton() {
  return (
    <main className="min-h-full p-6 md:p-8 flex flex-col gap-6">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        {/* Hero Skeleton */}
        <div className="card-warm-static p-6 md:p-8">
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-6 w-96" />
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mt-8">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>

        {/* Filters Skeleton */}
        <div className="card-warm-static p-4 md:p-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="flex flex-col md:flex-row gap-3">
            <Skeleton className="flex-1 h-10" />
            <Skeleton className="h-10 w-full md:w-[200px]" />
            <Skeleton className="h-10 w-full md:w-[180px]" />
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <div className="lg:col-span-2">
            <div className="card-warm-static">
              <div className="p-4 md:p-6 border-b border-border/60">
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="divide-y divide-border/40">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="p-4 md:p-5">
                    <Skeleton className="h-6 w-3/4 mb-3" />
                    <Skeleton className="h-4 w-1/2 mb-2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-1 hidden lg:block">
            <div className="card-warm-static p-6">
              <Skeleton className="h-6 w-32 mb-6" />
              <Skeleton className="h-4 w-full mb-3" />
              <Skeleton className="h-4 w-full mb-3" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// Empty State Component
function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-12">
      <div className="flex items-center justify-center mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
    </div>
  );
}

// Email Details Component
function EmailDetails({
  email,
  copied,
  onCopy,
}: {
  email: EmailListItem & { html: string };
  copied: "" | "subject" | "html";
  onCopy: (text: string, type: "subject" | "html") => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">Email Details</h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <TypeBadge type={email.type} />
          <StatusBadge status={email.status} />
        </div>
      </div>

      <div className="space-y-4">
        {/* Subject */}
        <div className="p-4 rounded-lg bg-surface-muted/50 border border-border/40">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subject</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopy(email.subject, "subject")}
                  className="h-7"
                >
                  {copied === "subject" ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copy subject to clipboard</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-sm text-foreground font-medium">{email.subject}</p>
        </div>

        {/* From/To */}
        <div className="grid grid-cols-1 gap-3">
          <div className="p-4 rounded-lg bg-surface-muted/50 border border-border/40">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">From</p>
            <p className="text-sm text-foreground break-all">{email.from}</p>
          </div>
          <div className="p-4 rounded-lg bg-surface-muted/50 border border-border/40">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">To</p>
            <p className="text-sm text-foreground break-all">{email.to}</p>
          </div>
        </div>

        {/* ICS Download */}
        {email.icsUrl && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="outline" className="w-full">
                <a href={email.icsUrl} target="_blank" rel="noopener noreferrer">
                  <Calendar className="h-4 w-4 mr-2" />
                  Download Calendar Event
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add this event to your calendar</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Error */}
        {email.error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Error</p>
            </div>
            <p className="text-sm text-destructive">{email.error}</p>
          </div>
        )}

        <Separator className="my-6" />

        {/* HTML Content */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email Preview</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => onCopy(email.html, "html")} className="h-7">
                  {copied === "html" ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy HTML
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copy HTML to clipboard</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="p-4 rounded-lg bg-surface-overlay/50 border border-border/40 max-h-96 overflow-y-auto">
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: email.html }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Badge Components with icons
function StatusBadge({ status }: { status: string }) {
  const configs = {
    queued: {
      icon: <Clock className="h-3 w-3" />,
      label: "Queued",
      className: "bg-accent/60 text-accent-foreground border-accent-foreground/20",
    },
    sent: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Sent",
      className: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30",
    },
    failed: {
      icon: <XCircle className="h-3 w-3" />,
      label: "Failed",
      className: "bg-destructive/20 text-destructive border-destructive/30",
    },
  };

  const config = configs[status as keyof typeof configs] || configs.queued;

  return (
    <Badge variant="outline" className={config.className}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

function TypeBadge({ type }: { type: "prospect_confirmation" | "agency_summary" }) {
  const configs = {
    prospect_confirmation: {
      icon: <Send className="h-3 w-3" />,
      label: "Prospect",
      className: "bg-primary/20 text-primary border-primary/30",
    },
    agency_summary: {
      icon: <Mail className="h-3 w-3" />,
      label: "Agency",
      className: "bg-accent/60 text-accent-foreground border-accent-foreground/20",
    },
  };

  const config = configs[type];

  return (
    <Badge variant="outline" className={config.className}>
      {config.icon}
      {config.label}
    </Badge>
  );
}