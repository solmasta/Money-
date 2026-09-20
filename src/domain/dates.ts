// Date confirmation + the cancellation ladder: free -> fee -> suspension.
// Tracks per-user cancellation counts, within a rolling window, to decide
// the consequence tier — a cancellation more than CANCELLATION_WINDOW_DAYS
// old counts for neither the ladder tier nor the score penalty it caused
// (see src/domain/accountabilityReset.ts for the latter).

import type { PrismaClient } from "@prisma/client";

export type CancellationConsequence =
  | { tier: "FREE"; feeCents: 0 }
  | { tier: "FEE"; feeCents: number }
  | { tier: "SUSPENSION"; feeCents: number };

const FIRST_FREE_CANCELLATIONS = 1;
const FEE_TIER_CANCELLATIONS = 3; // cancellations 2-3 incur a fee
const CANCELLATION_FEE_CENTS = 1000; // $10

export const CANCELLATION_WINDOW_DAYS = 90;
export const SUSPENSION_SCORE_PENALTY = 25;

/** Start of the rolling window, as of `now`. A cancellation counts toward
 * the ladder (and its penalty stays live) only while it falls on or after
 * this instant. */
export function cancellationWindowStart(now: Date, windowDays: number = CANCELLATION_WINDOW_DAYS): Date {
  return new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
}

/** How many cancellations `userId` has made within the rolling window as of
 * `now` — the count `cancellationConsequence` expects for the *next*
 * cancellation. A cancellation older than the window doesn't count,
 * regardless of how many times it's ever happened lifetime. */
export async function countCancellationsInWindow(
  prisma: PrismaClient,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  return prisma.dateProposal.count({
    where: {
      status: "CANCELLED",
      cancelledByUserId: userId,
      cancelledAt: { gte: cancellationWindowStart(now) },
    },
  });
}

/**
 * `priorCancellationCount` is how many cancellations this user has already
 * made within the rolling window (see `cancellationWindowStart` — the
 * caller filters by it). This function is pure: given a count, it returns
 * the consequence for the *next* cancellation.
 */
export function cancellationConsequence(priorCancellationCount: number): CancellationConsequence {
  if (priorCancellationCount < FIRST_FREE_CANCELLATIONS) {
    return { tier: "FREE", feeCents: 0 };
  }
  if (priorCancellationCount < FEE_TIER_CANCELLATIONS) {
    return { tier: "FEE", feeCents: CANCELLATION_FEE_CENTS };
  }
  return { tier: "SUSPENSION", feeCents: CANCELLATION_FEE_CENTS };
}

/** No-shows skip the ladder entirely — full escrow forfeiture is handled by
 * the closure/escrow module. This just flags whether the date proposal
 * should transition to NO_SHOW vs CANCELLED. */
export function isLateCancellation(scheduledAt: Date, cancelledAt: Date): boolean {
  const hoursBefore = (scheduledAt.getTime() - cancelledAt.getTime()) / (1000 * 60 * 60);
  return hoursBefore < 2;
}
