-- Migration for Wood Varieties and Stock
CREATE TABLE IF NOT EXISTS wood_varieties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  current_stock REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_wood_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  wood_variety_id INTEGER NOT NULL,
  current_stock REAL NOT NULL,
  used_stock_today REAL NOT NULL,
  balance_stock REAL NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wood_variety_id) REFERENCES wood_varieties(id) ON DELETE CASCADE,
  UNIQUE(date, wood_variety_id)
);

-- Insert default wood varieties if not exist
INSERT OR IGNORE INTO wood_varieties (name, current_stock) VALUES ('Firewood', 500);

-- Add wood cost columns to daily_production_records if they do not exist
ALTER TABLE daily_production_records ADD COLUMN wood_cost REAL;
ALTER TABLE daily_production_records ADD COLUMN wood_cost_per_tube REAL;
