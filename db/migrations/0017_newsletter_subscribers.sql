-- Customer email opt-ins for offers and new drops.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  source     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON newsletter_subscribers(email);
