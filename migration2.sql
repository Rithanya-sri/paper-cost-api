-- Migration: Add others_amount to existing records
ALTER TABLE daily_production_records ADD COLUMN others_amount REAL NOT NULL DEFAULT 0;
