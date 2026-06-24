ALTER TABLE skipped_occurrences ADD COLUMN mode TEXT NOT NULL DEFAULT 'cleared'
  CHECK(mode IN ('cleared', 'deleted'));
