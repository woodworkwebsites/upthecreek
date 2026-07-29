-- Canonical storage for partner collaboration designs and their image URLs.

CREATE TABLE IF NOT EXISTS partner_collaboration_designs (
  id           TEXT PRIMARY KEY,
  partner_id   TEXT NOT NULL REFERENCES partners(id),
  title        TEXT NOT NULL,
  description  TEXT,
  image_urls   TEXT NOT NULL DEFAULT '[]',
  garment      TEXT,
  color_name   TEXT NOT NULL DEFAULT 'Collaboration',
  color_hex    TEXT NOT NULL DEFAULT '#111827',
  sizes        TEXT NOT NULL DEFAULT '[]',
  partner_price INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_partner_collaboration_designs_partner_id
  ON partner_collaboration_designs(partner_id);
