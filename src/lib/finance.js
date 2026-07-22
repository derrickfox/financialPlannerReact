// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Shared numeric helpers (coercion, clamping, rate conversion) used by the
//          rent-vs-buy and retirement projection models.
// Reason: These helpers were duplicated inside App.jsx, which imports React and therefore
//         could not be exercised by `node --test`. Extracting them lets the projection
//         models live in plain modules that the test suite can import directly.

export function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Converts an annual percentage rate into the equivalent geometric monthly rate,
 * i.e. the monthly rate r where (1 + r)^12 == 1 + annual.
 */
export function annualToMonthlyRate(ratePct) {
  const boundedRate = clamp(asNumber(ratePct, 0), -99, 1000) / 100;
  return Math.pow(1 + boundedRate, 1 / 12) - 1;
}

export function annualRateMultiplier(ratePct) {
  return 1 + asNumber(ratePct, 0) / 100;
}
