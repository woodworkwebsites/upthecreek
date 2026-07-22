-- Partner console stock order requests (wholesale, invoiced separately — no payment collected here).

CREATE TABLE IF NOT EXISTS partner_stock_orders (
  id           TEXT PRIMARY KEY,
  partner_id   TEXT NOT NULL REFERENCES partners(id),
  status       TEXT NOT NULL DEFAULT 'submitted',
  total_pieces INTEGER NOT NULL DEFAULT 0,
  total_value  INTEGER NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS partner_stock_order_items (
  id             TEXT PRIMARY KEY,
  stock_order_id TEXT NOT NULL REFERENCES partner_stock_orders(id),
  printify_id    TEXT NOT NULL,
  variant_id     INTEGER,
  title          TEXT NOT NULL,
  color          TEXT NOT NULL DEFAULT '',
  size           TEXT NOT NULL DEFAULT '',
  quantity       INTEGER NOT NULL DEFAULT 1,
  unit_price     INTEGER NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_partner_stock_orders_partner_id        ON partner_stock_orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_stock_order_items_order_id     ON partner_stock_order_items(stock_order_id);
