-- Migration for Paste Varieties and Stock
CREATE TABLE IF NOT EXISTS paste_varieties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  current_stock REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_paste_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  paste_variety_id INTEGER NOT NULL,
  current_stock REAL NOT NULL,
  used_stock_today REAL NOT NULL,
  balance_stock REAL NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paste_variety_id) REFERENCES paste_varieties(id) ON DELETE CASCADE,
  UNIQUE(date, paste_variety_id)
);

-- Insert default paste varieties if not exist
INSERT OR IGNORE INTO paste_varieties (name, current_stock) VALUES ('Tapioca Paste', 500);
INSERT OR IGNORE INTO paste_varieties (name, current_stock) VALUES ('Chemical Paste', 500);
