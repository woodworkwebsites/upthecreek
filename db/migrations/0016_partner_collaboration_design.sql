-- Partner-specific collaboration shirt configuration.

ALTER TABLE partners ADD COLUMN collaboration_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE partners ADD COLUMN collaboration_design TEXT;
