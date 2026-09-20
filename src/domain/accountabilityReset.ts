import type { PrismaClient } from "@prisma/client";
import { CANCELLATION_WINDOW_DAYS, SUSPENSION_SCORE_PENALTY } from "./dates.js";
import { clampAccountabilityScore } from "./accountabilityScore.js";

const PENALTY_REASON = "cancellation_suspension_penalty";
const REVERSAL_REASON = "cancellation_suspension_penalty_reversed";

function penaltyExpiry(appliedAt: Date, windowDays: number = CANCELLATION_WINDOW_DAYS): Date {
  return new Date(appliedAt.getTime() + windowDays * 24 * 60 * 60 * 1000);
}

/**
 * Applies the SUSPENSION-tier cancellation penalty and records it as a
 * ledger entry with an expiry — the same rolling window that ages a
 * cancellation out of the ladder's tier count also schedules this penalty
 * to auto-reverse, so a bad stretch of cancellations 90+ days ago doesn't
 * permanently tank someone's score.
 */
export async function applyCancellationSuspensionPenalty(
  prisma: PrismaClient,
  userId: string,
  dateProposalId: string,
  now: Date = new Date(),
): Promise<{ newScore: number }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const newScore = clampAccountabilityScore(user.accountabilityScore - SUSPENSION_SCORE_PENALTY);

  await prisma.user.update({ where: { id: userId }, data: { accountabilityScore: newScore } });
  await prisma.accountabilityLedgerEntry.create({
    data: {
      userId,
      dateProposalId,
      delta: -SUSPENSION_SCORE_PENALTY,
      reason: PENALTY_REASON,
      expiresAt: penaltyExpiry(now),
    },
  });

  return { newScore };
}

/** Read-only: every penalty whose window has elapsed with no reversal on
 * file yet. Safe to call as often as needed. */
export async function findExpiredAccountabilityPenalties(prisma: PrismaClient, now: Date = new Date()) {
  return prisma.accountabilityLedgerEntry.findMany({
    where: {
      reason: PENALTY_REASON,
      reversedAt: null,
      expiresAt: { lte: now },
    },
  });
}

export interface AccountabilityResetResult {
  ledgerEntryId: string;
  userId: string;
  newAccountabilityScore: number;
}

/**
 * Reverses one penalty: credits the score back (clamped, since other
 * penalties may have moved it in the meantime), marks the original entry
 * reversed, and writes a reversal entry for the audit trail. Reversing an
 * entry twice is a no-op the second time only if the caller re-checks
 * `reversedAt` first — `runEnforceSilenceSweep`'s counterpart,
 * `runAccountabilityResetSweep`, does exactly that via
 * `findExpiredAccountabilityPenalties`.
 */
export async function reverseAccountabilityPenalty(
  prisma: PrismaClient,
  ledgerEntryId: string,
): Promise<AccountabilityResetResult> {
  const entry = await prisma.accountabilityLedgerEntry.findUniqueOrThrow({ where: { id: ledgerEntryId } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: entry.userId } });

  // entry.delta is negative (a penalty), so subtracting it credits it back.
  const newScore = clampAccountabilityScore(user.accountabilityScore - entry.delta);

  await prisma.user.update({ where: { id: user.id }, data: { accountabilityScore: newScore } });
  await prisma.accountabilityLedgerEntry.update({
    where: { id: entry.id },
    data: { reversedAt: new Date() },
  });
  await prisma.accountabilityLedgerEntry.create({
    data: {
      userId: user.id,
      dateProposalId: entry.dateProposalId,
      delta: -entry.delta,
      reason: REVERSAL_REASON,
    },
  });

  return { ledgerEntryId: entry.id, userId: user.id, newAccountabilityScore: newScore };
}

/**
 * The scheduled job's entry point: finds every expired, unreversed
 * cancellation-suspension penalty and reverses each. Idempotent — a penalty
 * reversed by one sweep is excluded from the next by
 * `findExpiredAccountabilityPenalties`'s `reversedAt: null` filter.
 */
export async function runAccountabilityResetSweep(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<AccountabilityResetResult[]> {
  const expired = await findExpiredAccountabilityPenalties(prisma, now);
  const results: AccountabilityResetResult[] = [];
  for (const entry of expired) {
    results.push(await reverseAccountabilityPenalty(prisma, entry.id));
  }
  return results;
}
