// The Closure Guarantee: the product's differentiator. Silence is not a
// modeled end state anywhere in this file — every path that ends a match
// requires a reason from the taxonomy, and failing to file one within the
// SLA has a real cost (escrow forfeiture + accountability score hit).

import { clampAccountabilityScore } from "./accountabilityScore.js";

export const CLOSURE_REASON_TAXONOMY = [
  "NOT_A_ROMANTIC_FIT",
  "DIFFERENT_LIFE_GOALS",
  "DIFFERENT_INTENT",
  "LACK_OF_CHEMISTRY",
  "LOGISTICS_DISTANCE",
  "COMMUNICATION_STYLE",
  "VALUES_MISMATCH",
  "ALREADY_SEEING_SOMEONE_ELSE",
  "NOT_READY_TO_DATE",
  "OTHER",
] as const;

export type ClosureReason = (typeof CLOSURE_REASON_TAXONOMY)[number];

export const CLOSURE_DEPOSIT_CENTS = 750; // $7.50, within the spec's $5-10 band
export const CLOSURE_SLA_HOURS = 48;

export interface ClosureRequest {
  reasonCategory: ClosureReason;
  reasonNote?: string;
  isAnonymous: boolean;
}

export interface ClosureFilingResult {
  accepted: true;
  escrowReleaseAmountCents: number; // returned to the filer for honoring the SLA
}

export class InvalidClosureReasonError extends Error {
  constructor(reason: string) {
    super(`"${reason}" is not a valid closure reason — a reason from the taxonomy is required`);
    this.name = "InvalidClosureReasonError";
  }
}

export function isValidClosureReason(reason: string): reason is ClosureReason {
  return (CLOSURE_REASON_TAXONOMY as readonly string[]).includes(reason);
}

/**
 * Files a closure event. Silence is never accepted here: a missing or
 * invalid reason throws rather than defaulting to something silent like
 * "OTHER", forcing every caller (API layer included) to require the reason
 * be explicit.
 */
export function fileClosure(request: ClosureRequest): ClosureFilingResult {
  if (!request.reasonCategory || !isValidClosureReason(request.reasonCategory)) {
    throw new InvalidClosureReasonError(String(request.reasonCategory));
  }
  return { accepted: true, escrowReleaseAmountCents: CLOSURE_DEPOSIT_CENTS };
}

export interface AccountabilityAdjustment {
  newScore: number;
  delta: number;
}

/** Filing closure on time is scored neutrally — it's the expected behavior,
 * not a reward. Going silent past the SLA is what moves the score. */
export function applyClosureFiledOnTime(currentScore: number): AccountabilityAdjustment {
  return { newScore: currentScore, delta: 0 };
}

/**
 * Silence past the SLA forfeits the escrow deposit (credited to the
 * counterparty who was left hanging) and costs accountability score. This
 * is the commitment device described in the spec's incentive table.
 */
export function applySilenceForfeit(currentScore: number): AccountabilityAdjustment {
  const delta = -15;
  return { newScore: clampAccountabilityScore(currentScore + delta), delta };
}

/**
 * A no-show costs more accountability score than silence: standing someone
 * up with no warning is a worse breach than failing to explain, after the
 * fact, why a date that actually happened didn't lead anywhere. Permanent
 * like applySilenceForfeit — no reset window, unlike the cancellation
 * ladder's SUSPENSION penalty (src/domain/accountabilityReset.ts), which
 * exists precisely to let occasional cancellations recover over time. A
 * no-show isn't a ladder tier; it's a one-off breach with its own,
 * harsher, non-recoverable consequence.
 */
export function applyNoShowForfeit(currentScore: number): AccountabilityAdjustment {
  const delta = -30;
  return { newScore: clampAccountabilityScore(currentScore + delta), delta };
}

export interface EscrowOutcome {
  filerAmountCents: number; // >0 released back to filer, 0 if forfeited
  counterpartyCreditCents: number; // >0 if forfeited to the other party
}

export function resolveEscrow(filedOnTime: boolean): EscrowOutcome {
  if (filedOnTime) {
    return { filerAmountCents: CLOSURE_DEPOSIT_CENTS, counterpartyCreditCents: 0 };
  }
  return { filerAmountCents: 0, counterpartyCreditCents: CLOSURE_DEPOSIT_CENTS };
}

/** Whether a deposit filed at `filedAt` (or never filed, if undefined) beat
 * the SLA measured from `deadlineStart`. */
export function isWithinClosureSla(deadlineStart: Date, filedAt: Date | undefined, now: Date): boolean {
  if (!filedAt) {
    const elapsedHours = (now.getTime() - deadlineStart.getTime()) / (1000 * 60 * 60);
    return elapsedHours <= CLOSURE_SLA_HOURS;
  }
  const elapsedHours = (filedAt.getTime() - deadlineStart.getTime()) / (1000 * 60 * 60);
  return elapsedHours <= CLOSURE_SLA_HOURS;
}
