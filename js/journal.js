/**
 * journal.js — Journal page
 */

const JournalPage = {
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),

  render() {
    this.renderEntryForm();
    this.renderEntries();
    this.renderMiniCalendar();
  },

  renderEntryForm() {
    const todayStr = today();
    const existing = DB.getJournalEntry(todayStr);
    const moods = [
      { id: 'amazing', emoji: '🚀', label: 'Amazing' },
      { id: 'productive', emoji: '⚡', label: 'Productive' },
      { id: 'good', emoji: '😊', label: 'Good' },
      { id: 'okay', emoji: '😐', label: 'Okay' },
      { id: 'tired', emoji: '😴', label: 'Tired' },
      { id: 'bad', emoji: '😔', label: 'Bad' },
    ];

    const el = document.getElementById('journal-form-container');
    if (!el) return;

    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">📝 Today's Entry</span>
          <span class="text-xs text-muted">${new Date().toLocaleDateString('en-IN',{weekday:'long',month:'long',day:'numeric'})}</span>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">How was your day?</label>
            <div class="mood-picker" id="mood-picker">
              ${moods.map(m => `
                <div class="mood-option ${existing?.mood === m.id ? 'selected' : ''}" 
                     onclick="JournalPage.selectMood('${m.id}',this)" 
                     id="mood-${m.id}">
                  <span class="mood-emoji">${m.emoji}</span>
                  <span class="mood-label">${m.label}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Journal Entry</label>
            <textarea class="form-textarea" id="journal-text" 
              placeholder="Write about your day, what you accomplished, how you felt, and what you want to improve..."
              style="min-height:140px">${existing?.note || ''}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Habits Completed Today</label>
            <div style="display:flex;flex-wrap:wrap;gap:8px" id="journal-habits-check">
              ${DB.getHabits().map(h => {
                const done = existing?.habits?.includes(h.id) || DB.getCompletion(h.id, todayStr) === 'completed';
                return `
                  <div class="journal-habit-tag" style="cursor:pointer;border:1px solid transparent;transition:all 0.2s;${done?'background:rgba(139,92,246,0.2);border-color:rgba(139,92,246,0.4)':''}"
                       onclick="JournalPage.toggleHabitTag(this,'${h.id}')" 
                       data-habit="${h.id}" data-selected="${done?'1':'0'}">
                    ${h.icon} ${h.name}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          <button class="btn btn-primary" onclick="JournalPage.saveEntry()">
            💾 Save Entry
          </button>
        </div>
      </div>
    `;

    this._selectedMood = existing?.mood || null;
  },

  _selectedMood: null,

  selectMood(id, el) {
    document.querySelectorAll('.mood-option').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    this._selectedMood = id;
  },

  toggleHabitTag(el, habitId) {
    const selected = el.dataset.selected === '1';
    el.dataset.selected = selected ? '0' : '1';
    el.style.background = selected ? '' : 'rgba(139,92,246,0.2)';
    el.style.borderColor = selected ? 'transparent' : 'rgba(139,92,246,0.4)';
  },

  saveEntry() {
    const note = document.getElementById('journal-text')?.value.trim();
    const habits = [...document.querySelectorAll('#journal-habits-check [data-selected="1"]')].map(el => el.dataset.habit);

    const entry = {
      date: today(),
      mood: this._selectedMood || 'okay',
      note: note || '',
      habits
    };

    DB.saveJournalEntry(entry);
    showToast('📔 Journal entry saved!', 'success');
    this.renderEntries();
  },

  renderEntries() {
    const entries = DB.getJournal();
    const el = document.getElementById('journal-entries-container');
    if (!el) return;

    if (entries.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📔</div><h3>No entries yet</h3><p>Start writing your daily reflections above.</p></div>`;
      return;
    }

    const moodMap = { amazing:'🚀', productive:'⚡', good:'😊', okay:'😐', tired:'😴', bad:'😔' };

    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:4px">
        ${entries.slice(0,30).map(entry => `
          <div class="card journal-entry-card">
            <div class="journal-entry-header">
              <div class="journal-entry-date">${formatDisplayDate(entry.date)}</div>
              <div class="journal-entry-mood">
                ${moodMap[entry.mood] || '😐'} <span class="text-xs text-muted">${entry.mood}</span>
              </div>
            </div>
            ${entry.note ? `<div class="journal-entry-text">${entry.note}</div>` : '<div class="text-xs text-muted">No note written.</div>'}
            ${entry.habits?.length ? `
              <div class="journal-habits-done">
                ${entry.habits.map(hid => {
                  const h = DB.getHabits().find(x => x.id === hid);
                  return h ? `<span class="journal-habit-tag">${h.icon} ${h.name}</span>` : '';
                }).filter(Boolean).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  },

  renderMiniCalendar() {
    const el = document.getElementById('journal-mini-cal');
    if (!el) return;

    const year = this.calYear;
    const month = this.calMonth;
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = new Date(year, month, 1).getDay();
    const adjustedFirst = firstDay === 0 ? 6 : firstDay - 1;
    const todayStr = today();
    const entries = DB.getJournal();
    const entryDates = new Set(entries.map(e => e.date));
    const dayNames = ['Mo','Tu','We','Th','Fr','Sa','Su'];

    let cells = dayNames.map(d => `<div class="mini-cal-day-header">${d}</div>`).join('');
    for (let i = 0; i < adjustedFirst; i++) cells += '<div></div>';

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday = dateStr === todayStr;
      const hasEntry = entryDates.has(dateStr);
      cells += `<div class="mini-cal-day ${isToday?'today':''} ${hasEntry?'has-entry':''}" 
                     onclick="JournalPage.openDate('${dateStr}')">${d}</div>`;
    }

    el.innerHTML = `
      <div class="mini-calendar">
        <div class="mini-cal-header">
          <button class="mini-cal-nav" onclick="JournalPage.prevCalMonth()">‹</button>
          <div class="mini-cal-title">${getMonthName(month)} ${year}</div>
          <button class="mini-cal-nav" onclick="JournalPage.nextCalMonth()">›</button>
        </div>
        <div class="mini-cal-grid">${cells}</div>
      </div>
    `;
  },

  openDate(dateStr) {
    const entry = DB.getJournalEntry(dateStr);
    if (!entry) { showToast('No entry for this day', 'info'); return; }
    const moodMap = { amazing:'🚀', productive:'⚡', good:'😊', okay:'😐', tired:'😴', bad:'😔' };
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal animate-scale-in">
        <div class="modal-header">
          <div class="modal-title">📔 ${formatDisplayDate(dateStr)}</div>
          <button class="btn btn-icon btn-ghost" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:16px">
          <div style="display:flex;align-items:center;gap:12px;padding:16px;background:rgba(139,92,246,0.05);border-radius:12px;border:1px solid var(--border-accent)">
            <span style="font-size:32px">${moodMap[entry.mood]||'😐'}</span>
            <div>
              <div class="font-semibold">Mood: ${entry.mood}</div>
              <div class="text-xs text-muted">${formatDisplayDate(dateStr)}</div>
            </div>
          </div>
          ${entry.note ? `<p style="color:var(--text-secondary);line-height:1.8">${entry.note}</p>` : ''}
          ${entry.habits?.length ? `
            <div>
              <div class="text-xs text-muted mb-2">Habits completed:</div>
              <div style="display:flex;flex-wrap:wrap;gap:6px">
                ${entry.habits.map(hid => {
                  const h = DB.getHabits().find(x => x.id === hid);
                  return h ? `<span class="badge badge-purple">${h.icon} ${h.name}</span>` : '';
                }).filter(Boolean).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  },

  prevCalMonth() {
    if (this.calMonth === 0) { this.calMonth = 11; this.calYear--; } else this.calMonth--;
    this.renderMiniCalendar();
  },

  nextCalMonth() {
    if (this.calMonth === 11) { this.calMonth = 0; this.calYear++; } else this.calMonth++;
    this.renderMiniCalendar();
  }
};

window.JournalPage = JournalPage;
