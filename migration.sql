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
