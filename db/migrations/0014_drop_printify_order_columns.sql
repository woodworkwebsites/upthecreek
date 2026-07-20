-- Remove legacy Printify order columns and dead supplier logs.

ALTER TABLE orders DROP COLUMN printify_mode;
ALTER TABLE orders DROP COLUMN printify_order_id;
ALTER TABLE orders DROP COLUMN printify_payload;
ALTER TABLE orders DROP COLUMN printify_response;

DROP TABLE IF EXISTS printify_logs;
DROP INDEX IF EXISTS idx_printify_logs_order;
