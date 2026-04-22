CREATE TABLE IF NOT EXISTS recurring_transactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  type TEXT NOT NULL CHECK(type IN ('deposit', 'expense')),
  name TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  recurrence_type TEXT NOT NULL CHECK(recurrence_type IN (
    'monthly_fixed',
    'weekly',
    'biweekly',
    'yearly',
    'monthly_nth_weekday'
  )),
  -- monthly_fixed: day 1-31 of every month
  -- yearly: specific month + day
  day_of_month   INTEGER,
  -- yearly: month number 1-12
  month          INTEGER,
  -- weekly, biweekly, monthly_nth_weekday: 0=Sun, 1=Mon, ..., 6=Sat
  day_of_week    INTEGER,
  -- monthly_nth_weekday: 1=first, 2=second, ..., 5=fifth, -1=last
  nth_week       INTEGER,
  -- biweekly: ISO date anchor to determine even/odd week parity
  biweekly_anchor TEXT,
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS adhoc_transactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  type TEXT NOT NULL CHECK(type IN ('deposit', 'expense')),
  name TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Singleton row: one balance record per user (user_id added in future auth revision)
CREATE TABLE IF NOT EXISTS account_balance (
  id         INTEGER PRIMARY KEY CHECK(id = 1),
  amount     REAL NOT NULL DEFAULT 0,
  balance_date TEXT NOT NULL DEFAULT (date('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO account_balance (id, amount) VALUES (1, 0);
