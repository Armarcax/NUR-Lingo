-- NUR Lingo — Initial Schema
-- Migration: 001_initial_schema

-- ─── Users Table ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE,  -- Supabase Auth user ID
  username TEXT UNIQUE,
  email TEXT,
  display_name TEXT,
  cefr_level TEXT NOT NULL DEFAULT 'A1',
  xp_total INTEGER NOT NULL DEFAULT 0,
  hayq_total INTEGER NOT NULL DEFAULT 0,
  seeds_total INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  streak_last_date DATE,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "select_own_user" ON users FOR SELECT
  TO authenticated USING (auth_id = auth.uid() OR id = auth.uid());

CREATE POLICY "insert_own_user" ON users FOR INSERT
  TO authenticated WITH CHECK (auth_id = auth.uid());

CREATE POLICY "update_own_user" ON users FOR UPDATE
  TO authenticated USING (auth_id = auth.uid() OR id = auth.uid());

-- ─── User Lesson Progress Table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  score INTEGER NOT NULL DEFAULT 0,
  hayq_earned INTEGER NOT NULL DEFAULT 0,
  seeds_earned INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_user_id ON user_lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_lesson_id ON user_lesson_progress(lesson_id);

ALTER TABLE user_lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_lesson_progress" ON user_lesson_progress FOR SELECT
  TO authenticated USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "insert_own_lesson_progress" ON user_lesson_progress FOR INSERT
  TO authenticated WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "update_own_lesson_progress" ON user_lesson_progress FOR UPDATE
  TO authenticated USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- ─── Exercise Attempts Table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exercise_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT,
  user_answer TEXT NOT NULL,
  expected_answer TEXT NOT NULL,
  is_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  score INTEGER,
  hayq_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercise_attempts_user_id ON exercise_attempts(user_id);

ALTER TABLE exercise_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_exercise_attempts" ON exercise_attempts FOR SELECT
  TO authenticated USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "insert_own_exercise_attempts" ON exercise_attempts FOR INSERT
  TO authenticated WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- ─── User Dictionary Table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_dictionary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id TEXT NOT NULL,
  word_hy TEXT NOT NULL,
  word_en TEXT NOT NULL,
  word_ru TEXT NOT NULL,
  word_type TEXT NOT NULL DEFAULT 'vocab',
  recording_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, word_id)
);

CREATE INDEX IF NOT EXISTS idx_user_dictionary_user_id ON user_dictionary(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dictionary_word_id ON user_dictionary(word_id);

ALTER TABLE user_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_user_dictionary" ON user_dictionary FOR SELECT
  TO authenticated USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "insert_own_user_dictionary" ON user_dictionary FOR INSERT
  TO authenticated WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "update_own_user_dictionary" ON user_dictionary FOR UPDATE
  TO authenticated USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "delete_own_user_dictionary" ON user_dictionary FOR DELETE
  TO authenticated USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- ─── Word Progress Table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS word_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('unknown', 'learning', 'known', 'mastered', 'forgotten')),
  strength INTEGER NOT NULL DEFAULT 0 CHECK (strength >= 0 AND strength <= 100),
  last_reviewed TIMESTAMPTZ,
  next_review TIMESTAMPTZ,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, word_id)
);

CREATE INDEX IF NOT EXISTS idx_word_progress_user_id ON word_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_word_progress_next_review ON word_progress(next_review) WHERE next_review IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_word_progress_status ON word_progress(status);

ALTER TABLE word_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_word_progress" ON word_progress FOR SELECT
  TO authenticated USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "insert_own_word_progress" ON word_progress FOR INSERT
  TO authenticated WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "update_own_word_progress" ON word_progress FOR UPDATE
  TO authenticated USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- ─── Trigger for updated_at ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_lesson_progress_updated_at
  BEFORE UPDATE ON user_lesson_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_dictionary_updated_at
  BEFORE UPDATE ON user_dictionary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_word_progress_updated_at
  BEFORE UPDATE ON word_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
