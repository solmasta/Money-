import { describe, it, expect } from "vitest";
import { canChangeIntent, changeIntent, IntentLockedError, sameIntentPool } from "../src/domain/intent.js";

describe("intent lock", () => {
  it("allows changing intent when never locked", () => {
    expect(canChangeIntent(null, 30, new Date())).toBe(true);
  });

  it("blocks changing intent within the lock window", () => {
    const lockedAt = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-01-15T00:00:00Z"); // 14 days later
    expect(canChangeIntent(lockedAt, 30, now)).toBe(false);
    expect(() => changeIntent(lockedAt, 30, now)).toThrow(IntentLockedError);
  });

  it("allows changing intent once the lock window has elapsed", () => {
    const lockedAt = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-02-01T00:00:00Z"); // 31 days later
    expect(canChangeIntent(lockedAt, 30, now)).toBe(true);
  });
});

describe("sameIntentPool", () => {
  it("keeps different committed intents in separate pools", () => {
    expect(sameIntentPool("CASUAL", "MARRIAGE_MINDED")).toBe(false);
  });

  it("matches identical committed intents", () => {
    expect(sameIntentPool("LONG_TERM", "LONG_TERM")).toBe(true);
  });

  it("lets an UNSURE user cross into any pool", () => {
    expect(sameIntentPool("UNSURE", "MARRIAGE_MINDED")).toBe(true);
    expect(sameIntentPool("CASUAL", "UNSURE")).toBe(true);
  });
});
