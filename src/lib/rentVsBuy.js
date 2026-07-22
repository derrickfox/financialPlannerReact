// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Moves the month-by-month rent-vs-buy projection out of App.jsx into a pure,
//          React-free module so it can be imported by the node:test suite.
// Reason: The projection drives every number and chart on the Rent vs Buy page but had
//         zero test coverage because it lived in a file that imports React. Behavior is
//         unchanged by this move; correctness fixes are tracked separately.

import { annualToMonthlyRate, asNumber, clamp } from "./finance.js";
import { getMonthlyPmi, getMortgagePayment } from "./rentVsBuyOwnerCost.js";

export function calculateRentVsBuy(inputs) {
  const years = clamp(Math.round(asNumber(inputs.years, 10)), 1, 50);
  const monthlyRentStart = Math.max(asNumber(inputs.monthlyRent, 0), 0);
  const rentIncreasePct = asNumber(inputs.rentIncreasePct, 0);
  const rentersInsuranceStart = Math.max(
    asNumber(inputs.rentersInsuranceMonthly, 0),
    0,
  );
  const homePrice = Math.max(asNumber(inputs.homePrice, 0), 0);
  const downPaymentRate = clamp(asNumber(inputs.downPaymentPct, 0), 0, 100) / 100;
  const mortgageRatePct = Math.max(asNumber(inputs.mortgageRatePct, 0), 0);
  const loanTermYears = clamp(Math.round(asNumber(inputs.loanTermYears, 30)), 1, 40);
  const propertyTaxRate = Math.max(asNumber(inputs.propertyTaxPct, 0), 0) / 100;
  const homeInsuranceAnnualStart = Math.max(
    asNumber(inputs.homeInsuranceAnnual, 0),
    0,
  );
  const maintenanceRate = Math.max(asNumber(inputs.maintenancePct, 0), 0) / 100;
  const pmiRatePct = Math.max(asNumber(inputs.pmiRatePct, 0), 0);
  const hoaStart = Math.max(asNumber(inputs.hoaMonthly, 0), 0);
  const closingCostRate = Math.max(asNumber(inputs.closingCostPct, 0), 0) / 100;
  const sellingCostRate = clamp(asNumber(inputs.sellingCostPct, 0), 0, 100) / 100;
  const appreciationPct = asNumber(inputs.homeAppreciationPct, 0);
  const investmentReturnPct = asNumber(inputs.investmentReturnPct, 0);
  const inflationPct = asNumber(inputs.annualInflationPct, 0);

  const downPayment = homePrice * downPaymentRate;
  const closingCosts = homePrice * closingCostRate;
  const mortgagePrincipal = homePrice - downPayment;
  const monthlyMortgagePayment = getMortgagePayment(
    mortgagePrincipal,
    mortgageRatePct,
    loanTermYears,
  );
  const mortgageMonths = loanTermYears * 12;
  const monthlyMortgageRate = mortgageRatePct / 100 / 12;

  const monthlyRentGrowth = annualToMonthlyRate(rentIncreasePct);
  const monthlyHomeGrowth = annualToMonthlyRate(appreciationPct);
  const monthlyInvestmentGrowth = annualToMonthlyRate(investmentReturnPct);
  const monthlyInflation = annualToMonthlyRate(inflationPct);

  let rent = monthlyRentStart;
  let rentersInsurance = rentersInsuranceStart;
  let homeInsurance = homeInsuranceAnnualStart / 12;
  let hoa = hoaStart;
  let homeValue = homePrice;
  let remainingBalance = mortgagePrincipal;

  let ownerOutflow = downPayment + closingCosts;
  // The renter diverts the same up-front cash into the market rather than into a house,
  // so it counts as outflow for them too — it is money committed, not money kept.
  let renterOutflow = downPayment + closingCosts;
  // Rent + renter's insurance only, kept separate from total committed cash so the UI can
  // report both "what you handed the landlord" and "what the scenario cost you overall".
  let renterRentPaid = 0;
  let renterInvestment = downPayment + closingCosts;

  const timeline = [];
  let breakEvenYear = null;

  for (let month = 1; month <= years * 12; month += 1) {
    if (month > 1) {
      rent *= 1 + monthlyRentGrowth;
      rentersInsurance *= 1 + monthlyInflation;
      homeInsurance *= 1 + monthlyInflation;
      hoa *= 1 + monthlyInflation;
    }

    // AI_CHANGE:
    // Tool: Claude Code
    // Model: Claude Opus 4.8
    // Timestamp: 2026-07-22T00:00:00-04:00
    // Purpose: Compounds the home value every month, including the first, instead of
    //          skipping month 1 along with the recurring-cost escalators.
    // Reason: Recurring costs correctly start at today's amount (month 1 rent is this
    //         month's rent), but the home starts appreciating immediately. Sharing the
    //         `month > 1` guard left every year-N snapshot one month short: after 12
    //         months the home showed P*(1+g)^(11/12) instead of P*(1+g), understating
    //         owner equity by ~$1,650 at year 10 on the default inputs and compounding
    //         from there.
    homeValue *= 1 + monthlyHomeGrowth;

    renterInvestment *= 1 + monthlyInvestmentGrowth;

    // Captured before this month's principal payment: the PMI premium is due alongside the
    // payment, so it is assessed on the balance at the start of the period.
    const openingBalance = remainingBalance;

    let mortgagePaymentThisMonth = 0;
    if (month <= mortgageMonths && remainingBalance > 0.01) {
      const interestPaid = remainingBalance * monthlyMortgageRate;
      let principalPaid = Math.max(monthlyMortgagePayment - interestPaid, 0);

      if (principalPaid > remainingBalance) {
        principalPaid = remainingBalance;
      }

      mortgagePaymentThisMonth = interestPaid + principalPaid;
      remainingBalance -= principalPaid;
    }

    const propertyTaxThisMonth = (homeValue * propertyTaxRate) / 12;
    const maintenanceThisMonth = (homeValue * maintenanceRate) / 12;
    // AI_CHANGE:
    // Tool: Claude Code
    // Model: Claude Opus 4.8
    // Timestamp: 2026-07-22T00:00:00-04:00
    // Purpose: Charges PMI each month until the balance amortizes below 80% of the original
    //          purchase price.
    // Reason: Buying was previously costed as though PMI never existed, despite the UI
    //         telling users that a 20% down payment is what avoids it. Cancellation is keyed
    //         to the original price, not the appreciated value, matching lender practice.
    const pmiThisMonth = getMonthlyPmi({
      loanBalance: openingBalance,
      homePrice,
      pmiRatePct,
      originalLoanAmount: mortgagePrincipal,
    });

    const ownerMonthlyCost =
      mortgagePaymentThisMonth +
      propertyTaxThisMonth +
      maintenanceThisMonth +
      homeInsurance +
      hoa +
      pmiThisMonth;
    const renterMonthlyCost = rent + rentersInsurance;

    ownerOutflow += ownerMonthlyCost;
    renterRentPaid += renterMonthlyCost;

    // AI_CHANGE:
    // Tool: Claude Code
    // Model: Claude Opus 4.8
    // Timestamp: 2026-07-22T00:00:00-04:00
    // Purpose: Counts the renter's portfolio contributions as cash outflow, and stops the
    //          portfolio from being drawn below zero.
    // Reason: Two linked defects. (1) The model funds the renter's portfolio with the down
    //         payment, closing costs and (owner cost - rent) each month, but `renterOutflow`
    //         only accumulated rent. Net cost was then "rent paid - portfolio", subtracting
    //         a portfolio built from money never counted as spent, while the owner side used
    //         true total cash. On the default inputs that overstated buying's advantage by
    //         $217,517. (2) When rent exceeded the owner's budget the shortfall was taken
    //         from the portfolio without limit, so it compounded into debt at the investment
    //         return (-$20M in a high-rent scenario). The renter now spends down to zero and
    //         pays any remainder out of pocket, which correctly raises their cash outflow
    //         above the owner's instead of inventing a margin loan.
    const renterContribution = ownerMonthlyCost - renterMonthlyCost;

    if (renterContribution >= 0) {
      renterInvestment += renterContribution;
      renterOutflow += renterMonthlyCost + renterContribution;
    } else {
      const shortfall = -renterContribution;
      const fundedFromPortfolio = Math.min(renterInvestment, shortfall);
      renterInvestment -= fundedFromPortfolio;
      renterOutflow += renterMonthlyCost - fundedFromPortfolio;
    }

    const ownerEquity = homeValue * (1 - sellingCostRate) - remainingBalance;
    const ownerNetCost = ownerOutflow - ownerEquity;
    const renterNetCost = renterOutflow - renterInvestment;

    if (breakEvenYear === null && ownerNetCost <= renterNetCost) {
      breakEvenYear = month / 12;
    }

    if (month % 12 === 0) {
      timeline.push({
        year: month / 12,
        ownerNetCost,
        renterNetCost,
        ownerOutflow,
        renterOutflow,
        renterRentPaid,
        ownerEquity,
        renterInvestment,
      });
    }
  }

  const finalYear = timeline[timeline.length - 1];
  const costDifference = finalYear.renterNetCost - finalYear.ownerNetCost;
  const winner =
    costDifference > 0
      ? "buy"
      : costDifference < 0
        ? "rent"
        : "tie";

  return {
    assumptions: {
      years,
      monthlyMortgagePayment,
    },
    timeline,
    summary: {
      winner,
      breakEvenYear,
      costDifference,
      ownerNetCost: finalYear.ownerNetCost,
      renterNetCost: finalYear.renterNetCost,
      ownerOutflow: finalYear.ownerOutflow,
      renterOutflow: finalYear.renterOutflow,
      renterRentPaid: finalYear.renterRentPaid,
      ownerEquity: finalYear.ownerEquity,
      renterInvestment: finalYear.renterInvestment,
    },
  };
}
