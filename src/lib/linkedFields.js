// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Declares the assumptions the two calculators share, so editing one updates the
//          other. Also derives the retirement budget's housing line from the rent-vs-buy
//          outcome.
// Reason: The calculators model the same household but kept independent copies of the same
//         economic assumptions under different names — inflation was 2% on one page and
//         2.5% on the other, and the market return was 5% vs 7%. Nothing reconciled them, so
//         a user could tune one page and get answers from the other that silently
//         contradicted it.

/**
 * Assumptions that are literally the same quantity on both pages, stored under different
 * field names. Editing either side writes both.
 *
 * Note the retirement side links to `preRetirementReturnPct`, not `postRetirementReturnPct`:
 * the rent-vs-buy horizon is a working-years horizon, so it shares the working-years return.
 * The post-retirement return stays independent because it reflects a deliberately more
 * conservative allocation.
 */
export const LINKED_FIELDS = [
  {
    key: "inflation",
    rentBuy: "annualInflationPct",
    retirement: "inflationPct",
  },
  {
    key: "marketReturn",
    rentBuy: "investmentReturnPct",
    retirement: "preRetirementReturnPct",
  },
];

export const LINKED_FIELD_NOTE =
  "Shared with the other calculator — changing it here changes it there too.";

export function isLinkedField(page, fieldName) {
  return LINKED_FIELDS.some((link) => link[page] === fieldName);
}

/**
 * Given a change on one page, returns the field name to mirror on the other page, or null
 * when the field is not shared.
 */
export function getLinkedCounterpart(fromPage, fieldName) {
  const toPage = fromPage === "rentBuy" ? "retirement" : "rentBuy";
  const link = LINKED_FIELDS.find((entry) => entry[fromPage] === fieldName);
  return link ? link[toPage] : null;
}

// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Drops mortgage principal & interest from the derived housing cost when the loan
//          is scheduled to be repaid before the user retires.
// Reason: The first version pushed the full all-in owner cost into the retirement budget,
//         which charged a retiree for a mortgage they no longer have. On the shipped
//         defaults the 30-year loan is repaid at age 65 but retirement is at 67, so the
//         budget carried $2,528/mo of phantom P&I — enough to move the plan from funded to
//         running dry at 88.
/**
 * The monthly housing cost implied by the rent-vs-buy comparison, in today's dollars.
 *
 * Uses whichever scenario the comparison favours, so the retirement budget's housing line
 * follows the housing decision the other page is recommending. When buying wins, principal
 * and interest are included only if the loan outlives the accumulation period — everything
 * else (tax, insurance, HOA, maintenance) continues for as long as the home is owned.
 *
 * Renting carries its full cost forever, since rent does not get paid off.
 */
export function getDerivedMonthlyHousing({
  winner,
  ownerCostBreakdown,
  monthlyRent,
  loanTermYears,
  yearsToRetirement,
}) {
  if (winner === "rent") {
    return monthlyRent;
  }

  const mortgageOutlivesAccumulation = loanTermYears > yearsToRetirement;

  return mortgageOutlivesAccumulation
    ? ownerCostBreakdown.total
    : ownerCostBreakdown.total - ownerCostBreakdown.principalInterestMonthly;
}

/**
 * Explains the derived housing figure so the retirement page can say where it came from
 * and whether a mortgage is still being paid at that point.
 */
export function describeDerivedHousing({ winner, loanTermYears, yearsToRetirement }) {
  if (winner === "rent") {
    return "Comes from the Rent vs Buy calculator: rent plus renter's insurance, since rent continues through retirement.";
  }

  return loanTermYears > yearsToRetirement
    ? "Comes from the Rent vs Buy calculator: full ownership cost, because the mortgage is still being repaid when you retire."
    : "Comes from the Rent vs Buy calculator: ownership cost excluding mortgage principal & interest, because the loan is repaid before you retire.";
}
