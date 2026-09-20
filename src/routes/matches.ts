import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { findBestMatch, type CandidateProfile } from "../domain/matching.js";
import { holdClosureDeposit, resolveClosureDeposit } from "../domain/escrow.js";
import { fileClosure, isValidClosureReason } from "../domain/closure.js";
import { enforceSilenceForUser, isMatchOverdueForClosure } from "../domain/silenceEnforcement.js";

export const matchesRouter = Router();

async function toCandidateProfile(user: {
  id: string;
  intent: string;
  preferenceProfile: { values: string; dealbreakers: string; vector: string } | null;
}): Promise<CandidateProfile | null> {
  if (!user.preferenceProfile) return null;
  return {
    userId: user.id,
    values: JSON.parse(user.preferenceProfile.values),
    dealbreakers: JSON.parse(user.preferenceProfile.dealbreakers),
    vector: JSON.parse(user.preferenceProfile.vector),
    intent: user.intent,
  };
}

/**
 * Agent-to-agent negotiation entry point: finds the single best match for a
 * user among other verified, profiled users who aren't already matched with
 * them, and persists it as a PROPOSED Match. "You see one person" — this
 * never returns a list.
 */
matchesRouter.post("/find/:userId", async (req, res) => {
  const self = await prisma.user.findUnique({
    where: { id: req.params.userId },
    include: { preferenceProfile: true },
  });
  if (!self) return res.status(404).json({ error: "not found" });
  if (self.verificationStatus !== "VERIFIED") {
    return res.status(403).json({ error: "user must be verified before matching" });
  }

  const selfCandidate = await toCandidateProfile(self);
  if (!selfCandidate) return res.status(400).json({ error: "user has no preference profile yet" });

  const existingMatchUserIds = new Set(
    (
      await prisma.match.findMany({
        where: { OR: [{ userAId: self.id }, { userBId: self.id }] },
        select: { userAId: true, userBId: true },
      })
    ).flatMap((m) => [m.userAId, m.userBId]),
  );

  const poolUsers = await prisma.user.findMany({
    where: {
      id: { not: self.id, notIn: [...existingMatchUserIds] },
      verificationStatus: "VERIFIED",
      preferenceProfile: { isNot: null },
    },
    include: { preferenceProfile: true },
  });

  const pool = (await Promise.all(poolUsers.map(toCandidateProfile))).filter(
    (c): c is CandidateProfile => c !== null,
  );

  const result = findBestMatch(selfCandidate, pool);
  if (!result) return res.status(404).json({ error: "no compatible match found in pool" });

  const match = await prisma.match.create({
    data: {
      userAId: result.userAId,
      userBId: result.userBId,
      compatibilityScore: result.compatibilityScore,
      scoreBreakdown: JSON.stringify(result.breakdown),
      status: "PROPOSED",
    },
  });

  res.status(201).json(match);
});

const approveSchema = z.object({ userId: z.string() });

/**
 * Both sides must approve before a match moves to date scheduling. We hold
 * a closure-commitment deposit for a user the moment they approve — the
 * point at which they've committed to this match and thus owe closure if
 * it doesn't work out.
 */
matchesRouter.post("/:id/approve", async (req, res) => {
  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const match = await prisma.match.findUnique({ where: { id: req.params.id } });
  if (!match) return res.status(404).json({ error: "not found" });
  if (![match.userAId, match.userBId].includes(parsed.data.userId)) {
    return res.status(403).json({ error: "user is not part of this match" });
  }

  await holdClosureDeposit(prisma, parsed.data.userId, match.id);

  const updated = await prisma.match.update({
    where: { id: match.id },
    data: { status: "PENDING_APPROVAL" },
  });

  res.json(updated);
});

const closureSchema = z.object({
  userId: z.string(),
  reasonCategory: z.string(),
  reasonNote: z.string().optional(),
  isAnonymous: z.boolean().default(false),
});

/**
 * The Closure Guarantee, wired to the API: ends this match on the filer's
 * side. Requires a valid taxonomy reason — there is no "just decline"
 * endpoint that skips this. Filing a reason is always accepted (a late
 * explanation beats none), but the escrow/score consequence depends on
 * whether it actually beat the SLA: filing while no attended date's
 * 48-hour window has lapsed releases the deposit as normal; filing after
 * one has lapsed gets exactly the consequence the automatic silence sweep
 * would have applied (enforceSilenceForUser is idempotent against a sweep
 * that already got there first).
 */
matchesRouter.post("/:id/closure", async (req, res) => {
  const parsed = closureSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!isValidClosureReason(parsed.data.reasonCategory)) {
    return res.status(400).json({ error: "reasonCategory must be one of the taxonomy values" });
  }

  const match = await prisma.match.findUnique({ where: { id: req.params.id } });
  if (!match) return res.status(404).json({ error: "not found" });
  const { userAId, userBId } = match;
  if (![userAId, userBId].includes(parsed.data.userId)) {
    return res.status(403).json({ error: "user is not part of this match" });
  }
  const counterpartyId = parsed.data.userId === userAId ? userBId : userAId;

  fileClosure({
    reasonCategory: parsed.data.reasonCategory,
    reasonNote: parsed.data.reasonNote,
    isAnonymous: parsed.data.isAnonymous,
  });

  const closureEvent = await prisma.closureEvent.create({
    data: {
      matchId: match.id,
      senderId: parsed.data.userId,
      recipientId: counterpartyId,
      reasonCategory: parsed.data.reasonCategory,
      reasonNote: parsed.data.isAnonymous ? null : parsed.data.reasonNote,
      isAnonymous: parsed.data.isAnonymous,
      deliveredAt: new Date(),
    },
  });

  const now = new Date();
  const filedOnTime = !(await isMatchOverdueForClosure(prisma, match.id, now));

  if (filedOnTime) {
    await resolveClosureDeposit(prisma, parsed.data.userId, counterpartyId, match.id, true);
    await prisma.match.update({ where: { id: match.id }, data: { status: "CLOSED" } });
  } else {
    await enforceSilenceForUser(prisma, match.id, parsed.data.userId, counterpartyId);
  }

  const updated = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });

  res.status(201).json({ closureEvent, match: updated, filedOnTime });
});

/**
 * Manual/admin override for the "silence is not an option" promise:
 * forfeits the named user's escrow deposit to the counterparty, dings
 * their accountability score, and closes the match. The scheduled sweep
 * (src/domain/silenceEnforcement.ts, wired up in src/jobs/scheduler.ts)
 * calls the same underlying function automatically once a match's closure
 * SLA has expired with no ClosureEvent filed by one side — this endpoint
 * exists to trigger that same consequence on demand (e.g. from an admin
 * tool) rather than waiting for the next sweep.
 */
matchesRouter.post("/:id/enforce-silence", async (req, res) => {
  const parsed = approveSchema.safeParse(req.body); // { userId } = the silent party
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const match = await prisma.match.findUnique({ where: { id: req.params.id } });
  if (!match) return res.status(404).json({ error: "not found" });
  const { userAId, userBId } = match;
  if (![userAId, userBId].includes(parsed.data.userId)) {
    return res.status(403).json({ error: "user is not part of this match" });
  }
  const counterpartyId = parsed.data.userId === userAId ? userBId : userAId;

  const result = await enforceSilenceForUser(prisma, match.id, parsed.data.userId, counterpartyId);

  res.json(result);
});
