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
 * credited to the counterparty.
 */
export async function resolveClosureDeposit(
  prisma: PrismaClient,
  userId: string,
  counterpartyId: string,
  matchId: string,
  filedOnTime: boolean,
) {
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

const RESOLVED_REASONS = ["closure_deposit_released", "closure_forfeit", "closure_deposit_released_success"];

/**
 * Releases a user's closure-commitment deposit because the match succeeded
 * — reported as a relationship (src/routes/success.ts), not closed via the
 * Closure Guarantee. Nobody owes closure here: the match worked, so there's
 * nothing to explain. A user who never approved (and so never had a
 * deposit held) or whose deposit was already resolved some other way
 * (an explicit closure filing, or a silence-enforcement forfeit — possible
 * if the two events race) is left alone; this returns null rather than
 * creating a spurious ledger entry.
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
    where: { userId, matchId, reason: { in: RESOLVED_REASONS } },
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
