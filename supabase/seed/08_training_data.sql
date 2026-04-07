-- Seed 08: Training Data
-- ~30 training sessions with attendance records.

INSERT INTO training_sessions (id, title, asset_id, category_id, trainer, training_date, duration_hours, location, description) VALUES
('c4000001-0000-0000-0000-000000000001', 'ICU Ventilator Operation Refresher', 'a0000001-0000-0000-0000-000000000005', 'c0000001-0000-0000-0000-000000000008', 'Hanna Gebremedhin', '2024-02-15', 3.0, 'ICU Conference Room', 'Refresher training on Draeger Evita V500 operation, alarm management, and daily checks'),
('c4000001-0000-0000-0000-000000000002', 'Patient Monitor Alarm Management', NULL, 'c0000001-0000-0000-0000-000000000001', 'Solomon Bekele', '2024-03-10', 2.0, 'ICU Bay Area', 'Proper alarm settings and response protocols for bedside monitors'),
('c4000001-0000-0000-0000-000000000003', 'Defibrillator Use and Safety', 'a0000001-0000-0000-0000-000000000028', 'c0000001-0000-0000-0000-000000000001', 'Hanna Gebremedhin', '2024-03-20', 2.5, 'Emergency Department', 'Hands-on defibrillator training including pacing and cardioversion'),
('c4000001-0000-0000-0000-000000000004', 'Infusion Pump Programming', NULL, 'c0000001-0000-0000-0000-000000000007', 'Meron Alemu', '2024-04-05', 2.0, 'Nursing Station - Ward', 'B. Braun Infusomat programming, dose calculations, and troubleshooting'),
('c4000001-0000-0000-0000-000000000005', 'Anesthesia Machine Daily Check Procedure', 'a0000001-0000-0000-0000-000000000016', 'c0000001-0000-0000-0000-000000000002', 'Hanna Gebremedhin', '2024-04-18', 3.0, 'Operating Theater 1', 'Mandatory daily checkout procedure for all anesthesia machine operators'),
('c4000001-0000-0000-0000-000000000006', 'Autoclave Operation and Sterilization Validation', 'a0000001-0000-0000-0000-000000000027', 'c0000001-0000-0000-0000-000000000006', 'Solomon Bekele', '2024-05-08', 2.0, 'CSSD', 'Proper loading, cycle selection, and biological indicator use'),
('c4000001-0000-0000-0000-000000000007', 'Hematology Analyzer Operation', 'a0000001-0000-0000-0000-000000000046', 'c0000001-0000-0000-0000-000000000005', 'Sysmex Application Specialist', '2024-05-20', 4.0, 'Hematology Lab', 'Sysmex XN-1000 operation, daily QC, and basic troubleshooting'),
('c4000001-0000-0000-0000-000000000008', 'X-ray Radiation Safety', NULL, 'c0000001-0000-0000-0000-000000000004', 'Dr. Fitsum Haile', '2024-06-10', 2.0, 'Radiology Department', 'Radiation protection principles and dose minimization for operators'),
('c4000001-0000-0000-0000-000000000009', 'Electrosurgical Unit Safety', 'a0000001-0000-0000-0000-000000000019', 'c0000001-0000-0000-0000-000000000009', 'Hanna Gebremedhin', '2024-06-25', 2.0, 'Operating Theater', 'Safe use of ESU including return electrode placement and fire prevention'),
('c4000001-0000-0000-0000-000000000010', 'Equipment Failure Reporting Protocol', NULL, NULL, 'Dr. Ermias Tadesse', '2024-07-15', 1.5, 'Hospital Auditorium', 'How to correctly report equipment failures and submit maintenance requests'),
('c4000001-0000-0000-0000-000000000011', 'Biosafety Cabinet Proper Use', 'a0000001-0000-0000-0000-000000000056', 'c0000001-0000-0000-0000-000000000005', 'Meron Alemu', '2024-08-05', 2.0, 'Microbiology Lab', 'Proper technique for working in BSC and annual certification requirements'),
('c4000001-0000-0000-0000-000000000012', 'Cold Chain Management', 'a0000001-0000-0000-0000-000000000060', 'c0000001-0000-0000-0000-000000000012', 'Solomon Bekele', '2024-08-20', 2.0, 'Pharmacy', 'Temperature monitoring, alarm response, and cold chain break protocol'),
('c4000001-0000-0000-0000-000000000013', 'CT Scanner Operation', 'a0000001-0000-0000-0000-000000000042', 'c0000001-0000-0000-0000-000000000004', 'Siemens Application Specialist', '2024-09-10', 6.0, 'CT Suite', 'Advanced CT protocols, dose optimization, and troubleshooting'),
('c4000001-0000-0000-0000-000000000014', 'Preventive Maintenance Awareness', NULL, NULL, 'Dr. Ermias Tadesse', '2024-09-25', 1.0, 'Hospital Auditorium', 'Importance of PM scheduling and department cooperation'),
('c4000001-0000-0000-0000-000000000015', 'Ultrasound Probe Care', 'a0000001-0000-0000-0000-000000000040', 'c0000001-0000-0000-0000-000000000004', 'Meron Alemu', '2024-10-10', 1.5, 'Radiology Department', 'Proper handling, cleaning, and storage of ultrasound probes'),
('c4000001-0000-0000-0000-000000000016', 'Nebulizer Operation', NULL, 'c0000001-0000-0000-0000-000000000008', 'Solomon Bekele', '2024-10-25', 1.0, 'Outpatient Clinic', 'Correct nebulizer operation and cleaning for nursing staff'),
('c4000001-0000-0000-0000-000000000017', 'Syringe Pump Safety', NULL, 'c0000001-0000-0000-0000-000000000007', 'Hanna Gebremedhin', '2024-11-08', 2.0, 'ICU', 'High-risk medication delivery and syringe pump alarm management'),
('c4000001-0000-0000-0000-000000000018', 'Medical Equipment Disposal Procedures', NULL, NULL, 'Dr. Ermias Tadesse', '2024-11-20', 1.0, 'Biomedical Workshop', 'Proper disposal workflow, documentation, and regulatory compliance'),
('c4000001-0000-0000-0000-000000000019', 'Chemistry Analyzer QC', 'a0000001-0000-0000-0000-000000000048', 'c0000001-0000-0000-0000-000000000005', 'Beckman Coulter Specialist', '2024-12-05', 4.0, 'Chemistry Lab', 'Beckman AU680 QC procedures and Westgard rules application'),
('c4000001-0000-0000-0000-000000000020', 'Annual Equipment Safety Review', NULL, NULL, 'Dr. Ermias Tadesse', '2025-01-15', 2.0, 'Hospital Auditorium', 'Annual review of equipment safety incidents and lessons learned'),
('c4000001-0000-0000-0000-000000000021', 'New Ventilator Orientation', 'a0000001-0000-0000-0000-000000000007', 'c0000001-0000-0000-0000-000000000008', 'Mindray Application Specialist', '2025-02-10', 3.0, 'ICU', 'Mindray SV800 ventilator features and clinical applications'),
('c4000001-0000-0000-0000-000000000022', 'C-arm Operation and Radiation Safety', 'a0000001-0000-0000-0000-000000000043', 'c0000001-0000-0000-0000-000000000004', 'Hanna Gebremedhin', '2025-02-25', 2.5, 'Operating Theater', 'C-arm positioning, image optimization, and radiation safety'),
('c4000001-0000-0000-0000-000000000023', 'Oxygen Concentrator Maintenance', 'a0000001-0000-0000-0000-000000000072', 'c0000001-0000-0000-0000-000000000008', 'Solomon Bekele', '2025-03-10', 1.5, 'Inpatient Ward', 'Filter cleaning, flow verification, and basic troubleshooting');

-- Staff Training Records (attendance)
INSERT INTO staff_training_records (session_id, staff_user_id, staff_name, status, certification_date) VALUES
('c4000001-0000-0000-0000-000000000001', 'a3000001-0000-0000-0000-000000000005', 'Sr. Tigist Worku', 'attended', '2024-02-15'),
('c4000001-0000-0000-0000-000000000002', 'a3000001-0000-0000-0000-000000000005', 'Sr. Tigist Worku', 'attended', '2024-03-10'),
('c4000001-0000-0000-0000-000000000003', 'a3000001-0000-0000-0000-000000000007', 'Sr. Bethlehem Desta', 'attended', '2024-03-20'),
('c4000001-0000-0000-0000-000000000004', 'a3000001-0000-0000-0000-000000000011', 'Sr. Rahel Mengistu', 'attended', '2024-04-05'),
('c4000001-0000-0000-0000-000000000005', 'a3000001-0000-0000-0000-000000000006', 'Dr. Yonas Abera', 'attended', '2024-04-18'),
('c4000001-0000-0000-0000-000000000006', 'a3000001-0000-0000-0000-000000000006', 'Dr. Yonas Abera', 'absent', NULL),
('c4000001-0000-0000-0000-000000000007', 'a3000001-0000-0000-0000-000000000009', 'Ato Dawit Mekonnen', 'attended', '2024-05-20'),
('c4000001-0000-0000-0000-000000000008', 'a3000001-0000-0000-0000-000000000008', 'Dr. Fitsum Haile', 'attended', '2024-06-10'),
('c4000001-0000-0000-0000-000000000010', 'a3000001-0000-0000-0000-000000000005', 'Sr. Tigist Worku', 'attended', '2024-07-15'),
('c4000001-0000-0000-0000-000000000010', 'a3000001-0000-0000-0000-000000000006', 'Dr. Yonas Abera', 'attended', '2024-07-15'),
('c4000001-0000-0000-0000-000000000010', 'a3000001-0000-0000-0000-000000000007', 'Sr. Bethlehem Desta', 'attended', '2024-07-15'),
('c4000001-0000-0000-0000-000000000010', 'a3000001-0000-0000-0000-000000000009', 'Ato Dawit Mekonnen', 'attended', '2024-07-15'),
('c4000001-0000-0000-0000-000000000010', 'a3000001-0000-0000-0000-000000000011', 'Sr. Rahel Mengistu', 'attended', '2024-07-15'),
('c4000001-0000-0000-0000-000000000010', 'a3000001-0000-0000-0000-000000000012', 'Dr. Abel Habtamu', 'absent', NULL),
('c4000001-0000-0000-0000-000000000012', 'a3000001-0000-0000-0000-000000000010', 'W/ro Selamawit Girma', 'attended', '2024-08-20'),
('c4000001-0000-0000-0000-000000000013', 'a3000001-0000-0000-0000-000000000008', 'Dr. Fitsum Haile', 'attended', '2024-09-10'),
('c4000001-0000-0000-0000-000000000020', 'a3000001-0000-0000-0000-000000000005', 'Sr. Tigist Worku', 'attended', '2025-01-15'),
('c4000001-0000-0000-0000-000000000020', 'a3000001-0000-0000-0000-000000000006', 'Dr. Yonas Abera', 'attended', '2025-01-15'),
('c4000001-0000-0000-0000-000000000020', 'a3000001-0000-0000-0000-000000000007', 'Sr. Bethlehem Desta', 'attended', '2025-01-15'),
('c4000001-0000-0000-0000-000000000020', 'a3000001-0000-0000-0000-000000000009', 'Ato Dawit Mekonnen', 'attended', '2025-01-15'),
('c4000001-0000-0000-0000-000000000021', 'a3000001-0000-0000-0000-000000000005', 'Sr. Tigist Worku', 'attended', '2025-02-10'),
('c4000001-0000-0000-0000-000000000023', 'a3000001-0000-0000-0000-000000000011', 'Sr. Rahel Mengistu', 'attended', '2025-03-10');

-- Equipment Training Records
INSERT INTO equipment_training_records (asset_id, session_id, topics_covered, notes) VALUES
('a0000001-0000-0000-0000-000000000005', 'c4000001-0000-0000-0000-000000000001', 'Ventilator modes, alarm settings, daily checks, circuit changes', NULL),
('a0000001-0000-0000-0000-000000000028', 'c4000001-0000-0000-0000-000000000003', 'Defibrillation, cardioversion, pacing, safety', NULL),
('a0000001-0000-0000-0000-000000000016', 'c4000001-0000-0000-0000-000000000005', 'Pre-use check, leak test, vaporizer verification', NULL),
('a0000001-0000-0000-0000-000000000027', 'c4000001-0000-0000-0000-000000000006', 'Loading patterns, cycle selection, Bowie-Dick test', NULL),
('a0000001-0000-0000-0000-000000000046', 'c4000001-0000-0000-0000-000000000007', 'Sample handling, QC procedures, result validation', NULL),
('a0000001-0000-0000-0000-000000000019', 'c4000001-0000-0000-0000-000000000009', 'Cut/coag modes, return electrode, fire safety', NULL),
('a0000001-0000-0000-0000-000000000042', 'c4000001-0000-0000-0000-000000000013', 'Protocol selection, dose optimization, artifacts', NULL),
('a0000001-0000-0000-0000-000000000040', 'c4000001-0000-0000-0000-000000000015', 'Probe care, gel usage, cleaning protocols', NULL),
('a0000001-0000-0000-0000-000000000048', 'c4000001-0000-0000-0000-000000000019', 'QC runs, Westgard rules, corrective actions', NULL),
('a0000001-0000-0000-0000-000000000007', 'c4000001-0000-0000-0000-000000000021', 'SV800 modes, lung protection, NIV setup', NULL),
('a0000001-0000-0000-0000-000000000043', 'c4000001-0000-0000-0000-000000000022', 'Positioning, fluoroscopy modes, dose reduction', NULL),
('a0000001-0000-0000-0000-000000000072', 'c4000001-0000-0000-0000-000000000023', 'Filter maintenance, flow checks, troubleshooting', NULL);

-- Training Requests
INSERT INTO training_requests (id, request_number, asset_id, requested_by, department_id, training_type, description, status) VALUES
('c3000001-0000-0000-0000-000000000001', 'TR-2025-001', 'a0000001-0000-0000-0000-000000000018', 'a3000001-0000-0000-0000-000000000006', 'd0000001-0000-0000-0000-000000000002', 'equipment_operation', 'Request training on new Mindray anesthesia machine for OR staff', 'approved'),
('c3000001-0000-0000-0000-000000000002', 'TR-2025-002', NULL, 'a3000001-0000-0000-0000-000000000011', 'd0000001-0000-0000-0000-000000000007', 'refresher', 'Refresher training on infusion pump programming for new ward nurses', 'pending'),
('c3000001-0000-0000-0000-000000000003', 'TR-2025-003', 'a0000001-0000-0000-0000-000000000047', 'a3000001-0000-0000-0000-000000000009', 'd0000001-0000-0000-0000-000000000005', 'maintenance', 'Basic maintenance training for lab staff on hematology analyzer', 'pending');
