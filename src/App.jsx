import { useEffect, useMemo, useState } from "react";
import {
  computeMonthlyOwnerCostBreakdown,
  computeTotalMonthlyOwnerCost,
  formatMonthlyOwnerCost,
} from "./lib/rentVsBuyOwnerCost";
// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Sources the projection models and default inputs from plain modules in src/lib
//          instead of defining them inline in this component file.
// Reason: Keeps the math importable by `node --test`. The component tree below is now
//         presentation-only, so a failing number can be traced to a specific lib module.
import { clamp } from "./lib/finance";
import {
  LINKED_FIELDS,
  LINKED_FIELD_NOTE,
  describeDerivedHousing,
  getDerivedMonthlyHousing,
  getLinkedCounterpart,
  isLinkedField,
} from "./lib/linkedFields";
import { calculateRentVsBuy } from "./lib/rentVsBuy";
import { calculateRetirement } from "./lib/retirement";
import {
  DEFAULT_RENT_BUY_INPUTS,
  DEFAULT_RETIREMENT_INPUTS,
} from "./lib/defaults";

const APP_MODE = {
  HUB: "hub",
  RENT_BUY: "rent-buy",
  RETIREMENT: "retirement",
};

function getInitialMode() {
  if (typeof window === "undefined") {
    return APP_MODE.HUB;
  }

  const mode = new URLSearchParams(window.location.search).get("mode");
  return Object.values(APP_MODE).includes(mode) ? mode : APP_MODE.HUB;
}

const HUB_APPS = [
  {
    name: "Deb8",
    category: "Discussion workspace",
    description:
      "Run structured debate sessions, weigh opposing arguments, and keep the conversation moving toward a clear decision.",
    accent: "deb8",
    actionLabel: "Open Deb8",
    href: "https://gen-lang-client-0682789775.web.app",
    isExternal: true,
  },
  {
    name: "DC Map Layers",
    category: "Geographic analysis",
    description:
      "Explore layered DC map data, filter spatial views, and compare neighborhood context from one interactive map surface.",
    accent: "maps",
    actionLabel: "Open Map Layers",
    href: "https://bookmarker-9ac68.web.app",
    isExternal: true,
  },
  {
    name: "RentVsBuy",
    category: "Financial calculators",
    description:
      "Compare housing choices and retirement readiness with editable assumptions, charts, and scenario breakdowns.",
    accent: "rentbuy",
    actionLabel: "Open RentVsBuy",
    mode: APP_MODE.RENT_BUY,
  },
];

const RENT_BUY_FIELD_GROUPS = [
  {
    title: "Time Horizon",
    fields: [
      {
        name: "years",
        label: "Comparison Horizon",
        tooltip: "How many years to compare renting vs. buying. Longer horizons typically favor buying as equity accumulates.",
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
        tooltip: "Expected yearly rent hike. U.S. rents have historically risen 3–5% per year.",
        suffix: "%",
        step: 0.1,
      },
      {
        name: "rentersInsuranceMonthly",
        label: "Renter Insurance",
        tooltip: "Monthly premium covering personal belongings and personal liability — typically $15–30/mo.",
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
        tooltip: "Percentage of purchase price paid upfront. Putting down 20% avoids private mortgage insurance (PMI).",
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
        tooltip: "Annual property tax as a percentage of home value. Rates vary by location — 0.5% to 2.5% is typical in the U.S.",
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
        tooltip: "Annual repair and upkeep cost as a percentage of home value. The common '1% rule' is a starting point; older homes may cost more.",
        suffix: "%/yr",
        min: 0,
        step: 0.1,
      },
      {
        name: "hoaMonthly",
        label: "HOA Fees",
        tooltip: "Monthly Homeowners Association fee covering shared amenities, exterior maintenance, and community management. Enter 0 if not applicable.",
        suffix: "$/mo",
        min: 0,
        step: 25,
      },
      {
        name: "closingCostPct",
        label: "Closing Costs",
        tooltip: "One-time fees at purchase: lender origination, title insurance, escrow, and prepaid items. Typically 2–5% of the purchase price.",
        suffix: "% of price",
        min: 0,
        step: 0.25,
      },
      {
        name: "sellingCostPct",
        label: "Selling Costs",
        tooltip: "Costs to sell the home at the end of the horizon — mainly agent commissions. Typically 5–6% of sale price. Reduces net equity.",
        suffix: "% of value",
        min: 0,
        step: 0.25,
      },
      {
        name: "homeAppreciationPct",
        label: "Home Appreciation",
        tooltip: "Expected annual increase in the home's market value. Historically ~3–4% nationally, but varies widely by market and location.",
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
        tooltip: "Annual return on money a renter invests instead of tying up in a down payment and ongoing ownership costs.",
        suffix: "%/yr",
        step: 0.1,
      },
      {
        name: "annualInflationPct",
        label: "Inflation on Recurring Costs",
        tooltip: "Annual rate at which ongoing costs like insurance, HOA, and maintenance grow over time.",
        suffix: "%/yr",
        step: 0.1,
      },
    ],
  },
];

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
        tooltip: "Planning horizon for your portfolio — how long it needs to last. Estimating conservatively (e.g. age 95) builds in a longevity buffer.",
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
        tooltip: "Annual employer 401(k) match or other employer contributions added to your retirement accounts.",
        suffix: "$/yr",
        min: 0,
        step: 500,
      },
      {
        name: "contributionGrowthPct",
        label: "Contribution Growth",
        tooltip: "Annual rate at which your contributions increase each year — typically tied to expected salary growth.",
        suffix: "%/yr",
        step: 0.1,
      },
      {
        name: "preRetirementReturnPct",
        label: "Return Before Retirement",
        tooltip: "Expected annual portfolio return during your working years, when a longer time horizon supports higher-growth investments.",
        suffix: "%/yr",
        step: 0.1,
      },
      {
        name: "postRetirementReturnPct",
        label: "Return During Retirement",
        tooltip: "Expected annual return after you retire. Often lower due to a more conservative, income-focused asset allocation.",
        suffix: "%/yr",
        step: 0.1,
      },
      {
        name: "investmentDragPct",
        label: "Fees / Tax Drag",
        tooltip: "Annual reduction in returns from fund expense ratios, advisor fees, and tax inefficiency. Even 1% compounds significantly over decades.",
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
        tooltip: "Monthly housing cost in today's dollars. Taken from the Rent vs Buy calculator so your housing decision flows into this plan — it follows whichever scenario that page favours.",
        derived: true,
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
        tooltip: "Irregular annual expenses — car repairs, home maintenance, medical, travel — entered as a lump sum and spread across months.",
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
        tooltip: "Estimated annual Social Security benefit at your planned retirement age. Check ssa.gov for your personalized estimate.",
        suffix: "$/yr",
        min: 0,
        step: 500,
      },
      {
        name: "pensionAnnual",
        label: "Pension at Retirement",
        tooltip: "Annual defined-benefit pension income starting at retirement. Enter 0 if you don't have a pension.",
        suffix: "$/yr",
        min: 0,
        step: 500,
      },
      {
        name: "benefitIncreasePct",
        label: "Income COLA (SS + Pension)",
        tooltip: "Cost-of-Living Adjustment — the annual percentage increase applied to Social Security and pension income throughout retirement.",
        suffix: "%/yr",
        step: 0.1,
      },
      {
        name: "inflationPct",
        label: "Inflation",
        tooltip: "Expected annual inflation rate used to grow your planned retirement expenses over time.",
        suffix: "%/yr",
        step: 0.1,
      },
      {
        name: "retirementIncomeTaxPct",
        label: "Retirement Income Tax Rate",
        tooltip: "Effective tax rate on retirement income withdrawals — reduces the net spending power of each dollar taken from the portfolio.",
        suffix: "%",
        min: 0,
        max: 95,
        step: 0.5,
      },
      {
        name: "safeWithdrawalRatePct",
        label: "Safe Withdrawal Rule",
        tooltip: "Percentage of your portfolio withdrawn annually in retirement. The '4% rule' is a widely cited benchmark for a 30-year retirement.",
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

function formatMoney(value) {
  return moneyFormatter.format(value);
}

// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Picks which timeline indices get an x-axis label, dropping the second-to-last
//          tick when the mandatory final tick would sit on top of it.
// Reason: Both line charts labelled every Nth point plus the last point unconditionally.
//         On a 35-92 retirement span that rendered ages 91 and 92 at nearly the same x,
//         printing as an unreadable "9192"; the rent-vs-buy chart collided "Y29"/"Y30" the
//         same way. Shared by both charts so they stay consistent.
function getXLabelIndices(length) {
  const interval = Math.max(Math.ceil(length / 8), 1);
  const indices = [];

  for (let index = 0; index < length; index += interval) {
    indices.push(index);
  }

  const last = length - 1;
  if (indices[indices.length - 1] !== last) {
    if (last - indices[indices.length - 1] < interval / 2) {
      indices.pop();
    }
    indices.push(last);
  }

  return indices;
}

function formatCompactMoney(value) {
  return compactMoneyFormatter.format(value);
}

function Tooltip({ text }) {
  return (
    <span className="tooltip-anchor" tabIndex={0}>
      <span className="tooltip-icon" aria-hidden="true">i</span>
      <span className="tooltip-bubble" role="tooltip">{text}</span>
    </span>
  );
}

// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Marks fields that are shared with the other calculator, and renders derived
//          fields as read-only with an explanation of where their value comes from.
// Reason: A field that silently changes a value on another page is confusing unless the
//         link is visible, and the retirement housing line is now an output of the
//         rent-vs-buy comparison rather than something to type into.
function NumberField({ field, value, onChange, idPrefix, page, note: noteOverride }) {
  const inputId = `${idPrefix}-${field.name}`;
  const linked = page ? isLinkedField(page, field.name) : false;
  const note = noteOverride ?? (linked ? LINKED_FIELD_NOTE : null);

  return (
    <label className="field" htmlFor={inputId}>
      <span className="field-label">
        {field.label}
        {field.tooltip ? <Tooltip text={field.tooltip} /> : null}
        {linked ? <span className="field-badge">linked</span> : null}
        {field.derived ? <span className="field-badge">derived</span> : null}
      </span>
      <div className="field-input-wrap">
        <input
          id={inputId}
          className="field-input"
          type="number"
          value={field.derived ? Math.round(Number(value) || 0) : value}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          readOnly={Boolean(field.derived)}
          aria-describedby={note ? `${inputId}-note` : undefined}
          onChange={(event) => onChange(field.name, event.target.value)}
        />
        {field.suffix ? <span className="field-suffix">{field.suffix}</span> : null}
      </div>
      {note ? (
        <small className="field-note" id={`${inputId}-note`}>
          {note}
        </small>
      ) : null}
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
  page,
  fieldNotes,
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
              page={page}
              note={fieldNotes?.[field.name]}
              onChange={onFieldChange}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PageHeader({ title, description, toggleLabel, onToggle, onHome }) {
  return (
    <header className="hero">
      <div className="hero-top">
        <div>
          <p className="eyebrow">Interactive Financial Model</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="hero-actions">
          {onHome ? (
            <button className="mode-toggle mode-toggle-secondary" onClick={onHome}>
              App Hub
            </button>
          ) : null}
          <button className="mode-toggle" onClick={onToggle}>
            {toggleLabel}
          </button>
        </div>
      </div>
    </header>
  );
}

function HubPreview({ accent }) {
  return (
    <div className={`hub-preview ${accent}`} aria-hidden="true">
      {accent === "deb8" ? (
        <>
          <span className="debate-pill debate-pill-a" />
          <span className="debate-pill debate-pill-b" />
          <span className="debate-score debate-score-left" />
          <span className="debate-score debate-score-right" />
        </>
      ) : null}
      {accent === "maps" ? (
        <>
          <span className="map-block map-block-a" />
          <span className="map-block map-block-b" />
          <span className="map-route" />
          <span className="map-pin" />
        </>
      ) : null}
      {accent === "rentbuy" ? (
        <>
          <span className="chart-column chart-column-a" />
          <span className="chart-column chart-column-b" />
          <span className="chart-column chart-column-c" />
          <span className="chart-line-preview" />
        </>
      ) : null}
    </div>
  );
}

function AppHub({ onSelectApp }) {
  return (
    <div className="page hub-page">
      <header className="hub-hero">
        <div>
          <p className="eyebrow">Personal App Hub</p>
          <h1>One place for your working tools.</h1>
          <p>
            Jump into debate, map analysis, or financial planning without hunting
            through repo folders and dev servers.
          </p>
        </div>
      </header>

      <main className="hub-grid" aria-label="App launcher">
        {HUB_APPS.map((app) => (
          <article className={`app-card app-card-${app.accent}`} key={app.name}>
            <HubPreview accent={app.accent} />
            <div className="app-card-body">
              <p className="app-category">{app.category}</p>
              <h2>{app.name}</h2>
              <p>{app.description}</p>
            </div>
            {app.isExternal ? (
              <a className="app-link" href={app.href}>
                {app.actionLabel}
              </a>
            ) : (
              <button
                className="app-link app-link-button"
                type="button"
                onClick={() => onSelectApp(app.mode)}
              >
                {app.actionLabel}
              </button>
            )}
          </article>
        ))}
      </main>
    </div>
  );
}

// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Shared hover behaviour for the line charts — tracks which data point the pointer
//          is nearest, and supports arrow-key traversal for keyboard users.
// Reason: The charts plotted values with no way to read one. Y-axis ticks only give six
//         reference values across the whole range, so answering "what is this at year 12?"
//         meant eyeballing between gridlines. Nearest-x selection (rather than requiring the
//         pointer to land on the stroke itself) keeps the target area the full chart height,
//         which matters most where the two lines converge.
function useChartHover({ pointCount, pad, graphWidth, width }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const indexFromClientX = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return null;

    // The SVG scales to its container, so map client pixels back into viewBox units.
    const svgX = ((event.clientX - bounds.left) / bounds.width) * width;
    const ratio = (svgX - pad.left) / (graphWidth || 1);
    const denominator = Math.max(pointCount - 1, 1);

    return clamp(Math.round(ratio * denominator), 0, pointCount - 1);
  };

  const handlePointerMove = (event) => {
    setActiveIndex(indexFromClientX(event));
  };

  const handlePointerLeave = () => setActiveIndex(null);

  const handleKeyDown = (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    setActiveIndex((previous) => {
      const start = previous ?? 0;
      const next = event.key === "ArrowLeft" ? start - 1 : start + 1;
      return clamp(next, 0, pointCount - 1);
    });
  };

  const handleBlur = () => setActiveIndex(null);

  return {
    activeIndex,
    hoverProps: {
      onPointerMove: handlePointerMove,
      onPointerLeave: handlePointerLeave,
      onKeyDown: handleKeyDown,
      onBlur: handleBlur,
      tabIndex: 0,
    },
  };
}

// Approximate advance width of IBM Plex Mono at the 11px used by .tooltip-text. SVG gives no
// synchronous way to measure text, and a monospace face makes the estimate reliable.
const TOOLTIP_CHAR_WIDTH = 6.65;
const TOOLTIP_PADDING = 10;
const TOOLTIP_ROW_HEIGHT = 15;
const TOOLTIP_TITLE_HEIGHT = 17;
const TOOLTIP_LABEL_GAP = 16;

function ChartTooltip({ anchorX, anchorY, title, rows, chart }) {
  const contentWidth = Math.max(
    title.length * TOOLTIP_CHAR_WIDTH,
    ...rows.map(
      (row) =>
        (row.label.length + row.value.length) * TOOLTIP_CHAR_WIDTH + TOOLTIP_LABEL_GAP,
    ),
  );
  const boxWidth = contentWidth + TOOLTIP_PADDING * 2;
  const boxHeight =
    TOOLTIP_TITLE_HEIGHT + rows.length * TOOLTIP_ROW_HEIGHT + TOOLTIP_PADDING * 1.4;

  // Prefer sitting to the right of the point; flip left when that would overflow the plot.
  const spillsRight = anchorX + 14 + boxWidth > chart.width - chart.pad.right;
  const boxX = spillsRight ? anchorX - 14 - boxWidth : anchorX + 14;
  const boxY = clamp(
    anchorY - boxHeight / 2,
    chart.pad.top,
    chart.height - chart.pad.bottom - boxHeight,
  );

  return (
    <g className="chart-tooltip" pointerEvents="none">
      <rect
        x={boxX}
        y={boxY}
        width={boxWidth}
        height={boxHeight}
        rx={7}
        className="tooltip-box"
      />
      <text
        x={boxX + TOOLTIP_PADDING}
        y={boxY + TOOLTIP_PADDING + 4}
        className="tooltip-text tooltip-title"
      >
        {title}
      </text>
      {rows.map((row, index) => {
        const rowY = boxY + TOOLTIP_TITLE_HEIGHT + TOOLTIP_PADDING + index * TOOLTIP_ROW_HEIGHT;
        return (
          <g key={row.label}>
            <circle
              cx={boxX + TOOLTIP_PADDING + 3}
              cy={rowY - 4}
              r={3}
              className={`tooltip-swatch ${row.tone}`}
            />
            <text
              x={boxX + TOOLTIP_PADDING + 11}
              y={rowY}
              className="tooltip-text tooltip-label"
            >
              {row.label}
            </text>
            <text
              x={boxX + boxWidth - TOOLTIP_PADDING}
              y={rowY}
              textAnchor="end"
              className="tooltip-text tooltip-value"
            >
              {row.value}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function ChartCrosshair({ x, chart }) {
  return (
    <line
      x1={x}
      y1={chart.pad.top}
      x2={x}
      y2={chart.height - chart.pad.bottom}
      className="hover-crosshair"
      pointerEvents="none"
    />
  );
}

function RentVsBuyChart({ timeline, breakEvenYear }) {
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

  const xLabelIndices = getXLabelIndices(timeline.length);
  // AI_CHANGE:
  // Tool: Claude Code
  // Model: Claude Opus 4.8
  // Timestamp: 2026-07-22T00:00:00-04:00
  // Purpose: Draws a zero baseline whenever the plotted range straddles zero, and marks the
  //          break-even year the app already calculates.
  // Reason: Net cost is routinely negative (a renter with strong investment returns ends up
  //         ahead), but with no zero rule there was nothing to tell "costs you $200k" from
  //         "nets you $200k" at a glance. And break-even was stated in prose while the chart
  //         left the crossing unmarked, so the number could not be located on the plot.
  const { activeIndex, hoverProps } = useChartHover({
    pointCount: timeline.length,
    pad,
    graphWidth,
    width,
  });
  const activePoint = activeIndex === null ? null : timeline[activeIndex];

  const zeroY = minValue < 0 && maxValue > 0 ? getY(0) : null;
  const breakEvenX =
    breakEvenYear !== null && breakEvenYear !== undefined && timeline.length > 1
      ? getX(clamp(breakEvenYear - 1, 0, timeline.length - 1))
      : null;

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3>
          Net Cost Over Time
          <Tooltip text="Tracks cumulative net cost — total cash paid minus current asset values — for renting vs. buying at each year of the horizon." />
        </h3>
        <p>Net cost = total cash outflows minus current assets.</p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="line-chart"
        role="img"
        aria-label={
          activePoint
            ? `Year ${activePoint.year}: renting ${formatMoney(activePoint.renterNetCost)}, buying ${formatMoney(activePoint.ownerNetCost)}`
            : "Net cost over time for renting versus buying. Use arrow keys to read individual years."
        }
        {...hoverProps}
      >
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
        {zeroY !== null ? (
          <line
            x1={pad.left}
            y1={zeroY}
            x2={width - pad.right}
            y2={zeroY}
            className="zero-line"
          />
        ) : null}
        {breakEvenX !== null ? (
          <g>
            <line
              x1={breakEvenX}
              y1={pad.top}
              x2={breakEvenX}
              y2={height - pad.bottom}
              className="retirement-marker"
            />
            <text
              x={breakEvenX}
              y={pad.top - 4}
              textAnchor="middle"
              className="axis-label"
            >
              Break-even
            </text>
          </g>
        ) : null}
        <polyline points={rentPolyline} className="line rent-line" />
        <polyline points={buyPolyline} className="line buy-line" />
        {xLabelIndices.map((index) => {
          const point = timeline[index];
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
        {activePoint ? (
          <>
            <ChartCrosshair x={getX(activeIndex)} chart={{ width, height, pad }} />
            <circle
              cx={getX(activeIndex)}
              cy={getY(activePoint.renterNetCost)}
              r={5}
              className="hover-dot rent"
            />
            <circle
              cx={getX(activeIndex)}
              cy={getY(activePoint.ownerNetCost)}
              r={5}
              className="hover-dot buy"
            />
            <ChartTooltip
              anchorX={getX(activeIndex)}
              anchorY={
                (getY(activePoint.renterNetCost) + getY(activePoint.ownerNetCost)) / 2
              }
              title={`Year ${activePoint.year}`}
              rows={[
                {
                  label: "Renting",
                  value: formatMoney(activePoint.renterNetCost),
                  tone: "rent",
                },
                {
                  label: "Buying",
                  value: formatMoney(activePoint.ownerNetCost),
                  tone: "buy",
                },
              ]}
              chart={{ width, height, pad }}
            />
          </>
        ) : null}
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

// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Renders the scenario bars on a signed scale anchored at zero, and adds a
//          rent-paid row now that total cash paid is identical across scenarios.
// Reason: Bar width was `Math.abs(value) / max`, so a net cost of -$895,481 (the renter
//         ending $895k ahead) drew a bar 31.8% wide while +$565,037 for the buyer drew
//         20.1% — the better outcome looked worse, directly contradicting the headline
//         above it. Bars now grow left from a zero rule when the value is negative, so
//         sign is visible and lengths stay comparable.
function BreakdownBar({ value, domainMin, domainMax, tone }) {
  const span = domainMax - domainMin || 1;
  const zeroOffset = ((0 - domainMin) / span) * 100;
  const valueOffset = ((value - domainMin) / span) * 100;
  const left = Math.min(zeroOffset, valueOffset);
  // Keep a hairline visible for small non-zero amounts so they don't disappear, but let an
  // exact zero render as nothing — a stub bar next to "$0" reads as a rounding artifact.
  const rawWidth = Math.abs(valueOffset - zeroOffset);
  const width = value === 0 ? 0 : Math.max(rawWidth, 0.4);

  return (
    <div className="bar-track">
      <span className="bar-zero" style={{ left: `${zeroOffset}%` }} />
      <div
        className={`bar ${tone}${value < 0 ? " bar-negative" : ""}`}
        style={{ left: `${left}%`, width: `${width}%` }}
      />
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
      label: "Total cash committed",
      rentValue: summary.renterOutflow,
      buyValue: summary.ownerOutflow,
    },
    {
      label: "Rent paid to landlord",
      rentValue: summary.renterRentPaid,
      buyValue: 0,
    },
    {
      label: "Asset value at end",
      rentValue: summary.renterInvestment,
      buyValue: summary.ownerEquity,
    },
  ];

  const allValues = rows.flatMap((row) => [row.rentValue, row.buyValue]);
  const domainMax = Math.max(...allValues, 0) || 1;
  const domainMin = Math.min(...allValues, 0);

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3>
          Scenario Breakdown
          <Tooltip text="Side-by-side comparison of cash committed and final asset values for each scenario at the end of your comparison horizon. Both scenarios commit the same cash while the renter's portfolio holds out — the difference is what each one owns at the end." />
        </h3>
        <p>
          Bars share one scale anchored at zero; bars extending left of the zero rule are
          negative (money ahead rather than spent).
        </p>
      </div>
      <div className="breakdown-grid">
        {rows.map((row) => (
          <div key={row.label} className="breakdown-row">
            <div className="breakdown-label">{row.label}</div>
            <div className="breakdown-values">
              <span>Rent {formatMoney(row.rentValue)}</span>
              <span>Buy {formatMoney(row.buyValue)}</span>
            </div>
            <BreakdownBar
              value={row.rentValue}
              domainMin={domainMin}
              domainMax={domainMax}
              tone="rent"
            />
            <BreakdownBar
              value={row.buyValue}
              domainMin={domainMin}
              domainMax={domainMax}
              tone="buy"
            />
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

  const xLabelIndices = getXLabelIndices(timeline.length);
  const { activeIndex, hoverProps } = useChartHover({
    pointCount: timeline.length,
    pad,
    graphWidth,
    width,
  });
  const activePoint = activeIndex === null ? null : timeline[activeIndex];

  const zeroY = minValue < 0 && maxValue > 0 ? getY(0) : null;
  const retirementIndex = timeline.findIndex((point) => point.age === retirementAge);
  const retirementX = retirementIndex >= 0 ? getX(retirementIndex) : null;

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3>
          Portfolio Balance By Age
          <Tooltip text="Shows how your portfolio grows during working years and draws down through retirement, accounting for contributions, returns, withdrawals, and taxes." />
        </h3>
        <p>Includes contributions, growth, withdrawals, inflation, and taxes.</p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="line-chart"
        role="img"
        aria-label={
          activePoint
            ? `Age ${activePoint.age}: balance ${formatMoney(activePoint.balance)}`
            : "Portfolio balance by age. Use arrow keys to read individual ages."
        }
        {...hoverProps}
      >
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
        {zeroY !== null ? (
          <line
            x1={pad.left}
            y1={zeroY}
            x2={width - pad.right}
            y2={zeroY}
            className="zero-line"
          />
        ) : null}
        <polyline points={polyline} className="line retirement-line" />
        {xLabelIndices.map((index) => {
          const point = timeline[index];
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
        {activePoint ? (
          <>
            <ChartCrosshair x={getX(activeIndex)} chart={{ width, height, pad }} />
            <circle
              cx={getX(activeIndex)}
              cy={getY(activePoint.balance)}
              r={5}
              className="hover-dot retirement"
            />
            <ChartTooltip
              anchorX={getX(activeIndex)}
              anchorY={getY(activePoint.balance)}
              title={`Age ${activePoint.age}`}
              rows={[
                {
                  label: "Balance",
                  value: formatMoney(activePoint.balance),
                  tone: "retirement",
                },
                activePoint.isRetired
                  ? {
                      label: "Withdrawn",
                      value: formatMoney(activePoint.withdrawal),
                      tone: "rent",
                    }
                  : {
                      label: "Contributed",
                      value: formatMoney(activePoint.contribution),
                      tone: "buy",
                    },
              ]}
              chart={{ width, height, pad }}
            />
          </>
        ) : null}
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

// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Splits the retirement breakdown into portfolio balances and annual cash flows,
//          each scaled against its own group, and reuses the signed BreakdownBar.
// Reason: Balances (~$3.4M) and annual spending (~$144k) shared one bar scale, so both
//         spending rows rendered ~3% wide and conveyed nothing — the reader could not
//         compare planned vs sustainable spend, which is the whole point of those rows.
//         They are also different units: a stock of money versus a yearly flow, which
//         should never share an axis.
function RetirementBreakdownGroup({ caption, rows }) {
  const values = rows.map((row) => row.value);
  const domainMax = Math.max(...values, 0) || 1;
  const domainMin = Math.min(...values, 0);

  return (
    <div className="breakdown-group">
      <p className="breakdown-group-caption">{caption}</p>
      <div className="breakdown-grid">
        {rows.map((row) => (
          <div key={row.label} className="breakdown-row">
            <div className="breakdown-values">
              <span>{row.label}</span>
              <span>{formatMoney(row.value)}</span>
            </div>
            <BreakdownBar
              value={row.value}
              domainMin={domainMin}
              domainMax={domainMax}
              tone={row.color}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function RetirementBreakdown({ summary }) {
  const balanceRows = [
    {
      label: "Balance At Retirement",
      value: summary.balanceAtRetirement,
      color: "retirement",
    },
    {
      label: "Withdrawal-Rule Target",
      value: summary.requiredNestEgg,
      color: "target",
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

  const flowRows = [
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
  ];

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3>
          Retirement Breakdown
          <Tooltip text="Key metrics at a glance: your savings target, projected balance, sustainable spending, and cumulative contribution and withdrawal totals." />
        </h3>
        <p>
          Portfolio balances and annual cash flows are scaled separately — they are
          different units and do not belong on a shared axis.
        </p>
      </div>
      <RetirementBreakdownGroup caption="Portfolio balances" rows={balanceRows} />
      <RetirementBreakdownGroup caption="Annual cash flow" rows={flowRows} />
    </div>
  );
}

// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Presents sustainable spending as a whole-retirement figure solved from the
//          projection, and shows today's-dollar equivalents beside the nominal amounts.
// Reason: The old card compared planned spend against a first-year safe-withdrawal estimate
//         and called the difference a cushion, while claiming in its tooltip that the number
//         would not deplete your savings. It also stated everything in retirement-year
//         dollars directly above a table whose "Today" column was in current dollars, with
//         nothing marking the difference.
function RetirementMonthlyBudget({ summary, retirementAge }) {
  const deltaIsPositive = summary.monthlyBudgetDelta >= 0;
  const affordablePct = Math.round(summary.sustainableMultiplier * 100);

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3>
          Monthly Budget At Retirement
          <Tooltip text="Compares your planned spending against the most you could spend every year without running the portfolio dry before your planning horizon." />
        </h3>
        <p>
          Figures are in age-{retirementAge} dollars unless marked otherwise — your planned
          budget inflated forward to the year you retire.
        </p>
      </div>

      <div className="budget-metric-grid">
        <article className="budget-metric">
          <h4>
            Planned Monthly Spend
            <Tooltip text="Your entered monthly budget, inflated to retirement-year dollars." />
          </h4>
          <p>{formatMoney(summary.plannedMonthlySpendAtRetirement)}</p>
          <small className="metric-help">
            {formatMoney(summary.plannedMonthlySpendToday)}/mo in today&rsquo;s dollars
          </small>
        </article>
        <article className="budget-metric">
          <h4>
            Sustainable Monthly Spend
            <Tooltip text="Solved from the projection: the largest budget your portfolio, Social Security and pension can fund every year through your planning horizon." />
          </h4>
          <p>{formatMoney(summary.sustainableMonthlySpend)}</p>
          <small className="metric-help">
            {formatMoney(summary.sustainableMonthlySpendToday)}/mo in today&rsquo;s dollars
          </small>
        </article>
        <article className="budget-metric">
          <h4>
            Monthly Cushion / Gap
            <Tooltip text="Difference between sustainable and planned spending, holding for every year of retirement — not just the first." />
          </h4>
          <p className={deltaIsPositive ? "budget-positive" : "budget-negative"}>
            {deltaIsPositive ? "+" : "-"}
            {formatMoney(Math.abs(summary.monthlyBudgetDelta))}
          </p>
          <small className="metric-help">
            {`You can fund about ${affordablePct}% of your planned budget.`}
          </small>
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

function RentVsBuyPage({ inputs, analysis, onFieldChange, onReset, onSwitch, onHome }) {
  const [expandedGroups, setExpandedGroups] = useState(() =>
    RENT_BUY_FIELD_GROUPS.map(() => true),
  );
  const totalMonthlyOwnerCost = useMemo(
    () => computeTotalMonthlyOwnerCost(inputs),
    [inputs],
  );
  const { assumptions, summary, timeline } = analysis;
  const metricCards = [
    {
      title: "Renting Net Cost",
      value: formatMoney(summary.renterNetCost),
      tooltip: "Total rent and insurance paid over the horizon, minus the ending value of invested savings.",
    },
    {
      title: "Buying Net Cost",
      value: formatMoney(summary.ownerNetCost),
      tooltip: "Total ownership costs (mortgage, taxes, insurance, maintenance, closing & selling costs) minus home equity at end of horizon.",
    },
    {
      title: "Estimated Mortgage Payment",
      value: `${formatMoney(assumptions.monthlyMortgagePayment)}/mo`,
      tooltip: "Monthly principal and interest only. Does not include property taxes, insurance, HOA, or maintenance.",
    },
    {
      title: "Total Monthly Owner Cost",
      value: formatMonthlyOwnerCost(totalMonthlyOwnerCost),
      tooltip: "Includes principal & interest, property tax, insurance, HOA, and maintenance. One-time closing and selling costs are excluded.",
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
        onHome={onHome}
      />

      <div className="layout">
        <aside className="panel controls-panel">
          <div className="panel-title-row">
            <h2>Inputs</h2>
            <button className="ghost-button" onClick={onReset}>
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
              page="rentBuy"
              onFieldChange={onFieldChange}
            />
          ))}
        </aside>

        <main className="panel results-panel">
          <section className="outcome">
            <p className="result-line">{outcomeMessage}</p>
            <div className="metric-grid">
              {metricCards.map((card) => (
                <article key={card.title}>
                  <h4>
                    {card.title}
                    {card.tooltip ? <Tooltip text={card.tooltip} /> : null}
                  </h4>
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

          <RentVsBuyChart timeline={timeline} breakEvenYear={summary.breakEvenYear} />
          <RentVsBuyBreakdown summary={summary} years={assumptions.years} />
        </main>
      </div>
    </div>
  );
}

function RetirementPage({ inputs, derivedHousingNote, onFieldChange, onReset, onSwitch, onHome }) {
  const [expandedGroups, setExpandedGroups] = useState(() =>
    RETIREMENT_FIELD_GROUPS.map(() => true),
  );
  const analysis = useMemo(() => calculateRetirement(inputs), [inputs]);
  const { assumptions, summary, timeline } = analysis;

  // AI_CHANGE:
  // Tool: Claude Code
  // Model: Claude Opus 4.8
  // Timestamp: 2026-07-22T00:00:00-04:00
  // Purpose: Drives the headline verdict from the year-by-year projection and reports the
  //          withdrawal-rule comparison as a secondary note, calling out disagreement.
  // Reason: The verdict used to come from the static 4% target while the subline came from
  //         the simulation, so the page could read "On track" directly above "Portfolio
  //         depletes around age 92" — true in 31 of 192 swept input combinations.
  const outcomeMessage = summary.retireReady
    ? `On track: the projection funds your planned spending through age ${assumptions.lifeExpectancy}.`
    : `Short: the projection runs out at age ${summary.runOutAge}, before your planning horizon of ${assumptions.lifeExpectancy}.`;
  const targetNote = summary.meetsWithdrawalRuleTarget
    ? `Your projected balance also clears the ${(assumptions.safeWithdrawalRate * 100).toFixed(1)}% withdrawal-rule target by ${formatMoney(Math.abs(summary.targetGap))}.`
    : `Your projected balance is ${formatMoney(Math.abs(summary.targetGap))} short of the ${(assumptions.safeWithdrawalRate * 100).toFixed(1)}% withdrawal-rule target.`;
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
        onHome={onHome}
      />

      <div className="layout">
        <aside className="panel controls-panel">
          <div className="panel-title-row">
            <h2>Inputs</h2>
            <button
              className="ghost-button"
              onClick={onReset}
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
              page="retirement"
              fieldNotes={{ monthlyHousing: derivedHousingNote }}
              onFieldChange={onFieldChange}
            />
          ))}
        </aside>

        <main className="panel results-panel">
          <section className="outcome">
            <p className="result-line">{outcomeMessage}</p>
            <div className="metric-grid">
              <article>
                <h4>
                  Balance At Retirement
                  <Tooltip text="Projected total portfolio value on the day you retire, based on current savings, contributions, and investment growth." />
                </h4>
                <p>{formatMoney(summary.balanceAtRetirement)}</p>
                <small className="metric-help">
                  {formatMoney(summary.balanceAtRetirementToday)} in today&rsquo;s dollars
                </small>
              </article>
              <article>
                <h4>
                  Withdrawal-Rule Target
                  <Tooltip text="Portfolio size needed at retirement to fund your spending using your safe withdrawal rate. Formula: annual portfolio draw ÷ withdrawal rate." />
                </h4>
                <p>{formatMoney(summary.requiredNestEgg)}</p>
              </article>
              <article>
                <h4>
                  Sustainable Monthly Spend
                  <Tooltip text="Solved from the projection: the largest budget your portfolio, Social Security and pension can fund every year through your planning horizon." />
                </h4>
                <p>{formatMoney(summary.sustainableMonthlySpend)}</p>
              </article>
            </div>
            <p className="result-subline">
              {`${targetNote} ${monthlyBudgetMessage}`}
            </p>
          </section>

          <RetirementBalanceChart
            timeline={timeline}
            retirementAge={assumptions.retirementAge}
          />
          <RetirementMonthlyBudget
            summary={summary}
            retirementAge={assumptions.retirementAge}
          />
          <RetirementBreakdown summary={summary} />
        </main>
      </div>
    </div>
  );
}

// AI_CHANGE:
// Tool: Claude Code
// Model: Claude Opus 4.8
// Timestamp: 2026-07-22T00:00:00-04:00
// Purpose: Owns both input sets and mirrors edits to shared assumptions across them, and
//          derives the retirement budget's housing line from the rent-vs-buy outcome.
// Reason: The two calculators describe one household, so inflation and the working-years
//         market return must be a single value rather than two that silently disagree. The
//         housing line is derived rather than mirrored because it is an output of one page
//         feeding an input of the other, not a shared assumption.
function App() {
  const [mode, setMode] = useState(getInitialMode);
  const [rentBuyInputs, setRentBuyInputs] = useState(DEFAULT_RENT_BUY_INPUTS);
  const [retirementInputs, setRetirementInputs] = useState(DEFAULT_RETIREMENT_INPUTS);

  const rentVsBuyAnalysis = useMemo(
    () => calculateRentVsBuy(rentBuyInputs),
    [rentBuyInputs],
  );
  const rentVsBuyWinner = rentVsBuyAnalysis.summary.winner;

  // The housing line depends on both pages: what the rent-vs-buy comparison recommends, and
  // how far away retirement is (which decides whether a mortgage is still being paid).
  const derivedHousing = useMemo(() => {
    const loanTermYears = clamp(
      Math.round(Number(rentBuyInputs.loanTermYears) || 30),
      1,
      40,
    );
    const currentAge = clamp(Math.round(Number(retirementInputs.currentAge) || 35), 18, 90);
    const retirementAge = Math.max(
      clamp(Math.round(Number(retirementInputs.retirementAge) || 67), 40, 95),
      currentAge + 1,
    );
    const context = {
      winner: rentVsBuyWinner,
      loanTermYears,
      yearsToRetirement: retirementAge - currentAge,
    };

    return {
      value: getDerivedMonthlyHousing({
        ...context,
        ownerCostBreakdown: computeMonthlyOwnerCostBreakdown(rentBuyInputs),
        monthlyRent:
          Math.max(Number(rentBuyInputs.monthlyRent) || 0, 0) +
          Math.max(Number(rentBuyInputs.rentersInsuranceMonthly) || 0, 0),
      }),
      note: describeDerivedHousing(context),
    };
  }, [
    rentBuyInputs,
    rentVsBuyWinner,
    retirementInputs.currentAge,
    retirementInputs.retirementAge,
  ]);

  const handleRentBuyChange = (name, value) => {
    setRentBuyInputs((previous) => ({ ...previous, [name]: value }));

    const counterpart = getLinkedCounterpart("rentBuy", name);
    if (counterpart) {
      setRetirementInputs((previous) => ({ ...previous, [counterpart]: value }));
    }
  };

  const handleRetirementChange = (name, value) => {
    setRetirementInputs((previous) => ({ ...previous, [name]: value }));

    const counterpart = getLinkedCounterpart("retirement", name);
    if (counterpart) {
      setRentBuyInputs((previous) => ({ ...previous, [counterpart]: value }));
    }
  };

  // Resetting one page must not leave the shared assumptions disagreeing, so a reset also
  // republishes the restored values to the other page.
  const handleRentBuyReset = () => {
    setRentBuyInputs(DEFAULT_RENT_BUY_INPUTS);
    setRetirementInputs((previous) => ({
      ...previous,
      ...Object.fromEntries(
        LINKED_FIELDS.map((link) => [link.retirement, DEFAULT_RENT_BUY_INPUTS[link.rentBuy]]),
      ),
    }));
  };

  const handleRetirementReset = () => {
    setRetirementInputs(DEFAULT_RETIREMENT_INPUTS);
    setRentBuyInputs((previous) => ({
      ...previous,
      ...Object.fromEntries(
        LINKED_FIELDS.map((link) => [link.rentBuy, DEFAULT_RETIREMENT_INPUTS[link.retirement]]),
      ),
    }));
  };

  useEffect(() => {
    const frameClasses = ["body-frame-rent", "body-frame-buy", "body-frame-tie"];
    document.body.classList.remove(...frameClasses);

    const winnerClass =
      mode === APP_MODE.HUB
        ? "body-frame-tie"
        : rentVsBuyWinner === "buy"
          ? "body-frame-buy"
          : rentVsBuyWinner === "rent"
            ? "body-frame-rent"
            : "body-frame-tie";

    document.body.classList.add(winnerClass);

    return () => {
      document.body.classList.remove(...frameClasses);
    };
  }, [mode, rentVsBuyWinner]);

  if (mode === APP_MODE.HUB) {
    return <AppHub onSelectApp={setMode} />;
  }

  if (mode === APP_MODE.RENT_BUY) {
    return (
      <RentVsBuyPage
        inputs={rentBuyInputs}
        analysis={rentVsBuyAnalysis}
        onFieldChange={handleRentBuyChange}
        onReset={handleRentBuyReset}
        onSwitch={() => setMode(APP_MODE.RETIREMENT)}
        onHome={() => setMode(APP_MODE.HUB)}
      />
    );
  }

  return (
    <RetirementPage
      inputs={{ ...retirementInputs, monthlyHousing: derivedHousing.value }}
      derivedHousingNote={derivedHousing.note}
      onFieldChange={handleRetirementChange}
      onReset={handleRetirementReset}
      onSwitch={() => setMode(APP_MODE.RENT_BUY)}
      onHome={() => setMode(APP_MODE.HUB)}
    />
  );
}

export default App;
