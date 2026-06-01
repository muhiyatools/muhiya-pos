-- ================================================================
-- Migration 005: Drop Unused Tables
-- Removes product_bundles, product_addons, product_images, audit_log
-- All had 0 rows and no active application code references
-- ================================================================

DROP TABLE IF EXISTS product_bundles CASCADE;
DROP TABLE IF EXISTS product_addons CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
