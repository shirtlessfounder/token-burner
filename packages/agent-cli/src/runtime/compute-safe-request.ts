const maxOutputTokensPerCall = 4_096;
const inputOverheadEstimate = 64;
const safetyMargin = 32;

export type SafeRequestDecision =
  | { kind: "request"; maxOutputTokens: number }
  | { kind: "stop"; reason: string };

export const computeSafeRequest = (
  remainingBudget: number,
): SafeRequestDecision => {
  const usableBudget =
    remainingBudget - inputOverheadEstimate - safetyMargin;

  if (usableBudget <= 0) {
    return { kind: "stop", reason: "remaining budget below input overhead" };
  }

  const maxOutputTokens = Math.min(usableBudget, maxOutputTokensPerCall);

  if (maxOutputTokens < 64) {
    return { kind: "stop", reason: "remaining budget below minimum step" };
  }

  return { kind: "request", maxOutputTokens };
};
