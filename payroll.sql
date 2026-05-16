ALTER TABLE labor_weekly_adjustments ADD COLUMN previous_balance REAL DEFAULT 0;
ALTER TABLE labor_weekly_adjustments ADD COLUMN total_payable REAL DEFAULT 0;
ALTER TABLE labor_weekly_adjustments ADD COLUMN paid_amount REAL DEFAULT 0;
ALTER TABLE labor_weekly_adjustments ADD COLUMN balance_amount REAL DEFAULT 0;
ALTER TABLE labor_weekly_adjustments ADD COLUMN paid_status TEXT DEFAULT 'Unpaid';
