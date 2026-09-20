import type { PrismaClient } from "@prisma/client";
import { applyNoShowForfeit } from "./closure.js";
import { forfeitClosureDepositForNoShow } from "./escrow.js";

/**
 * A date can be reported as a no-show once its scheduled time has passed
 * and nobody has cancelled it or confirmed attendance — i.e. it's still
 * sitting in SCHEDULED. Only the side who actually showed up is in a
 * position to report it; this doesn't attempt to adjudicate a dispute
 * where both sides claim the other didn't show.
 */
export function canMarkNoShow(status: string, scheduledAt: Date, now: Date = new Date()): boolean {
  return status === "SCHEDULED" && now >= scheduledAt;
}

export interface NoShowResult {
  dateProposalId: string;
  noShowUserId: string;
  newAccountabilityScore: number;
}

/**
 * Records a no-show: transitions the date to NO_SHOW, forfeits the
 * no-show user's full closure-commitment deposit to the counterparty who
 * showed up, and dents their accountability score. Skips the cancellation
 * ladder entirely — no fee, no ladder tier — since a no-show is a harsher,
 * distinct consequence from a cancellation made ahead of time.
 */
export async function recordNoShow(
  prisma: PrismaClient,
  dateProposalId: string,
  matchId: string,
  noShowUserId: string,
  counterpartyId: string,
  now: Date = new Date(),
): Promise<NoShowResult> {
  await prisma.dateProposal.update({
    where: { id: dateProposalId },
    data: { status: "NO_SHOW", noShowUserId, noShowReportedAt: now },
  });

  await forfeitClosureDepositForNoShow(prisma, noShowUserId, counterpartyId, matchId);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: noShowUserId } });
  const adjustment = applyNoShowForfeit(user.accountabilityScore);
  await prisma.user.update({ where: { id: user.id }, data: { accountabilityScore: adjustment.newScore } });

  return { dateProposalId, noShowUserId, newAccountabilityScore: adjustment.newScore };
}
