-- Seed data — SIMULATION ONLY. All patients, IHIs and details are fictional.
-- Idempotent guard: only seeds when patients table is empty is handled in the
-- Worker (D1 migrations run once each, so this file runs a single time anyway).

INSERT INTO patients (name, dob, sex, ihi, allergies, conditions, current_medicines) VALUES
  ('Anh Nguyen', '1989-03-14', 'F', '8003 6080 0000 0001', '["Penicillin"]', '["Asthma"]', '["Salbutamol inhaler"]'),
  ('Margaret Wills', '1951-11-02', 'F', '8003 6080 0000 0002', '[]', '["Type 2 diabetes","Hypertension"]', '["Metformin","Perindopril"]'),
  ('Jordan Smith', '2002-07-21', 'M', '8003 6080 0000 0003', '["Sulfa drugs"]', '[]', '[]'),
  ('Robert Tan', '1975-01-30', 'M', '8003 6080 0000 0004', '[]', '["Chronic pain"]', '["Paracetamol"]');

INSERT INTO medicines (generic_name, brand_name, strength, form, route, max_daily_dose, requires_authority, notes) VALUES
  ('Amoxicillin', 'Amoxil', '500 mg', 'Capsule', 'Oral', '1500 mg', 0, 'Beta-lactam antibiotic. Check penicillin allergy.'),
  ('Cefalexin', 'Keflex', '500 mg', 'Capsule', 'Oral', '2000 mg', 0, 'First-generation cephalosporin.'),
  ('Metformin', 'Diabex', '500 mg', 'Tablet', 'Oral', '3000 mg', 0, 'Take with food.'),
  ('Perindopril', 'Coversyl', '5 mg', 'Tablet', 'Oral', '10 mg', 0, 'ACE inhibitor.'),
  ('Salbutamol', 'Ventolin', '100 mcg', 'Inhaler', 'Inhaled', '800 mcg', 0, 'Reliever.'),
  ('Oxycodone', 'Endone', '5 mg', 'Tablet', 'Oral', '', 1, 'Schedule 8 — authority required. Simulation only.'),
  ('Doxycycline', 'Doryx', '100 mg', 'Capsule', 'Oral', '200 mg', 0, 'Tetracycline.'),
  ('Trimethoprim', 'Triprim', '300 mg', 'Tablet', 'Oral', '300 mg', 0, 'For UTI.');

INSERT INTO scenarios (title, description, patient_id, expected_medicine, teaching_points) VALUES
  ('After hours with Anh', 'Anh presents after hours with a suspected bacterial infection. Review her record before prescribing.', 1, 'Cefalexin', '["Check the documented penicillin allergy before selecting an antibiotic","Amoxicillin is contraindicated here","Document the indication on the prescription"]'),
  ('Repeat for Margaret', 'Margaret needs a continuing supply of her regular medicine. Practise issuing a script with repeats.', 2, 'Metformin', '["Confirm the medicine matches the current medicines list","Use repeats appropriately","Dispensing a repeat generates a fresh token"]'),
  ('Controlled drug request', 'Robert requests a stronger analgesic. Consider the governance around Schedule 8 medicines.', 4, 'Oxycodone', '["Schedule 8 medicines require authority","Note the accountability and audit requirements","Simulation only — no real authority is granted"]');
