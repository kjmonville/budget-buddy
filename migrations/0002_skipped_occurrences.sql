CREATE TABLE IF NOT EXISTS skipped_occurrences (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  transaction_id   TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('recurring', 'adhoc')),
  date             TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(transaction_id, date)
);
