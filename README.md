# Budget Buddy

A personal finance app that projects your bank balance forward, day by day, so you can see what your account will look like weeks or months from now — and spot the day it dips below zero before it happens.

You enter your current bank balance and your recurring bills and income. Budget Buddy expands those rules across a calendar and shows an end-of-day balance in every cell.

Available as a web app (React + Cloudflare Workers) and a native iOS app (SwiftUI) sharing one backend.

## Features

- **Balance projection** — a running end-of-day balance for every day from today through 18 months out, recomputed instantly as you edit.
- **Forecast chart** — 7/30/60/90-day projection with a low-balance marker calling out the lowest point and the date it lands on.
- **Recurring transactions** — monthly on a fixed day, weekly, biweekly (anchored to a date), yearly, or the nth weekday of a month (e.g. the last Friday).
- **Limited-repeat series** — cap a recurring rule at a fixed number of instances; the calendar counts down the remaining occurrences next to the name.
- **One-off transactions** — anything that doesn't repeat.
- **Per-instance edits** — change or delete a single occurrence of a recurring series without touching the rule.
- **Cleared** — click a transaction to mark it as already in or out of your real bank account. Cleared items are struck through and drop out of the projection, since your starting balance already reflects them.
- **Paid** — a separate flag for "I've made this payment but it hasn't hit the bank yet." Visual only; the transaction still counts against the projection.
- **Multi-user** — full authentication with per-user data isolation.
- **Light / dark / auto** theme, following the OS preference by default.
- **Built-in help drawer** explaining the balance model and each transaction type.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 18, Vite 6, Tailwind CSS v4 |
| Backend | Cloudflare Worker (`worker/index.ts`) — hand-rolled router, all API routes |
| Database | Cloudflare D1 (SQLite), bound as `DB` |
| iOS | Swift + SwiftUI, `@Observable` stores, JWT in Keychain, Face ID |

The `@cloudflare/vite-plugin` runs the Worker inside the real Workers runtime during `npm run dev`, against a local D1 — one command, no second terminal, no mock backend.

## Quick start

```bash
git clone https://github.com/kjmonville/budget-buddy.git
cd budget-buddy
npm install

# Auth needs a signing secret locally
echo 'JWT_SECRET=some-long-random-string' > .dev.vars

npm run db:migrate        # apply migrations to the local D1
npm run dev               # http://localhost:5173
```

Open the app, create an account, and enter your current bank balance in the header field.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite + Worker + local D1 |
| `npm run build` | TypeScript check, then Vite build |
| `npm run deploy` | Build, apply remote migrations, deploy to Cloudflare |
| `npm run db:migrate` | Apply migrations to local D1 |
| `npm run db:migrate:remote` | Apply migrations to production D1 |

## How the projection works

`src/lib/balance.ts` treats your entered balance as what the bank actually holds on its balance date — reflecting only transactions that have already cleared. From there it walks forward day by day, applying everything that fires on each date.

- Recurring rules are expanded per month by `src/lib/recurrence.ts`.
- Cleared occurrences are excluded from the projection; your starting balance already includes them.
- Paid occurrences are *not* excluded — the bank hasn't processed them yet, so they still count.
- Anything still uncleared from *before* your balance date is folded into the opening balance, so a bill you never marked cleared doesn't silently vanish from the forecast.
- Transactions before the cutoff date — the first of the month you started using the app — are ignored entirely.
- The window runs 3 months back to 18 months forward. Past days show their transactions but no projected balance, so overdue uncleared items stay visible without inventing history.

`ios/BudgetBuddy/Logic/Balance.swift` mirrors this logic so both clients produce identical numbers.

## Project layout

```
worker/index.ts        Worker: router + every API handler (auth + data)
src/
  App.tsx              Root: auth state, data fetching, layout
  lib/
    balance.ts         End-of-day balance computation
    recurrence.ts      Recurrence rule → dates
    api.ts             Typed fetch wrappers
    theme.ts           Light/dark/auto
  components/          Calendar, schedule, modals, login, help
migrations/            D1 schema, applied in order
ios/                   Native SwiftUI app — see ios/README.md
public/                Icons, manifest, help screenshots
```

## API

All routes live under `/api`. Every data route requires authentication and filters by the authenticated user.

| Route | Methods | Purpose |
|---|---|---|
| `/api/auth/register` · `/login` · `/logout` · `/me` | `POST` / `GET` | Account + session |
| `/api/balance` | `GET` `PUT` | Current bank balance |
| `/api/recurring` · `/api/recurring/:id` | `GET` `POST` `PUT` `DELETE` | Recurring rules |
| `/api/adhoc` · `/api/adhoc/:id` | `GET` `POST` `PUT` `DELETE` | One-off transactions |
| `/api/skipped` · `/api/skipped/:id` | `GET` `POST` `DELETE` | Cleared / deleted occurrences |
| `/api/paid` · `/api/paid/:id` | `GET` `POST` `DELETE` | Paid flags |

### Authentication

Passwords are hashed with PBKDF2-SHA256, 100,000 iterations, and a per-user random salt. A successful login issues a JWT delivered two ways:

- **Web** — an HTTP-only `bb_token` cookie, `SameSite=Strict`, 7-day expiry.
- **iOS** — an `Authorization: Bearer <jwt>` header, with the token held in the Keychain.

The Worker accepts either. It requires `JWT_SECRET` — set it in `.dev.vars` locally and as a Cloudflare secret in production.

## Deployment

First deploy:

```bash
npx wrangler d1 create budget-buddy-db     # put the id in wrangler.toml
npx wrangler secret put JWT_SECRET         # use a strong random value
npm run deploy
```

`npm run deploy` builds, applies any pending remote migrations, and deploys the Worker with the SPA assets. Set `ALLOWED_ORIGIN` in `wrangler.toml` to your deployed URL or custom domain.

## iOS app

`ios/BudgetBuddy.xcodeproj`, Xcode 16+, iOS 17 deployment target. It talks to the same Worker; debug builds point at `http://localhost:5173/api` and release builds at production, set per build configuration.

Face ID unlock uses a second, biometry-protected Keychain slot, so the token is only readable after a successful biometric check and is invalidated if the device's enrolled biometrics change.

See [`ios/README.md`](ios/README.md) for setup, configuration, and architecture.
