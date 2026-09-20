import type { PrismaClient } from "@prisma/client";
import { CLOSURE_DEPOSIT_CENTS, resolveEscrow } from "./closure.js";

/** Holds a closure-commitment deposit for a user against a specific match. */
export async function holdClosureDeposit(prisma: PrismaClient, userId: string, matchId: string) {
  return prisma.escrowLedgerEntry.create({
    data: {
      userId,
      matchId,
      amountCents: CLOSURE_DEPOSIT_CENTS,
      reason: "closure_deposit_held",
    },
  });
}

/**
 * Resolves the deposit once we know whether the user filed their closure
 * reason on time. On time: the deposit is released back to them (a
 * zero-sum ledger no-op recorded for audit). Late/never: it's forfeited and
 * credited to the counterparty. A no-op — not an error — for a user who
 * never had a deposit held, or whose deposit was already resolved some
 * other way (this function has two callers now: the automatic silence
 * sweep, and a manual closure filing that turns out to be late — either
 * one could win a race against the other, or against a no-show that
 * already claimed the same deposit).
 */
export async function resolveClosureDeposit(
  prisma: PrismaClient,
  userId: string,
  counterpartyId: string,
  matchId: string,
  filedOnTime: boolean,
) {
  const held = await prisma.escrowLedgerEntry.findFirst({
    where: { userId, matchId, reason: "closure_deposit_held" },
  });
  if (!held) return null;

  const alreadyResolved = await prisma.escrowLedgerEntry.findFirst({
    where: { userId, matchId, reason: { in: TERMINAL_DEPOSIT_REASONS } },
  });
  if (alreadyResolved) return null;

  const outcome = resolveEscrow(filedOnTime);
  if (filedOnTime) {
    return prisma.escrowLedgerEntry.create({
      data: {
        userId,
        matchId,
        amountCents: outcome.filerAmountCents,
        reason: "closure_deposit_released",
      },
    });
  }
  await prisma.escrowLedgerEntry.create({
    data: {
      userId,
      matchId,
      amountCents: -CLOSURE_DEPOSIT_CENTS,
      reason: "closure_forfeit",
    },
  });
  return prisma.escrowLedgerEntry.create({
    data: {
      userId: counterpartyId,
      matchId,
      amountCents: outcome.counterpartyCreditCents,
      reason: "closure_forfeit_credit",
    },
  });
}

/**
 * Every reason a user's own held deposit can be considered settled —
 * anything past this point is terminal for that (user, match) pair, and no
 * other resolution path should touch it again. Exported so every place
 * that needs to ask "has this deposit already been dealt with?" (this
 * file's own functions, and findSilenceObligations in
 * silenceEnforcement.ts) checks against the same, complete list instead of
 * each hardcoding a partial one.
 */
export const TERMINAL_DEPOSIT_REASONS = [
  "closure_deposit_released",
  "closure_forfeit",
  "closure_deposit_released_success",
  "no_show_forfeit",
];

/**
 * Releases a user's closure-commitment deposit because the match succeeded
 * — reported as a relationship (src/routes/success.ts), not closed via the
 * Closure Guarantee. Nobody owes closure here: the match worked, so there's
 * nothing to explain. A user who never approved (and so never had a
 * deposit held) or whose deposit was already resolved some other way (an
 * explicit closure filing, a silence-enforcement forfeit, or a no-show
 * forfeit — any of which can race with a success report) is left alone;
 * this returns null rather than creating a spurious ledger entry.
 */
export async function releaseClosureDepositOnSuccess(
  prisma: PrismaClient,
  userId: string,
  matchId: string,
) {
  const held = await prisma.escrowLedgerEntry.findFirst({
    where: { userId, matchId, reason: "closure_deposit_held" },
  });
  if (!held) return null;

  const alreadyResolved = await prisma.escrowLedgerEntry.findFirst({
    where: { userId, matchId, reason: { in: TERMINAL_DEPOSIT_REASONS } },
  });
  if (alreadyResolved) return null;

  return prisma.escrowLedgerEntry.create({
    data: {
      userId,
      matchId,
      amountCents: CLOSURE_DEPOSIT_CENTS,
      reason: "closure_deposit_released_success",
    },
  });
}

/**
 * Forfeits a no-show user's full closure-commitment deposit to the
 * counterparty they stood up. Distinct from resolveClosureDeposit's
 * silence-forfeiture path — that one is about failing to explain why a
 * match didn't work out *after* a date happened; a no-show never got that
 * far, and skips the cancellation ladder's fee tiers entirely in favor of
 * losing the whole deposit outright (src/domain/noShow.ts pairs this with
 * an accountability-score hit). A no-op — not an error — for a user who
 * never had a deposit held (never approved the match) or whose deposit was
 * already resolved some other way.
 */
export async function forfeitClosureDepositForNoShow(
  prisma: PrismaClient,
  noShowUserId: string,
  counterpartyId: string,
  matchId: string,
) {
  const held = await prisma.escrowLedgerEntry.findFirst({
    where: { userId: noShowUserId, matchId, reason: "closure_deposit_held" },
  });
  if (!held) return null;

  const alreadyResolved = await prisma.escrowLedgerEntry.findFirst({
    where: { userId: noShowUserId, matchId, reason: { in: TERMINAL_DEPOSIT_REASONS } },
  });
  if (alreadyResolved) return null;

  await prisma.escrowLedgerEntry.create({
    data: {
      userId: noShowUserId,
      matchId,
      amountCents: -CLOSURE_DEPOSIT_CENTS,
      reason: "no_show_forfeit",
    },
  });
  return prisma.escrowLedgerEntry.create({
    data: {
      userId: counterpartyId,
      matchId,
      amountCents: CLOSURE_DEPOSIT_CENTS,
      reason: "no_show_forfeit_credit",
    },
  });
}
