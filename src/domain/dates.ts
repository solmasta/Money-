// Date confirmation + the cancellation ladder: free -> fee -> suspension.
// Tracks per-user cancellation counts to decide the consequence tier.

export type CancellationConsequence =
  | { tier: "FREE"; feeCents: 0 }
  | { tier: "FEE"; feeCents: number }
  | { tier: "SUSPENSION"; feeCents: number };

const FIRST_FREE_CANCELLATIONS = 1;
const FEE_TIER_CANCELLATIONS = 3; // cancellations 2-3 incur a fee
const CANCELLATION_FEE_CENTS = 1000; // $10

/**
 * `priorCancellationCount` is how many cancellations this user has already
 * made (in a rolling window — the caller decides the window, e.g. trailing
 * 90 days). This function is pure: given a count, it returns the
 * consequence for the *next* cancellation.
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
