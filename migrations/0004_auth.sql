-- Users table
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Recreate all data tables with user_id (wipes existing single-user data)
DROP TABLE IF EXISTS skipped_occurrences;
DROP TABLE IF EXISTS adhoc_transactions;
DROP TABLE IF EXISTS recurring_transactions;
DROP TABLE IF EXISTS account_balance;

CREATE TABLE recurring_transactions (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  type             TEXT NOT NULL CHECK(type IN ('deposit','expense')),
  name             TEXT NOT NULL,
  amount           REAL NOT NULL CHECK(amount > 0),
  recurrence_type  TEXT NOT NULL CHECK(recurrence_type IN (
    'monthly_fixed','weekly','biweekly','yearly','monthly_nth_weekday'
  )),
  day_of_month     INTEGER,
  month            INTEGER,
  day_of_week      INTEGER,
  nth_week         INTEGER,
  biweekly_anchor  TEXT,
  active           INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE adhoc_transactions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  type       TEXT NOT NULL CHECK(type IN ('deposit','expense')),
  name       TEXT NOT NULL,
  amount     REAL NOT NULL CHECK(amount > 0),
  date       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE account_balance (
  user_id      TEXT PRIMARY KEY,
  amount       REAL NOT NULL DEFAULT 0,
  balance_date TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE skipped_occurrences (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  transaction_id   TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('recurring','adhoc')),
  date             TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(transaction_id, date)
);
