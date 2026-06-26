-- Raw Material Stock Management Migration

-- 1. Raw Materials Table
CREATE TABLE IF NOT EXISTS raw_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_name TEXT NOT NULL,
  variety TEXT DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'Kg',
  minimum_stock REAL NOT NULL DEFAULT 0,
  current_stock REAL NOT NULL DEFAULT 0,
  last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. Stock Updates History Table
CREATE TABLE IF NOT EXISTS stock_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  raw_material_id INTEGER NOT NULL,
  quantity_added REAL DEFAULT 0,
  quantity_used REAL DEFAULT 0,
  updated_by TEXT DEFAULT '',
  update_type TEXT DEFAULT 'Daily',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE
);

-- 3. Add stock_check_status to orders table
ALTER TABLE orders ADD COLUMN stock_check_status TEXT DEFAULT '';
