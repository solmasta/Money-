import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { setupTestDatabase, type TestDatabase } from "./helpers/testDb.js";
import {
  holdClosureDeposit,
  resolveClosureDeposit,
  releaseClosureDepositOnSuccess,
} from "../src/domain/escrow.js";
import { CLOSURE_DEPOSIT_CENTS } from "../src/domain/closure.js";

// Exercises escrow resolution against a real, isolated Postgres schema —
// it's ledger bookkeeping across rows, not meaningfully a pure function.

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
    data: { userAId: userA.id, userBId: userB.id, compatibilityScore: 0.9, scoreBreakdown: "{}", status: "DATE_COMPLETED" },
  });
  return { userA, userB, match };
}

describe("resolveClosureDeposit", () => {
  it("is a no-op for a user who never had a deposit held", async () => {
    const { userA, userB, match } = await makeMatch();
    const result = await resolveClosureDeposit(prisma, userA.id, userB.id, match.id, true);
    expect(result).toBeNull();

    const entries = await prisma.escrowLedgerEntry.findMany({ where: { userId: userA.id, matchId: match.id } });
    expect(entries).toHaveLength(0);
  });

  it("does not re-resolve a deposit already released on time when called again", async () => {
    const { userA, userB, match } = await makeMatch();
    await holdClosureDeposit(prisma, userA.id, match.id);

    const first = await resolveClosureDeposit(prisma, userA.id, userB.id, match.id, true);
    const second = await resolveClosureDeposit(prisma, userA.id, userB.id, match.id, true);

    expect(first).not.toBeNull();
    expect(second).toBeNull();

    const releases = await prisma.escrowLedgerEntry.findMany({
      where: { userId: userA.id, matchId: match.id, reason: "closure_deposit_released" },
    });
    expect(releases).toHaveLength(1);
  });

  it("does not forfeit a deposit that was already released on time (a late call losing a race)", async () => {
    const { userA, userB, match } = await makeMatch();
    await holdClosureDeposit(prisma, userA.id, match.id);
    await resolveClosureDeposit(prisma, userA.id, userB.id, match.id, true); // filed on time first

    const result = await resolveClosureDeposit(prisma, userA.id, userB.id, match.id, false); // a stale "late" resolution arrives after
    expect(result).toBeNull();

    const reasons = (
      await prisma.escrowLedgerEntry.findMany({ where: { userId: userA.id, matchId: match.id } })
    ).map((e) => e.reason);
    expect(reasons).not.toContain("closure_forfeit");
  });

  it("does not release a deposit already forfeited via a no-show", async () => {
    const { userA, userB, match } = await makeMatch();
    await holdClosureDeposit(prisma, userA.id, match.id);
    await prisma.escrowLedgerEntry.create({
      data: { userId: userA.id, matchId: match.id, amountCents: -CLOSURE_DEPOSIT_CENTS, reason: "no_show_forfeit" },
    });

    const result = await resolveClosureDeposit(prisma, userA.id, userB.id, match.id, true);
    expect(result).toBeNull();
  });
});

describe("releaseClosureDepositOnSuccess", () => {
  it("releases a held deposit back to the user", async () => {
    const { userA, match } = await makeMatch();
    await holdClosureDeposit(prisma, userA.id, match.id);

    const result = await releaseClosureDepositOnSuccess(prisma, userA.id, match.id);

    expect(result).not.toBeNull();
    expect(result!.amountCents).toBe(CLOSURE_DEPOSIT_CENTS);
    expect(result!.reason).toBe("closure_deposit_released_success");

    const entries = await prisma.escrowLedgerEntry.findMany({ where: { userId: userA.id, matchId: match.id } });
    expect(entries.map((e) => e.reason).sort()).toEqual(["closure_deposit_held", "closure_deposit_released_success"]);
  });

  it("is a no-op for a user who never had a deposit held", async () => {
    const { userA, match } = await makeMatch();
    const result = await releaseClosureDepositOnSuccess(prisma, userA.id, match.id);
    expect(result).toBeNull();

    const entries = await prisma.escrowLedgerEntry.findMany({ where: { userId: userA.id, matchId: match.id } });
    expect(entries).toHaveLength(0);
  });

  it("is idempotent — calling it twice only releases once", async () => {
    const { userA, match } = await makeMatch();
    await holdClosureDeposit(prisma, userA.id, match.id);

    const first = await releaseClosureDepositOnSuccess(prisma, userA.id, match.id);
    const second = await releaseClosureDepositOnSuccess(prisma, userA.id, match.id);

    expect(first).not.toBeNull();
    expect(second).toBeNull();

    const releases = await prisma.escrowLedgerEntry.findMany({
      where: { userId: userA.id, matchId: match.id, reason: "closure_deposit_released_success" },
    });
    expect(releases).toHaveLength(1);
  });

  it("does not release a deposit that was already forfeited via silence enforcement", async () => {
    const { userA, userB, match } = await makeMatch();
    await holdClosureDeposit(prisma, userA.id, match.id);
    await resolveClosureDeposit(prisma, userA.id, userB.id, match.id, false); // silent -> forfeit

    const result = await releaseClosureDepositOnSuccess(prisma, userA.id, match.id);
    expect(result).toBeNull();

    // the forfeit stands — no spurious release on top of it
    const reasons = (
      await prisma.escrowLedgerEntry.findMany({ where: { userId: userA.id, matchId: match.id } })
    ).map((e) => e.reason);
    expect(reasons).toContain("closure_forfeit");
    expect(reasons).not.toContain("closure_deposit_released_success");
  });

  it("does not double-release a deposit already released by an on-time closure filing", async () => {
    const { userA, userB, match } = await makeMatch();
    await holdClosureDeposit(prisma, userA.id, match.id);
    await resolveClosureDeposit(prisma, userA.id, userB.id, match.id, true); // filed on time -> released

    const result = await releaseClosureDepositOnSuccess(prisma, userA.id, match.id);
    expect(result).toBeNull();

    const releases = await prisma.escrowLedgerEntry.findMany({
      where: { userId: userA.id, matchId: match.id, reason: { in: ["closure_deposit_released", "closure_deposit_released_success"] } },
    });
    expect(releases).toHaveLength(1);
  });

  it("resolves both sides of a match independently", async () => {
    const { userA, userB, match } = await makeMatch();
    await holdClosureDeposit(prisma, userA.id, match.id);
    // userB never approved — no deposit held for them.

    const [resultA, resultB] = await Promise.all([
      releaseClosureDepositOnSuccess(prisma, userA.id, match.id),
      releaseClosureDepositOnSuccess(prisma, userB.id, match.id),
    ]);

    expect(resultA).not.toBeNull();
    expect(resultB).toBeNull();
  });
});
