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

export function computeMonthlyOwnerCostBreakdown(inputs) {
  const homePrice = Math.max(asNumber(inputs.homePrice, 0), 0);
  const downPaymentRate = clamp(asNumber(inputs.downPaymentPct, 0), 0, 100) / 100;
  const mortgageRatePct = Math.max(asNumber(inputs.mortgageRatePct, 0), 0);
  const loanTermYears = clamp(Math.round(asNumber(inputs.loanTermYears, 30)), 1, 40);
  const propertyTaxRate = Math.max(asNumber(inputs.propertyTaxPct, 0), 0) / 100;
  const homeInsuranceAnnual = Math.max(asNumber(inputs.homeInsuranceAnnual, 0), 0);
  const hoaMonthly = Math.max(asNumber(inputs.hoaMonthly, 0), 0);
  const maintenanceRate = Math.max(asNumber(inputs.maintenancePct, 0), 0) / 100;

  const mortgagePrincipal = homePrice * (1 - downPaymentRate);
  const principalInterestMonthly = getMortgagePayment(
    mortgagePrincipal,
    mortgageRatePct,
    loanTermYears,
  );
  const propertyTaxMonthly = (homePrice * propertyTaxRate) / 12;
  const homeInsuranceMonthly = homeInsuranceAnnual / 12;
  const maintenanceMonthly = (homePrice * maintenanceRate) / 12;

  return {
    principalInterestMonthly,
    propertyTaxMonthly,
    homeInsuranceMonthly,
    hoaMonthly,
    maintenanceMonthly,
    total:
      principalInterestMonthly +
      propertyTaxMonthly +
      homeInsuranceMonthly +
      hoaMonthly +
      maintenanceMonthly,
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
