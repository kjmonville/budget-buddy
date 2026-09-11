# Budget Buddy

A personal finance app that projects a bank account balance forward through a list/calendar view. Available as a web app and a native iOS app. Supports multiple users with full authentication and data isolation.

`README.md` is the user-facing overview (what the app does, quick start, API surface). This file is for working in the codebase: structure, conventions, and the reasoning behind the non-obvious parts. Prefer adding detail here rather than duplicating the README.

## Stack

### Web
- **Frontend**: React 18 + Vite 6 + Tailwind CSS v4
- **Backend**: Cloudflare Worker (`worker/index.ts`) — handles all API routes
- **Database**: Cloudflare D1 (SQLite) — bound as `DB`
- **Dev tooling**: `@cloudflare/vite-plugin` runs the Worker in the Workers runtime during `npm run dev` — no second terminal needed

### iOS
- **Language**: Swift + SwiftUI
- **Architecture**: `@Observable` stores (`AuthStore`, `AppStore`), environment-injected `APIClient`
- **Auth**: JWT stored in Keychain; Face ID via a second biometric-protected Keychain slot (`LAContext` + `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly + .biometryCurrentSet`)
- **Balance engine**: `Logic/Balance.swift` mirrors the web `balance.ts` logic exactly

## Commands

```bash
npm run dev              # Start dev server (Vite + Worker + local D1)
npm run build            # TypeScript check + Vite build
npm run deploy           # Build, apply remote migrations, then deploy to Cloudflare
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
    balance.ts           # Computes end-of-day balances from the balance date forward
    theme.ts             # Light/Dark/Auto theme management with localStorage
  components/
    LoginPage.tsx        # Login/signup form with toggle between modes
    BalanceInput.tsx     # "Today's Balance" field with debounced save
    BalancePanel.tsx     # Projected-balance chart (7/30/60/90 day range switch)
    CalendarView.tsx     # Month grid with prev/next navigation
    CalendarDay.tsx      # Single day cell: transaction badges, hover detail, end-of-day balance
    TransactionModal.tsx # Add/edit form for recurring and one-time transactions
    InstanceEditModal.tsx # Edit a single occurrence of a recurring series
    RecurringList.tsx    # Schedule panel: manage all recurring + adhoc transactions
    HelpDrawer.tsx       # In-app help; references screenshots in public/help/
migrations/
  0001_init.sql          # Initial schema: recurring_transactions, adhoc_transactions, account_balance
  0002_skipped_occurrences.sql  # Added skipped_occurrences table
  0003_balance_created_at.sql   # Added created_at to account_balance
  0004_auth.sql          # Auth migration: users table + user_id FKs on all data tables
  0005_transaction_notes.sql    # notes column on both transaction tables
  0006_paid_occurrences.sql     # paid_occurrences table
  0007_recurring_start_date.sql # start_date on recurring_transactions
  0008_skipped_mode.sql         # mode column on skipped_occurrences ('cleared' | 'deleted')
  0009_recurring_occurrence_count.sql # occurrence_count on recurring_transactions
public/
  help/                  # Help drawer screenshots + SCREENSHOTS.md capture instructions
  assets/                # Logo marks
docs/handoffs/           # Design handoffs (balance chart, logo)

ios/BudgetBuddy/
  BudgetBuddyApp.swift   # App entry point; injects AuthStore + AppStore into environment
  Info.plist             # Bundle config — includes NSFaceIDUsageDescription
  Transaction.swift      # RecurringTransaction + AdhocTransaction models
  AccountBalance.swift   # AccountBalance model
  SkippedOccurrence.swift
  PaidOccurrence.swift
  User.swift
  Networking/
    AuthStore.swift      # JWT Keychain storage, Face ID biometric slot, lock/logout/clear
    AppStore.swift       # Loads + caches balance/recurring/adhoc/skipped/paid; owns dailyBalances
    APIClient.swift      # Typed async/await wrappers for all API endpoints
    Config.swift         # BB_API_BASE read from Info.plist (set per build configuration)
  Logic/
    Balance.swift        # computeDaily() — mirrors web balance.ts; TxEntry + DayBalance types
    Recurrence.swift     # expand() — mirrors web recurrence.ts
  Views/
    RootView.swift       # Auth gate: LockView / CalendarView / LoginView; scene-phase auto-lock
    LockView.swift       # Face ID lock screen (auto-triggers on appear); password fallback
    LoginView.swift      # Email/password login + Face ID sign-in button when biometrics enabled
    CalendarView.swift   # Main screen: balance header, forecast chart, upcoming transaction list
    ScheduleView.swift   # Sheet: full list of recurring + adhoc transactions
    TransactionRow.swift # Single row: name, amount, cleared/paid toggles, edit/delete actions
    TransactionForm.swift# Shared form fields for add/edit sheets
    AddTransactionSheet.swift
    EditTransactionSheet.swift
    ForecastChart.swift  # 30-day balance projection chart
    HelpView.swift       # iOS counterpart to the web help drawer
  Theme/
    Colors.swift         # bbIndigo, bbExpense, bbWarning, bbDeposit color definitions
```

## Architecture notes

### Worker vs Pages Functions
The project uses a **single Worker entry point** (`worker/index.ts`) with a hand-rolled URL router, not Cloudflare Pages Functions. This is intentional — it's the pattern the `@cloudflare/vite-plugin` integrates with for a seamless `npm run dev` experience. Static assets are served via the `[assets]` binding in `wrangler.toml`.

### Authentication
JWT-based auth. The token is delivered two ways and `getTokenFromRequest()` accepts either — an `Authorization: Bearer <jwt>` header (preferred, used by iOS) falling back to an HTTP-only `bb_token` cookie (7-day expiry, `SameSite=Strict`, used by web). Password hashing uses PBKDF2-SHA256 with a per-user random salt (100,000 iterations). Auth endpoints:
- `POST /api/auth/register` — creates user, hashes password, sets JWT cookie, auto-creates `account_balance` row
- `POST /api/auth/login` — verifies credentials, sets JWT cookie
- `POST /api/auth/logout` — clears JWT cookie
- `GET /api/auth/me` — returns authenticated user from JWT

All data endpoints (`/api/balance`, `/api/recurring`, `/api/adhoc`, `/api/skipped`, `/api/paid`) require a valid JWT and filter every query by `user_id`. Requires `JWT_SECRET` set as a Cloudflare secret (or in `.dev.vars` for local dev).

### Balance calculation
`src/lib/balance.ts` — `computeAllDailyBalances(startBalance, startDate, recurring, adhoc, skipped, paid, cutoffDate, fromDate, toDate)`:
- `startBalance` = user-entered bank balance at the **start of `startDate`** (before that day's transactions), reflecting only what has actually cleared the bank
- `cutoffDate` = first day of the month the user's `account_balance` row was created, derived server-side in `getBalance()`. Transactions dated before it are ignored entirely, so back-dated recurring rules don't retroactively rewrite history.
- **Opening adjustment**: uncleared transactions between `cutoffDate` and `startDate - 1` are summed into the opening balance. They haven't hit the bank, so they aren't in `startBalance`, but they still need to land somewhere or a forgotten bill silently vanishes from the forecast.
- **Forward pass** from `startDate` to `toDate`. Days before today get `endBalance: null` — badges render, no number.
- Cleared transactions (`mode: 'cleared'`) are excluded from the daily net; `mode: 'deleted'` occurrences are dropped from the day entirely.
- Paid transactions still count — see **Paid flag** below.
- `App.tsx` computes over 3 months back → 18 months forward (`getRangeFromToday()`), recomputing whenever balance, transactions, cleared set, or paid set changes.

### Recurrence engine
`src/lib/recurrence.ts` — `expandRecurring(rule, year, month)` returns all dates in the given month that match the rule. Supported patterns:
- `monthly_fixed` — same day every month (clamped to last day if needed)
- `weekly` — every occurrence of a weekday
- `biweekly` — every other occurrence, anchored to `biweekly_anchor` date
- `yearly` — one specific month + day
- `monthly_nth_weekday` — e.g. third Tuesday; `nth_week = -1` means last

`countOccurrencesThrough(rule, date)` returns the 1-based occurrence number of `date`, counting every firing from `rule.start_date` (inclusive) through `date`. Used to cap a series at a fixed number of instances: when `occurrence_count` is set, `balance.ts` drops any occurrence whose index exceeds it and stamps the rest with `occurrencesRemaining` (`occurrence_count - index + 1`), which the calendar appends to the transaction name as `Name [n]`. Requires `start_date` to be set — without an anchor there's no well-defined 1st occurrence, so the UI defaults `start_date` to today when a count is entered without one. Leaving the count blank repeats indefinitely.

### Cleared occurrences
Clicking a transaction badge in the calendar marks it as cleared for that date — meaning it has already come out of (or landed in) the user's real bank account. Cleared occurrences are persisted to `skipped_occurrences(id, user_id, transaction_id, transaction_type, date, mode, created_at)` with a `UNIQUE(transaction_id, date)` constraint. `mode` is `'cleared'` or `'deleted'` — the same table backs both "this already happened" and "this occurrence shouldn't exist", which is why the table name no longer matches what it mostly stores. Clicking again un-clears. Cleared transactions show struck-through in the UI and are excluded from the balance projection, since the starting balance already reflects them.

### Per-instance edits and deletes
A recurring rule is a template, so a single occurrence can't be edited in place. Both operations in `App.tsx` work by suppressing the generated occurrence:

- **Delete instance** (`handleCalendarDelete`) — writes a `skipped_occurrences` row with `mode: 'deleted'` for that date. `balance.ts` drops it from the day; the rest of the series is untouched.
- **Edit instance** (`handleSaveInstance`) — writes the same `'deleted'` row for the original date, then creates an **adhoc transaction** carrying the rule's type and name with the edited amount/date/notes. The override is a genuinely separate row, so editing it again later goes through the normal adhoc path, not this one.

Consequence worth knowing: an edited occurrence is no longer part of the series, so it doesn't count toward `occurrence_count` and won't move if the rule's schedule changes.

### Calendar interactions
`CalendarDay.tsx` packs four gestures into one badge:
- **Click the badge** → toggle cleared.
- **Click the ✓/○ circle** → toggle paid (the click is stopped from bubbling to the badge).
- **Right-click** → context menu with Edit Instance / Delete Instance.
- **Hover** → a styled detail tooltip (full name, `[n]` remaining, signed amount, date, and that occurrence's state).

The tooltip is rendered through `createPortal` to `document.body` rather than in place. Past-day cells carry `opacity-60`, and CSS opacity dims descendants no matter their positioning — rendered inline the tooltip came out greyed. The portal also sidesteps the transaction list's `overflow-hidden`. Position is fixed, clamped to the viewport, and flips below the badge near the top edge.

### Paid flag
Marking a transaction as paid is a personal reminder that a payment has been made but has not yet cleared the bank account. It does **not** affect the balance projection — the transaction still counts because the bank has not yet processed it. Paid state is purely a visual indicator for the user's own tracking. Persisted to `paid_occurrences`, which mirrors `skipped_occurrences` minus the `mode` column.

### Theme
`src/lib/theme.ts` — Light/Dark/Auto toggle persisted to `localStorage`. Auto follows the OS system preference. Theme is applied via a CSS class on `<html>`.

---

## iOS architecture notes

### Auth flow
`AuthStore` is the single source of truth for auth state. Two Keychain slots:
- `"jwt"` — standard slot, always written on login
- `"jwt-biometric"` — protected by `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly + .biometryCurrentSet`; only readable after Face ID success

State transitions:
- **Cold launch, biometrics enabled** → `isLocked = true`, token not read → `LockView` auto-triggers Face ID
- **Successful Face ID** → token read from biometric slot, `isLocked = false` → `CalendarView`
- **Face ID fail → "Sign in with password"** → `cancelLock()` sets `isLocked = false` (biometrics kept) → `LoginView` shows Face ID button for retry
- **Sign out** → `logout()` clears session token, biometric slot preserved → `LoginView` shows Face ID button for quick re-auth
- **App backgrounded** → `RootView` observes `scenePhase == .background` → `lock()` sets `isLocked = true`
- **Full wipe** (account deletion) → `clear()` removes both Keychain slots and all UserDefaults keys

### Balance engine (iOS)
`Logic/Balance.swift` — `computeDaily(...)` mirrors `src/lib/balance.ts` exactly:
- Window: 3 months back → 18 months forward (`AppStore.fromDate` / `toDate`)
- Past days: transactions stored with correct cleared flags, `endBalance = nil`
- Past uncleared transactions surface in `upcomingByDay()` at the top of the list (orange header) so the user can acknowledge them

### API client
`APIClient` is injected via SwiftUI environment key (`\.api`). On any 401 response it calls `auth.logout()` and throws `.unauthorized`. `Config.swift` reads `BB_API_BASE` from `Info.plist`, which is set per build configuration in `project.pbxproj` so debug builds hit localhost and release builds hit production.

## Deployment

The `@cloudflare/vite-plugin` outputs two build artifacts:
- `dist/budget_buddy/index.js` — compiled Worker
- `dist/client/` — React SPA static assets

`npm run deploy` builds, runs `wrangler d1 migrations apply DB --remote`, then `wrangler deploy --config dist/budget_buddy/wrangler.json`, which picks up the D1 binding and asset directory automatically from the generated config. Remote migrations are part of deploy — don't run them separately first.

`ALLOWED_ORIGIN` in `wrangler.toml` is the single browser origin that gets an `Access-Control-Allow-Origin` header back; every other origin gets none. Set it to the deployed URL or custom domain. It has no bearing on the native iOS client, which isn't subject to CORS.

Before first production deploy:
```bash
npx wrangler d1 create budget-buddy-db
# Update database_id in wrangler.toml
wrangler secret put JWT_SECRET   # Required for auth — set a strong random value
# Set ALLOWED_ORIGIN in wrangler.toml to the deployed URL
npm run deploy                   # applies remote migrations as part of the deploy
```
