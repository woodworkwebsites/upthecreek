-- Manual (SellShirts) fulfillment support — additive, Printify path untouched.

ALTER TABLE orders ADD COLUMN fulfillment_provider TEXT NOT NULL DEFAULT 'printify';
-- printify | manual

ALTER TABLE orders ADD COLUMN external_order_ref TEXT;

ALTER TABLE orders ADD COLUMN shipping_name     TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN shipping_phone    TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN shipping_address1 TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN shipping_address2 TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN shipping_city     TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN shipping_region   TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN shipping_zip      TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN shipping_country  TEXT NOT NULL DEFAULT '';

INSERT OR IGNORE INTO settings (key, value) VALUES ('fulfillment_provider', 'printify');
