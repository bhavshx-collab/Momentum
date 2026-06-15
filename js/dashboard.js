/**
 * dashboard.js — Dashboard page rendering
 */

const Dashboard = {
  render() {
    const stats = DB.getOverallStats();
    const habits = DB.getHabits();
    const todayStr = today();
    const now = new Date();

    // Greeting
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    const dateStr = now.toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

    document.getElementById('header-greeting').textContent = `${greeting}, Bhavesh 👋`;
    document.getElementById('header-date').textContent = dateStr;

    this.renderOverviewCards(stats, habits.length);
    this.renderTodaysHabits(habits, todayStr);
    this.renderMatrix();
    this.renderMonthSummary();
    this.renderPerformance();
  },

  renderOverviewCards(stats, totalHabits) {
    const el = document.getElementById('overview-cards');
    el.innerHTML = `
      <div class="card overview-card card-accent-purple animate-fade-in">
        <span class="oc-icon streak-fire">🔥</span>
        <div class="oc-value">${stats.streak}<span class="oc-unit"> Days</span></div>
        <div class="oc-label">Current Streak</div>
        <div class="oc-sub">Keep it up! 🚀</div>
        <div class="oc-bg">🔥</div>
      </div>
      <div class="card overview-card card-accent-blue animate-fade-in">
        <span class="oc-icon">🏆</span>
        <div class="oc-value">${stats.longestStreak}<span class="oc-unit"> Days</span></div>
        <div class="oc-label">Longest Streak</div>
        <div class="oc-sub">Personal best</div>
        <div class="oc-bg">🏆</div>
      </div>
      <div class="card overview-card card-accent-emerald animate-fade-in">
        <span class="oc-icon">📈</span>
        <div class="oc-value">${stats.successRate}<span class="oc-unit">%</span></div>
        <div class="oc-label">Success Rate</div>
        <div class="oc-sub">Last 30 days</div>
        <div class="oc-bg">📈</div>
      </div>
      <div class="card overview-card card-accent-amber animate-fade-in">
        <span class="oc-icon">✅</span>
        <div class="oc-value">${stats.completedToday}<span class="oc-unit">/${stats.totalHabits}</span></div>
        <div class="oc-label">Completed Today</div>
        <div class="oc-sub">${stats.totalHabits > 0 ? Math.round((stats.completedToday/stats.totalHabits)*100) : 0}% done</div>
        <div class="oc-bg">✅</div>
      </div>
    `;
  },

  renderTodaysHabits(habits, todayStr) {
    const el = document.getElementById('todays-habits-list');
    if (!el) return;

    if (habits.length === 0) {
      el.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-secondary)">
          <div style="font-size: 48px; margin-bottom: 16px">🎯</div>
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px">No habits added yet</div>
          <p style="font-size: 14px; color: var(--text-muted); max-width: 280px; margin: 0 auto 16px">
            Start tracking your daily routines by adding your first habit.
          </p>
          <button class="btn btn-primary btn-sm" onclick="Router.navigate('habits')">+ Add First Habit</button>
        </div>
      `;
      return;
    }

    el.innerHTML = habits.map(h => {
      const state = DB.getCompletion(h.id, todayStr);
      const done = state === 'completed';
      const stats = DB.getHabitStats(h.id);
      return `
        <div class="habit-row ${done ? 'completed' : ''}" id="habit-row-${h.id}" onclick="Dashboard.toggleTodayHabit('${h.id}')">
          <button class="habit-row-toggle ${done ? 'done' : ''}" aria-label="Toggle ${h.name}">
            ${done ? '✓' : ''}
          </button>
          <div class="habit-row-info">
            <div class="habit-row-name">${h.icon} ${h.name}</div>
            <div class="habit-row-meta">
              <span class="badge badge-${categoryColor(h.category)}">${h.category}</span>
              <span class="habit-row-streak">🔥 ${stats.streak} day streak</span>
            </div>
          </div>
          <div class="habit-row-right">
            <span class="badge ${done ? 'badge-green' : 'badge-purple'}">${done ? 'Done' : 'Pending'}</span>
          </div>
        </div>
      `;
    }).join('');
  },

  toggleTodayHabit(habitId) {
    const todayStr = today();
    const cur = DB.getCompletion(habitId, todayStr);
    const next = cur === 'completed' ? 'empty' : 'completed';
    DB.setCompletion(habitId, todayStr, next);

    // Update row
    const row = document.getElementById(`habit-row-${habitId}`);
    const toggle = row.querySelector('.habit-row-toggle');
    const badge = row.querySelector('.badge:last-child');

    if (next === 'completed') {
      row.classList.add('completed');
      toggle.classList.add('done');
      toggle.textContent = '✓';
      badge.className = 'badge badge-green';
      badge.textContent = 'Done';
      showToast(`✅ ${DB.getHabits().find(h=>h.id===habitId)?.name} marked done!`, 'success');
    } else {
      row.classList.remove('completed');
      toggle.classList.remove('done');
      toggle.textContent = '';
      badge.className = 'badge badge-purple';
      badge.textContent = 'Pending';
    }

    // Update overview cards
    const stats = DB.getOverallStats();
    this.renderOverviewCards(stats, DB.getHabits().length);

    // Update matrix cell for today
    Matrix.updateCell(habitId, todayStr);
  },

  renderMatrix() {
    Matrix.render('dashboard-matrix-container');
  },

  renderMonthSummary() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const habits = DB.getHabits();
    const todayDate = now.getDate();

    let completedDays = 0, missedDays = 0;
    let totalCells = 0, completedCells = 0;

    for (let d = 1; d <= todayDate; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      let dayCompleted = 0;
      habits.forEach(h => {
        const s = DB.getCompletion(h.id, dateStr);
        if (s === 'completed') { dayCompleted++; completedCells++; }
        if (s !== 'empty') totalCells++;
      });
      if (dayCompleted === habits.length) completedDays++;
      else if (dayCompleted === 0 && d < todayDate) missedDays++;
    }

    const rate = totalCells > 0 ? Math.round((completedCells/totalCells)*100) : 0;

    document.getElementById('month-summary').innerHTML = `
      <div class="month-summary-grid">
        <div class="summary-stat">
          <div class="summary-stat-value text-emerald">${completedDays}</div>
          <div class="summary-stat-label">✅ Completed Days</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value text-rose">${missedDays}</div>
          <div class="summary-stat-label">❌ Missed Days</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value text-purple">${habits.length}</div>
          <div class="summary-stat-label">📊 Total Habits</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value text-amber">${rate}%</div>
          <div class="summary-stat-label">🎯 Completion Rate</div>
        </div>
      </div>
    `;
  },

  renderPerformance() {
    const habits = DB.getHabits();
    const bestEl = document.getElementById('perf-best');
    const needsEl = document.getElementById('perf-needs');
    if (!bestEl || !needsEl) return;

    if (habits.length === 0) {
      bestEl.innerHTML = '<div style="padding: 12px; color: var(--text-muted); font-size: 13px;">No data.</div>';
      needsEl.innerHTML = '<div style="padding: 12px; color: var(--text-muted); font-size: 13px;">No data.</div>';
      return;
    }

    const statsArr = habits.map(h => ({
      habit: h,
      stats: DB.getHabitStats(h.id)
    })).sort((a,b) => b.stats.rate - a.stats.rate);

    const best = statsArr.slice(0, 3);
    const worst = statsArr.slice(-3).reverse();

    const medals = ['🥇','🥈','🥉'];

    bestEl.innerHTML = best.map((item, i) => `
      <div class="perf-habit-row">
        <span class="perf-medal">${medals[i]}</span>
        <div class="perf-info">
          <div class="perf-name">${item.habit.icon} ${item.habit.name}</div>
          <div class="perf-bar-wrapper">
            <div class="progress-bar thin">
              <div class="progress-fill" style="width:${item.stats.rate}%;background:var(--gradient-green)"></div>
            </div>
          </div>
        </div>
        <div class="perf-percent">${item.stats.rate}%</div>
      </div>
    `).join('');

    needsEl.innerHTML = worst.map((item, i) => `
      <div class="perf-habit-row">
        <span class="perf-medal">${item.habit.icon}</span>
        <div class="perf-info">
          <div class="perf-name">${item.habit.name}</div>
          <div class="perf-bar-wrapper">
            <div class="progress-bar thin">
              <div class="progress-fill" style="width:${item.stats.rate}%;background:var(--gradient-rose)"></div>
            </div>
          </div>
        </div>
        <div class="perf-percent text-rose">${item.stats.rate}%</div>
      </div>
    `).join('');
  }
};

window.Dashboard = Dashboard;
