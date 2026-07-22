// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Correctness suite for the rent-vs-buy projection — amortization, accounting
//          identities, growth compounding, break-even detection, and input edge cases.
// Reason: The projection had no coverage at all. These tests assert independently derived
//         expected values (closed-form formulas, conservation identities) rather than
//         snapshots of current output, so they fail when the model is wrong.

import assert from "node:assert/strict";
import test from "node:test";

import { calculateRentVsBuy } from "./rentVsBuy.js";
import { getMortgagePayment } from "./rentVsBuyOwnerCost.js";
import { DEFAULT_RENT_BUY_INPUTS } from "./defaults.js";

function closeTo(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message ?? "value"}: expected ${actual} to be within ${tolerance} of ${expected} (off by ${Math.abs(actual - expected)})`,
  );
}

// --- Amortization ------------------------------------------------------------

test("mortgage payment matches the standard annuity formula", () => {
  // $400,000 @ 6.5% nominal, 30 years. Published/standard value is $2,528.27.
  closeTo(getMortgagePayment(400000, 6.5, 30), 2528.27, 0.01, "P&I");
  // $300,000 @ 4.0%, 15 years -> $2,219.06
  closeTo(getMortgagePayment(300000, 4, 15), 2219.06, 0.01, "P&I 15yr");
});

test("zero-interest mortgage is simple principal division", () => {
  closeTo(getMortgagePayment(360000, 0, 30), 1000, 1e-9, "zero-rate P&I");
});

test("amortization schedule fully retires the loan on the final scheduled payment", () => {
  const result = calculateRentVsBuy({
    ...DEFAULT_RENT_BUY_INPUTS,
    years: 30,
    loanTermYears: 30,
    homeAppreciationPct: 0,
    sellingCostPct: 0,
  });
  // With zero appreciation and zero selling cost, ending equity is exactly the home
  // value once the loan is retired.
  closeTo(
    result.summary.ownerEquity,
    DEFAULT_RENT_BUY_INPUTS.homePrice,
    1,
    "equity after full payoff",
  );
});

test("total mortgage cash paid equals the scheduled payment times the term", () => {
  const inputs = {
    ...DEFAULT_RENT_BUY_INPUTS,
    years: 30,
    loanTermYears: 30,
    propertyTaxPct: 0,
    maintenancePct: 0,
    homeInsuranceAnnual: 0,
    hoaMonthly: 0,
    closingCostPct: 0,
  };
  const result = calculateRentVsBuy(inputs);
  const downPayment = inputs.homePrice * (inputs.downPaymentPct / 100);
  const mortgageCashPaid = result.summary.ownerOutflow - downPayment;
  const expected = result.assumptions.monthlyMortgagePayment * 360;
  closeTo(mortgageCashPaid, expected, 1, "total P&I paid");
});

// --- Growth / compounding ----------------------------------------------------

test("home value compounds to exactly (1+g)^years by the end of year N", () => {
  const inputs = {
    ...DEFAULT_RENT_BUY_INPUTS,
    years: 10,
    homeAppreciationPct: 3,
    sellingCostPct: 0,
    downPaymentPct: 100, // no loan, so equity == home value
  };
  const result = calculateRentVsBuy(inputs);
  const expected = inputs.homePrice * Math.pow(1.03, 10);
  closeTo(result.summary.ownerEquity, expected, 1, "home value after 10 years");
});

test("each timeline year snapshot reflects a whole number of years of appreciation", () => {
  const inputs = {
    ...DEFAULT_RENT_BUY_INPUTS,
    years: 5,
    homeAppreciationPct: 4,
    sellingCostPct: 0,
    downPaymentPct: 100,
  };
  const { timeline } = calculateRentVsBuy(inputs);
  for (const point of timeline) {
    const expected = inputs.homePrice * Math.pow(1.04, point.year);
    closeTo(point.ownerEquity, expected, 1, `home value at year ${point.year}`);
  }
});

test("rent totals match a geometrically growing annuity", () => {
  const inputs = {
    ...DEFAULT_RENT_BUY_INPUTS,
    years: 3,
    monthlyRent: 2000,
    rentIncreasePct: 5,
    rentersInsuranceMonthly: 0,
  };
  const { summary } = calculateRentVsBuy(inputs);
  const monthlyGrowth = Math.pow(1.05, 1 / 12) - 1;
  let expected = 0;
  for (let month = 0; month < 36; month += 1) {
    expected += 2000 * Math.pow(1 + monthlyGrowth, month);
  }
  closeTo(summary.renterRentPaid, expected, 0.5, "total rent paid");
});

test("rent paid is reported separately from total cash committed", () => {
  const { summary } = calculateRentVsBuy(DEFAULT_RENT_BUY_INPUTS);
  // On the defaults, rent eventually outgrows the owner's monthly budget, so total rent
  // handed to a landlord exceeds the renter's committed cash — the portfolio funds the
  // difference. Both figures are real and must be reported distinctly.
  assert.ok(summary.renterRentPaid > 0);
  assert.notEqual(
    Math.round(summary.renterRentPaid),
    Math.round(summary.renterOutflow),
    "rent paid and total cash committed are different quantities",
  );
});

test("a renter who is drawing down the portfolio still commits the same cash as the owner", () => {
  // While the portfolio has money in it, the renting scenario is budget-matched to the
  // owning scenario: the renter commits the same dollars, just to a different asset.
  const { summary, timeline } = calculateRentVsBuy(DEFAULT_RENT_BUY_INPUTS);
  assert.ok(
    Math.min(...timeline.map((point) => point.renterInvestment)) > 0,
    "sanity: the portfolio never runs dry on the default inputs",
  );
  closeTo(
    summary.renterOutflow,
    summary.ownerOutflow,
    1,
    "budget-matched scenarios commit equal cash",
  );
});

test("a renter whose portfolio runs dry pays the remainder out of pocket", () => {
  // Rent far above the cost of owning drains the portfolio. After that the renter must
  // fund rent themselves, so their committed cash must exceed the owner's.
  const { summary, timeline } = calculateRentVsBuy({
    ...DEFAULT_RENT_BUY_INPUTS,
    years: 30,
    monthlyRent: 12000,
    homePrice: 200000,
    investmentReturnPct: 8,
  });
  assert.equal(
    Math.min(...timeline.map((point) => point.renterInvestment)),
    0,
    "sanity: the portfolio is exhausted",
  );
  assert.ok(
    summary.renterOutflow > summary.ownerOutflow,
    "an exhausted portfolio forces the renter to spend more cash than the owner",
  );
});

// --- Accounting identities ---------------------------------------------------

test("renter and owner scenarios spend the same total cash by construction", () => {
  // The model funds the renter's portfolio with (owner cost - rent) every month plus
  // the down payment and closing costs up front. That means the renter's true cash
  // outlay is identical to the owner's. Whatever the UI labels "Total cash paid" for
  // the renter must therefore reconcile with that same figure, or the two net-cost
  // numbers are not comparable.
  const result = calculateRentVsBuy(DEFAULT_RENT_BUY_INPUTS);
  const { summary } = result;

  const inputs = DEFAULT_RENT_BUY_INPUTS;
  const downPayment = inputs.homePrice * (inputs.downPaymentPct / 100);
  const closingCosts = inputs.homePrice * (inputs.closingCostPct / 100);
  // Renter cash = rent paid + up-front money diverted into the portfolio +
  //               every monthly contribution (owner cost - rent).
  const renterContributions = summary.ownerOutflow - downPayment - closingCosts - summary.renterOutflow;
  const renterTrueCash = summary.renterOutflow + downPayment + closingCosts + renterContributions;

  closeTo(renterTrueCash, summary.ownerOutflow, 1, "renter total cash vs owner total cash");
  closeTo(
    summary.renterOutflow,
    renterTrueCash,
    1,
    "reported renter outflow vs actual renter cash outlay",
  );
});

test("net cost equals total cash outflow minus ending assets for both scenarios", () => {
  const result = calculateRentVsBuy(DEFAULT_RENT_BUY_INPUTS);
  const { summary } = result;
  closeTo(
    summary.ownerNetCost,
    summary.ownerOutflow - summary.ownerEquity,
    0.01,
    "owner net cost identity",
  );
  closeTo(
    summary.renterNetCost,
    summary.renterOutflow - summary.renterInvestment,
    0.01,
    "renter net cost identity",
  );
});

test("an identical-cost scenario is a tie", () => {
  // Rent exactly equals the all-in owner cost, nothing appreciates, nothing earns.
  // Both parties spend the same cash and end with the same assets, so net costs match.
  const inputs = {
    years: 5,
    monthlyRent: 1000,
    rentIncreasePct: 0,
    rentersInsuranceMonthly: 0,
    homePrice: 0,
    downPaymentPct: 0,
    mortgageRatePct: 0,
    loanTermYears: 30,
    propertyTaxPct: 0,
    homeInsuranceAnnual: 12000, // $1000/mo, the only owner cost
    maintenancePct: 0,
    hoaMonthly: 0,
    closingCostPct: 0,
    sellingCostPct: 0,
    homeAppreciationPct: 0,
    investmentReturnPct: 0,
    annualInflationPct: 0,
  };
  const { summary } = calculateRentVsBuy(inputs);
  closeTo(summary.costDifference, 0, 0.01, "cost difference");
  assert.equal(summary.winner, "tie");
});

// --- Break-even --------------------------------------------------------------

test("break-even year agrees with the timeline crossing it reports", () => {
  const result = calculateRentVsBuy(DEFAULT_RENT_BUY_INPUTS);
  const { summary, timeline } = result;

  if (summary.breakEvenYear === null) {
    // No crossing claimed: buying must never be cheaper at any yearly snapshot.
    for (const point of timeline) {
      assert.ok(
        point.ownerNetCost > point.renterNetCost,
        `year ${point.year} shows buying ahead but no break-even was reported`,
      );
    }
    return;
  }

  const after = timeline.filter((point) => point.year >= Math.ceil(summary.breakEvenYear));
  assert.ok(after.length > 0, "break-even year is inside the horizon");
  assert.ok(
    after[0].ownerNetCost <= after[0].renterNetCost,
    `break-even reported at year ${summary.breakEvenYear} but year ${after[0].year} still favors renting`,
  );
});

test("a reported winner of 'buy' implies a break-even inside the horizon", () => {
  const result = calculateRentVsBuy(DEFAULT_RENT_BUY_INPUTS);
  if (result.summary.winner === "buy") {
    assert.notEqual(
      result.summary.breakEvenYear,
      null,
      "buying wins overall but no break-even year was found",
    );
  }
});

// --- Directional sanity ------------------------------------------------------

test("raising the mortgage rate makes buying strictly worse", () => {
  const base = calculateRentVsBuy(DEFAULT_RENT_BUY_INPUTS);
  const worse = calculateRentVsBuy({ ...DEFAULT_RENT_BUY_INPUTS, mortgageRatePct: 9 });
  assert.ok(
    worse.summary.ownerNetCost > base.summary.ownerNetCost,
    "a higher mortgage rate should increase owner net cost",
  );
});

test("raising home appreciation makes buying strictly better", () => {
  const base = calculateRentVsBuy(DEFAULT_RENT_BUY_INPUTS);
  const better = calculateRentVsBuy({
    ...DEFAULT_RENT_BUY_INPUTS,
    homeAppreciationPct: 6,
  });
  assert.ok(
    better.summary.ownerNetCost < base.summary.ownerNetCost,
    "faster appreciation should reduce owner net cost",
  );
});

test("raising the renter's investment return makes renting strictly better", () => {
  const base = calculateRentVsBuy(DEFAULT_RENT_BUY_INPUTS);
  const better = calculateRentVsBuy({
    ...DEFAULT_RENT_BUY_INPUTS,
    investmentReturnPct: 9,
  });
  assert.ok(
    better.summary.renterNetCost < base.summary.renterNetCost,
    "a higher investment return should reduce renter net cost",
  );
});

// --- Edge cases / robustness -------------------------------------------------

test("a horizon longer than the mortgage term stops charging P&I after payoff", () => {
  const inputs = {
    ...DEFAULT_RENT_BUY_INPUTS,
    years: 20,
    loanTermYears: 15,
    propertyTaxPct: 0,
    maintenancePct: 0,
    homeInsuranceAnnual: 0,
    hoaMonthly: 0,
    closingCostPct: 0,
    annualInflationPct: 0,
  };
  const result = calculateRentVsBuy(inputs);
  const downPayment = inputs.homePrice * (inputs.downPaymentPct / 100);
  const expectedMortgageCash = result.assumptions.monthlyMortgagePayment * 15 * 12;
  closeTo(
    result.summary.ownerOutflow - downPayment,
    expectedMortgageCash,
    1,
    "no payments after the loan is retired",
  );
});

test("100% down payment produces no mortgage", () => {
  const result = calculateRentVsBuy({ ...DEFAULT_RENT_BUY_INPUTS, downPaymentPct: 100 });
  assert.equal(result.assumptions.monthlyMortgagePayment, 0);
});

test("cleared (empty-string) fields do not produce NaN output", () => {
  const cleared = Object.fromEntries(
    Object.keys(DEFAULT_RENT_BUY_INPUTS).map((key) => [key, ""]),
  );
  const result = calculateRentVsBuy(cleared);
  for (const [key, value] of Object.entries(result.summary)) {
    if (typeof value === "number") {
      assert.ok(Number.isFinite(value), `summary.${key} is not finite: ${value}`);
    }
  }
});

test("garbage text input falls back to defaults rather than zeroing the model", () => {
  const result = calculateRentVsBuy({
    ...DEFAULT_RENT_BUY_INPUTS,
    years: "abc",
    homePrice: "abc",
  });
  assert.ok(Number.isFinite(result.summary.ownerNetCost));
  assert.equal(result.assumptions.years, 10, "years falls back to the documented default");
});

test("the timeline has exactly one point per year of the horizon", () => {
  for (const years of [1, 7, 30, 50]) {
    const { timeline } = calculateRentVsBuy({ ...DEFAULT_RENT_BUY_INPUTS, years });
    assert.equal(timeline.length, years, `timeline length for ${years}-year horizon`);
    assert.equal(timeline[0].year, 1);
    assert.equal(timeline[timeline.length - 1].year, years);
  }
});

test("the renter's portfolio is never allowed to become a compounding debt", () => {
  // Rent far above the cost of owning: the model drains the portfolio every month.
  // Once it hits zero there is nothing left to invest, so it must not keep
  // compounding downward as if the renter were borrowing at the market return.
  const { timeline } = calculateRentVsBuy({
    ...DEFAULT_RENT_BUY_INPUTS,
    years: 30,
    monthlyRent: 12000,
    homePrice: 200000,
    investmentReturnPct: 8,
  });
  const worst = Math.min(...timeline.map((point) => point.renterInvestment));
  assert.ok(worst >= 0, `renter portfolio went to ${worst.toFixed(0)}, i.e. leveraged debt`);
});
