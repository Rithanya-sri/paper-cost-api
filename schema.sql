-- Cloudflare D1 Database Schema
-- Paper Tube Manufacturing - Daily Cost & Production Management System

CREATE TABLE IF NOT EXISTS daily_production_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  
  -- Production metrics
  production REAL NOT NULL,  -- Total tubes manufactured (including rejects)
  outdone REAL NOT NULL,     -- Good/accepted tubes only
  
  -- 1. Paper Cost
  paper_quantity_kg REAL NOT NULL,
  paper_rate REAL NOT NULL,
  paper_cost REAL NOT NULL,            -- quantity × rate
  paper_cost_per_tube REAL NOT NULL,   -- cost ÷ outdone
  
  -- 2. Paste Cost
  paste_quantity REAL NOT NULL,
  paste_rate REAL NOT NULL,
  paste_cost REAL NOT NULL,            -- quantity × rate
  paste_cost_per_tube REAL NOT NULL,   -- cost ÷ outdone
  
  -- 3. Outer Paste Cost
  outer_paste_quantity REAL NOT NULL,
  outer_paste_rate REAL NOT NULL,
  outer_paste_cost REAL NOT NULL,            -- quantity × rate
  outer_paste_cost_per_tube REAL NOT NULL,   -- cost ÷ outdone
  
  -- 4. Packing Cost
  packing_quantity REAL NOT NULL,
  packing_rate REAL NOT NULL,
  packing_cost REAL NOT NULL,            -- quantity × rate
  packing_cost_per_tube REAL NOT NULL,   -- cost ÷ production
  
  -- 5. Labour Cost
  labour_count REAL NOT NULL,
  labour_wage REAL NOT NULL,
  labour_cost REAL NOT NULL,            -- count × wage
  labour_cost_per_tube REAL NOT NULL,   -- cost ÷ production
  
  -- 6. EB (Electricity) Cost
  eb_units REAL NOT NULL,
  electricity_rate REAL NOT NULL DEFAULT 0,
  eb_amount REAL NOT NULL,
  eb_cost_per_tube REAL NOT NULL,       -- amount ÷ production
  
  -- 7. Overheads
  overheads_amount REAL NOT NULL,
  overheads_cost_per_tube REAL NOT NULL, -- amount ÷ production
  
  -- 8. Food Cost
  food_amount REAL NOT NULL,
  food_cost_per_tube REAL NOT NULL,     -- amount ÷ production
  
  -- 9. Others
  others_amount REAL NOT NULL DEFAULT 0,

  -- 10. Waste Cost
  waste_quantity_kg REAL NOT NULL DEFAULT 0,
  waste_rate REAL NOT NULL DEFAULT 0,
  waste_cost REAL NOT NULL DEFAULT 0,
  waste_cost_per_tube REAL NOT NULL DEFAULT 0,

  -- Grand Total
  grand_total_cost_per_tube REAL NOT NULL, -- Sum of all cost_per_tube values
  
  -- Flag to lock old records from auto-updating
  rate_snapshot_used_that_day INTEGER NOT NULL DEFAULT 0,
  
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster date-based queries
CREATE INDEX IF NOT EXISTS idx_date ON daily_production_records(date DESC);

-- Table to store current market rates (for auto-filling new records)
CREATE TABLE IF NOT EXISTS rate_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_rate REAL NOT NULL,
  paste_rate REAL NOT NULL,
  outer_paste_rate REAL NOT NULL,
  packing_rate REAL NOT NULL,
  labour_wage REAL NOT NULL,  -- maps to avg_wage_per_day in requirements
  electricity_rate REAL NOT NULL DEFAULT 0,
  eb_amount REAL NOT NULL DEFAULT 0,
  waste_rate REAL NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 1. Labor Master Table
CREATE TABLE IF NOT EXISTS labors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. Salary History Table (Tracks salary changes over time)
CREATE TABLE IF NOT EXISTS labor_salary_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  labor_id INTEGER NOT NULL,
  salary REAL NOT NULL,
  effective_date TEXT NOT NULL,  -- YYYY-MM-DD
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (labor_id) REFERENCES labors(id) ON DELETE CASCADE
);

-- 3. Labor Attendance Table
CREATE TABLE IF NOT EXISTS labor_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  labor_id INTEGER NOT NULL,
  shifts REAL NOT NULL,
  salary_rate_at_time REAL NOT NULL, -- Snapshot of salary at that time
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (labor_id) REFERENCES labors(id) ON DELETE CASCADE,
  UNIQUE(date, labor_id)
);

-- Index for faster attendance lookups
CREATE INDEX IF NOT EXISTS idx_attendance_date ON labor_attendance(date);

-- 4. Labor Weekly Payroll
CREATE TABLE IF NOT EXISTS labor_weekly_payroll (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  labor_id INTEGER NOT NULL,
  week_start_date TEXT NOT NULL,
  additional_amount REAL DEFAULT 0,
  previous_balance REAL DEFAULT 0,
  total_payable REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  balance_amount REAL DEFAULT 0,
  paid_status TEXT DEFAULT 'Unpaid',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(labor_id, week_start_date)
);

-- 5. Paper Varieties
CREATE TABLE IF NOT EXISTS paper_varieties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  current_stock REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 6. Daily Paper Stock Usage
CREATE TABLE IF NOT EXISTS daily_paper_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  paper_variety_id INTEGER NOT NULL,
  current_stock REAL NOT NULL,
  used_stock_today REAL NOT NULL,
  balance_stock REAL NOT NULL,
  reels_count INTEGER NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paper_variety_id) REFERENCES paper_varieties(id) ON DELETE CASCADE,
  UNIQUE(date, paper_variety_id)
);

-- 7. Reel-by-Reel Usage details
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

