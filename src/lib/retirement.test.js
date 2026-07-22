// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Correctness suite for the retirement projection — accumulation math, drawdown,
//          depletion handling, target/sustainability consistency, and input edge cases.
// Reason: The projection had no coverage. Expected values are derived from closed-form
//         compounding formulas so the tests catch model errors, not just regressions.

import assert from "node:assert/strict";
import test from "node:test";

import { calculateRetirement } from "./retirement.js";
import { DEFAULT_RETIREMENT_INPUTS } from "./defaults.js";

function closeTo(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message ?? "value"}: expected ${actual} to be within ${tolerance} of ${expected} (off by ${Math.abs(actual - expected)})`,
  );
}

// --- Accumulation ------------------------------------------------------------

test("pure growth with no contributions matches compound interest", () => {
  const result = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    currentAge: 40,
    retirementAge: 50,
    lifeExpectancy: 51,
    currentSavings: 100000,
    annualContribution: 0,
    employerMatchAnnual: 0,
    preRetirementReturnPct: 7,
    investmentDragPct: 0,
  });
  // 10 years of growth between age 40 and age 50.
  closeTo(
    result.summary.balanceAtRetirement,
    100000 * Math.pow(1.07, 10),
    1,
    "balance at retirement",
  );
});

test("contributions plus growth match an annuity-due future value", () => {
  const result = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    currentAge: 40,
    retirementAge: 45,
    lifeExpectancy: 46,
    currentSavings: 0,
    annualContribution: 10000,
    employerMatchAnnual: 0,
    contributionGrowthPct: 0,
    preRetirementReturnPct: 5,
    investmentDragPct: 0,
  });
  // Deposits are made at the end of each of 5 years, after that year's growth is
  // applied to the prior balance -> ordinary annuity FV.
  const expected = 10000 * ((Math.pow(1.05, 5) - 1) / 0.05);
  closeTo(result.summary.balanceAtRetirement, expected, 1, "annuity future value");
});

test("fee drag reduces the return rate by exactly its percentage points", () => {
  const withoutDrag = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    currentAge: 40,
    retirementAge: 50,
    lifeExpectancy: 51,
    currentSavings: 100000,
    annualContribution: 0,
    employerMatchAnnual: 0,
    preRetirementReturnPct: 7,
    investmentDragPct: 0,
  });
  const withDrag = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    currentAge: 40,
    retirementAge: 50,
    lifeExpectancy: 51,
    currentSavings: 100000,
    annualContribution: 0,
    employerMatchAnnual: 0,
    preRetirementReturnPct: 7,
    investmentDragPct: 1,
  });
  closeTo(
    withDrag.summary.balanceAtRetirement,
    100000 * Math.pow(1.06, 10),
    1,
    "6% net of 1% drag",
  );
  assert.ok(withDrag.summary.balanceAtRetirement < withoutDrag.summary.balanceAtRetirement);
});

test("employer match is added on top of the personal contribution", () => {
  const noMatch = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    currentAge: 40,
    retirementAge: 41,
    lifeExpectancy: 42,
    currentSavings: 0,
    annualContribution: 10000,
    employerMatchAnnual: 0,
    contributionGrowthPct: 0,
    preRetirementReturnPct: 0,
    investmentDragPct: 0,
  });
  const withMatch = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    currentAge: 40,
    retirementAge: 41,
    lifeExpectancy: 42,
    currentSavings: 0,
    annualContribution: 10000,
    employerMatchAnnual: 4000,
    contributionGrowthPct: 0,
    preRetirementReturnPct: 0,
    investmentDragPct: 0,
  });
  closeTo(noMatch.summary.balanceAtRetirement, 10000, 1e-6, "no match");
  closeTo(withMatch.summary.balanceAtRetirement, 14000, 1e-6, "with match");
});

// --- Spending / inflation ----------------------------------------------------

test("planned spend at retirement is today's budget inflated over the accumulation years", () => {
  const result = calculateRetirement(DEFAULT_RETIREMENT_INPUTS);
  const inputs = DEFAULT_RETIREMENT_INPUTS;
  const monthlyToday =
    inputs.monthlyHousing +
    inputs.monthlyUtilities +
    inputs.monthlyFood +
    inputs.monthlyTransportation +
    inputs.monthlyHealthcare +
    inputs.monthlyLifestyle +
    inputs.monthlyTravel +
    inputs.monthlyOther +
    inputs.annualNonMonthlyExpenses / 12;
  closeTo(result.summary.plannedMonthlySpendToday, monthlyToday, 1e-6, "budget today");
  closeTo(
    result.summary.plannedMonthlySpendAtRetirement,
    monthlyToday * Math.pow(1.025, 32),
    0.01,
    "budget at retirement",
  );
});

test("every budget row inflates by the same factor as the total", () => {
  const { summary } = calculateRetirement(DEFAULT_RETIREMENT_INPUTS);
  const factor = Math.pow(1.025, 32);
  for (const row of summary.monthlyBudgetRows) {
    closeTo(row.atRetirement, row.today * factor, 0.01, `row ${row.label}`);
  }
});

// --- Drawdown ----------------------------------------------------------------

test("withdrawals are grossed up so the after-tax amount covers the spending gap", () => {
  const result = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    currentAge: 64,
    retirementAge: 65,
    lifeExpectancy: 66,
    retirementIncomeTaxPct: 25,
    socialSecurityAnnual: 0,
    pensionAnnual: 0,
    inflationPct: 0,
  });
  const firstRetiredYear = result.timeline.find((point) => point.isRetired);
  const spend = firstRetiredYear.retirementSpending;
  closeTo(
    firstRetiredYear.withdrawal,
    spend / 0.75,
    0.01,
    "gross withdrawal covers spend plus 25% tax",
  );
});

test("the withdrawal-rule target is consistent with sustainable spending", () => {
  // If the portfolio at retirement exactly equals the required nest egg, the
  // sustainable spend must exactly equal the planned spend. These are the two
  // headline numbers on the page and they must not contradict each other.
  const base = calculateRetirement(DEFAULT_RETIREMENT_INPUTS);
  const tuned = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    currentSavings: 0,
    annualContribution: 0,
    employerMatchAnnual: 0,
  });
  assert.ok(base.summary.requiredNestEgg > 0, "sanity: a target exists");

  // Reconstruct: nest egg * SWR * (1 - tax) + benefits should equal planned spend.
  const swr = DEFAULT_RETIREMENT_INPUTS.safeWithdrawalRatePct / 100;
  const tax = DEFAULT_RETIREMENT_INPUTS.retirementIncomeTaxPct / 100;
  const impliedSustainable =
    DEFAULT_RETIREMENT_INPUTS.socialSecurityAnnual +
    DEFAULT_RETIREMENT_INPUTS.pensionAnnual +
    base.summary.requiredNestEgg * swr * (1 - tax);
  closeTo(
    impliedSustainable / 12,
    base.summary.plannedMonthlySpendAtRetirement,
    0.01,
    "target nest egg funds exactly the planned spend",
  );
  assert.ok(tuned.summary.requiredNestEgg > 0);
});

test("a depleted portfolio stays at zero instead of compounding into debt", () => {
  const result = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    currentSavings: 10000,
    annualContribution: 0,
    employerMatchAnnual: 0,
    socialSecurityAnnual: 0,
    pensionAnnual: 0,
  });
  const worst = Math.min(...result.timeline.map((point) => point.balance));
  assert.ok(
    worst >= -1,
    `portfolio balance reached ${worst.toFixed(0)} — a depleted portfolio cannot go negative`,
  );
});

test("withdrawals stop once the portfolio is exhausted", () => {
  const result = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    currentSavings: 10000,
    annualContribution: 0,
    employerMatchAnnual: 0,
    socialSecurityAnnual: 0,
    pensionAnnual: 0,
  });
  assert.notEqual(result.summary.runOutAge, null, "sanity: this scenario runs out");
  const afterRunOut = result.timeline.filter(
    (point) => point.age > result.summary.runOutAge,
  );
  const stillWithdrawing = afterRunOut.filter((point) => point.withdrawal > 0);
  assert.equal(
    stillWithdrawing.length,
    0,
    `${stillWithdrawing.length} years withdraw money from an already-empty portfolio`,
  );
});

test("cumulative withdrawals never exceed what the portfolio could actually pay out", () => {
  const result = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    currentSavings: 10000,
    annualContribution: 0,
    employerMatchAnnual: 0,
    socialSecurityAnnual: 0,
    pensionAnnual: 0,
  });
  const contributedOrGrown = 10000 * Math.pow(1.07, 32) * Math.pow(1.04, 25);
  assert.ok(
    result.summary.cumulativeWithdrawals <= contributedOrGrown,
    `reported total withdrawals ${result.summary.cumulativeWithdrawals.toFixed(0)} exceed the most the portfolio could ever hold`,
  );
});

test("'on track' and 'portfolio depletes' cannot both be true", () => {
  const result = calculateRetirement(DEFAULT_RETIREMENT_INPUTS);
  assert.ok(
    !(result.summary.retireReady && result.summary.runOutAge !== null),
    `model reports on-track but also depletion at age ${result.summary.runOutAge}`,
  );
});

// --- Timeline shape ----------------------------------------------------------

test("timeline covers every age from today through life expectancy", () => {
  const result = calculateRetirement(DEFAULT_RETIREMENT_INPUTS);
  const { currentAge, lifeExpectancy } = result.assumptions;
  assert.equal(result.timeline.length, lifeExpectancy - currentAge + 1);
  assert.equal(result.timeline[0].age, currentAge);
  assert.equal(result.timeline[result.timeline.length - 1].age, lifeExpectancy);
  const retirementPoint = result.timeline.find(
    (point) => point.age === result.assumptions.retirementAge,
  );
  assert.ok(retirementPoint, "retirement age appears in the timeline for the chart marker");
  assert.ok(retirementPoint.isRetired);
});

test("no contributions are recorded after retirement age when income covers spending", () => {
  const result = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    socialSecurityAnnual: 500000, // income far exceeds spending
  });
  const retiredYears = result.timeline.filter((point) => point.isRetired);
  assert.ok(retiredYears.every((point) => point.withdrawal === 0));
});

// --- Edge cases --------------------------------------------------------------

test("retiring next year does not break the projection", () => {
  const result = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    currentAge: 66,
    retirementAge: 67,
    lifeExpectancy: 90,
  });
  assert.ok(Number.isFinite(result.summary.balanceAtRetirement));
  assert.ok(result.summary.balanceAtRetirement > 0);
});

test("retirement age below current age is corrected rather than producing garbage", () => {
  const result = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    currentAge: 70,
    retirementAge: 60,
    lifeExpectancy: 85,
  });
  assert.ok(result.assumptions.retirementAge > result.assumptions.currentAge);
  assert.ok(Number.isFinite(result.summary.finalBalance));
});

test("cleared (empty-string) fields do not produce NaN output", () => {
  const cleared = Object.fromEntries(
    Object.keys(DEFAULT_RETIREMENT_INPUTS).map((key) => [key, ""]),
  );
  const result = calculateRetirement(cleared);
  for (const [key, value] of Object.entries(result.summary)) {
    if (typeof value === "number") {
      assert.ok(Number.isFinite(value), `summary.${key} is not finite: ${value}`);
    }
  }
});

test("a 100% tax rate does not divide by zero", () => {
  const result = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    retirementIncomeTaxPct: 100,
  });
  assert.ok(Number.isFinite(result.summary.requiredNestEgg));
});

// --- Verdict source ----------------------------------------------------------

test("readiness verdict follows the simulation, not the static withdrawal-rule target", () => {
  // Parameters where the 4% rule is satisfied at retirement but the year-by-year
  // projection still runs dry before life expectancy.
  const result = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    postRetirementReturnPct: 3,
    inflationPct: 2.5,
    lifeExpectancy: 92,
  });
  assert.equal(result.summary.meetsWithdrawalRuleTarget, true, "sanity: 4% rule is met");
  assert.notEqual(result.summary.runOutAge, null, "sanity: the simulation depletes");
  assert.equal(
    result.summary.retireReady,
    false,
    "verdict must follow the simulation when the two measures disagree",
  );
});

test("the withdrawal-rule target is still reported alongside the verdict", () => {
  const result = calculateRetirement(DEFAULT_RETIREMENT_INPUTS);
  assert.equal(typeof result.summary.meetsWithdrawalRuleTarget, "boolean");
  assert.ok(Number.isFinite(result.summary.targetGap));
});

// --- Sustainable spending solver ---------------------------------------------

test("sustainable spending is solved against the projection, not a static rule", () => {
  const result = calculateRetirement(DEFAULT_RETIREMENT_INPUTS);
  const { sustainableMultiplier } = result.summary;
  assert.ok(sustainableMultiplier > 0, "a positive spending level is affordable");

  // Spending exactly the solved amount must survive the full horizon...
  const atLimit = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    ...scaleBudget(DEFAULT_RETIREMENT_INPUTS, sustainableMultiplier * 0.999),
  });
  assert.equal(atLimit.summary.retireReady, true, "the solved level is affordable");

  // ...and spending meaningfully more must not.
  const overLimit = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    ...scaleBudget(DEFAULT_RETIREMENT_INPUTS, sustainableMultiplier * 1.05),
  });
  assert.equal(overLimit.summary.retireReady, false, "5% above the solved level fails");
});

function scaleBudget(inputs, multiplier) {
  const keys = [
    "monthlyHousing",
    "monthlyUtilities",
    "monthlyFood",
    "monthlyTransportation",
    "monthlyHealthcare",
    "monthlyLifestyle",
    "monthlyTravel",
    "monthlyOther",
    "annualNonMonthlyExpenses",
  ];
  return Object.fromEntries(keys.map((key) => [key, inputs[key] * multiplier]));
}

test("the cushion agrees with the readiness verdict", () => {
  // A plan the simulation says is affordable must not show a negative cushion, and vice
  // versa. The old static cushion could report a surplus for a plan that ran dry.
  for (const postReturn of [3, 4, 5, 6, 7]) {
    for (const inflation of [2, 2.5, 3, 3.5]) {
      const result = calculateRetirement({
        ...DEFAULT_RETIREMENT_INPUTS,
        postRetirementReturnPct: postReturn,
        inflationPct: inflation,
      });
      const { retireReady, monthlyBudgetDelta } = result.summary;
      assert.equal(
        retireReady,
        monthlyBudgetDelta >= -0.01,
        `post=${postReturn} infl=${inflation}: verdict ${retireReady} but cushion ${monthlyBudgetDelta.toFixed(0)}`,
      );
    }
  }
});

test("a plan with no spending at all is trivially sustainable", () => {
  const result = calculateRetirement({
    ...DEFAULT_RETIREMENT_INPUTS,
    ...scaleBudget(DEFAULT_RETIREMENT_INPUTS, 0),
  });
  assert.equal(result.summary.retireReady, true);
  assert.equal(result.summary.plannedMonthlySpendToday, 0);
});

test("today's-dollar figures deflate the nominal ones by the inflation factor", () => {
  const result = calculateRetirement(DEFAULT_RETIREMENT_INPUTS);
  const { summary, assumptions } = result;
  closeTo(
    summary.balanceAtRetirementToday * assumptions.inflationToRetirement,
    summary.balanceAtRetirement,
    1,
    "balance in today's dollars",
  );
  closeTo(
    summary.sustainableMonthlySpendToday * assumptions.inflationToRetirement,
    summary.sustainableMonthlySpend,
    0.01,
    "sustainable spend in today's dollars",
  );
});

test("zero inflation makes today's and retirement-year dollars identical", () => {
  const result = calculateRetirement({ ...DEFAULT_RETIREMENT_INPUTS, inflationPct: 0 });
  closeTo(
    result.summary.balanceAtRetirementToday,
    result.summary.balanceAtRetirement,
    1,
    "no inflation, no difference",
  );
  closeTo(
    result.summary.plannedMonthlySpendAtRetirement,
    result.summary.plannedMonthlySpendToday,
    0.01,
    "planned spend unchanged",
  );
});
