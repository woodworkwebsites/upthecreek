-- Partner stock order workflow: canonical statuses plus invoice payment tracking.

ALTER TABLE partner_stock_orders ADD COLUMN invoice_paid INTEGER NOT NULL DEFAULT 0;

UPDATE partner_stock_orders
SET status = 'club_submitted'
WHERE status = 'submitted';

UPDATE partner_stock_orders
SET status = 'with_club'
WHERE status = 'fulfilled';
