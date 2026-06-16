/**
 * planner.js — Planner & Daily Tasks system
 * 
 * Works alongside the existing S / go() / save() / toast() / fd() system.
 * Does NOT modify any existing habit, goal, journal or analytics logic.
 * All task data lives in S.tasks[] and S.reflections{}.
 */

// ────────────────────────────────────────────────────────────────
//  CONSTANTS
// ────────────────────────────────────────────────────────────────
const TASK_CATS = [
  { key: 'Study',    icon: '📚', color: '#3b82f6' },
  { key: 'Coding',   icon: '💻', color: '#8b5cf6' },
  { key: 'Fitness',  icon: '🏋', color: '#22c55e' },
  { key: 'Career',   icon: '🎯', color: '#f59e0b' },
  { key: 'Finance',  icon: '💰', color: '#10b981' },
  { key: 'Personal', icon: '🏠', color: '#06b6d4' },
  { key: 'Other',    icon: '📝', color: '#6366f1' },
];

const TASK_PRIORITIES = [
  { key: 'low',    label: 'Low',    color: '#22c55e' },
  { key: 'medium', label: 'Medium', color: '#f59e0b' },
  { key: 'high',   label: 'High',   color: '#f97316' },
  { key: 'urgent', label: 'Urgent', color: '#ef4444' },
];

const REFL_MOODS = [
  { key: 'excellent',   label: '🚀 Excellent' },
  { key: 'productive',  label: '⚡ Productive' },
  { key: 'good',        label: '😊 Good' },
  { key: 'okay',        label: '😐 Okay' },
  { key: 'tired',       label: '😴 Tired' },
  { key: 'poor',        label: '😔 Poor' },
];

// ────────────────────────────────────────────────────────────────
//  PLANNER STATE  (module-level, not stored in S)
// ────────────────────────────────────────────────────────────────
let planYear  = new Date().getFullYear();
let planMonth = new Date().getMonth();
let planSelectedDate = fd(new Date()); // currently viewed date in detail panel
let planCatFilter = 'All';
let planTaskModal_editId = null;
let planTaskModal_prefillDate = null;
let planReflMood = 'good';
let planAnalyticsTab = 'habits'; // 'habits' | 'tasks'

// ────────────────────────────────────────────────────────────────
//  DATA HELPERS
// ────────────────────────────────────────────────────────────────

/** Ensure S has tasks and reflections fields (migrate existing data) */
function plannerEnsureData() {
  if (!S.tasks)       S.tasks = [];
  if (!S.reflections) S.reflections = {};
}

function getTasksForDate(dateStr) {
  plannerEnsureData();
  return S.tasks.filter(t => t.dueDate === dateStr);
}

function getTasksDueToday() {
  return getTasksForDate(fd(new Date()));
}

function getTasksByCategory(cat) {
  plannerEnsureData();
  if (cat === 'All') return S.tasks;
  return S.tasks.filter(t => t.category === cat);
}

function getCatInfo(key) {
  return TASK_CATS.find(c => c.key === key) || TASK_CATS[6];
}

function getPriorityInfo(key) {
  return TASK_PRIORITIES.find(p => p.key === key) || TASK_PRIORITIES[1];
}

function getTaskStats() {
  plannerEnsureData();
  const all = S.tasks;
  const todayStr = fd(new Date());
  const total = all.length;
  const completed = all.filter(t => t.status === 'completed').length;
  const pending   = all.filter(t => t.status === 'pending' && t.dueDate >= todayStr).length;
  const overdue   = all.filter(t => t.status === 'pending' && t.dueDate < todayStr).length;
  return { total, completed, pending, overdue };
}

/** Daily productivity score: habits% × tasks% (0–100) */
function getDailyScore(dateStr) {
  plannerEnsureData();
  // Habit score
  const habits = S.habits;
  let habitScore = 100;
  if (habits.length > 0) {
    const done = habits.filter(h => gc(h.id, dateStr) === 'dn').length;
    habitScore = Math.round((done / habits.length) * 100);
  }
  // Task score
  const dayTasks = getTasksForDate(dateStr);
  let taskScore = 100;
  if (dayTasks.length > 0) {
    const done = dayTasks.filter(t => t.status === 'completed').length;
    taskScore = Math.round((done / dayTasks.length) * 100);
  }
  const combined = Math.round((habitScore + taskScore) / 2);
  return { combined, habitScore, taskScore, habitCount: habits.filter(h => gc(h.id, dateStr) === 'dn').length, totalHabits: habits.length, taskDone: dayTasks.filter(t => t.status === 'completed').length, totalTasks: dayTasks.length };
}

function getScoreLabel(score) {
  if (score >= 90) return { label: '🌟 Excellent', color: '#22c55e' };
  if (score >= 70) return { label: '✅ Good',       color: '#8b5cf6' };
  if (score >= 50) return { label: '😐 Average',    color: '#f59e0b' };
  return                  { label: '⚠️ Needs Work', color: '#ef4444' };
}

// ────────────────────────────────────────────────────────────────
//  PLANNER PAGE
// ────────────────────────────────────────────────────────────────
const PlannerPage = {

  render() {
    plannerEnsureData();
    this.renderStats();
    this.renderCatFilters();
    this.renderCalendar();
    this.renderDayDetail(planSelectedDate);
  },

  // ── 4 mini stat cards ──────────────────────────────────────
  renderStats() {
    const el = document.getElementById('planner-stats');
    if (!el) return;
    const { total, completed, pending, overdue } = getTaskStats();
    el.innerHTML = `
      <div class="task-stat-card tsc-purple">
        <span class="task-stat-ico">📋</span>
        <div class="task-stat-val">${total}</div>
        <div class="task-stat-lbl">Total Tasks</div>
      </div>
      <div class="task-stat-card tsc-green">
        <span class="task-stat-ico">✅</span>
        <div class="task-stat-val">${completed}</div>
        <div class="task-stat-lbl">Completed</div>
      </div>
      <div class="task-stat-card tsc-amber">
        <span class="task-stat-ico">⏳</span>
        <div class="task-stat-val">${pending}</div>
        <div class="task-stat-lbl">Pending</div>
      </div>
      <div class="task-stat-card tsc-red">
        <span class="task-stat-ico">🔴</span>
        <div class="task-stat-val">${overdue}</div>
        <div class="task-stat-lbl">Overdue</div>
      </div>
    `;
  },

  // ── Category filter sidebar ────────────────────────────────
  renderCatFilters() {
    const el = document.getElementById('planner-cat-filters');
    if (!el) return;
    plannerEnsureData();
    const allCount = S.tasks.length;
    const items = [{ key: 'All', icon: '🗂', color: '#8b5cf6', count: allCount },
      ...TASK_CATS.map(c => ({ ...c, count: S.tasks.filter(t => t.category === c.key).length }))
    ];
    el.innerHTML = items.map(c => `
      <button class="cat-filter-btn ${planCatFilter === c.key ? 'active' : ''}"
              onclick="plannerSetCatFilter('${c.key}')">
        <span>${c.icon}</span>
        <span>${c.key}</span>
        <span class="cat-filter-count">${c.count}</span>
      </button>
    `).join('');
  },

  // ── Month calendar ─────────────────────────────────────────
  renderCalendar() {
    const el = document.getElementById('planner-cal-grid');
    const titleEl = document.getElementById('planner-cal-title');
    if (!el) return;
    plannerEnsureData();

    const year  = planYear;
    const month = planMonth;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const adjustedFirst = firstDay === 0 ? 6 : firstDay - 1;
    const todayStr = fd(new Date());

    if (titleEl) titleEl.textContent = `${['January','February','March','April','May','June','July','August','September','October','November','December'][month]} ${year}`;

    const dayHeaders = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    let html = dayHeaders.map(d => `<div class="planner-cal-dh">${d}</div>`).join('');

    // Padding cells
    for (let i = 0; i < adjustedFirst; i++) {
      html += `<div class="planner-day other-month"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday    = dateStr === todayStr;
      const isSelected = dateStr === planSelectedDate;
      const dayTasks = getTasksForDate(dateStr).filter(t => planCatFilter === 'All' || t.category === planCatFilter);
      const hasOverdue = dayTasks.some(t => t.status === 'pending' && dateStr < todayStr);

      // Colored dots per task category
      const dots = dayTasks.slice(0, 5).map(t => {
        const cat = getCatInfo(t.category);
        const opacity = t.status === 'completed' ? '0.4' : '1';
        return `<div class="planner-dot" style="background:${cat.color};opacity:${opacity}"></div>`;
      }).join('');

      const taskCount = dayTasks.length;

      html += `
        <div class="planner-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasOverdue ? 'has-overdue' : ''}"
             onclick="plannerSelectDate('${dateStr}')">
          <div class="planner-day-num">${d}</div>
          <div class="planner-day-dots">${dots}</div>
          ${taskCount > 0 ? `<div class="planner-day-badge">${taskCount}</div>` : ''}
        </div>
      `;
    }

    el.innerHTML = html;
  },

  // ── Day Detail right panel ─────────────────────────────────
  renderDayDetail(dateStr) {
    const el = document.getElementById('planner-detail-panel');
    if (!el) return;
    plannerEnsureData();

    const isToday   = dateStr === fd(new Date());
    const isPast    = dateStr < fd(new Date());
    const dateDisp  = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', month: 'long', day: 'numeric' });
    const score     = getDailyScore(dateStr);
    const scoreLbl  = getScoreLabel(score.combined);

    // Tasks for this day
    const dayTasks  = getTasksForDate(dateStr)
      .filter(t => planCatFilter === 'All' || t.category === planCatFilter)
      .sort((a, b) => {
        const pOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2);
      });

    // Today's habits snapshot
    const habits = S.habits;
    const habitsDone = habits.filter(h => gc(h.id, dateStr) === 'dn').length;

    // Reflection
    const refl = S.reflections[dateStr] || {};

    el.innerHTML = `
      <!-- Date Header -->
      <div class="detail-date-header">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div class="detail-date-label">${isToday ? '📅 Today — ' : ''}${dateDisp}</div>
            <div class="detail-date-sub">${habits.length > 0 ? `${habitsDone}/${habits.length} habits done` : 'No habits set'}</div>
          </div>
          <button class="btn bp btn-sm" onclick="openTaskModal('${dateStr}')">+ Task</button>
        </div>
      </div>

      <!-- Productivity Score -->
      ${(isToday || isPast) && (habits.length > 0 || dayTasks.length > 0) ? `
      <div class="prod-score-wrap">
        <div class="prod-score-ring" id="score-ring-${dateStr}" style="background:conic-gradient(${scoreLbl.color} ${score.combined * 3.6}deg, rgba(148,163,184,.08) 0deg)">
          <div class="prod-score-num">${score.combined}</div>
        </div>
        <div>
          <div class="prod-score-label">${scoreLbl.label}</div>
          <div class="prod-score-sub">Daily Score</div>
          <div class="prod-score-breakdown">
            🏃 Habits ${score.habitScore}% &nbsp;·&nbsp; ✅ Tasks ${score.taskScore}%
          </div>
        </div>
      </div>
      <div style="height:1px;background:rgba(148,163,184,.07);margin:0 14px"></div>
      ` : ''}

      <!-- Tasks List -->
      <div style="padding:10px 14px 6px;display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:11px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.06em">Tasks</div>
        <span style="font-size:10px;color:var(--t3)">${dayTasks.length} task${dayTasks.length !== 1 ? 's' : ''}</span>
      </div>
      ${dayTasks.length === 0 ? `
        <div style="padding:20px 14px;text-align:center;color:var(--t3);font-size:12px">
          <div style="font-size:28px;margin-bottom:8px">✨</div>
          No tasks for this day.<br>
          <button class="btn bp btn-sm" style="margin-top:10px" onclick="openTaskModal('${dateStr}')">+ Add Task</button>
        </div>
      ` : `
        <div class="task-list">
          ${dayTasks.map(t => this._renderTaskItem(t, dateStr)).join('')}
        </div>
      `}

      <div style="height:1px;background:rgba(148,163,184,.07);margin:6px 14px"></div>

      <!-- Reflection -->
      <div style="padding:10px 14px 6px">
        <div style="font-size:11px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">📔 Daily Reflection</div>
        <div class="reflection-mood-row" id="refl-mood-row-${dateStr}">
          ${REFL_MOODS.map(m => `
            <button class="refl-mood-btn ${refl.mood === m.key ? 'sel' : ''}"
                    onclick="plannerSetReflMood('${dateStr}','${m.key}',this)">
              ${m.label}
            </button>`).join('')}
        </div>
        <div style="margin-bottom:8px">
          <label class="fl">🏆 Big Win</label>
          <input class="fi" id="refl-win-${dateStr}" placeholder="What did you accomplish?" value="${(refl.bigWin||'').replace(/"/g,'&quot;')}">
        </div>
        <div style="margin-bottom:8px">
          <label class="fl">💭 Notes / Improvement</label>
          <textarea class="fta" id="refl-notes-${dateStr}" placeholder="What would you do differently?" style="min-height:60px">${refl.notes||''}</textarea>
        </div>
        <button class="btn bp btn-sm w100" onclick="plannerSaveReflection('${dateStr}')">💾 Save Reflection</button>
      </div>
    `;
  },

  _renderTaskItem(t, dateStr) {
    const cat = getCatInfo(t.category);
    const pri = getPriorityInfo(t.priority);
    const isDone = t.status === 'completed';
    const isOverdue = t.status === 'pending' && t.dueDate < fd(new Date());
    return `
      <div class="task-item ${isDone ? 'done' : ''} ${isOverdue ? 'overdue' : ''}" id="task-item-${t.id}">
        <div class="task-check ${isDone ? 'done' : ''}" onclick="event.stopPropagation();plannerToggleTask('${t.id}','${dateStr}')">
          ${isDone ? '✓' : ''}
        </div>
        <div class="task-item-body">
          <div class="task-item-title">${t.title}</div>
          <div class="task-item-meta">
            <span class="priority-chip priority-${t.priority}">${pri.label}</span>
            <span style="display:inline-flex;align-items:center;gap:3px;font-size:9.5px;color:var(--t3)">
              <span style="width:6px;height:6px;border-radius:50%;background:${cat.color};display:inline-block"></span>
              ${cat.key}
            </span>
            ${t.dueTime ? `<span class="task-item-time">🕐 ${t.dueTime}</span>` : ''}
          </div>
        </div>
        <div class="task-item-actions">
          <button class="task-act-btn" onclick="event.stopPropagation();openTaskModal('${dateStr}','${t.id}')" title="Edit">✏️</button>
          <button class="task-act-btn" onclick="event.stopPropagation();plannerPostponeTask('${t.id}')" title="Postpone +1 day">📅</button>
          <button class="task-act-btn danger" onclick="event.stopPropagation();plannerDeleteTask('${t.id}','${dateStr}')" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }
};

// ────────────────────────────────────────────────────────────────
//  NAVIGATION & FILTERS
// ────────────────────────────────────────────────────────────────
function plannerPrev() {
  if (planMonth === 0) { planMonth = 11; planYear--; } else planMonth--;
  PlannerPage.renderCalendar();
}

function plannerNext() {
  if (planMonth === 11) { planMonth = 0; planYear++; } else planMonth++;
  PlannerPage.renderCalendar();
}

function plannerSelectDate(dateStr) {
  planSelectedDate = dateStr;
  PlannerPage.renderCalendar();
  PlannerPage.renderDayDetail(dateStr);
}

function plannerSetCatFilter(cat) {
  planCatFilter = cat;
  PlannerPage.renderCatFilters();
  PlannerPage.renderCalendar();
  PlannerPage.renderDayDetail(planSelectedDate);
}

// ────────────────────────────────────────────────────────────────
//  TASK MODAL
// ────────────────────────────────────────────────────────────────
function openTaskModal(prefillDate, editId) {
  planTaskModal_editId = editId || null;
  planTaskModal_prefillDate = prefillDate || fd(new Date());

  plannerEnsureData();
  const task = editId ? S.tasks.find(t => t.id === editId) : null;

  document.getElementById('tm-title').textContent = task ? '✏️ Edit Task' : '✨ Add Task';
  document.getElementById('t-eid').value = editId || '';
  document.getElementById('t-name').value = task ? task.title : '';
  document.getElementById('t-desc').value = task ? (task.description || '') : '';
  document.getElementById('t-cat').value  = task ? task.category  : 'Study';
  document.getElementById('t-date').value = task ? task.dueDate   : planTaskModal_prefillDate;
  document.getElementById('t-time').value = task ? (task.dueTime || '') : '';
  document.getElementById('t-rem-date').value = task ? (task.reminderDate || '') : '';
  document.getElementById('t-rem-time').value = task ? (task.reminderTime || '') : '';
  document.getElementById('t-notes').value = task ? (task.notes || '') : '';

  // Priority buttons
  const curPri = task ? task.priority : 'medium';
  document.querySelectorAll('.priority-pick-btn').forEach(btn => {
    btn.classList.remove('sel-low','sel-medium','sel-high','sel-urgent');
    if (btn.dataset.pri === curPri) btn.classList.add(`sel-${curPri}`);
  });

  // Color swatches — reuse existing sw/sel pattern
  const curColor = task ? task.color : '#8b5cf6';
  const TASK_COLS = ['#ef4444','#f97316','#f59e0b','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#6366f1','#ec4899','#10b981'];
  document.getElementById('t-colors').innerHTML = TASK_COLS.map(c =>
    `<div class="sw ${c === curColor ? 'sel' : ''}" style="background:${c}" data-c="${c}" onclick="selCol(this,'t-colors')"></div>`
  ).join('');

  document.getElementById('m-task').classList.remove('hid');
  document.getElementById('t-name').focus();
}

function closeTaskModal() {
  document.getElementById('m-task').classList.add('hid');
  planTaskModal_editId = null;
}

function selectPriority(btn, pri) {
  document.querySelectorAll('.priority-pick-btn').forEach(b =>
    b.classList.remove('sel-low','sel-medium','sel-high','sel-urgent')
  );
  btn.classList.add(`sel-${pri}`);
}

function saveTask() {
  plannerEnsureData();
  const title = document.getElementById('t-name').value.trim();
  if (!title) { toast('Please enter a task title', 'error'); document.getElementById('t-name').focus(); return; }

  const eid   = document.getElementById('t-eid').value;
  const pri   = document.querySelector('.priority-pick-btn[class*="sel-"]')?.dataset.pri || 'medium';
  const color = document.querySelector('#t-colors .sw.sel')?.dataset.c || '#8b5cf6';

  const data = {
    title,
    description: document.getElementById('t-desc').value.trim(),
    category:    document.getElementById('t-cat').value,
    priority:    pri,
    dueDate:     document.getElementById('t-date').value || fd(new Date()),
    dueTime:     document.getElementById('t-time').value,
    reminderDate: document.getElementById('t-rem-date').value,
    reminderTime: document.getElementById('t-rem-time').value,
    notes:       document.getElementById('t-notes').value.trim(),
    color,
    status:      eid ? (S.tasks.find(t => t.id === eid)?.status || 'pending') : 'pending',
  };

  if (eid) {
    const idx = S.tasks.findIndex(t => t.id === eid);
    if (idx >= 0) S.tasks[idx] = { ...S.tasks[idx], ...data };
    
    // Reset notification trigger flags since task details updated
    if (S.sentNotifications) {
      delete S.sentNotifications[`task_reminder_${eid}`];
      delete S.sentNotifications[`task_deadline_24h_${eid}`];
      delete S.sentNotifications[`task_deadline_1h_${eid}`];
      delete S.sentNotifications[`task_deadline_15m_${eid}`];
    }
    
    toast(`✅ "${title}" updated!`, 'success');
  } else {
    data.id = 't_' + Date.now();
    data.createdAt = fd(new Date());
    data.delayCount = 0;
    data.completedAt = null;
    S.tasks.push(data);
    toast(`🎉 "${title}" added!`, 'success');
  }

  save();
  closeTaskModal();

  // Refresh planner or dashboard if visible
  if (curPage === 'planner') PlannerPage.render();
  if (curPage === 'dashboard') rDash();
}
}

// ────────────────────────────────────────────────────────────────
//  TASK CRUD
// ────────────────────────────────────────────────────────────────
function plannerToggleTask(taskId, dateStr) {
  plannerEnsureData();
  const task = S.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (task.status === 'completed') {
    task.status = 'pending';
    task.completedAt = null;
    toast('↩️ Task marked pending', 'info');
  } else {
    task.status = 'completed';
    task.completedAt = fd(new Date());
    toast(`✅ "${task.title}" done!`, 'success');
  }
  save();

  // Fast DOM update — no full re-render needed
  const item = document.getElementById(`task-item-${taskId}`);
  if (item) {
    const chk = item.querySelector('.task-check');
    if (task.status === 'completed') {
      item.classList.add('done');
      chk.classList.add('done');
      chk.textContent = '✓';
    } else {
      item.classList.remove('done');
      chk.classList.remove('done');
      chk.textContent = '';
    }
  }

  // Refresh productivity score
  PlannerPage.renderDayDetail(planSelectedDate);

  // Refresh dashboard today's tasks widget
  if (dateStr === fd(new Date())) rTodayTasks();
}

function plannerDeleteTask(taskId, dateStr) {
  plannerEnsureData();
  const task = S.tasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('conf-icon').textContent = '🗑️';
  document.getElementById('conf-title').textContent = 'Delete Task';
  document.getElementById('conf-msg').innerHTML = `Delete <strong>"${task.title}"</strong>? This cannot be undone.`;
  document.getElementById('conf-ok').textContent = 'Delete';
  document.getElementById('conf-ok').onclick = () => {
    S.tasks = S.tasks.filter(t => t.id !== taskId);
    save();
    closeConf();
    toast(`🗑️ Task deleted`, 'info');
    PlannerPage.render();
    if (curPage === 'dashboard') rTodayTasks();
  };
  document.getElementById('m-confirm').classList.remove('hid');
}

function plannerPostponeTask(taskId) {
  plannerEnsureData();
  const task = S.tasks.find(t => t.id === taskId);
  if (!task) return;

  const d = new Date(task.dueDate + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  task.dueDate = fd(d);
  task.delayCount = (task.delayCount || 0) + 1;
  save();
  toast(`📅 "${task.title}" moved to ${d.toLocaleDateString('en-IN',{month:'short',day:'numeric'})}`, 'info');
  PlannerPage.render();
}

// ────────────────────────────────────────────────────────────────
//  REFLECTION
// ────────────────────────────────────────────────────────────────
function plannerSetReflMood(dateStr, moodKey, btn) {
  document.querySelectorAll(`#refl-mood-row-${dateStr} .refl-mood-btn`).forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  // Store temporarily in DOM; saved when user clicks "Save Reflection"
  btn.closest('.refl-mood-btn') || btn;
  planReflMood = moodKey;
}

function plannerSaveReflection(dateStr) {
  plannerEnsureData();
  const selectedMoodBtn = document.querySelector(`#refl-mood-row-${dateStr} .refl-mood-btn.sel`);
  const mood   = selectedMoodBtn ? selectedMoodBtn.dataset?.mood || planReflMood : planReflMood;
  // Read mood from button text fallback
  const moodFromBtn = selectedMoodBtn ? (() => {
    const txt = selectedMoodBtn.textContent.trim().toLowerCase();
    for (const m of REFL_MOODS) if (txt.includes(m.key)) return m.key;
    return planReflMood;
  })() : planReflMood;

  const bigWin = document.getElementById(`refl-win-${dateStr}`)?.value.trim() || '';
  const notes  = document.getElementById(`refl-notes-${dateStr}`)?.value.trim() || '';

  S.reflections[dateStr] = { mood: moodFromBtn, bigWin, notes, savedAt: new Date().toISOString() };
  save();
  toast('📔 Reflection saved!', 'success');
}

// ────────────────────────────────────────────────────────────────
//  DASHBOARD — Today's Tasks widget
// ────────────────────────────────────────────────────────────────
function rTodayTasks() {
  plannerEnsureData();
  const el = document.getElementById('today-tasks-list');
  if (!el) return;

  const todayStr   = fd(new Date());
  const todayTasks = getTasksForDate(todayStr).sort((a, b) => {
    const pOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2);
  });

  const badge = document.getElementById('today-tasks-badge');
  const done  = todayTasks.filter(t => t.status === 'completed').length;
  if (badge) badge.textContent = `${done}/${todayTasks.length} Done`;

  if (todayTasks.length === 0) {
    el.innerHTML = `
      <div style="text-align:center;padding:20px 14px;color:var(--t3)">
        <div style="font-size:28px;margin-bottom:8px">✨</div>
        <div style="font-size:12px;margin-bottom:10px">No tasks due today</div>
        <button class="btn bp btn-sm" onclick="openTaskModal('${todayStr}')">+ Add Task</button>
      </div>
    `;
    return;
  }

  el.innerHTML = todayTasks.map(t => {
    const cat = getCatInfo(t.category);
    const pri = getPriorityInfo(t.priority);
    const isDone = t.status === 'completed';
    return `
      <div class="today-task-item ${isDone ? 'done' : ''}" id="dash-task-${t.id}">
        <div class="today-task-chk ${isDone ? 'done' : ''}"
             onclick="dashToggleTask('${t.id}')">
          ${isDone ? '✓' : ''}
        </div>
        <div style="flex:1;min-width:0">
          <div class="today-task-title">${t.title}</div>
          <div class="today-task-meta">
            <span style="display:inline-flex;align-items:center;gap:3px">
              <span style="width:5px;height:5px;border-radius:50%;background:${cat.color};display:inline-block"></span>
              ${cat.key}
            </span>
            · <span class="priority-chip priority-${t.priority}">${pri.label}</span>
            ${t.dueTime ? `· 🕐 ${t.dueTime}` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function dashToggleTask(taskId) {
  plannerEnsureData();
  const task = S.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (task.status === 'completed') {
    task.status = 'pending';
    task.completedAt = null;
  } else {
    task.status = 'completed';
    task.completedAt = fd(new Date());
    toast(`✅ "${task.title}" done!`, 'success');
  }
  save();

  // Fast DOM update
  const item = document.getElementById(`dash-task-${taskId}`);
  if (item) {
    const chk = item.querySelector('.today-task-chk');
    const title = item.querySelector('.today-task-title');
    if (task.status === 'completed') {
      item.classList.add('done');
      chk.classList.add('done');
      chk.textContent = '✓';
    } else {
      item.classList.remove('done');
      chk.classList.remove('done');
      chk.textContent = '';
    }
  }

  // Update badge
  const todayTasks = getTasksForDate(fd(new Date()));
  const done = todayTasks.filter(t => t.status === 'completed').length;
  const badge = document.getElementById('today-tasks-badge');
  if (badge) badge.textContent = `${done}/${todayTasks.length} Done`;
}

// ────────────────────────────────────────────────────────────────
//  ANALYTICS — Task section (called from rAnalytics in index.html)
// ────────────────────────────────────────────────────────────────
function rTaskAnalytics() {
  plannerEnsureData();
  rTaskOverviewCards();
  rTaskCatChart();
  rTaskDayPerf();
  rTaskDelayed();
  rProductivityHeatmap();
  rSmartInsights();
}

function rTaskOverviewCards() {
  const el = document.getElementById('task-analytics-cards');
  if (!el) return;
  const { total, completed, pending, overdue } = getTaskStats();
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  el.innerHTML = `
    <div class="card" style="padding:14px;text-align:center">
      <div style="font-size:22px;font-weight:800;color:var(--plite)">${total}</div>
      <div class="txs tm mt3">📋 Total</div>
    </div>
    <div class="card" style="padding:14px;text-align:center">
      <div style="font-size:22px;font-weight:800;color:#4ade80">${completed}</div>
      <div class="txs tm mt3">✅ Completed</div>
    </div>
    <div class="card" style="padding:14px;text-align:center">
      <div style="font-size:22px;font-weight:800;color:var(--amber)">${pending}</div>
      <div class="txs tm mt3">⏳ Pending</div>
    </div>
    <div class="card" style="padding:14px;text-align:center">
      <div style="font-size:22px;font-weight:800;color:#f87171">${overdue}</div>
      <div class="txs tm mt3">🔴 Overdue</div>
    </div>
    <div class="card" style="padding:14px;text-align:center;grid-column:1/-1">
      <div style="font-size:22px;font-weight:800;color:var(--plite)">${rate}%</div>
      <div style="height:6px;background:rgba(148,163,184,.1);border-radius:3px;margin:8px 0;overflow:hidden">
        <div style="height:100%;width:${rate}%;background:linear-gradient(90deg,#8b5cf6,#6366f1);border-radius:3px"></div>
      </div>
      <div class="txs tm">🎯 Completion Rate</div>
    </div>
  `;
}

function rTaskCatChart() {
  const el = document.getElementById('task-cat-chart');
  if (!el) return;
  const results = TASK_CATS.map(cat => {
    const catTasks = S.tasks.filter(t => t.category === cat.key);
    const done = catTasks.filter(t => t.status === 'completed').length;
    const rate = catTasks.length > 0 ? Math.round((done / catTasks.length) * 100) : 0;
    return { ...cat, total: catTasks.length, done, rate };
  }).filter(r => r.total > 0);

  if (!results.length) {
    el.innerHTML = '<div class="txs tm" style="padding:14px;text-align:center">No task data yet.</div>';
    return;
  }
  el.innerHTML = results.map(r => `
    <div class="task-cat-bar">
      <div class="task-cat-bar-label">${r.icon} ${r.key}</div>
      <div class="task-cat-bar-track">
        <div class="task-cat-bar-fill" style="width:${r.rate}%;background:${r.color}"></div>
      </div>
      <div class="task-cat-bar-pct" style="color:${r.color}">${r.rate}%</div>
    </div>
  `).join('');
}

function rTaskDayPerf() {
  const el = document.getElementById('task-day-perf');
  if (!el) return;
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const counts = [0,0,0,0,0,0,0];
  const dones  = [0,0,0,0,0,0,0];
  S.tasks.forEach(t => {
    const d = new Date(t.dueDate + 'T00:00:00');
    const dow = d.getDay();
    counts[dow]++;
    if (t.status === 'completed') dones[dow]++;
  });
  const rates = counts.map((c, i) => c > 0 ? Math.round((dones[i] / c) * 100) : 0);
  const max = Math.max(...rates) || 1;
  const best = rates.indexOf(max);
  const worst = rates.indexOf(Math.min(...rates.filter(r => r > 0))) ;

  // Reorder Mon–Sun
  const order = [1,2,3,4,5,6,0];
  const orderedDays = order.map(i => ({ label: days[i], rate: rates[i], isBest: i === best, isWorst: counts[i] > 0 && i === worst }));

  if (rates.every(r => r === 0)) {
    el.innerHTML = '<div class="txs tm" style="padding:14px;text-align:center">No data yet.</div>';
    return;
  }

  el.innerHTML = orderedDays.map(d => `
    <div class="day-perf-row">
      <div class="day-perf-label">${d.label}</div>
      <div class="day-perf-bar">
        <div class="day-perf-fill"
             style="width:${d.rate}%;background:${d.isBest ? 'linear-gradient(90deg,#22c55e,#16a34a)' : d.isWorst ? 'linear-gradient(90deg,#ef4444,#dc2626)' : 'linear-gradient(90deg,#8b5cf6,#6366f1)'}">
          ${d.rate > 0 ? d.rate + '%' : ''}
        </div>
      </div>
      ${d.isBest  ? '<span class="txs" style="color:#4ade80;font-weight:700;width:28px">🏆</span>'  : ''}
      ${d.isWorst ? '<span class="txs" style="color:#f87171;font-weight:700;width:28px">⚠️</span>' : ''}
      ${!d.isBest && !d.isWorst ? '<span style="width:28px"></span>' : ''}
    </div>
  `).join('');
}

function rTaskDelayed() {
  const el = document.getElementById('task-delayed');
  if (!el) return;
  const delayed = [...S.tasks]
    .filter(t => (t.delayCount || 0) > 0)
    .sort((a, b) => (b.delayCount || 0) - (a.delayCount || 0))
    .slice(0, 5);

  if (!delayed.length) {
    el.innerHTML = '<div class="txs tm" style="padding:14px;text-align:center">No postponed tasks. Great discipline! 💪</div>';
    return;
  }
  el.innerHTML = delayed.map(t => {
    const cat = getCatInfo(t.category);
    return `
      <div class="delayed-task-row">
        <div class="delayed-task-ico">${cat.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600">${t.title}</div>
          <div class="txs tm">${cat.key}</div>
        </div>
        <div class="delayed-task-count">⏭️ ${t.delayCount}×</div>
      </div>
    `;
  }).join('');
}

function rProductivityHeatmap() {
  const el = document.getElementById('prod-heatmap');
  if (!el) return;

  const todayStr = fd(new Date());
  const today = new Date(); today.setHours(0,0,0,0);
  const cells = [];

  // Last 84 days (12 weeks)
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = fd(d);
    const isFuture = dateStr > todayStr;

    let level = 0;
    if (!isFuture) {
      const score = getDailyScore(dateStr);
      const combined = score.combined;
      if (combined >= 90)     level = 4;
      else if (combined >= 70) level = 3;
      else if (combined >= 40) level = 2;
      else if (combined > 0)   level = 1;
    }
    cells.push({ dateStr, level, isFuture });
  }

  el.innerHTML = cells.map(c => `
    <div class="hm-cell hm-${c.level} ${c.dateStr === todayStr ? 'hm-today' : ''}"
         title="${c.dateStr}${!c.isFuture ? ' · Score ' + getDailyScore(c.dateStr).combined + '%' : ''}">
    </div>
  `).join('');
}

function rSmartInsights() {
  const el = document.getElementById('smart-insights');
  if (!el) return;
  plannerEnsureData();

  const todayStr = fd(new Date());
  const last30 = [];
  const today = new Date(); today.setHours(0,0,0,0);
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = fd(d);
    if (dateStr > todayStr) continue;
    last30.push({ dateStr, score: getDailyScore(dateStr) });
  }

  const avgScore = last30.length > 0
    ? Math.round(last30.reduce((s, d) => s + d.score.combined, 0) / last30.length)
    : 0;
  const bestDay  = last30.reduce((best, d) => d.score.combined > best.score.combined ? d : best, last30[0] || { dateStr: todayStr, score: { combined: 0 } });
  const worstDay = last30.filter(d => d.score.combined > 0).reduce((worst, d) => d.score.combined < worst.score.combined ? d : worst, last30.find(d => d.score.combined > 0) || { dateStr: todayStr, score: { combined: 0 } });

  const { total, completed } = getTaskStats();
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Most consistent category
  const catRates = TASK_CATS.map(cat => {
    const catTasks = S.tasks.filter(t => t.category === cat.key);
    const done = catTasks.filter(t => t.status === 'completed').length;
    return { ...cat, rate: catTasks.length > 0 ? Math.round((done/catTasks.length)*100) : 0, total: catTasks.length };
  }).filter(c => c.total > 0).sort((a, b) => b.rate - a.rate);

  const insights = [
    { ico: '📈', t: 'Avg Daily Score', v: `${avgScore}%`, s: 'Last 30 days' },
    { ico: '🌟', t: 'Best Day', v: bestDay ? new Date(bestDay.dateStr + 'T00:00:00').toLocaleDateString('en-IN',{month:'short',day:'numeric'}) : '—', s: bestDay ? `${bestDay.score.combined}% score` : '' },
    { ico: '🎯', t: 'Task Completion', v: `${completionRate}%`, s: `${completed}/${total} tasks done` },
    { ico: '🏆', t: 'Best Category', v: catRates[0] ? `${catRates[0].icon} ${catRates[0].key}` : '—', s: catRates[0] ? `${catRates[0].rate}% done` : 'Add tasks' },
  ];

  el.innerHTML = insights.map(c => `
    <div class="card" style="padding:14px">
      <div style="font-size:20px;margin-bottom:6px">${c.ico}</div>
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--t3);font-weight:700;margin-bottom:4px">${c.t}</div>
      <div style="font-size:13px;font-weight:700">${c.v}</div>
      <div class="txs tm mt3">${c.s}</div>
    </div>
  `).join('');
}

// ────────────────────────────────────────────────────────────────
//  ANALYTICS TAB SWITCHING
// ────────────────────────────────────────────────────────────────
function switchAnalyticsTab(tab) {
  planAnalyticsTab = tab;
  document.querySelectorAll('.analytics-tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  document.querySelectorAll('.analytics-tab-panel').forEach(p =>
    p.classList.toggle('active', p.id === `analytics-panel-${tab}`)
  );
  if (tab === 'tasks') {
    rTaskAnalytics();
  }
}

// ────────────────────────────────────────────────────────────────
//  EXPOSE GLOBALS
// ────────────────────────────────────────────────────────────────
window.PlannerPage       = PlannerPage;
window.plannerPrev       = plannerPrev;
window.plannerNext       = plannerNext;
window.plannerSelectDate = plannerSelectDate;
window.plannerSetCatFilter = plannerSetCatFilter;
window.openTaskModal     = openTaskModal;
window.closeTaskModal    = closeTaskModal;
window.selectPriority    = selectPriority;
window.saveTask          = saveTask;
window.plannerToggleTask = plannerToggleTask;
window.plannerDeleteTask = plannerDeleteTask;
window.plannerPostponeTask = plannerPostponeTask;
window.plannerSetReflMood  = plannerSetReflMood;
window.plannerSaveReflection = plannerSaveReflection;
window.rTodayTasks       = rTodayTasks;
window.dashToggleTask    = dashToggleTask;
window.rTaskAnalytics    = rTaskAnalytics;
window.switchAnalyticsTab = switchAnalyticsTab;
window.plannerEnsureData = plannerEnsureData;
