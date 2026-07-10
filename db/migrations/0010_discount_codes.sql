CREATE TABLE IF NOT EXISTS discount_codes (
  id            TEXT PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,
  kind          TEXT NOT NULL,
  value         INTEGER NOT NULL,
  usage_limit   INTEGER,
  usage_count   INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1,
  expires_at    TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_discount_codes_code   ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(active);
