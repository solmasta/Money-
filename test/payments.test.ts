import { describe, it, expect } from "vitest";
import { estimateMonthlyComputeCostCents, isUnitEconomicsSound } from "../src/domain/payments.js";

describe("unit economics guardrail", () => {
  const estimate = {
    sttCentsPerMinute: 1,
    ttsCentsPerMinute: 1.5,
    llmCentsPerInterview: 40,
    estimatedMinutesPerActiveUserPerMonth: 30,
  };

  it("computes monthly compute cost from voice + LLM components", () => {
    const cost = estimateMonthlyComputeCostCents(estimate);
    // (1 + 1.5) * 30 + 40 = 115
    expect(cost).toBeCloseTo(115);
  });

  it("flags the model as unsound when revenue doesn't clear 3x cost", () => {
    const result = isUnitEconomicsSound(200, estimate);
    expect(result.sound).toBe(false);
    expect(result.requiredRevenueCents).toBeCloseTo(345);
  });

  it("flags the model as sound once revenue clears 3x cost", () => {
    const result = isUnitEconomicsSound(1000, estimate);
    expect(result.sound).toBe(true);
  });
});
