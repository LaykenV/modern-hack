/**
 * Constants for lead generation workflow
 * Defines thresholds, social domains, and signal detection criteria
 */

// Social/aggregator domains that indicate weak web presence
export const SOCIAL_DOMAINS = [
  "facebook.com",
  "instagram.com", 
  "yelp.com",
  "linkedin.com",
  "linktr.ee",
  "tiktok.com",
  "twitter.com",
  "youtube.com",
  "pinterest.com",
  "snapchat.com",
  "whatsapp.com",
  "telegram.org",
];

// Rating and review thresholds for signal detection
export const LOW_RATING_THRESHOLD = 4.0;
export const MIN_REVIEWS_FOR_LOW_RATING = 5;
export const FEW_REVIEWS_THRESHOLD = 5;

// Lead qualification signal types (aligned with form options)
export const LEAD_QUALIFICATION_SIGNALS = {
  LOW_GOOGLE_RATING: "LOW_GOOGLE_RATING",
  FEW_GOOGLE_REVIEWS: "FEW_GOOGLE_REVIEWS", 
  MISSING_WEBSITE: "MISSING_WEBSITE",
  WEAK_WEB_PRESENCE: "WEAK_WEB_PRESENCE",
} as const;

export type LeadQualificationSignal = keyof typeof LEAD_QUALIFICATION_SIGNALS;

// Phase names for lead generation workflow
export const LEAD_GEN_PHASES = [
  "source",
  "filter_rank", 
  "persist_leads",
  "scrape_content",
  "generate_dossier",
  "finalize_rank",
] as const;

export type LeadGenPhaseName = typeof LEAD_GEN_PHASES[number];

export const LEAD_GEN_PHASE_WEIGHTS = {
  source: 0.05,
  filter_rank: 0.05,
  persist_leads: 0.05,
  scrape_content: 0.05,
  generate_dossier: 0.8,
  finalize_rank: 0,
} as const satisfies Record<LeadGenPhaseName, number>;

// Event types for lead generation flow
export const LEAD_GEN_EVENT_TYPES = {
  INITIALIZED: "leadgen.initialized",
  STARTED: "leadgen.started",
  SOURCE_STARTED: "leadgen.source.started",
  SOURCE_COMPLETED: "leadgen.source.completed", 
  SOURCE_ERROR: "leadgen.source.error",
  FILTER_STARTED: "leadgen.filter_rank.started",
  FILTER_COMPLETED: "leadgen.filter_rank.completed",
  FILTER_ERROR: "leadgen.filter_rank.error",
  PERSIST_STARTED: "leadgen.persist_leads.started",
  PERSIST_COMPLETED: "leadgen.persist_leads.completed",
  PERSIST_ERROR: "leadgen.persist_leads.error",
  SCRAPE_STARTED: "leadgen.scrape_content.started",
  SCRAPE_COMPLETED: "leadgen.scrape_content.completed",
  SCRAPE_ERROR: "leadgen.scrape_content.error",
  DOSSIER_STARTED: "leadgen.generate_dossier.started",
  DOSSIER_COMPLETED: "leadgen.generate_dossier.completed",
  DOSSIER_ERROR: "leadgen.generate_dossier.error",
  FINALIZE_STARTED: "leadgen.finalize_rank.started",
  FINALIZE_COMPLETED: "leadgen.finalize_rank.completed",
  FINALIZE_ERROR: "leadgen.finalize_rank.error",
  COMPLETED: "leadgen.completed",
  FAILED: "leadgen.failed",
  CANCELLED: "leadgen.cancelled",
} as const;

// Retry configurations for different operations
export const RETRY_CONFIG = {
  GOOGLE_PLACES: {
    maxAttempts: 3,
    initialBackoffMs: 800,
    base: 2,
  },
  FIRECRAWL: {
    maxAttempts: 4,
    initialBackoffMs: 1500,
    base: 2,
  },
  AI_OPERATIONS: {
    maxAttempts: 3,
    initialBackoffMs: 1000,
    base: 2,
  },
} as const;

// Concurrency limits
export const CONCURRENCY_LIMITS = {
  AUDIT_WORKFLOWS: 4,
  SCRAPING_BATCH_SIZE: 4,
  SCRAPING_DELAY_MS: 200,
} as const;
