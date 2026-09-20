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

/**
 * Whether at least one of this match's attended dates has an expired
 * closure SLA — the same cutoff `findSilenceObligations` uses to decide
 * who's obligated, extracted so a second caller (a manual closure filing
 * that turns out to be late — src/routes/matches.ts) can ask "is this
 * late?" for one match without duplicating the query, and so the two
 * never drift into disagreeing about what counts as overdue.
 */
export async function isMatchOverdueForClosure(
  prisma: PrismaClient,
  matchId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const cutoff = new Date(now.getTime() - CLOSURE_SLA_HOURS * 60 * 60 * 1000);
  const overdueAttendedDate = await prisma.dateProposal.findFirst({
    where: { matchId, status: "CONFIRMED_ATTENDED", attendedAt: { lte: cutoff } },
  });
  return !!overdueAttendedDate;
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
 * filed or enforced, ends the match). Shared by three callers now: the
 * manual `/enforce-silence` endpoint, the scheduled sweep, and a manual
 * closure filing that turns out to be late (src/routes/matches.ts) — so
 * this checks for a prior resolution itself rather than trusting every
 * caller to have pre-filtered, and is a full no-op (no double score hit,
 * no redundant match update) if another path already handled this
 * (match, user) pair.
 */
export async function enforceSilenceForUser(
  prisma: PrismaClient,
  matchId: string,
  userId: string,
  counterpartyId: string,
): Promise<SilenceEnforcementResult> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const alreadyResolved = await prisma.escrowLedgerEntry.findFirst({
    where: { userId, matchId, reason: { in: TERMINAL_DEPOSIT_REASONS } },
  });
  if (alreadyResolved) {
    return { matchId, userId, newAccountabilityScore: user.accountabilityScore };
  }

  await resolveClosureDeposit(prisma, userId, counterpartyId, matchId, false);

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
