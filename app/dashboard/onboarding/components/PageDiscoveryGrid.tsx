"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

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
          className: "bg-slate-100 text-slate-700 border-slate-200" 
        };
      case "fetching":
        return { 
          label: "Fetching", 
          className: "bg-blue-100 text-blue-700 border-blue-200" 
        };
      case "scraped":
        return { 
          label: "Scraped", 
          className: "bg-green-100 text-green-700 border-green-200" 
        };
      case "failed":
        return { 
          label: "Failed", 
          className: "bg-red-100 text-red-700 border-red-200" 
        };
    }
  };

  const config = getStatusConfig();
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  );
}

function PageCard({ page }: { page: CrawlPage }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const truncateUrl = (url: string, maxLength: number = 60) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + "...";
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 text-left truncate w-full"
            title={page.url}
          >
            {page.title || truncateUrl(page.url)}
          </button>
        </div>
        <StatusChip status={page.status} />
      </div>
      
      {!isExpanded && page.title && (
        <p className="text-xs text-slate-500 truncate" title={page.url}>
          {truncateUrl(page.url)}
        </p>
      )}
      
      {isExpanded && (
        <div className="space-y-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">URL:</p>
            <p className="text-xs text-slate-500 break-all">{page.url}</p>
          </div>
          {page.httpStatus && (
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">HTTP Status:</p>
              <p className={`text-xs ${page.httpStatus >= 200 && page.httpStatus < 300 ? 'text-green-600' : 'text-red-600'}`}>
                {page.httpStatus}
              </p>
            </div>
          )}
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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Page Discovery
          </h2>
          <div className="h-4 w-16 bg-slate-200 rounded animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3 animate-pulse">
              <div className="h-4 bg-slate-200 rounded mb-2"></div>
              <div className="h-3 bg-slate-100 rounded w-3/4"></div>
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Page Discovery
        </h2>
        <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            {counts.scrapedCount} scraped
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            {counts.fetchingCount} fetching
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-slate-400"></div>
            {counts.queuedCount} queued
          </span>
          {counts.failedCount > 0 && (
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              {counts.failedCount} failed
            </span>
          )}
        </div>
      </div>

      {!hasPages ? (
        <div className="text-center py-8 text-slate-500">
          <div className="w-12 h-12 mx-auto mb-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
          <p>Discovering pages...</p>
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
              <button
                onClick={() => setNumItems(prev => prev + 20)}
                className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors"
              >
                Load More Pages
              </button>
            </div>
          )}

          {isDone && pages.length >= 10 && (
            <p className="text-xs text-slate-500 text-center pt-2">
              Showing all {pages.length} discovered pages
            </p>
          )}
        </>
      )}
    </div>
  );
}
