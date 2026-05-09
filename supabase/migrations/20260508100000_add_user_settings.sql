CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  naming_templates JSONB NOT NULL DEFAULT '{}'
);
