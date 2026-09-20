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
