import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { countCancellationsInWindow, CANCELLATION_WINDOW_DAYS } from "../src/domain/dates.js";
import {
  applyCancellationSuspensionPenalty,
  findExpiredAccountabilityPenalties,
  runAccountabilityResetSweep,
} from "../src/domain/accountabilityReset.js";

// Exercises the windowed cancellation count and the penalty-reset sweep
// against a real (temporary) SQLite database — both are cross-row queries
// that aren't meaningfully testable as pure functions.

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
    prisma.accountabilityLedgerEntry.deleteMany(),
    prisma.escrowLedgerEntry.deleteMany(),
    prisma.closureEvent.deleteMany(),
    prisma.dateProposal.deleteMany(),
    prisma.match.deleteMany(),
    prisma.preferenceProfile.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
const daysAgo = (d: number) => hoursAgo(d * 24);

async function makeUserWithMatch() {
  const user = await prisma.user.create({ data: { email: `u-${Date.now()}-${Math.random()}@t.com`, displayName: "U" } });
  const other = await prisma.user.create({ data: { email: `o-${Date.now()}-${Math.random()}@t.com`, displayName: "O" } });
  const match = await prisma.match.create({
    data: { userAId: user.id, userBId: other.id, compatibilityScore: 0.9, scoreBreakdown: "{}", status: "DATE_SCHEDULED" },
  });
  return { user, other, match };
}

async function makeCancelledDateProposal(matchId: string, cancelledByUserId: string, cancelledAt: Date) {
  return prisma.dateProposal.create({
    data: {
      matchId,
      scheduledAt: cancelledAt,
      status: "CANCELLED",
      cancelledByUserId,
      cancelledAt,
    },
  });
}

describe("countCancellationsInWindow", () => {
  it("counts a recent cancellation", async () => {
    const { user, match } = await makeUserWithMatch();
    await makeCancelledDateProposal(match.id, user.id, hoursAgo(1));
    expect(await countCancellationsInWindow(prisma, user.id)).toBe(1);
  });

  it("ignores a cancellation older than the window", async () => {
    const { user, match } = await makeUserWithMatch();
    await makeCancelledDateProposal(match.id, user.id, daysAgo(CANCELLATION_WINDOW_DAYS + 1));
    expect(await countCancellationsInWindow(prisma, user.id)).toBe(0);
  });

  it("counts a cancellation right at the edge of the window as still in it", async () => {
    const { user, match } = await makeUserWithMatch();
    await makeCancelledDateProposal(match.id, user.id, daysAgo(CANCELLATION_WINDOW_DAYS - 1));
    expect(await countCancellationsInWindow(prisma, user.id)).toBe(1);
  });

  it("doesn't count another user's cancellations", async () => {
    const { user, other, match } = await makeUserWithMatch();
    await makeCancelledDateProposal(match.id, other.id, hoursAgo(1));
    expect(await countCancellationsInWindow(prisma, user.id)).toBe(0);
  });
});

describe("applyCancellationSuspensionPenalty", () => {
  it("dents the score and records an expiring ledger entry", async () => {
    const { user, match } = await makeUserWithMatch();
    const proposal = await makeCancelledDateProposal(match.id, user.id, new Date());

    const now = new Date();
    const { newScore } = await applyCancellationSuspensionPenalty(prisma, user.id, proposal.id, now);

    expect(newScore).toBe(75);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.accountabilityScore).toBe(75);

    const entries = await prisma.accountabilityLedgerEntry.findMany({ where: { userId: user.id } });
    expect(entries).toHaveLength(1);
    expect(entries[0].delta).toBe(-25);
    expect(entries[0].reversedAt).toBeNull();
    expect(entries[0].expiresAt!.getTime()).toBeGreaterThan(now.getTime());
  });

  it("floors the score at zero for repeated penalties", async () => {
    const { user, match } = await makeUserWithMatch();
    await prisma.user.update({ where: { id: user.id }, data: { accountabilityScore: 10 } });
    const proposal = await makeCancelledDateProposal(match.id, user.id, new Date());

    const { newScore } = await applyCancellationSuspensionPenalty(prisma, user.id, proposal.id);
    expect(newScore).toBe(0);
  });
});

describe("findExpiredAccountabilityPenalties / runAccountabilityResetSweep", () => {
  it("finds nothing before the window elapses", async () => {
    const { user, match } = await makeUserWithMatch();
    const proposal = await makeCancelledDateProposal(match.id, user.id, new Date());
    await applyCancellationSuspensionPenalty(prisma, user.id, proposal.id, new Date());

    expect(await findExpiredAccountabilityPenalties(prisma)).toHaveLength(0);
  });

  it("reverses an expired penalty, crediting the score back", async () => {
    const { user, match } = await makeUserWithMatch();
    const proposal = await makeCancelledDateProposal(match.id, user.id, daysAgo(CANCELLATION_WINDOW_DAYS + 1));
    await applyCancellationSuspensionPenalty(prisma, user.id, proposal.id, daysAgo(CANCELLATION_WINDOW_DAYS + 1));

    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(before.accountabilityScore).toBe(75);

    const results = await runAccountabilityResetSweep(prisma);
    expect(results).toHaveLength(1);
    expect(results[0].userId).toBe(user.id);
    expect(results[0].newAccountabilityScore).toBe(100);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.accountabilityScore).toBe(100);
  });

  it("is idempotent — a second sweep does not double-credit", async () => {
    const { user, match } = await makeUserWithMatch();
    const proposal = await makeCancelledDateProposal(match.id, user.id, daysAgo(CANCELLATION_WINDOW_DAYS + 1));
    await applyCancellationSuspensionPenalty(prisma, user.id, proposal.id, daysAgo(CANCELLATION_WINDOW_DAYS + 1));

    const first = await runAccountabilityResetSweep(prisma);
    const second = await runAccountabilityResetSweep(prisma);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.accountabilityScore).toBe(100);
  });

  it("never credits above the ceiling even if other score movement happened since", async () => {
    const { user, match } = await makeUserWithMatch();
    const proposal = await makeCancelledDateProposal(match.id, user.id, daysAgo(CANCELLATION_WINDOW_DAYS + 1));
    await applyCancellationSuspensionPenalty(prisma, user.id, proposal.id, daysAgo(CANCELLATION_WINDOW_DAYS + 1));
    // Score somehow already recovered above what a plain +25 credit would produce.
    await prisma.user.update({ where: { id: user.id }, data: { accountabilityScore: 95 } });

    const results = await runAccountabilityResetSweep(prisma);
    expect(results[0].newAccountabilityScore).toBe(100);
  });
});
