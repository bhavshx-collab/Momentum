/**
 * db-supabase.js — Supabase data access layer
 *
 * All writes go to BOTH localStorage (cache) AND Supabase (source of truth).
 * Habit entries (completions) are synced immediately on every mark/unmark.
 */

// ── UUID Conversion Helper ──────────────────────────────────────────
// Converts any string ID (e.g. 'h_1724856123456') to a valid UUID v4 string.
// Uses a deterministic algorithm so the same input always produces the same UUID.
function toUUID(str) {
  if (!str) {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : '00000000-0000-4000-a000-000000000000';
  }
  // Already a valid UUID — return as-is
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str.toLowerCase();
  }
  // Convert string to hex and pad to 32 chars
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, '0');
  }
  hex = (hex + '00000000000000000000000000000000').substring(0, 32);
  // Format as UUID (version 4 style — force version/variant bits)
  return `${hex.substring(0,8)}-${hex.substring(8,12)}-4${hex.substring(13,16)}-a${hex.substring(17,20)}-${hex.substring(20,32)}`;
}
window.toUUID = toUUID;

const SDB = {

  // ── HABITS ───────────────────────────────────────────────────────
  async saveHabit(habit) {
    const uid = getCurrentUserId();
    if (!uid) return;

    const habitUuid = toUUID(habit.id);

    const row = {
      id:            habitUuid,
      user_id:       uid,
      name:          habit.name || 'Untitled',
      category:      habit.category || 'General',
      frequency:     habit.freq || habit.frequency || 'daily',
      target:        habit.versions?.find(v => !v.endDate)?.target || habit.target || null,
      icon:          habit.icon || '💪',
      color:         habit.color || '#8b5cf6',
      reminder_time: habit.reminder || null,
      note:          habit.note || null,
      is_active:     habit.active !== false,
      legacy_id:     habit._legacyId || habit.id,
      updated_at:    new Date().toISOString(),
    };

    const { error } = await safeUpsert('habits', row, 'id');
    if (error) {
      console.error('[SDB] saveHabit error:', error);
      return;
    }

    // Save versions
    if (habit.versions?.length) {
      await this.saveHabitVersions(habitUuid, habit.versions, uid);
    } else {
      // Create an initial default version
      const versionUuid = toUUID(`${habit.id}_v1`);
      await safeUpsert('habit_versions', {
        id:          versionUuid,
        habit_id:    habitUuid,
        user_id:     uid,
        version_num: 1,
        name:        habit.name || 'Untitled',
        icon:        habit.icon || '💪',
        color:       habit.color || '#8b5cf6',
        category:    habit.category || 'General',
        frequency:   habit.freq || habit.frequency || 'daily',
        reminder:    habit.reminder || null,
        note:        habit.note || null,
        target:      habit.target || null,
        start_date:  habit.createdAt || new Date().toISOString().substring(0, 10),
        end_date:    null,
        legacy_vid:  `v_${habit.id}`,
      }, 'id');
    }
  },

  async saveHabitVersions(habitId, versions, uid) {
    if (!uid) uid = getCurrentUserId();
    if (!uid) return;

    const habitUuid = toUUID(habitId);

    for (const v of versions) {
      const vId = v._dbId || v.vid || `${habitId}_v1`;
      const row = {
        id:         toUUID(vId),
        habit_id:   habitUuid,
        user_id:    uid,
        name:       v.name || 'Untitled',
        icon:       v.icon || '💪',
        color:      v.color || '#8b5cf6',
        category:   v.category || 'General',
        frequency:  v.freq || 'daily',
        reminder:   v.reminder || null,
        note:       v.note || null,
        target:     v.target || null,
        start_date: v.startDate || new Date().toISOString().substring(0, 10),
        end_date:   v.endDate || null,
        legacy_vid: v.vid || null,
      };
      const { error } = await safeUpsert('habit_versions', row, 'id');
      if (error) console.error('[SDB] saveHabitVersion error:', error);
    }
  },

  async deleteHabit(habitId) {
    const uid = getCurrentUserId();
    if (!uid) return;

    const habitUuid = toUUID(habitId);
    // Soft delete — mark inactive
    const { error } = await safeUpsert('habits', {
      id:         habitUuid,
      user_id:    uid,
      is_active:  false,
      updated_at: new Date().toISOString(),
    }, 'id');
    if (error) console.error('[SDB] deleteHabit error:', error);
  },

  // ── HABIT ENTRIES (completions) ───────────────────────────────────
  /**
   * Primary function called when a habit is marked/unmarked.
   * @param {string} habitId  — local habit ID (e.g. 'h_1234')
   * @param {string} dateStr  — 'YYYY-MM-DD'
   * @param {string} statusCode — 'dn' | 'dn_late' | 'ms' | 'pt' | ''
   * @param {object} extra    — optional snapshot overrides
   */
  async setHabitEntry(habitId, dateStr, statusCode, extra = {}) {
    const uid = getCurrentUserId();
    if (!uid) return;

    // Map local habit ID → UUID (same algorithm used when saving habits)
    const habitUuid = toUUID(habitId);

    // Ensure the parent habit exists in Supabase first (prevents FK violation).
    // This is cheap — it's just a check, and upsert is idempotent.
    const habit = typeof S !== 'undefined' ? S.habits.find(h => h.id === habitId) : null;
    if (habit) {
      const { error: hErr } = await safeUpsert('habits', {
        id:            habitUuid,
        user_id:       uid,
        name:          habit.name || 'Untitled',
        category:      habit.category || 'General',
        frequency:     habit.freq || habit.frequency || 'daily',
        icon:          habit.icon || '💪',
        color:         habit.color || '#8b5cf6',
        reminder_time: habit.reminder || null,
        note:          habit.note || null,
        is_active:     habit.active !== false,
        legacy_id:     habit._legacyId || habit.id,
        updated_at:    new Date().toISOString(),
      }, 'id');
      if (hErr) {
        console.error('[SDB] setHabitEntry: failed to upsert parent habit:', hErr.message);
        return; // cannot proceed without habit in DB
      }
    }

    // Status code → Supabase enum value
    const statusMap = {
      'dn':      'completed',
      'dn_late': 'completed_late',
      'ms':      'missed',
      'pt':      'partial',
      '':        'pending',
    };
    const status = statusMap[statusCode] ?? 'pending';

    // Pull snapshot from completionMeta (populated by versioning.js)
    const metaKey = `${habitId}_${dateStr}`;
    const meta = (typeof S !== 'undefined' && S.completionMeta)?.[metaKey];

    // Build the row — upsert on (habit_id, user_id, date) unique constraint
    // NOTE: version_id is intentionally null to avoid FK violations if version
    //       hasn't been synced to Supabase yet. Snapshot data is stored inline.
    const row = {
      habit_id:          habitUuid,
      user_id:           uid,
      date:              dateStr,
      status:            status,
      version_id:        null,   // avoid FK violation — snapshot stored inline below
      snapshot_name:     meta?.snap?.name     || extra.name     || null,
      snapshot_target:   meta?.snap?.target   || extra.target   || null,
      snapshot_icon:     meta?.snap?.icon     || extra.icon     || null,
      snapshot_color:    meta?.snap?.color    || extra.color    || null,
      snapshot_category: meta?.snap?.category || extra.category || null,
      late_completion:   status === 'completed_late',
      completed_at:      (status === 'completed' || status === 'completed_late')
                           ? new Date().toISOString() : null,
      logged_at:         new Date().toISOString(),
      miss_reason:       (typeof S !== 'undefined' && S.missReasons)?.[metaKey] || extra.missReason || null,
      updated_at:        new Date().toISOString(),
    };

    // Supabase upsert with composite unique key (habit_id, user_id, date)
    try {
      const result = await _supabase
        .from('habit_entries')
        .upsert(row, { onConflict: 'habit_id,user_id,date', ignoreDuplicates: false });

      if (result.error) {
        console.error('[SDB] setHabitEntry FAILED:', result.error.message, result.error.code, '| row:', JSON.stringify({ habitId, dateStr, status, habitUuid }));
        enqueueOfflineChange({ type: 'upsert', table: 'habit_entries', data: row, conflict: 'habit_id,user_id,date' });
      } else {
        console.log('[SDB] setHabitEntry OK:', habitId, dateStr, status);
      }
    } catch (err) {
      console.error('[SDB] setHabitEntry exception:', err.message, '| row:', JSON.stringify({ habitId, dateStr, status }));
      enqueueOfflineChange({ type: 'upsert', table: 'habit_entries', data: row, conflict: 'habit_id,user_id,date' });
    }
  },

  async bulkSetHabitEntries(entries) {
    const uid = getCurrentUserId();
    if (!uid) return;
    const statusMap = { 'dn': 'completed', 'dn_late': 'completed_late', 'ms': 'missed', 'pt': 'partial', '': 'pending' };
    const rows = entries.map(e => ({
      habit_id:          toUUID(e.habitId),
      user_id:           uid,
      date:              e.date,
      status:            statusMap[e.status] || 'pending',
      version_id:        null,   // avoid FK violation
      snapshot_name:     e.snap?.name     || null,
      snapshot_target:   e.snap?.target   || null,
      snapshot_icon:     e.snap?.icon     || null,
      snapshot_color:    e.snap?.color    || null,
      snapshot_category: e.snap?.category || null,
      miss_reason:       e.missReason     || null,
      late_completion:   e.status === 'dn_late',
      updated_at:        new Date().toISOString(),
    }));
    if (!rows.length) return;
    const { error } = await _supabase
      .from('habit_entries')
      .upsert(rows, { onConflict: 'habit_id,user_id,date', ignoreDuplicates: false });
    if (error) console.error('[SDB] bulkSetHabitEntries error:', error);
  },

  // ── TASKS ────────────────────────────────────────────────────────
  async saveTask(task) {
    const uid = getCurrentUserId();
    if (!uid) return;

    const row = {
      id:            toUUID(task.id),
      user_id:       uid,
      title:         task.title || 'Untitled',
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
    const { error } = await safeDelete('tasks', toUUID(taskId), uid);
    if (error) console.error('[SDB] deleteTask error:', error);
  },

  // ── GOALS ────────────────────────────────────────────────────────
  async saveGoal(goal) {
    const uid = getCurrentUserId();
    if (!uid) return;

    // milestones must be a JSON object (JSONB), not a string
    let milestones = goal.milestones || [];
    if (typeof milestones === 'string') {
      try { milestones = JSON.parse(milestones); } catch { milestones = []; }
    }

    const row = {
      id:         toUUID(goal.id),
      user_id:    uid,
      title:      goal.title || 'Untitled',
      icon:       goal.icon || '🎯',
      color:      goal.color || '#8b5cf6',
      deadline:   goal.deadline || null,
      progress:   Math.min(100, Math.max(0, goal.progress || 0)),
      milestones: milestones,   // JSONB — pass as object, not string
      legacy_id:  goal._legacyId || goal.id,
      updated_at: new Date().toISOString(),
    };

    const { error } = await safeUpsert('goals', row, 'id');
    if (error) console.error('[SDB] saveGoal error:', error);
  },

  async deleteGoal(goalId) {
    const uid = getCurrentUserId();
    if (!uid) return;
    const { error } = await safeDelete('goals', toUUID(goalId), uid);
    if (error) console.error('[SDB] deleteGoal error:', error);
  },

  // ── JOURNAL ──────────────────────────────────────────────────────
  async saveJournalEntry(entry) {
    const uid = getCurrentUserId();
    if (!uid) return;

    const habitUUIDs = (entry.habits || []).map(hid => {
      const h = (typeof S !== 'undefined') && S.habits.find(x => x.id === hid || x._legacyId === hid);
      return toUUID(h?.id || hid);
    }).filter(Boolean);

    const row = {
      user_id:          uid,
      date:             entry.date,
      mood:             entry.mood || null,
      note:             entry.note || null,
      habit_ids:        habitUUIDs,
      legacy_habit_ids: entry.habits || [],
      updated_at:       new Date().toISOString(),
    };

    const { error } = await safeUpsert('journal_entries', row, 'user_id,date');
    if (error) console.error('[SDB] saveJournalEntry error:', error);
  },

  // ── REFLECTIONS ──────────────────────────────────────────────────
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

  // ── LIFE AREAS ───────────────────────────────────────────────────
  async saveLifeArea(area) {
    const uid = getCurrentUserId();
    if (!uid) return;

    const row = {
      id:         toUUID(area.id),
      user_id:    uid,
      name:       area.name || 'Area',
      icon:       area.icon || '📌',
      color:      area.color || '#8b5cf6',
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
    const { error } = await safeDelete('life_areas', toUUID(areaId), uid);
    if (error) console.error('[SDB] deleteLifeArea error:', error);
  },

  // ── CHALLENGES ───────────────────────────────────────────────────
  async saveChallenge(ch) {
    const uid = getCurrentUserId();
    if (!uid) return;

    let milestones = ch.milestones || [];
    if (typeof milestones === 'string') {
      try { milestones = JSON.parse(milestones); } catch { milestones = []; }
    }

    const row = {
      id:             toUUID(ch.id),
      user_id:        uid,
      title:          ch.title || 'Untitled',
      icon:           ch.icon || '🏆',
      color:          ch.color || '#8b5cf6',
      total_days:     ch.totalDays || 30,
      start_date:     ch.startDate || new Date().toISOString().substring(0, 10),
      completed_days: ch.completedDays || [],
      milestones:     milestones,  // JSONB — pass as object
      legacy_id:      ch._legacyId || ch.id,
      updated_at:     new Date().toISOString(),
    };

    const { error } = await safeUpsert('challenges', row, 'id');
    if (error) console.error('[SDB] saveChallenge error:', error);
  },

  async deleteChallenge(challengeId) {
    const uid = getCurrentUserId();
    if (!uid) return;
    const { error } = await safeDelete('challenges', toUUID(challengeId), uid);
    if (error) console.error('[SDB] deleteChallenge error:', error);
  },

  // ── FOCUS SESSIONS ───────────────────────────────────────────────
  async saveFocusSession(session) {
    const uid = getCurrentUserId();
    if (!uid) return;

    const row = {
      id:               toUUID(session.id),
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

  // ── USER SETTINGS ────────────────────────────────────────────────
  async saveSettings() {
    const uid = getCurrentUserId();
    if (!uid) return;

    if (typeof S === 'undefined') return;

    const ns      = S.notificationSettings  || {};
    const fs      = S.focusSettings         || {};
    const hs      = S.habitStatusSettings   || {};
    const fstreak = S.focusStreak           || {};

    // productivity_scores must be JSONB object, not string
    let prodScores = S.productivityScores || {};
    if (typeof prodScores === 'string') {
      try { prodScores = JSON.parse(prodScores); } catch { prodScores = {}; }
    }

    let sentNotif = S.sentNotifications || {};
    if (typeof sentNotif === 'string') {
      try { sentNotif = JSON.parse(sentNotif); } catch { sentNotif = {}; }
    }

    let lastReminder = S.lastReminderSent || {};
    if (typeof lastReminder === 'string') {
      try { lastReminder = JSON.parse(lastReminder); } catch { lastReminder = {}; }
    }

    const row = {
      user_id:                   uid,
      notifications_enabled:     ns.enabled !== false,
      habits_notifications:      ns.habitsEnabled !== false,
      tasks_notifications:       ns.tasksEnabled !== false,
      streaks_notifications:     ns.streaksEnabled !== false,
      daily_review_enabled:      ns.dailyReviewEnabled !== false,
      tomorrow_preview_enabled:  ns.tomorrowPreviewEnabled !== false,
      notification_sound:        ns.sound || 'gentle',
      quiet_hours_enabled:       ns.quietHoursEnabled || false,
      quiet_hours_start:         ns.quietHoursStart || '22:00',
      quiet_hours_end:           ns.quietHoursEnd || '07:00',
      streak_warning_time:       ns.streakWarningTime || '21:00',
      daily_review_time:         ns.dailyReviewTime || '21:30',
      tomorrow_preview_time:     ns.tomorrowPreviewTime || '22:00',
      habit_auto_close_time:     hs.autoCloseTime || '23:59',
      backfill_window_hours:     hs.backfillWindow || 24,
      late_streak_rule:          hs.lateStreakRule || 'maintain',
      habit_notifications:       hs.habitNotifications !== false,
      focus_goal_hours:          fs.focusGoal || 4,
      pomodoro_length:           fs.pomodoroLength || 25,
      break_length:              fs.breakLength || 5,
      long_break_length:         fs.longBreakLength || 15,
      deep_work_length:          fs.deepWorkLength || 50,
      focus_notifications:       fs.focusNotifications !== false,
      focus_streak_current:      fstreak.currentStreak || 0,
      focus_streak_longest:      fstreak.longestStreak || 0,
      focus_streak_last_date:    fstreak.lastFocusedDate || null,
      productivity_scores:       prodScores,
      sent_notifications:        sentNotif,
      last_reminder_sent:        lastReminder,
      updated_at:                new Date().toISOString(),
    };

    const { error } = await safeUpsert('user_settings', row, 'user_id');
    if (error) console.error('[SDB] saveSettings error:', error);
  },

  // ── NOTIFICATIONS ────────────────────────────────────────────────
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

  // ── SYNC COMPLETIONS (habit_entries from S.completions) ──────────
  /**
   * Pushes all habit entries (completions) from local S.completions to Supabase.
   * Called during initial sync when local data exists but cloud is empty.
   */
  async syncAllCompletions(data) {
    const uid = getCurrentUserId();
    if (!uid) return;

    const src = data || (typeof S !== 'undefined' ? S : null);
    if (!src || !src.completions) return;

    const statusMap = { 'dn': 'completed', 'dn_late': 'completed_late', 'ms': 'missed', 'pt': 'partial', '': 'pending' };

    const rows = [];
    for (const [key, statusCode] of Object.entries(src.completions)) {
      // key format: 'habitId_YYYY-MM-DD'  (date is always last 10 chars)
      const dateStr = key.slice(-10);
      const habitId = key.slice(0, key.length - 11); // remove '_YYYY-MM-DD'

      if (!habitId || !dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

      const status = statusMap[statusCode] ?? 'pending';
      const meta = src.completionMeta?.[key];

      rows.push({
        habit_id:          toUUID(habitId),
        user_id:           uid,
        date:              dateStr,
        status:            status,
        version_id:        null,   // avoid FK violation
        snapshot_name:     meta?.snap?.name     || null,
        snapshot_target:   meta?.snap?.target   || null,
        snapshot_icon:     meta?.snap?.icon     || null,
        snapshot_color:    meta?.snap?.color    || null,
        snapshot_category: meta?.snap?.category || null,
        miss_reason:       src.missReasons?.[key] || null,
        late_completion:   status === 'completed_late',
        completed_at:      (status === 'completed' || status === 'completed_late')
                             ? new Date().toISOString() : null,
        logged_at:         new Date().toISOString(),
        updated_at:        new Date().toISOString(),
      });
    }

    if (!rows.length) return;

    // Batch upsert in chunks of 100
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await _supabase
        .from('habit_entries')
        .upsert(chunk, { onConflict: 'habit_id,user_id,date', ignoreDuplicates: false });
      if (error) console.error('[SDB] syncAllCompletions chunk error:', error);
    }
  },

  // ── IMMEDIATE SYNC (no debounce — used on first login) ───────────
  /**
   * Like syncAll but runs immediately without the debounce timer.
   * Use this when you MUST ensure data is in Supabase before the user interacts.
   */
  async syncAllImmediate(data) {
    const uid = getCurrentUserId();
    if (!uid || !window.MomentumOnline) return;

    const src = data || (typeof S !== 'undefined' ? S : null);
    if (!src) return;

    try {
      await this.saveSettings();

      // Save habits first (habit_entries FK depends on habits existing)
      if (src.habits?.length) {
        for (const h of src.habits) {
          await this.saveHabit(h);
        }
      }

      if (src.tasks?.length) {
        for (const t of src.tasks) {
          await this.saveTask(t);
        }
      }

      if (src.goals?.length) {
        for (const g of src.goals) {
          await this.saveGoal(g);
        }
      }

      if (src.journal?.length) {
        for (const j of src.journal) {
          await this.saveJournalEntry(j);
        }
      }

      if (src.reflections && Object.keys(src.reflections).length) {
        for (const [dateStr, ref] of Object.entries(src.reflections)) {
          await this.saveReflection(dateStr, ref);
        }
      }

      if (src.challenges?.length) {
        for (const ch of src.challenges) {
          await this.saveChallenge(ch);
        }
      }

      if (src.lifeAreas?.length) {
        for (const la of src.lifeAreas) {
          await this.saveLifeArea(la);
        }
      }

      // After habits are saved, sync entries (needs habits in DB first)
      await this.syncAllCompletions(src);

      console.log('[SDB] syncAllImmediate complete');
    } catch (e) {
      console.warn('[SDB] syncAllImmediate error:', e);
    }
  },

  // ── FULL SYNC (called by save() on a debounce) ───────────────────
  /**
   * Syncs all data categories to Supabase.
   * Called debounced from save() — for completions use setHabitEntry() directly.
   */
  async syncAll(data) {
    const uid = getCurrentUserId();
    if (!uid || !window.MomentumOnline) return;

    const src = data || (typeof S !== 'undefined' ? S : null);
    if (!src) return;

    if (this._syncDebounce) clearTimeout(this._syncDebounce);
    this._syncDebounce = setTimeout(async () => {
      try {
        await this.saveSettings();

        if (src.habits?.length) {
          for (const h of src.habits) {
            await this.saveHabit(h);
          }
        }

        if (src.tasks?.length) {
          for (const t of src.tasks) {
            await this.saveTask(t);
          }
        }

        if (src.goals?.length) {
          for (const g of src.goals) {
            await this.saveGoal(g);
          }
        }

        if (src.journal?.length) {
          for (const j of src.journal) {
            await this.saveJournalEntry(j);
          }
        }

        if (src.reflections && Object.keys(src.reflections).length) {
          for (const [dateStr, ref] of Object.entries(src.reflections)) {
            await this.saveReflection(dateStr, ref);
          }
        }

        if (src.challenges?.length) {
          for (const ch of src.challenges) {
            await this.saveChallenge(ch);
          }
        }

        if (src.lifeAreas?.length) {
          for (const la of src.lifeAreas) {
            await this.saveLifeArea(la);
          }
        }

      } catch (e) {
        console.warn('[SDB] syncAll error:', e);
      }
    }, 1500);
  },

  _syncDebounce: null,
};

// Expose globally
window.SDB = SDB;
