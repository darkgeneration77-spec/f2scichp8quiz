-- Chapter 8 Student Performance System
-- Cloudflare D1 schema

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_code TEXT NOT NULL UNIQUE,
  student_name TEXT NOT NULL,
  class_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_code TEXT NOT NULL,
  student_name TEXT NOT NULL,
  class_name TEXT,
  module_code TEXT NOT NULL,
  module_title TEXT NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  percentage REAL NOT NULL,
  mastery_status TEXT NOT NULL,
  correction_completed INTEGER NOT NULL DEFAULT 0,
  correction_score REAL,
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_code);
CREATE INDEX IF NOT EXISTS idx_attempts_module ON attempts(module_code);
CREATE INDEX IF NOT EXISTS idx_attempts_date ON attempts(attempted_at);

CREATE TABLE IF NOT EXISTS question_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL,
  student_code TEXT NOT NULL,
  module_code TEXT NOT NULL,
  question_id TEXT NOT NULL,
  topic TEXT,
  skill_type TEXT,
  question_text TEXT NOT NULL,
  student_answer TEXT,
  correct_answer TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  explanation TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_qr_attempt ON question_results(attempt_id);
CREATE INDEX IF NOT EXISTS idx_qr_student ON question_results(student_code);
CREATE INDEX IF NOT EXISTS idx_qr_topic ON question_results(topic);
CREATE INDEX IF NOT EXISTS idx_qr_skill ON question_results(skill_type);
