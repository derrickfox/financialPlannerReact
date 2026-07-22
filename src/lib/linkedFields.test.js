// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Covers the shared-assumption mapping and the derived retirement housing figure.
// Reason: The link between the calculators is easy to break silently — a renamed field on
//         either page would just stop syncing with no visible error — and the housing
//         derivation has a mortgage-payoff branch that materially changes the retirement
//         verdict.

import assert from "node:assert/strict";
import test from "node:test";

import {
  LINKED_FIELDS,
  describeDerivedHousing,
  getDerivedMonthlyHousing,
  getLinkedCounterpart,
  isLinkedField,
} from "./linkedFields.js";
import { computeMonthlyOwnerCostBreakdown } from "./rentVsBuyOwnerCost.js";
import {
  DEFAULT_RENT_BUY_INPUTS,
  DEFAULT_RETIREMENT_INPUTS,
} from "./defaults.js";

// --- Link integrity ----------------------------------------------------------

test("every linked field name exists on the page it claims to belong to", () => {
  for (const link of LINKED_FIELDS) {
    assert.ok(
      link.rentBuy in DEFAULT_RENT_BUY_INPUTS,
      `${link.rentBuy} is not a rent-vs-buy input`,
    );
    assert.ok(
      link.retirement in DEFAULT_RETIREMENT_INPUTS,
      `${link.retirement} is not a retirement input`,
    );
  }
});

test("linked fields start out agreeing across both default sets", () => {
  for (const link of LINKED_FIELDS) {
    assert.equal(
      DEFAULT_RENT_BUY_INPUTS[link.rentBuy],
      DEFAULT_RETIREMENT_INPUTS[link.retirement],
      `${link.key} defaults disagree, so the pages would contradict each other on load`,
    );
  }
});

test("counterpart lookup round-trips in both directions", () => {
  for (const link of LINKED_FIELDS) {
    assert.equal(getLinkedCounterpart("rentBuy", link.rentBuy), link.retirement);
    assert.equal(getLinkedCounterpart("retirement", link.retirement), link.rentBuy);
    assert.ok(isLinkedField("rentBuy", link.rentBuy));
    assert.ok(isLinkedField("retirement", link.retirement));
  }
});

test("unshared fields report no counterpart", () => {
  assert.equal(getLinkedCounterpart("rentBuy", "homePrice"), null);
  assert.equal(getLinkedCounterpart("retirement", "postRetirementReturnPct"), null);
  assert.equal(isLinkedField("retirement", "postRetirementReturnPct"), false);
});

// --- Derived housing ---------------------------------------------------------

const breakdown = computeMonthlyOwnerCostBreakdown(DEFAULT_RENT_BUY_INPUTS);

test("renting carries its full cost into retirement", () => {
  const housing = getDerivedMonthlyHousing({
    winner: "rent",
    ownerCostBreakdown: breakdown,
    monthlyRent: 3322,
    loanTermYears: 30,
    yearsToRetirement: 32,
  });
  assert.equal(housing, 3322, "rent does not get paid off");
});

test("a mortgage repaid before retirement is excluded from the housing budget", () => {
  const housing = getDerivedMonthlyHousing({
    winner: "buy",
    ownerCostBreakdown: breakdown,
    monthlyRent: 3322,
    loanTermYears: 30,
    yearsToRetirement: 32, // loan done at year 30, retirement at year 32
  });
  assert.ok(breakdown.principalInterestMonthly > 0, "sanity: there is a mortgage");
  assert.ok(
    Math.abs(housing - (breakdown.total - breakdown.principalInterestMonthly)) < 1e-9,
    "P&I should drop out once the loan is repaid",
  );
  assert.ok(housing < breakdown.total);
});

test("a mortgage still running at retirement stays in the housing budget", () => {
  const housing = getDerivedMonthlyHousing({
    winner: "buy",
    ownerCostBreakdown: breakdown,
    monthlyRent: 3322,
    loanTermYears: 30,
    yearsToRetirement: 10, // retiring long before the loan is repaid
  });
  assert.ok(
    Math.abs(housing - breakdown.total) < 1e-9,
    "full ownership cost applies while the loan runs",
  );
});

test("ongoing ownership costs survive mortgage payoff", () => {
  // Tax, insurance, HOA and maintenance do not stop when the loan does.
  const housing = getDerivedMonthlyHousing({
    winner: "buy",
    ownerCostBreakdown: breakdown,
    monthlyRent: 3322,
    loanTermYears: 15,
    yearsToRetirement: 32,
  });
  const ongoing =
    breakdown.propertyTaxMonthly +
    breakdown.homeInsuranceMonthly +
    breakdown.hoaMonthly +
    breakdown.maintenanceMonthly;
  assert.ok(Math.abs(housing - ongoing) < 1e-9, "only P&I should disappear");
  assert.ok(housing > 0);
});

test("the explanation matches which branch was taken", () => {
  assert.match(
    describeDerivedHousing({ winner: "rent", loanTermYears: 30, yearsToRetirement: 32 }),
    /rent continues/i,
  );
  assert.match(
    describeDerivedHousing({ winner: "buy", loanTermYears: 30, yearsToRetirement: 32 }),
    /repaid before you retire/i,
  );
  assert.match(
    describeDerivedHousing({ winner: "buy", loanTermYears: 30, yearsToRetirement: 10 }),
    /still being repaid/i,
  );
});
