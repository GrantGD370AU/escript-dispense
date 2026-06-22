-- eScript Training Emulator — D1 schema
-- Ported from the SQLite schema. D1 is SQLite-compatible, so the DDL is largely
-- unchanged. Note: D1 does not need PRAGMA foreign_keys (enforced by default).

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  dob TEXT NOT NULL,
  sex TEXT NOT NULL,
  ihi TEXT NOT NULL,
  allergies TEXT NOT NULL DEFAULT '[]',
  conditions TEXT NOT NULL DEFAULT '[]',
  current_medicines TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS medicines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  generic_name TEXT NOT NULL,
  brand_name TEXT,
  strength TEXT NOT NULL,
  form TEXT NOT NULL,
  route TEXT NOT NULL,
  max_daily_dose TEXT,
  requires_authority INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  medicine_id INTEGER NOT NULL,
  dose TEXT NOT NULL,
  route TEXT,
  frequency TEXT NOT NULL,
  duration TEXT,
  quantity INTEGER NOT NULL,
  repeats INTEGER NOT NULL DEFAULT 0,
  indication TEXT,
  pbs_status TEXT,
  prescriber_name TEXT NOT NULL,
  status TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  dispensed_at TEXT,
  parent_prescription_id INTEGER,
  FOREIGN KEY(patient_id) REFERENCES patients(id),
  FOREIGN KEY(medicine_id) REFERENCES medicines(id)
);

CREATE TABLE IF NOT EXISTS scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  patient_id INTEGER NOT NULL,
  expected_medicine TEXT,
  teaching_points TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  entity_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_token ON prescriptions(token);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(id DESC);
