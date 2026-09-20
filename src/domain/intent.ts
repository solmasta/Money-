// Intent locking: prevents the "16% lie about intent" problem by requiring
// a user's declared intent to stay fixed for a window after being set,
// and routing matching into separate pools per intent.

export type Intent = "CASUAL" | "LONG_TERM" | "MARRIAGE_MINDED" | "UNSURE";

export const DEFAULT_INTENT_LOCK_DAYS = 30;

export class IntentLockedError extends Error {
  constructor(unlocksAt: Date) {
    super(`Intent is locked until ${unlocksAt.toISOString()}`);
    this.name = "IntentLockedError";
  }
}

export function canChangeIntent(lockedAt: Date | null, lockDays: number, now: Date): boolean {
  if (!lockedAt) return true;
  const unlocksAt = new Date(lockedAt.getTime() + lockDays * 24 * 60 * 60 * 1000);
  return now >= unlocksAt;
}

/** Throws IntentLockedError if the change isn't allowed yet; otherwise
 * returns the new lock timestamp (now). */
export function changeIntent(lockedAt: Date | null, lockDays: number, now: Date): Date {
  if (!canChangeIntent(lockedAt, lockDays, now)) {
    const unlocksAt = new Date(lockedAt!.getTime() + lockDays * 24 * 60 * 60 * 1000);
    throw new IntentLockedError(unlocksAt);
  }
  return now;
}

/** Matching pools must never cross intent lines except when either side is
 * UNSURE (an UNSURE user hasn't committed yet, so they can surface in any
 * pool while they decide). */
export function sameIntentPool(a: Intent, b: Intent): boolean {
  if (a === "UNSURE" || b === "UNSURE") return true;
  return a === b;
}
