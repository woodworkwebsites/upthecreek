-- Catalogue ranges and drop visibility.

CREATE TABLE IF NOT EXISTS ranges (
  id                TEXT PRIMARY KEY,
  name              TEXT UNIQUE NOT NULL,
  storefront_enabled INTEGER NOT NULL DEFAULT 1,
  partner_enabled    INTEGER NOT NULL DEFAULT 1,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE products ADD COLUMN range_id TEXT;

CREATE INDEX IF NOT EXISTS idx_products_range_id ON products(range_id);
CREATE INDEX IF NOT EXISTS idx_ranges_sort_order ON ranges(sort_order);

INSERT OR IGNORE INTO ranges (id, name, storefront_enabled, partner_enabled, sort_order)
VALUES ('evergreen', 'Evergreen', 1, 1, 0);

UPDATE products
SET range_id = 'evergreen'
WHERE range_id IS NULL OR TRIM(range_id) = '';
