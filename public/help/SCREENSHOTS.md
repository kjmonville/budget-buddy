# Help Screenshot Instructions

Place annotated PNG files in this directory. Each file is referenced by name in `src/components/HelpDrawer.tsx`.

Suggested workflow: take a screenshot of the app in the described state, open it in Preview (or Figma), add arrows and callout text, then export as PNG.

---

## help-balance-field.png

**Show:** The app header/top area with the "Today's Balance" input field clearly visible.

**Annotate:**
- Arrow pointing to the balance input field
- Callout text: "Enter your real bank balance here"

---

## help-projected-balance.png

**Show:** The calendar view with several day cells visible, each showing an end-of-day balance number in the bottom of the cell.

**Annotate:**
- Highlight or circle one day cell
- Arrow pointing to the balance number at the bottom of the cell
- Callout text: "Projected end-of-day balance"

---

## help-calendar-nav.png

**Show:** The calendar with the month header visible, including the ‹ (previous) and › (next) navigation arrows on either side of the month/year label.

**Annotate:**
- Arrow to the left ‹ arrow
- Arrow to the right › arrow
- Callout on the month/year label (e.g. "May 2026")

---

## help-recurring.png

**Show:** The Add/Edit Transaction modal (or the Schedule/RecurringList panel) with a recurring transaction visible, specifically with the recurrence type picker/dropdown shown.

**Annotate:**
- Highlight or circle the recurrence type control (the dropdown that says e.g. "Monthly (fixed day)")
- Callout text: "Choose how often it repeats"

---

## help-adhoc.png

**Show:** The Add Transaction modal with a one-time transaction selected (not recurring) and a specific date filled in the date field.

**Annotate:**
- Highlight or circle the date input field
- Callout text: "Pick the exact date it happens"

---

## help-cleared.png

**Show:** A calendar day cell with at least two transaction badges visible — one in its normal (uncleared) state and one in struck-through (cleared) state, side by side.

**Annotate:**
- Arrow pointing to the struck-through badge
- Callout text: "Tap to clear — tap again to restore"

---

## help-paid.png

**Show:** A calendar transaction badge that is displaying the paid indicator (the visual mark shown when a transaction is marked as paid).

**Annotate:**
- Arrow pointing to the paid marker/icon on the badge
- Callout text: "Paid"
