-- Migration: Add new columns for rate persistence
ALTER TABLE daily_production_records ADD COLUMN electricity_rate REAL NOT NULL DEFAULT 0;
ALTER TABLE daily_production_records ADD COLUMN rate_snapshot_used_that_day INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rate_master ADD COLUMN electricity_rate REAL NOT NULL DEFAULT 0;
