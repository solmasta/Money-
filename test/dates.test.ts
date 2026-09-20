import { describe, it, expect } from "vitest";
import {
  cancellationConsequence,
  cancellationWindowStart,
  isLateCancellation,
  CANCELLATION_WINDOW_DAYS,
} from "../src/domain/dates.js";

describe("cancellationConsequence", () => {
  it("is free for the first cancellation", () => {
    expect(cancellationConsequence(0)).toEqual({ tier: "FREE", feeCents: 0 });
  });

  it("charges a fee for the second and third cancellations", () => {
    expect(cancellationConsequence(1).tier).toBe("FEE");
    expect(cancellationConsequence(2).tier).toBe("FEE");
  });

  it("suspends from the fourth cancellation onward", () => {
    expect(cancellationConsequence(3).tier).toBe("SUSPENSION");
    expect(cancellationConsequence(10).tier).toBe("SUSPENSION");
  });
});

describe("cancellationWindowStart", () => {
  it("defaults to CANCELLATION_WINDOW_DAYS before now", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const expected = new Date(now.getTime() - CANCELLATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    expect(cancellationWindowStart(now)).toEqual(expected);
  });

  it("respects a custom window length", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const expected = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(cancellationWindowStart(now, 30)).toEqual(expected);
  });
});

describe("isLateCancellation", () => {
  it("flags a cancellation less than 2 hours before the date as late", () => {
    const scheduledAt = new Date("2026-01-01T18:00:00Z");
    const cancelledAt = new Date("2026-01-01T17:00:00Z");
    expect(isLateCancellation(scheduledAt, cancelledAt)).toBe(true);
  });

  it("does not flag an early cancellation as late", () => {
    const scheduledAt = new Date("2026-01-05T18:00:00Z");
    const cancelledAt = new Date("2026-01-01T18:00:00Z");
    expect(isLateCancellation(scheduledAt, cancelledAt)).toBe(false);
  });
});
