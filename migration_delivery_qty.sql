-- Migration to add delivery tracking columns

ALTER TABLE orders ADD COLUMN delivered_quantity INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN actual_delivery_date TEXT;
