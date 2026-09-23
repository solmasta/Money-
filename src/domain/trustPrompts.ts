import type { PrismaClient } from "@prisma/client";
import { PROMPT_POOL } from "./promptPool.js";
import {
  isValidResponseStyle,
  XP_FOR_STYLE,
  trustDeltaForPair,
  levelForXp,
  GUARANTEE_TRUST,
  type ResponseStyle,
} from "./leveling.js";

export class InvalidResponseStyleError extends Error {
  constructor(style: string) {
    super(`"${style}" is not a valid response style — expected DIRECT, GUARDED, or DEFLECT`);
    this.name = "InvalidResponseStyleError";
  }
}

export class NoMorePromptsError extends Error {
  constructor() {
    super("Every shared trust prompt has already been answered for this match by this user");
    this.name = "NoMorePromptsError";
  }
}

export interface NextPrompt {
  promptIndex: number;
  question: string;
  options: { style: ResponseStyle; label: string }[];
  /** Level-2+ "Read the room" perk: the counterpart's top declared value,
   * if they have a preference profile. Real data, not flavor text. */
  hint: string | null;
}

/**
 * Serves the next unanswered prompt (lowest index this user hasn't
 * responded to yet, for this match) out of the fixed shared pool. Real
 * prompts don't loop — once both sides have worked through all of
 * PROMPT_POOL, there's nothing left to serve.
 */
export async function getNextPromptForUser(
  prisma: PrismaClient,
  matchId: string,
  userId: string,
): Promise<NextPrompt | null> {
  const answered = await prisma.matchPromptResponse.findMany({
    where: { matchId, userId },
    select: { promptIndex: true },
  });
  const answeredIndexes = new Set(answered.map((r) => r.promptIndex));

  let nextIndex = -1;
  for (let i = 0; i < PROMPT_POOL.length; i++) {
    if (!answeredIndexes.has(i)) {
      nextIndex = i;
      break;
    }
  }
  if (nextIndex === -1) return null;

  const prompt = PROMPT_POOL[nextIndex];

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  let hint: string | null = null;
  if (levelForXp(user.xp) >= 2) {
    const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    const counterpartyId = match.userAId === userId ? match.userBId : match.userAId;
    const counterpartyProfile = await prisma.preferenceProfile.findUnique({
      where: { userId: counterpartyId },
    });
    if (counterpartyProfile) {
      const values: string[] = JSON.parse(counterpartyProfile.values);
      if (values.length > 0) hint = `They said they value: ${values[0]}`;
    }
  }

  return { promptIndex: nextIndex, question: prompt.question, options: prompt.options, hint };
}

export interface RespondResult {
  promptIndex: number;
  xpGained: number;
  newXp: number;
  newLevel: number;
  /** Non-null once the counterpart has also answered this prompt — trust
   * only moves when both sides have weighed in. */
  trustResolved: { delta: number; newTrust: number; justGuaranteed: boolean } | null;
}

/**
 * Records one real user's answer to one real prompt on a real match.
 * Grants that user xp immediately (their own behavior, independent of the
 * other side). If the counterparty has already answered the same prompt,
 * resolves the mutual trust delta onto the Match and sets guaranteedAt the
 * first time trust crosses GUARANTEE_TRUST. A no-op — not an error — if
 * this user already answered this exact prompt (returns their original
 * result again, since answers aren't editable).
 */
export async function respondToPrompt(
  prisma: PrismaClient,
  matchId: string,
  promptIndex: number,
  userId: string,
  style: string,
): Promise<RespondResult> {
  if (!isValidResponseStyle(style)) {
    throw new InvalidResponseStyleError(style);
  }
  if (promptIndex < 0 || promptIndex >= PROMPT_POOL.length) {
    throw new NoMorePromptsError();
  }

  const existing = await prisma.matchPromptResponse.findUnique({
    where: { matchId_promptIndex_userId: { matchId, promptIndex, userId } },
  });

  const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
  const counterpartyId = match.userAId === userId ? match.userBId : match.userAId;

  if (existing) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { promptIndex, xpGained: 0, newXp: user.xp, newLevel: levelForXp(user.xp), trustResolved: null };
  }

  await prisma.matchPromptResponse.create({
    data: { matchId, promptIndex, userId, style },
  });

  const xpGained = XP_FOR_STYLE[style];
  const user = await prisma.user.update({
    where: { id: userId },
    data: { xp: { increment: xpGained } },
  });

  const counterpartyResponse = await prisma.matchPromptResponse.findUnique({
    where: { matchId_promptIndex_userId: { matchId, promptIndex, userId: counterpartyId } },
  });

  let trustResolved: RespondResult["trustResolved"] = null;
  if (counterpartyResponse) {
    const delta = trustDeltaForPair(style, counterpartyResponse.style as ResponseStyle);
    const newTrust = Math.max(0, Math.min(100, match.trust + delta));
    const justGuaranteed = !match.guaranteedAt && newTrust >= GUARANTEE_TRUST;

    await prisma.match.update({
      where: { id: matchId },
      data: {
        trust: newTrust,
        guaranteedAt: justGuaranteed ? new Date() : undefined,
      },
    });

    trustResolved = { delta, newTrust, justGuaranteed };
  }

  return {
    promptIndex,
    xpGained,
    newXp: user.xp,
    newLevel: levelForXp(user.xp),
    trustResolved,
  };
}
