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
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
