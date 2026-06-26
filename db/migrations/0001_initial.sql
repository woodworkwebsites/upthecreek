-- Up the Creek Padel – initial schema

CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  printify_id TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT 'apparel',
  images      TEXT NOT NULL DEFAULT '[]',   -- JSON: [{src,isDefault,variantIds}]
  variants    TEXT NOT NULL DEFAULT '[]',   -- JSON: [{id,color,size,price,available}]
  colors      TEXT NOT NULL DEFAULT '[]',   -- JSON: [{name,hex}]
  sizes       TEXT NOT NULL DEFAULT '[]',   -- JSON: string[]
  min_price   INTEGER NOT NULL DEFAULT 0,   -- pence
  max_price   INTEGER NOT NULL DEFAULT 0,   -- pence
  is_enabled  INTEGER NOT NULL DEFAULT 1,
  synced_at   TEXT NOT NULL DEFAULT (datetime('now')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id                      TEXT PRIMARY KEY,
  stripe_session_id       TEXT UNIQUE NOT NULL,
  stripe_payment_intent   TEXT,
  customer_email          TEXT NOT NULL,
  customer_name           TEXT,
  amount_total            INTEGER NOT NULL,  -- pence
  currency                TEXT NOT NULL DEFAULT 'gbp',
  status                  TEXT NOT NULL DEFAULT 'pending',
  -- pending | paid | fulfillment_started | fulfilled | failed
  printify_mode           TEXT NOT NULL DEFAULT 'dry_run',
  -- dry_run | draft | live
  printify_order_id       TEXT,
  printify_payload        TEXT,  -- JSON
  printify_response       TEXT,  -- JSON
  error                   TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id              TEXT PRIMARY KEY,
  order_id        TEXT NOT NULL REFERENCES orders(id),
  printify_id     TEXT NOT NULL,
  variant_id      INTEGER NOT NULL,
  title           TEXT NOT NULL,
  color           TEXT NOT NULL DEFAULT '',
  size            TEXT NOT NULL DEFAULT '',
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price      INTEGER NOT NULL,  -- pence
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id               TEXT PRIMARY KEY,
  status           TEXT NOT NULL,  -- success | error
  products_synced  INTEGER,
  message          TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id                TEXT PRIMARY KEY,
  event_type        TEXT NOT NULL,
  stripe_session_id TEXT,
  status            TEXT NOT NULL,  -- received | processed | ignored | error
  payload           TEXT,  -- JSON (truncated for storage)
  error             TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS printify_logs (
  id        TEXT PRIMARY KEY,
  order_id  TEXT REFERENCES orders(id),
  mode      TEXT NOT NULL,    -- dry_run | draft | live
  action    TEXT NOT NULL,    -- create_order | dry_run
  status    TEXT NOT NULL,    -- success | error
  payload   TEXT,             -- JSON
  response  TEXT,             -- JSON
  error     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_status         ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_session  ON webhook_logs(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created     ON sync_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_printify_logs_order   ON printify_logs(order_id);
