-- Migration for Paper Varieties and Reels
CREATE TABLE IF NOT EXISTS paper_varieties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  current_stock REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_paper_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  paper_variety_id INTEGER NOT NULL,
  current_stock REAL NOT NULL,
  used_stock_today REAL NOT NULL,
  balance_stock REAL NOT NULL,
  reels_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paper_variety_id) REFERENCES paper_varieties(id) ON DELETE CASCADE,
  UNIQUE(date, paper_variety_id)
);

CREATE TABLE IF NOT EXISTS reel_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  paper_variety_id INTEGER NOT NULL,
  reel_index INTEGER NOT NULL,
  weight REAL NOT NULL,
  production REAL NOT NULL,
  avg_pattern_weight REAL NOT NULL,
  cone_weight REAL NOT NULL,
  crushing_strength REAL NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paper_variety_id) REFERENCES paper_varieties(id) ON DELETE CASCADE,
  UNIQUE(date, paper_variety_id, reel_index)
);

-- Insert default paper varieties if not exist
INSERT OR IGNORE INTO paper_varieties (name, current_stock) VALUES ('Venkateshwara 18BF 40 grams', 500);
INSERT OR IGNORE INTO paper_varieties (name, current_stock) VALUES ('Venkateshwara 21BF 40 grams', 500);
INSERT OR IGNORE INTO paper_varieties (name, current_stock) VALUES ('ABC Mill 24BF 35 grams', 500);
