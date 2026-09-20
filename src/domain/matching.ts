// Agent-to-agent negotiation: two users' agents compare preference vectors
// and dealbreakers. Only high-confidence, dealbreaker-clean pairs should
// ever be surfaced to a human. This module is pure and side-effect free so
// it can run inside a batch job or a request handler alike.

import { sameIntentPool, type Intent } from "./intent.js";

export interface CandidateProfile {
  userId: string;
  values: string[];
  dealbreakers: string[];
  vector: number[];
  intent: string;
}

export interface ScoreBreakdown {
  vectorSimilarity: number; // cosine similarity, [-1, 1]
  sharedValuesRatio: number; // [0, 1]
  intentAligned: boolean;
  dealbreakerViolations: string[]; // non-empty means the match is vetoed
}

export interface MatchResult {
  userAId: string;
  userBId: string;
  compatibilityScore: number; // [0, 1], 0 if vetoed
  breakdown: ScoreBreakdown;
  isMatch: boolean;
}

export const MATCH_THRESHOLD = 0.55;

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vector dimension mismatch");
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * A "dealbreaker" is a hard veto: if A lists a dealbreaker that appears among
 * B's declared values (or vice versa), the pair is excluded outright,
 * regardless of how well the vectors otherwise align. This encodes the
 * spec's promise that intent and dealbreakers are enforced, not just
 * weighted.
 */
function findDealbreakerViolations(a: CandidateProfile, b: CandidateProfile): string[] {
  const violations = new Set<string>();
  for (const db of a.dealbreakers) {
    if (b.values.includes(db)) violations.add(db);
  }
  for (const db of b.dealbreakers) {
    if (a.values.includes(db)) violations.add(db);
  }
  return [...violations];
}

function sharedValuesRatio(a: CandidateProfile, b: CandidateProfile): number {
  const union = new Set([...a.values, ...b.values]);
  if (union.size === 0) return 0;
  const shared = a.values.filter((v) => b.values.includes(v));
  return shared.length / union.size;
}

export function scoreCandidatePair(a: CandidateProfile, b: CandidateProfile): MatchResult {
  const dealbreakerViolations = findDealbreakerViolations(a, b);
  const vectorSimilarity = cosineSimilarity(a.vector, b.vector);
  const values = sharedValuesRatio(a, b);
  const intentAligned = a.intent !== "UNSURE" && a.intent === b.intent;

  const breakdown: ScoreBreakdown = {
    vectorSimilarity,
    sharedValuesRatio: values,
    intentAligned,
    dealbreakerViolations,
  };

  if (dealbreakerViolations.length > 0) {
    return { userAId: a.userId, userBId: b.userId, compatibilityScore: 0, breakdown, isMatch: false };
  }

  // Weighted blend: vector similarity carries the most signal, shared
  // values reinforce it, intent alignment is a modest bonus (not a veto —
  // "UNSURE" users can still be shown strong matches).
  const normalizedVector = (vectorSimilarity + 1) / 2; // map [-1,1] -> [0,1]
  const score = normalizedVector * 0.6 + values * 0.3 + (intentAligned ? 0.1 : 0);

  return {
    userAId: a.userId,
    userBId: b.userId,
    compatibilityScore: score,
    breakdown,
    isMatch: score >= MATCH_THRESHOLD,
  };
}

/**
 * Given one user's agent and a pool of candidate agents, returns the single
 * best match above threshold — "you see one person," never a feed. Returns
 * null if nothing in the pool clears the bar.
 */
export function findBestMatch(
  self: CandidateProfile,
  pool: CandidateProfile[],
): MatchResult | null {
  let best: MatchResult | null = null;
  for (const candidate of pool) {
    if (candidate.userId === self.userId) continue;
    if (!sameIntentPool(self.intent as Intent, candidate.intent as Intent)) continue;
    const result = scoreCandidatePair(self, candidate);
    if (result.isMatch && (!best || result.compatibilityScore > best.compatibilityScore)) {
      best = result;
    }
  }
  return best;
}
