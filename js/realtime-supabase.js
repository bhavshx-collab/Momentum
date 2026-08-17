/**
 * realtime-supabase.js — Supabase Realtime subscriptions
 *
 * Subscribes to database changes and updates the local S object
 * automatically, enabling cross-device sync.
 */

let _realtimeChannels = [];

function startRealtimeSubscriptions(userId) {
  // Clean up any existing subscriptions
  stopRealtimeSubscriptions();

  if (!userId) return;

  // ── Habit Entries (completion sync) ──
  const habitEntriesChannel = _supabase
    .channel(`habit_entries_${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'habit_entries',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      _handleHabitEntryChange(payload);
    })
    .subscribe();

  // ── Tasks (cross-device task sync) ──
  const tasksChannel = _supabase
    .channel(`tasks_${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'tasks',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      _handleTaskChange(payload);
    })
    .subscribe();

  // ── Habits (habit CRUD sync) ──
  const habitsChannel = _supabase
    .channel(`habits_${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'habits',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      _handleHabitChange(payload);
    })
    .subscribe();

  // ── Focus Sessions (focus time sync) ──
  const focusChannel = _supabase
    .channel(`focus_sessions_${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'focus_sessions',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      _handleFocusSessionChange(payload);
    })
    .subscribe();

  _realtimeChannels = [habitEntriesChannel, tasksChannel, habitsChannel, focusChannel];
  console.log('[Realtime] Subscriptions started for user:', userId);
}

function stopRealtimeSubscriptions() {
  _realtimeChannels.forEach(ch => {
    try { _supabase.removeChannel(ch); } catch(e) {}
  });
  _realtimeChannels = [];
}

// ── Handle habit entry changes (completions) ──────────────────────
function _handleHabitEntryChange(payload) {
  const { eventType, new: newRow, old: oldRow } = payload;
  if (!newRow && !oldRow) return;

  const row = newRow || oldRow;
  const key = `${row.habit_id}_${row.date}`;

  const statusMap = {
    'completed':       'dn',
    'completed_late':  'dn_late',
    'missed':          'ms',
    'partial':         'pt',
    'pending':         '',
  };

  if (eventType === 'DELETE') {
    delete S.completions[key];
    delete S.completionMeta[key];
  } else {
    S.completions[key] = statusMap[newRow.status] || '';
    if (newRow.snapshot_name) {
      S.completionMeta[key] = {
        vid: newRow.version_id,
        snap: {
          name:     newRow.snapshot_name,
          icon:     newRow.snapshot_icon,
          color:    newRow.snapshot_color,
          category: newRow.snapshot_category,
          target:   newRow.snapshot_target,
        },
      };
    }
    if (newRow.miss_reason) {
      if (!S.missReasons) S.missReasons = {};
      S.missReasons[key] = newRow.miss_reason;
    }
  }

  // Save to localStorage cache
  try { localStorage.setItem('mo_v3', JSON.stringify(S)); } catch(e) {}

  // Refresh UI
  _refreshCurrentPage();
  console.log('[Realtime] Habit entry updated:', key, '→', S.completions[key]);
}

// ── Handle task changes ───────────────────────────────────────────
function _handleTaskChange(payload) {
  const { eventType, new: newRow, old: oldRow } = payload;
  if (!S.tasks) S.tasks = [];

  if (eventType === 'DELETE') {
    S.tasks = S.tasks.filter(t => t.id !== oldRow.id);
  } else if (eventType === 'INSERT') {
    // Only add if not already in S.tasks (avoid duplicate from own actions)
    const exists = S.tasks.find(t => t.id === newRow.id);
    if (!exists) {
      S.tasks.push(_mapTaskRow(newRow));
    }
  } else if (eventType === 'UPDATE') {
    const idx = S.tasks.findIndex(t => t.id === newRow.id);
    if (idx >= 0) {
      S.tasks[idx] = _mapTaskRow(newRow);
    } else {
      S.tasks.push(_mapTaskRow(newRow));
    }
  }

  try { localStorage.setItem('mo_v3', JSON.stringify(S)); } catch(e) {}
  _refreshCurrentPage();
  console.log('[Realtime] Task updated:', newRow?.id, eventType);
}

// ── Handle habit changes ──────────────────────────────────────────
function _handleHabitChange(payload) {
  const { eventType, new: newRow, old: oldRow } = payload;
  if (!S.habits) S.habits = [];

  if (eventType === 'DELETE') {
    S.habits = S.habits.filter(h => h.id !== oldRow.id);
  } else if (eventType === 'INSERT') {
    const exists = S.habits.find(h => h.id === newRow.id);
    if (!exists) {
      S.habits.push(_mapHabitRow(newRow));
    }
  } else if (eventType === 'UPDATE') {
    const idx = S.habits.findIndex(h => h.id === newRow.id);
    if (idx >= 0) {
      // Preserve versions array (fetched separately)
      const existingVersions = S.habits[idx].versions;
      S.habits[idx] = { ..._mapHabitRow(newRow), versions: existingVersions };
    }
  }

  try { localStorage.setItem('mo_v3', JSON.stringify(S)); } catch(e) {}
  _refreshCurrentPage();
}

// ── Handle focus session changes ──────────────────────────────────
function _handleFocusSessionChange(payload) {
  const { eventType, new: newRow } = payload;
  if (!S.focusSessions) S.focusSessions = [];

  if (eventType === 'INSERT') {
    const exists = S.focusSessions.find(fs => fs.id === newRow.id);
    if (!exists) {
      S.focusSessions.push({
        id: newRow.id, date: newRow.date, startTime: newRow.start_time,
        endTime: newRow.end_time, duration: newRow.duration_minutes,
        mode: newRow.mode, category: newRow.category, status: newRow.status,
      });
    }
  }

  try { localStorage.setItem('mo_v3', JSON.stringify(S)); } catch(e) {}
  if (curPage === 'focus' && typeof rFocus === 'function') rFocus();
}

// ── Helpers ───────────────────────────────────────────────────────
function _mapTaskRow(row) {
  return {
    id: row.id, title: row.title, description: row.description,
    notes: row.notes, category: row.category, priority: row.priority,
    color: row.color, dueDate: row.due_date, dueTime: row.due_time,
    reminderDate: row.reminder_date, reminderTime: row.reminder_time,
    status: row.status, completedAt: row.completed_at,
    delayCount: row.delay_count, createdAt: row.created_at?.substring(0, 10),
    _dbId: row.id,
  };
}

function _mapHabitRow(row) {
  return {
    id: row.id, name: row.name, category: row.category,
    freq: row.frequency, icon: row.icon, color: row.color,
    reminder: row.reminder_time, note: row.note,
    active: row.is_active, createdAt: row.created_at?.substring(0, 10),
    versions: [], _dbId: row.id,
  };
}

function _refreshCurrentPage() {
  try {
    if (typeof curPage === 'undefined') return;
    if (curPage === 'dashboard' && typeof rDash === 'function') rDash();
    else if (curPage === 'matrix' && typeof rMatrix === 'function') rMatrix();
    else if (curPage === 'habits' && typeof renderHabitsVersioned === 'function') renderHabitsVersioned('all');
    else if (curPage === 'planner' && typeof PlannerPage !== 'undefined') PlannerPage.render();
    else if (curPage === 'focus' && typeof rFocus === 'function') rFocus();
  } catch(e) {
    console.warn('[Realtime] Page refresh error:', e);
  }
}

// Expose globally
window.startRealtimeSubscriptions = startRealtimeSubscriptions;
window.stopRealtimeSubscriptions  = stopRealtimeSubscriptions;
