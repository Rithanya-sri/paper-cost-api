-- Order Tracking Migration

-- 1. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  job_card_no TEXT,
  product_name TEXT NOT NULL,
  dimension TEXT,
  color TEXT,
  quantity INTEGER,
  raw_material_check TEXT,
  delivery_date TEXT,
  status TEXT DEFAULT 'Pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Index for faster customer queries
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
