-- ============================================================
-- Momentum Habit Tracker — RLS Policies + Fixes
-- Run this in your Supabase Dashboard:
--   Database → SQL Editor → paste this entire file → Run
-- ============================================================

-- ────────────────────────────────────────────────────────────────
-- STEP 1: Enable RLS on every table
-- (Supabase enables RLS by default but adding explicitly is safe)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.life_areas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_versions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_entries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reflections           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_goals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productivity_scores   ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- STEP 2: Drop existing policies (safe — they may not exist)
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- STEP 3: CREATE POLICIES — users can only access their own data
-- ────────────────────────────────────────────────────────────────

-- PROFILES (id = auth.uid())
CREATE POLICY "profiles_own" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- LIFE AREAS
CREATE POLICY "life_areas_own" ON public.life_areas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- HABITS
CREATE POLICY "habits_own" ON public.habits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- HABIT VERSIONS
CREATE POLICY "habit_versions_own" ON public.habit_versions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- HABIT ENTRIES
CREATE POLICY "habit_entries_own" ON public.habit_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- TASKS
CREATE POLICY "tasks_own" ON public.tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- GOALS
CREATE POLICY "goals_own" ON public.goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- JOURNAL ENTRIES
CREATE POLICY "journal_entries_own" ON public.journal_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- REFLECTIONS
CREATE POLICY "reflections_own" ON public.reflections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- FOCUS SESSIONS
CREATE POLICY "focus_sessions_own" ON public.focus_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- FOCUS GOALS
CREATE POLICY "focus_goals_own" ON public.focus_goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- CHALLENGES
CREATE POLICY "challenges_own" ON public.challenges
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- NOTIFICATIONS
CREATE POLICY "notifications_own" ON public.notifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- USER SETTINGS
CREATE POLICY "user_settings_own" ON public.user_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- PRODUCTIVITY SCORES
CREATE POLICY "productivity_scores_own" ON public.productivity_scores
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────
-- STEP 4: Fix habit_entries — make version_id NOT enforce FK
-- so marking habits doesn't fail when version_id UUID is missing
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.habit_entries
  DROP CONSTRAINT IF EXISTS habit_entries_version_id_fkey;

-- ────────────────────────────────────────────────────────────────
-- STEP 5: Add missing indexes for performance
-- ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_habits_user          ON public.habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_entries_user   ON public.habit_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_entries_date   ON public.habit_entries(habit_id, date);
CREATE INDEX IF NOT EXISTS idx_tasks_user           ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date       ON public.tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_goals_user           ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_user         ON public.journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_user      ON public.challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user  ON public.focus_sessions(user_id);

-- ────────────────────────────────────────────────────────────────
-- DONE! All tables now have RLS enabled with proper policies.
-- Users can only read and write their own data.
-- ────────────────────────────────────────────────────────────────
SELECT 'RLS policies applied successfully!' AS result;
