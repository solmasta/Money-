import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { setupTestDatabase, type TestDatabase } from "./helpers/testDb.js";
import { canMarkNoShow, recordNoShow } from "../src/domain/noShow.js";
import { holdClosureDeposit, releaseClosureDepositOnSuccess } from "../src/domain/escrow.js";
import { findSilenceObligations } from "../src/domain/silenceEnforcement.js";
import { CLOSURE_SLA_HOURS } from "../src/domain/closure.js";

describe("canMarkNoShow (pure)", () => {
  const scheduledAt = new Date("2026-06-01T18:00:00Z");

  it("is eligible once SCHEDULED and the time has passed", () => {
    const now = new Date("2026-06-01T19:00:00Z");
    expect(canMarkNoShow("SCHEDULED", scheduledAt, now)).toBe(true);
  });

  it("is not eligible before the scheduled time", () => {
    const now = new Date("2026-06-01T17:00:00Z");
    expect(canMarkNoShow("SCHEDULED", scheduledAt, now)).toBe(false);
  });

  it("is not eligible once already cancelled", () => {
    const now = new Date("2026-06-01T19:00:00Z");
    expect(canMarkNoShow("CANCELLED", scheduledAt, now)).toBe(false);
  });

  it("is not eligible once already attended", () => {
    const now = new Date("2026-06-01T19:00:00Z");
    expect(canMarkNoShow("CONFIRMED_ATTENDED", scheduledAt, now)).toBe(false);
  });

  it("is not eligible once already marked NO_SHOW", () => {
    const now = new Date("2026-06-01T19:00:00Z");
    expect(canMarkNoShow("NO_SHOW", scheduledAt, now)).toBe(false);
  });
});

// The rest exercises recordNoShow and its interplay with other escrow
// resolution paths against a real, isolated Postgres schema.

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

async function makeMatchWithScheduledDate(scheduledAt: Date) {
  const userA = await prisma.user.create({ data: { email: `a-${Date.now()}-${Math.random()}@t.com`, displayName: "A" } });
  const userB = await prisma.user.create({ data: { email: `b-${Date.now()}-${Math.random()}@t.com`, displayName: "B" } });
  const match = await prisma.match.create({
    data: { userAId: userA.id, userBId: userB.id, compatibilityScore: 0.9, scoreBreakdown: "{}", status: "DATE_SCHEDULED" },
  });
  const dateProposal = await prisma.dateProposal.create({
    data: { matchId: match.id, scheduledAt, status: "SCHEDULED" },
  });
  return { userA, userB, match, dateProposal };
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

describe("recordNoShow", () => {
  it("transitions the date to NO_SHOW and records who and when", async () => {
    const { userA, userB, match, dateProposal } = await makeMatchWithScheduledDate(hoursAgo(1));
    await holdClosureDeposit(prisma, userA.id, match.id);

    const now = new Date();
    await recordNoShow(prisma, dateProposal.id, match.id, userA.id, userB.id, now);

    const updated = await prisma.dateProposal.findUniqueOrThrow({ where: { id: dateProposal.id } });
    expect(updated.status).toBe("NO_SHOW");
    expect(updated.noShowUserId).toBe(userA.id);
    expect(updated.noShowReportedAt).toEqual(now);
  });

  it("forfeits the no-show user's deposit to the counterparty", async () => {
    const { userA, userB, match, dateProposal } = await makeMatchWithScheduledDate(hoursAgo(1));
    await holdClosureDeposit(prisma, userA.id, match.id);

    await recordNoShow(prisma, dateProposal.id, match.id, userA.id, userB.id);

    const entries = await prisma.escrowLedgerEntry.findMany({ where: { matchId: match.id } });
    expect(entries.find((e) => e.userId === userA.id && e.reason === "no_show_forfeit")?.amountCents).toBe(-750);
    expect(entries.find((e) => e.userId === userB.id && e.reason === "no_show_forfeit_credit")?.amountCents).toBe(750);
  });

  it("dents accountability score more than a cancellation suspension does", async () => {
    const { userA, userB, match, dateProposal } = await makeMatchWithScheduledDate(hoursAgo(1));
    await holdClosureDeposit(prisma, userA.id, match.id);

    const result = await recordNoShow(prisma, dateProposal.id, match.id, userA.id, userB.id);

    expect(result.newAccountabilityScore).toBe(70); // 100 - 30
    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: userA.id } });
    expect(updatedUser.accountabilityScore).toBe(70);
  });

  it("is a no-op on the escrow side for a user who never had a deposit held", async () => {
    const { userA, userB, match, dateProposal } = await makeMatchWithScheduledDate(hoursAgo(1));
    // no holdClosureDeposit call

    await recordNoShow(prisma, dateProposal.id, match.id, userA.id, userB.id);

    const entries = await prisma.escrowLedgerEntry.findMany({ where: { matchId: match.id } });
    expect(entries).toHaveLength(0);
  });
});

describe("terminal-reasons interplay", () => {
  it("a no-show forfeit stops a later success report from also releasing that deposit", async () => {
    const { userA, userB, match, dateProposal } = await makeMatchWithScheduledDate(hoursAgo(1));
    await holdClosureDeposit(prisma, userA.id, match.id);
    await recordNoShow(prisma, dateProposal.id, match.id, userA.id, userB.id);

    const releaseResult = await releaseClosureDepositOnSuccess(prisma, userA.id, match.id);
    expect(releaseResult).toBeNull();

    const reasons = (
      await prisma.escrowLedgerEntry.findMany({ where: { userId: userA.id, matchId: match.id } })
    ).map((e) => e.reason);
    expect(reasons).toContain("no_show_forfeit");
    expect(reasons).not.toContain("closure_deposit_released_success");
  });

  it("a second no-show report on an independent date in the same match does not double-forfeit", async () => {
    const { userA, userB, match, dateProposal } = await makeMatchWithScheduledDate(hoursAgo(2));
    await holdClosureDeposit(prisma, userA.id, match.id);
    await recordNoShow(prisma, dateProposal.id, match.id, userA.id, userB.id);

    // A second date under the same match, also missed by the same user.
    const secondDate = await prisma.dateProposal.create({
      data: { matchId: match.id, scheduledAt: hoursAgo(1), status: "SCHEDULED" },
    });
    await recordNoShow(prisma, secondDate.id, match.id, userA.id, userB.id);

    const forfeits = await prisma.escrowLedgerEntry.findMany({
      where: { userId: userA.id, matchId: match.id, reason: "no_show_forfeit" },
    });
    expect(forfeits).toHaveLength(1); // the second call found the deposit already resolved

    // but the score penalty is charged per no-show event, not deduped —
    // standing someone up twice is worse than once, even off one deposit.
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userA.id } });
    expect(user.accountabilityScore).toBe(40); // 100 - 30 - 30
  });

  it("regression: findSilenceObligations does not re-forfeit a deposit already forfeited via no-show", async () => {
    // First date: no-show, forfeits the deposit.
    const { userA, userB, match, dateProposal } = await makeMatchWithScheduledDate(hoursAgo(1));
    await holdClosureDeposit(prisma, userA.id, match.id);
    await recordNoShow(prisma, dateProposal.id, match.id, userA.id, userB.id);

    // A later, independent date under the same match gets attended, and
    // its closure SLA lapses with nobody filing a ClosureEvent.
    await prisma.match.update({ where: { id: match.id }, data: { status: "DATE_COMPLETED" } });
    await prisma.dateProposal.create({
      data: {
        matchId: match.id,
        scheduledAt: hoursAgo(CLOSURE_SLA_HOURS + 2),
        status: "CONFIRMED_ATTENDED",
        attendedAt: hoursAgo(CLOSURE_SLA_HOURS + 1),
      },
    });

    const obligations = await findSilenceObligations(prisma);
    expect(obligations.find((o) => o.userId === userA.id)).toBeUndefined();
  });
});
