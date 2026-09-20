import { describe, it, expect } from "vitest";
import {
  fileClosure,
  InvalidClosureReasonError,
  isValidClosureReason,
  resolveEscrow,
  applySilenceForfeit,
  applyClosureFiledOnTime,
  isWithinClosureSla,
  CLOSURE_DEPOSIT_CENTS,
  CLOSURE_SLA_HOURS,
} from "../src/domain/closure.js";

describe("fileClosure", () => {
  it("accepts a valid taxonomy reason", () => {
    const result = fileClosure({ reasonCategory: "LACK_OF_CHEMISTRY", isAnonymous: false });
    expect(result.accepted).toBe(true);
    expect(result.escrowReleaseAmountCents).toBe(CLOSURE_DEPOSIT_CENTS);
  });

  it("throws rather than silently accepting an invalid reason — silence is never an option", () => {
    expect(() =>
      fileClosure({ reasonCategory: "GHOSTED_ON_PURPOSE" as any, isAnonymous: false }),
    ).toThrow(InvalidClosureReasonError);
  });

  it("throws on a missing reason", () => {
    expect(() => fileClosure({ reasonCategory: undefined as any, isAnonymous: false })).toThrow();
  });
});

describe("isValidClosureReason", () => {
  it("rejects free text not in the taxonomy", () => {
    expect(isValidClosureReason("just not feeling it")).toBe(false);
  });

  it("accepts every documented taxonomy value", () => {
    expect(isValidClosureReason("OTHER")).toBe(true);
    expect(isValidClosureReason("VALUES_MISMATCH")).toBe(true);
  });
});

describe("resolveEscrow", () => {
  it("returns the deposit to a filer who closed on time", () => {
    const outcome = resolveEscrow(true);
    expect(outcome.filerAmountCents).toBe(CLOSURE_DEPOSIT_CENTS);
    expect(outcome.counterpartyCreditCents).toBe(0);
  });

  it("forfeits the deposit to the counterparty on silence", () => {
    const outcome = resolveEscrow(false);
    expect(outcome.filerAmountCents).toBe(0);
    expect(outcome.counterpartyCreditCents).toBe(CLOSURE_DEPOSIT_CENTS);
  });
});

describe("accountability score adjustments", () => {
  it("does not penalize filing closure on time", () => {
    expect(applyClosureFiledOnTime(100).delta).toBe(0);
  });

  it("penalizes silence", () => {
    const adjustment = applySilenceForfeit(100);
    expect(adjustment.delta).toBeLessThan(0);
    expect(adjustment.newScore).toBeLessThan(100);
  });

  it("never drops accountability score below zero", () => {
    const adjustment = applySilenceForfeit(5);
    expect(adjustment.newScore).toBeGreaterThanOrEqual(0);
  });
});

describe("isWithinClosureSla", () => {
  const start = new Date("2026-01-01T00:00:00Z");

  it("is within SLA when filed before the deadline", () => {
    const filedAt = new Date(start.getTime() + (CLOSURE_SLA_HOURS - 1) * 60 * 60 * 1000);
    expect(isWithinClosureSla(start, filedAt, filedAt)).toBe(true);
  });

  it("is outside SLA when filed after the deadline", () => {
    const filedAt = new Date(start.getTime() + (CLOSURE_SLA_HOURS + 1) * 60 * 60 * 1000);
    expect(isWithinClosureSla(start, filedAt, filedAt)).toBe(false);
  });

  it("treats never-filed as outside SLA once the deadline has passed", () => {
    const now = new Date(start.getTime() + (CLOSURE_SLA_HOURS + 1) * 60 * 60 * 1000);
    expect(isWithinClosureSla(start, undefined, now)).toBe(false);
  });
});
