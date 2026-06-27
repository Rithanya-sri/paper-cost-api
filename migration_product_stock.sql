-- Product Stock Table
-- Tracks finished product inventory (what has been produced and available to deliver)

CREATE TABLE IF NOT EXISTS product_stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_name TEXT NOT NULL,
  variety TEXT DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'Pieces',
  daily_production INTEGER NOT NULL DEFAULT 0,
  current_stock INTEGER NOT NULL DEFAULT 0,
  minimum_stock INTEGER NOT NULL DEFAULT 0,
  last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_stock_name ON product_stock(product_name);
