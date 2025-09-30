"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2 } from "lucide-react";

interface PageDiscoveryGridProps {
  onboardingFlowId: Id<"onboarding_flow">;
}

interface CrawlPage {
  url: string;
  title?: string;
  status: "queued" | "fetching" | "scraped" | "failed";
  httpStatus?: number;
}

function StatusChip({ status }: { status: CrawlPage["status"] }) {
  const getStatusConfig = () => {
    switch (status) {
      case "queued":
        return { 
          label: "Queued", 
          variant: "outline" as const
        };
      case "fetching":
        return { 
          label: "Fetching", 
          variant: "outline" as const,
          className: "bg-gradient-to-b from-[hsl(var(--primary)/0.24)] to-[hsl(var(--primary)/0.42)] text-[hsl(var(--primary-foreground))] border-[hsl(var(--ring)/0.5)] shadow-[0_0_0_1px_hsl(var(--ring)/0.35)_inset,_var(--shadow-soft)]"
        };
      case "scraped":
        return { 
          label: "Scraped", 
          variant: "default" as const,
          className: "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border-[hsl(var(--success))]/30"
        };
      case "failed":
        return { 
          label: "Failed", 
          variant: "destructive" as const
        };
    }
  };

  const config = getStatusConfig();
  
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}

function PageCard({ page }: { page: CrawlPage }) {
  return (
    <div className="border border-border/60 rounded-lg p-4 bg-surface-raised/50 hover:bg-surface-raised hover:border-border transition-all space-y-3">
      {/* Status Badge - Positioned at top right */}
      <div className="flex items-start justify-end -mt-1 -mr-1 mb-2">
        <StatusChip status={page.status} />
      </div>
      
      {/* Title */}
      <div>
        <h4 className="text-sm font-semibold text-foreground line-clamp-2 min-h-[2.5rem]" title={page.title || page.url}>
          {page.title || "Untitled Page"}
        </h4>
      </div>
      
      {/* URL */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground">URL</p>
        <a 
          href={page.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs text-primary hover:text-primary/80 break-all flex items-start gap-1 group"
          title={page.url}
        >
          <span className="line-clamp-2">{page.url}</span>
          <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-70 group-hover:opacity-100 transition-opacity" />
        </a>
      </div>
      
      {/* HTTP Status */}
      {page.httpStatus && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">HTTP Status</p>
          <Badge variant={page.httpStatus >= 200 && page.httpStatus < 300 ? "outline" : "destructive"} className="text-xs">
            {page.httpStatus}
          </Badge>
        </div>
      )}
    </div>
  );
}

export function PageDiscoveryGrid({ onboardingFlowId }: PageDiscoveryGridProps) {
  const [numItems, setNumItems] = useState(20);
  
  const pagesResult = useQuery(api.onboarding.queries.listCrawlPages, {
    onboardingFlowId,
    paginationOpts: { numItems, cursor: null }
  });

  const flow = useQuery(api.onboarding.queries.getOnboardingFlow, {
    onboardingFlowId
  });

  if (!pagesResult || !flow) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Page Discovery
          </h2>
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="border border-border rounded-lg p-3 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { page: pages, isDone } = pagesResult;
  const { counts } = flow;

  const hasPages = pages.length > 0;
  const canLoadMore = !isDone && hasPages;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          Page Discovery
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant="outline" className="bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30">
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--success))] mr-1.5"></div>
            {counts.scrapedCount} scraped
          </Badge>
          <Badge 
            variant="outline" 
            className="bg-gradient-to-b from-[hsl(var(--primary)/0.24)] to-[hsl(var(--primary)/0.42)] text-[hsl(var(--primary-foreground))] border-[hsl(var(--ring)/0.5)] shadow-[0_0_0_1px_hsl(var(--ring)/0.35)_inset,_var(--shadow-soft)]"
          >
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--primary-foreground))] mr-1.5"></div>
            {counts.fetchingCount} fetching
          </Badge>
          <Badge variant="outline">
            <div className="w-2 h-2 rounded-full bg-muted-foreground mr-1.5"></div>
            {counts.queuedCount} queued
          </Badge>
          {counts.failedCount > 0 && (
            <Badge variant="destructive">
              <div className="w-2 h-2 rounded-full bg-destructive-foreground mr-1.5"></div>
              {counts.failedCount} failed
            </Badge>
          )}
        </div>
      </div>

      {!hasPages ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 mx-auto mb-3 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Discovering pages...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pages.map((page, index) => (
              <PageCard key={`${page.url}-${index}`} page={page} />
            ))}
          </div>

          {canLoadMore && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={() => setNumItems(prev => prev + 20)}
              >
                Load More Pages
              </Button>
            </div>
          )}

          {isDone && pages.length >= 10 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              Showing all {pages.length} discovered pages
            </p>
          )}
        </>
      )}
    </div>
  );
}
