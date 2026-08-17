/**
 * migration.js — Migrate existing localStorage data to Supabase
 *
 * Called on first login if migration_completed = false in user_settings.
 * Reads mo_v3 and momentum_v1 keys and uploads all data to Supabase.
 */

async function checkAndPromptMigration() {
  // Check if there is any localStorage data to migrate
  const hasMoV3 = !!localStorage.getItem('mo_v3');
  const hasMomV1 = !!localStorage.getItem('momentum_v1');

  if (!hasMoV3 && !hasMomV1) {
    // Nothing to migrate — mark as done
    await _markMigrationComplete();
    return;
  }

  // Show migration prompt modal
  _showMigrationModal();
}

function _showMigrationModal() {
  const modal = document.createElement('div');
  modal.id = 'migration-modal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    display:flex;align-items:center;justify-content:center;
    background:rgba(5,9,18,0.92);backdrop-filter:blur(20px);
  `;
  modal.innerHTML = `
    <div style="
      background:linear-gradient(135deg,rgba(10,15,30,0.98),rgba(15,20,40,0.98));
      border:1px solid rgba(139,92,246,0.3);border-radius:24px;
      padding:36px;max-width:480px;width:90%;
      box-shadow:0 32px 80px rgba(0,0,0,0.8),0 0 0 1px rgba(139,92,246,0.1);
    ">
      <div style="font-size:48px;text-align:center;margin-bottom:16px">📦</div>
      <h2 style="
        font-size:22px;font-weight:800;text-align:center;margin-bottom:12px;
        background:linear-gradient(135deg,#c4b5fd,#93c5fd);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;
      ">Existing Data Found</h2>
      <p style="color:#94a3b8;text-align:center;line-height:1.7;margin-bottom:24px;font-size:14px">
        We found your existing Momentum data saved locally on this device.<br>
        Would you like to import it to your account so it's permanently saved in the cloud?
      </p>
      <div style="
        background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.15);
        border-radius:14px;padding:16px;margin-bottom:24px;
      ">
        <div id="migration-data-summary" style="color:#94a3b8;font-size:13px;line-height:1.8">
          🔍 Scanning your local data...
        </div>
      </div>
      <div id="migration-progress" style="display:none;margin-bottom:20px">
        <div style="
          background:rgba(148,163,184,0.08);border-radius:8px;
          height:6px;overflow:hidden;margin-bottom:8px;
        ">
          <div id="migration-progress-bar" style="
            height:100%;background:linear-gradient(90deg,#8b5cf6,#6366f1);
            border-radius:8px;width:0%;transition:width 0.3s ease;
          "></div>
        </div>
        <div id="migration-status-text" style="color:#64748b;font-size:12px;text-align:center"></div>
      </div>
      <div style="display:flex;gap:12px">
        <button id="migration-skip-btn" onclick="skipMigration()" style="
          flex:1;padding:14px;border:1px solid rgba(148,163,184,0.2);
          background:transparent;color:#94a3b8;border-radius:12px;
          font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;
          font-family:inherit;
        " onmouseover="this.style.background='rgba(148,163,184,0.08)'"
           onmouseout="this.style.background='transparent'">
          Skip for Now
        </button>
        <button id="migration-import-btn" onclick="startMigration()" style="
          flex:2;padding:14px;border:none;
          background:linear-gradient(135deg,#8b5cf6,#6366f1);
          color:white;border-radius:12px;font-size:14px;font-weight:700;
          cursor:pointer;transition:all 0.2s;font-family:inherit;
          box-shadow:0 4px 20px rgba(139,92,246,0.4);
        ">
          📥 Import My Data
        </button>
      </div>
      <p style="color:#475569;font-size:11px;text-align:center;margin-top:16px">
        Your existing cloud data will not be overwritten. Only new records are added.
      </p>
    </div>
  `;
  document.body.appendChild(modal);

  // Scan and show summary
  _scanLocalStorageData();
}

function _scanLocalStorageData() {
  const summaryEl = document.getElementById('migration-data-summary');
  if (!summaryEl) return;

  let localData = {};
  try {
    const raw = localStorage.getItem('mo_v3');
    if (raw) localData = JSON.parse(raw);
  } catch(e) {}

  // Merge momentum_v1 data (older DB format)
  try {
    const oldRaw = localStorage.getItem('momentum_v1');
    if (oldRaw) {
      const oldData = JSON.parse(oldRaw);
      if (oldData.habits?.length && !localData.habits?.length) localData.habits = oldData.habits;
      if (oldData.goals?.length && !localData.goals?.length) localData.goals = oldData.goals;
      if (oldData.journal?.length && !localData.journal?.length) localData.journal = oldData.journal;
    }
  } catch(e) {}

  window._migrationSource = localData;

  const habitsCount        = (localData.habits || []).length;
  const completionsCount   = Object.keys(localData.completions || {}).length;
  const tasksCount         = (localData.tasks || []).length;
  const goalsCount         = (localData.goals || []).length;
  const journalCount       = (localData.journal || []).length;
  const challengesCount    = (localData.challenges || []).length;
  const focusCount         = (localData.focusSessions || []).length;
  const lifeAreasCount     = (localData.lifeAreas || []).length;

  summaryEl.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      <div>🏃 <strong style="color:#e2e8f0">${habitsCount}</strong> habits</div>
      <div>✅ <strong style="color:#e2e8f0">${completionsCount}</strong> completions</div>
      <div>📋 <strong style="color:#e2e8f0">${tasksCount}</strong> tasks</div>
      <div>🎯 <strong style="color:#e2e8f0">${goalsCount}</strong> goals</div>
      <div>📔 <strong style="color:#e2e8f0">${journalCount}</strong> journal entries</div>
      <div>🏆 <strong style="color:#e2e8f0">${challengesCount}</strong> challenges</div>
      <div>🎯 <strong style="color:#e2e8f0">${focusCount}</strong> focus sessions</div>
      <div>🌱 <strong style="color:#e2e8f0">${lifeAreasCount}</strong> life areas</div>
    </div>
  `;
}

async function startMigration() {
  const importBtn = document.getElementById('migration-import-btn');
  const skipBtn   = document.getElementById('migration-skip-btn');
  const progressEl = document.getElementById('migration-progress');
  const progressBar = document.getElementById('migration-progress-bar');
  const statusText = document.getElementById('migration-status-text');

  if (importBtn) importBtn.disabled = true;
  if (skipBtn)   skipBtn.disabled = true;
  if (progressEl) progressEl.style.display = 'block';

  const uid = getCurrentUserId();
  if (!uid) {
    statusText.textContent = '❌ Not authenticated. Please log in first.';
    return;
  }

  const local = window._migrationSource || {};
  let progress = 0;
  const steps = 9;

  function updateProgress(step, msg) {
    progress = Math.round((step / steps) * 100);
    if (progressBar) progressBar.style.width = progress + '%';
    if (statusText) statusText.textContent = msg;
  }

  try {
    // ── Step 1: Life Areas ──
    updateProgress(0.5, '🌱 Migrating life areas...');
    const lifeAreas = local.lifeAreas || [];
    const idMap_lifeAreas = {}; // legacyId → newUUID
    for (const la of lifeAreas) {
      const newId = la.id.startsWith('la_') ? la.id : `la_${la.id}`;
      idMap_lifeAreas[la.id] = newId;
      await safeUpsert('life_areas', {
        id:         newId,
        user_id:    uid,
        name:       la.name,
        icon:       la.icon || '📌',
        color:      la.color || '#8b5cf6',
        archived:   la.archived || false,
        sort_order: la.order || 0,
      }, 'id');
    }
    updateProgress(1, `✅ ${lifeAreas.length} life areas imported`);

    // ── Step 2: Habits & Versions ──
    updateProgress(1.5, '🏃 Migrating habits...');
    const habits = (local.habits || []);
    const idMap_habits = {}; // legacyId → UUID
    const idMap_versions = {}; // legacyVid → UUID

    for (const h of habits) {
      idMap_habits[h.id] = h.id; // use existing ID as UUID if valid format
      const versions = h.versions || [{
        vid:       `v_${h.id}`,
        name:      h.name,
        icon:      h.icon,
        color:     h.color,
        category:  h.category,
        freq:      h.freq || 'daily',
        reminder:  h.reminder,
        note:      h.note,
        target:    '',
        startDate: h.createdAt || '2024-01-01',
        endDate:   null,
      }];

      // Upsert habit
      await safeUpsert('habits', {
        id:            h.id,
        user_id:       uid,
        name:          h.name,
        category:      h.category || 'General',
        frequency:     h.freq || 'daily',
        target:        versions.find(v => !v.endDate)?.target || '',
        icon:          h.icon || '💪',
        color:         h.color || '#8b5cf6',
        reminder_time: h.reminder || null,
        note:          h.note || null,
        is_active:     h.active !== false,
        legacy_id:     h.id,
      }, 'id');

      // Upsert versions
      for (const [vIdx, v] of versions.entries()) {
        const vRow = {
          id:         v.vid || `${h.id}_v${vIdx}`,
          habit_id:   h.id,
          user_id:    uid,
          version_num: vIdx + 1,
          name:       v.name || h.name,
          icon:       v.icon || h.icon,
          color:      v.color || h.color,
          category:   v.category || h.category || 'General',
          frequency:  v.freq || 'daily',
          reminder:   v.reminder || null,
          note:       v.note || null,
          target:     v.target || null,
          start_date: v.startDate || h.createdAt || '2024-01-01',
          end_date:   v.endDate || null,
          legacy_vid: v.vid,
        };
        await safeUpsert('habit_versions', vRow, 'id');
        idMap_versions[v.vid] = vRow.id;
      }
    }
    updateProgress(2, `✅ ${habits.length} habits imported`);

    // ── Step 3: Habit Entries (completions) ──
    updateProgress(2.5, '📅 Migrating habit completions...');
    const completions = local.completions || {};
    const completionMeta = local.completionMeta || {};
    const missReasons = local.missReasons || {};
    const statusMap = { 'dn':'completed','dn_late':'completed_late','ms':'missed','pt':'partial','':'pending' };

    const entryRows = [];
    for (const [key, statusCode] of Object.entries(completions)) {
      if (!statusCode) continue; // skip empty/pending
      const [habitId, ...dateParts] = key.split('_');
      const date = dateParts.join('-'); // reconstruct YYYY-MM-DD
      if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) continue;
      if (!idMap_habits[habitId] && !habitId) continue;

      const meta = completionMeta[key];
      entryRows.push({
        habit_id:          habitId,
        user_id:           uid,
        date,
        status:            statusMap[statusCode] || 'pending',
        version_id:        meta?.vid ? (idMap_versions[meta.vid] || null) : null,
        snapshot_name:     meta?.snap?.name     || null,
        snapshot_target:   meta?.snap?.target   || null,
        snapshot_icon:     meta?.snap?.icon     || null,
        snapshot_color:    meta?.snap?.color    || null,
        snapshot_category: meta?.snap?.category || null,
        late_completion:   statusCode === 'dn_late',
        miss_reason:       missReasons[key] || null,
      });
    }

    // Batch insert in chunks of 100
    for (let i = 0; i < entryRows.length; i += 100) {
      const chunk = entryRows.slice(i, i + 100);
      await safeUpsert('habit_entries', chunk, 'habit_id,user_id,date');
    }
    updateProgress(3, `✅ ${entryRows.length} habit entries imported`);

    // ── Step 4: Tasks ──
    updateProgress(3.5, '📋 Migrating tasks...');
    const tasks = local.tasks || [];
    for (const t of tasks) {
      await safeUpsert('tasks', {
        id:            t.id,
        user_id:       uid,
        title:         t.title,
        description:   t.description || null,
        notes:         t.notes || null,
        category:      t.category || 'Other',
        priority:      t.priority || 'medium',
        color:         t.color || '#8b5cf6',
        due_date:      t.dueDate || null,
        due_time:      t.dueTime || null,
        reminder_date: t.reminderDate || null,
        reminder_time: t.reminderTime || null,
        status:        t.status || 'pending',
        completed_at:  t.completedAt || null,
        delay_count:   t.delayCount || 0,
        legacy_id:     t.id,
      }, 'id');
    }
    updateProgress(4, `✅ ${tasks.length} tasks imported`);

    // ── Step 5: Goals ──
    updateProgress(4.5, '🎯 Migrating goals...');
    const goals = local.goals || [];
    for (const g of goals) {
      await safeUpsert('goals', {
        id:         g.id,
        user_id:    uid,
        title:      g.title,
        icon:       g.icon || '🎯',
        color:      g.color || '#8b5cf6',
        deadline:   g.deadline || null,
        progress:   g.progress || 0,
        milestones: JSON.stringify(g.milestones || []),
        legacy_id:  g.id,
      }, 'id');
    }
    updateProgress(5, `✅ ${goals.length} goals imported`);

    // ── Step 6: Journal ──
    updateProgress(5.5, '📔 Migrating journal entries...');
    const journal = local.journal || [];
    for (const j of journal) {
      await safeUpsert('journal_entries', {
        user_id:  uid,
        date:     j.date,
        mood:     j.mood || null,
        note:     j.note || null,
        habit_ids: [],
        legacy_habit_ids: j.habits || [],
      }, 'user_id,date');
    }
    // Also check momentum_v1 journal
    try {
      const oldRaw = localStorage.getItem('momentum_v1');
      if (oldRaw) {
        const oldData = JSON.parse(oldRaw);
        for (const j of (oldData.journal || [])) {
          await safeUpsert('journal_entries', {
            user_id: uid, date: j.date, mood: j.mood || null, note: j.note || null,
            habit_ids: [], legacy_habit_ids: j.habits || [],
          }, 'user_id,date');
        }
      }
    } catch(e) {}
    updateProgress(6, `✅ ${journal.length} journal entries imported`);

    // ── Step 7: Challenges ──
    updateProgress(6.5, '🏆 Migrating challenges...');
    const challenges = local.challenges || [];
    for (const ch of challenges) {
      if (ch.id === 'ch_default_1' || ch.id === 'ch_default_2') continue; // skip demo data
      await safeUpsert('challenges', {
        id:             ch.id,
        user_id:        uid,
        title:          ch.title,
        icon:           ch.icon || '🏆',
        color:          ch.color || '#8b5cf6',
        total_days:     ch.totalDays || 30,
        start_date:     ch.startDate,
        completed_days: ch.completedDays || [],
        milestones:     JSON.stringify(ch.milestones || []),
        legacy_id:      ch.id,
      }, 'id');
    }
    updateProgress(7, `✅ ${challenges.length} challenges imported`);

    // ── Step 8: Focus Sessions ──
    updateProgress(7.5, '🎯 Migrating focus sessions...');
    const focusSessions = local.focusSessions || [];
    for (const fs of focusSessions) {
      if (!fs.startTime) continue;
      await safeUpsert('focus_sessions', {
        id:               fs.id,
        user_id:          uid,
        date:             fs.date || fs.startTime.substring(0, 10),
        start_time:       fs.startTime,
        end_time:         fs.endTime || null,
        duration_minutes: fs.duration || 0,
        mode:             fs.mode || 'focus',
        category:         fs.category || null,
        status:           fs.status === 'Completed' ? 'completed' : 'completed',
        legacy_id:        fs.id,
      }, 'id');
    }
    updateProgress(8, `✅ ${focusSessions.length} focus sessions imported`);

    // ── Step 9: Mark complete ──
    updateProgress(8.5, '✨ Finalizing migration...');
    await _markMigrationComplete();
    updateProgress(9, '🎉 Migration complete!');

    // Update success UI
    setTimeout(() => {
      const modal = document.getElementById('migration-modal');
      if (modal) {
        modal.innerHTML = `
          <div style="
            background:linear-gradient(135deg,rgba(10,15,30,0.98),rgba(15,20,40,0.98));
            border:1px solid rgba(34,197,94,0.3);border-radius:24px;
            padding:40px;max-width:420px;width:90%;text-align:center;
          ">
            <div style="font-size:64px;margin-bottom:16px">🎉</div>
            <h2 style="font-size:22px;font-weight:800;color:#4ade80;margin-bottom:12px">Migration Complete!</h2>
            <p style="color:#94a3b8;line-height:1.7;margin-bottom:24px">
              All your Momentum data has been imported to your account.<br>
              Your data is now permanently saved in the cloud.
            </p>
            <button onclick="document.getElementById('migration-modal').remove()" style="
              padding:14px 32px;border:none;
              background:linear-gradient(135deg,#22c55e,#16a34a);
              color:white;border-radius:12px;font-size:14px;font-weight:700;
              cursor:pointer;font-family:inherit;
            ">Continue to Momentum →</button>
          </div>
        `;
      }
    }, 800);

  } catch (err) {
    console.error('[Migration] Error:', err);
    if (statusText) statusText.textContent = `❌ Error: ${err.message}. Please try again.`;
    if (importBtn) { importBtn.disabled = false; importBtn.textContent = '🔄 Retry Import'; }
    if (skipBtn)   skipBtn.disabled = false;
  }
}

async function skipMigration() {
  const modal = document.getElementById('migration-modal');
  if (modal) modal.remove();
  await _markMigrationComplete();
}

async function _markMigrationComplete() {
  const uid = getCurrentUserId();
  if (!uid) return;
  await _supabase.from('user_settings').upsert({
    user_id: uid,
    migration_completed: true,
    migration_completed_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

// Expose globally
window.checkAndPromptMigration = checkAndPromptMigration;
window.startMigration = startMigration;
window.skipMigration  = skipMigration;
