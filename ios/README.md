# Budget Buddy iOS

Native SwiftUI iPhone app that consumes the same Cloudflare Worker + D1 backend as the web app.

## Requirements

- **Xcode 16** or later (uses synchronized folders + iOS 17 deployment target).
- The web app's worker running locally (`npm run dev` in the repo root) on `http://localhost:5173`.

## Run

1. Open `ios/BudgetBuddy.xcodeproj` in Xcode.
2. Select the `BudgetBuddy` scheme and an iPhone simulator.
3. ⌘R.

If the simulator can't reach the local worker, double-check the `BB_API_BASE` value in the build settings (`Build Settings` → search "BB_API_BASE"). For a physical device, point it at your Mac's LAN IP, e.g. `http://192.168.1.42:5173/api`, and grant local-network permission when prompted.

## Configuration

The API base URL is read from `Info.plist` key `BB_API_BASE`, set via the `INFOPLIST_KEY_BB_API_BASE` build setting. Override per-configuration as needed:

- Debug → `http://localhost:5173/api` (default)
- Release → set to your deployed worker URL before archiving.

## Auth

JWT issued by the worker is stored in the iOS Keychain (`AuthStore`) and sent on every request as `Authorization: Bearer <jwt>`. The worker accepts both Bearer tokens (iOS) and the `bb_token` cookie (web).

## Architecture

```
BudgetBuddy/
  BudgetBuddyApp.swift         # @main
  Models/                      # Codable mirrors of src/types.ts
  Networking/
    APIClient.swift            # async/await URLSession wrapper
    AuthStore.swift            # Keychain-backed JWT
    AppStore.swift             # @Observable shared state, balance computation
    Config.swift               # API base URL
  Logic/
    Recurrence.swift           # port of src/lib/recurrence.ts
    Balance.swift              # port of src/lib/balance.ts
  Views/
    RootView.swift             # routes Login vs Calendar
    LoginView.swift
    CalendarView.swift         # forecast chart + upcoming list
    ForecastChart.swift        # SwiftUI Charts line graph
    TransactionRow.swift       # swipe actions: leading=skip, trailing=edit/delete
    TransactionForm.swift      # shared form body for Add + Edit
    AddTransactionSheet.swift
    EditTransactionSheet.swift
    ScheduleView.swift         # all transactions, grouped by source/type
  Theme/
    Colors.swift               # bbIndigo/bbExpense/bbDeposit/bbWarning
```

## Notes

- **Skip vs Delete** for recurring: swiping left on a row in the calendar opens the same dialog the web app shows — *Skip just this occurrence* (default) or *Delete entire series* (destructive). The wireframes' "Delete all upcoming" option is intentionally omitted; the backend doesn't support it.
- The state model matches the web app's `skipped_occurrences` semantics, **not** the wireframes' literal "cleared" terminology.
- All four data fetches happen in parallel on launch (mirrors `App.tsx`).
