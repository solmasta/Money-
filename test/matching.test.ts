import { describe, it, expect } from "vitest";
import { scoreCandidatePair, findBestMatch, type CandidateProfile } from "../src/domain/matching.js";

function candidate(overrides: Partial<CandidateProfile> & { userId: string }): CandidateProfile {
  return {
    values: [],
    dealbreakers: [],
    vector: [1, 0, 0],
    intent: "LONG_TERM",
    ...overrides,
  };
}

describe("scoreCandidatePair", () => {
  it("vetoes a pair when one's dealbreaker is the other's stated value", () => {
    const a = candidate({ userId: "a", dealbreakers: ["smoking"], vector: [1, 0, 0] });
    const b = candidate({ userId: "b", values: ["smoking"], vector: [1, 0, 0] });

    const result = scoreCandidatePair(a, b);

    expect(result.isMatch).toBe(false);
    expect(result.compatibilityScore).toBe(0);
    expect(result.breakdown.dealbreakerViolations).toContain("smoking");
  });

  it("scores high for aligned vectors, shared values, and matching intent", () => {
    const a = candidate({ userId: "a", values: ["honesty", "family"], vector: [1, 0, 0] });
    const b = candidate({ userId: "b", values: ["honesty", "family"], vector: [1, 0, 0] });

    const result = scoreCandidatePair(a, b);

    expect(result.isMatch).toBe(true);
    expect(result.compatibilityScore).toBeGreaterThan(0.9);
  });

  it("does not veto on intent mismatch alone, only lowers score", () => {
    const a = candidate({ userId: "a", intent: "CASUAL", vector: [1, 0, 0] });
    const b = candidate({ userId: "b", intent: "MARRIAGE_MINDED", vector: [1, 0, 0] });

    const result = scoreCandidatePair(a, b);

    expect(result.breakdown.dealbreakerViolations).toHaveLength(0);
    expect(result.breakdown.intentAligned).toBe(false);
  });

  it("scores orthogonal vectors with no shared values below threshold", () => {
    const a = candidate({ userId: "a", vector: [1, 0, 0] });
    const b = candidate({ userId: "b", vector: [0, 1, 0] });

    const result = scoreCandidatePair(a, b);

    expect(result.isMatch).toBe(false);
  });
});

describe("findBestMatch", () => {
  it("returns only the single best match, never a list", () => {
    const self = candidate({ userId: "self", values: ["honesty"], vector: [1, 0, 0] });
    const okMatch = candidate({ userId: "ok", values: ["honesty"], vector: [0.9, 0.1, 0] });
    const greatMatch = candidate({ userId: "great", values: ["honesty"], vector: [1, 0, 0] });

    const result = findBestMatch(self, [okMatch, greatMatch]);

    expect(result?.userBId).toBe("great");
  });

  it("excludes candidates from a different locked intent pool", () => {
    const self = candidate({ userId: "self", intent: "MARRIAGE_MINDED", vector: [1, 0, 0] });
    const wrongPool = candidate({ userId: "wrong", intent: "CASUAL", vector: [1, 0, 0] });

    const result = findBestMatch(self, [wrongPool]);

    expect(result).toBeNull();
  });

  it("returns null when nothing in the pool clears the match threshold", () => {
    const self = candidate({ userId: "self", vector: [1, 0, 0] });
    const bad = candidate({ userId: "bad", vector: [-1, 0, 0] });

    expect(findBestMatch(self, [bad])).toBeNull();
  });
});
