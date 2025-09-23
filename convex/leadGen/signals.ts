/**
 * Signal detection utilities for lead qualification
 * Analyzes Google Places data to identify qualification signals
 */

import { 
  SOCIAL_DOMAINS, 
  LOW_RATING_THRESHOLD, 
  MIN_REVIEWS_FOR_LOW_RATING, 
  FEW_REVIEWS_THRESHOLD,
  LEAD_QUALIFICATION_SIGNALS,
  type LeadQualificationSignal 
} from "./constants";

// Type for a place from Google Places API
export type PlaceData = {
  id: string;
  name: string;
  website?: string;
  phone?: string;
  rating?: number;
  reviews?: number;
  address?: string;
};

// Type for a processed lead with signals
export type ProcessedLead = PlaceData & {
  signals: LeadQualificationSignal[];
  qualificationScore: number;
};

/**
 * Detect qualification signals for a single place
 */
export function detectSignals(place: PlaceData): LeadQualificationSignal[] {
  const signals: LeadQualificationSignal[] = [];

  // Signal 1: Missing website
  if (!place.website) {
    signals.push(LEAD_QUALIFICATION_SIGNALS.MISSING_WEBSITE);
  }

  // Signal 2: Weak web presence (website is social/aggregator domain)
  if (place.website && isWeakWebPresence(place.website)) {
    signals.push(LEAD_QUALIFICATION_SIGNALS.WEAK_WEB_PRESENCE);
  }

  // Signal 3: Low Google rating (< 4.0 AND >= 5 reviews)
  if (
    typeof place.rating === "number" && 
    typeof place.reviews === "number" &&
    place.rating < LOW_RATING_THRESHOLD && 
    place.reviews >= MIN_REVIEWS_FOR_LOW_RATING
  ) {
    signals.push(LEAD_QUALIFICATION_SIGNALS.LOW_GOOGLE_RATING);
  }

  // Signal 4: Few Google reviews (< 5 reviews)
  if (
    typeof place.reviews === "number" && 
    place.reviews < FEW_REVIEWS_THRESHOLD
  ) {
    signals.push(LEAD_QUALIFICATION_SIGNALS.FEW_GOOGLE_REVIEWS);
  }

  return signals;
}

/**
 * Check if a website URL indicates weak web presence
 */
function isWeakWebPresence(website: string): boolean {
  try {
    const url = new URL(website.toLowerCase());
    const hostname = url.hostname.replace(/^www\./, "");
    
    return SOCIAL_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    // If URL parsing fails, assume it's not a social domain
    return false;
  }
}

/**
 * Calculate qualification score based on matched signals and agency criteria
 */
export function calculateQualificationScore(
  matchedSignals: LeadQualificationSignal[],
  agencyCriteria: string[]
): number {
  if (agencyCriteria.length === 0) {
    return 0; // No criteria defined = 0 score
  }

  // Count how many of the agency's criteria this lead matches
  const matchedCriteriaCount = matchedSignals.filter(signal => 
    agencyCriteria.includes(signal)
  ).length;

  // Score is the percentage of criteria matched
  return matchedCriteriaCount / agencyCriteria.length;
}

/**
 * Process a place to add signals and qualification score
 */
export function processLead(
  place: PlaceData, 
  agencyCriteria: string[]
): ProcessedLead {
  const signals = detectSignals(place);
  const qualificationScore = calculateQualificationScore(signals, agencyCriteria);

  return {
    ...place,
    signals,
    qualificationScore,
  };
}

/**
 * Extract canonical domain from website URL for deduplication
 */
export function canonicalDomain(url?: string): string | undefined {
  if (!url) return undefined;
  
  try {
    const urlObj = new URL(url.toLowerCase());
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/**
 * Hard filter: drop leads without phone numbers
 */
export function passesHardFilter(place: PlaceData): boolean {
  return Boolean(place.phone && place.phone.trim().length > 0);
}
