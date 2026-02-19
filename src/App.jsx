import { useMemo, useState } from "react";
import {
  computeTotalMonthlyOwnerCost,
  formatMonthlyOwnerCost,
  getMortgagePayment,
} from "./lib/rentVsBuyOwnerCost";

const APP_MODE = {
  RENT_BUY: "rent-buy",
  RETIREMENT: "retirement",
};

const DEFAULT_RENT_BUY_INPUTS = {
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
  closingCostPct: 3,
  sellingCostPct: 6,
  homeAppreciationPct: 3,
  investmentReturnPct: 5,
  annualInflationPct: 2,
};

const RENT_BUY_FIELD_GROUPS = [
  {
    title: "Time Horizon",
    fields: [
      {
        name: "years",
        label: "Comparison Horizon",
        suffix: "years",
        min: 1,
        max: 50,
        step: 1,
      },
    ],
  },
  {
    title: "Renting Assumptions",
    fields: [
      {
        name: "monthlyRent",
        label: "Starting Monthly Rent",
        suffix: "$/mo",
        min: 0,
        step: 50,
      },
      {
        name: "rentIncreasePct",
        label: "Annual Rent Increase",
        suffix: "%",
        step: 0.1,
      },
      {
        name: "rentersInsuranceMonthly",
        label: "Renter Insurance",
        suffix: "$/mo",
        min: 0,
        step: 5,
      },
    ],
  },
  {
    title: "Buying Assumptions",
    fields: [
      {
        name: "homePrice",
        label: "Home Purchase Price",
        suffix: "$",
        min: 0,
        step: 5000,
      },
      {
        name: "downPaymentPct",
        label: "Down Payment",
        suffix: "%",
        min: 0,
        max: 100,
        step: 1,
      },
      {
        name: "mortgageRatePct",
        label: "Mortgage Rate",
        suffix: "%",
        min: 0,
        step: 0.05,
      },
      {
        name: "loanTermYears",
        label: "Mortgage Term",
        suffix: "years",
        min: 1,
        max: 40,
        step: 1,
      },
      {
        name: "propertyTaxPct",
        label: "Property Tax",
        suffix: "%/yr",
        min: 0,
        step: 0.1,
      },
      {
        name: "homeInsuranceAnnual",
        label: "Home Insurance",
        suffix: "$/yr",
        min: 0,
        step: 100,
      },
      {
        name: "maintenancePct",
        label: "Maintenance",
        suffix: "%/yr",
        min: 0,
        step: 0.1,
      },
      {
        name: "hoaMonthly",
        label: "HOA Fees",
        suffix: "$/mo",
        min: 0,
        step: 25,
      },
      {
        name: "closingCostPct",
        label: "Closing Costs",
        suffix: "% of price",
        min: 0,
        step: 0.25,
      },
      {
        name: "sellingCostPct",
        label: "Selling Costs",
        suffix: "% of value",
        min: 0,
        step: 0.25,
      },
      {
        name: "homeAppreciationPct",
        label: "Home Appreciation",
        suffix: "%/yr",
        step: 0.1,
      },
    ],
  },
  {
    title: "Financial Assumptions",
    fields: [
      {
        name: "investmentReturnPct",
        label: "Investment Return (Renter)",
        suffix: "%/yr",
        step: 0.1,
      },
      {
        name: "annualInflationPct",
        label: "Inflation on Recurring Costs",
        suffix: "%/yr",
        step: 0.1,
      },
    ],
  },
];

const DEFAULT_RETIREMENT_INPUTS = {
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

const RETIREMENT_FIELD_GROUPS = [
  {
    title: "Timeline",
    fields: [
      {
        name: "currentAge",
        label: "Current Age",
        suffix: "years",
        min: 18,
        max: 90,
        step: 1,
      },
      {
        name: "retirementAge",
        label: "Retirement Age",
        suffix: "years",
        min: 40,
        max: 95,
        step: 1,
      },
      {
        name: "lifeExpectancy",
        label: "Life Expectancy",
        suffix: "years",
        min: 55,
        max: 110,
        step: 1,
      },
    ],
  },
  {
    title: "Savings & Growth",
    fields: [
      {
        name: "currentSavings",
        label: "Current Retirement Savings",
        suffix: "$",
        min: 0,
        step: 5000,
      },
      {
        name: "annualContribution",
        label: "Annual Contribution",
        suffix: "$/yr",
        min: 0,
        step: 500,
      },
      {
        name: "employerMatchAnnual",
        label: "Employer Match",
        suffix: "$/yr",
        min: 0,
        step: 500,
      },
      {
        name: "contributionGrowthPct",
        label: "Contribution Growth",
        suffix: "%/yr",
        step: 0.1,
      },
      {
        name: "preRetirementReturnPct",
        label: "Return Before Retirement",
        suffix: "%/yr",
        step: 0.1,
      },
      {
        name: "postRetirementReturnPct",
        label: "Return During Retirement",
        suffix: "%/yr",
        step: 0.1,
      },
      {
        name: "investmentDragPct",
        label: "Fees / Tax Drag",
        suffix: "%/yr",
        min: 0,
        step: 0.1,
      },
    ],
  },
  {
    title: "Monthly Expense Budget (Today)",
    fields: [
      {
        name: "monthlyHousing",
        label: "Housing",
        suffix: "$/mo",
        min: 0,
        step: 50,
      },
      {
        name: "monthlyUtilities",
        label: "Utilities",
        suffix: "$/mo",
        min: 0,
        step: 25,
      },
      {
        name: "monthlyFood",
        label: "Food & Groceries",
        suffix: "$/mo",
        min: 0,
        step: 25,
      },
      {
        name: "monthlyTransportation",
        label: "Transportation",
        suffix: "$/mo",
        min: 0,
        step: 25,
      },
      {
        name: "monthlyHealthcare",
        label: "Healthcare",
        suffix: "$/mo",
        min: 0,
        step: 25,
      },
      {
        name: "monthlyLifestyle",
        label: "Lifestyle",
        suffix: "$/mo",
        min: 0,
        step: 25,
      },
      {
        name: "monthlyTravel",
        label: "Travel",
        suffix: "$/mo",
        min: 0,
        step: 25,
      },
      {
        name: "monthlyOther",
        label: "Other",
        suffix: "$/mo",
        min: 0,
        step: 25,
      },
      {
        name: "annualNonMonthlyExpenses",
        label: "Annual Non-Monthly Costs",
        suffix: "$/yr",
        min: 0,
        step: 250,
      },
    ],
  },
  {
    title: "Retirement Cash Flow",
    fields: [
      {
        name: "socialSecurityAnnual",
        label: "Social Security at Retirement",
        suffix: "$/yr",
        min: 0,
        step: 500,
      },
      {
        name: "pensionAnnual",
        label: "Pension at Retirement",
        suffix: "$/yr",
        min: 0,
        step: 500,
      },
      {
        name: "benefitIncreasePct",
        label: "Income COLA (SS + Pension)",
        suffix: "%/yr",
        step: 0.1,
      },
      {
        name: "inflationPct",
        label: "Inflation",
        suffix: "%/yr",
        step: 0.1,
      },
      {
        name: "retirementIncomeTaxPct",
        label: "Retirement Income Tax Rate",
        suffix: "%",
        min: 0,
        max: 95,
        step: 0.5,
      },
      {
        name: "safeWithdrawalRatePct",
        label: "Safe Withdrawal Rule",
        suffix: "%",
        min: 0.5,
        max: 15,
        step: 0.1,
      },
    ],
  },
];

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compactMoneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function annualToMonthlyRate(ratePct) {
  const boundedRate = clamp(asNumber(ratePct, 0), -99, 1000) / 100;
  return Math.pow(1 + boundedRate, 1 / 12) - 1;
}

function annualRateMultiplier(ratePct) {
  return 1 + asNumber(ratePct, 0) / 100;
}

function calculateRentVsBuy(inputs) {
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
  let renterOutflow = 0;
  let renterInvestment = downPayment + closingCosts;

  const timeline = [];
  let breakEvenYear = null;

  for (let month = 1; month <= years * 12; month += 1) {
    if (month > 1) {
      rent *= 1 + monthlyRentGrowth;
      rentersInsurance *= 1 + monthlyInflation;
      homeInsurance *= 1 + monthlyInflation;
      hoa *= 1 + monthlyInflation;
      homeValue *= 1 + monthlyHomeGrowth;
    }

    renterInvestment *= 1 + monthlyInvestmentGrowth;

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

    const ownerMonthlyCost =
      mortgagePaymentThisMonth +
      propertyTaxThisMonth +
      maintenanceThisMonth +
      homeInsurance +
      hoa;
    const renterMonthlyCost = rent + rentersInsurance;

    ownerOutflow += ownerMonthlyCost;
    renterOutflow += renterMonthlyCost;

    renterInvestment += ownerMonthlyCost - renterMonthlyCost;

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
      ownerEquity: finalYear.ownerEquity,
      renterInvestment: finalYear.renterInvestment,
    },
  };
}

function calculateRetirement(inputs) {
  const currentAge = clamp(Math.round(asNumber(inputs.currentAge, 35)), 18, 90);
  const retirementAgeInput = clamp(Math.round(asNumber(inputs.retirementAge, 67)), 40, 95);
  const retirementAge = Math.max(retirementAgeInput, currentAge + 1);
  const lifeExpectancyInput = clamp(
    Math.round(asNumber(inputs.lifeExpectancy, 92)),
    55,
    110,
  );
  const lifeExpectancy = Math.max(lifeExpectancyInput, retirementAge + 1);

  const currentSavings = Math.max(asNumber(inputs.currentSavings, 0), 0);
  const annualContributionStart = Math.max(asNumber(inputs.annualContribution, 0), 0);
  const employerMatchStart = Math.max(asNumber(inputs.employerMatchAnnual, 0), 0);
  const contributionGrowthPct = asNumber(inputs.contributionGrowthPct, 0);
  const preRetirementReturnPct = asNumber(inputs.preRetirementReturnPct, 0);
  const postRetirementReturnPct = asNumber(inputs.postRetirementReturnPct, 0);
  const investmentDragPct = Math.max(asNumber(inputs.investmentDragPct, 0), 0);
  const inflationPct = asNumber(inputs.inflationPct, 0);
  const monthlyHousing = Math.max(asNumber(inputs.monthlyHousing, 0), 0);
  const monthlyUtilities = Math.max(asNumber(inputs.monthlyUtilities, 0), 0);
  const monthlyFood = Math.max(asNumber(inputs.monthlyFood, 0), 0);
  const monthlyTransportation = Math.max(asNumber(inputs.monthlyTransportation, 0), 0);
  const monthlyHealthcare = Math.max(asNumber(inputs.monthlyHealthcare, 0), 0);
  const monthlyLifestyle = Math.max(asNumber(inputs.monthlyLifestyle, 0), 0);
  const monthlyTravel = Math.max(asNumber(inputs.monthlyTravel, 0), 0);
  const monthlyOther = Math.max(asNumber(inputs.monthlyOther, 0), 0);
  const annualNonMonthlyExpenses = Math.max(
    asNumber(inputs.annualNonMonthlyExpenses, 0),
    0,
  );
  const socialSecurityStart = Math.max(asNumber(inputs.socialSecurityAnnual, 0), 0);
  const pensionStart = Math.max(asNumber(inputs.pensionAnnual, 0), 0);
  const benefitIncreasePct = asNumber(inputs.benefitIncreasePct, 0);
  const retirementIncomeTaxRate =
    clamp(asNumber(inputs.retirementIncomeTaxPct, 12), 0, 95) / 100;
  const safeWithdrawalRate =
    clamp(asNumber(inputs.safeWithdrawalRatePct, 4), 0.5, 15) / 100;

  const yearsToRetirement = retirementAge - currentAge;
  const yearsTotal = lifeExpectancy - currentAge;
  const contributionGrowth = annualRateMultiplier(contributionGrowthPct);
  const inflationGrowth = annualRateMultiplier(inflationPct);
  const benefitsGrowth = annualRateMultiplier(benefitIncreasePct);
  const inflationToRetirement = Math.pow(inflationGrowth, yearsToRetirement);

  const monthlyExpenseRows = [
    { label: "Housing", today: monthlyHousing },
    { label: "Utilities", today: monthlyUtilities },
    { label: "Food & Groceries", today: monthlyFood },
    { label: "Transportation", today: monthlyTransportation },
    { label: "Healthcare", today: monthlyHealthcare },
    { label: "Lifestyle", today: monthlyLifestyle },
    { label: "Travel", today: monthlyTravel },
    { label: "Other", today: monthlyOther },
    {
      label: "Non-Monthly Costs (Avg)",
      today: annualNonMonthlyExpenses / 12,
    },
  ];
  const plannedMonthlySpendToday = monthlyExpenseRows.reduce(
    (total, row) => total + row.today,
    0,
  );
  const annualSpendingToday = plannedMonthlySpendToday * 12;

  let balance = currentSavings;
  let annualContribution = annualContributionStart;
  let annualMatch = employerMatchStart;
  let socialSecurity = socialSecurityStart;
  let pension = pensionStart;
  const firstYearRetirementSpending = annualSpendingToday * inflationToRetirement;
  let retirementSpending = firstYearRetirementSpending;

  let cumulativeContributions = 0;
  let cumulativeWithdrawals = 0;
  let runOutAge = null;

  const firstYearNetGap = Math.max(
    firstYearRetirementSpending - socialSecurity - pension,
    0,
  );
  const firstYearGrossWithdrawalNeed =
    firstYearNetGap / Math.max(1 - retirementIncomeTaxRate, 0.01);
  const requiredNestEgg = firstYearGrossWithdrawalNeed / safeWithdrawalRate;
  const timeline = [];

  let balanceAtRetirement = currentSavings;

  for (let yearOffset = 0; yearOffset <= yearsTotal; yearOffset += 1) {
    const age = currentAge + yearOffset;
    const isRetired = age >= retirementAge;
    const grossReturnRate = isRetired ? postRetirementReturnPct : preRetirementReturnPct;
    const netReturnRate = grossReturnRate - investmentDragPct;

    balance *= annualRateMultiplier(netReturnRate);

    let contributionThisYear = 0;
    let withdrawalThisYear = 0;
    let incomeThisYear = 0;
    let spendingThisYear = 0;

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
        const grossWithdrawal = shortfall / Math.max(1 - retirementIncomeTaxRate, 0.01);
        withdrawalThisYear = grossWithdrawal;
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

      if (runOutAge === null && balance <= 0) {
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

  const finalBalance = timeline[timeline.length - 1].balance;
  const targetGap = requiredNestEgg - balanceAtRetirement;
  const retireReady = targetGap <= 0;
  const plannedMonthlySpendAtRetirement = firstYearRetirementSpending / 12;
  const sustainableGrossWithdrawal = balanceAtRetirement * safeWithdrawalRate;
  const sustainableNetPortfolioSpend =
    sustainableGrossWithdrawal * (1 - retirementIncomeTaxRate);
  const sustainableAnnualSpend =
    socialSecurityStart + pensionStart + sustainableNetPortfolioSpend;
  const sustainableMonthlySpend = sustainableAnnualSpend / 12;
  const monthlyBudgetDelta = sustainableMonthlySpend - plannedMonthlySpendAtRetirement;
  const monthlyGapAtRetirement = firstYearNetGap / 12;
  const monthlyBudgetRows = monthlyExpenseRows.map((row) => ({
    label: row.label,
    today: row.today,
    atRetirement: row.today * inflationToRetirement,
  }));

  return {
    assumptions: {
      currentAge,
      retirementAge,
      lifeExpectancy,
      yearsToRetirement,
      safeWithdrawalRate,
    },
    timeline,
    summary: {
      balanceAtRetirement,
      requiredNestEgg,
      finalBalance,
      targetGap,
      retireReady,
      runOutAge,
      cumulativeContributions,
      cumulativeWithdrawals,
      monthlyGapAtRetirement,
      firstYearGap: firstYearNetGap,
      plannedMonthlySpendToday,
      plannedMonthlySpendAtRetirement,
      sustainableMonthlySpend,
      sustainableAnnualSpend,
      monthlyBudgetDelta,
      monthlyBudgetRows,
      annualSpendingToday,
    },
  };
}

function formatMoney(value) {
  return moneyFormatter.format(value);
}

function formatCompactMoney(value) {
  return compactMoneyFormatter.format(value);
}

function NumberField({ field, value, onChange, idPrefix }) {
  const inputId = `${idPrefix}-${field.name}`;

  return (
    <label className="field" htmlFor={inputId}>
      <span className="field-label">{field.label}</span>
      <div className="field-input-wrap">
        <input
          id={inputId}
          className="field-input"
          type="number"
          value={value}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          onChange={(event) => onChange(field.name, event.target.value)}
        />
        {field.suffix ? <span className="field-suffix">{field.suffix}</span> : null}
      </div>
    </label>
  );
}

function CollapsibleInputGroup({
  group,
  groupIndex,
  idPrefix,
  inputs,
  isExpanded,
  onToggle,
  onFieldChange,
}) {
  const contentId = `${idPrefix}-group-${groupIndex}-content`;

  return (
    <section className="input-group">
      <button
        className="group-toggle"
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={contentId}
      >
        <span className="group-title">{group.title}</span>
        <span className="group-toggle-label">{isExpanded ? "Hide" : "Show"}</span>
      </button>
      {isExpanded ? (
        <div className="field-grid" id={contentId}>
          {group.fields.map((field) => (
            <NumberField
              key={field.name}
              field={field}
              value={inputs[field.name]}
              idPrefix={idPrefix}
              onChange={onFieldChange}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PageHeader({ title, description, toggleLabel, onToggle }) {
  return (
    <header className="hero">
      <div className="hero-top">
        <div>
          <p className="eyebrow">Interactive Financial Model</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <button className="mode-toggle" onClick={onToggle}>
          {toggleLabel}
        </button>
      </div>
    </header>
  );
}

function RentVsBuyChart({ timeline }) {
  if (!timeline.length) return null;

  const width = 760;
  const height = 340;
  const pad = { top: 24, right: 24, bottom: 42, left: 76 };
  const graphWidth = width - pad.left - pad.right;
  const graphHeight = height - pad.top - pad.bottom;
  const denominator = Math.max(timeline.length - 1, 1);

  const values = timeline.flatMap((point) => [point.renterNetCost, point.ownerNetCost]);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  const getX = (index) => pad.left + (index / denominator) * graphWidth;
  const getY = (value) =>
    pad.top + (1 - (value - minValue) / range) * graphHeight;

  const rentPolyline = timeline
    .map((point, index) => `${getX(index)},${getY(point.renterNetCost)}`)
    .join(" ");
  const buyPolyline = timeline
    .map((point, index) => `${getX(index)},${getY(point.ownerNetCost)}`)
    .join(" ");

  const yTicks = Array.from({ length: 6 }, (_, index) => {
    const ratio = index / 5;
    return {
      value: maxValue - ratio * range,
      y: pad.top + ratio * graphHeight,
    };
  });

  const xLabelInterval = Math.max(Math.ceil(timeline.length / 8), 1);

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3>Net Cost Over Time</h3>
        <p>Net cost = total cash outflows minus current assets.</p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="line-chart" role="img">
        {yTicks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={pad.left}
              y1={tick.y}
              x2={width - pad.right}
              y2={tick.y}
              className="grid-line"
            />
            <text x={pad.left - 10} y={tick.y + 4} className="axis-label">
              {formatCompactMoney(tick.value)}
            </text>
          </g>
        ))}
        <polyline points={rentPolyline} className="line rent-line" />
        <polyline points={buyPolyline} className="line buy-line" />
        {timeline.map((point, index) => {
          if (index % xLabelInterval !== 0 && index !== timeline.length - 1) return null;
          const x = getX(index);
          return (
            <g key={point.year}>
              <line
                x1={x}
                y1={height - pad.bottom}
                x2={x}
                y2={height - pad.bottom + 8}
                className="axis-tick"
              />
              <text x={x} y={height - 14} textAnchor="middle" className="axis-label">
                Y{point.year}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="chart-legend">
        <span>
          <i className="legend-swatch rent" />
          Renting
        </span>
        <span>
          <i className="legend-swatch buy" />
          Buying
        </span>
      </div>
    </div>
  );
}

function RentVsBuyBreakdown({ summary, years }) {
  const rows = [
    {
      label: `Net cost after ${years} years`,
      rentValue: summary.renterNetCost,
      buyValue: summary.ownerNetCost,
    },
    {
      label: "Total cash paid",
      rentValue: summary.renterOutflow,
      buyValue: summary.ownerOutflow,
    },
    {
      label: "Asset value at end",
      rentValue: summary.renterInvestment,
      buyValue: summary.ownerEquity,
    },
  ];

  const maxValue = Math.max(
    ...rows.flatMap((row) => [Math.abs(row.rentValue), Math.abs(row.buyValue)]),
    1,
  );

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3>Scenario Breakdown</h3>
        <p>Absolute bar length reflects amount in each category.</p>
      </div>
      <div className="breakdown-grid">
        {rows.map((row) => (
          <div key={row.label} className="breakdown-row">
            <div className="breakdown-label">{row.label}</div>
            <div className="breakdown-values">
              <span>Rent {formatMoney(row.rentValue)}</span>
              <span>Buy {formatMoney(row.buyValue)}</span>
            </div>
            <div className="bar-track">
              <div
                className="bar rent"
                style={{ width: `${(Math.abs(row.rentValue) / maxValue) * 100}%` }}
              />
            </div>
            <div className="bar-track">
              <div
                className="bar buy"
                style={{ width: `${(Math.abs(row.buyValue) / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RetirementBalanceChart({ timeline, retirementAge }) {
  if (!timeline.length) return null;

  const width = 760;
  const height = 340;
  const pad = { top: 24, right: 24, bottom: 42, left: 76 };
  const graphWidth = width - pad.left - pad.right;
  const graphHeight = height - pad.top - pad.bottom;
  const denominator = Math.max(timeline.length - 1, 1);

  const values = timeline.map((point) => point.balance);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(...values, 1);
  const range = maxValue - minValue || 1;

  const getX = (index) => pad.left + (index / denominator) * graphWidth;
  const getY = (value) =>
    pad.top + (1 - (value - minValue) / range) * graphHeight;

  const polyline = timeline
    .map((point, index) => `${getX(index)},${getY(point.balance)}`)
    .join(" ");

  const yTicks = Array.from({ length: 6 }, (_, index) => {
    const ratio = index / 5;
    return {
      value: maxValue - ratio * range,
      y: pad.top + ratio * graphHeight,
    };
  });

  const xLabelInterval = Math.max(Math.ceil(timeline.length / 8), 1);
  const retirementIndex = timeline.findIndex((point) => point.age === retirementAge);
  const retirementX = retirementIndex >= 0 ? getX(retirementIndex) : null;

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3>Portfolio Balance By Age</h3>
        <p>Includes contributions, growth, withdrawals, inflation, and taxes.</p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="line-chart" role="img">
        {yTicks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={pad.left}
              y1={tick.y}
              x2={width - pad.right}
              y2={tick.y}
              className="grid-line"
            />
            <text x={pad.left - 10} y={tick.y + 4} className="axis-label">
              {formatCompactMoney(tick.value)}
            </text>
          </g>
        ))}
        {retirementX !== null ? (
          <g>
            <line
              x1={retirementX}
              y1={pad.top}
              x2={retirementX}
              y2={height - pad.bottom}
              className="retirement-marker"
            />
            <text
              x={retirementX}
              y={pad.top - 4}
              textAnchor="middle"
              className="axis-label"
            >
              Retirement
            </text>
          </g>
        ) : null}
        <polyline points={polyline} className="line retirement-line" />
        {timeline.map((point, index) => {
          if (index % xLabelInterval !== 0 && index !== timeline.length - 1) return null;
          const x = getX(index);
          return (
            <g key={point.age}>
              <line
                x1={x}
                y1={height - pad.bottom}
                x2={x}
                y2={height - pad.bottom + 8}
                className="axis-tick"
              />
              <text x={x} y={height - 14} textAnchor="middle" className="axis-label">
                {point.age}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="chart-legend">
        <span>
          <i className="legend-swatch retirement" />
          Portfolio Balance
        </span>
      </div>
    </div>
  );
}

function RetirementBreakdown({ summary }) {
  const rows = [
    {
      label: "Balance At Retirement",
      value: summary.balanceAtRetirement,
      color: "retirement",
    },
    {
      label: "Target Nest Egg",
      value: summary.requiredNestEgg,
      color: "target",
    },
    {
      label: "Planned Annual Spend At Retirement",
      value: summary.plannedMonthlySpendAtRetirement * 12,
      color: "target",
    },
    {
      label: "Sustainable Annual Spend",
      value: summary.sustainableAnnualSpend,
      color: "retirement",
    },
    {
      label: "Projected End Balance",
      value: summary.finalBalance,
      color: "buy",
    },
    {
      label: "Total Contributions / Surplus",
      value: summary.cumulativeContributions,
      color: "buy",
    },
    {
      label: "Total Withdrawals",
      value: summary.cumulativeWithdrawals,
      color: "rent",
    },
  ];

  const maxValue = Math.max(...rows.map((row) => Math.abs(row.value)), 1);

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3>Retirement Breakdown</h3>
        <p>Bars compare your target, savings progress, and retirement cashflow.</p>
      </div>
      <div className="breakdown-grid">
        {rows.map((row) => (
          <div key={row.label} className="breakdown-row">
            <div className="breakdown-values">
              <span>{row.label}</span>
              <span>{formatMoney(row.value)}</span>
            </div>
            <div className="bar-track">
              <div
                className={`bar ${row.color}`}
                style={{ width: `${(Math.abs(row.value) / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RetirementMonthlyBudget({ summary }) {
  const deltaIsPositive = summary.monthlyBudgetDelta >= 0;

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3>Monthly Budget At Retirement</h3>
        <p>
          Planned monthly expenses are inflated to retirement age and compared against
          estimated sustainable monthly spending.
        </p>
      </div>

      <div className="budget-metric-grid">
        <article className="budget-metric">
          <h4>Planned Monthly Spend</h4>
          <p>{formatMoney(summary.plannedMonthlySpendAtRetirement)}</p>
        </article>
        <article className="budget-metric">
          <h4>Sustainable Monthly Spend</h4>
          <p>{formatMoney(summary.sustainableMonthlySpend)}</p>
        </article>
        <article className="budget-metric">
          <h4>Monthly Cushion / Gap</h4>
          <p className={deltaIsPositive ? "budget-positive" : "budget-negative"}>
            {deltaIsPositive ? "+" : "-"}
            {formatMoney(Math.abs(summary.monthlyBudgetDelta))}
          </p>
        </article>
      </div>

      <div className="budget-table">
        <div className="budget-row budget-header">
          <span>Category</span>
          <span>Today</span>
          <span>At Retirement</span>
        </div>
        {summary.monthlyBudgetRows.map((row) => (
          <div key={row.label} className="budget-row">
            <span>{row.label}</span>
            <span>{formatMoney(row.today)}</span>
            <span>{formatMoney(row.atRetirement)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RentVsBuyPage({ inputs, setInputs, onSwitch }) {
  const [expandedGroups, setExpandedGroups] = useState(() =>
    RENT_BUY_FIELD_GROUPS.map(() => true),
  );
  const analysis = useMemo(() => calculateRentVsBuy(inputs), [inputs]);
  const totalMonthlyOwnerCost = useMemo(
    () => computeTotalMonthlyOwnerCost(inputs),
    [inputs],
  );
  const { assumptions, summary, timeline } = analysis;
  const metricCards = [
    {
      title: "Renting Net Cost",
      value: formatMoney(summary.renterNetCost),
    },
    {
      title: "Buying Net Cost",
      value: formatMoney(summary.ownerNetCost),
    },
    {
      title: "Estimated Mortgage Payment",
      value: `${formatMoney(assumptions.monthlyMortgagePayment)}/mo`,
    },
    {
      title: "Total Monthly Owner Cost",
      value: formatMonthlyOwnerCost(totalMonthlyOwnerCost),
      helpText:
        "Includes principal & interest + tax + insurance + HOA + maintenance. One-time costs excluded.",
    },
  ];

  const outcomeMessage =
    summary.winner === "buy"
      ? `Buying is lower by ${formatMoney(summary.costDifference)} over ${assumptions.years} years.`
      : summary.winner === "rent"
        ? `Renting is lower by ${formatMoney(Math.abs(summary.costDifference))} over ${assumptions.years} years.`
        : "Both scenarios end with the same estimated net cost.";

  return (
    <div className="page">
      <PageHeader
        title="Rent vs Buy Calculator"
        description="Adjust assumptions and compare long-term housing costs, taxes, maintenance, equity, and investment opportunity cost in real time."
        toggleLabel="Retirement Calculator"
        onToggle={onSwitch}
      />

      <div className="layout">
        <aside className="panel controls-panel">
          <div className="panel-title-row">
            <h2>Inputs</h2>
            <button className="ghost-button" onClick={() => setInputs(DEFAULT_RENT_BUY_INPUTS)}>
              Reset
            </button>
          </div>
          {RENT_BUY_FIELD_GROUPS.map((group, groupIndex) => (
            <CollapsibleInputGroup
              key={group.title}
              group={group}
              groupIndex={groupIndex}
              idPrefix="rent-buy"
              inputs={inputs}
              isExpanded={expandedGroups[groupIndex]}
              onToggle={() =>
                setExpandedGroups((previous) =>
                  previous.map((isOpen, index) =>
                    index === groupIndex ? !isOpen : isOpen,
                  ),
                )
              }
              onFieldChange={(name, value) =>
                setInputs((previous) => ({
                  ...previous,
                  [name]: value,
                }))
              }
            />
          ))}
        </aside>

        <main className="panel results-panel">
          <section className="outcome">
            <p className="result-line">{outcomeMessage}</p>
            <div className="metric-grid">
              {metricCards.map((card) => (
                <article key={card.title}>
                  <h4>{card.title}</h4>
                  <p>{card.value}</p>
                  {card.helpText ? (
                    <small className="metric-help" title={card.helpText}>
                      {card.helpText}
                    </small>
                  ) : null}
                </article>
              ))}
            </div>
            <p className="result-subline">
              {summary.breakEvenYear
                ? `Estimated break-even: year ${summary.breakEvenYear.toFixed(1)}.`
                : `No break-even point within ${assumptions.years} years.`}
            </p>
          </section>

          <RentVsBuyChart timeline={timeline} />
          <RentVsBuyBreakdown summary={summary} years={assumptions.years} />
        </main>
      </div>
    </div>
  );
}

function RetirementPage({ inputs, setInputs, onSwitch }) {
  const [expandedGroups, setExpandedGroups] = useState(() =>
    RETIREMENT_FIELD_GROUPS.map(() => true),
  );
  const analysis = useMemo(() => calculateRetirement(inputs), [inputs]);
  const { assumptions, summary, timeline } = analysis;

  const outcomeMessage = summary.retireReady
    ? `On track: projected balance beats your withdrawal-rule target by ${formatMoney(
        Math.abs(summary.targetGap),
      )} at retirement.`
    : `Gap to target: increase projected retirement assets by ${formatMoney(
        Math.abs(summary.targetGap),
      )} to meet your withdrawal-rule target.`;
  const monthlyBudgetMessage =
    summary.monthlyBudgetDelta >= 0
      ? `Estimated monthly cushion at retirement: ${formatMoney(
          summary.monthlyBudgetDelta,
        )}.`
      : `Estimated monthly shortfall at retirement: ${formatMoney(
          Math.abs(summary.monthlyBudgetDelta),
        )}.`;

  return (
    <div className="page">
      <PageHeader
        title="Retirement Calculator"
        description="Model retirement readiness using savings, contributions, market returns, inflation, taxes, Social Security, and pension income."
        toggleLabel="Rent vs Buy Calculator"
        onToggle={onSwitch}
      />

      <div className="layout">
        <aside className="panel controls-panel">
          <div className="panel-title-row">
            <h2>Inputs</h2>
            <button
              className="ghost-button"
              onClick={() => setInputs(DEFAULT_RETIREMENT_INPUTS)}
            >
              Reset
            </button>
          </div>
          {RETIREMENT_FIELD_GROUPS.map((group, groupIndex) => (
            <CollapsibleInputGroup
              key={group.title}
              group={group}
              groupIndex={groupIndex}
              idPrefix="retirement"
              inputs={inputs}
              isExpanded={expandedGroups[groupIndex]}
              onToggle={() =>
                setExpandedGroups((previous) =>
                  previous.map((isOpen, index) =>
                    index === groupIndex ? !isOpen : isOpen,
                  ),
                )
              }
              onFieldChange={(name, value) =>
                setInputs((previous) => ({
                  ...previous,
                  [name]: value,
                }))
              }
            />
          ))}
        </aside>

        <main className="panel results-panel">
          <section className="outcome">
            <p className="result-line">{outcomeMessage}</p>
            <div className="metric-grid">
              <article>
                <h4>Balance At Retirement</h4>
                <p>{formatMoney(summary.balanceAtRetirement)}</p>
              </article>
              <article>
                <h4>Withdrawal-Rule Target</h4>
                <p>{formatMoney(summary.requiredNestEgg)}</p>
              </article>
              <article>
                <h4>Sustainable Monthly Spend</h4>
                <p>{formatMoney(summary.sustainableMonthlySpend)}</p>
              </article>
            </div>
            <p className="result-subline">
              {summary.runOutAge
                ? `Portfolio depletes around age ${summary.runOutAge}. ${monthlyBudgetMessage}`
                : `Portfolio remains funded through age ${assumptions.lifeExpectancy}. ${monthlyBudgetMessage}`}
            </p>
          </section>

          <RetirementBalanceChart
            timeline={timeline}
            retirementAge={assumptions.retirementAge}
          />
          <RetirementMonthlyBudget summary={summary} />
          <RetirementBreakdown summary={summary} />
        </main>
      </div>
    </div>
  );
}

function App() {
  const [mode, setMode] = useState(APP_MODE.RENT_BUY);
  const [rentBuyInputs, setRentBuyInputs] = useState(DEFAULT_RENT_BUY_INPUTS);
  const [retirementInputs, setRetirementInputs] = useState(DEFAULT_RETIREMENT_INPUTS);

  if (mode === APP_MODE.RENT_BUY) {
    return (
      <RentVsBuyPage
        inputs={rentBuyInputs}
        setInputs={setRentBuyInputs}
        onSwitch={() => setMode(APP_MODE.RETIREMENT)}
      />
    );
  }

  return (
    <RetirementPage
      inputs={retirementInputs}
      setInputs={setRetirementInputs}
      onSwitch={() => setMode(APP_MODE.RENT_BUY)}
    />
  );
}

export default App;
