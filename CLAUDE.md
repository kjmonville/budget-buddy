# Budget Buddy

A web-based personal finance app that projects a bank account balance forward through a monthly calendar view. Supports multiple users with full authentication and data isolation.

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
worker/index.ts          # Cloudflare Worker: router + all API handlers (auth + data)
src/
  App.tsx                # Root component: auth state, data fetching, layout
  types.ts               # Shared TypeScript interfaces (includes User type)
  main.tsx               # React entry point
  index.css              # Tailwind styles with dark mode support
  lib/
    api.ts               # Typed fetch wrappers for all API endpoints
    recurrence.ts        # Expands recurring rules → YYYY-MM-DD[] for a month
    balance.ts           # Computes end-of-day balances (forward pass only)
    theme.ts             # Light/Dark/Auto theme management with localStorage
  components/
    LoginPage.tsx        # Login/signup form with toggle between modes
    BalanceInput.tsx     # "Today's Balance" field with debounced save
    CalendarView.tsx     # Month grid with prev/next navigation
    CalendarDay.tsx      # Single day cell: transactions + end-of-day balance
    TransactionModal.tsx # Add/edit form for recurring and one-time transactions
    RecurringList.tsx    # Schedule panel: manage all recurring + adhoc transactions
migrations/
  0001_init.sql          # Initial schema: recurring_transactions, adhoc_transactions, account_balance
  0002_skipped_occurrences.sql  # Added skipped_occurrences table
  0003_balance_created_at.sql   # Added created_at to account_balance
  0004_auth.sql          # Auth migration: users table + user_id FKs on all data tables
```

## Architecture notes

### Worker vs Pages Functions
The project uses a **single Worker entry point** (`worker/index.ts`) with a hand-rolled URL router, not Cloudflare Pages Functions. This is intentional — it's the pattern the `@cloudflare/vite-plugin` integrates with for a seamless `npm run dev` experience. Static assets are served via the `[assets]` binding in `wrangler.toml`.

### Authentication
JWT-based auth with HTTP-only cookies (`bb_token`, 7-day expiry, `SameSite=Strict`). Password hashing uses PBKDF2-SHA256 with a per-user random salt (100,000 iterations). Auth endpoints:
- `POST /api/auth/register` — creates user, hashes password, sets JWT cookie, auto-creates `account_balance` row
- `POST /api/auth/login` — verifies credentials, sets JWT cookie
- `POST /api/auth/logout` — clears JWT cookie
- `GET /api/auth/me` — returns authenticated user from JWT

All data endpoints (`/api/balance`, `/api/recurring`, `/api/adhoc`, `/api/skipped`) require a valid JWT and filter every query by `user_id`. Requires `JWT_SECRET` set as a Cloudflare secret (or in `.dev.vars` for local dev).

### Balance calculation
`src/lib/balance.ts` — `computeAllDailyBalances(startBalance, startDate, recurring, adhoc, skipped, fromDate, toDate)`:
- `startBalance` = user-entered bank balance at the **start of `startDate`** (before that day's transactions)
- **Forward pass only**: from `startDate` to `toDate` — past balances are not shown in the UI
- Skipped transactions are excluded from the daily net calculation
- App pre-computes today → 18 months forward on load; recomputes whenever balance, transactions, or skipped set changes

### Recurrence engine
`src/lib/recurrence.ts` — `expandRecurring(rule, year, month)` returns all dates in the given month that match the rule. Supported patterns:
- `monthly_fixed` — same day every month (clamped to last day if needed)
- `weekly` — every occurrence of a weekday
- `biweekly` — every other occurrence, anchored to `biweekly_anchor` date
- `yearly` — one specific month + day
- `monthly_nth_weekday` — e.g. third Tuesday; `nth_week = -1` means last

### Skip occurrences
Clicking a transaction badge in the calendar marks it as skipped for that date. Skipped occurrences are persisted to `skipped_occurrences(id, user_id, transaction_id, transaction_type, date)` with a `UNIQUE(transaction_id, date)` constraint. Clicking again un-skips. Skipped transactions show struck-through in the UI and are excluded from balance projection.

### Theme
`src/lib/theme.ts` — Light/Dark/Auto toggle persisted to `localStorage`. Auto follows the OS system preference. Theme is applied via a CSS class on `<html>`.

## Deployment

The `@cloudflare/vite-plugin` outputs two build artifacts:
- `dist/budget_buddy/index.js` — compiled Worker
- `dist/client/` — React SPA static assets

`npm run deploy` runs `wrangler deploy --config dist/budget_buddy/wrangler.json`, which picks up the D1 binding and asset directory automatically from the generated config.

Before first production deploy:
```bash
npx wrangler d1 create budget-buddy-db
# Update database_id in wrangler.toml
wrangler secret put JWT_SECRET   # Required for auth — set a strong random value
npm run db:migrate:remote
npm run deploy
```
