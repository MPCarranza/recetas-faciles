CREATE TABLE IF NOT EXISTS processed_payments (
  payment_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  payer_email TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  download_expires_at INTEGER NOT NULL,
  delivery_email_sent_at INTEGER,
  seller_email_sent_at INTEGER,
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_processed_payments_status
  ON processed_payments(status);
