/**
 * matrix.js — GitHub-style Habit Matrix
 */

const Matrix = {
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  targetContainerId: null,

  render(containerId) {
    this.targetContainerId = containerId || this.targetContainerId;
    const container = document.getElementById(this.targetContainerId);
    if (!container) return;

    const habits = DB.getHabits();
    const year = this.currentYear;
    const month = this.currentMonth;
    const daysInMonth = getDaysInMonth(year, month);
    const todayStr = today();
    const todayDate = new Date(); todayDate.setHours(0,0,0,0);

    // Build day columns header
    let dayHeaders = `<th class="habit-name-col">Habit</th>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday = dateStr === todayStr;
      const dayDate = new Date(year, month, d);
      const dayOfWeek = dayDate.toLocaleDateString('en',{weekday:'short'}).slice(0,1);
      dayHeaders += `<th class="matrix-day-header ${isToday?'today':''}" title="${dateStr}">
        <div>${d}</div>
        <div style="font-size:9px;color:var(--text-muted);margin-top:1px">${dayOfWeek}</div>
      </th>`;
    }

    // Build rows
    let rows = habits.map(h => {
      let cells = `
        <td class="habit-label">
          <div class="habit-label-content" onclick="Router.navigate('habit-detail', '${h.id}')">
            <span class="habit-label-icon">${h.icon}</span>
            <span class="habit-label-text" title="${h.name}">${h.name}</span>
          </div>
        </td>
      `;

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const cellDate = new Date(year, month, d); cellDate.setHours(0,0,0,0);
        const isFuture = cellDate > todayDate;
        const isToday = dateStr === todayStr;
        const state = DB.getCompletion(h.id, dateStr);

        const stateClass = isFuture ? 'state-empty future' : `state-${state === 'empty' && !isFuture ? 'empty' : state}`;
        const icon = state === 'completed' ? '✓' : state === 'missed' ? '✗' : state === 'partial' ? '~' : '';
        const todayClass = isToday ? 'today-col' : '';

        const clickHandler = isFuture ? '' : `onclick="Matrix.clickCell('${h.id}','${dateStr}',this)"`;

        cells += `<td>
          <div class="matrix-cell ${stateClass} ${todayClass}" 
               id="cell-${h.id}-${dateStr.replace(/-/g,'')}"
               data-habit="${h.id}" data-date="${dateStr}"
               ${clickHandler}
               data-tooltip="${h.name} · ${formatShortDate(dateStr)} · ${isFuture ? 'Future' : state}">
            ${icon}
          </div>
        </td>`;
      }

      return `<tr class="matrix-row">${cells}</tr>`;
    }).join('');

    container.innerHTML = `
      <div class="matrix-container">
        <table class="habit-matrix">
          <thead><tr>${dayHeaders}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  clickCell(habitId, dateStr, el) {
    const newState = DB.cycleCompletion(habitId, dateStr);
    this.updateCellElement(el, newState);

    // If missed, prompt for reason
    if (newState === 'missed') {
      this.showMissReasonModal(habitId, dateStr);
    }

    // Refresh dashboard summaries if on dashboard
    if (document.getElementById('month-summary')) {
      Dashboard.renderMonthSummary();
      const stats = DB.getOverallStats();
      Dashboard.renderOverviewCards(stats, DB.getHabits().length);
      Dashboard.renderPerformance();
    }

    const habit = DB.getHabits().find(h => h.id === habitId);
    const stateLabel = {completed:'✅ Completed', missed:'❌ Missed', partial:'🟡 Partial', empty:'⚫ Unmarked'}[newState];
    showToast(`${habit?.icon || ''} ${habit?.name} → ${stateLabel}`, newState === 'completed' ? 'success' : 'info');
  },

  updateCellElement(el, state) {
    el.className = el.className.replace(/state-\w+/g, '').trim();
    el.classList.add(`state-${state}`);
    el.textContent = state === 'completed' ? '✓' : state === 'missed' ? '✗' : state === 'partial' ? '~' : '';
  },

  updateCell(habitId, dateStr) {
    const id = `cell-${habitId}-${dateStr.replace(/-/g,'')}`;
    const el = document.getElementById(id);
    if (el) {
      const state = DB.getCompletion(habitId, dateStr);
      this.updateCellElement(el, state);
    }
  },

  prevMonth() {
    if (this.currentMonth === 0) { this.currentMonth = 11; this.currentYear--; }
    else this.currentMonth--;
    this.updateMonthDisplay();
    this.render();
  },

  nextMonth() {
    const now = new Date();
    if (this.currentYear > now.getFullYear() || (this.currentYear === now.getFullYear() && this.currentMonth >= now.getMonth())) return;
    if (this.currentMonth === 11) { this.currentMonth = 0; this.currentYear++; }
    else this.currentMonth++;
    this.updateMonthDisplay();
    this.render();
  },

  updateMonthDisplay() {
    const el = document.getElementById('matrix-month-display');
    if (el) el.textContent = `${getMonthName(this.currentMonth)} ${this.currentYear}`;

    // Also update the analytics matrix if present
    const el2 = document.getElementById('habits-matrix-month-display');
    if (el2) el2.textContent = `${getMonthName(this.currentMonth)} ${this.currentYear}`;
  },

  showMissReasonModal(habitId, dateStr) {
    const habit = DB.getHabits().find(h => h.id === habitId);
    const reasons = ['Busy','Forgot','Low Energy','Travel','No Motivation','Other'];

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal animate-scale-in" style="max-width:380px">
        <div class="modal-header">
          <div class="modal-title">Why did you miss ${habit?.icon} ${habit?.name}?</div>
          <button class="btn btn-icon btn-ghost" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            ${reasons.map(r => `
              <button class="btn btn-ghost" style="justify-content:flex-start;font-size:13px" 
                onclick="Matrix.saveMissReason('${habitId}','${dateStr}','${r}',this.closest('.modal-overlay'))">
                ${reasonIcon(r)} ${r}
              </button>
            `).join('')}
          </div>
          <button class="btn btn-ghost w-full mt-4" onclick="this.closest('.modal-overlay').remove()">Skip</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  },

  saveMissReason(habitId, dateStr, reason, overlay) {
    DB.setMissReason(habitId, dateStr, reason);
    overlay.remove();
    showToast(`Reason recorded: ${reason}`, 'info');
  }
};

function reasonIcon(r) {
  const map = { Busy:'⏰', Forgot:'💭', 'Low Energy':'😴', Travel:'✈️', 'No Motivation':'😔', Other:'📝' };
  return map[r] || '📝';
}

window.Matrix = Matrix;
window.reasonIcon = reasonIcon;
