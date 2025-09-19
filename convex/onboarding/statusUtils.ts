/**
 * Status management utilities for onboarding flow
 * Handles phase status updates, error recording, and flow completion
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { PHASE_WEIGHTS, type PhaseName } from "./constants";

/**
 * Calculate standardized progress for a specific phase (unweighted 0-1)
 */
export function calculatePhaseProgress(
  phaseName: PhaseName,
  current: number,
  total: number,
  subPhaseProgress = 0
): number {
  if (total === 0) return 0;
  
  const completionRatio = Math.min(current / total, 1);
  
  // Add sub-phase progress for more granular updates
  const adjustedRatio = completionRatio + (subPhaseProgress * (1 - completionRatio));
  
  return Math.min(adjustedRatio, 1);
}

/**
 * Calculate overall workflow progress from all phases
 */
export function calculateOverallProgress(phases: Array<{
  name: PhaseName;
  status: "pending" | "running" | "complete" | "error";
  progress: number;
}>): number {
  let totalProgress = 0;
  
  for (const phase of phases) {
    const phaseWeight = PHASE_WEIGHTS[phase.name as PhaseName];
    
    if (phase.status === "complete") {
      totalProgress += phaseWeight;
    } else if (phase.status === "running") {
      totalProgress += phaseWeight * phase.progress;
    }
    // pending and error phases contribute 0
  }
  
  return Math.min(totalProgress, 1);
}


// Simplified error recording using the unified status update
export const recordFlowError = internalMutation({
  args: { 
    onboardingFlowId: v.id("onboarding_flow"), 
    phase: v.union(
      v.literal("crawl"),
      v.literal("filter"), 
      v.literal("scrape"),
      v.literal("summary"),
      v.literal("claims"),
      v.literal("verify")
    ), 
    error: v.string() 
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { onboardingFlowId, phase, error } = args;
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) return null;
    
    // Update phase to error status inline
    const phases = [...flow.phases];
    const phaseIndex = phases.findIndex(p => p.name === phase);
    if (phaseIndex !== -1) {
      const now = Date.now();
      const phaseObj = phases[phaseIndex];
      phaseObj.status = "error";
      phaseObj.errorMessage = error.slice(0, 500);
      phaseObj.completedAt = now;
      if (phaseObj.startedAt && phaseObj.completedAt) {
        phaseObj.duration = phaseObj.completedAt - phaseObj.startedAt;
      }
      
      await ctx.db.patch(onboardingFlowId, {
        status: "error",
        phases,
        lastEvent: {
          type: `${phase}.error`,
          message: `Error in ${phase} phase: ${error.slice(0, 200)}`,
          timestamp: now,
        },
      });
    }
    
    return null;
  },
});

/**
 * Enhanced phase status update with standardized progress calculation
 */
export const updatePhaseStatusWithProgress = internalMutation({
  args: {
    onboardingFlowId: v.id("onboarding_flow"),
    phaseName: v.union(
      v.literal("crawl"),
      v.literal("filter"),
      v.literal("scrape"),
      v.literal("summary"),
      v.literal("claims"),
      v.literal("verify")
    ),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("complete"),
      v.literal("error")
    )),
    current: v.optional(v.number()),
    total: v.optional(v.number()),
    subPhaseProgress: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    eventMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { onboardingFlowId, phaseName, status, current, total, subPhaseProgress, errorMessage, eventMessage } = args;
    
    // Calculate unweighted progress if current/total provided
    let progress: number | undefined;
    if (typeof current === "number" && typeof total === "number") {
      progress = calculatePhaseProgress(phaseName as PhaseName, current, total, subPhaseProgress);
    }
    
    // Update phase status inline with calculated progress
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) return null;
    
    const phases = [...flow.phases];
    const phaseIndex = phases.findIndex(p => p.name === phaseName);
    if (phaseIndex === -1) return null;
    
    const now = Date.now();
    const phase = phases[phaseIndex];
    
    // Update phase status
    if (status) {
      phase.status = status as "pending" | "running" | "complete" | "error";
      if (status === "running" && !phase.startedAt) {
        phase.startedAt = now;
      }
      if (status === "complete" || status === "error") {
        phase.completedAt = now;
        // Calculate duration if we have both start and end times
        if (phase.startedAt && phase.completedAt) {
          phase.duration = phase.completedAt - phase.startedAt;
        }
      }
    }
    
    // Update progress
    if (typeof progress === "number") {
      phase.progress = Math.min(1, Math.max(0, progress));
    }
    
    // Update error message
    if (errorMessage !== undefined) {
      phase.errorMessage = errorMessage;
    }
    
    // Update last event if provided
    const updates: Record<string, unknown> = { phases };
    if (eventMessage) {
      updates.lastEvent = {
        type: `${phaseName}.${status || "update"}`,
        message: eventMessage,
        timestamp: now,
      };
    }
    
    await ctx.db.patch(onboardingFlowId, updates);
    return null;
  },
});

export const completeFlow = internalMutation({
  args: { onboardingFlowId: v.id("onboarding_flow") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { onboardingFlowId } = args;
    const flow = await ctx.db.get(onboardingFlowId);
    if (!flow) return null;
    
    // Set all phases to complete with 100% progress
    const phases = flow.phases.map(phase => ({
      ...phase,
      status: "complete" as const,
      progress: 1,
      completedAt: phase.completedAt || Date.now(),
      // Calculate duration for any phases that don't have it yet
      duration: phase.duration || (phase.startedAt ? Date.now() - phase.startedAt : undefined),
    }));
    
    await ctx.db.patch(onboardingFlowId, { 
      status: "completed",
      phases,
      lastEvent: {
        type: "onboarding.completed",
        message: "Onboarding completed successfully",
        timestamp: Date.now(),
      },
    });
    return null;
  },
});
