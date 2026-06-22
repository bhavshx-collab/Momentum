/**
 * versioning.js — Habit Versioning & Historical Snapshots
 *
 * Integrates with the existing S / go() / save() / toast() / fd() system.
 * Does NOT modify any existing habit, goal, journal, or task logic.
 *
 * Data structures added to S:
 *   S.completionMeta  — { "hid_dateStr": { vid, snap: { name, icon, color, category, freq, target } } }
 *   habit.versions[]  — [{ vid, name, icon, color, category, freq, reminder, note, target, startDate, endDate }]
 */

// ────────────────────────────────────────────────────────────────
//  MIGRATION — run once after load()
// ────────────────────────────────────────────────────────────────

/**
 * Ensures all habits have a versions[] array and S.completionMeta exists.
 * Safe to call multiple times (idempotent).
 */
function verEnsureData() {
  if (!S.completionMeta) S.completionMeta = {};
  let dirty = false;
  (S.habits || []).forEach(h => {
    if (!h.versions) {
      h.versions = [{
        vid: 'v_' + (h.id || Date.now()),
        name: h.name || '',
        icon: h.icon || '💪',
        color: h.color || '#8b5cf6',
        category: h.category || 'Fitness',
        freq: h.freq || 'daily',
        reminder: h.reminder || '07:00',
        note: h.note || '',
        target: '',   // free-text, e.g. "3 km", "30 min"
        startDate: h.createdAt || '2024-01-01',
        endDate: null,  // null = active
      }];
      dirty = true;
    }
  });
  if (dirty) save();
}

// ────────────────────────────────────────────────────────────────
//  VERSION RESOLUTION HELPERS
// ────────────────────────────────────────────────────────────────

/**
 * Returns the version object that was active on a given date.
 * Falls back to the first version if none matches.
 */
function getVersionForDate(habit, dateStr) {
  if (!habit.versions || !habit.versions.length) return null;
  // Find version where startDate <= dateStr and (endDate === null OR endDate >= dateStr)
  const match = [...habit.versions]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .find(v => v.startDate <= dateStr && (v.endDate === null || v.endDate >= dateStr));
  return match || habit.versions[0];
}

/**
 * Returns the active (current) version.
 */
function getActiveVersion(habit) {
  if (!habit.versions || !habit.versions.length) return null;
  return habit.versions.find(v => v.endDate === null) || habit.versions[habit.versions.length - 1];
}

/**
 * Returns display info (name, icon, target, etc.) for a habit on a specific date.
 * Priority: completionMeta snapshot → version lookup → current habit fields
 */
function getHabitDisplayForDate(hid, dateStr) {
  // 1. Try completionMeta snapshot (recorded at time of completion)
  const meta = S.completionMeta[hid + '_' + dateStr];
  if (meta && meta.snap) return { ...meta.snap, vid: meta.vid, fromSnapshot: true };

  // 2. Fall back to version lookup
  const habit = S.habits.find(h => h.id === hid);
  if (!habit) return null;
  const ver = getVersionForDate(habit, dateStr);
  if (ver) return { name: ver.name, icon: ver.icon, color: ver.color, category: ver.category, freq: ver.freq, target: ver.target, vid: ver.vid, fromVersion: true };

  // 3. Last resort: current flat fields
  return { name: habit.name, icon: habit.icon, color: habit.color, category: habit.category, freq: habit.freq, target: '', vid: null };
}

/**
 * Records a completion snapshot into S.completionMeta.
 * Called whenever a habit is marked 'dn' (done).
 */
function recordCompletionSnapshot(hid, dateStr) {
  verEnsureData();
  const habit = S.habits.find(h => h.id === hid);
  if (!habit) return;
  const ver = getVersionForDate(habit, dateStr) || getActiveVersion(habit);
  if (!ver) return;
  S.completionMeta[hid + '_' + dateStr] = {
    vid: ver.vid,
    snap: {
      name: ver.name,
      icon: ver.icon,
      color: ver.color,
      category: ver.category,
      freq: ver.freq,
      target: ver.target || '',
    }
  };
}

/**
 * Removes a completion snapshot (when habit is unmarked).
 */
function removeCompletionSnapshot(hid, dateStr) {
  if (S.completionMeta) delete S.completionMeta[hid + '_' + dateStr];
}

// ────────────────────────────────────────────────────────────────
//  VERSION-AWARE STATS
// ────────────────────────────────────────────────────────────────

/**
 * Computes stats for a specific version's date range.
 */
function getVersionStats(habit, version) {
  if (!habit || !version) return { done: 0, total: 0, rate: 0, streak: 0, best: 0 };

  const startDate = version.startDate;
  const endDate   = version.endDate || fd(new Date());
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const rule = (S.habitStatusSettings && S.habitStatusSettings.lateStreakRule) || 'maintain';

  let done = 0, total = 0, streak = 0, best = 0, tmp = 0;

  // Enumerate all dates in version range
  let cur = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (cur <= end && cur <= now) {
    const ds = fd(cur);
    const s = gc(habit.id, ds);
    const isCompleted = s === 'dn' || s === 'dn_late';
    if (isCompleted) { done++; tmp++; best = Math.max(best, tmp); }
    else if (s === 'ms') { tmp = 0; }
    if (s) total++;
    cur.setDate(cur.getDate() + 1);
  }

  // Current streak (from end of version range backwards)
  let scanDate = new Date(Math.min(end.getTime(), now.getTime()));
  while (scanDate >= new Date(startDate + 'T00:00:00')) {
    const s = gc(habit.id, fd(scanDate));
    const countsForStreak = s === 'dn' || (s === 'dn_late' && rule === 'maintain');
    if (countsForStreak) streak++;
    else if (s === 'ms' || s === 'dn_late') break;
    else break;
    scanDate.setDate(scanDate.getDate() - 1);
  }

  const rate = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, rate, streak, best };
}

/**
 * Gets overall stats across ALL versions (same as hStats but version-aware label)
 */
function getVersionedOverallStats(habit) {
  if (!habit.versions) return getVersionStats(habit, { startDate: habit.createdAt || '2024-01-01', endDate: null });
  const allStats = habit.versions.map(v => getVersionStats(habit, v));
  return {
    done:   allStats.reduce((s, x) => s + x.done, 0),
    total:  allStats.reduce((s, x) => s + x.total, 0),
    streak: allStats[allStats.length - 1]?.streak || 0,
    best:   Math.max(...allStats.map(x => x.best), 0),
    rate:   allStats.reduce((s, x) => s + x.total, 0) > 0
      ? Math.round(allStats.reduce((s, x) => s + x.done, 0) / allStats.reduce((s, x) => s + x.total, 0) * 100)
      : 0,
    versions: allStats,
  };
}

// ────────────────────────────────────────────────────────────────
//  SAVE HABIT WITH VERSIONING
// ────────────────────────────────────────────────────────────────

let _habitEditScope = 'future'; // 'future' | 'all'

function setHabitEditScope(scope, btn) {
  _habitEditScope = scope;
  document.querySelectorAll('.scope-option').forEach(o => o.classList.remove('active'));
  btn.closest('.scope-option').classList.add('active');
}

/**
 * Full versioned saveHabit — replaces the existing saveHabit() in index.html.
 */
function saveHabitVersioned() {
  const name = document.getElementById('h-name').value.trim();
  if (!name) { toast('Please enter a habit name', 'error'); document.getElementById('h-name').focus(); return; }

  const eid   = document.getElementById('h-eid').value;
  const icon  = document.querySelector('#h-icons .ib.sel')?.textContent || ICONS[0];
  const color = document.querySelector('#h-colors .sw.sel')?.dataset.c || COLS[7];
  const target = document.getElementById('h-target').value.trim();

  const newFields = {
    name,
    icon,
    color,
    category:  document.getElementById('h-cat').value,
    freq:      document.getElementById('h-freq').value,
    reminder:  document.getElementById('h-rem').value,
    note:      document.getElementById('h-note').value.trim(),
  };

  verEnsureData();

  if (eid) {
    // ── EDIT mode ──
    const idx = S.habits.findIndex(h => h.id === eid);
    if (idx < 0) return;
    const habit = S.habits[idx];

    if (_habitEditScope === 'future') {
      // Create new version starting today; seal current active version yesterday
      const todayStr = fd(new Date());
      const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return fd(d); })();

      // Seal all versions that have endDate=null
      habit.versions.forEach(v => { if (v.endDate === null) v.endDate = yesterday; });

      // Create new version
      const newVer = {
        vid: 'v_' + Date.now(),
        ...newFields,
        target,
        startDate: todayStr,
        endDate: null,
      };
      habit.versions.push(newVer);

      // Update top-level flat fields (mirror of active version for backward compat)
      Object.assign(habit, newFields);

    } else {
      // ── Update all: only rewrites name/icon/color/note — preserves per-version targets
      habit.versions.forEach(v => {
        v.name  = newFields.name;
        v.icon  = newFields.icon;
        v.color = newFields.color;
        v.note  = newFields.note;
        // category, freq, target are NOT changed in "all history" mode to preserve analytics
      });
      // Active version also gets full update
      const active = getActiveVersion(habit);
      if (active) { Object.assign(active, newFields); active.target = target; }
      Object.assign(habit, newFields);
    }

    toast(`✅ "${name}" updated!`, 'success');
  } else {
    // ── CREATE mode ──
    const newHabit = {
      id: 'h_' + Date.now(),
      createdAt: fd(new Date()),
      ...newFields,
      versions: [{
        vid: 'v_' + Date.now(),
        ...newFields,
        target,
        startDate: fd(new Date()),
        endDate: null,
      }],
    };
    S.habits.push(newHabit);
    toast(`🎉 "${name}" created!`, 'success');
  }

  save();
  closeHM();
  if (curPage === 'habits')    renderHabits('all');
  if (curPage === 'dashboard') rDash();
  if (curPage === 'matrix')    rMatrix();
}

// ────────────────────────────────────────────────────────────────
//  HABIT DETAIL DRAWER
// ────────────────────────────────────────────────────────────────

function openHabitDetail(hid) {
  verEnsureData();
  const habit = S.habits.find(h => h.id === hid);
  if (!habit) return;

  // Ensure versions exist
  if (!habit.versions || !habit.versions.length) {
    habit.versions = [{
      vid: 'v_' + Date.now(),
      name: habit.name, icon: habit.icon, color: habit.color,
      category: habit.category, freq: habit.freq,
      reminder: habit.reminder, note: habit.note, target: '',
      startDate: habit.createdAt || fd(new Date()),
      endDate: null,
    }];
    save();
  }

  const activeVer = getActiveVersion(habit);
  const overallS  = getVersionedOverallStats(habit);
  const vCount    = habit.versions.length;

  // Populate drawer header
  document.getElementById('hdd-icon-el').textContent = activeVer?.icon || habit.icon;
  document.getElementById('hdd-icon-el').style.background = (activeVer?.color || habit.color) + '22';
  document.getElementById('hdd-icon-el').style.color = activeVer?.color || habit.color;
  document.getElementById('hdd-name-el').textContent = activeVer?.name || habit.name;
  document.getElementById('hdd-sub-el').textContent  = `${vCount} version${vCount !== 1 ? 's' : ''} · Started ${fDisp(habit.createdAt || habit.versions[0].startDate)}`;

  // Render body
  const body = document.getElementById('hdd-body');
  body.innerHTML = renderHabitDetailBody(habit, overallS, activeVer);

  // Open
  document.getElementById('habit-detail-overlay').classList.add('open');
  document.getElementById('habit-detail-drawer').classList.add('open');
}

function closeHabitDetail() {
  document.getElementById('habit-detail-overlay').classList.remove('open');
  document.getElementById('habit-detail-drawer').classList.remove('open');
}

function renderHabitDetailBody(habit, overallS, activeVer) {
  // ── Overview stat row ──
  const rateColor = overallS.rate >= 80 ? '#4ade80' : overallS.rate >= 60 ? 'var(--plite)' : '#f87171';
  const statsRow = `
    <div>
      <div class="hdd-section-title">Overall Performance</div>
      <div class="ver-stats-row">
        <div class="ver-stat-mini">
          <div class="ver-stat-mini-val" style="color:${rateColor}">${overallS.rate}%</div>
          <div class="ver-stat-mini-lbl">Completion</div>
        </div>
        <div class="ver-stat-mini">
          <div class="ver-stat-mini-val" style="color:var(--amber)">${overallS.streak}🔥</div>
          <div class="ver-stat-mini-lbl">Cur. Streak</div>
        </div>
        <div class="ver-stat-mini">
          <div class="ver-stat-mini-val" style="color:var(--plite)">${overallS.best}</div>
          <div class="ver-stat-mini-lbl">Best Streak</div>
        </div>
        <div class="ver-stat-mini">
          <div class="ver-stat-mini-val">${habit.versions.length}</div>
          <div class="ver-stat-mini-lbl">Versions</div>
        </div>
      </div>
    </div>
  `;

  // ── Version timeline ──
  const versionsDesc = [...habit.versions].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const timelineItems = versionsDesc.map((v, idx) => {
    const isActive = v.endDate === null;
    const vs = overallS.versions[idx] || { rate: 0, streak: 0, best: 0, done: 0, total: 0 };
    const period = isActive
      ? `${fDisp(v.startDate)} → Present`
      : `${fDisp(v.startDate)} → ${fDisp(v.endDate)}`;
    const rateC = vs.rate >= 80 ? '#4ade80' : vs.rate >= 60 ? 'var(--plite)' : '#f87171';
    const targetHtml = v.target ? `<div class="ver-target-badge">🎯 ${v.target}</div>` : '';
    return `
      <div class="ver-node ${isActive ? 'active' : ''}">
        <div class="ver-node-dot">${idx + 1}</div>
        <div class="ver-node-card">
          <div class="ver-node-header">
            <span class="ver-node-label">Version ${idx + 1}</span>
            ${isActive ? '<span class="ver-active-badge">● Active</span>' : ''}
          </div>
          <div class="ver-node-name">${v.icon} ${v.name}</div>
          ${targetHtml}
          <div class="ver-period">📅 ${period}</div>
          <div class="ver-stats-bar">
            <div class="ver-stat-item">
              <div class="ver-stat-val" style="color:${rateC}">${vs.rate}%</div>
              <div class="ver-stat-lbl">Rate</div>
            </div>
            <div class="ver-stat-item">
              <div class="ver-stat-val" style="color:var(--amber)">${vs.streak}</div>
              <div class="ver-stat-lbl">Streak</div>
            </div>
            <div class="ver-stat-item">
              <div class="ver-stat-val" style="color:var(--plite)">${vs.best}</div>
              <div class="ver-stat-lbl">Best</div>
            </div>
            <div class="ver-stat-item">
              <div class="ver-stat-val">${vs.done}</div>
              <div class="ver-stat-lbl">Done</div>
            </div>
          </div>
          <div class="ver-rate-bar">
            <div class="ver-rate-fill" style="width:${vs.rate}%;background:${rateC}"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const timeline = `
    <div>
      <div class="hdd-section-title">Version History</div>
      <div class="ver-timeline">${timelineItems}</div>
    </div>
  `;

  // ── Comparison table ──
  const tableRows = versionsDesc.map((v, idx) => {
    const isActive = v.endDate === null;
    const vs = overallS.versions[idx] || { rate: 0, streak: 0, best: 0, done: 0, total: 0 };
    const period = isActive ? `${fDisp(v.startDate)} →` : `${fDisp(v.startDate)} → ${fDisp(v.endDate)}`;
    const rateC = vs.rate >= 80 ? '#4ade80' : vs.rate >= 60 ? 'var(--plite)' : '#f87171';
    return `
      <tr class="${isActive ? 'cur-ver' : ''}">
        <td><strong>v${idx + 1}</strong>${isActive ? ' <span style="color:var(--plite);font-size:9px">●</span>' : ''}</td>
        <td>${v.target || '—'}</td>
        <td style="font-size:10px;color:var(--t3)">${period}</td>
        <td style="color:${rateC};font-weight:700">${vs.rate}%</td>
        <td style="color:var(--amber);font-weight:700">${vs.streak}🔥</td>
        <td style="color:var(--t2)">${vs.done}</td>
      </tr>
    `;
  }).join('');

  const table = habit.versions.length > 1 ? `
    <div>
      <div class="hdd-section-title">Version Comparison</div>
      <div style="overflow-x:auto">
        <table class="ver-compare-table">
          <thead>
            <tr>
              <th>Ver</th>
              <th>Target</th>
              <th>Period</th>
              <th>Rate</th>
              <th>Streak</th>
              <th>Done</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>
  ` : '';

  // ── Highlights ──
  const statsWithIdx = versionsDesc.map((v, idx) => ({ v, idx, vs: overallS.versions[idx] || {} }));
  const withData = statsWithIdx.filter(x => x.vs.total > 0);
  const bestVer  = withData.length ? withData.reduce((b, x) => x.vs.rate > b.vs.rate ? x : b, withData[0]) : null;
  const hardVer  = withData.length ? withData.reduce((b, x) => x.vs.rate < b.vs.rate ? x : b, withData[0]) : null;

  const highlights = (bestVer || hardVer) ? `
    <div>
      <div class="hdd-section-title">Highlights</div>
      <div class="ver-highlights">
        ${bestVer ? `
          <div class="ver-highlight-card best">
            <div class="ver-hl-label">🏆 Best Version</div>
            <div class="ver-hl-val" style="color:#4ade80">${bestVer.vs.rate}%</div>
            <div class="ver-hl-sub">${bestVer.v.target || 'v' + (bestVer.idx + 1)} · ${bestVer.vs.done} completions</div>
          </div>
        ` : ''}
        ${hardVer && hardVer !== bestVer ? `
          <div class="ver-highlight-card hardest">
            <div class="ver-hl-label">🔥 Hardest Version</div>
            <div class="ver-hl-val" style="color:#f87171">${hardVer.vs.rate}%</div>
            <div class="ver-hl-sub">${hardVer.v.target || 'v' + (hardVer.idx + 1)} · ${hardVer.vs.done} completions</div>
          </div>
        ` : ''}
      </div>
    </div>
  ` : '';

  // ── Evolution narrative ──
  let evolutionText = '';
  if (versionsDesc.length >= 2) {
    const targets = versionsDesc.filter(v => v.target).map((v, i) => `v${i + 1}: ${v.target}`);
    if (targets.length >= 2) {
      evolutionText = `
        <div>
          <div class="hdd-section-title">📈 Growth Journey</div>
          <div style="background:rgba(139,92,246,.05);border:1px solid rgba(139,92,246,.12);border-radius:12px;padding:14px">
            <div style="font-size:12px;color:var(--t2);line-height:1.8">
              ${targets.join(' → ')}
            </div>
            <div style="font-size:10px;color:var(--t3);margin-top:6px">
              Your target has evolved across ${versionsDesc.length} versions, tracking your growth over time.
            </div>
          </div>
        </div>
      `;
    }
  }

  return statsRow + timeline + table + highlights + evolutionText;
}

// ────────────────────────────────────────────────────────────────
//  UPGRADED openHabitModal — replaces the one in index.html
// ────────────────────────────────────────────────────────────────

function openHabitModalVersioned(eid) {
  verEnsureData();
  const hb = eid ? S.habits.find(x => x.id === eid) : null;
  const activeVer = hb ? (getActiveVersion(hb) || hb) : null;

  document.getElementById('h-eid').value = eid || '';
  document.getElementById('hm-title').textContent = hb ? `✏️ Edit: ${hb.name}` : '✨ Add New Habit';
  document.getElementById('h-name').value  = activeVer ? activeVer.name  : '';
  document.getElementById('h-cat').value   = activeVer ? activeVer.category : 'Fitness';
  document.getElementById('h-freq').value  = activeVer ? activeVer.freq  : 'daily';
  document.getElementById('h-rem').value   = activeVer ? (activeVer.reminder || '07:00') : '07:00';
  document.getElementById('h-note').value  = activeVer ? (activeVer.note || '') : '';
  document.getElementById('h-target').value = activeVer ? (activeVer.target || '') : '';

  const si = activeVer ? activeVer.icon : ICONS[0];
  document.getElementById('h-icons').innerHTML = ICONS.map(ic =>
    `<button type="button" class="ib ${ic === si ? 'sel' : ''}" onclick="selIcon(this,'${ic}','h-icons')">${ic}</button>`
  ).join('');

  const sc2 = activeVer ? activeVer.color : COLS[7];
  document.getElementById('h-colors').innerHTML = COLS.map(c =>
    `<div class="sw ${c === sc2 ? 'sel' : ''}" style="background:${c}" data-c="${c}" onclick="selCol(this,'h-colors')"></div>`
  ).join('');

  // Show/hide scope selector
  const scopeRow = document.getElementById('h-scope-row');
  if (eid) {
    scopeRow.classList.add('visible');
    // Reset to default "future" selection
    _habitEditScope = 'future';
    document.querySelectorAll('.scope-option').forEach(o => o.classList.remove('active'));
    document.querySelector('.scope-option[data-scope="future"]')?.classList.add('active');
  } else {
    scopeRow.classList.remove('visible');
  }

  document.getElementById('m-habit').classList.remove('hid');
  document.getElementById('h-name').focus();
}

// ────────────────────────────────────────────────────────────────
//  OVERRIDDEN sc() — captures completion snapshot
// ────────────────────────────────────────────────────────────────

/**
 * Override the inline sc() with a version-aware variant.
 * Called from togToday(), clickCell(), cycleC() etc.
 */
function scVersioned(hid, ds, v) {
  S.completions[hid + '_' + ds] = v;
  if (v === 'dn' || v === 'dn_late') {
    recordCompletionSnapshot(hid, ds);
  } else {
    removeCompletionSnapshot(hid, ds);
  }
  save();
}

// ────────────────────────────────────────────────────────────────
//  MATRIX TOOLTIP HELPER
// ────────────────────────────────────────────────────────────────

/**
 * Returns a tooltip string for a matrix cell.
 * Shows historical version name + target if applicable.
 */
function getCellTooltip(hid, dateStr) {
  const display = getHabitDisplayForDate(hid, dateStr);
  if (!display) return '';
  const parts = [display.name];
  if (display.target) parts.push(display.target);
  return parts.join(' · ');
}

// ────────────────────────────────────────────────────────────────
//  PATCH renderHabits with version-aware display
// ────────────────────────────────────────────────────────────────

function renderHabitsVersioned(filter) {
  verEnsureData();
  const h = filter === 'all' ? S.habits : S.habits.filter(x => x.freq === filter);
  const el = document.getElementById('habits-container');
  if (!h.length) {
    el.innerHTML = `<div class="es"><div class="ei">✨</div><p class="t2">No ${filter !== 'all' ? filter : ''} habits found.</p><button class="btn bp mt3" onclick="openHabitModalVersioned()">+ Add Habit</button></div>`;
    return;
  }
  el.innerHTML = `<div class="card hl">${h.map(hb => {
    const hs    = hStats(hb.id);
    const active = getActiveVersion(hb) || hb;
    const rc    = hs.rate >= 80 ? 'var(--green)' : hs.rate >= 60 ? 'var(--plite)' : '#f87171';
    const vCount = hb.versions ? hb.versions.length : 1;
    const targetBadge = active.target
      ? `<span class="habit-target-badge">🎯 ${active.target}</span>`
      : '';
    const verBadge = vCount > 1
      ? `<span class="ver-badge">v${vCount}</span>`
      : '';
    return `
      <div class="hi">
        <div class="hib" style="background:${active.color}22;color:${active.color}">${active.icon}</div>
        <div style="flex:1;min-width:0">
          <div class="hit">${active.name}${verBadge}</div>
          <div class="htags">
            <span class="badge ${CAT_C[active.category] || 'bp2'}">${active.category}</span>
            <span class="badge bb">🔄 ${active.freq}</span>
            ${targetBadge}
            ${active.note ? `<span class="txs tm">· ${active.note}</span>` : ''}
          </div>
        </div>
        <div class="hstats">
          <div><div class="hsvl">${hs.streak}🔥</div><div class="hslb">Streak</div></div>
          <div><div class="hsvl" style="color:${rc}">${hs.rate}%</div><div class="hslb">Rate</div></div>
          <div><div class="hsvl">${hs.best}</div><div class="hslb">Best</div></div>
        </div>
        <div class="hact">
          <button class="btn bg btn-ico btn-sm" onclick="event.stopPropagation();openHabitDetail('${hb.id}')" title="Version History">📊</button>
          <button class="btn bg btn-ico btn-sm" onclick="event.stopPropagation();openHabitModalVersioned('${hb.id}')" title="Edit">✏️</button>
          <button class="btn bd btn-ico btn-sm" onclick="event.stopPropagation();confirmDel('${hb.id}')" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }).join('')}</div>`;
}

// ────────────────────────────────────────────────────────────────
//  PATCH rMatrix with version-aware tooltips
// ────────────────────────────────────────────────────────────────

function rMatrixVersioned() {
  verEnsureData();
  const y = mxYear, m = mxMonth, d = dim(y, m), now = new Date(); now.setHours(0,0,0,0);
  const t = ts(), h = S.habits;
  document.getElementById('mx-title').textContent = mnName(m) + ' ' + y;
  if (!h.length) {
    document.getElementById('mx-container').innerHTML = `<div class="es" style="padding:40px"><div class="ei">📋</div><p class="t2">No habits yet.</p><button class="btn bp mt3" onclick="openHabitModalVersioned()">+ Add Habit</button></div>`;
    document.getElementById('mx-summary').innerHTML = '';
    return;
  }
  const days = [];
  for (let i = 1; i <= d; i++) {
    const dt = new Date(y, m, i); const dow = dt.getDay(); const adj = dow === 0 ? 6 : dow - 1;
    const ds = fd(dt); days.push({ d: i, ds, adj, isFuture: dt > now, isToday: ds === t, isWE: adj >= 5 });
  }
  let tbl = '<table class="mxt">';
  tbl += '<thead><tr><th class="mnc" style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;padding:4px 10px">Habit</th>';
  days.forEach(({ d, isToday, adj, isWE }) => { const sep = adj === 6 ? 'wsp' : ''; tbl += `<th class="dh ${isWE ? 'we' : ''} ${isToday ? 'tc' : ''} ${sep}">${d}</th>`; });
  tbl += '<th style="padding:4px 8px;font-size:10px;color:var(--t3);text-align:right;min-width:75px">Rate</th>';
  tbl += '<th style="padding:4px 8px;font-size:10px;color:var(--t3);text-align:right;min-width:55px">Streak</th></tr>';
  tbl += '<tr><th class="mnc" style="font-size:9px;color:var(--t3);padding:2px 10px">─────────</th>';
  days.forEach(({ adj, isToday, isWE }) => { const sep = adj === 6 ? 'wsp' : ''; const dn = ['M','T','W','T','F','S','S'][adj]; tbl += `<th class="dteh ${isToday ? 'tc' : ''} ${sep}" style="color:${isWE ? 'rgba(139,92,246,.5)' : ''}">${dn}</th>`; });
  tbl += '<th></th><th></th></tr></thead><tbody>';

  h.forEach(hb => {
    const hs = hStats(hb.id);
    const activeVer = getActiveVersion(hb) || hb;
    const vCount = hb.versions ? hb.versions.length : 1;
    const verBadge = vCount > 1 ? `<span class="ver-badge">v${vCount}</span>` : '';
    tbl += `<tr class="mhr"><td class="mnc"><div class="flex aic gap2"><span class="mnci">${activeVer.icon}</span><span class="mnct" title="${activeVer.name}">${activeVer.name}${verBadge}</span></div></td>`;
    days.forEach(({ ds, isFuture, isToday, adj }) => {
      const s = gc(hb.id, ds);
      const sc2 = s === 'dn' ? 'dn' : s === 'dn_late' ? 'dn_late' : s === 'ms' ? 'ms' : s === 'pt' ? 'pt' : '';
      const ic = (s === 'dn' || s === 'dn_late') ? '✓' : s === 'ms' ? '✗' : s === 'pt' ? '~' : '';
      const sep = adj === 6 ? 'wsp' : '';
      // Version-aware tooltip
      const tip = !isFuture ? getCellTooltip(hb.id, ds) : '';
      tbl += `<td class="mxc ${isFuture ? 'fut' : ''} ${sep} ${tip ? 'mx-cell-tip' : ''}" id="cell-${hb.id}-${ds.replace(/-/g,'')}" ${tip ? `data-tip="${tip}"` : ''} ${!isFuture ? `onclick="clickCell('${hb.id}','${ds}',this)"` : ''}><div class="ci ${sc2} ${isToday ? 'tc2' : ''} ${isFuture ? 'fut' : ''}">${ic}</div></td>`;
    });
    const rc = hs.rate >= 80 ? 'var(--green)' : hs.rate >= 60 ? 'var(--plite)' : '#f87171';
    tbl += `<td class="mst"><div class="msv">${hs.rate}%</div><div style="width:55px;height:3px;background:rgba(148,163,184,.1);border-radius:2px;margin-top:3px;margin-left:auto"><div style="height:100%;width:${hs.rate}%;background:${rc};border-radius:2px"></div></div></td>`;
    tbl += `<td class="mst"><div class="msv">${hs.streak}🔥</div><div class="msl">streak</div></td></tr>`;
  });

  tbl += '<tr class="mtr"><td class="mnc" style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--t3)">TOTAL ✓</td>';
  days.forEach(({ ds, isFuture, adj }) => {
    let cnt = 0; if (!isFuture) h.forEach(hb => { if (gc(hb.id, ds) === 'dn') cnt++; });
    const pct = h.length > 0 ? Math.round((cnt / h.length) * 100) : 0;
    const c = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--plite)' : pct > 0 ? 'var(--amber)' : 'var(--t3)';
    const sep = adj === 6 ? 'wsp' : '';
    tbl += `<td class="mdt ${sep}" style="color:${!isFuture && cnt > 0 ? c : 'var(--t3)'};">${!isFuture ? cnt : ''}</td>`;
  });
  tbl += '<td></td><td></td></tr></tbody></table>';
  document.getElementById('mx-container').innerHTML = tbl;
  rMxSummary(days, h);
}

// ────────────────────────────────────────────────────────────────
//  BOOT — override globals after load
// ────────────────────────────────────────────────────────────────
(function bootVersioning() {
  // Wait until DOM + inline script are fully ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _installVersioning);
  } else {
    _installVersioning();
  }
})();

function clickCellVersioned(hid, ds, el) {
  const todayStr = fd(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = fd(yesterday);

  if (ds === todayStr) {
    // Today: cycle empty → dn → pt → ms → empty
    const cur = gc(hid, ds);
    const next = cur === '' ? 'dn' : cur === 'dn' ? 'pt' : cur === 'pt' ? 'ms' : '';
    scVersioned(hid, ds, next);
    syncMatrixCellUI(el, next, ds);
    if (next === 'ms') showMissModal(hid, ds);
  } else if (ds === yesterdayStr) {
    // Yesterday (backfill window): empty → dn_late → pt → ms → empty
    const cur = gc(hid, ds);
    let next = '';
    if (cur === '') next = 'dn_late';
    else if (cur === 'dn_late') next = 'pt';
    else if (cur === 'pt') next = 'ms';
    else if (cur === 'ms') next = '';
    
    scVersioned(hid, ds, next);
    syncMatrixCellUI(el, next, ds);
    if (next === 'ms') showMissModal(hid, ds);
  } else {
    // Older than yesterday: require reason via audit modal
    const cur = gc(hid, ds);
    let next = '';
    if (cur === '') next = 'dn';
    else if (cur === 'dn' || cur === 'dn_late') next = 'pt';
    else if (cur === 'pt') next = 'ms';
    else if (cur === 'ms') next = '';

    openAuditModal(hid, ds, next);
  }
}

function syncMatrixCellUI(el, next, ds) {
  const inner = el.querySelector('.ci');
  if (!inner) return;
  inner.className = 'ci' + (ds === ts() ? ' tc2' : '');
  
  if (next === 'dn') {
    inner.classList.add('dn');
    inner.textContent = '✓';
  } else if (next === 'dn_late') {
    inner.classList.add('dn_late');
    inner.textContent = '✓';
  } else if (next === 'ms') {
    inner.classList.add('ms');
    inner.textContent = '✗';
  } else if (next === 'pt') {
    inner.classList.add('pt');
    inner.textContent = '~';
  } else {
    inner.textContent = '';
  }
  
  if (typeof updateDayTotal === 'function') {
    updateDayTotal(ds);
  }
  
  const hid = hidFromCell(el);
  const hb = S.habits.find(x => x.id === hid);
  const lb = { dn: '✅ Done', dn_late: '🕒 Done Late', ms: '❌ Missed', pt: '🟡 Partial', '': '⚫ Cleared' };
  toast(`${hb ? hb.name : 'Habit'} → ${lb[next] || 'Updated'}`, (next === 'dn' || next === 'dn_late') ? 'success' : 'info');
  
  if (typeof rMxSummary === 'function') {
    rMxSummary(null, S.habits);
  }
}

function hidFromCell(el) {
  const parts = el.id.split('-');
  return parts.slice(1, parts.length - 1).join('-');
}

function openAuditModal(hid, ds, val) {
  const modal = document.getElementById('m-audit');
  if (!modal) return;
  document.getElementById('audit-hid').value = hid;
  document.getElementById('audit-ds').value = ds;
  document.getElementById('audit-val').value = val;
  document.getElementById('audit-comment').value = '';
  document.getElementById('audit-reason').value = 'Forgot To Log';
  modal.classList.remove('hid');
}

function closeAuditModal() {
  const modal = document.getElementById('m-audit');
  if (modal) modal.classList.add('hid');
}

function saveAuditChange() {
  const hid = document.getElementById('audit-hid').value;
  const ds = document.getElementById('audit-ds').value;
  const val = document.getElementById('audit-val').value;
  const reason = document.getElementById('audit-reason').value;
  const comment = document.getElementById('audit-comment').value.trim();

  const oldVal = gc(hid, ds);
  sc(hid, ds, val);
  
  // Record audit log entry
  const hb = S.habits.find(x => x.id === hid);
  const logEntry = {
    id: 'al_' + Date.now(),
    timestamp: new Date().toISOString(),
    habitId: hid,
    habitName: hb ? hb.name : 'Unknown',
    targetDate: ds,
    oldValue: oldVal,
    newValue: val,
    reason: reason,
    comment: comment
  };
  S.auditLog = S.auditLog || [];
  S.auditLog.unshift(logEntry);
  save();
  
  closeAuditModal();
  
  const cellId = `cell-${hid}-${ds.replace(/-/g,'')}`;
  const cellEl = document.getElementById(cellId);
  if (cellEl) {
    syncMatrixCellUI(cellEl, val, ds);
  } else {
    rMatrix();
  }
  
  toast('Audit reason logged and change saved!', 'success');
}

function _installVersioning() {
  // Migrate existing data
  verEnsureData();

  // Override global functions with versioned variants
  window.openHabitModal     = openHabitModalVersioned;
  window.saveHabit          = saveHabitVersioned;
  window.sc                 = scVersioned;
  window.renderHabits       = renderHabitsVersioned;
  window.rMatrix            = rMatrixVersioned;
  window.clickCell          = clickCellVersioned;

  // Expose new globals
  window.openHabitDetail    = openHabitDetail;
  window.closeHabitDetail   = closeHabitDetail;
  window.setHabitEditScope  = setHabitEditScope;
  window.verEnsureData      = verEnsureData;
  window.getHabitDisplayForDate = getHabitDisplayForDate;
  window.getCellTooltip     = getCellTooltip;
  window.getVersionForDate  = getVersionForDate;
  window.getActiveVersion   = getActiveVersion;
  window.getVersionStats    = getVersionStats;
  
  // Audit modal functions
  window.openAuditModal     = openAuditModal;
  window.closeAuditModal    = closeAuditModal;
  window.saveAuditChange    = saveAuditChange;
}
