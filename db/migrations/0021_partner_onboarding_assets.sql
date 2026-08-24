-- Placeholder onboarding literature and signage generated for new club onboarding.

CREATE TABLE IF NOT EXISTS partner_onboarding_assets (
  id            TEXT PRIMARY KEY,
  partner_id    TEXT NOT NULL REFERENCES partners(id),
  asset_type    TEXT NOT NULL,
  title         TEXT NOT NULL,
  url           TEXT NOT NULL,
  r2_key        TEXT NOT NULL,
  content_type  TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(partner_id, asset_type)
);

CREATE INDEX IF NOT EXISTS idx_partner_onboarding_assets_partner_id
  ON partner_onboarding_assets(partner_id);
