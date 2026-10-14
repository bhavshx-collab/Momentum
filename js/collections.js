/**
 * collections.js — Habit Collections System for Momentum
 * Temporary, time-bound habit folders with their own tracking, analytics, and lifecycle.
 */

const COL_DURATION_PRESETS = [
  { label: '3 Days', days: 3 }, { label: '7 Days', days: 7 },
  { label: '14 Days', days: 14 }, { label: '21 Days', days: 21 },
  { label: '30 Days', days: 30 }, { label: '60 Days', days: 60 }, { label: '90 Days', days: 90 },
];
const COL_ICONS = ['📁','🏋️','📚','🎯','💻','🌱','🔥','⚡','🚀','🎮','✈️','🏠','📖','🕌','💪','🧘','🎨','🎵','🌍','💰','🧘','🎓','🏃','🥗'];
const COL_COLORS = ['#ef4444','#f97316','#f59e0b','#84cc16','#10b981','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#6366f1'];
const COL_WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

let _colPage = 'list';
let _colDetailId = null;
let _colAnalyticsId = null;
let _colModalHabits = [];
let _colModalIcon = '📁';
let _colModalColor = '#8b5cf6';

// ── STATE HELPERS ──────────────────────────────────────────────────────────────

function getCollections() {
  if (!S.collections) S.collections = [];
  return S.collections;
}
function getCollection(id) { return getCollections().find(c => c.id === id); }

// ── LIFECYCLE ENGINE ───────────────────────────────────────────────────────────

function colStatus(col) {
  if (col.status === 'archived') return 'archived';
  const t = ts();
  if (t < col.startDate) return 'scheduled';
  if (t <= col.endDate) return 'active';
  return 'completed';
}

function isColScheduled(ch, ds) {
  switch (ch.scheduleType) {
    case 'weekdays': { const d = new Date(ds + 'T00:00:00').getDay(); return (ch.scheduleDays || [1,2,3,4,5]).includes(d); }
    case 'specific_dates': return (ch.specificDates || []).includes(ds);
    default: return true;
  }
}

function processCollectionsLifecycle() {
  const cols = getCollections();
  const todayStr = ts();
  const now = new Date();
  const autoClose = (S.habitStatusSettings && S.habitStatusSettings.autoCloseTime) || '23:59';
  const [ch, cm] = autoClose.split(':').map(Number);
  const pastClose = now.getHours() > ch || (now.getHours() === ch && now.getMinutes() >= cm);
  let changed = false;

  cols.forEach(col => {
    const ns = colStatus(col);
    if (col.status !== 'archived' && col.status !== ns) { col.status = ns; changed = true; }

    col.habits.forEach(habit => {
      // Auto-miss past days
      let d = new Date(col.startDate + 'T00:00:00');
      const yd = new Date(now); yd.setDate(yd.getDate() - 1);
      const rangeEnd = col.endDate < todayStr ? new Date(col.endDate + 'T00:00:00') : yd;

      while (d <= rangeEnd) {
        const ds = fd(d);
        const key = habit.id + '_' + ds;
        if (!col.completions[key] && isColScheduled(habit, ds)) {
          col.completions[key] = 'ms';
          changed = true;
        }
        d.setDate(d.getDate() + 1);
      }

      // Auto-miss today if past close time
      if (pastClose && col.status === 'active') {
        const key = habit.id + '_' + todayStr;
        if (!col.completions[key] && isColScheduled(habit, todayStr)) {
          col.completions[key] = 'ms';
          changed = true;
        }
      }
    });
  });

  if (changed) save();
}

// ── ANALYTICS HELPERS ──────────────────────────────────────────────────────────

function colHabitStats(col, ch) {
  const t = ts();
  let completed = 0, partial = 0, missed = 0, pending = 0;
  let d = new Date(col.startDate + 'T00:00:00');
  const end = new Date(col.endDate + 'T00:00:00');
  while (d <= end) {
    const ds = fd(d);
    if (isColScheduled(ch, ds)) {
      if (ds > t) { pending++; }
      else {
        const v = col.completions[ch.id + '_' + ds] || '';
        if (v === 'dn' || v === 'dn_late') completed++;
        else if (v === 'pt') partial++;
        else if (v === 'ms') missed++;
        else pending++;
      }
    }
    d.setDate(d.getDate() + 1);
  }
  const tracked = completed + partial + missed;
  const rate = tracked > 0 ? Math.round(((completed + partial * 0.5) / tracked) * 100) : 0;
  // Streak
  let streak = 0;
  const dates = [];
  let dd = new Date(col.startDate + 'T00:00:00');
  while (dd <= end) { const ds = fd(dd); if (isColScheduled(ch, ds) && ds <= t) dates.push(ds); dd.setDate(dd.getDate() + 1); }
  for (let i = dates.length - 1; i >= 0; i--) {
    const v = col.completions[ch.id + '_' + dates[i]] || '';
    if (v === 'dn' || v === 'dn_late' || v === 'pt') streak++;
    else break;
  }
  return { completed, partial, missed, pending, tracked, rate, streak };
}

function colOverallStats(col) {
  const t = ts();
  let totalCompleted = 0, totalPartial = 0, totalMissed = 0;
  col.habits.forEach(ch => {
    const s = colHabitStats(col, ch);
    totalCompleted += s.completed; totalPartial += s.partial; totalMissed += s.missed;
  });
  const tracked = totalCompleted + totalPartial + totalMissed;
  const rate = tracked > 0 ? Math.round(((totalCompleted + totalPartial * 0.5) / tracked) * 100) : 0;

  const startD = new Date(col.startDate + 'T00:00:00');
  const endD = new Date(col.endDate + 'T00:00:00');
  const todayD = new Date(t + 'T00:00:00');
  const total = Math.floor((endD - startD) / 86400000) + 1;
  const elapsed = Math.max(0, Math.min(Math.floor((todayD - startD) / 86400000) + 1, total));
  const remaining = Math.max(0, Math.floor((endD - todayD) / 86400000));

  let todayDone = 0, todayTotal = 0;
  if (t >= col.startDate && t <= col.endDate) {
    col.habits.forEach(ch => {
      if (!isColScheduled(ch, t)) return;
      todayTotal++;
      const v = col.completions[ch.id + '_' + t] || '';
      if (v === 'dn' || v === 'dn_late') todayDone++;
    });
  }

  // Streak: consecutive days >= 1 done
  let colStreak = 0;
  let sdx = new Date(todayD);
  while (sdx >= startD) {
    const ds = fd(sdx);
    let dayDone = 0, dayTotal = 0;
    col.habits.forEach(ch => { if (!isColScheduled(ch, ds)) return; dayTotal++; const v = col.completions[ch.id + '_' + ds] || ''; if (v === 'dn' || v === 'dn_late') dayDone++; });
    if (dayTotal > 0 && dayDone >= 1) colStreak++;
    else if (dayTotal > 0) break;
    sdx.setDate(sdx.getDate() - 1);
  }

  return { rate, total, elapsed, remaining, todayDone, todayTotal, colStreak, totalCompleted, totalPartial, totalMissed, tracked };
}

// ── RENDER: MAIN PAGE ──────────────────────────────────────────────────────────

function renderCollections() {
  processCollectionsLifecycle();
  if (_colPage === 'detail' && _colDetailId) renderCollectionDetail(_colDetailId);
  else if (_colPage === 'analytics' && _colAnalyticsId) renderCollectionAnalytics(_colAnalyticsId);
  else renderCollectionsList();
}

function renderCollectionsList() {
  const el = document.getElementById('page-collections');
  if (!el) return;
  const cols = getCollections();
  const active    = cols.filter(c => c.status === 'active');
  const scheduled = cols.filter(c => c.status === 'scheduled');
  const completed = cols.filter(c => c.status === 'completed');
  const archived  = cols.filter(c => c.status === 'archived');

  const sectionHtml = (label, items) => items.length === 0 ? '' : `
    <div class="col-section-lbl">${label}</div>
    <div class="col-grid">${items.map(c => colCard(c)).join('')}</div>
  `;

  el.innerHTML = `
    <div class="col-page-hdr">
      <div><div class="stit">📁 Habit Collections</div><div class="ssub">Temporary habit challenges with custom tracking periods</div></div>
      <button class="btn bp" onclick="openCollectionModal()">+ Create Collection</button>
    </div>
    ${cols.length === 0 ? `
      <div class="col-empty">
        <div style="font-size:56px;opacity:.35;margin-bottom:16px">📁</div>
        <div style="font-size:17px;font-weight:700;margin-bottom:8px">No Collections Yet</div>
        <div style="color:var(--t2);font-size:13px;margin-bottom:20px;max-width:340px;text-align:center">
          Create a 7-Day Discipline Challenge, a 30-Day Fitness Sprint, or any goal-driven habit group tracked for a set period.
        </div>
        <button class="btn bp" onclick="openCollectionModal()">✨ Create Your First Collection</button>
      </div>
    ` : `
      ${sectionHtml('🔥 Active', active)}
      ${sectionHtml('⏳ Scheduled', scheduled)}
      ${sectionHtml('✅ Completed', completed)}
      ${archived.length > 0 ? `<div style="opacity:.6">${sectionHtml('📦 Archived', archived)}</div>` : ''}
    `}
  `;
}

function colCard(col) {
  const s = colOverallStats(col);
  const pct = Math.min(100, Math.round((s.elapsed / s.total) * 100));
  const badge = { active:'<span class="col-badge col-active">Active</span>', scheduled:'<span class="col-badge col-sched">Scheduled</span>', completed:'<span class="col-badge col-done">Completed</span>', archived:'<span class="col-badge col-arch">Archived</span>' }[col.status] || '';
  return `
    <div class="col-card" onclick="viewCollectionDetail('${col.id}')">
      <div class="col-card-hdr">
        <div class="col-card-ico" style="background:${col.color}22;color:${col.color}">${col.icon}</div>
        <div style="flex:1;min-width:0">
          <div class="col-card-name">${col.name}</div>
          ${col.description ? `<div class="col-card-desc">${col.description}</div>` : ''}
        </div>
        ${badge}
      </div>
      <div class="col-card-meta"><span>📅 ${fDisp(col.startDate)} → ${fDisp(col.endDate)}</span><span>Day ${s.elapsed}/${s.total}</span></div>
      <div class="col-pbar"><div class="col-pbar-fill" style="width:${pct}%;background:${col.color}"></div></div>
      <div class="col-card-stats4">
        <div class="col-cs"><div class="col-cs-v" style="color:${col.color}">${s.rate}%</div><div class="col-cs-l">Rate</div></div>
        <div class="col-cs"><div class="col-cs-v">${col.habits.length}</div><div class="col-cs-l">Habits</div></div>
        <div class="col-cs"><div class="col-cs-v">${s.remaining}</div><div class="col-cs-l">Left</div></div>
        <div class="col-cs"><div class="col-cs-v">${s.colStreak}🔥</div><div class="col-cs-l">Streak</div></div>
      </div>
      ${col.status === 'active' ? `
        <div class="col-card-today">
          <span style="color:var(--t2);font-size:11px">Today: ${s.todayDone}/${s.todayTotal} done</span>
          <button class="btn bs btn-sm" onclick="event.stopPropagation();viewCollectionDetail('${col.id}')">Check In →</button>
        </div>` : ''}
      <div class="col-card-acts" onclick="event.stopPropagation()">
        ${col.status === 'active' || col.status === 'scheduled' ? `<button class="btn bg btn-sm" onclick="openExtendModal('${col.id}')">⏱ Extend</button><button class="btn bg btn-sm" onclick="openCollectionModal('${col.id}')">✏️ Edit</button>` : ''}
        ${col.status === 'completed' ? `<button class="btn bg btn-sm" onclick="openExtendModal('${col.id}')">🔄 Reopen</button><button class="btn bg btn-sm" onclick="duplicateCollection('${col.id}')">📋 Duplicate</button>` : ''}
        <button class="btn bg btn-sm" onclick="viewCollectionAnalytics('${col.id}')">📊 Stats</button>
        ${col.status !== 'archived' ? `<button class="btn bg btn-sm" onclick="archiveCollection('${col.id}')">📦</button>` : `<button class="btn bd btn-sm" onclick="deleteCollection('${col.id}')">🗑️</button>`}
      </div>
    </div>`;
}

// ── RENDER: DETAIL ─────────────────────────────────────────────────────────────

function viewCollectionDetail(id) { _colPage = 'detail'; _colDetailId = id; renderCollections(); }

function renderCollectionDetail(id) {
  const col = getCollection(id);
  if (!col) { backToCollections(); return; }
  const el = document.getElementById('page-collections');
  if (!el) return;
  const s = colOverallStats(col);
  const t = ts();
  const badge = { active:'<span class="col-badge col-active">Active</span>', scheduled:'<span class="col-badge col-sched">Scheduled</span>', completed:'<span class="col-badge col-done">Completed</span>', archived:'<span class="col-badge col-arch">Archived</span>' }[col.status] || '';

  const todayHabits = t >= col.startDate && t <= col.endDate
    ? col.habits.filter(ch => isColScheduled(ch, t))
    : [];

  const checklist = todayHabits.length > 0 ? `
    <div class="col-sec-card">
      <div class="col-sec-title">📋 Today's Checklist <span style="font-size:11px;color:var(--t3);font-weight:400">${s.todayDone}/${s.todayTotal} done</span></div>
      ${todayHabits.map(ch => {
        const v = col.completions[ch.id + '_' + t] || '';
        const done = v === 'dn' || v === 'dn_late';
        const statusLabel = v === 'dn' ? '✅ Done' : v === 'dn_late' ? '🟡 Late' : v === 'ms' ? '❌ Missed' : v === 'pt' ? '🟡 Partial' : '⏳ Pending';
        return `<div class="col-check-row ${done ? 'done' : ''}" onclick="toggleColHabit('${col.id}','${ch.id}','${t}')">
          <div class="col-chk ${done ? 'done' : ''}">${done ? '✓' : ''}</div>
          <span style="font-size:18px">${ch.icon}</span>
          <div style="flex:1;font-size:13px;font-weight:600">${ch.name}</div>
          <span style="font-size:11px;color:var(--t3)">${statusLabel}</span>
        </div>`;
      }).join('')}
    </div>` : '';

  el.innerHTML = `
    <div class="col-det-hdr">
      <button class="btn bg btn-sm" onclick="backToCollections()">← Back</button>
      <div style="flex:1"></div>
      ${col.status === 'active' || col.status === 'scheduled' ? `<button class="btn bg btn-sm" onclick="openExtendModal('${col.id}')">⏱ Extend</button><button class="btn bg btn-sm" onclick="openCollectionModal('${col.id}')">✏️ Edit</button>` : ''}
      <button class="btn bs btn-sm" onclick="viewCollectionAnalytics('${col.id}')">📊 Analytics</button>
      <button class="btn bg btn-sm" onclick="duplicateCollection('${col.id}')">📋 Duplicate</button>
    </div>

    <div class="col-det-hero">
      <div class="col-det-ico" style="background:${col.color}22;color:${col.color}">${col.icon}</div>
      <div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="font-size:22px;font-weight:800">${col.name}</span>${badge}</div>
        ${col.description ? `<div style="color:var(--t2);font-size:12px;margin-top:4px">${col.description}</div>` : ''}
        <div style="color:var(--t3);font-size:12px;margin-top:6px">📅 ${fDisp(col.startDate)} → ${fDisp(col.endDate)}</div>
      </div>
    </div>

    <div class="col-stat-g6">
      ${[
        [s.rate + '%', 'Completion', col.color],
        [s.elapsed, 'Day Elapsed', ''],
        [s.remaining, 'Days Left', ''],
        [s.colStreak + '🔥', 'Streak', ''],
        [s.todayDone + '/' + s.todayTotal, "Today", ''],
        [col.habits.length, 'Habits', ''],
      ].map(([v, l, c]) => `<div class="col-detail-stat"><div class="col-ds-v" ${c ? `style="color:${c}"` : ''}>${v}</div><div class="col-ds-l">${l}</div></div>`).join('')}
    </div>

    ${checklist}

    <div class="col-sec-card">
      <div class="col-sec-title">📊 Habit Matrix</div>
      <div class="col-sec-sub">Click cells to cycle status · Only scheduled dates shown</div>
      <div style="overflow-x:auto">${buildColMatrix(col)}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
        ${[['done','rgba(34,197,94,.25)','rgba(34,197,94,.6)','Done'],['partial','rgba(245,158,11,.2)','rgba(245,158,11,.5)','Partial'],['missed','rgba(239,68,68,.15)','rgba(239,68,68,.5)','Missed'],['','rgba(148,163,184,.06)','rgba(148,163,184,.2)','Pending']].map(([,bg,bdr,lbl]) =>
          `<div style="display:flex;align-items:center;gap:5px"><div style="width:11px;height:11px;border-radius:3px;background:${bg};border:1.5px solid ${bdr}"></div><span style="font-size:10px;color:var(--t3)">${lbl}</span></div>`
        ).join('')}
      </div>
    </div>

    <div class="col-sec-card">
      <div class="col-sec-title">🏃 Per-Habit Performance</div>
      ${col.habits.map(ch => {
        const hs = colHabitStats(col, ch);
        const sched = ch.scheduleType === 'weekdays' ? (ch.scheduleDays || []).map(d => COL_WD[d]).join(', ') : ch.scheduleType === 'specific_dates' ? 'Specific dates' : 'Every day';
        return `<div class="col-habit-row">
          <span style="font-size:18px">${ch.icon}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600">${ch.name}</div>
            <div style="font-size:10px;color:var(--t3)">${sched} · Streak: ${hs.streak}🔥</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:14px;font-weight:700;color:${col.color}">${hs.rate}%</div>
            <div style="font-size:10px;color:var(--t3)">✓${hs.completed} ✗${hs.missed}</div>
          </div>
        </div>
        <div style="margin:-4px 0 10px;height:4px;background:rgba(148,163,184,.08);border-radius:2px">
          <div style="height:100%;width:${hs.rate}%;background:${hs.rate >= 80 ? '#4ade80' : hs.rate >= 50 ? col.color : '#f87171'};border-radius:2px"></div>
        </div>`;
      }).join('')}
    </div>
  `;
}

function buildColMatrix(col) {
  if (!col.habits.length) return '<div style="padding:20px;text-align:center;color:var(--t3)">No habits in this collection.</div>';
  const todayStr = ts();

  // All dates in the collection period
  const allDates = [];
  let dc = new Date(col.startDate + 'T00:00:00');
  const endD = new Date(col.endDate + 'T00:00:00');
  while (dc <= endD) { allDates.push(fd(dc)); dc.setDate(dc.getDate() + 1); }
  // Show last 28 if too many
  const dates = allDates.length > 28 ? allDates.slice(-28) : allDates;

  const headers = dates.map(ds => {
    const d = new Date(ds + 'T00:00:00');
    const isToday = ds === todayStr;
    return `<th class="col-mth${isToday ? ' col-mth-today' : ''}" title="${ds}"><div>${d.getDate()}</div><div style="font-size:8px;opacity:.55">${COL_WD[d.getDay()]}</div></th>`;
  }).join('');

  const rows = col.habits.map(ch => {
    const hs = colHabitStats(col, ch);
    const cells = dates.map(ds => {
      const isFuture = ds > todayStr;
      const scheduled = isColScheduled(ch, ds) && ds >= col.startDate && ds <= col.endDate;
      if (!scheduled) return `<td><div class="col-mcell unsch"></div></td>`;
      const v = col.completions[ch.id + '_' + ds] || '';
      let cls = '', lbl = '';
      if (v === 'dn' || v === 'dn_late') { cls = 'done'; lbl = '✓'; }
      else if (v === 'pt') { cls = 'partial'; lbl = '◑'; }
      else if (v === 'ms') { cls = 'missed'; lbl = '✗'; }
      const clickable = isFuture ? '' : `onclick="cycleColHabit('${col.id}','${ch.id}','${ds}')" style="cursor:pointer"`;
      return `<td><div class="col-mcell ${cls}" ${clickable}>${lbl}</div></td>`;
    }).join('');
    return `<tr>
      <td class="col-mname" title="${ch.name}"><span style="font-size:13px">${ch.icon}</span> <span style="font-size:11px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle">${ch.name}</span></td>
      ${cells}
      <td class="col-mrate" style="color:${col.color}">${hs.rate}%</td>
    </tr>`;
  }).join('');

  return `<table class="col-mx"><thead><tr><th class="col-mname-h">Habit</th>${headers}<th class="col-mrate-h">Rate</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ── COMPLETION ACTIONS ─────────────────────────────────────────────────────────

function toggleColHabit(colId, habitId, ds) {
  const col = getCollection(colId);
  if (!col) return;
  const key = habitId + '_' + ds;
  col.completions[key] = col.completions[key] === 'dn' ? '' : 'dn';
  save();
  renderCollections();
  toast(col.completions[key] === 'dn' ? '✅ Done!' : '↩️ Unmarked', 'success');
}

function cycleColHabit(colId, habitId, ds) {
  const col = getCollection(colId);
  if (!col) return;
  const key = habitId + '_' + ds;
  const cur = col.completions[key] || '';
  col.completions[key] = cur === '' ? 'dn' : cur === 'dn' ? 'pt' : cur === 'pt' ? 'ms' : '';
  save();
  renderCollections();
}

// ── ANALYTICS ─────────────────────────────────────────────────────────────────

function viewCollectionAnalytics(id) { _colPage = 'analytics'; _colAnalyticsId = id; renderCollections(); }

function renderCollectionAnalytics(id) {
  const col = getCollection(id);
  if (!col) { backToCollections(); return; }
  const el = document.getElementById('page-collections');
  if (!el) return;
  const s = colOverallStats(col);
  const t = ts();
  const hStats = col.habits.map(ch => ({ ch, hs: colHabitStats(col, ch) })).sort((a, b) => b.hs.rate - a.hs.rate);
  const best  = hStats[0];
  const worst = hStats[hStats.length - 1];

  // Daily trend – last 14 scheduled days
  const trendDays = [];
  let td = new Date(); td.setDate(td.getDate() - 13);
  for (let i = 0; i < 14; i++) {
    const ds = fd(td);
    if (ds >= col.startDate && ds <= col.endDate && ds <= t) {
      let done = 0, tot = 0;
      col.habits.forEach(ch => { if (!isColScheduled(ch, ds)) return; tot++; const v = col.completions[ch.id + '_' + ds] || ''; if (v === 'dn' || v === 'dn_late') done++; });
      trendDays.push({ ds, rate: tot > 0 ? Math.round((done / tot) * 100) : 0, day: td.getDate() });
    }
    td.setDate(td.getDate() + 1);
  }

  const badge = { active:'<span class="col-badge col-active">Active</span>', scheduled:'<span class="col-badge col-sched">Scheduled</span>', completed:'<span class="col-badge col-done">Completed</span>', archived:'<span class="col-badge col-arch">Archived</span>' }[col.status] || '';

  el.innerHTML = `
    <div class="col-det-hdr">
      <button class="btn bg btn-sm" onclick="viewCollectionDetail('${col.id}')">← Detail</button>
      <button class="btn bg btn-sm" onclick="backToCollections()" style="margin-left:4px">↑ All</button>
    </div>

    <div class="col-det-hero">
      <div class="col-det-ico" style="background:${col.color}22;color:${col.color};width:48px;height:48px;font-size:22px">${col.icon}</div>
      <div>
        <div style="display:flex;align-items:center;gap:8px"><span style="font-size:20px;font-weight:800">${col.name}</span>${badge}</div>
        <div style="color:var(--t3);font-size:12px">📅 ${fDisp(col.startDate)} → ${fDisp(col.endDate)} · ${s.total} day${s.total !== 1 ? 's' : ''}</div>
      </div>
    </div>

    ${col.status === 'completed' ? `
      <div class="col-sec-card" style="background:linear-gradient(135deg,rgba(139,92,246,.1),rgba(99,102,241,.07));border-color:rgba(139,92,246,.2)">
        <div class="col-sec-title">🏆 Final Report</div>
        <div class="col-final-row">
          <div class="col-final-item"><div style="font-size:26px;font-weight:800;color:${col.color}">${s.rate}%</div><div style="color:var(--t2);font-size:11px">Completion</div></div>
          <div class="col-final-item"><div style="font-size:26px;font-weight:800;color:#4ade80">${s.totalCompleted}</div><div style="color:var(--t2);font-size:11px">Completed</div></div>
          <div class="col-final-item"><div style="font-size:26px;font-weight:800;color:#fbbf24">${s.totalPartial}</div><div style="color:var(--t2);font-size:11px">Partial</div></div>
          <div class="col-final-item"><div style="font-size:26px;font-weight:800;color:#f87171">${s.totalMissed}</div><div style="color:var(--t2);font-size:11px">Missed</div></div>
        </div>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;font-size:12px">
          ${best ? `<div>🏆 Best Habit: <strong>${best.ch.icon} ${best.ch.name}</strong> — ${best.hs.rate}%</div>` : ''}
          ${worst && worst !== best ? `<div>⚠️ Needs Work: <strong>${worst.ch.icon} ${worst.ch.name}</strong> — ${worst.hs.rate}%</div>` : ''}
          <div>🔥 Longest Streak: <strong>${s.colStreak} days</strong></div>
        </div>
      </div>` : ''}

    <div class="col-analytics-2col">
      <div class="col-sec-card">
        <div class="col-sec-title">📊 Overall</div>
        <div class="col-mini-stats">
          <div class="col-ms"><div style="font-size:20px;font-weight:800;color:${col.color}">${s.rate}%</div><div class="col-stat-lbl">Rate</div></div>
          <div class="col-ms"><div style="font-size:20px;font-weight:800;color:#4ade80">${s.totalCompleted}</div><div class="col-stat-lbl">Done</div></div>
          <div class="col-ms"><div style="font-size:20px;font-weight:800;color:#fbbf24">${s.totalPartial}</div><div class="col-stat-lbl">Partial</div></div>
          <div class="col-ms"><div style="font-size:20px;font-weight:800;color:#f87171">${s.totalMissed}</div><div class="col-stat-lbl">Missed</div></div>
        </div>
      </div>
      <div class="col-sec-card">
        <div class="col-sec-title">📅 Progress</div>
        <div class="col-mini-stats">
          <div class="col-ms"><div style="font-size:20px;font-weight:800">Day ${s.elapsed}</div><div class="col-stat-lbl">of ${s.total}</div></div>
          <div class="col-ms"><div style="font-size:20px;font-weight:800">${s.remaining}</div><div class="col-stat-lbl">Remaining</div></div>
          <div class="col-ms"><div style="font-size:20px;font-weight:800;color:#fbbf24">${s.colStreak}🔥</div><div class="col-stat-lbl">Streak</div></div>
          <div class="col-ms"><div style="font-size:20px;font-weight:800">${col.habits.length}</div><div class="col-stat-lbl">Habits</div></div>
        </div>
      </div>
    </div>

    <div class="col-sec-card">
      <div class="col-sec-title">🏃 Per-Habit Performance</div>
      ${hStats.map(({ ch, hs }) => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <span style="font-size:16px">${ch.icon}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600">${ch.name}</div>
            <div style="font-size:10px;color:var(--t3)">✓${hs.completed} ◑${hs.partial} ✗${hs.missed} · Streak: ${hs.streak}🔥</div>
          </div>
          <div style="font-size:14px;font-weight:700;color:${hs.rate >= 80 ? '#4ade80' : hs.rate >= 50 ? col.color : '#f87171'};min-width:38px;text-align:right">${hs.rate}%</div>
        </div>
        <div style="margin-bottom:10px;height:5px;background:rgba(148,163,184,.08);border-radius:3px">
          <div style="height:100%;width:${hs.rate}%;background:${hs.rate >= 80 ? '#4ade80' : hs.rate >= 50 ? col.color : '#f87171'};border-radius:3px"></div>
        </div>
      `).join('')}
    </div>

    ${trendDays.length > 1 ? `
      <div class="col-sec-card">
        <div class="col-sec-title">📈 Daily Trend (Last 14 Days)</div>
        <div style="display:flex;align-items:flex-end;gap:4px;height:80px;margin-top:12px">
          ${trendDays.map(({ day, rate }) => {
            const h = Math.max(4, Math.round(rate * 0.72));
            const c = rate >= 80 ? '#4ade80' : rate >= 50 ? col.color : rate > 0 ? '#f59e0b' : 'rgba(148,163,184,.12)';
            return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:3px">
              <div style="font-size:8px;color:var(--t3)">${rate}%</div>
              <div style="width:100%;max-width:22px;height:${h}px;background:${c};border-radius:3px;opacity:.9"></div>
              <div style="font-size:8px;color:var(--t3)">${day}</div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

    ${col.extensions && col.extensions.length > 0 ? `
      <div class="col-sec-card">
        <div class="col-sec-title">⏱ Extension History</div>
        ${col.extensions.map(e => `
          <div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px">
            <span style="font-size:16px">📅</span>
            <div style="flex:1">
              <div style="font-weight:600">+${e.days} days extended</div>
              <div style="color:var(--t3);font-size:10px">${fDisp(e.previousEnd)} → ${fDisp(e.newEnd)} · on ${fDisp(e.extendedAt)}</div>
            </div>
          </div>`).join('')}
      </div>` : ''}
  `;
}

// ── NAVIGATION ─────────────────────────────────────────────────────────────────

function backToCollections() { _colPage = 'list'; _colDetailId = null; _colAnalyticsId = null; renderCollections(); }

// ── CREATE/EDIT MODAL ──────────────────────────────────────────────────────────

function openCollectionModal(editId = null) {
  const ex = editId ? getCollection(editId) : null;
  _colModalHabits = ex ? JSON.parse(JSON.stringify(ex.habits)) : [];
  _colModalIcon   = ex ? ex.icon  : '📁';
  _colModalColor  = ex ? ex.color : '#8b5cf6';

  document.getElementById('col-eid').value = editId || '';
  document.getElementById('col-m-title').textContent = ex ? '✏️ Edit Collection' : '📁 Create Collection';
  document.getElementById('col-name').value  = ex ? ex.name : '';
  document.getElementById('col-desc').value  = ex ? (ex.description || '') : '';
  document.getElementById('col-start').value = ex ? ex.startDate : ts();
  document.getElementById('col-end').value   = ex ? ex.endDate : colAddDays(ts(), 29);

  document.getElementById('col-icons').innerHTML = COL_ICONS.map(ic =>
    `<button type="button" class="ib ${ic === _colModalIcon ? 'sel' : ''}" onclick="selColIcon('${ic}',this)">${ic}</button>`
  ).join('');
  document.getElementById('col-colors').innerHTML = COL_COLORS.map(c =>
    `<div class="sw ${c === _colModalColor ? 'sel' : ''}" style="background:${c}" onclick="selColColor('${c}',this)"></div>`
  ).join('');
  document.getElementById('col-duration-presets').innerHTML = COL_DURATION_PRESETS.map(p =>
    `<button type="button" class="btn bg btn-sm" onclick="colApplyPreset(${p.days})">${p.label}</button>`
  ).join('') + `<button type="button" class="btn bg btn-sm" onclick="colCustomDuration()">Custom</button>`;

  renderColModalHabits();
  document.getElementById('m-collection').classList.remove('hid');
}

function closeCollectionModal() { document.getElementById('m-collection').classList.add('hid'); }

function selColIcon(icon, el) {
  _colModalIcon = icon;
  document.querySelectorAll('#col-icons .ib').forEach(b => b.classList.remove('sel'));
  el.classList.add('sel');
}
function selColColor(color, el) {
  _colModalColor = color;
  document.querySelectorAll('#col-colors .sw').forEach(s => s.classList.remove('sel'));
  el.classList.add('sel');
}
function colApplyPreset(days) {
  const start = document.getElementById('col-start').value || ts();
  document.getElementById('col-end').value = colAddDays(start, days - 1);
}
function colCustomDuration() {
  const v = prompt('Custom duration (days):', '30');
  if (v && !isNaN(parseInt(v)) && parseInt(v) > 0) colApplyPreset(parseInt(v));
}
function colSyncEnd() {
  const s = document.getElementById('col-start').value, e = document.getElementById('col-end').value;
  if (s && e && e < s) document.getElementById('col-end').value = colAddDays(s, 6);
}

function renderColModalHabits() {
  const el = document.getElementById('col-habits-list');
  if (!el) return;
  if (!_colModalHabits.length) { el.innerHTML = '<div style="color:var(--t3);font-size:12px;padding:8px 0">No habits added. Use buttons below to add.</div>'; return; }
  el.innerHTML = _colModalHabits.map((ch, idx) => `
    <div class="col-habit-chip">
      <span style="font-size:16px">${ch.icon}</span>
      <span style="flex:1;font-size:12px;font-weight:600">${ch.name}</span>
      <select class="fsl" style="padding:3px 8px;font-size:11px;width:auto;flex-shrink:0" onchange="colUpdateHabit(${idx},'scheduleType',this.value)">
        <option value="daily" ${ch.scheduleType==='daily'?'selected':''}>Every Day</option>
        <option value="weekdays" ${ch.scheduleType==='weekdays'?'selected':''}>Select Days</option>
        <option value="weekly_target" ${ch.scheduleType==='weekly_target'?'selected':''}>Weekly Target</option>
      </select>
      ${ch.scheduleType === 'weekdays' ? `<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:4px">
        ${[0,1,2,3,4,5,6].map(d => `<button type="button" onclick="colToggleDay(${idx},${d})" style="padding:2px 5px;font-size:9px;border-radius:4px;border:1px solid;cursor:pointer;${(ch.scheduleDays||[]).includes(d)?'background:rgba(139,92,246,.25);color:var(--plite);border-color:rgba(139,92,246,.4)':'background:transparent;color:var(--t3);border-color:var(--border)'}">${COL_WD[d]}</button>`).join('')}
      </div>` : ''}
      ${ch.scheduleType === 'weekly_target' ? `<div style="font-size:11px;color:var(--t3);margin-top:4px">Target: <input type="number" min="1" max="7" value="${ch.weeklyTarget||5}" onchange="colUpdateHabit(${idx},'weeklyTarget',+this.value)" style="width:40px;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:1px 4px;font-size:11px"> days/week</div>` : ''}
      <button type="button" class="btn bd btn-sm" style="flex-shrink:0" onclick="colRemoveHabit(${idx})">✕</button>
    </div>
  `).join('');
}

function colAddExisting() {
  const habits = (S.habits || []).filter(h => h.active !== false);
  if (!habits.length) { toast('No permanent habits found. Create habits first or add a new one below.', 'info'); return; }
  const alreadyIds = new Set(_colModalHabits.map(h => h.sourceHabitId).filter(Boolean));
  const overlay = document.createElement('div');
  overlay.className = 'mo'; overlay.style.zIndex = '600';
  overlay.innerHTML = `
    <div class="mb" style="max-width:400px">
      <div class="mh"><h3>➕ Select Habit</h3><button class="btn bg btn-ico" onclick="this.closest('.mo').remove()">✕</button></div>
      <div class="mbd" style="max-height:380px;overflow-y:auto">
        ${habits.map(h => `<div class="hcr ${alreadyIds.has(h.id)?'':''}\" onclick="${alreadyIds.has(h.id)?'':``colPickHabit('${h.id}');this.closest('.mo').remove()``}" style="${alreadyIds.has(h.id)?'opacity:.4;pointer-events:none':'cursor:pointer'}">
          <span style="font-size:18px">${h.icon}</span>
          <div style="flex:1"><div style="font-weight:600;font-size:13px">${h.name}</div><div style="font-size:10px;color:var(--t3)">${h.category}</div></div>
          ${alreadyIds.has(h.id) ? '<span style="font-size:10px;color:var(--t3)">Added</span>' : '<span style="font-size:18px">→</span>'}
        </div>`).join('')}
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function colPickHabit(habitId) {
  const h = (S.habits || []).find(x => x.id === habitId);
  if (!h) return;
  _colModalHabits.push({
    id: 'ch_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
    name: h.name, icon: h.icon, color: h.color, category: h.category,
    scheduleType: 'daily', scheduleDays: [1,2,3,4,5,6,0], weeklyTarget: 5, specificDates: [],
    sourceHabitId: h.id,
  });
  renderColModalHabits();
  toast(`${h.icon} ${h.name} added`, 'success');
}

function colAddNew() {
  const name = prompt('New habit name:');
  if (!name || !name.trim()) return;
  _colModalHabits.push({
    id: 'ch_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
    name: name.trim(), icon: '🎯', color: _colModalColor, category: 'Personal',
    scheduleType: 'daily', scheduleDays: [1,2,3,4,5,6,0], weeklyTarget: 5, specificDates: [],
    sourceHabitId: null,
  });
  renderColModalHabits();
}

function colRemoveHabit(idx) { _colModalHabits.splice(idx, 1); renderColModalHabits(); }
function colUpdateHabit(idx, key, val) {
  _colModalHabits[idx][key] = val;
  if (key === 'scheduleType' && val === 'weekdays' && !_colModalHabits[idx].scheduleDays) _colModalHabits[idx].scheduleDays = [1,2,3,4,5];
  renderColModalHabits();
}
function colToggleDay(idx, day) {
  const ch = _colModalHabits[idx];
  if (!ch.scheduleDays) ch.scheduleDays = [];
  const i = ch.scheduleDays.indexOf(day);
  if (i >= 0) ch.scheduleDays.splice(i, 1); else ch.scheduleDays.push(day);
  renderColModalHabits();
}

function saveCollectionModal() {
  const name = document.getElementById('col-name').value.trim();
  if (!name) { toast('Name required', 'error'); return; }
  const startDate = document.getElementById('col-start').value;
  const endDate   = document.getElementById('col-end').value;
  if (!startDate || !endDate) { toast('Start and end dates required', 'error'); return; }
  if (endDate < startDate) { toast('End must be after start', 'error'); return; }
  if (!_colModalHabits.length) { toast('Add at least one habit', 'error'); return; }

  const editId = document.getElementById('col-eid').value;
  const existing = editId ? getCollection(editId) : null;
  const status = (() => { const t = ts(); if (t < startDate) return 'scheduled'; if (t <= endDate) return 'active'; return 'completed'; })();

  if (existing) {
    Object.assign(existing, { name, description: document.getElementById('col-desc').value.trim(), icon: _colModalIcon, color: _colModalColor, startDate, endDate, status, habits: _colModalHabits });
    toast('✅ Collection updated!', 'success');
  } else {
    getCollections().push({ id: 'col_' + Date.now(), name, description: document.getElementById('col-desc').value.trim(), icon: _colModalIcon, color: _colModalColor, startDate, endDate, status, habits: _colModalHabits, completions: {}, extensions: [], createdAt: ts() });
    toast('🚀 Collection created!', 'success');
  }
  save();
  closeCollectionModal();
  renderCollections();
}

// ── EXTEND MODAL ───────────────────────────────────────────────────────────────

function openExtendModal(colId) {
  const col = getCollection(colId);
  if (!col) return;
  const ov = document.createElement('div');
  ov.className = 'mo'; ov.id = 'col-extend-ov'; ov.style.zIndex = '600';
  ov.innerHTML = `
    <div class="mb" style="max-width:380px">
      <div class="mh"><h3>⏱ Extend Collection</h3><button class="btn bg btn-ico" onclick="document.getElementById('col-extend-ov').remove()">✕</button></div>
      <div class="mbd">
        <div style="color:var(--t2);font-size:12px;margin-bottom:14px">Current end: <strong>${fDisp(col.endDate)}</strong></div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
          ${[3,7,14,30].map(d => `<button class="btn bg btn-sm" onclick="colDoExtend('${colId}',${d})">+${d} Days</button>`).join('')}
          <button class="btn bg btn-sm" onclick="colCustomExtend('${colId}')">Custom</button>
        </div>
        <div class="fg"><label class="fl">Or choose new end date</label><input class="fi" id="col-ext-date" type="date" value="${col.endDate}"></div>
      </div>
      <div class="mf"><button class="btn bg" onclick="document.getElementById('col-extend-ov').remove()">Cancel</button><button class="btn bp" onclick="colExtendByDate('${colId}')">Apply</button></div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}

function colDoExtend(colId, days) {
  const col = getCollection(colId);
  if (!col) return;
  const prev = col.endDate;
  const base = col.endDate < ts() ? ts() : col.endDate;
  const newEnd = colAddDays(base, days);
  _colApplyExt(col, prev, newEnd, days);
  document.getElementById('col-extend-ov')?.remove();
}

function colCustomExtend(colId) {
  const v = prompt('Extend by how many days?', '7');
  if (v && !isNaN(parseInt(v)) && parseInt(v) > 0) colDoExtend(colId, parseInt(v));
  else document.getElementById('col-extend-ov')?.remove();
}

function colExtendByDate(colId) {
  const newEnd = document.getElementById('col-ext-date').value;
  const col = getCollection(colId);
  if (!col || !newEnd) return;
  const prev = col.endDate;
  const days = Math.ceil((new Date(newEnd + 'T00:00:00') - new Date(prev + 'T00:00:00')) / 86400000);
  _colApplyExt(col, prev, newEnd, days);
  document.getElementById('col-extend-ov')?.remove();
}

function _colApplyExt(col, prev, newEnd, days) {
  if (!col.extensions) col.extensions = [];
  col.extensions.push({ extendedAt: ts(), previousEnd: prev, newEnd, days });
  col.endDate = newEnd;
  col.status  = colStatus(col);
  save();
  renderCollections();
  toast(`📅 Extended to ${fDisp(newEnd)}!`, 'success');
}

// ── ACTIONS ────────────────────────────────────────────────────────────────────

function archiveCollection(id) {
  const col = getCollection(id);
  if (!col) return;
  col.status = 'archived'; save(); renderCollections(); toast('📦 Archived', 'info');
}

function deleteCollection(id) {
  const col = getCollection(id);
  if (!col || !confirm(`Delete "${col.name}" permanently?`)) return;
  S.collections = S.collections.filter(c => c.id !== id);
  save(); backToCollections(); toast('🗑️ Deleted', 'info');
}

function duplicateCollection(id) {
  const col = getCollection(id);
  if (!col) return;
  const dur = Math.ceil((new Date(col.endDate + 'T00:00:00') - new Date(col.startDate + 'T00:00:00')) / 86400000);
  const ns = ts();
  const nc = { ...JSON.parse(JSON.stringify(col)), id: 'col_' + Date.now(), name: col.name + ' (Copy)', startDate: ns, endDate: colAddDays(ns, dur), completions: {}, extensions: [], createdAt: ts() };
  nc.status = colStatus(nc);
  nc.habits.forEach(h => { h.id = 'ch_' + Date.now() + '_' + Math.random().toString(36).slice(2,5); });
  getCollections().push(nc);
  save(); renderCollections(); toast('📋 Duplicated!', 'success');
}

// ── UTILITY ────────────────────────────────────────────────────────────────────

function colAddDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return fd(d);
}

// ── EXPOSE GLOBALLY ────────────────────────────────────────────────────────────

window.renderCollections       = renderCollections;
window.openCollectionModal     = openCollectionModal;
window.closeCollectionModal    = closeCollectionModal;
window.saveCollectionModal     = saveCollectionModal;
window.selColIcon              = selColIcon;
window.selColColor             = selColColor;
window.colApplyPreset          = colApplyPreset;
window.colCustomDuration       = colCustomDuration;
window.colSyncEnd              = colSyncEnd;
window.colAddExisting          = colAddExisting;
window.colPickHabit            = colPickHabit;
window.colAddNew               = colAddNew;
window.colRemoveHabit          = colRemoveHabit;
window.colUpdateHabit          = colUpdateHabit;
window.colToggleDay            = colToggleDay;
window.viewCollectionDetail    = viewCollectionDetail;
window.viewCollectionAnalytics = viewCollectionAnalytics;
window.backToCollections       = backToCollections;
window.toggleColHabit          = toggleColHabit;
window.cycleColHabit           = cycleColHabit;
window.openExtendModal         = openExtendModal;
window.colDoExtend             = colDoExtend;
window.colCustomExtend         = colCustomExtend;
window.colExtendByDate         = colExtendByDate;
window.archiveCollection       = archiveCollection;
window.deleteCollection        = deleteCollection;
window.duplicateCollection     = duplicateCollection;
window.processCollectionsLifecycle = processCollectionsLifecycle;
