-- ============================================================
-- Momentum — Performance Indexes
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- HABIT ENTRIES (most queried — by date, by habit)
CREATE INDEX IF NOT EXISTS idx_habit_entries_user_date
  ON public.habit_entries (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_habit_entries_habit_date
  ON public.habit_entries (habit_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_habit_entries_user_habit_date
  ON public.habit_entries (user_id, habit_id, date DESC);

-- HABITS (by user, active only)
CREATE INDEX IF NOT EXISTS idx_habits_user_active
  ON public.habits (user_id, is_active);

-- HABIT VERSIONS (by habit)
CREATE INDEX IF NOT EXISTS idx_habit_versions_habit
  ON public.habit_versions (habit_id, start_date DESC);

-- TASKS (by user, by due date)
CREATE INDEX IF NOT EXISTS idx_tasks_user_due_date
  ON public.tasks (user_id, due_date);

CREATE INDEX IF NOT EXISTS idx_tasks_user_status
  ON public.tasks (user_id, status);

-- FOCUS SESSIONS (by user, by date)
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_date
  ON public.focus_sessions (user_id, date DESC);

-- JOURNAL ENTRIES (by user, by date)
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date
  ON public.journal_entries (user_id, date DESC);

-- GOALS (by user, by status)
CREATE INDEX IF NOT EXISTS idx_goals_user_status
  ON public.goals (user_id, status);

-- CHALLENGES (by user)
CREATE INDEX IF NOT EXISTS idx_challenges_user
  ON public.challenges (user_id);

-- NOTIFICATIONS (by user, unread)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON public.notifications (user_id, read, timestamp DESC);

-- LIFE AREAS (by user)
CREATE INDEX IF NOT EXISTS idx_life_areas_user_order
  ON public.life_areas (user_id, sort_order);

-- REFLECTIONS (by user, date)
CREATE INDEX IF NOT EXISTS idx_reflections_user_date
  ON public.reflections (user_id, date DESC);

-- PRODUCTIVITY SCORES (by user, date)
CREATE INDEX IF NOT EXISTS idx_prod_scores_user_date
  ON public.productivity_scores (user_id, date DESC);
