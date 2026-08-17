-- ============================================================
-- Momentum — Row Level Security Policies
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- ── Enable RLS on every user-owned table ──────────────────────
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.life_areas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_versions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reflections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_goals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productivity_scores ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- PROFILES
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ═══════════════════════════════════════════════════════════════
-- LIFE AREAS
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "life_areas_select_own" ON public.life_areas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "life_areas_insert_own" ON public.life_areas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "life_areas_update_own" ON public.life_areas
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "life_areas_delete_own" ON public.life_areas
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- HABITS
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "habits_select_own" ON public.habits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "habits_insert_own" ON public.habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "habits_update_own" ON public.habits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "habits_delete_own" ON public.habits
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- HABIT VERSIONS
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "habit_versions_select_own" ON public.habit_versions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "habit_versions_insert_own" ON public.habit_versions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "habit_versions_update_own" ON public.habit_versions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "habit_versions_delete_own" ON public.habit_versions
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- HABIT ENTRIES
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "habit_entries_select_own" ON public.habit_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "habit_entries_insert_own" ON public.habit_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "habit_entries_update_own" ON public.habit_entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "habit_entries_delete_own" ON public.habit_entries
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- TASKS
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "tasks_select_own" ON public.tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "tasks_insert_own" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks_update_own" ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "tasks_delete_own" ON public.tasks
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- GOALS
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "goals_select_own" ON public.goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "goals_insert_own" ON public.goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals_update_own" ON public.goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "goals_delete_own" ON public.goals
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- JOURNAL ENTRIES
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "journal_entries_select_own" ON public.journal_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "journal_entries_insert_own" ON public.journal_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "journal_entries_update_own" ON public.journal_entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "journal_entries_delete_own" ON public.journal_entries
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- REFLECTIONS
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "reflections_select_own" ON public.reflections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "reflections_insert_own" ON public.reflections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reflections_update_own" ON public.reflections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "reflections_delete_own" ON public.reflections
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- FOCUS SESSIONS
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "focus_sessions_select_own" ON public.focus_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "focus_sessions_insert_own" ON public.focus_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "focus_sessions_update_own" ON public.focus_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "focus_sessions_delete_own" ON public.focus_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- FOCUS GOALS
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "focus_goals_select_own" ON public.focus_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "focus_goals_insert_own" ON public.focus_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "focus_goals_update_own" ON public.focus_goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "focus_goals_delete_own" ON public.focus_goals
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- CHALLENGES
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "challenges_select_own" ON public.challenges
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "challenges_insert_own" ON public.challenges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "challenges_update_own" ON public.challenges
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "challenges_delete_own" ON public.challenges
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_own" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- USER SETTINGS
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "user_settings_select_own" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_settings_insert_own" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_update_own" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- PRODUCTIVITY SCORES
-- ═══════════════════════════════════════════════════════════════
CREATE POLICY "prod_scores_select_own" ON public.productivity_scores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "prod_scores_insert_own" ON public.productivity_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prod_scores_update_own" ON public.productivity_scores
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "prod_scores_delete_own" ON public.productivity_scores
  FOR DELETE USING (auth.uid() = user_id);
