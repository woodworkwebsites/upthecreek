-- Partner portal support: club access plus order attribution via discount code.

CREATE TABLE IF NOT EXISTS partners (
  id              TEXT PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  discount_code   TEXT,
  access_token    TEXT UNIQUE NOT NULL,
  commission_rate INTEGER NOT NULL DEFAULT 10,
  description     TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_partners_slug          ON partners(slug);
CREATE INDEX IF NOT EXISTS idx_partners_discount_code  ON partners(discount_code);
CREATE INDEX IF NOT EXISTS idx_partners_access_token  ON partners(access_token);
