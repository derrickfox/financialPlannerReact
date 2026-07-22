// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Holds the default input sets for both calculators.
// Reason: The test suite needs to exercise the exact defaults the UI ships with; keeping
//         them in App.jsx made that impossible without importing React.

export const DEFAULT_RENT_BUY_INPUTS = {
  years: 30,
  monthlyRent: 3300,
  rentIncreasePct: 3,
  rentersInsuranceMonthly: 22,
  homePrice: 500000,
  downPaymentPct: 20,
  mortgageRatePct: 6.5,
  loanTermYears: 30,
  propertyTaxPct: 1.2,
  homeInsuranceAnnual: 1800,
  maintenancePct: 1,
  hoaMonthly: 150,
  // Annual PMI premium as a percentage of the original loan amount. Only charged while the
  // balance is above 80% of the purchase price, so the shipped 20%-down default pays none.
  pmiRatePct: 0.5,
  closingCostPct: 3,
  sellingCostPct: 6,
  homeAppreciationPct: 3,
  // AI_CHANGE:
  // Tool: Claude Code
  // Model: Claude Opus 4.8
  // Timestamp: 2026-07-22T00:00:00-04:00
  // Purpose: Reconciles the two shared assumptions to a single value across both calculators.
  // Reason: These are now hard-linked (see linkedFields.js), so they cannot start out
  //         disagreeing. Inflation moves 2 -> 2.5 and the renter's investment return moves
  //         5 -> 7 to match the retirement page's working-years figures, which are the more
  //         standard long-run assumptions.
  investmentReturnPct: 7,
  annualInflationPct: 2.5,
};

export const DEFAULT_RETIREMENT_INPUTS = {
  currentAge: 35,
  retirementAge: 67,
  lifeExpectancy: 92,
  currentSavings: 120000,
  annualContribution: 18000,
  employerMatchAnnual: 5000,
  contributionGrowthPct: 2,
  preRetirementReturnPct: 7,
  postRetirementReturnPct: 5,
  investmentDragPct: 1,
  monthlyHousing: 1800,
  monthlyUtilities: 350,
  monthlyFood: 700,
  monthlyTransportation: 450,
  monthlyHealthcare: 500,
  monthlyLifestyle: 550,
  monthlyTravel: 300,
  monthlyOther: 300,
  annualNonMonthlyExpenses: 6000,
  socialSecurityAnnual: 32000,
  pensionAnnual: 0,
  benefitIncreasePct: 2,
  inflationPct: 2.5,
  retirementIncomeTaxPct: 12,
  safeWithdrawalRatePct: 4,
};
