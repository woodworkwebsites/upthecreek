-- Allow one order to credit multiple partners, which the collabs store needs.

BEGIN TRANSACTION;

ALTER TABLE partner_commissions RENAME TO partner_commissions_old;

CREATE TABLE partner_commissions (
  id                TEXT PRIMARY KEY,
  partner_id        TEXT NOT NULL,
  order_id          TEXT NOT NULL,
  order_status      TEXT NOT NULL,
  gross_sales       INTEGER NOT NULL,
  discount_amount   INTEGER NOT NULL DEFAULT 0,
  commission_rate   INTEGER NOT NULL DEFAULT 0,
  commission_amount INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending',
  payout_id         TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(order_id, partner_id)
);

INSERT INTO partner_commissions (
  id,
  partner_id,
  order_id,
  order_status,
  gross_sales,
  discount_amount,
  commission_rate,
  commission_amount,
  status,
  payout_id,
  created_at,
  updated_at
)
SELECT
  id,
  partner_id,
  order_id,
  order_status,
  gross_sales,
  discount_amount,
  commission_rate,
  commission_amount,
  status,
  payout_id,
  created_at,
  updated_at
FROM partner_commissions_old;

DROP TABLE partner_commissions_old;

CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner_id ON partner_commissions(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status);

COMMIT;
