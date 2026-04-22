# Budget Buddy

A web-based personal finance app that projects a bank account balance forward through a monthly calendar view.

## Stack

- **Frontend**: React 18 + Vite 6 + Tailwind CSS v4
- **Backend**: Cloudflare Worker (`worker/index.ts`) — handles all API routes
- **Database**: Cloudflare D1 (SQLite) — bound as `DB`
- **Dev tooling**: `@cloudflare/vite-plugin` runs the Worker in the Workers runtime during `npm run dev` — no second terminal needed

## Commands

```bash
npm run dev              # Start dev server (Vite + Worker + local D1)
npm run build            # TypeScript check + Vite build
npm run deploy           # Build then deploy to Cloudflare
npm run db:migrate       # Apply migrations to local D1
npm run db:migrate:remote  # Apply migrations to production D1
```

## Project structure

```
worker/index.ts          # Cloudflare Worker: router + all API handlers
src/
  App.tsx                # Root component: state, data fetching, layout
  types.ts               # Shared TypeScript interfaces
  lib/
    api.ts               # Typed fetch wrappers for all API endpoints
    recurrence.ts        # Expands recurring rules → YYYY-MM-DD[] for a month
    balance.ts           # Computes end-of-day balances across a date range
  components/
    BalanceInput.tsx     # "Today's Balance" field with debounced save
    CalendarView.tsx     # Month grid with prev/next navigation
    CalendarDay.tsx      # Single day cell: transactions + end-of-day balance
    TransactionModal.tsx # Add/edit form for recurring and one-time transactions
    RecurringList.tsx    # Side panel to manage recurring transactions
migrations/
  0001_init.sql          # D1 schema: recurring_transactions, adhoc_transactions, account_balance
```

## Architecture notes

### Worker vs Pages Functions
The project uses a **single Worker entry point** (`worker/index.ts`) with a hand-rolled URL router, not Cloudflare Pages Functions. This is intentional — it's the pattern the `@cloudflare/vite-plugin` integrates with for a seamless `npm run dev` experience. Static assets are served via the `[assets]` binding in `wrangler.toml`.

### Balance calculation
`src/lib/balance.ts` — `computeAllDailyBalances(startBalance, startDate, recurring, adhoc, fromDate, toDate)`:
- `startBalance` = user-entered bank balance at the **start of `startDate`** (before that day's transactions)
- **Forward pass**: from `startDate` to `toDate`, accumulating net transactions each day
- **Backward pass**: from `startDate - 1` to `fromDate`, using `B(d-1) = B(d) - D(d) + E(d)`
- App pre-computes 3 months back → 18 months forward on load; recomputes whenever balance or transactions change

### Recurrence engine
`src/lib/recurrence.ts` — `expandRecurring(rule, year, month)` returns all dates in the given month that match the rule. Supported patterns:
- `monthly_fixed` — same day every month (clamped to last day if needed)
- `weekly` — every occurrence of a weekday
- `biweekly` — every other occurrence, anchored to `biweekly_anchor` date
- `yearly` — one specific month + day
- `monthly_nth_weekday` — e.g. third Tuesday; `nth_week = -1` means last

### Future auth
The DB schema has no `user_id` column yet. Adding one is the planned migration for the auth revision. Data isolation will be added at the Worker layer — each API handler will filter by the authenticated user's ID.

## Deployment

The `@cloudflare/vite-plugin` outputs two build artifacts:
- `dist/budget_buddy/index.js` — compiled Worker
- `dist/client/` — React SPA static assets

`npm run deploy` runs `wrangler deploy --config dist/budget_buddy/wrangler.json`, which picks up the D1 binding and asset directory automatically from the generated config.

Before first production deploy:
```bash
npx wrangler d1 create budget-buddy-db
# Update database_id in wrangler.toml
npm run db:migrate:remote
npm run deploy
```
