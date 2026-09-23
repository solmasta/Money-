import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { getNextPromptForUser, respondToPrompt, InvalidResponseStyleError, NoMorePromptsError } from "../domain/trustPrompts.js";
import { levelForXp, xpProgress, unlockedPerks, GUARANTEE_TRUST } from "../domain/leveling.js";

export const trustRouter = Router();

function requireMembership(match: { userAId: string; userBId: string }, userId: string, res: import("express").Response): boolean {
  if (![match.userAId, match.userBId].includes(userId)) {
    res.status(403).json({ error: "user is not part of this match" });
    return false;
  }
  return true;
}

/**
 * Real multiplayer status for a match: current trust, whether it's
 * guaranteed, and both real users' level/xp. The "Trust Quest" prototype's
 * rules, now reading real persisted state instead of scripted NPCs.
 */
trustRouter.get("/matches/:id/trust", async (req, res) => {
  const match = await prisma.match.findUnique({
    where: { id: req.params.id },
    include: { userA: true, userB: true },
  });
  if (!match) return res.status(404).json({ error: "not found" });

  res.json({
    trust: match.trust,
    guaranteedAt: match.guaranteedAt,
    guaranteeThreshold: GUARANTEE_TRUST,
    userA: { id: match.userA.id, displayName: match.userA.displayName, level: levelForXp(match.userA.xp), xp: xpProgress(match.userA.xp) },
    userB: { id: match.userB.id, displayName: match.userB.displayName, level: levelForXp(match.userB.xp), xp: xpProgress(match.userB.xp) },
  });
});

/**
 * The next shared trust prompt for `userId` on this match — null once
 * they've worked through every prompt in the pool. Includes the level-2+
 * "Read the room" hint when it applies.
 */
trustRouter.get("/matches/:id/trust/next", async (req, res) => {
  const userId = String(req.query.userId ?? "");
  if (!userId) return res.status(400).json({ error: "userId query param is required" });

  const match = await prisma.match.findUnique({ where: { id: req.params.id } });
  if (!match) return res.status(404).json({ error: "not found" });
  if (!requireMembership(match, userId, res)) return;

  const next = await getNextPromptForUser(prisma, match.id, userId);
  res.json({ prompt: next });
});

const respondSchema = z.object({
  userId: z.string(),
  promptIndex: z.number().int(),
  style: z.string(),
});

/**
 * Records `userId`'s answer to one real prompt. Grants xp immediately;
 * resolves mutual trust onto the Match (and sets guaranteedAt) once the
 * counterparty has also answered the same prompt.
 */
trustRouter.post("/matches/:id/trust/respond", async (req, res) => {
  const parsed = respondSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const match = await prisma.match.findUnique({ where: { id: req.params.id } });
  if (!match) return res.status(404).json({ error: "not found" });
  if (!requireMembership(match, parsed.data.userId, res)) return;

  try {
    const result = await respondToPrompt(
      prisma,
      match.id,
      parsed.data.promptIndex,
      parsed.data.userId,
      parsed.data.style,
    );
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof InvalidResponseStyleError || err instanceof NoMorePromptsError) {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }
});

/** Which perks `userId` has unlocked, and which are still ahead. */
trustRouter.get("/users/:id/perks", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "not found" });

  const level = levelForXp(user.xp);
  res.json({ level, xp: xpProgress(user.xp), perks: unlockedPerks(level) });
});
