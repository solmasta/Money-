import { describe, it, expect } from "vitest";
import {
  levelForXp,
  xpProgress,
  trustDeltaForPair,
  isValidResponseStyle,
  unlockedPerks,
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
  XP_FOR_STYLE,
  GUARANTEE_TRUST,
} from "../src/domain/leveling.js";

describe("levelForXp", () => {
  it("starts at level 1 with zero xp", () => {
    expect(levelForXp(0)).toBe(1);
  });

  it("advances at each threshold", () => {
    LEVEL_THRESHOLDS.forEach((threshold, i) => {
      expect(levelForXp(threshold)).toBe(i + 1);
    });
  });

  it("does not advance until the threshold is reached", () => {
    expect(levelForXp(LEVEL_THRESHOLDS[1] - 1)).toBe(1);
  });

  it("caps at MAX_LEVEL for very high xp", () => {
    expect(levelForXp(1_000_000)).toBe(MAX_LEVEL);
  });
});

describe("xpProgress", () => {
  it("reports zero progress at the very start", () => {
    const p = xpProgress(0);
    expect(p.level).toBe(1);
    expect(p.into).toBe(0);
  });

  it("reports progress partway into a level", () => {
    const p = xpProgress(LEVEL_THRESHOLDS[1] + 10);
    expect(p.level).toBe(2);
    expect(p.into).toBe(10);
    expect(p.span).toBe(LEVEL_THRESHOLDS[2] - LEVEL_THRESHOLDS[1]);
  });

  it("has zero span at max level", () => {
    const p = xpProgress(1_000_000);
    expect(p.level).toBe(MAX_LEVEL);
    expect(p.span).toBe(0);
  });
});

describe("trustDeltaForPair", () => {
  it("rewards mutual directness the most", () => {
    expect(trustDeltaForPair("DIRECT", "DIRECT")).toBeGreaterThan(trustDeltaForPair("GUARDED", "GUARDED"));
  });

  it("is symmetric regardless of argument order", () => {
    expect(trustDeltaForPair("DIRECT", "DEFLECT")).toBe(trustDeltaForPair("DEFLECT", "DIRECT"));
  });

  it("penalizes mutual deflection", () => {
    expect(trustDeltaForPair("DEFLECT", "DEFLECT")).toBeLessThan(0);
  });

  it("gives one-sided honesty some credit, but less than mutual honesty", () => {
    const oneSided = trustDeltaForPair("DIRECT", "DEFLECT");
    const mutual = trustDeltaForPair("DIRECT", "DIRECT");
    expect(oneSided).toBeGreaterThan(0);
    expect(oneSided).toBeLessThan(mutual);
  });
});

describe("isValidResponseStyle", () => {
  it("accepts the three real styles", () => {
    expect(isValidResponseStyle("DIRECT")).toBe(true);
    expect(isValidResponseStyle("GUARDED")).toBe(true);
    expect(isValidResponseStyle("DEFLECT")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidResponseStyle("HONEST")).toBe(false);
    expect(isValidResponseStyle("")).toBe(false);
  });
});

describe("XP_FOR_STYLE", () => {
  it("rewards directness more than guardedness, and guardedness more than deflection", () => {
    expect(XP_FOR_STYLE.DIRECT).toBeGreaterThan(XP_FOR_STYLE.GUARDED);
    expect(XP_FOR_STYLE.GUARDED).toBeGreaterThan(XP_FOR_STYLE.DEFLECT);
  });
});

describe("unlockedPerks", () => {
  it("returns only level-1 perks at level 1", () => {
    const perks = unlockedPerks(1);
    expect(perks.every((p) => p.level <= 1)).toBe(true);
    expect(perks.length).toBeGreaterThan(0);
  });

  it("returns more perks at a higher level", () => {
    expect(unlockedPerks(5).length).toBeGreaterThan(unlockedPerks(1).length);
  });
});

describe("GUARANTEE_TRUST", () => {
  it("is within the 0-100 trust range", () => {
    expect(GUARANTEE_TRUST).toBeGreaterThan(0);
    expect(GUARANTEE_TRUST).toBeLessThanOrEqual(100);
  });
});
