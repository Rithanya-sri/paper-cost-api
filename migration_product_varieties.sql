-- Migration for Product Varieties

CREATE TABLE IF NOT EXISTS product_varieties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_name TEXT NOT NULL,
  dimension TEXT,
  color TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
