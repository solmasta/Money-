import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { setupTestDatabase, type TestDatabase } from "./helpers/testDb.js";
import {
  getNextPromptForUser,
  respondToPrompt,
  InvalidResponseStyleError,
} from "../src/domain/trustPrompts.js";
import { trustDeltaForPair, XP_FOR_STYLE, GUARANTEE_TRUST } from "../src/domain/leveling.js";
import { PROMPT_POOL } from "../src/domain/promptPool.js";

// Exercises real multiplayer trust/xp resolution against a real, isolated
// Postgres schema — it's cross-row state shared between two real users,
// not meaningfully testable as a pure function.

let db: TestDatabase;
let prisma: PrismaClient;

beforeAll(async () => {
  db = await setupTestDatabase();
  prisma = db.prisma;
});

afterAll(async () => {
  await db.teardown();
});

beforeEach(async () => {
  await prisma.$transaction([
    prisma.matchPromptResponse.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.escrowLedgerEntry.deleteMany(),
    prisma.closureEvent.deleteMany(),
    prisma.dateProposal.deleteMany(),
    prisma.match.deleteMany(),
    prisma.preferenceProfile.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});

async function makeMatch() {
  const userA = await prisma.user.create({ data: { email: `a-${Date.now()}-${Math.random()}@t.com`, displayName: "A" } });
  const userB = await prisma.user.create({ data: { email: `b-${Date.now()}-${Math.random()}@t.com`, displayName: "B" } });
  const match = await prisma.match.create({
    data: { userAId: userA.id, userBId: userB.id, compatibilityScore: 0.9, scoreBreakdown: "{}", status: "PENDING_APPROVAL" },
  });
  return { userA, userB, match };
}

describe("getNextPromptForUser", () => {
  it("serves the first prompt for a fresh match", async () => {
    const { userA, match } = await makeMatch();
    const next = await getNextPromptForUser(prisma, match.id, userA.id);
    expect(next).not.toBeNull();
    expect(next!.promptIndex).toBe(0);
    expect(next!.question).toBe(PROMPT_POOL[0].question);
  });

  it("serves the next unanswered prompt after one is answered", async () => {
    const { userA, userB, match } = await makeMatch();
    await respondToPrompt(prisma, match.id, 0, userA.id, "DIRECT");
    const next = await getNextPromptForUser(prisma, match.id, userA.id);
    expect(next!.promptIndex).toBe(1);

    // userB hasn't answered anything yet — still starts at 0.
    const nextForB = await getNextPromptForUser(prisma, match.id, userB.id);
    expect(nextForB!.promptIndex).toBe(0);
  });

  it("returns null once every prompt has been answered", async () => {
    const { userA, match } = await makeMatch();
    for (let i = 0; i < PROMPT_POOL.length; i++) {
      await respondToPrompt(prisma, match.id, i, userA.id, "DIRECT");
    }
    expect(await getNextPromptForUser(prisma, match.id, userA.id)).toBeNull();
  });

  it("includes no hint below level 2", async () => {
    const { userA, userB, match } = await makeMatch();
    await prisma.preferenceProfile.create({
      data: {
        userId: userB.id,
        values: JSON.stringify(["honesty"]),
        dealbreakers: "[]",
        attachmentStyle: "secure",
        relationshipHistorySummary: "",
        vector: "[]",
        rawTranscript: "",
      },
    });
    const next = await getNextPromptForUser(prisma, match.id, userA.id);
    expect(next!.hint).toBeNull();
  });

  it("includes the counterpart's top value as a hint at level 2+", async () => {
    const { userA, userB, match } = await makeMatch();
    await prisma.user.update({ where: { id: userA.id }, data: { xp: 60 } }); // level 2+
    await prisma.preferenceProfile.create({
      data: {
        userId: userB.id,
        values: JSON.stringify(["adventure", "stability"]),
        dealbreakers: "[]",
        attachmentStyle: "secure",
        relationshipHistorySummary: "",
        vector: "[]",
        rawTranscript: "",
      },
    });
    const next = await getNextPromptForUser(prisma, match.id, userA.id);
    expect(next!.hint).toBe("They said they value: adventure");
  });
});

describe("respondToPrompt", () => {
  it("grants the responding user xp immediately", async () => {
    const { userA, match } = await makeMatch();
    const result = await respondToPrompt(prisma, match.id, 0, userA.id, "DIRECT");
    expect(result.xpGained).toBe(XP_FOR_STYLE.DIRECT);
    expect(result.newXp).toBe(XP_FOR_STYLE.DIRECT);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: userA.id } });
    expect(updated.xp).toBe(XP_FOR_STYLE.DIRECT);
  });

  it("does not resolve match trust until the counterparty also answers", async () => {
    const { userA, match } = await makeMatch();
    const result = await respondToPrompt(prisma, match.id, 0, userA.id, "DIRECT");
    expect(result.trustResolved).toBeNull();

    const updatedMatch = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
    expect(updatedMatch.trust).toBe(0);
  });

  it("resolves mutual trust once both sides have answered the same prompt", async () => {
    const { userA, userB, match } = await makeMatch();
    await respondToPrompt(prisma, match.id, 0, userA.id, "DIRECT");
    const result = await respondToPrompt(prisma, match.id, 0, userB.id, "GUARDED");

    const expectedDelta = trustDeltaForPair("DIRECT", "GUARDED");
    expect(result.trustResolved).not.toBeNull();
    expect(result.trustResolved!.delta).toBe(expectedDelta);
    expect(result.trustResolved!.newTrust).toBe(expectedDelta);

    const updatedMatch = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
    expect(updatedMatch.trust).toBe(expectedDelta);
  });

  it("is a no-op — not a re-grant — if the same user answers the same prompt twice", async () => {
    const { userA, match } = await makeMatch();
    const first = await respondToPrompt(prisma, match.id, 0, userA.id, "DIRECT");
    const second = await respondToPrompt(prisma, match.id, 0, userA.id, "DEFLECT");

    expect(second.xpGained).toBe(0);
    expect(second.newXp).toBe(first.newXp);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: userA.id } });
    expect(updated.xp).toBe(first.newXp);
  });

  it("rejects an invalid response style", async () => {
    const { userA, match } = await makeMatch();
    await expect(respondToPrompt(prisma, match.id, 0, userA.id, "HONEST")).rejects.toThrow(
      InvalidResponseStyleError,
    );
  });

  it("sets guaranteedAt exactly once trust crosses the threshold, and never unsets it", async () => {
    const { userA, userB, match } = await makeMatch();

    let promptIndex = 0;
    let matchState = match;
    while (matchState.trust < GUARANTEE_TRUST && promptIndex < PROMPT_POOL.length) {
      await respondToPrompt(prisma, match.id, promptIndex, userA.id, "DIRECT");
      const result = await respondToPrompt(prisma, match.id, promptIndex, userB.id, "DIRECT");
      matchState = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
      if (result.trustResolved?.justGuaranteed) break;
      promptIndex++;
    }

    expect(matchState.trust).toBeGreaterThanOrEqual(GUARANTEE_TRUST);
    expect(matchState.guaranteedAt).not.toBeNull();
    const guaranteedAtFirst = matchState.guaranteedAt;

    // Answering further prompts (if any remain) must not re-fire justGuaranteed
    // or move guaranteedAt.
    if (promptIndex + 1 < PROMPT_POOL.length) {
      await respondToPrompt(prisma, match.id, promptIndex + 1, userA.id, "DIRECT");
      const again = await respondToPrompt(prisma, match.id, promptIndex + 1, userB.id, "DIRECT");
      expect(again.trustResolved!.justGuaranteed).toBe(false);

      const stillSame = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
      expect(stillSame.guaranteedAt).toEqual(guaranteedAtFirst);
    }
  });

  it("never lets match trust drop below 0 or exceed 100", async () => {
    const { userA, userB, match } = await makeMatch();
    for (let i = 0; i < PROMPT_POOL.length; i++) {
      await respondToPrompt(prisma, match.id, i, userA.id, "DEFLECT");
      await respondToPrompt(prisma, match.id, i, userB.id, "DEFLECT");
    }
    const updatedMatch = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
    expect(updatedMatch.trust).toBeGreaterThanOrEqual(0);
    expect(updatedMatch.trust).toBeLessThanOrEqual(100);
  });
});
