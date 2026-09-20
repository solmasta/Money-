// Pricing per spec section 5 (Revenue) and the unit economics rule in
// section 5's closing note: price at 3x margin over STT + LLM + TTS cost.

export const PAY_PER_DATE_CENTS = 1750; // midpoint of the $15-20 band
export const SUCCESS_FEE_CENTS = 7500; // midpoint of the $50-100 band
export const CONCIERGE_MONTHLY_CENTS = 15000; // midpoint of the $100-200 band

export interface ComputeCostEstimate {
  sttCentsPerMinute: number;
  llmCentsPerInterview: number;
  ttsCentsPerMinute: number;
  estimatedMinutesPerActiveUserPerMonth: number;
}

const TARGET_MARGIN_MULTIPLE = 3;

/** Returns the estimated monthly compute cost per active user, in cents. */
export function estimateMonthlyComputeCostCents(estimate: ComputeCostEstimate): number {
  const { sttCentsPerMinute, llmCentsPerInterview, ttsCentsPerMinute, estimatedMinutesPerActiveUserPerMonth } =
    estimate;
  const voiceCost = (sttCentsPerMinute + ttsCentsPerMinute) * estimatedMinutesPerActiveUserPerMonth;
  return voiceCost + llmCentsPerInterview;
}

/**
 * The unit-economics guardrail from the spec: "If LTV < compute cost, the
 * model is broken." This checks whether a given monthly revenue-per-user
 * clears 3x the estimated compute cost.
 */
export function isUnitEconomicsSound(
  monthlyRevenuePerUserCents: number,
  estimate: ComputeCostEstimate,
): { sound: boolean; requiredRevenueCents: number; estimatedCostCents: number } {
  const estimatedCostCents = estimateMonthlyComputeCostCents(estimate);
  const requiredRevenueCents = estimatedCostCents * TARGET_MARGIN_MULTIPLE;
  return {
    sound: monthlyRevenuePerUserCents >= requiredRevenueCents,
    requiredRevenueCents,
    estimatedCostCents,
  };
}
