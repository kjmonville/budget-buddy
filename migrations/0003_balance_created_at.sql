ALTER TABLE account_balance ADD COLUMN created_at TEXT;
UPDATE account_balance SET created_at = datetime('now') WHERE created_at IS NULL;
