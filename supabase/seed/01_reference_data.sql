-- Seed 01: Reference / Master Data
-- Realistic reference data for Yekatit-12 Hospital Medical College, Addis Ababa

-- =============================================================================
-- DEPARTMENTS (8 departments)
-- =============================================================================
INSERT INTO departments (id, name, code, description) VALUES
    ('d0000001-0000-0000-0000-000000000001', 'Intensive Care Unit', 'ICU', 'Critical care unit for severely ill patients requiring close monitoring'),
    ('d0000001-0000-0000-0000-000000000002', 'Operating Theater', 'OT', 'Surgical suites for major and minor operations'),
    ('d0000001-0000-0000-0000-000000000003', 'Emergency Department', 'ED', 'Emergency and trauma care services'),
    ('d0000001-0000-0000-0000-000000000004', 'Radiology and Imaging', 'RAD', 'Diagnostic imaging services including X-ray, ultrasound, and CT'),
    ('d0000001-0000-0000-0000-000000000005', 'Laboratory', 'LAB', 'Clinical laboratory for hematology, chemistry, and microbiology'),
    ('d0000001-0000-0000-0000-000000000006', 'Pharmacy', 'PHARM', 'Pharmaceutical storage and dispensing'),
    ('d0000001-0000-0000-0000-000000000007', 'Inpatient Ward', 'IPW', 'General inpatient wards for admitted patients'),
    ('d0000001-0000-0000-0000-000000000008', 'Outpatient Clinic', 'OPD', 'Outpatient consultation and minor procedures');

-- =============================================================================
-- EQUIPMENT CATEGORIES (12 categories)
-- =============================================================================
INSERT INTO equipment_categories (id, name, code, description, criticality_level) VALUES
    ('c0000001-0000-0000-0000-000000000001', 'Patient Monitoring', 'MON', 'Devices for continuous patient vital signs monitoring', 'critical'),
    ('c0000001-0000-0000-0000-000000000002', 'Anesthesia Equipment', 'ANES', 'Anesthesia delivery and monitoring systems', 'critical'),
    ('c0000001-0000-0000-0000-000000000003', 'Surgical Equipment', 'SURG', 'Instruments and devices used in surgical procedures', 'high'),
    ('c0000001-0000-0000-0000-000000000004', 'Diagnostic Imaging', 'IMG', 'Imaging systems for diagnosis including X-ray, CT, ultrasound', 'high'),
    ('c0000001-0000-0000-0000-000000000005', 'Laboratory Equipment', 'LBEQ', 'Analyzers, centrifuges, and other lab instruments', 'high'),
    ('c0000001-0000-0000-0000-000000000006', 'Sterilization Equipment', 'STER', 'Autoclaves and sterilization systems', 'high'),
    ('c0000001-0000-0000-0000-000000000007', 'Infusion and Fluid Management', 'INF', 'Infusion pumps and syringe pumps', 'critical'),
    ('c0000001-0000-0000-0000-000000000008', 'Respiratory and Ventilation', 'RESP', 'Ventilators, CPAP, oxygen concentrators', 'critical'),
    ('c0000001-0000-0000-0000-000000000009', 'Electrosurgical Equipment', 'ELEC', 'Electrosurgical units and accessories', 'high'),
    ('c0000001-0000-0000-0000-000000000010', 'Dental Equipment', 'DENT', 'Dental chairs, units, and instruments', 'medium'),
    ('c0000001-0000-0000-0000-000000000011', 'Physiotherapy Equipment', 'PHYS', 'Rehabilitation and physiotherapy devices', 'low'),
    ('c0000001-0000-0000-0000-000000000012', 'General Support Equipment', 'GEN', 'Beds, suction units, examination lights, scales', 'medium');

-- =============================================================================
-- MANUFACTURERS (15 manufacturers)
-- =============================================================================
INSERT INTO manufacturers (id, name, country, contact_info) VALUES
    ('a0000001-0000-0000-0000-000000000001', 'GE Healthcare', 'United States', '{"phone": "+1-262-544-3011", "website": "gehealthcare.com"}'),
    ('a0000001-0000-0000-0000-000000000002', 'Philips Healthcare', 'Netherlands', '{"phone": "+31-40-278-8888", "website": "philips.com/healthcare"}'),
    ('a0000001-0000-0000-0000-000000000003', 'Siemens Healthineers', 'Germany', '{"phone": "+49-9131-84-0", "website": "siemens-healthineers.com"}'),
    ('a0000001-0000-0000-0000-000000000004', 'Mindray', 'China', '{"phone": "+86-755-8188-8998", "website": "mindray.com"}'),
    ('a0000001-0000-0000-0000-000000000005', 'Draeger', 'Germany', '{"phone": "+49-451-882-0", "website": "draeger.com"}'),
    ('a0000001-0000-0000-0000-000000000006', 'Medtronic', 'Ireland', '{"phone": "+1-763-514-4000", "website": "medtronic.com"}'),
    ('a0000001-0000-0000-0000-000000000007', 'Nihon Kohden', 'Japan', '{"phone": "+81-3-5996-8000", "website": "nihonkohden.com"}'),
    ('a0000001-0000-0000-0000-000000000008', 'Sysmex', 'Japan', '{"phone": "+81-78-265-0500", "website": "sysmex.com"}'),
    ('a0000001-0000-0000-0000-000000000009', 'Beckman Coulter', 'United States', '{"phone": "+1-714-871-4848", "website": "beckmancoulter.com"}'),
    ('a0000001-0000-0000-0000-000000000010', 'B. Braun', 'Germany', '{"phone": "+49-5661-71-0", "website": "bbraun.com"}'),
    ('a0000001-0000-0000-0000-000000000011', 'Getinge', 'Sweden', '{"phone": "+46-10-335-0000", "website": "getinge.com"}'),
    ('a0000001-0000-0000-0000-000000000012', 'Olympus', 'Japan', '{"phone": "+81-3-6901-9000", "website": "olympus.com"}'),
    ('a0000001-0000-0000-0000-000000000013', 'Edan Instruments', 'China', '{"phone": "+86-755-2689-8326", "website": "edan.com"}'),
    ('a0000001-0000-0000-0000-000000000014', 'Comen Medical', 'China', '{"phone": "+86-755-2640-5880", "website": "comen.com"}'),
    ('a0000001-0000-0000-0000-000000000015', 'Tuttnauer', 'Israel', '{"phone": "+972-3-555-8877", "website": "tuttnauer.com"}');

-- =============================================================================
-- EQUIPMENT MODELS (~40 models)
-- =============================================================================
INSERT INTO equipment_models (id, name, manufacturer_id, category_id, description) VALUES
    -- Patient Monitors
    ('e1000001-0000-0000-0000-000000000001', 'CARESCAPE B650', 'a0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'Advanced multi-parameter bedside monitor'),
    ('e1000001-0000-0000-0000-000000000002', 'IntelliVue MX800', 'a0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', 'High-acuity patient monitoring system'),
    ('e1000001-0000-0000-0000-000000000003', 'BeneVision N22', 'a0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000001', 'Modular patient monitor'),
    ('e1000001-0000-0000-0000-000000000004', 'BeneVision N15', 'a0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000001', 'Mid-acuity patient monitor'),
    ('e1000001-0000-0000-0000-000000000005', 'iM80', 'a0000001-0000-0000-0000-000000000013', 'c0000001-0000-0000-0000-000000000001', 'Multi-parameter patient monitor'),
    -- Anesthesia
    ('e1000001-0000-0000-0000-000000000006', 'Aisys CS2', 'a0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000002', 'Anesthesia delivery system'),
    ('e1000001-0000-0000-0000-000000000007', 'Fabius GS Premium', 'a0000001-0000-0000-0000-000000000005', 'c0000001-0000-0000-0000-000000000002', 'Anesthesia workstation'),
    ('e1000001-0000-0000-0000-000000000008', 'WATO EX-65', 'a0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000002', 'Anesthesia machine'),
    -- Surgical
    ('e1000001-0000-0000-0000-000000000009', 'Force FX', 'a0000001-0000-0000-0000-000000000006', 'c0000001-0000-0000-0000-000000000009', 'Electrosurgical generator'),
    ('e1000001-0000-0000-0000-000000000010', 'Volista Surgical Light', 'a0000001-0000-0000-0000-000000000011', 'c0000001-0000-0000-0000-000000000003', 'Operating room surgical light'),
    -- Imaging
    ('e1000001-0000-0000-0000-000000000011', 'Optima XR240amx', 'a0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000004', 'Mobile digital X-ray system'),
    ('e1000001-0000-0000-0000-000000000012', 'LOGIQ E10', 'a0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000004', 'Premium ultrasound system'),
    ('e1000001-0000-0000-0000-000000000013', 'SOMATOM go.Up', 'a0000001-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000004', 'CT scanner'),
    ('e1000001-0000-0000-0000-000000000014', 'OEC 3D C-arm', 'a0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000004', 'Surgical C-arm imaging'),
    ('e1000001-0000-0000-0000-000000000015', 'DC-70 X-Insight', 'a0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000004', 'Diagnostic ultrasound'),
    -- Laboratory
    ('e1000001-0000-0000-0000-000000000016', 'XN-1000', 'a0000001-0000-0000-0000-000000000008', 'c0000001-0000-0000-0000-000000000005', 'Automated hematology analyzer'),
    ('e1000001-0000-0000-0000-000000000017', 'AU680', 'a0000001-0000-0000-0000-000000000009', 'c0000001-0000-0000-0000-000000000005', 'Chemistry analyzer'),
    ('e1000001-0000-0000-0000-000000000018', 'CX43', 'a0000001-0000-0000-0000-000000000012', 'c0000001-0000-0000-0000-000000000005', 'Biological microscope'),
    ('e1000001-0000-0000-0000-000000000019', 'Allegra X-15R', 'a0000001-0000-0000-0000-000000000009', 'c0000001-0000-0000-0000-000000000005', 'Benchtop centrifuge'),
    -- Ventilators
    ('e1000001-0000-0000-0000-000000000020', 'Evita V500', 'a0000001-0000-0000-0000-000000000005', 'c0000001-0000-0000-0000-000000000008', 'ICU ventilator'),
    ('e1000001-0000-0000-0000-000000000021', 'SV800', 'a0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000008', 'High-performance ventilator'),
    ('e1000001-0000-0000-0000-000000000022', 'CARESCAPE R860', 'a0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000008', 'Advanced ventilator'),
    -- Infusion Pumps
    ('e1000001-0000-0000-0000-000000000023', 'Infusomat Space', 'a0000001-0000-0000-0000-000000000010', 'c0000001-0000-0000-0000-000000000007', 'Volumetric infusion pump'),
    ('e1000001-0000-0000-0000-000000000024', 'Perfusor Space', 'a0000001-0000-0000-0000-000000000010', 'c0000001-0000-0000-0000-000000000007', 'Syringe pump'),
    ('e1000001-0000-0000-0000-000000000025', 'BeneFusion n Series', 'a0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000007', 'Infusion pump system'),
    -- Defibrillators
    ('e1000001-0000-0000-0000-000000000026', 'LIFEPAK 20e', 'a0000001-0000-0000-0000-000000000006', 'c0000001-0000-0000-0000-000000000001', 'Defibrillator/monitor'),
    ('e1000001-0000-0000-0000-000000000027', 'HeartStart MRx', 'a0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', 'Monitor/defibrillator'),
    -- Sterilization
    ('e1000001-0000-0000-0000-000000000028', '3870 EA', 'a0000001-0000-0000-0000-000000000015', 'c0000001-0000-0000-0000-000000000006', 'Large capacity autoclave'),
    ('e1000001-0000-0000-0000-000000000029', '2540 EKA', 'a0000001-0000-0000-0000-000000000015', 'c0000001-0000-0000-0000-000000000006', 'Tabletop autoclave'),
    -- Suction
    ('e1000001-0000-0000-0000-000000000030', 'Dominant Flex', 'a0000001-0000-0000-0000-000000000006', 'c0000001-0000-0000-0000-000000000012', 'Surgical suction unit'),
    -- ECG
    ('e1000001-0000-0000-0000-000000000031', 'MAC 2000', 'a0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'Resting ECG system'),
    ('e1000001-0000-0000-0000-000000000032', 'SE-1200 Express', 'a0000001-0000-0000-0000-000000000013', 'c0000001-0000-0000-0000-000000000001', '12-channel ECG'),
    -- Pulse Oximeter
    ('e1000001-0000-0000-0000-000000000033', 'Rad-97', 'a0000001-0000-0000-0000-000000000006', 'c0000001-0000-0000-0000-000000000001', 'Pulse co-oximeter'),
    -- Nebulizer
    ('e1000001-0000-0000-0000-000000000034', 'NEB-U-TYKE', 'a0000001-0000-0000-0000-000000000014', 'c0000001-0000-0000-0000-000000000008', 'Compressor nebulizer'),
    -- Blood Bank Fridge
    ('e1000001-0000-0000-0000-000000000035', 'HB456', 'a0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000005', 'Blood bank refrigerator'),
    -- Pharmacy Fridge
    ('e1000001-0000-0000-0000-000000000036', 'TSX Series', 'a0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000012', 'Pharmacy-grade refrigerator'),
    -- Laminar Flow
    ('e1000001-0000-0000-0000-000000000037', 'SterilGARD e3', 'a0000001-0000-0000-0000-000000000011', 'c0000001-0000-0000-0000-000000000005', 'Biological safety cabinet'),
    -- Oxygen Concentrator
    ('e1000001-0000-0000-0000-000000000038', 'EverFlo', 'a0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000008', 'Oxygen concentrator'),
    -- Examination Light
    ('e1000001-0000-0000-0000-000000000039', 'Green Series 900', 'a0000001-0000-0000-0000-000000000011', 'c0000001-0000-0000-0000-000000000012', 'Minor procedure exam light'),
    -- Patient Scale
    ('e1000001-0000-0000-0000-000000000040', 'seca 704', 'a0000001-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000012', 'Column scale with digital display');

-- =============================================================================
-- VENDORS (8 vendors)
-- =============================================================================
INSERT INTO vendors (id, name, contact_person, phone, email, address) VALUES
    ('b0000001-0000-0000-0000-000000000001', 'Ethiopian Medical Supplies PLC', 'Abebe Kebede', '+251-11-551-7890', 'info@ethmedical.com.et', 'Bole Sub-city, Addis Ababa'),
    ('b0000001-0000-0000-0000-000000000002', 'AMED Trading', 'Dawit Mengistu', '+251-11-663-4521', 'dawit@amedtrading.com', 'Kirkos Sub-city, Addis Ababa'),
    ('b0000001-0000-0000-0000-000000000003', 'MedTech Ethiopia', 'Sara Hailu', '+251-91-123-4567', 'sara@medtecheth.com', 'Yeka Sub-city, Addis Ababa'),
    ('b0000001-0000-0000-0000-000000000004', 'Fantu Medical Equipment', 'Fantu Tesfaye', '+251-11-442-7654', 'fantu@fantumed.com', 'Nifas Silk-Lafto, Addis Ababa'),
    ('b0000001-0000-0000-0000-000000000005', 'EPHARM', 'Tigist Alemayehu', '+251-11-553-2100', 'info@epharm.gov.et', 'Addis Ababa, Ethiopia'),
    ('b0000001-0000-0000-0000-000000000006', 'Zaf Pharmaceuticals PLC', 'Yonas Bekele', '+251-11-667-8901', 'yonas@zafpharma.com', 'Lideta Sub-city, Addis Ababa'),
    ('b0000001-0000-0000-0000-000000000007', 'Medsource International', 'Selam Getachew', '+251-91-876-5432', 'selam@medsource.com', 'CMC Area, Addis Ababa'),
    ('b0000001-0000-0000-0000-000000000008', 'Global Medical Supplies', 'Daniel Worku', '+251-11-554-3210', 'daniel@globalmed.com.et', 'Bole Sub-city, Addis Ababa');

-- =============================================================================
-- SUPPLIERS (8 suppliers)
-- =============================================================================
INSERT INTO suppliers (id, name, contact_person, phone, email, address) VALUES
    ('f0000001-0000-0000-0000-000000000001', 'PFSA (Pharmaceutical Fund and Supply Agency)', 'Mulugeta Tadesse', '+251-11-276-3214', 'info@pfsa.gov.et', 'Addis Ababa, Ethiopia'),
    ('f0000001-0000-0000-0000-000000000002', 'UNICEF Supply Division', 'International Office', '+45-4533-5500', 'supply@unicef.org', 'Copenhagen, Denmark'),
    ('f0000001-0000-0000-0000-000000000003', 'GE Healthcare Africa', 'Ahmed Hassan', '+254-20-271-4300', 'ahmed.hassan@ge.com', 'Nairobi, Kenya'),
    ('f0000001-0000-0000-0000-000000000004', 'Philips East Africa', 'Grace Mwangi', '+254-20-424-6900', 'grace.mwangi@philips.com', 'Nairobi, Kenya'),
    ('f0000001-0000-0000-0000-000000000005', 'Mindray Africa', 'Li Wei', '+27-11-300-8888', 'li.wei@mindray.com', 'Johannesburg, South Africa'),
    ('f0000001-0000-0000-0000-000000000006', 'Draeger East Africa', 'Hans Mueller', '+254-20-271-1234', 'hans.mueller@draeger.com', 'Nairobi, Kenya'),
    ('f0000001-0000-0000-0000-000000000007', 'Getinge Ethiopia Office', 'Maria Svensson', '+251-11-552-1100', 'maria.svensson@getinge.com', 'Addis Ababa, Ethiopia'),
    ('f0000001-0000-0000-0000-000000000008', 'B. Braun East Africa', 'Klaus Weber', '+254-20-822-3456', 'klaus.weber@bbraun.com', 'Nairobi, Kenya');

-- =============================================================================
-- FAILURE CODES (25 codes)
-- =============================================================================
INSERT INTO failure_codes (id, code, description, category) VALUES
    ('fc000001-0000-0000-0000-000000000001', 'FC-PWR', 'Power supply failure or no power', 'Electrical'),
    ('fc000001-0000-0000-0000-000000000002', 'FC-SNS', 'Sensor malfunction or drift', 'Sensor'),
    ('fc000001-0000-0000-0000-000000000003', 'FC-CAL', 'Calibration drift or out of range', 'Calibration'),
    ('fc000001-0000-0000-0000-000000000004', 'FC-MEC', 'Mechanical wear or breakage', 'Mechanical'),
    ('fc000001-0000-0000-0000-000000000005', 'FC-SFT', 'Software error or system freeze', 'Software'),
    ('fc000001-0000-0000-0000-000000000006', 'FC-DSP', 'Display malfunction or blank screen', 'Display'),
    ('fc000001-0000-0000-0000-000000000007', 'FC-BAT', 'Battery failure or not charging', 'Electrical'),
    ('fc000001-0000-0000-0000-000000000008', 'FC-ALM', 'False alarms or alarm system failure', 'Alarm'),
    ('fc000001-0000-0000-0000-000000000009', 'FC-PMP', 'Pump mechanism failure', 'Mechanical'),
    ('fc000001-0000-0000-0000-000000000010', 'FC-LKG', 'Fluid or gas leak', 'Mechanical'),
    ('fc000001-0000-0000-0000-000000000011', 'FC-TMP', 'Temperature control failure', 'Thermal'),
    ('fc000001-0000-0000-0000-000000000012', 'FC-PRS', 'Pressure regulation failure', 'Pneumatic'),
    ('fc000001-0000-0000-0000-000000000013', 'FC-CBL', 'Cable or connector damage', 'Electrical'),
    ('fc000001-0000-0000-0000-000000000014', 'FC-FLT', 'Filter clogged or degraded', 'Consumable'),
    ('fc000001-0000-0000-0000-000000000015', 'FC-MOT', 'Motor failure', 'Mechanical'),
    ('fc000001-0000-0000-0000-000000000016', 'FC-VLV', 'Valve malfunction', 'Mechanical'),
    ('fc000001-0000-0000-0000-000000000017', 'FC-TUB', 'Tubing wear or blockage', 'Consumable'),
    ('fc000001-0000-0000-0000-000000000018', 'FC-NET', 'Network or communication failure', 'Software'),
    ('fc000001-0000-0000-0000-000000000019', 'FC-FUS', 'Fuse blown', 'Electrical'),
    ('fc000001-0000-0000-0000-000000000020', 'FC-OVH', 'Overheating', 'Thermal'),
    ('fc000001-0000-0000-0000-000000000021', 'FC-NOS', 'Excessive noise or vibration', 'Mechanical'),
    ('fc000001-0000-0000-0000-000000000022', 'FC-CMP', 'Compressor failure', 'Mechanical'),
    ('fc000001-0000-0000-0000-000000000023', 'FC-USR', 'User error or misuse', 'Operational'),
    ('fc000001-0000-0000-0000-000000000024', 'FC-CRK', 'Cracked or broken housing', 'Structural'),
    ('fc000001-0000-0000-0000-000000000025', 'FC-UNK', 'Unknown or undiagnosed failure', 'Other');

-- =============================================================================
-- MAINTENANCE ACTION CODES (20 codes)
-- =============================================================================
INSERT INTO maintenance_action_codes (id, code, description, category) VALUES
    ('ac000001-0000-0000-0000-000000000001', 'AC-RPL', 'Replaced defective part', 'Repair'),
    ('ac000001-0000-0000-0000-000000000002', 'AC-CAL', 'Recalibrated device', 'Calibration'),
    ('ac000001-0000-0000-0000-000000000003', 'AC-SWU', 'Software update or reinstall', 'Software'),
    ('ac000001-0000-0000-0000-000000000004', 'AC-CLN', 'Cleaned and decontaminated', 'Cleaning'),
    ('ac000001-0000-0000-0000-000000000005', 'AC-ADJ', 'Adjusted or realigned', 'Adjustment'),
    ('ac000001-0000-0000-0000-000000000006', 'AC-LUB', 'Lubricated moving parts', 'Preventive'),
    ('ac000001-0000-0000-0000-000000000007', 'AC-TST', 'Tested and verified operation', 'Testing'),
    ('ac000001-0000-0000-0000-000000000008', 'AC-RST', 'Power cycled or factory reset', 'Reset'),
    ('ac000001-0000-0000-0000-000000000009', 'AC-SOL', 'Soldering or electrical repair', 'Electrical'),
    ('ac000001-0000-0000-0000-000000000010', 'AC-FLT', 'Replaced filters', 'Consumable'),
    ('ac000001-0000-0000-0000-000000000011', 'AC-BAT', 'Replaced battery', 'Electrical'),
    ('ac000001-0000-0000-0000-000000000012', 'AC-CBL', 'Replaced cable or connector', 'Electrical'),
    ('ac000001-0000-0000-0000-000000000013', 'AC-FUS', 'Replaced fuse', 'Electrical'),
    ('ac000001-0000-0000-0000-000000000014', 'AC-TUB', 'Replaced tubing', 'Consumable'),
    ('ac000001-0000-0000-0000-000000000015', 'AC-SNS', 'Replaced or repaired sensor', 'Sensor'),
    ('ac000001-0000-0000-0000-000000000016', 'AC-DSP', 'Repaired or replaced display', 'Display'),
    ('ac000001-0000-0000-0000-000000000017', 'AC-EXT', 'Sent to external vendor for repair', 'External'),
    ('ac000001-0000-0000-0000-000000000018', 'AC-INS', 'Inspection only - no action needed', 'Inspection'),
    ('ac000001-0000-0000-0000-000000000019', 'AC-DEC', 'Decommissioned - beyond repair', 'Disposal'),
    ('ac000001-0000-0000-0000-000000000020', 'AC-TRN', 'User training provided', 'Training');

-- =============================================================================
-- CALIBRATION TYPES (8 types)
-- =============================================================================
INSERT INTO calibration_types (id, name, description, interval_months) VALUES
    ('c7000001-0000-0000-0000-000000000001', 'Electrical Safety Testing', 'IEC 62353 electrical safety verification', 12),
    ('c7000001-0000-0000-0000-000000000002', 'Pressure Calibration', 'NIBP and invasive pressure transducer calibration', 12),
    ('c7000001-0000-0000-0000-000000000003', 'Temperature Calibration', 'Temperature sensor and incubator calibration', 12),
    ('c7000001-0000-0000-0000-000000000004', 'Flow Calibration', 'Gas flow meter and ventilator flow calibration', 6),
    ('c7000001-0000-0000-0000-000000000005', 'SpO2 Calibration', 'Pulse oximetry sensor verification', 12),
    ('c7000001-0000-0000-0000-000000000006', 'Weight Calibration', 'Scale and balance calibration', 12),
    ('c7000001-0000-0000-0000-000000000007', 'Imaging QA', 'X-ray dose output and image quality assurance', 6),
    ('c7000001-0000-0000-0000-000000000008', 'Lab Analyzer Calibration', 'Hematology/chemistry analyzer calibration', 3);

-- =============================================================================
-- PM TEMPLATES (10 templates with checklists)
-- =============================================================================
INSERT INTO pm_templates (id, name, category_id, description, frequency_days, checklist_items) VALUES
    ('a7000001-0000-0000-0000-000000000001', 'Patient Monitor PM', 'c0000001-0000-0000-0000-000000000001', 'Quarterly PM for patient monitors', 90,
     '[{"task": "Visual inspection of cables and connectors", "required": true}, {"task": "Check alarm function and limits", "required": true}, {"task": "Verify ECG waveform accuracy", "required": true}, {"task": "Test SpO2 sensor response", "required": true}, {"task": "Check NIBP measurement accuracy", "required": true}, {"task": "Clean exterior and screen", "required": true}, {"task": "Check battery backup", "required": true}, {"task": "Update firmware if available", "required": false}]'),
    ('a7000001-0000-0000-0000-000000000002', 'Ventilator PM', 'c0000001-0000-0000-0000-000000000008', 'Monthly PM for ventilators', 30,
     '[{"task": "Perform leak test", "required": true}, {"task": "Check O2 sensor and replace if needed", "required": true}, {"task": "Inspect breathing circuit and valves", "required": true}, {"task": "Verify tidal volume accuracy", "required": true}, {"task": "Check pressure relief valve", "required": true}, {"task": "Test alarms", "required": true}, {"task": "Replace filters", "required": true}, {"task": "Clean and disinfect", "required": true}]'),
    ('a7000001-0000-0000-0000-000000000003', 'Infusion Pump PM', 'c0000001-0000-0000-0000-000000000007', 'Semi-annual PM for infusion pumps', 180,
     '[{"task": "Flow rate accuracy test", "required": true}, {"task": "Occlusion alarm test", "required": true}, {"task": "Air-in-line alarm test", "required": true}, {"task": "Battery performance test", "required": true}, {"task": "Check door latch mechanism", "required": true}, {"task": "Clean and inspect", "required": true}]'),
    ('a7000001-0000-0000-0000-000000000004', 'Anesthesia Machine PM', 'c0000001-0000-0000-0000-000000000002', 'Monthly PM for anesthesia machines', 30,
     '[{"task": "Low-pressure leak test", "required": true}, {"task": "High-pressure leak test", "required": true}, {"task": "Check vaporizer output", "required": true}, {"task": "Test ventilator function", "required": true}, {"task": "Inspect breathing system", "required": true}, {"task": "Check scavenging system", "required": true}, {"task": "Test O2 flush valve", "required": true}, {"task": "Verify pipeline connections", "required": true}]'),
    ('a7000001-0000-0000-0000-000000000005', 'Autoclave PM', 'c0000001-0000-0000-0000-000000000006', 'Monthly PM for sterilizers', 30,
     '[{"task": "Check door gasket", "required": true}, {"task": "Inspect chamber drain", "required": true}, {"task": "Verify temperature/pressure gauges", "required": true}, {"task": "Run Bowie-Dick test", "required": true}, {"task": "Check safety valves", "required": true}, {"task": "Clean chamber", "required": true}]'),
    ('a7000001-0000-0000-0000-000000000006', 'Defibrillator PM', 'c0000001-0000-0000-0000-000000000001', 'Quarterly PM for defibrillators', 90,
     '[{"task": "Check energy output at all settings", "required": true}, {"task": "Test ECG monitoring", "required": true}, {"task": "Inspect paddles and cables", "required": true}, {"task": "Check battery capacity", "required": true}, {"task": "Test sync mode", "required": true}, {"task": "Check printer if equipped", "required": false}]'),
    ('a7000001-0000-0000-0000-000000000007', 'X-ray Equipment PM', 'c0000001-0000-0000-0000-000000000004', 'Semi-annual PM for X-ray systems', 180,
     '[{"task": "Radiation output measurement", "required": true}, {"task": "Check tube housing and collimator", "required": true}, {"task": "Verify exposure timer accuracy", "required": true}, {"task": "Inspect mechanical movements", "required": true}, {"task": "Check image quality phantom", "required": true}, {"task": "Test safety interlocks", "required": true}]'),
    ('a7000001-0000-0000-0000-000000000008', 'Lab Analyzer PM', 'c0000001-0000-0000-0000-000000000005', 'Monthly PM for lab analyzers', 30,
     '[{"task": "Run QC samples", "required": true}, {"task": "Clean sample probe", "required": true}, {"task": "Check reagent levels", "required": true}, {"task": "Inspect tubing for wear", "required": true}, {"task": "Clean optics", "required": true}, {"task": "Verify calibration", "required": true}]'),
    ('a7000001-0000-0000-0000-000000000009', 'Electrosurgical Unit PM', 'c0000001-0000-0000-0000-000000000009', 'Quarterly PM for ESUs', 90,
     '[{"task": "Power output measurement", "required": true}, {"task": "Check return electrode monitoring", "required": true}, {"task": "Inspect cables and footswitch", "required": true}, {"task": "Test alarm systems", "required": true}, {"task": "Clean and inspect", "required": true}]'),
    ('a7000001-0000-0000-0000-000000000010', 'General Equipment PM', 'c0000001-0000-0000-0000-000000000012', 'Semi-annual general PM for support equipment', 180,
     '[{"task": "Visual inspection", "required": true}, {"task": "Electrical safety check", "required": true}, {"task": "Functional test", "required": true}, {"task": "Clean and lubricate", "required": true}]');

-- =============================================================================
-- RISK SCALES (30 entries: 10 S, 10 O, 10 D)
-- =============================================================================
INSERT INTO risk_scales (dimension, level, label, description) VALUES
    -- Severity (S): clinical impact of equipment failure
    ('severity', 1, 'Negligible', 'No impact on patient care; cosmetic issue only'),
    ('severity', 2, 'Very Minor', 'Minimal inconvenience; workaround readily available'),
    ('severity', 3, 'Minor', 'Minor disruption; alternative equipment immediately available'),
    ('severity', 4, 'Low', 'Some service disruption; backup available within department'),
    ('severity', 5, 'Moderate', 'Noticeable impact on service delivery; manual workaround needed'),
    ('severity', 6, 'Significant', 'Significant service disruption; patient care delayed'),
    ('severity', 7, 'High', 'Major impact; multiple patients affected or procedures postponed'),
    ('severity', 8, 'Very High', 'Critical service interrupted; patient safety concern'),
    ('severity', 9, 'Hazardous', 'Direct patient safety risk; potential for harm'),
    ('severity', 10, 'Catastrophic', 'Immediate life-threatening situation; no backup available'),
    -- Occurrence (O): frequency of failure
    ('occurrence', 1, 'Nearly Impossible', 'Failure extremely unlikely; <1 event per 10 years'),
    ('occurrence', 2, 'Remote', 'Very rare failure; ~1 event per 5 years'),
    ('occurrence', 3, 'Very Low', 'Rare failure; ~1 event per 2-3 years'),
    ('occurrence', 4, 'Low', 'Occasional failure; ~1 event per year'),
    ('occurrence', 5, 'Moderate-Low', 'Somewhat frequent; ~2 events per year'),
    ('occurrence', 6, 'Moderate', 'Frequent enough to notice; ~3-4 events per year'),
    ('occurrence', 7, 'Moderately High', 'Recurring failure; ~5-6 events per year'),
    ('occurrence', 8, 'High', 'Frequent failure; ~monthly occurrence'),
    ('occurrence', 9, 'Very High', 'Very frequent; ~bi-weekly or more'),
    ('occurrence', 10, 'Almost Certain', 'Almost continuous failure; daily or near-daily'),
    -- Detectability (D): ability to detect or mitigate failure early
    ('detectability', 1, 'Almost Certain', 'Failure detected immediately through automatic monitoring'),
    ('detectability', 2, 'Very High', 'Failure detected very quickly; built-in self-test'),
    ('detectability', 3, 'High', 'Failure detected by routine checks or alarms'),
    ('detectability', 4, 'Moderately High', 'Failure likely detected during normal use'),
    ('detectability', 5, 'Moderate', 'Failure may be detected during PM or inspection'),
    ('detectability', 6, 'Low-Moderate', 'Failure detection requires specific testing'),
    ('detectability', 7, 'Low', 'Failure difficult to detect; no backup equipment'),
    ('detectability', 8, 'Very Low', 'Failure unlikely to be detected before impact'),
    ('detectability', 9, 'Remote', 'Failure nearly undetectable; high-consequence latent failure'),
    ('detectability', 10, 'Undetectable', 'No known mechanism to detect failure before patient impact');

-- =============================================================================
-- SCORING WEIGHTS (2 profiles)
-- =============================================================================
INSERT INTO scoring_weights (id, profile_name, description, criteria, is_default) VALUES
    ('b7000001-0000-0000-0000-000000000001', 'Balanced Default',
     'Equal weighting across all criteria for general-purpose scoring',
     '{"availability": 0.20, "mttr": 0.15, "failure_rate": 0.15, "pmc": 0.15, "risk_rpn": 0.15, "age": 0.10, "downtime": 0.10}',
     true),
    ('b7000001-0000-0000-0000-000000000002', 'Clinical Priority',
     'Weights emphasizing patient safety and clinical impact',
     '{"availability": 0.25, "mttr": 0.10, "failure_rate": 0.10, "pmc": 0.10, "risk_rpn": 0.25, "age": 0.10, "downtime": 0.10}',
     false);

-- =============================================================================
-- STATUS LABELS (~30 labels for different entity types)
-- =============================================================================
INSERT INTO status_labels (entity_type, code, label, color, sort_order) VALUES
    -- Equipment condition
    ('equipment_condition', 'functional', 'Functional', '#10B981', 1),
    ('equipment_condition', 'needs_repair', 'Needs Repair', '#F59E0B', 2),
    ('equipment_condition', 'non_functional', 'Non-Functional', '#EF4444', 3),
    ('equipment_condition', 'under_maintenance', 'Under Maintenance', '#6366F1', 4),
    ('equipment_condition', 'decommissioned', 'Decommissioned', '#6B7280', 5),
    -- Equipment status
    ('equipment_status', 'active', 'Active', '#10B981', 1),
    ('equipment_status', 'inactive', 'Inactive', '#F59E0B', 2),
    ('equipment_status', 'disposed', 'Disposed', '#EF4444', 3),
    ('equipment_status', 'in_storage', 'In Storage', '#6B7280', 4),
    -- Maintenance request status
    ('maintenance_request', 'pending', 'Pending', '#F59E0B', 1),
    ('maintenance_request', 'approved', 'Approved', '#3B82F6', 2),
    ('maintenance_request', 'assigned', 'Assigned', '#8B5CF6', 3),
    ('maintenance_request', 'in_progress', 'In Progress', '#6366F1', 4),
    ('maintenance_request', 'completed', 'Completed', '#10B981', 5),
    ('maintenance_request', 'rejected', 'Rejected', '#EF4444', 6),
    ('maintenance_request', 'canceled', 'Canceled', '#6B7280', 7),
    -- Work order status
    ('work_order', 'open', 'Open', '#F59E0B', 1),
    ('work_order', 'assigned', 'Assigned', '#3B82F6', 2),
    ('work_order', 'in_progress', 'In Progress', '#6366F1', 3),
    ('work_order', 'on_hold', 'On Hold', '#8B5CF6', 4),
    ('work_order', 'completed', 'Completed', '#10B981', 5),
    ('work_order', 'canceled', 'Canceled', '#6B7280', 6),
    -- PM status
    ('pm_schedule', 'scheduled', 'Scheduled', '#3B82F6', 1),
    ('pm_schedule', 'in_progress', 'In Progress', '#6366F1', 2),
    ('pm_schedule', 'completed', 'Completed', '#10B981', 3),
    ('pm_schedule', 'overdue', 'Overdue', '#EF4444', 4),
    ('pm_schedule', 'skipped', 'Skipped', '#6B7280', 5),
    -- Urgency levels
    ('urgency', 'low', 'Low', '#10B981', 1),
    ('urgency', 'medium', 'Medium', '#F59E0B', 2),
    ('urgency', 'high', 'High', '#F97316', 3),
    ('urgency', 'critical', 'Critical', '#EF4444', 4),
    -- Risk levels
    ('risk_level', 'low', 'Low Risk', '#10B981', 1),
    ('risk_level', 'medium', 'Medium Risk', '#F59E0B', 2),
    ('risk_level', 'high', 'High Risk', '#F97316', 3),
    ('risk_level', 'critical', 'Critical Risk', '#EF4444', 4);
