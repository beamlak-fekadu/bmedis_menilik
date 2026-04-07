-- Seed 09: Disposal Data
-- A few disposed assets and pending disposal requests.

-- Completed disposals
INSERT INTO disposal_requests (id, request_number, asset_id, requested_by, reason, disposal_method_proposed, status, approved_by, approved_at, notes) VALUES
('d1000001-0000-0000-0000-000000000001', 'DR-2024-001', 'a0000001-0000-0000-0000-000000000070', 'a3000001-0000-0000-0000-000000000002', 'Compressor motor failed beyond repair; replacement parts not available for this model. Cost of repair exceeds replacement value.', 'recycling', 'completed', 'a3000001-0000-0000-0000-000000000001', '2024-06-01 10:00:00+03', 'Nebulizer decommissioned after failed repair attempt'),
('d1000001-0000-0000-0000-000000000002', 'DR-2024-002', 'a0000001-0000-0000-0000-000000000026', 'a3000001-0000-0000-0000-000000000002', 'Motor burned out; repeated failures; unit is 6 years old with no warranty. Replacement motor temporarily installed but showing signs of failure again.', 'recycling', 'completed', 'a3000001-0000-0000-0000-000000000001', '2024-12-15 09:00:00+03', NULL);

INSERT INTO disposed_assets (asset_id, disposal_request_id, disposal_date, disposal_method, disposed_by, notes) VALUES
('a0000001-0000-0000-0000-000000000070', 'd1000001-0000-0000-0000-000000000001', '2024-06-15', 'recycling', 'a3000001-0000-0000-0000-000000000002', 'Components salvaged for other nebulizers before disposal');

-- Pending disposal requests
INSERT INTO disposal_requests (id, request_number, asset_id, requested_by, reason, disposal_method_proposed, status, notes) VALUES
('d1000001-0000-0000-0000-000000000003', 'DR-2025-001', 'a0000001-0000-0000-0000-000000000010', 'a3000001-0000-0000-0000-000000000002', 'Infusion Pump #3 pump mechanism failed multiple times. Spare roller assembly not available. Unit has been non-functional for over 6 months.', 'recycling', 'pending', 'Has been awaiting spare part since Aug 2024; recommend disposal'),
('d1000001-0000-0000-0000-000000000004', 'DR-2025-002', 'a0000001-0000-0000-0000-000000000039', 'a3000001-0000-0000-0000-000000000002', 'Fixed X-ray unit is 11 years old. Tube replaced in 2024. Recurring collimator issues. High maintenance cost relative to acquiring newer system.', 'auction', 'pending', 'Replacement prioritization model recommends replacement');
