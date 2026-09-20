import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { runEnforceSilenceSweep, findSilenceObligations } from "../src/domain/silenceEnforcement.js";
import { CLOSURE_SLA_HOURS, CLOSURE_DEPOSIT_CENTS } from "../src/domain/closure.js";

// Exercises the sweep against a real (temporary) SQLite database, since its
// logic is a cross-table query that isn't meaningfully testable as pure
// functions the way the rest of src/domain is.

let dir: string;
let dbUrl: string;
let prisma: PrismaClient;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "closure-test-"));
  dbUrl = `file:${path.join(dir, "test.db")}`;
  execSync("npx prisma db push --skip-generate", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "pipe",
  });
  prisma = new PrismaClient({ datasourceUrl: dbUrl });
});

afterAll(async () => {
  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
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

async function makeMatchWithAttendedDate(attendedAt: Date) {
  const userA = await prisma.user.create({ data: { email: `a-${Date.now()}@t.com`, displayName: "A" } });
  const userB = await prisma.user.create({ data: { email: `b-${Date.now()}@t.com`, displayName: "B" } });
  const match = await prisma.match.create({
    data: {
      userAId: userA.id,
      userBId: userB.id,
      compatibilityScore: 0.9,
      scoreBreakdown: "{}",
      status: "DATE_COMPLETED",
    },
  });
  await prisma.escrowLedgerEntry.create({
    data: { userId: userA.id, matchId: match.id, amountCents: CLOSURE_DEPOSIT_CENTS, reason: "closure_deposit_held" },
  });
  await prisma.escrowLedgerEntry.create({
    data: { userId: userB.id, matchId: match.id, amountCents: CLOSURE_DEPOSIT_CENTS, reason: "closure_deposit_held" },
  });
  await prisma.dateProposal.create({
    data: { matchId: match.id, scheduledAt: attendedAt, status: "CONFIRMED_ATTENDED", attendedAt },
  });
  return { userA, userB, match };
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

describe("findSilenceObligations", () => {
  it("finds nobody before the SLA has elapsed", async () => {
    await makeMatchWithAttendedDate(hoursAgo(CLOSURE_SLA_HOURS - 1));
    expect(await findSilenceObligations(prisma)).toHaveLength(0);
  });

  it("finds both sides once the SLA has elapsed with no closure filed", async () => {
    const { userA, userB, match } = await makeMatchWithAttendedDate(hoursAgo(CLOSURE_SLA_HOURS + 1));
    const obligations = await findSilenceObligations(prisma);
    expect(obligations).toHaveLength(2);
    expect(obligations.map((o) => o.userId).sort()).toEqual([userA.id, userB.id].sort());
    expect(obligations.every((o) => o.matchId === match.id)).toBe(true);
  });

  it("excludes a user who already filed a ClosureEvent", async () => {
    const { userA, userB, match } = await makeMatchWithAttendedDate(hoursAgo(CLOSURE_SLA_HOURS + 1));
    await prisma.closureEvent.create({
      data: {
        matchId: match.id,
        senderId: userA.id,
        recipientId: userB.id,
        reasonCategory: "LACK_OF_CHEMISTRY",
        deliveredAt: new Date(),
      },
    });

    const obligations = await findSilenceObligations(prisma);
    expect(obligations).toHaveLength(1);
    expect(obligations[0].userId).toBe(userB.id);
  });

  it("excludes matches that are already CLOSED", async () => {
    const { match } = await makeMatchWithAttendedDate(hoursAgo(CLOSURE_SLA_HOURS + 1));
    await prisma.match.update({ where: { id: match.id }, data: { status: "CLOSED" } });
    expect(await findSilenceObligations(prisma)).toHaveLength(0);
  });
});

describe("runEnforceSilenceSweep", () => {
  it("forfeits escrow, dents accountability score, and closes the match for a silent user", async () => {
    const { userA, userB, match } = await makeMatchWithAttendedDate(hoursAgo(CLOSURE_SLA_HOURS + 1));

    const results = await runEnforceSilenceSweep(prisma);
    expect(results).toHaveLength(2);

    const updatedA = await prisma.user.findUniqueOrThrow({ where: { id: userA.id } });
    const updatedB = await prisma.user.findUniqueOrThrow({ where: { id: userB.id } });
    expect(updatedA.accountabilityScore).toBeLessThan(100);
    expect(updatedB.accountabilityScore).toBeLessThan(100);

    const forfeits = await prisma.escrowLedgerEntry.findMany({ where: { matchId: match.id, reason: "closure_forfeit" } });
    expect(forfeits).toHaveLength(2);

    const updatedMatch = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
    expect(updatedMatch.status).toBe("CLOSED");
  });

  it("is idempotent — a second sweep does not re-enforce", async () => {
    await makeMatchWithAttendedDate(hoursAgo(CLOSURE_SLA_HOURS + 1));

    const first = await runEnforceSilenceSweep(prisma);
    const second = await runEnforceSilenceSweep(prisma);

    expect(first).toHaveLength(2);
    expect(second).toHaveLength(0);
  });

  it("only enforces the silent side when the other already filed closure", async () => {
    const { userA, userB, match } = await makeMatchWithAttendedDate(hoursAgo(CLOSURE_SLA_HOURS + 1));
    await prisma.closureEvent.create({
      data: {
        matchId: match.id,
        senderId: userA.id,
        recipientId: userB.id,
        reasonCategory: "LACK_OF_CHEMISTRY",
        deliveredAt: new Date(),
      },
    });

    const results = await runEnforceSilenceSweep(prisma);
    expect(results).toHaveLength(1);
    expect(results[0].userId).toBe(userB.id);

    const updatedA = await prisma.user.findUniqueOrThrow({ where: { id: userA.id } });
    expect(updatedA.accountabilityScore).toBe(100); // untouched — they filed on time
  });
});
