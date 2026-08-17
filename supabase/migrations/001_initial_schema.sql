-- ============================================================
-- Momentum Habit Tracker — Initial Schema
-- Run this in your Supabase SQL Editor (Database > SQL Editor)
-- ============================================================

-- Enable UUID extension (already enabled in Supabase by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────────
-- 1. PROFILES
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT '',
  email        TEXT NOT NULL DEFAULT '',
  timezone     TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  join_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- 2. LIFE AREAS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.life_areas (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  icon         TEXT NOT NULL DEFAULT '📌',
  color        TEXT NOT NULL DEFAULT '#8b5cf6',
  archived     BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- 3. HABITS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.habits (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  category       TEXT NOT NULL DEFAULT 'General',
  life_area_id   UUID REFERENCES public.life_areas(id) ON DELETE SET NULL,
  frequency      TEXT NOT NULL DEFAULT 'daily',  -- daily, weekly, custom
  target         TEXT,    -- free-text e.g. "3 km", "30 min"
  unit           TEXT,
  icon           TEXT NOT NULL DEFAULT '💪',
  color          TEXT NOT NULL DEFAULT '#8b5cf6',
  reminder_time  TEXT,    -- HH:MM format
  note           TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  legacy_id      TEXT,    -- original localStorage ID (h_timestamp) for migration
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- 4. HABIT VERSIONS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.habit_versions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  habit_id     UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_num  INTEGER NOT NULL DEFAULT 1,
  name         TEXT NOT NULL,
  icon         TEXT NOT NULL DEFAULT '💪',
  color        TEXT NOT NULL DEFAULT '#8b5cf6',
  category     TEXT NOT NULL DEFAULT 'General',
  frequency    TEXT NOT NULL DEFAULT 'daily',
  reminder     TEXT,
  note         TEXT,
  target       TEXT,
  start_date   DATE NOT NULL,
  end_date     DATE,      -- NULL means currently active
  legacy_vid   TEXT,      -- original vid (v_timestamp) for migration
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- 5. HABIT ENTRIES (one per day per habit)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.habit_entries (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  habit_id          UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  -- Status: pending | completed | completed_late | missed | partial
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','completed','completed_late','missed','partial')),
  version_id        UUID REFERENCES public.habit_versions(id) ON DELETE SET NULL,
  -- Historical snapshot (frozen at time of completion — never changes after)
  snapshot_name     TEXT,
  snapshot_target   TEXT,
  snapshot_icon     TEXT,
  snapshot_color    TEXT,
  snapshot_category TEXT,
  -- Timing
  completed_at      TIMESTAMPTZ,
  logged_at         TIMESTAMPTZ,
  late_completion   BOOLEAN NOT NULL DEFAULT FALSE,
  miss_reason       TEXT,
  -- Audit
  audit_comment     TEXT,
  audit_reason      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One entry per habit per day per user
  UNIQUE (habit_id, user_id, date)
);

-- ────────────────────────────────────────────────────────────────
-- 6. TASKS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  notes           TEXT,
  category        TEXT NOT NULL DEFAULT 'Other',
  life_area_id    UUID REFERENCES public.life_areas(id) ON DELETE SET NULL,
  priority        TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high','urgent')),
  color           TEXT NOT NULL DEFAULT '#8b5cf6',
  due_date        DATE,
  due_time        TEXT,    -- HH:MM
  reminder_date   DATE,
  reminder_time   TEXT,    -- HH:MM
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','completed','cancelled')),
  completed_at    DATE,
  delay_count     INTEGER NOT NULL DEFAULT 0,
  legacy_id       TEXT,    -- original t_timestamp for migration
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- 7. GOALS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goals (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  life_area_id UUID REFERENCES public.life_areas(id) ON DELETE SET NULL,
  icon         TEXT NOT NULL DEFAULT '🎯',
  color        TEXT NOT NULL DEFAULT '#8b5cf6',
  target       TEXT,
  unit         TEXT,
  deadline     DATE,
  progress     INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','completed','paused','abandoned')),
  -- Milestones stored as JSONB array: [{text, done}]
  milestones   JSONB NOT NULL DEFAULT '[]'::jsonb,
  legacy_id    TEXT,    -- original g_timestamp for migration
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- 8. JOURNAL ENTRIES
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  mood         TEXT,    -- amazing, productive, good, okay, tired, bad
  note         TEXT,
  -- Array of habit UUIDs completed that day
  habit_ids    UUID[] NOT NULL DEFAULT '{}',
  -- Legacy: store original localStorage habit IDs for migration
  legacy_habit_ids TEXT[],
  big_win      TEXT,
  what_went_wrong TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

-- ────────────────────────────────────────────────────────────────
-- 9. REFLECTIONS (Planner daily reflections — separate from journal)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reflections (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  mood         TEXT,
  big_win      TEXT,
  notes        TEXT,
  saved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

-- ────────────────────────────────────────────────────────────────
-- 10. FOCUS SESSIONS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  mode             TEXT NOT NULL DEFAULT 'focus'
                     CHECK (mode IN ('focus','break','longBreak','deepWork','custom')),
  category         TEXT,
  life_area_id     UUID REFERENCES public.life_areas(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'completed'
                     CHECK (status IN ('completed','abandoned','in_progress')),
  legacy_id        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- 11. FOCUS GOALS (daily focus goals)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.focus_goals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  target_minutes    INTEGER NOT NULL DEFAULT 240,
  completed_minutes INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

-- ────────────────────────────────────────────────────────────────
-- 12. CHALLENGES
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.challenges (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  icon            TEXT NOT NULL DEFAULT '🏆',
  color           TEXT NOT NULL DEFAULT '#8b5cf6',
  total_days      INTEGER NOT NULL DEFAULT 30,
  start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  -- completed_days: array of relative day numbers [1, 2, 5, ...]
  completed_days  INTEGER[] NOT NULL DEFAULT '{}',
  -- milestones: [{dayNum, text, completed}]
  milestones      JSONB NOT NULL DEFAULT '[]'::jsonb,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','completed','abandoned')),
  legacy_id       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- 13. NOTIFICATIONS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'system'
                 CHECK (type IN ('habit','task','goal','system','focus')),
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read         BOOLEAN NOT NULL DEFAULT FALSE,
  clicked      BOOLEAN NOT NULL DEFAULT FALSE,
  related_id   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- 14. USER SETTINGS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Theme
  dark_mode           BOOLEAN NOT NULL DEFAULT TRUE,
  -- Notifications
  notifications_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  habits_notifications      BOOLEAN NOT NULL DEFAULT TRUE,
  tasks_notifications       BOOLEAN NOT NULL DEFAULT TRUE,
  streaks_notifications     BOOLEAN NOT NULL DEFAULT TRUE,
  daily_review_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  tomorrow_preview_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  notification_sound        TEXT NOT NULL DEFAULT 'gentle',
  quiet_hours_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start         TEXT NOT NULL DEFAULT '22:00',
  quiet_hours_end           TEXT NOT NULL DEFAULT '07:00',
  streak_warning_time       TEXT NOT NULL DEFAULT '21:00',
  daily_review_time         TEXT NOT NULL DEFAULT '21:30',
  tomorrow_preview_time     TEXT NOT NULL DEFAULT '22:00',
  -- Habit settings
  habit_auto_close_time     TEXT NOT NULL DEFAULT '23:59',
  backfill_window_hours     INTEGER NOT NULL DEFAULT 24,
  late_streak_rule          TEXT NOT NULL DEFAULT 'maintain',
  habit_notifications       BOOLEAN NOT NULL DEFAULT TRUE,
  -- Focus settings
  focus_goal_hours          INTEGER NOT NULL DEFAULT 4,
  pomodoro_length           INTEGER NOT NULL DEFAULT 25,
  break_length              INTEGER NOT NULL DEFAULT 5,
  long_break_length         INTEGER NOT NULL DEFAULT 15,
  deep_work_length          INTEGER NOT NULL DEFAULT 50,
  focus_notifications       BOOLEAN NOT NULL DEFAULT TRUE,
  -- Focus streak (store here for simplicity)
  focus_streak_current      INTEGER NOT NULL DEFAULT 0,
  focus_streak_longest      INTEGER NOT NULL DEFAULT 0,
  focus_streak_last_date    DATE,
  -- Migration
  migration_completed       BOOLEAN NOT NULL DEFAULT FALSE,
  migration_completed_at    TIMESTAMPTZ,
  -- Productivity scores stored as JSONB: {"2026-08-17": {habits,tasks,focus,goals,journal,total}}
  productivity_scores       JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Sent notification dedup keys: {"key": true}
  sent_notifications        JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Last reminder sent timestamps
  last_reminder_sent        JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Week start
  week_start                TEXT NOT NULL DEFAULT 'monday',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- 15. PRODUCTIVITY SCORES (daily breakdown)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.productivity_scores (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  habits_score  INTEGER NOT NULL DEFAULT 0,
  tasks_score   INTEGER NOT NULL DEFAULT 0,
  focus_score   INTEGER NOT NULL DEFAULT 0,
  goals_score   INTEGER NOT NULL DEFAULT 0,
  journal_score INTEGER NOT NULL DEFAULT 0,
  total         INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

-- ────────────────────────────────────────────────────────────────
-- TRIGGERS: Auto-update updated_at
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','life_areas','habits','habit_versions','tasks',
    'goals','journal_entries','user_settings','challenges',
    'habit_entries','productivity_scores'
  ] LOOP
    EXECUTE format('
      CREATE TRIGGER handle_%s_updated_at
      BEFORE UPDATE ON public.%s
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    ', t, t);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────────
-- AUTO-CREATE PROFILE ON SIGNUP
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, join_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.email, ''),
    CURRENT_DATE
  );
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
