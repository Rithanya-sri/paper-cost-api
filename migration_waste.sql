-- Migration: Add Waste support
-- Run this against your Cloudflare D1 database BEFORE deploying the updated API.
-- All columns use DEFAULT 0 so existing records are unaffected.

-- 1. daily_production_records: add waste columns
ALTER TABLE daily_production_records ADD COLUMN waste_quantity_kg REAL NOT NULL DEFAULT 0;
ALTER TABLE daily_production_records ADD COLUMN waste_rate        REAL NOT NULL DEFAULT 0;
ALTER TABLE daily_production_records ADD COLUMN waste_cost        REAL NOT NULL DEFAULT 0;
ALTER TABLE daily_production_records ADD COLUMN waste_cost_per_tube REAL NOT NULL DEFAULT 0;

-- 2. rate_master: add waste_rate column
ALTER TABLE rate_master ADD COLUMN waste_rate REAL NOT NULL DEFAULT 0;
