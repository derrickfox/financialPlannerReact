import assert from "node:assert/strict";
import test from "node:test";
import {
  computeMonthlyOwnerCostBreakdown,
  computeTotalMonthlyOwnerCost,
  formatMonthlyOwnerCost,
} from "./rentVsBuyOwnerCost.js";

function assertCloseTo(actual, expected, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("converts yearly taxes/insurance/maintenance to monthly and totals correctly", () => {
  const breakdown = computeMonthlyOwnerCostBreakdown({
    homePrice: 240000,
    downPaymentPct: 100,
    mortgageRatePct: 6.5,
    loanTermYears: 30,
    propertyTaxPct: 1.2,
    homeInsuranceAnnual: 1200,
    hoaMonthly: 350,
    maintenancePct: 1,
  });

  assert.equal(breakdown.principalInterestMonthly, 0);
  assertCloseTo(breakdown.propertyTaxMonthly, 240, 1e-6);
  assertCloseTo(breakdown.homeInsuranceMonthly, 100, 1e-6);
  assertCloseTo(breakdown.hoaMonthly, 350, 1e-6);
  assertCloseTo(breakdown.maintenanceMonthly, 200, 1e-6);
  assertCloseTo(breakdown.total, 890, 1e-6);
});

test("computes Redfin-style all-in monthly owner cost using P&I + tax + insurance + HOA + maintenance", () => {
  const breakdown = computeMonthlyOwnerCostBreakdown({
    homePrice: 530000,
    downPaymentPct: 20,
    mortgageRatePct: 6.38,
    loanTermYears: 30,
    propertyTaxPct: 0.86,
    homeInsuranceAnnual: 960,
    hoaMonthly: 953,
    maintenancePct: 0,
  });

  assertCloseTo(breakdown.principalInterestMonthly, 2646.595, 0.01);
  assertCloseTo(breakdown.propertyTaxMonthly, 379.833, 0.01);
  assertCloseTo(breakdown.homeInsuranceMonthly, 80, 1e-6);
  assertCloseTo(breakdown.hoaMonthly, 953, 1e-6);
  assertCloseTo(breakdown.maintenanceMonthly, 0, 1e-6);
  assertCloseTo(breakdown.total, 4059.428, 0.01);
});

test("falls back consistently for invalid numeric inputs", () => {
  const breakdown = computeMonthlyOwnerCostBreakdown({
    homePrice: "abc",
    downPaymentPct: "xyz",
    mortgageRatePct: "n/a",
    loanTermYears: "n/a",
    propertyTaxPct: "n/a",
    homeInsuranceAnnual: "n/a",
    hoaMonthly: "n/a",
    maintenancePct: "n/a",
  });

  assert.equal(breakdown.principalInterestMonthly, 0);
  assert.equal(breakdown.propertyTaxMonthly, 0);
  assert.equal(breakdown.homeInsuranceMonthly, 0);
  assert.equal(breakdown.hoaMonthly, 0);
  assert.equal(breakdown.maintenanceMonthly, 0);
  assert.equal(breakdown.total, 0);
});

test("returns the summed monthly owner total", () => {
  const total = computeTotalMonthlyOwnerCost({
    homePrice: 240000,
    downPaymentPct: 100,
    propertyTaxPct: 1.2,
    homeInsuranceAnnual: 1200,
    hoaMonthly: 350,
    maintenancePct: 1,
  });

  assertCloseTo(total, 890, 1e-6);
});

test("formats and rounds to whole-dollar /mo output", () => {
  assert.equal(formatMonthlyOwnerCost(4059.4284255341095), "$4,059/mo");
  assert.equal(formatMonthlyOwnerCost(4058.4), "$4,058/mo");
});
