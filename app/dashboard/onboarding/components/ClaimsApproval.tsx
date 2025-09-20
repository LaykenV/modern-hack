"use client";

import { useState, useEffect } from "react";

export interface Claim {
  id: string;
  text: string;
  source_url: string;
}

interface ClaimsApprovalProps {
  claims: Claim[];
  onApproval: (selectedClaims: Claim[]) => void;
  isVisible: boolean;
}

export function ClaimsApproval({ claims, onApproval, isVisible }: ClaimsApprovalProps) {
  const [selectedClaimIds, setSelectedClaimIds] = useState<Set<string>>(new Set());
  
  // Auto-select all claims by default when they first appear
  useEffect(() => {
    if (claims.length > 0 && selectedClaimIds.size === 0) {
      setSelectedClaimIds(new Set(claims.map(c => c.id)));
    }
  }, [claims, selectedClaimIds.size]);

  const handleClaimToggle = (claimId: string) => {
    setSelectedClaimIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(claimId)) {
        newSet.delete(claimId);
      } else {
        newSet.add(claimId);
      }
      return newSet;
    });
  };

  const handleApprove = () => {
    const selectedClaims = claims.filter(claim => selectedClaimIds.has(claim.id));
    onApproval(selectedClaims);
  };

  const selectedCount = selectedClaimIds.size;
  const hasSelection = selectedCount > 0;

  if (!isVisible) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Review Generated Claims
        </h3>
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {selectedCount} of {claims.length} selected
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Review these claims about your business.</strong> Select the ones you want to use for your sales conversations. 
          Each claim is backed by content from your website.
        </p>
      </div>

      {claims.length === 0 ? (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-slate-500">Generating claims from your website content...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => (
            <div
              key={claim.id}
              className={`border rounded-lg p-4 transition-all duration-200 ${
                selectedClaimIds.has(claim.id)
                  ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id={`claim-${claim.id}`}
                  checked={selectedClaimIds.has(claim.id)}
                  onChange={() => handleClaimToggle(claim.id)}
                  className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <label
                    htmlFor={`claim-${claim.id}`}
                    className="block text-sm text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    {claim.text}
                  </label>
                  <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                    </svg>
                    <span>Source:</span>
                    <a
                      href={claim.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600 dark:hover:text-blue-400 underline truncate max-w-xs"
                      title={claim.source_url}
                    >
                      {claim.source_url.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {claims.length > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedClaimIds(new Set(claims.map(c => c.id)))}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedClaimIds(new Set())}
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Clear All
            </button>
          </div>
          
          <button
            onClick={handleApprove}
            disabled={!hasSelection}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium rounded-md transition-colors duration-200 disabled:cursor-not-allowed"
          >
            Approve {selectedCount} Claim{selectedCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}
