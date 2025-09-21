export const FlowStatus = {
  idle: "idle",
  running: "running",
  error: "error",
  completed: "completed",
} as const;

// Simplified phase status constants
export const PhaseStatus = {
  pending: "pending",
  running: "running",
  complete: "complete",
  error: "error",
} as const;

// Phase names
export const PhaseNames = {
  crawl: "crawl",
  filter: "filter",
  scrape: "scrape",
  summary: "summary",
  coreOffer: "coreOffer",
  claims: "claims",
  verify: "verify",
} as const;

// Helper to create initial phases array
export const createInitialPhases = () => [
  { name: PhaseNames.crawl, status: PhaseStatus.pending, progress: 0 },
  { name: PhaseNames.filter, status: PhaseStatus.pending, progress: 0 },
  { name: PhaseNames.scrape, status: PhaseStatus.pending, progress: 0 },
  { name: PhaseNames.summary, status: PhaseStatus.pending, progress: 0 },
  { name: PhaseNames.coreOffer, status: PhaseStatus.pending, progress: 0 },
  { name: PhaseNames.claims, status: PhaseStatus.pending, progress: 0 },
  { name: PhaseNames.verify, status: PhaseStatus.pending, progress: 0 },
];

export const PageStatus = {
  queued: "queued",
  fetching: "fetching",
  scraped: "scraped",
  failed: "failed",
} as const;

// Phase weight constants for standardized progress calculation
export const PHASE_WEIGHTS = {
  crawl: 0.30,     // Heaviest phase - discovery + bulk fetch
  filter: 0.10,    // Quick AI filtering
  scrape: 0.25,    // High-fidelity scraping
  summary: 0.15,   // AI summary generation
  coreOffer: 0.10, // Core offer generation
  claims: 0.05,    // Claims generation
  verify: 0.05,    // Claims verification
} as const;

export type PhaseName = keyof typeof PHASE_WEIGHTS;

// Simplified event types for unified event model
export const EventTypes = {
  OnboardingStarted: "onboarding.started",
  OnboardingCompleted: "onboarding.completed",
  // Phase-specific events are now generated dynamically as `${phaseName}.${status}`
  // Removed unused granular event types that are no longer tracked separately
} as const;


