// Shared bounds for the accountability score. Every mechanic that adjusts
// it — silence forfeiture (closure.ts), cancellation-ladder suspension and
// its reset (accountabilityReset.ts) — clamps through the same function so
// the floor/ceiling can't drift out of sync between them.

export const ACCOUNTABILITY_SCORE_FLOOR = 0;
export const ACCOUNTABILITY_SCORE_CEILING = 100;

export function clampAccountabilityScore(score: number): number {
  return Math.max(ACCOUNTABILITY_SCORE_FLOOR, Math.min(ACCOUNTABILITY_SCORE_CEILING, score));
}
