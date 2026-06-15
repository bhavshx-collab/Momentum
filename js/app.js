/**
 * app.js — Router, global utilities, initialization
 */

// ────────────────────────────────────────────────
//  ROUTER
// ────────────────────────────────────────────────
const Router = {
  currentPage: 'dashboard',
  currentParam: null,

  navigate(page, param = null) {
    this.currentPage = page;
    this.currentParam = param;

    // Update URL hash
    window.location.hash = param ? `${page}/${param}` : page;

    this.render();
  },

  render() {
    const page = this.currentPage;
    const param = this.currentParam;

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Destroy analytics charts if leaving analytics
    if (page !== 'analytics' && Analytics.charts) {
      Analytics.destroyCharts();
    }

    // Show and render the right page
    switch (page) {
      case 'dashboard':
        this._show('page-dashboard');
        Dashboard.render();
        break;

      case 'habits':
        this._show('page-habits');
        HabitsPage.render();
        break;

      case 'habit-detail':
        this._show('page-habit-detail');
        HabitDetail.render(param);
        break;

      case 'calendar':
        this._show('page-calendar');
        CalendarPage.render();
        break;

      case 'analytics':
        this._show('page-analytics');
        requestAnimationFrame(() => Analytics.render());
        break;

      case 'goals':
        this._show('page-goals');
        GoalsPage.render();
        break;

      case 'journal':
        this._show('page-journal');
        JournalPage.render();
        break;

      case 'settings':
        this._show('page-settings');
        SettingsPage.render();
        break;

      default:
        this._show('page-dashboard');
        Dashboard.render();
    }

    // Scroll to top
    document.querySelector('.page-content')?.scrollTo(0, 0);

    // Close mobile sidebar
    document.querySelector('.sidebar')?.classList.remove('mobile-open');
  },

  _show(id) {
    document.getElementById(id)?.classList.add('active');
  },

  init() {
    // Parse initial hash
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const [page, param] = hash.split('/');
      this.currentPage = page || 'dashboard';
      this.currentParam = param || null;
    }
    this.render();
  }
};

// ────────────────────────────────────────────────
//  CALENDAR PAGE
// ────────────────────────────────────────────────
const CalendarPage = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(),

  render() {
    this.renderCalendar();
    this.renderHabitLegend();
  },

  renderCalendar() {
    const el = document.getElementById('full-calendar-grid');
    if (!el) return;

    const year = this.year;
    const month = this.month;
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = new Date(year, month, 1).getDay();
    const adjustedFirst = firstDay === 0 ? 6 : firstDay - 1;
    const todayStr = today();
    const habits = DB.getHabits();
    const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    document.getElementById('cal-month-display').textContent = `${getMonthName(month)} ${year}`;

    let html = dayNames.map(d => `<div class="cal-day-header">${d}</div>`).join('');

    // Padding
    for (let i = 0; i < adjustedFirst; i++) {
      html += `<div class="cal-day other-month"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday = dateStr === todayStr;
      const cellDate = new Date(year, month, d); cellDate.setHours(0,0,0,0);
      const isFuture = cellDate > new Date().setHours(0,0,0,0);

      let completed = 0;
      const dots = habits.slice(0,8).map(h => {
        const s = DB.getCompletion(h.id, dateStr);
        if (s === 'completed') completed++;
        const bgColor = s === 'completed' ? h.color : s === 'missed' ? '#ef4444' : s === 'partial' ? '#f59e0b' : 'transparent';
        return s !== 'empty' ? `<div class="cal-dot" style="background:${bgColor}"></div>` : '';
      }).join('');

      const rate = !isFuture && habits.length > 0 ? Math.round((completed/habits.length)*100) : null;

      html += `
        <div class="cal-day ${isToday?'today':''}" onclick="CalendarPage.showDayDetail('${dateStr}')">
          <div class="cal-day-number">${d}</div>
          <div class="cal-day-dots">${dots}</div>
          ${rate !== null ? `<div class="cal-completion-rate">${rate}%</div>` : ''}
        </div>
      `;
    }

    el.innerHTML = html;
  },

  renderHabitLegend() {
    const el = document.getElementById('cal-habit-legend');
    if (!el) return;
    const habits = DB.getHabits();
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        ${habits.map(h => `
          <div class="flex items-center gap-2">
            <div style="width:10px;height:10px;border-radius:3px;background:${h.color};flex-shrink:0"></div>
            <span class="text-sm text-secondary">${h.icon} ${h.name}</span>
          </div>
        `).join('')}
      </div>
    `;
  },

  showDayDetail(dateStr) {
    const habits = DB.getHabits();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal animate-scale-in">
        <div class="modal-header">
          <div class="modal-title">📅 ${formatDisplayDate(dateStr)}</div>
          <button class="btn btn-icon btn-ghost" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:0">
          ${habits.map(h => {
            const s = DB.getCompletion(h.id, dateStr);
            const icon = s === 'completed' ? '✅' : s === 'missed' ? '❌' : s === 'partial' ? '🟡' : '⚫';
            return `
              <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-color)">
                <span style="font-size:20px">${h.icon}</span>
                <div style="flex:1">
                  <div class="font-semibold text-sm">${h.name}</div>
                  <div class="text-xs text-muted">${h.category}</div>
                </div>
                <span style="font-size:18px">${icon}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  },

  prevMonth() {
    if (this.month === 0) { this.month = 11; this.year--; } else this.month--;
    this.renderCalendar();
  },

  nextMonth() {
    if (this.month === 11) { this.month = 0; this.year++; } else this.month++;
    this.renderCalendar();
  }
};

// ────────────────────────────────────────────────
//  SETTINGS PAGE
// ────────────────────────────────────────────────
const SettingsPage = {
  activeSection: 'profile',

  render() {
    this.switchSection(this.activeSection);
    this.renderUserInfo();
  },

  switchSection(section) {
    this.activeSection = section;
    document.querySelectorAll('.settings-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.section === section);
    });
    document.querySelectorAll('.settings-section').forEach(el => {
      el.classList.toggle('active', el.id === `settings-${section}`);
    });
  },

  renderUserInfo() {
    const user = DB.get().user;
    const el = document.getElementById('settings-user-form');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px;padding:20px;background:rgba(139,92,246,0.05);border-radius:16px;border:1px solid var(--border-accent)">
        <div style="width:72px;height:72px;border-radius:50%;background:var(--gradient-purple);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:white;box-shadow:0 0 20px rgba(139,92,246,0.4)">
          ${user.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style="font-size:20px;font-weight:700">${user.name}</div>
          <div class="text-sm text-muted">${user.email}</div>
          <div class="text-xs text-muted mt-1">Member since ${new Date(user.joinDate+'T00:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Display Name</label>
        <input class="form-input" id="s-name" value="${user.name}">
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" id="s-email" value="${user.email}">
      </div>
      <button class="btn btn-primary" onclick="SettingsPage.saveProfile()">Save Profile</button>
    `;
  },

  saveProfile() {
    const name = document.getElementById('s-name')?.value.trim();
    const email = document.getElementById('s-email')?.value.trim();
    if (!name) { showToast('Name cannot be empty', 'error'); return; }
    DB.get().user = { ...DB.get().user, name, email };
    DB.save();
    showToast('✅ Profile saved!', 'success');
  },

  toggleSetting(key) {
    const settings = DB.get().settings;
    settings[key] = !settings[key];
    DB.save();
    const toggle = document.getElementById(`toggle-${key}`);
    if (toggle) toggle.classList.toggle('on', settings[key]);
    showToast(`Setting ${settings[key] ? 'enabled' : 'disabled'}`, 'info');
  },

  exportData() {
    const data = JSON.stringify(DB.get(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `momentum-backup-${today()}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast('📥 Data exported!', 'success');
  },

  resetData() {
    if (!confirm('⚠️ This will delete ALL your data and reset to defaults. Are you sure?')) return;
    localStorage.removeItem('momentum_v1');
    DB._data = null; DB.load();
    showToast('♻️ Data reset to defaults', 'info');
    Router.navigate('dashboard');
  }
};

// ────────────────────────────────────────────────
//  TOAST NOTIFICATION
// ────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ────────────────────────────────────────────────
//  CATEGORY COLORS
// ────────────────────────────────────────────────
function categoryColor(cat) {
  const map = {
    Fitness:'rose', Health:'emerald', Study:'blue', Coding:'purple',
    Personal:'amber', Reading:'amber', Mindfulness:'cyan', Finance:'green',
    Creative:'pink', Other:'purple'
  };
  return map[cat] || 'purple';
}

// ────────────────────────────────────────────────
//  MOBILE SIDEBAR TOGGLE
// ────────────────────────────────────────────────
function toggleMobileSidebar() {
  document.querySelector('.sidebar')?.classList.toggle('mobile-open');
}

// ────────────────────────────────────────────────
//  INIT
// ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  DB.load();

  // Set initial nav active states
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      Router.navigate(item.dataset.page);
    });
  });

  document.querySelectorAll('.mobile-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      Router.navigate(item.dataset.page);
    });
  });

  // Handle hash navigation
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const [page, param] = hash.split('/');
      Router.currentPage = page;
      Router.currentParam = param || null;
      Router.render();
    }
  });

  // Initialize matrix month display
  Matrix.updateMonthDisplay();

  // Navigate to initial page
  Router.init();
});

window.Router = Router;
window.CalendarPage = CalendarPage;
window.SettingsPage = SettingsPage;
window.showToast = showToast;
window.categoryColor = categoryColor;
window.toggleMobileSidebar = toggleMobileSidebar;
