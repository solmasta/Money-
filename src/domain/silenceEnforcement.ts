import type { PrismaClient } from "@prisma/client";
import { CLOSURE_SLA_HOURS, applySilenceForfeit } from "./closure.js";
import { resolveClosureDeposit, TERMINAL_DEPOSIT_REASONS } from "./escrow.js";

/**
 * The closure SLA clock starts when a date is confirmed attended — that's
 * the concrete point after which "either party doesn't want a second date"
 * applies (per the spec's Closure Guarantee). A user is "obligated" for a
 * match once they've approved it (an escrow deposit was held for them);
 * they discharge that obligation by filing a ClosureEvent as sender for
 * that match. Anyone still obligated once the SLA has elapsed is silent.
 */
export interface SilenceObligation {
  matchId: string;
  userId: string;
  counterpartyId: string;
}

/**
 * Finds every (match, user) pair that is past the closure SLA with no
 * ClosureEvent filed and no prior enforcement recorded. Read-only — safe to
 * call as often as needed (e.g. to preview what a sweep would do).
 */
export async function findSilenceObligations(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<SilenceObligation[]> {
  const cutoff = new Date(now.getTime() - CLOSURE_SLA_HOURS * 60 * 60 * 1000);

  const overdueDateProposals = await prisma.dateProposal.findMany({
    where: {
      status: "CONFIRMED_ATTENDED",
      attendedAt: { lte: cutoff },
      match: { status: { notIn: ["CLOSED", "DECLINED"] } },
    },
    select: { matchId: true },
    distinct: ["matchId"],
  });

  const obligations: SilenceObligation[] = [];

  for (const { matchId } of overdueDateProposals) {
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match || match.status === "CLOSED" || match.status === "DECLINED") continue;

    for (const [userId, counterpartyId] of [
      [match.userAId, match.userBId],
      [match.userBId, match.userAId],
    ] as const) {
      const [heldDeposit, filedClosure, alreadyResolved] = await Promise.all([
        prisma.escrowLedgerEntry.findFirst({
          where: { userId, matchId, reason: "closure_deposit_held" },
        }),
        prisma.closureEvent.findFirst({ where: { senderId: userId, matchId } }),
        // Checks every terminal reason, not just "closure_forfeit" from a
        // prior sweep — a deposit already forfeited via a no-show on an
        // earlier date in this same match must not be forfeited again once
        // a later date's closure SLA lapses.
        prisma.escrowLedgerEntry.findFirst({
          where: { userId, matchId, reason: { in: TERMINAL_DEPOSIT_REASONS } },
        }),
      ]);

      if (heldDeposit && !filedClosure && !alreadyResolved) {
        obligations.push({ matchId, userId, counterpartyId });
      }
    }
  }

  return obligations;
}

export interface SilenceEnforcementResult {
  matchId: string;
  userId: string;
  newAccountabilityScore: number;
}

/**
 * Applies the consequence for one silent party: forfeits their escrow
 * deposit to the counterparty, dents their accountability score, and closes
 * the match (mirroring the manual closure route — one side's closure,
 * filed or enforced, ends the match). Shared by the manual
 * `/enforce-silence` endpoint and the scheduled sweep so both paths apply
 * the exact same consequence.
 */
export async function enforceSilenceForUser(
  prisma: PrismaClient,
  matchId: string,
  userId: string,
  counterpartyId: string,
): Promise<SilenceEnforcementResult> {
  await resolveClosureDeposit(prisma, userId, counterpartyId, matchId, false);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const adjustment = applySilenceForfeit(user.accountabilityScore);
  await prisma.user.update({ where: { id: user.id }, data: { accountabilityScore: adjustment.newScore } });

  await prisma.match.update({ where: { id: matchId }, data: { status: "CLOSED" } });

  return { matchId, userId, newAccountabilityScore: adjustment.newScore };
}

/**
 * The scheduled job's entry point: finds every silent obligation and
 * enforces each one. Idempotent — re-running a sweep never double-forfeits,
 * since `findSilenceObligations` excludes anyone already enforced or who
 * has since filed closure.
 */
export async function runEnforceSilenceSweep(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<SilenceEnforcementResult[]> {
  const obligations = await findSilenceObligations(prisma, now);
  const results: SilenceEnforcementResult[] = [];
  for (const obligation of obligations) {
    results.push(
      await enforceSilenceForUser(prisma, obligation.matchId, obligation.userId, obligation.counterpartyId),
    );
  }
  return results;
}
