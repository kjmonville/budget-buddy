# Handoff: Balance Chart on Budget Buddy Web Home

## Overview

Adds a projected-balance line chart to the main screen of the Budget Buddy web app, mirroring the small monthly balance sparkline that already exists in the iOS app. The chart sits between the existing sub-header (Today's Balance / Low Balance / Schedule / Add) and the existing calendar grid, giving users an at-a-glance view of how their balance trends over the next N days, with the projected low point called out.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. The task is to **recreate the design in the Budget Buddy web codebase's existing environment** using its established patterns, component library, and styling approach. The HTML/JSX in `prototype/` is for visual + interaction reference only.

## Fidelity

**High-fidelity.** Colors, typography, spacing, and interactions are intended as final. Recreate pixel-faithfully in the target codebase. The only existing-app values that may differ slightly are exact indigo brand hex, font stack, and border colors — match what's already in the codebase rather than the values listed here when there's a conflict.

## Scope of the Change

Only one screen changes: the **Home / Main** screen. Header, sub-header, and calendar are unchanged in functionality — they're included in the prototype only for context so you can see how the chart sits between them. **The only new thing to ship is the chart panel** (the `<section class="bb-chart-panel">` block in the prototype).

## The New Component: `BalancePanel`

### Layout

A full-width card sitting between the sub-header and the calendar.

- **Container**: white background (`var(--surface)` in your tokens), 1px border, 12px border-radius, soft shadow (`0 1px 3px rgba(15,23,42,0.04)`), `18px 20px 14px` padding.
- **Header row** (flex, space-between, align-start, 16px gap, 6px bottom margin):
  - **Left**: title `Projected Balance` (14px / 600 / fg) + sub-line `Next {N} days · hover to see daily balance` (12px / 400 / muted, 2px top margin)
  - **Right**: range tabs — segmented control with options `7d`, `30d`, `60d`, `90d`. 1px border, 8px radius, divided by 1px borders between buttons. Active tab gets `bg-soft` background and full fg color; inactive is muted.
- **Chart**: SVG, full width of container, default height **160px** (range 100–280px is supported; default fine).
- **Legend** (8px top margin, 18px gap, 12px / muted): two items — "Today" with a white-fill / indigo-stroke dot, and "Low balance" with a solid amber dot.

### Chart Specifics

Hand-drawn in inline SVG — no chart library required, but if your codebase already uses Recharts/Visx/D3/Chart.js, use it.

- **Inner padding inside SVG**: left 16, right 16, top 28, bottom 24. Top padding leaves room for the low-point label; bottom padding leaves room for date ticks.
- **Y-domain**: `[min - 0.15*range, max + 0.15*range]` so the line never hugs the edges. No y-axis labels rendered.
- **Baseline**: faint 1px line at the bottom of the inner area in `--border` color.
- **Line**: stroke `var(--fg)` (near-black `#111418` light / `#f3f4f6` dark), `stroke-width: 1.75`, round caps + joins, `fill: none`.
- **X-axis ticks**: 6 evenly-spaced indices from the series. Render the day-of-month number (no month/year). 11px / muted, tabular-nums, baseline 6px above the bottom.
- **Today marker**:
  - Vertical dashed guide (`stroke-dasharray: 2 3`, `var(--primary)`, `opacity: 0.35`) from top to baseline at today's x position.
  - 3.5px-radius dot at today's value: white fill, 2px primary stroke.
- **Low-point marker**:
  - 4.5px-radius dot at the lowest projected balance: amber (`#f59e0b`) fill, 2px white stroke.
  - Currency label 12px above the dot in 11px / 600 / amber, tabular-nums (e.g. `$475.00`). When the dot is within 80px of the left or right edge, anchor the label `start` or `end` and offset by ±10px so it stays inside the chart bounds.
- **Hover scrubber** (mouse-only):
  - On `mousemove` over the SVG, snap to the nearest series index by horizontal position.
  - Render a vertical guide line (`var(--fg)` at `opacity 0.18`) and a 4px-radius white-fill / 1.75px fg-stroke ring at the snapped point.
  - Tooltip: absolutely-positioned card above the chart, clamped within container width: `var(--surface)` background, 1px border, 8px radius, `6px 10px` padding, 12px text, `0 4px 12px rgba(0,0,0,0.06)` shadow, `pointer-events: none`. Contents: muted weekday + date (`Sun, Apr 26`) on the left, bold tabular currency on the right.
  - Clear on `mouseleave`.

### Behavior

- Clicking a range tab updates the series window and the sub-line copy ("Next {N} days").
- The chart's series must be derived from the same source as the calendar so the two stay in sync. When the user edits "Today's Balance" in the sub-header, the entire series shifts by the delta — today's chart point should always equal the input value.
- The "Low Balance" shown in the sub-header should be the same lowest-balance day shown on the chart's amber dot.
- The chart is read-only — no click-to-select, no drag, no zoom beyond the range tabs.

## Design Tokens

Use the codebase's existing tokens where they exist. The values below describe what the prototype uses; map them to your equivalents.

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--surface` (chart bg) | `#ffffff` | `#0f1115` | |
| `--surface-soft` (page bg, active tab) | `#f8f9fc` | `#15181f` | |
| `--fg` (line, text) | `#111418` | `#f3f4f6` | Chart line uses this directly |
| `--muted` | `#6b7280` | `#9ca3af` | Sub-line, ticks |
| `--border` | `#e5e7eb` | `#262a33` | |
| `--primary` (today) | `#6366f1` | same | Existing Budget Buddy indigo |
| `--low` (low-balance dot) | `#f59e0b` | same | Amber, matches iOS app |

Typography: existing app font stack, tabular numerals (`font-variant-numeric: tabular-nums`) on every currency value and on date-tick numbers.

## Data Requirements

You need a daily series of `{ date, balance }` covering today through `today + N` days, where `N` is the selected range. Compute as a running sum from today's balance forward through scheduled transactions, one entry per day (carry forward on days with no activity). The same projection logic likely already exists for the calendar's per-day balance footer — reuse it.

## Files in This Bundle

- `prototype/Budget Buddy Home.html` — entry point
- `prototype/app.jsx` — full screen for context; the chart panel lives in the `ChartPanel` component
- `prototype/balance-chart.jsx` — **the only component you need to recreate**; everything chart-specific is here
- `prototype/style.css` — styling reference; `.bb-chart-panel`, `.bb-chart-header`, `.bb-range-*`, `.bb-chart-legend`, `.bb-dot*` are the relevant rules

## Out of Scope

- Header, sub-header, calendar — unchanged
- Transaction model, persistence, schedule editor — unchanged
- Mobile responsive behavior — chart should simply scale to container width via `ResizeObserver`; no separate breakpoint design
- Tweaks panel — that's a design-tool affordance for exploring options; do not ship it
