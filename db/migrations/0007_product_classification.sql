ALTER TABLE products ADD COLUMN audience TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN product_type TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN garment TEXT NOT NULL DEFAULT '';

INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
  ('catalog_audience_options', '["Men","Womens","Kids"]', datetime('now')),
  ('catalog_product_options', '["Tshirt","Hoody","Sweatshirt"]', datetime('now')),
  ('catalog_garment_options', '["Mens Heavyweight","Women''s Relaxed","Kids Supersoft","College Hoodie","Zip Hoodie"]', datetime('now')),
  ('catalog_color_options', '[{"name":"Black","hex":"#111827"},{"name":"Dark Grey","hex":"#374151"},{"name":"Navy","hex":"#1e3a8a"},{"name":"White","hex":"#f9fafb"},{"name":"Natural","hex":"#f5f1e8"},{"name":"True Royal","hex":"#1d4ed8"},{"name":"Military Green","hex":"#4b5d43"},{"name":"Mauve","hex":"#d48a8a"},{"name":"Sage","hex":"#b6c0a8"}]', datetime('now'));
