/**
 * habits.js — Habits management page
 */

const HabitsPage = {
  editingId: null,

  render() {
    this.renderHabitsList();
  },

  renderHabitsList() {
    const habits = DB.getHabits();
    const el = document.getElementById('habits-list-container');
    if (!el) return;

    if (habits.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✨</div>
          <h3>No habits yet</h3>
          <p>Start building your routine by adding your first habit.</p>
          <button class="btn btn-primary" onclick="HabitsPage.showAddForm()">+ Add First Habit</button>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="habits-list">
        ${habits.map(h => this.renderHabitCard(h)).join('')}
      </div>
    `;
  },

  renderHabitCard(h) {
    const stats = DB.getHabitStats(h.id);
    return `
      <div class="card habit-card" onclick="Router.navigate('habit-detail', '${h.id}')">
        <div class="habit-card-icon" style="background:${h.color}22;color:${h.color}">
          ${h.icon}
        </div>
        <div class="habit-card-info">
          <div class="habit-card-name">${h.name}</div>
          <div class="habit-card-meta">
            <span class="badge badge-${categoryColor(h.category)}">${h.category}</span>
            <span class="habit-card-freq">🔄 ${h.freq}</span>
            ${h.note ? `<span class="text-muted text-xs">· ${h.note}</span>` : ''}
          </div>
        </div>
        <div class="habit-card-stats">
          <div class="habit-stat-item">
            <div class="habit-stat-val">${stats.streak}🔥</div>
            <div class="habit-stat-lbl">Streak</div>
          </div>
          <div class="habit-stat-item">
            <div class="habit-stat-val">${stats.rate}%</div>
            <div class="habit-stat-lbl">Rate</div>
          </div>
          <div class="habit-stat-item">
            <div class="habit-stat-val">${stats.bestStreak}</div>
            <div class="habit-stat-lbl">Best</div>
          </div>
        </div>
        <div class="habit-card-actions" onclick="event.stopPropagation()">
          <button class="btn btn-icon btn-ghost" onclick="HabitsPage.showEditForm('${h.id}')" title="Edit">✏️</button>
          <button class="btn btn-icon btn-danger" onclick="HabitsPage.confirmDelete('${h.id}')" title="Delete">🗑</button>
        </div>
      </div>
    `;
  },

  showAddForm() {
    this.editingId = null;
    this.showHabitModal(null);
  },

  showEditForm(id) {
    this.editingId = id;
    const habit = DB.getAllHabits().find(h => h.id === id);
    this.showHabitModal(habit);
  },

  showHabitModal(habit) {
    const icons = ['💪','🏋️','🧘','📖','💻','💧','😴','🤖','🎯','🏃','🧠','🎨','🎵','✍️','🌱','🍎','☕','📝','🔬','💡'];
    const colors = ['#ef4444','#f97316','#f59e0b','#84cc16','#10b981','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#6366f1'];
    const categories = ['Fitness','Health','Study','Coding','Personal','Reading','Mindfulness','Finance','Creative','Other'];

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'habit-modal';
    modal.innerHTML = `
      <div class="modal animate-scale-in">
        <div class="modal-header">
          <div class="modal-title">${habit ? '✏️ Edit Habit' : '✨ Add New Habit'}</div>
          <button class="btn btn-icon btn-ghost" onclick="document.getElementById('habit-modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Habit Name *</label>
            <input class="form-input" id="hf-name" placeholder="e.g. Morning Run" value="${habit?.name || ''}">
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Category</label>
              <select class="form-select" id="hf-category">
                ${categories.map(c => `<option value="${c}" ${habit?.category===c?'selected':''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Frequency</label>
              <select class="form-select" id="hf-freq">
                <option value="daily" ${habit?.freq==='daily'?'selected':''}>Daily</option>
                <option value="weekly" ${habit?.freq==='weekly'?'selected':''}>Weekly</option>
                <option value="monthly" ${habit?.freq==='monthly'?'selected':''}>Monthly</option>
              </select>
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Reminder Time</label>
              <input class="form-input" id="hf-reminder" type="time" value="${habit?.reminder || '07:00'}">
            </div>
            <div class="form-group">
              <label class="form-label">Target (for weekly)</label>
              <input class="form-input" id="hf-target" type="number" min="1" max="7" placeholder="e.g. 4" value="${habit?.weeklyTarget || ''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Icon</label>
            <div class="icon-picker-row" id="hf-icon-picker">
              ${icons.map(ic => `
                <button class="icon-option ${habit?.icon===ic?'selected':''}" onclick="HabitsPage.selectIcon(this,'${ic}')">${ic}</button>
              `).join('')}
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Color</label>
            <div class="color-picker-row" id="hf-color-picker">
              ${colors.map(c => `
                <div class="color-option ${habit?.color===c?'selected':''}" style="background:${c}" onclick="HabitsPage.selectColor(this,'${c}')"></div>
              `).join('')}
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Notes</label>
            <input class="form-input" id="hf-note" placeholder="Optional description..." value="${habit?.note || ''}">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="document.getElementById('habit-modal').remove()">Cancel</button>
          <button class="btn btn-primary" onclick="HabitsPage.saveHabit()">
            ${habit ? 'Save Changes' : '+ Add Habit'}
          </button>
        </div>
      </div>
    `;

    // Set defaults for new
    if (!habit) {
      setTimeout(() => {
        document.querySelector('#hf-icon-picker .icon-option')?.classList.add('selected');
        document.querySelector('#hf-color-picker .color-option')?.classList.add('selected');
      }, 10);
    }

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('hf-name')?.focus();
  },

  selectedIcon: '💪',
  selectedColor: '#8b5cf6',

  selectIcon(el, icon) {
    document.querySelectorAll('.icon-option').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    this.selectedIcon = icon;
  },

  selectColor(el, color) {
    document.querySelectorAll('.color-option').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    this.selectedColor = color;
  },

  saveHabit() {
    const name = document.getElementById('hf-name')?.value.trim();
    if (!name) { showToast('Please enter a habit name', 'error'); return; }

    const icon = document.querySelector('.icon-option.selected')?.textContent || '💪';
    const color = this.selectedColor || '#8b5cf6';
    const category = document.getElementById('hf-category')?.value;
    const freq = document.getElementById('hf-freq')?.value;
    const reminder = document.getElementById('hf-reminder')?.value;
    const weeklyTarget = parseInt(document.getElementById('hf-target')?.value) || null;
    const note = document.getElementById('hf-note')?.value.trim();

    const habitData = { name, icon, color, category, freq, reminder, weeklyTarget, note };

    if (this.editingId) {
      DB.updateHabit(this.editingId, habitData);
      showToast(`✅ Habit "${name}" updated!`, 'success');
    } else {
      DB.addHabit(habitData);
      showToast(`🎉 Habit "${name}" created!`, 'success');
    }

    document.getElementById('habit-modal')?.remove();
    this.renderHabitsList();
  },

  confirmDelete(id) {
    const habit = DB.getAllHabits().find(h => h.id === id);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal animate-scale-in" style="max-width:360px">
        <div class="modal-header">
          <div class="modal-title">Delete Habit</div>
          <button class="btn btn-icon btn-ghost" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body" style="text-align:center;padding:32px">
          <div style="font-size:48px;margin-bottom:16px">${habit?.icon || '🗑'}</div>
          <h3 style="margin-bottom:8px">Delete "${habit?.name}"?</h3>
          <p class="text-muted text-sm">All completion data for this habit will be archived. This cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <button class="btn btn-danger" onclick="HabitsPage._doDelete('${id}',this.closest('.modal-overlay'))">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  },

  _doDelete(id, modal) {
    const habit = DB.getAllHabits().find(h => h.id === id);
    DB.deleteHabit(id);
    modal.remove();
    showToast(`🗑 "${habit?.name}" deleted`, 'info');
    this.renderHabitsList();
  }
};

// ────────────────────────────────────────────────
//  HABIT DETAIL PAGE
// ────────────────────────────────────────────────
const HabitDetail = {
  render(habitId) {
    const habit = DB.getHabits().find(h => h.id === habitId);
    if (!habit) { Router.navigate('habits'); return; }

    const stats = DB.getHabitStats(habitId);
    const el = document.getElementById('habit-detail-content');
    if (!el) return;

    el.innerHTML = `
      <div style="max-width:900px">
        <!-- Header -->
        <div class="flex items-center gap-4 mb-6">
          <button class="btn btn-ghost btn-sm" onclick="Router.navigate('habits')">← Back</button>
          <div class="flex items-center gap-3 flex-1">
            <div style="width:56px;height:56px;border-radius:16px;background:${habit.color}22;display:flex;align-items:center;justify-content:center;font-size:28px;border:1px solid ${habit.color}44">
              ${habit.icon}
            </div>
            <div>
              <h2 style="font-size:24px;font-weight:800;color:var(--text-primary)">${habit.name}</h2>
              <div class="flex gap-2 mt-1">
                <span class="badge badge-${categoryColor(habit.category)}">${habit.category}</span>
                <span class="badge badge-blue">🔄 ${habit.freq}</span>
              </div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="HabitsPage.showEditForm('${habitId}')">✏️ Edit</button>
        </div>

        <!-- Stats row -->
        <div class="grid-4 mb-6">
          <div class="card" style="padding:20px;text-align:center">
            <div style="font-size:32px;font-weight:800;color:var(--amber-400)">${stats.streak}</div>
            <div class="text-sm text-muted mt-1">Current Streak 🔥</div>
          </div>
          <div class="card" style="padding:20px;text-align:center">
            <div style="font-size:32px;font-weight:800;color:var(--purple-400)">${stats.bestStreak}</div>
            <div class="text-sm text-muted mt-1">Best Streak 🏆</div>
          </div>
          <div class="card" style="padding:20px;text-align:center">
            <div style="font-size:32px;font-weight:800;color:var(--emerald-400)">${stats.rate}%</div>
            <div class="text-sm text-muted mt-1">Completion Rate 📈</div>
          </div>
          <div class="card" style="padding:20px;text-align:center">
            <div style="font-size:32px;font-weight:800;color:var(--rose-400)">${stats.missed}</div>
            <div class="text-sm text-muted mt-1">Missed Days ❌</div>
          </div>
        </div>

        <!-- Monthly mini-matrix -->
        <div class="card mb-5">
          <div class="card-header">
            <span class="card-title">📅 Monthly View</span>
          </div>
          <div class="card-body">
            <div id="detail-monthly-matrix"></div>
          </div>
        </div>

        <!-- Yearly heatmap -->
        <div class="card mb-5">
          <div class="card-header">
            <span class="card-title">📆 Year Heatmap</span>
          </div>
          <div class="card-body">
            <div id="detail-year-heatmap"></div>
          </div>
        </div>

        <!-- Recent activity -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">🕐 Recent Activity</span>
          </div>
          <div id="detail-recent" style="max-height:300px;overflow-y:auto"></div>
        </div>
      </div>
    `;

    this.renderMonthlyMatrix(habitId);
    this.renderYearHeatmap(habitId);
    this.renderRecentActivity(habitId);
  },

  renderMonthlyMatrix(habitId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const days = getDaysInMonth(year, month);
    const todayStr = today();
    const todayDate = new Date(); todayDate.setHours(0,0,0,0);

    let cells = '';
    for (let d = 1; d <= days; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cellDate = new Date(year, month, d); cellDate.setHours(0,0,0,0);
      const isFuture = cellDate > todayDate;
      const state = isFuture ? 'empty' : DB.getCompletion(habitId, dateStr);
      const stateClass = isFuture ? 'state-empty future' : `state-${state}`;
      const icon = state === 'completed' ? '✓' : state === 'missed' ? '✗' : state === 'partial' ? '~' : '';
      const isToday = dateStr === todayStr;

      cells += `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="font-size:10px;color:var(--text-muted)">${d}</div>
        <div class="matrix-cell ${stateClass} ${isToday?'today-col':''}"
             onclick="${isFuture?'':`Matrix.clickCell('${habitId}','${dateStr}',this);HabitDetail.renderMonthlyMatrix('${habitId}')`}"
             data-tooltip="${formatShortDate(dateStr)}: ${state}">
          ${icon}
        </div>
      </div>`;
    }

    const el = document.getElementById('detail-monthly-matrix');
    if (el) el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px">${cells}</div>`;
  },

  renderYearHeatmap(habitId) {
    const now = new Date(); now.setHours(0,0,0,0);
    const start = new Date(now.getFullYear(), 0, 1);
    let cells = '';

    for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d);
      const state = DB.getCompletion(habitId, dateStr);
      const stateClass = `state-${state}`;
      cells += `<div class="matrix-cell ${stateClass}" style="width:12px;height:12px;border-radius:3px" data-tooltip="${dateStr}: ${state}"></div>`;
    }

    const el = document.getElementById('detail-year-heatmap');
    if (el) el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:3px">${cells}</div>`;
  },

  renderRecentActivity(habitId) {
    const now = new Date(); now.setHours(0,0,0,0);
    const rows = [];

    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      const state = DB.getCompletion(habitId, dateStr);
      if (state === 'empty') continue;

      const icons = { completed:'✅', missed:'❌', partial:'🟡' };
      const label = { completed:'Completed', missed:'Missed', partial:'Partial' };
      const reason = state === 'missed' ? DB.get().missReasons[`${habitId}_${dateStr}`] : null;

      rows.push(`
        <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border-color)">
          <span style="font-size:18px">${icons[state]}</span>
          <div style="flex:1">
            <div class="text-sm font-semibold">${label[state]}</div>
            ${reason ? `<div class="text-xs text-muted">Reason: ${reasonIcon(reason)} ${reason}</div>` : ''}
          </div>
          <div class="text-xs text-muted">${formatShortDate(dateStr)}</div>
        </div>
      `);
    }

    const el = document.getElementById('detail-recent');
    if (el) el.innerHTML = rows.length ? rows.join('') : `<div class="empty-state" style="padding:24px"><p>No recent activity in the last 14 days.</p></div>`;
  }
};

window.HabitsPage = HabitsPage;
window.HabitDetail = HabitDetail;
