/**
 * auth.js — Supabase Authentication for Momentum
 *
 * Handles: login, signup, logout, session persistence,
 *          profile loading, and auth state changes.
 */

// ── Current user state ────────────────────────────────────────────
window.momentumUser    = null;  // Supabase User object
window.momentumProfile = null;  // profiles row

// ── Auth State Change listener ────────────────────────────────────
_supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('[Auth] State change:', event, session?.user?.id);

  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    window.momentumUser = session.user;
    await _loadUserData(session.user);
    _showApp();
  } else if (event === 'SIGNED_OUT') {
    window.momentumUser = null;
    window.momentumProfile = null;
    _showAuthScreen();
  } else if (event === 'INITIAL_SESSION') {
    if (session) {
      window.momentumUser = session.user;
      await _loadUserData(session.user);
      _showApp();
    } else {
      _showAuthScreen();
    }
  }
});

// ── Load user data from Supabase into S object ────────────────────
async function _loadUserData(user) {
  if (!user) return;

  try {
    // Load all user data in parallel
    const [
      profileRes,
      habitsRes,
      habitVersionsRes,
      habitEntriesRes,
      tasksRes,
      goalsRes,
      journalRes,
      reflectionsRes,
      lifeAreasRes,
      challengesRes,
      focusSessionsRes,
      settingsRes,
      notificationsRes,
    ] = await Promise.all([
      _supabase.from('profiles').select('*').eq('id', user.id).single(),
      _supabase.from('habits').select('*').eq('user_id', user.id),
      _supabase.from('habit_versions').select('*').eq('user_id', user.id),
      _supabase.from('habit_entries').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(3650),
      _supabase.from('tasks').select('*').eq('user_id', user.id).order('due_date', { ascending: true }),
      _supabase.from('goals').select('*').eq('user_id', user.id),
      _supabase.from('journal_entries').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      _supabase.from('reflections').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      _supabase.from('life_areas').select('*').eq('user_id', user.id).order('sort_order', { ascending: true }),
      _supabase.from('challenges').select('*').eq('user_id', user.id),
      _supabase.from('focus_sessions').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(1000),
      _supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
      _supabase.from('notifications').select('*').eq('user_id', user.id).order('timestamp', { ascending: false }).limit(50),
    ]);

    const hasCloudData = (habitsRes.data && habitsRes.data.length > 0) ||
                         (tasksRes.data && tasksRes.data.length > 0) ||
                         (goalsRes.data && goalsRes.data.length > 0) ||
                         (journalRes.data && journalRes.data.length > 0) ||
                         (challengesRes.data && challengesRes.data.length > 0);

    if (hasCloudData) {
      // Map Supabase rows to S object
      _mapSupabaseToS({
        profile:        profileRes.data,
        habits:         habitsRes.data || [],
        habitVersions:  habitVersionsRes.data || [],
        habitEntries:   habitEntriesRes.data || [],
        tasks:          tasksRes.data || [],
        goals:          goalsRes.data || [],
        journal:        journalRes.data || [],
        reflections:    reflectionsRes.data || [],
        lifeAreas:      lifeAreasRes.data || [],
        challenges:     challengesRes.data || [],
        focusSessions:  focusSessionsRes.data || [],
        settings:       settingsRes.data,
        notifications:  notificationsRes.data || [],
      });
    } else {
      // Cloud database is empty for this user.
      // Push local localStorage data to cloud immediately (not debounced).
      // IMPORTANT: habits must be in DB before habit_entries (FK constraint).
      console.log('[Auth] Supabase empty — pushing local data to cloud (immediate sync)...');
      if (typeof SDB !== 'undefined') {
        await SDB.syncAllImmediate(S);
      }
    }

    window.momentumProfile = profileRes.data;
    console.log('[Auth] User data loaded:', S.habits.length, 'habits,', S.tasks.length, 'tasks');

    // Save to localStorage as cache
    try { localStorage.setItem('mo_v3', JSON.stringify(S)); } catch(e) {}

    // Start Realtime subscriptions
    if (typeof startRealtimeSubscriptions === 'function') {
      startRealtimeSubscriptions(user.id);
    }

    // Check for localStorage migration
    if (settingsRes.data && !settingsRes.data.migration_completed) {
      setTimeout(() => {
        if (typeof checkAndPromptMigration === 'function') {
          checkAndPromptMigration();
        }
      }, 1500);
    }

    // Flush any offline queue
    await flushOfflineQueue();

  } catch (err) {
    console.error('[Auth] Failed to load user data:', err);
    // Fall back to localStorage cache
    try {
      const cached = localStorage.getItem('mo_v3');
      if (cached) {
        const parsed = JSON.parse(cached);
        Object.assign(S, parsed);
        toast('⚠️ Using cached data. Reconnecting...', 'info');
      }
    } catch(e) {}
  }
}

// ── Map Supabase rows → S object ─────────────────────────────────
function _mapSupabaseToS(data) {
  const { profile, habits, habitVersions, habitEntries, tasks, goals,
          journal, reflections, lifeAreas, challenges, focusSessions,
          settings, notifications } = data;

  // ── Profile / User ──
  if (profile) {
    S.user = { name: profile.name, email: profile.email };
  }

  // ── Life Areas ──
  if (lifeAreas && lifeAreas.length > 0) {
    S.lifeAreas = lifeAreas.map(la => ({
      id:       la.legacy_id || la.id,
      name:     la.name,
      icon:     la.icon,
      color:    la.color,
      archived: la.archived,
      order:    la.sort_order,
      _dbId:    la.id,
    }));
  }

  // ── Habits (with versions embedded) ──
  if (habits && habits.length > 0) {
    S.habits = habits.map(h => {
      const versions = habitVersions
        .filter(v => v.habit_id === h.id)
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .map(v => ({
          vid:       v.legacy_vid || v.id,
          name:      v.name,
          icon:      v.icon,
          color:     v.color,
          category:  v.category,
          freq:      v.frequency,
          reminder:  v.reminder,
          note:      v.note,
          target:    v.target,
          startDate: v.start_date,
          endDate:   v.end_date || null,
          _dbId:     v.id,
        }));

      const activeVer = versions.find(v => !v.endDate) || versions[versions.length - 1] || {};

      return {
        id:          h.legacy_id || h.id,
        name:        activeVer.name  || h.name,
        icon:        activeVer.icon  || h.icon,
        color:       activeVer.color || h.color,
        category:    activeVer.category || h.category,
        freq:        activeVer.freq  || h.frequency,
        reminder:    activeVer.reminder || h.reminder_time,
        note:        activeVer.note  || h.note,
        active:      h.is_active,
        createdAt:   h.created_at ? h.created_at.substring(0, 10) : '',
        versions:    versions,
        _dbId:       h.id,
        _legacyId:   h.legacy_id,
      };
    });
  }

  // ── Completions (habit_entries → S.completions flat map) ──
  if (habitEntries && habitEntries.length > 0) {
    S.completions = {};
    S.completionMeta = {};
    habitEntries.forEach(entry => {
      // Find matching habit in S.habits to use legacy/local ID
      const matchingHabit = S.habits.find(hb => hb._dbId === entry.habit_id || hb.id === entry.habit_id);
      const habitId = matchingHabit ? matchingHabit.id : entry.habit_id;

      const key = `${habitId}_${entry.date}`;
      const statusMap = {
        'completed':       'dn',
        'completed_late':  'dn_late',
        'missed':          'ms',
        'partial':         'pt',
        'pending':         '',
      };
      S.completions[key] = statusMap[entry.status] || '';

      // Snapshot meta
      if (entry.status === 'completed' || entry.status === 'completed_late') {
        S.completionMeta[key] = {
          vid: entry.version_id,
          snap: {
            name:     entry.snapshot_name,
            icon:     entry.snapshot_icon,
            color:    entry.snapshot_color,
            category: entry.snapshot_category,
            target:   entry.snapshot_target,
          },
          _entryId: entry.id,
        };
      }

      // Miss reasons
      if (entry.miss_reason) {
        if (!S.missReasons) S.missReasons = {};
        S.missReasons[key] = entry.miss_reason;
      }
    });
  }

  // ── Tasks ──
  if (tasks && tasks.length > 0) {
    S.tasks = tasks.map(t => ({
      id:            t.legacy_id || t.id,
      title:         t.title,
      description:   t.description,
      notes:         t.notes,
      category:      t.category,
      priority:      t.priority,
      color:         t.color,
      dueDate:       t.due_date,
      dueTime:       t.due_time,
      reminderDate:  t.reminder_date,
      reminderTime:  t.reminder_time,
      status:        t.status,
      completedAt:   t.completed_at,
      delayCount:    t.delay_count,
      createdAt:     t.created_at ? t.created_at.substring(0, 10) : '',
      _dbId:         t.id,
      _legacyId:     t.legacy_id,
    }));
  }

  // ── Goals ──
  if (goals && goals.length > 0) {
    S.goals = goals.map(g => ({
      id:          g.legacy_id || g.id,
      title:       g.title,
      icon:        g.icon,
      color:       g.color,
      deadline:    g.deadline,
      progress:    g.progress,
      milestones:  Array.isArray(g.milestones) ? g.milestones : [],
      _dbId:       g.id,
      _legacyId:   g.legacy_id,
    }));
  }

  // ── Journal ──
  if (journal && journal.length > 0) {
    S.journal = journal.map(j => ({
      id:       j.id,
      date:     j.date,
      mood:     j.mood,
      note:     j.note,
      habits:   j.legacy_habit_ids || j.habit_ids || [],
      _dbId:    j.id,
    }));
  }

  // ── Reflections ──
  if (reflections && reflections.length > 0) {
    S.reflections = {};
    reflections.forEach(r => {
      S.reflections[r.date] = {
        mood:    r.mood,
        bigWin:  r.big_win,
        notes:   r.notes,
        savedAt: r.saved_at,
        _dbId:   r.id,
      };
    });
  }

  // ── Challenges ──
  if (challenges && challenges.length > 0) {
    S.challenges = challenges.map(ch => ({
      id:            ch.legacy_id || ch.id,
      title:         ch.title,
      icon:          ch.icon,
      color:         ch.color,
      totalDays:     ch.total_days,
      startDate:     ch.start_date,
      completedDays: ch.completed_days || [],
      milestones:    Array.isArray(ch.milestones) ? ch.milestones : [],
      _dbId:         ch.id,
      _legacyId:     ch.legacy_id,
    }));
  }

  // ── Focus Sessions ──
  if (focusSessions && focusSessions.length > 0) {
    S.focusSessions = focusSessions.map(fs => ({
      id:        fs.legacy_id || fs.id,
      date:      fs.date,
      startTime: fs.start_time,
      endTime:   fs.end_time,
      duration:  fs.duration_minutes,
      mode:      fs.mode,
      category:  fs.category,
      status:    fs.status,
      _dbId:     fs.id,
      _legacyId: fs.legacy_id,
    }));
  }

  // ── Settings ──
  if (settings) {
    S.focusSettings = {
      focusGoal:        settings.focus_goal_hours,
      pomodoroLength:   settings.pomodoro_length,
      breakLength:      settings.break_length,
      longBreakLength:  settings.long_break_length,
      deepWorkLength:   settings.deep_work_length,
      focusNotifications: settings.focus_notifications,
    };
    S.focusStreak = {
      currentStreak:  settings.focus_streak_current,
      longestStreak:  settings.focus_streak_longest,
      lastFocusedDate: settings.focus_streak_last_date || '',
    };
    S.notificationSettings = {
      enabled:                settings.notifications_enabled,
      habitsEnabled:          settings.habits_notifications,
      tasksEnabled:           settings.tasks_notifications,
      streaksEnabled:         settings.streaks_notifications,
      dailyReviewEnabled:     settings.daily_review_enabled,
      tomorrowPreviewEnabled: settings.tomorrow_preview_enabled,
      sound:                  settings.notification_sound,
      quietHoursEnabled:      settings.quiet_hours_enabled,
      quietHoursStart:        settings.quiet_hours_start,
      quietHoursEnd:          settings.quiet_hours_end,
      streakWarningTime:      settings.streak_warning_time,
      dailyReviewTime:        settings.daily_review_time,
      tomorrowPreviewTime:    settings.tomorrow_preview_time,
    };
    S.habitStatusSettings = {
      lateStreakRule:     settings.late_streak_rule,
      autoCloseTime:      settings.habit_auto_close_time,
      backfillWindow:     settings.backfill_window_hours,
      habitNotifications: settings.habit_notifications,
    };
    S.productivityScores = typeof settings.productivity_scores === 'string'
      ? ((() => { try { return JSON.parse(settings.productivity_scores); } catch { return {}; } })()
      ) : (settings.productivity_scores || {});
    S.sentNotifications = typeof settings.sent_notifications === 'string'
      ? ((() => { try { return JSON.parse(settings.sent_notifications); } catch { return {}; } })()
      ) : (settings.sent_notifications || {});
    S.lastReminderSent = typeof settings.last_reminder_sent === 'string'
      ? ((() => { try { return JSON.parse(settings.last_reminder_sent); } catch { return {}; } })()
      ) : (settings.last_reminder_sent || {});
    S.settings = {
      reminders: settings.notifications_enabled,
      streaks:   settings.streaks_notifications,
      darkMode:  settings.dark_mode,
    };
  }

  // ── Notifications ──
  if (notifications && notifications.length > 0) {
    S.notifications = notifications.map(n => ({
      id:        n.id,
      title:     n.title,
      body:      n.body,
      type:      n.type,
      timestamp: n.timestamp,
      read:      n.read,
      clicked:   n.clicked,
      relatedId: n.related_id,
      _dbId:     n.id,
    }));
  }
}

// ── Show/hide app vs auth screen ─────────────────────────────────
function _showApp() {
  const authScreen = document.getElementById('auth-screen');
  const appRoot = document.getElementById('app');
  if (authScreen) authScreen.style.display = 'none';
  if (appRoot) appRoot.style.display = 'flex';

  // Re-initialize app
  if (typeof verEnsureData === 'function') verEnsureData();
  if (typeof plannerEnsureData === 'function') plannerEnsureData();
  if (typeof lifeAreasEnsureData === 'function') lifeAreasEnsureData();
  if (typeof focusEnsureData === 'function') focusEnsureData();
  if (typeof realtimeEnsureData === 'function') realtimeEnsureData();
  if (typeof challengesEnsureData === 'function') challengesEnsureData();
  if (typeof initProductivityScores === 'function') initProductivityScores();

  // Navigate to last page or dashboard
  const hash = window.location.hash.replace('#', '');
  const page = hash || 'dashboard';
  if (typeof go === 'function') go(page);
  else if (typeof Router !== 'undefined') Router.init();

  // Update UI with user name
  const uname = document.getElementById('user-display-name');
  if (uname && S.user) uname.textContent = S.user.name || 'User';
  const avatar = document.getElementById('user-avatar-letter');
  if (avatar && S.user) avatar.textContent = (S.user.name || 'U').charAt(0).toUpperCase();
}

function _showAuthScreen() {
  const authScreen = document.getElementById('auth-screen');
  const appRoot = document.getElementById('app');
  if (authScreen) authScreen.style.display = 'flex';
  if (appRoot) appRoot.style.display = 'none';
}

// ── Auth Actions ──────────────────────────────────────────────────
async function authLogin(email, password) {
  const btn = document.getElementById('auth-submit-btn');
  const errEl = document.getElementById('auth-error');
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in...'; }
    if (errEl) errEl.textContent = '';

    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { success: true };
  } catch (err) {
    if (errEl) errEl.textContent = err.message || 'Login failed. Please try again.';
    return { success: false, error: err };
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
  }
}

async function authSignup(name, email, password) {
  const btn = document.getElementById('auth-submit-btn');
  const errEl = document.getElementById('auth-error');
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Creating account...'; }
    if (errEl) errEl.textContent = '';

    const { data, error } = await _supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;

    // Update name in profile
    if (data.user) {
      await _supabase.from('profiles').upsert({
        id: data.user.id,
        name,
        email,
        join_date: new Date().toISOString().substring(0, 10),
      });
    }

    return { success: true, needsConfirmation: !data.session };
  } catch (err) {
    if (errEl) errEl.textContent = err.message || 'Signup failed. Please try again.';
    return { success: false, error: err };
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Create Account'; }
  }
}

async function authLogout() {
  try {
    await _supabase.auth.signOut();
    // Clear in-memory state but keep localStorage as backup
    S.habits = [];
    S.completions = {};
    S.completionMeta = {};
    S.tasks = [];
    S.goals = [];
    S.journal = [];
    S.reflections = {};
    S.lifeAreas = [];
    S.challenges = [];
    S.focusSessions = [];
    S.notifications = [];
    window.momentumUser = null;
    window.momentumProfile = null;
    toast('👋 Signed out successfully', 'info');
  } catch (err) {
    console.error('[Auth] Logout error:', err);
  }
}

// ── Get current user ──────────────────────────────────────────────
function getCurrentUserId() {
  return window.momentumUser?.id || null;
}

// ── Expose globally ───────────────────────────────────────────────
window.authLogin   = authLogin;
window.authSignup  = authSignup;
window.authLogout  = authLogout;
window.getCurrentUserId = getCurrentUserId;
window._mapSupabaseToS  = _mapSupabaseToS;
