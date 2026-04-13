-- Master Seed File for St. Peter's Specialized Hospital Demo Data
-- Run this file to populate the entire database with realistic seed data.
-- Execute after all migrations have been applied.
--
-- Usage: psql -h <host> -U <user> -d <database> -f seed.sql
-- Or run each file individually in order.

\i 01_reference_data.sql
\i 02_users_and_roles.sql
\i 03_equipment_assets.sql
\i 04_maintenance_data.sql
\i 05_pm_data.sql
\i 06_calibration_data.sql
\i 07_spare_parts_data.sql
\i 08_training_data.sql
\i 09_disposal_data.sql
\i 10_analytics_data.sql
\i 11_post_upgrade_baseline.sql
