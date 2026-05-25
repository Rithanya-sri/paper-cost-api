-- Migration: Add shift_production to daily_production_records
-- Run this against your Cloudflare D1 database (executed on 2026-05-25)
ALTER TABLE daily_production_records ADD COLUMN shift_production TEXT;
