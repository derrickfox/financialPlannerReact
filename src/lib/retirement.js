// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Year-by-year retirement projection, split into a reusable single-scenario runner
//          plus a solver that finds the highest spending level the plan actually survives.
// Reason: Originally one monolithic function that could only be run at the user's planned
//         spending. Sustainable spending was then estimated with a static safe-withdrawal
//         formula, which ignored the user's own return, inflation and COLA assumptions and
//         only described the first year of retirement. Making the projection re-runnable
//         lets the page report a sustainable number derived from the same simulation that
//         produces the balance chart.

import { annualRateMultiplier, asNumber, clamp } from "./finance.js";

function normalizeInputs(inputs) {
  const currentAge = clamp(Math.round(asNumber(inputs.currentAge, 35)), 18, 90);
  const retirementAgeInput = clamp(
    Math.round(asNumber(inputs.retirementAge, 67)),
    40,
    95,
  );
  const retirementAge = Math.max(retirementAgeInput, currentAge + 1);
  const lifeExpectancyInput = clamp(
    Math.round(asNumber(inputs.lifeExpectancy, 92)),
    55,
    110,
  );
  const lifeExpectancy = Math.max(lifeExpectancyInput, retirementAge + 1);

  const monthlyExpenseRows = [
    { label: "Housing", today: Math.max(asNumber(inputs.monthlyHousing, 0), 0) },
    { label: "Utilities", today: Math.max(asNumber(inputs.monthlyUtilities, 0), 0) },
    { label: "Food & Groceries", today: Math.max(asNumber(inputs.monthlyFood, 0), 0) },
    {
      label: "Transportation",
      today: Math.max(asNumber(inputs.monthlyTransportation, 0), 0),
    },
    { label: "Healthcare", today: Math.max(asNumber(inputs.monthlyHealthcare, 0), 0) },
    { label: "Lifestyle", today: Math.max(asNumber(inputs.monthlyLifestyle, 0), 0) },
    { label: "Travel", today: Math.max(asNumber(inputs.monthlyTravel, 0), 0) },
    { label: "Other", today: Math.max(asNumber(inputs.monthlyOther, 0), 0) },
    {
      label: "Non-Monthly Costs (Avg)",
      today: Math.max(asNumber(inputs.annualNonMonthlyExpenses, 0), 0) / 12,
    },
  ];

  const plannedMonthlySpendToday = monthlyExpenseRows.reduce(
    (total, row) => total + row.today,
    0,
  );

  const inflationPct = asNumber(inputs.inflationPct, 0);
  const yearsToRetirement = retirementAge - currentAge;

  return {
    currentAge,
    retirementAge,
    lifeExpectancy,
    yearsToRetirement,
    yearsTotal: lifeExpectancy - currentAge,
    currentSavings: Math.max(asNumber(inputs.currentSavings, 0), 0),
    annualContributionStart: Math.max(asNumber(inputs.annualContribution, 0), 0),
    employerMatchStart: Math.max(asNumber(inputs.employerMatchAnnual, 0), 0),
    contributionGrowth: annualRateMultiplier(asNumber(inputs.contributionGrowthPct, 0)),
    preRetirementReturnPct: asNumber(inputs.preRetirementReturnPct, 0),
    postRetirementReturnPct: asNumber(inputs.postRetirementReturnPct, 0),
    investmentDragPct: Math.max(asNumber(inputs.investmentDragPct, 0), 0),
    inflationGrowth: annualRateMultiplier(inflationPct),
    inflationToRetirement: Math.pow(annualRateMultiplier(inflationPct), yearsToRetirement),
    socialSecurityStart: Math.max(asNumber(inputs.socialSecurityAnnual, 0), 0),
    pensionStart: Math.max(asNumber(inputs.pensionAnnual, 0), 0),
    benefitsGrowth: annualRateMultiplier(asNumber(inputs.benefitIncreasePct, 0)),
    retirementIncomeTaxRate:
      clamp(asNumber(inputs.retirementIncomeTaxPct, 12), 0, 95) / 100,
    safeWithdrawalRate: clamp(asNumber(inputs.safeWithdrawalRatePct, 4), 0.5, 15) / 100,
    monthlyExpenseRows,
    plannedMonthlySpendToday,
    annualSpendingToday: plannedMonthlySpendToday * 12,
  };
}

/**
 * Runs one full projection from today through life expectancy.
 *
 * `spendingMultiplier` scales the planned retirement budget, which is what lets the
 * sustainability solver ask "what if this household spent 80% of its plan?" without
 * duplicating the projection logic.
 */
function runProjection(config, spendingMultiplier = 1) {
  const {
    currentAge,
    retirementAge,
    yearsTotal,
    currentSavings,
    annualContributionStart,
    employerMatchStart,
    contributionGrowth,
    preRetirementReturnPct,
    postRetirementReturnPct,
    investmentDragPct,
    inflationGrowth,
    inflationToRetirement,
    socialSecurityStart,
    pensionStart,
    benefitsGrowth,
    retirementIncomeTaxRate,
    annualSpendingToday,
  } = config;

  let balance = currentSavings;
  let annualContribution = annualContributionStart;
  let annualMatch = employerMatchStart;
  let socialSecurity = socialSecurityStart;
  let pension = pensionStart;

  const firstYearRetirementSpending =
    annualSpendingToday * inflationToRetirement * spendingMultiplier;
  let retirementSpending = firstYearRetirementSpending;

  let cumulativeContributions = 0;
  let cumulativeWithdrawals = 0;
  let runOutAge = null;
  let balanceAtRetirement = currentSavings;

  const timeline = [];

  for (let yearOffset = 0; yearOffset <= yearsTotal; yearOffset += 1) {
    const age = currentAge + yearOffset;
    const isRetired = age >= retirementAge;
    const grossReturnRate = isRetired
      ? postRetirementReturnPct
      : preRetirementReturnPct;

    balance *= annualRateMultiplier(grossReturnRate - investmentDragPct);

    let contributionThisYear = 0;
    let withdrawalThisYear = 0;
    let incomeThisYear = 0;
    let spendingThisYear = 0;
    let unfundedThisYear = 0;

    if (!isRetired) {
      contributionThisYear = annualContribution + annualMatch;
      balance += contributionThisYear;
      cumulativeContributions += contributionThisYear;

      if (age + 1 === retirementAge) {
        balanceAtRetirement = balance;
      }

      annualContribution *= contributionGrowth;
      annualMatch *= contributionGrowth;
    } else {
      spendingThisYear = retirementSpending;
      incomeThisYear = socialSecurity + pension;

      const shortfall = spendingThisYear - incomeThisYear;
      if (shortfall > 0) {
        const needed = shortfall / Math.max(1 - retirementIncomeTaxRate, 0.01);
        const grossWithdrawal = Math.min(needed, Math.max(balance, 0));
        withdrawalThisYear = grossWithdrawal;
        unfundedThisYear = needed - grossWithdrawal;
        balance -= grossWithdrawal;
        cumulativeWithdrawals += grossWithdrawal;
      } else if (shortfall < 0) {
        contributionThisYear = Math.abs(shortfall);
        balance += contributionThisYear;
        cumulativeContributions += contributionThisYear;
      }

      retirementSpending *= inflationGrowth;
      socialSecurity *= benefitsGrowth;
      pension *= benefitsGrowth;

      // AI_CHANGE:
      // Tool: Claude Code
      // Model: Claude Opus 4.8
      // Timestamp: 2026-07-22T00:00:00-04:00
      // Purpose: Flags a run as failed only when spending actually went unfunded, rather
      //          than whenever the balance touches zero.
      // Reason: A plan whose portfolio lands on exactly zero in the final year has funded
      //         every dollar of its spending and should count as surviving. Keying off an
      //         unmet need makes the sustainability solver converge on the true maximum
      //         instead of stopping one notch short.
      if (runOutAge === null && unfundedThisYear > 0) {
        runOutAge = age;
      }
    }

    timeline.push({
      age,
      isRetired,
      balance,
      contribution: contributionThisYear,
      withdrawal: withdrawalThisYear,
      retirementIncome: incomeThisYear,
      retirementSpending: spendingThisYear,
    });
  }

  return {
    timeline,
    runOutAge,
    balanceAtRetirement,
    cumulativeContributions,
    cumulativeWithdrawals,
    firstYearRetirementSpending,
    finalBalance: timeline[timeline.length - 1].balance,
  };
}

// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Finds, by bisection, the largest fraction of the planned budget the portfolio can
//          fund every year through life expectancy.
// Reason: "Sustainable spend" used to be balanceAtRetirement * safeWithdrawalRate, a static
//         first-year estimate that ignored the user's inflation, COLA and return inputs. On
//         the shipped defaults it reported a "+$634/mo cushion" while the same simulation
//         showed the required portfolio draw growing from $10,618/mo at 67 to $20,332/mo at
//         92 — the cushion was real for one year and meaningless thereafter. Solving against
//         the actual projection gives a number that holds for the whole horizon.
const SUSTAINABLE_SPEND_CEILING = 20;
const SUSTAINABLE_SPEND_ITERATIONS = 48;

function solveSustainableSpendingMultiplier(config) {
  if (config.annualSpendingToday <= 0) {
    return 0;
  }

  if (runProjection(config, SUSTAINABLE_SPEND_CEILING).runOutAge === null) {
    return SUSTAINABLE_SPEND_CEILING;
  }

  let affordable = 0;
  let unaffordable = SUSTAINABLE_SPEND_CEILING;

  for (let step = 0; step < SUSTAINABLE_SPEND_ITERATIONS; step += 1) {
    const midpoint = (affordable + unaffordable) / 2;
    if (runProjection(config, midpoint).runOutAge === null) {
      affordable = midpoint;
    } else {
      unaffordable = midpoint;
    }
  }

  return affordable;
}

export function calculateRetirement(inputs) {
  const config = normalizeInputs(inputs);
  const planned = runProjection(config, 1);

  const {
    inflationToRetirement,
    plannedMonthlySpendToday,
    annualSpendingToday,
    retirementIncomeTaxRate,
    safeWithdrawalRate,
    socialSecurityStart,
    pensionStart,
    monthlyExpenseRows,
  } = config;

  const firstYearRetirementSpending = planned.firstYearRetirementSpending;
  const firstYearNetGap = Math.max(
    firstYearRetirementSpending - socialSecurityStart - pensionStart,
    0,
  );
  const firstYearGrossWithdrawalNeed =
    firstYearNetGap / Math.max(1 - retirementIncomeTaxRate, 0.01);
  const requiredNestEgg = firstYearGrossWithdrawalNeed / safeWithdrawalRate;

  const targetGap = requiredNestEgg - planned.balanceAtRetirement;
  const meetsWithdrawalRuleTarget = targetGap <= 0;
  const retireReady = planned.runOutAge === null;

  const plannedMonthlySpendAtRetirement = firstYearRetirementSpending / 12;

  // Sustainable spending, solved against the projection itself and expressed in the same
  // retirement-year dollars as the planned figure it sits beside.
  const sustainableMultiplier = solveSustainableSpendingMultiplier(config);
  const sustainableMonthlySpend =
    plannedMonthlySpendToday * inflationToRetirement * sustainableMultiplier;
  const sustainableAnnualSpend = sustainableMonthlySpend * 12;
  const monthlyBudgetDelta = sustainableMonthlySpend - plannedMonthlySpendAtRetirement;

  const monthlyBudgetRows = monthlyExpenseRows.map((row) => ({
    label: row.label,
    today: row.today,
    atRetirement: row.today * inflationToRetirement,
  }));

  return {
    assumptions: {
      currentAge: config.currentAge,
      retirementAge: config.retirementAge,
      lifeExpectancy: config.lifeExpectancy,
      yearsToRetirement: config.yearsToRetirement,
      safeWithdrawalRate,
      inflationToRetirement,
    },
    timeline: planned.timeline,
    summary: {
      balanceAtRetirement: planned.balanceAtRetirement,
      requiredNestEgg,
      finalBalance: planned.finalBalance,
      targetGap,
      retireReady,
      meetsWithdrawalRuleTarget,
      runOutAge: planned.runOutAge,
      cumulativeContributions: planned.cumulativeContributions,
      cumulativeWithdrawals: planned.cumulativeWithdrawals,
      firstYearGap: firstYearNetGap,
      plannedMonthlySpendToday,
      plannedMonthlySpendAtRetirement,
      sustainableMonthlySpend,
      sustainableAnnualSpend,
      sustainableMultiplier,
      monthlyBudgetDelta,
      monthlyBudgetRows,
      annualSpendingToday,
      // AI_CHANGE:
      // Tool: Claude Code
      // Model: Claude Opus 4.8
      // Timestamp: 2026-07-22T00:00:00-04:00
      // Purpose: Reports today's-dollar equivalents alongside the nominal figures.
      // Reason: Every headline was in retirement-year dollars with nothing saying so, while
      //         the budget table's "Today" column right below was in current dollars. On the
      //         defaults that put "$12,010/mo" next to "$1,800" housing and a "$3,401,493"
      //         balance that is really $1,543,497 in today's money.
      balanceAtRetirementToday: planned.balanceAtRetirement / inflationToRetirement,
      plannedMonthlySpendTodayEquivalent: plannedMonthlySpendToday,
      sustainableMonthlySpendToday: plannedMonthlySpendToday * sustainableMultiplier,
    },
  };
}
