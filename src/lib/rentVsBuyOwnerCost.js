function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function getMortgagePayment(principal, annualRatePct, termYears) {
  const months = Math.max(Math.round(termYears * 12), 1);
  const monthlyRate = asNumber(annualRatePct, 0) / 100 / 12;

  if (principal <= 0) return 0;
  if (monthlyRate === 0) return principal / months;

  return (
    (principal * monthlyRate) /
    (1 - Math.pow(1 + monthlyRate, -months))
  );
}

// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Private mortgage insurance — charged while the loan balance exceeds 80% of the
//          original purchase price, which is when a borrower may request cancellation under
//          the Homeowners Protection Act.
// Reason: The Down Payment tooltip told users that putting 20% down avoids PMI, but the model
//         never charged it, so every scenario below 20% down understated the cost of buying
//         while appearing to account for it. Basing cancellation on the original price rather
//         than the appreciated value matches how lenders actually drop it.
export const PMI_CANCELLATION_LTV = 0.8;

export function getMonthlyPmi({ loanBalance, homePrice, pmiRatePct, originalLoanAmount }) {
  if (homePrice <= 0 || loanBalance <= 0) return 0;
  if (loanBalance <= homePrice * PMI_CANCELLATION_LTV) return 0;

  const rate = Math.max(asNumber(pmiRatePct, 0), 0) / 100;
  return (originalLoanAmount * rate) / 12;
}

export function computeMonthlyOwnerCostBreakdown(inputs) {
  const homePrice = Math.max(asNumber(inputs.homePrice, 0), 0);
  const downPaymentRate = clamp(asNumber(inputs.downPaymentPct, 0), 0, 100) / 100;
  const mortgageRatePct = Math.max(asNumber(inputs.mortgageRatePct, 0), 0);
  const loanTermYears = clamp(Math.round(asNumber(inputs.loanTermYears, 30)), 1, 40);
  const propertyTaxRate = Math.max(asNumber(inputs.propertyTaxPct, 0), 0) / 100;
  const homeInsuranceAnnual = Math.max(asNumber(inputs.homeInsuranceAnnual, 0), 0);
  const hoaMonthly = Math.max(asNumber(inputs.hoaMonthly, 0), 0);
  const maintenanceRate = Math.max(asNumber(inputs.maintenancePct, 0), 0) / 100;
  const pmiRatePct = Math.max(asNumber(inputs.pmiRatePct, 0), 0);

  const mortgagePrincipal = homePrice * (1 - downPaymentRate);
  const principalInterestMonthly = getMortgagePayment(
    mortgagePrincipal,
    mortgageRatePct,
    loanTermYears,
  );
  const propertyTaxMonthly = (homePrice * propertyTaxRate) / 12;
  const homeInsuranceMonthly = homeInsuranceAnnual / 12;
  const maintenanceMonthly = (homePrice * maintenanceRate) / 12;
  const pmiMonthly = getMonthlyPmi({
    loanBalance: mortgagePrincipal,
    homePrice,
    pmiRatePct,
    originalLoanAmount: mortgagePrincipal,
  });

  return {
    principalInterestMonthly,
    propertyTaxMonthly,
    homeInsuranceMonthly,
    hoaMonthly,
    maintenanceMonthly,
    pmiMonthly,
    total:
      principalInterestMonthly +
      propertyTaxMonthly +
      homeInsuranceMonthly +
      hoaMonthly +
      maintenanceMonthly +
      pmiMonthly,
  };
}

export function computeTotalMonthlyOwnerCost(inputs) {
  return computeMonthlyOwnerCostBreakdown(inputs).total;
}

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatMonthlyOwnerCost(value) {
  return `${moneyFormatter.format(value)}/mo`;
}
