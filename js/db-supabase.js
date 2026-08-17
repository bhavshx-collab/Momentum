/**
 * db-supabase.js — Supabase data access layer
 *
 * Replaces localStorage persistence with Supabase while keeping
 * the same S object in memory as the local working state.
 * All writes go to BOTH localStorage (cache) AND Supabase (source of truth).
 */

const SDB = {

  // ── HABITS ─────────────────────────────────────────────────────
  async saveHabit(habit) {
    const uid = getCurrentUserId();
    if (!uid) return;

    const row = {
      id:            habit.id,
      user_id:       uid,
      name:          habit.name,
      category:      habit.category,
      frequency:     habit.freq || habit.frequency || 'daily',
      target:        habit.versions?.find(v => !v.endDate)?.target || '',
      icon:          habit.icon,
      color:         habit.color,
      reminder_time: habit.reminder || null,
      note:          habit.note || null,
      is_active:     habit.active !== false,
      legacy_id:     habit._legacyId || habit.id,
      updated_at:    new Date().toISOString(),
    };

    const { error } = await safeUpsert('habits', row, 'id');
    if (error) console.error('[SDB] saveHabit error:', error);

    // Save versions too
    if (habit.versions?.length) {
      await this.saveHabitVersions(habit.id, habit.versions, uid);
    }
  },

  async saveHabitVersions(habitId, versions, uid) {
    if (!uid) uid = getCurrentUserId();
    if (!uid) return;

    for (const v of versions) {
      const row = {
        id:         v._dbId || v.vid || undefined,
        habit_id:   habitId,
        user_id:    uid,
        name:       v.name,
        icon:       v.icon,
        color:      v.color,
        category:   v.category,
        frequency:  v.freq || 'daily',
        reminder:   v.reminder || null,
        note:       v.note || null,
        target:     v.target || null,
        start_date: v.startDate,
        end_date:   v.endDate || null,
        legacy_vid: v.vid,
      };
      const { error } = await safeUpsert('habit_versions', row, 'id');
      if (error) console.error('[SDB] saveHabitVersion error:', error);
    }
  },

  async deleteHabit(habitId) {
    const uid = getCurrentUserId();
    if (!uid) return;
    // Soft delete — just mark inactive
    await safeUpsert('habits', {
      id: habitId,
      user_id: uid,
      is_active: false,
      updated_at: new Date().toISOString(),
    }, 'id');
  },

  // ── HABIT ENTRIES (completions) ────────────────────────────────
  async setHabitEntry(habitId, dateStr, statusCode, extra = {}) {
    const uid = getCurrentUserId();
    if (!uid) return;

    // Map short code → full status
    const statusMap = {
      'dn':      'completed',
      'dn_late': 'completed_late',
      'ms':      'missed',
      'pt':      'partial',
      '':        'pending',
    };
    const status = statusMap[statusCode] ?? 'pending';

    // Build snapshot from completionMeta
    const metaKey = `${habitId}_${dateStr}`;
    const meta = S.completionMeta?.[metaKey];

    const row = {
      habit_id:          habitId,
      user_id:           uid,
      date:              dateStr,
      status,
      version_id:        meta?.vid || extra.versionId || null,
      snapshot_name:     meta?.snap?.name     || extra.name    || null,
      snapshot_target:   meta?.snap?.target   || extra.target  || null,
      snapshot_icon:     meta?.snap?.icon     || extra.icon    || null,
      snapshot_color:    meta?.snap?.color    || extra.color   || null,
      snapshot_category: meta?.snap?.category || extra.category || null,
      late_completion:   status === 'completed_late',
      completed_at:      (status === 'completed' || status === 'completed_late')
                           ? new Date().toISOString() : null,
      logged_at:         new Date().toISOString(),
      miss_reason:       S.missReasons?.[metaKey] || extra.missReason || null,
      updated_at:        new Date().toISOString(),
    };

    // Use conflict on (habit_id, user_id, date)
    const { error } = await safeUpsert('habit_entries', row, 'habit_id,user_id,date');
    if (error) console.error('[SDB] setHabitEntry error:', error);
  },

  async bulkSetHabitEntries(entries) {
    const uid = getCurrentUserId();
    if (!uid) return;
    const statusMap = { 'dn':'completed','dn_late':'completed_late','ms':'missed','pt':'partial','':'pending' };
    const rows = entries.map(e => ({
      habit_id: e.habitId,
      user_id:  uid,
      date:     e.date,
      status:   statusMap[e.status] || 'pending',
      snapshot_name:     e.snap?.name,
      snapshot_target:   e.snap?.target,
      snapshot_icon:     e.snap?.icon,
      snapshot_color:    e.snap?.color,
      snapshot_category: e.snap?.category,
      miss_reason:       e.missReason,
      late_completion:   e.status === 'dn_late',
      updated_at:        new Date().toISOString(),
    }));
    if (!rows.length) return;
    const { error } = await safeUpsert('habit_entries', rows, 'habit_id,user_id,date');
    if (error) console.error('[SDB] bulkSetHabitEntries error:', error);
  },

  // ── TASKS ─────────────────────────────────────────────────────
  async saveTask(task) {
    const uid = getCurrentUserId();
    if (!uid) return;

    const row = {
      id:            task.id,
      user_id:       uid,
      title:         task.title,
      description:   task.description || null,
      notes:         task.notes || null,
      category:      task.category || 'Other',
      priority:      task.priority || 'medium',
      color:         task.color || '#8b5cf6',
      due_date:      task.dueDate || null,
      due_time:      task.dueTime || null,
      reminder_date: task.reminderDate || null,
      reminder_time: task.reminderTime || null,
      status:        task.status || 'pending',
      completed_at:  task.completedAt || null,
      delay_count:   task.delayCount || 0,
      legacy_id:     task._legacyId || task.id,
      updated_at:    new Date().toISOString(),
    };

    const { error } = await safeUpsert('tasks', row, 'id');
    if (error) console.error('[SDB] saveTask error:', error);
  },

  async deleteTask(taskId) {
    const uid = getCurrentUserId();
    if (!uid) return;
    const { error } = await safeDelete('tasks', taskId, uid);
    if (error) console.error('[SDB] deleteTask error:', error);
  },

  // ── GOALS ─────────────────────────────────────────────────────
  async saveGoal(goal) {
    const uid = getCurrentUserId();
    if (!uid) return;

    const row = {
      id:         goal.id,
      user_id:    uid,
      title:      goal.title,
      icon:       goal.icon || '🎯',
      color:      goal.color || '#8b5cf6',
      deadline:   goal.deadline || null,
      progress:   goal.progress || 0,
      milestones: JSON.stringify(goal.milestones || []),
      legacy_id:  goal._legacyId || goal.id,
      updated_at: new Date().toISOString(),
    };

    const { error } = await safeUpsert('goals', row, 'id');
    if (error) console.error('[SDB] saveGoal error:', error);
  },

  async deleteGoal(goalId) {
    const uid = getCurrentUserId();
    if (!uid) return;
    const { error } = await safeDelete('goals', goalId, uid);
    if (error) console.error('[SDB] deleteGoal error:', error);
  },

  // ── JOURNAL ───────────────────────────────────────────────────
  async saveJournalEntry(entry) {
    const uid = getCurrentUserId();
    if (!uid) return;

    // Convert legacy habit IDs to UUIDs where possible
    const habitUUIDs = (entry.habits || []).map(hid => {
      const h = S.habits.find(x => x.id === hid || x._legacyId === hid);
      return h?.id || hid;
    }).filter(Boolean);

    const row = {
      user_id:   uid,
      date:      entry.date,
      mood:      entry.mood || null,
      note:      entry.note || null,
      habit_ids: habitUUIDs,
      legacy_habit_ids: entry.habits || [],
      updated_at: new Date().toISOString(),
    };

    const { error } = await safeUpsert('journal_entries', row, 'user_id,date');
    if (error) console.error('[SDB] saveJournalEntry error:', error);
  },

  // ── REFLECTIONS ───────────────────────────────────────────────
  async saveReflection(dateStr, reflection) {
    const uid = getCurrentUserId();
    if (!uid) return;

    const row = {
      user_id:  uid,
      date:     dateStr,
      mood:     reflection.mood || null,
      big_win:  reflection.bigWin || null,
      notes:    reflection.notes || null,
      saved_at: reflection.savedAt || new Date().toISOString(),
    };

    const { error } = await safeUpsert('reflections', row, 'user_id,date');
    if (error) console.error('[SDB] saveReflection error:', error);
  },

  // ── LIFE AREAS ────────────────────────────────────────────────
  async saveLifeArea(area) {
    const uid = getCurrentUserId();
    if (!uid) return;

    const row = {
      id:         area.id,
      user_id:    uid,
      name:       area.name,
      icon:       area.icon,
      color:      area.color,
      archived:   area.archived || false,
      sort_order: area.order || 0,
      updated_at: new Date().toISOString(),
    };

    const { error } = await safeUpsert('life_areas', row, 'id');
    if (error) console.error('[SDB] saveLifeArea error:', error);
  },

  async saveAllLifeAreas(areas) {
    for (const area of areas) {
      await this.saveLifeArea(area);
    }
  },

  async deleteLifeArea(areaId) {
    const uid = getCurrentUserId();
    if (!uid) return;
    const { error } = await safeDelete('life_areas', areaId, uid);
    if (error) console.error('[SDB] deleteLifeArea error:', error);
  },

  // ── CHALLENGES ────────────────────────────────────────────────
  async saveChallenge(ch) {
    const uid = getCurrentUserId();
    if (!uid) return;

    const row = {
      id:             ch.id,
      user_id:        uid,
      title:          ch.title,
      icon:           ch.icon || '🏆',
      color:          ch.color || '#8b5cf6',
      total_days:     ch.totalDays || 30,
      start_date:     ch.startDate,
      completed_days: ch.completedDays || [],
      milestones:     JSON.stringify(ch.milestones || []),
      legacy_id:      ch._legacyId || ch.id,
      updated_at:     new Date().toISOString(),
    };

    const { error } = await safeUpsert('challenges', row, 'id');
    if (error) console.error('[SDB] saveChallenge error:', error);
  },

  async deleteChallenge(challengeId) {
    const uid = getCurrentUserId();
    if (!uid) return;
    const { error } = await safeDelete('challenges', challengeId, uid);
    if (error) console.error('[SDB] deleteChallenge error:', error);
  },

  // ── FOCUS SESSIONS ────────────────────────────────────────────
  async saveFocusSession(session) {
    const uid = getCurrentUserId();
    if (!uid) return;

    const row = {
      id:               session.id,
      user_id:          uid,
      date:             session.date,
      start_time:       session.startTime,
      end_time:         session.endTime || new Date().toISOString(),
      duration_minutes: session.duration || 0,
      mode:             session.mode || 'focus',
      category:         session.category || null,
      status:           session.status || 'completed',
      legacy_id:        session._legacyId || session.id,
    };

    const { error } = await safeUpsert('focus_sessions', row, 'id');
    if (error) console.error('[SDB] saveFocusSession error:', error);
  },

  // ── USER SETTINGS ─────────────────────────────────────────────
  async saveSettings() {
    const uid = getCurrentUserId();
    if (!uid) return;

    const ns = S.notificationSettings || {};
    const fs = S.focusSettings || {};
    const hs = S.habitStatusSettings || {};
    const fstreak = S.focusStreak || {};

    const row = {
      user_id:                uid,
      notifications_enabled:  ns.enabled !== false,
      habits_notifications:   ns.habitsEnabled !== false,
      tasks_notifications:    ns.tasksEnabled !== false,
      streaks_notifications:  ns.streaksEnabled !== false,
      daily_review_enabled:   ns.dailyReviewEnabled !== false,
      tomorrow_preview_enabled: ns.tomorrowPreviewEnabled !== false,
      notification_sound:     ns.sound || 'gentle',
      quiet_hours_enabled:    ns.quietHoursEnabled || false,
      quiet_hours_start:      ns.quietHoursStart || '22:00',
      quiet_hours_end:        ns.quietHoursEnd || '07:00',
      streak_warning_time:    ns.streakWarningTime || '21:00',
      daily_review_time:      ns.dailyReviewTime || '21:30',
      tomorrow_preview_time:  ns.tomorrowPreviewTime || '22:00',
      habit_auto_close_time:  hs.autoCloseTime || '23:59',
      backfill_window_hours:  hs.backfillWindow || 24,
      late_streak_rule:       hs.lateStreakRule || 'maintain',
      habit_notifications:    hs.habitNotifications !== false,
      focus_goal_hours:       fs.focusGoal || 4,
      pomodoro_length:        fs.pomodoroLength || 25,
      break_length:           fs.breakLength || 5,
      long_break_length:      fs.longBreakLength || 15,
      deep_work_length:       fs.deepWorkLength || 50,
      focus_notifications:    fs.focusNotifications !== false,
      focus_streak_current:   fstreak.currentStreak || 0,
      focus_streak_longest:   fstreak.longestStreak || 0,
      focus_streak_last_date: fstreak.lastFocusedDate || null,
      productivity_scores:    JSON.stringify(S.productivityScores || {}),
      sent_notifications:     JSON.stringify(S.sentNotifications || {}),
      last_reminder_sent:     JSON.stringify(S.lastReminderSent || {}),
      updated_at:             new Date().toISOString(),
    };

    const { error } = await safeUpsert('user_settings', row, 'user_id');
    if (error) console.error('[SDB] saveSettings error:', error);
  },

  // ── NOTIFICATIONS ─────────────────────────────────────────────
  async saveNotification(noti) {
    const uid = getCurrentUserId();
    if (!uid) return;

    const row = {
      user_id:    uid,
      title:      noti.title,
      body:       noti.body,
      type:       noti.type || 'system',
      timestamp:  noti.timestamp || new Date().toISOString(),
      read:       noti.read || false,
      clicked:    noti.clicked || false,
      related_id: noti.relatedId || null,
    };

    const { error } = await _supabase.from('notifications').insert(row);
    if (error) console.error('[SDB] saveNotification error:', error);
  },

  // ── FULL SYNC (called by save()) ──────────────────────────────
  async syncAll(data) {
    const uid = getCurrentUserId();
    if (!uid || !window.MomentumOnline) return;

    // Debounce — don't sync more than once per 2 seconds
    if (this._syncDebounce) clearTimeout(this._syncDebounce);
    this._syncDebounce = setTimeout(async () => {
      try {
        await this.saveSettings();
      } catch (e) {
        console.warn('[SDB] syncAll settings error:', e);
      }
    }, 2000);
  },

  _syncDebounce: null,
};

// Expose globally
window.SDB = SDB;
