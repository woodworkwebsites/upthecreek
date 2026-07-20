-- Partner ledger: commission and payout tracking for the portal.

CREATE TABLE IF NOT EXISTS partner_commissions (
  id                TEXT PRIMARY KEY,
  partner_id        TEXT NOT NULL,
  order_id          TEXT NOT NULL UNIQUE,
  order_status      TEXT NOT NULL,
  gross_sales       INTEGER NOT NULL,
  discount_amount   INTEGER NOT NULL DEFAULT 0,
  commission_rate   INTEGER NOT NULL DEFAULT 0,
  commission_amount INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending',
  payout_id         TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS partner_payouts (
  id           TEXT PRIMARY KEY,
  partner_id   TEXT NOT NULL,
  period_start TEXT,
  period_end   TEXT,
  amount       INTEGER NOT NULL DEFAULT 0,
  reference    TEXT,
  notes        TEXT,
  paid_at      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner_id ON partner_commissions(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner_id ON partner_payouts(partner_id);
