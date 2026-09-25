CREATE TABLE IF NOT EXISTS webhook_diagnostics (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  reason TEXT NOT NULL,
  id_candidates INTEGER NOT NULL DEFAULT 0,
  secret_normalized INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
