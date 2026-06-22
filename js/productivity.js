/**
 * productivity.js — Productivity Score & Growth Reviews
 */

// Daily productivity score calculations
function calculateDailyScore(dateStr) {
  // 1. Habits (35%)
  const activeHabits = S.habits.filter(h => h.active);
  let habitsScore = 100;
  if (activeHabits.length > 0) {
    let completedCount = 0;
    activeHabits.forEach(h => {
      const state = gc(h.id, dateStr);
      if (state === 'dn' || state === 'dn_late') {
        completedCount++;
      } else if (state === 'pt') {
        completedCount += 0.5; // partial completion counts as half
      }
    });
    habitsScore = Math.round((completedCount / activeHabits.length) * 100);
  }

  // 2. Tasks (25%)
  let tasksScore = 100;
  const dayTasks = S.tasks ? S.tasks.filter(t => t.date === dateStr) : [];
  if (dayTasks.length > 0) {
    const completedTasks = dayTasks.filter(t => t.status === 'completed').length;
    tasksScore = Math.round((completedTasks / dayTasks.length) * 100);
  }

  // 3. Focus (20%)
  let focusScore = 0;
  const goalHours = (S.focusSettings && S.focusSettings.focusGoal) || 4;
  const goalMinutes = goalHours * 60;
  
  let focusMinutesToday = 0;
  if (S.focusSessions) {
    const todaySessions = S.focusSessions.filter(s => {
      // session date might be timestamp, let's compare format YYYY-MM-DD
      const sessDate = s.startTime ? s.startTime.substring(0, 10) : '';
      return sessDate === dateStr;
    });
    const totalSecs = todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    focusMinutesToday = totalSecs / 60;
  }
  
  if (goalMinutes > 0) {
    focusScore = Math.min(100, Math.round((focusMinutesToday / goalMinutes) * 100));
  }

  // 4. Goals (10%)
  let goalsScore = 100;
  if (S.goals && S.goals.length > 0) {
    const totalProg = S.goals.reduce((sum, g) => sum + (g.progress || 0), 0);
    goalsScore = Math.round(totalProg / S.goals.length);
  }

  // 5. Journal (10%)
  let journalScore = 0;
  if (S.journal) {
    const hasEntry = S.journal.some(j => j.date === dateStr);
    journalScore = hasEntry ? 100 : 0;
  }

  // Total weighted score
  const total = Math.round(
    (habitsScore * 0.35) +
    (tasksScore * 0.25) +
    (focusScore * 0.20) +
    (goalsScore * 0.10) +
    (journalScore * 0.10)
  );

  return {
    habits: habitsScore,
    tasks: tasksScore,
    focus: focusScore,
    goals: goalsScore,
    journal: journalScore,
    total
  };
}

// Update today's score and save it
function updateTodayProductivityScore() {
  if (!S.productivityScores) S.productivityScores = {};
  const t = today();
  const scoreData = calculateDailyScore(t);
  S.productivityScores[t] = scoreData;
  save();
  renderProductivityScoreWidget();
}

// Render score widget in dashboard
function renderProductivityScoreWidget() {
  const t = today();
  const scoreData = (S.productivityScores && S.productivityScores[t]) || calculateDailyScore(t);
  
  // Real-time topbar update
  const topbarScoreEl = document.getElementById('rt-status-score');
  if (topbarScoreEl) {
    topbarScoreEl.textContent = `${scoreData.total}%`;
  }
  
  // Dashboard card render (if dashboard is active and widget wrapper exists)
  const widgetEl = document.getElementById('dash-score-widget');
  if (widgetEl && curPage === 'dashboard') {
    widgetEl.innerHTML = `
      <div class="card score-widget-card">
        <div class="swc-header">
          <span class="swc-title">Productivity Score</span>
          <span class="badge bp2">Today</span>
        </div>
        <div class="swc-body">
          <div class="swc-ring-container">
            <svg class="swc-ring" viewBox="0 0 36 36">
              <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path class="ring-fill" stroke-dasharray="${scoreData.total}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div class="swc-ring-val">${scoreData.total}%</div>
          </div>
          <div class="swc-breakdown">
            <div class="swc-lbl-item"><span>🏃 Habits (35%):</span> <strong>${scoreData.habits}%</strong></div>
            <div class="swc-lbl-item"><span>✅ Tasks (25%):</span> <strong>${scoreData.tasks}%</strong></div>
            <div class="swc-lbl-item"><span>🎯 Focus (20%):</span> <strong>${scoreData.focus}%</strong></div>
            <div class="swc-lbl-item"><span>📈 Goals (10%):</span> <strong>${scoreData.goals}%</strong></div>
            <div class="swc-lbl-item"><span>📝 Journal (10%):</span> <strong>${scoreData.journal}%</strong></div>
          </div>
        </div>
      </div>
    `;
  }
}

// Performance Reviews rendering
let activeReviewTab = 'weekly';

function renderReviews() {
  const container = document.getElementById('reviews-container');
  if (!container) return;

  // Active reviews navigation tabs
  const tabSelectorHtml = `
    <div class="reviews-tabs mb4">
      <button class="reviews-tab-btn ${activeReviewTab === 'weekly' ? 'active' : ''}" onclick="switchReviewTab('weekly')">📅 Weekly Review</button>
      <button class="reviews-tab-btn ${activeReviewTab === 'monthly' ? 'active' : ''}" onclick="switchReviewTab('monthly')">🌙 Monthly Review</button>
      <button class="reviews-tab-btn ${activeReviewTab === 'yearly' ? 'active' : ''}" onclick="switchReviewTab('yearly')">🌟 Yearly Summary</button>
    </div>
  `;

  let bodyHtml = '';

  if (activeReviewTab === 'weekly') {
    bodyHtml = generateWeeklyReviewHTML();
  } else if (activeReviewTab === 'monthly') {
    bodyHtml = generateMonthlyReviewHTML();
  } else {
    bodyHtml = generateYearlyReviewHTML();
  }

  container.innerHTML = tabSelectorHtml + bodyHtml;
}

function switchReviewTab(tab) {
  activeReviewTab = tab;
  renderReviews();
}

function generateWeeklyReviewHTML() {
  const todayDate = new Date();
  // Sunday of current week
  const day = todayDate.getDay();
  const diff = todayDate.getDate() - day; // diff to Sunday
  const sunday = new Date(todayDate.setDate(diff));
  sunday.setHours(0,0,0,0);
  
  // Let's generate scores for last 7 days starting from Monday of this week
  const monday = new Date(sunday);
  monday.setDate(sunday.getDate() - 6);

  let totalScoreSum = 0;
  let count = 0;
  let habitsDone = 0;
  let tasksDone = 0;
  let totalFocusMinutes = 0;
  let journalEntries = 0;
  const scoresData = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = fd(d);
    
    const dayScore = calculateDailyScore(dateStr);
    scoresData.push({ date: dateStr, score: dayScore.total });
    
    totalScoreSum += dayScore.total;
    count++;

    // Aggregate stats
    // Habits completed
    S.habits.forEach(h => {
      const s = gc(h.id, dateStr);
      if (s === 'dn' || s === 'dn_late') habitsDone++;
      else if (s === 'pt') habitsDone += 0.5;
    });

    // Tasks completed
    if (S.tasks) {
      const completedTasks = S.tasks.filter(t => t.date === dateStr && t.status === 'completed').length;
      tasksDone += completedTasks;
    }

    // Focus minutes
    if (S.focusSessions) {
      const todaySessions = S.focusSessions.filter(s => {
        const sessDate = s.startTime ? s.startTime.substring(0, 10) : '';
        return sessDate === dateStr;
      });
      const totalSec = todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
      totalFocusMinutes += (totalSec / 60);
    }

    // Journal
    if (S.journal && S.journal.some(j => j.date === dateStr)) {
      journalEntries++;
    }
  }

  const avgScore = count > 0 ? Math.round(totalScoreSum / count) : 0;
  const weekStartStr = fDisp(fd(monday));
  const weekEndStr = fDisp(fd(sunday));

  // Determine insight text
  let insightText = '';
  if (avgScore >= 80) {
    insightText = '✨ Exceptional work! You are maintaining an elite level of consistency. Keep harnessing this momentum!';
  } else if (avgScore >= 60) {
    insightText = '👍 Good job! You are building solid habits. Try completing a few more pending tasks to push your score over 80%.';
  } else {
    insightText = '⚠️ Consistent action breeds success. Set smaller targets this upcoming week to kickstart your streaks again.';
  }

  return `
    <div class="card rev-card">
      <div class="rev-header bg-weekly">
        <h3 class="rev-title">Weekly Performance Report</h3>
        <p class="rev-subtitle">${weekStartStr} – ${weekEndStr}</p>
      </div>
      
      <div class="rev-main-metrics">
        <div class="rev-metric-ring-box">
          <svg class="rev-metric-ring" viewBox="0 0 36 36">
            <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path class="ring-fill border-weekly" stroke-dasharray="${avgScore}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          </svg>
          <div class="rev-metric-ring-val">${avgScore}%</div>
          <div class="rev-metric-ring-lbl">Weekly Score</div>
        </div>
        
        <div class="rev-metrics-details">
          <div class="rev-det-item">🏃 Habits Completed: <strong>${Math.round(habitsDone)}</strong></div>
          <div class="rev-det-item">✅ Tasks Finished: <strong>${tasksDone}</strong></div>
          <div class="rev-det-item">🎯 Total Deep Work: <strong>${Math.round(totalFocusMinutes)} mins</strong></div>
          <div class="rev-det-item">📝 Journal Logs: <strong>${journalEntries}/7 days</strong></div>
        </div>
      </div>

      <div class="rev-chart-area">
        <h4 class="rev-sec-title">📅 Daily Score Breakdown</h4>
        <div style="display: flex; gap: 8px; justify-content: space-between; align-items: flex-end; height: 120px; padding: 10px 0;">
          ${scoresData.map(sd => {
            const dayName = getDayName(sd.date).substring(0, 3);
            return `
              <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
                <div style="font-size: 9px; font-weight: 600; color: var(--t2); margin-bottom: 4px;">${sd.score}%</div>
                <div style="width: 100%; max-width: 24px; height: ${sd.score}px; background: linear-gradient(180deg, var(--p1), rgba(139,92,246,0.3)); border-radius: 4px; min-height: 4px;"></div>
                <div style="font-size: 10px; color: var(--t3); margin-top: 6px;">${dayName}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="rev-insights border-weekly-inset">
        <h4 class="rev-sec-title">💡 Performance Insights</h4>
        <p class="rev-insights-text">${insightText}</p>
      </div>
    </div>
  `;
}

function generateMonthlyReviewHTML() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthDays = dim(year, month);

  let totalScoreSum = 0;
  let count = 0;
  let focusMins = 0;
  let tasksCompleted = 0;

  for (let d = 1; d <= monthDays; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayScore = calculateDailyScore(dateStr);
    totalScoreSum += dayScore.total;
    count++;

    // Tasks completed
    if (S.tasks) {
      tasksCompleted += S.tasks.filter(t => t.date === dateStr && t.status === 'completed').length;
    }

    // Focus
    if (S.focusSessions) {
      const todaySessions = S.focusSessions.filter(s => {
        const sessDate = s.startTime ? s.startTime.substring(0, 10) : '';
        return sessDate === dateStr;
      });
      const totalSec = todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
      focusMins += (totalSec / 60);
    }
  }

  const avgScore = count > 0 ? Math.round(totalScoreSum / count) : 0;
  const monthLabel = mnName(month) + ' ' + year;

  // Let's find top performing custom categories
  const activeAreas = S.lifeAreas ? S.lifeAreas.filter(la => !la.archived) : [];
  const categoryScores = activeAreas.map(la => {
    const habitsInCat = S.habits.filter(h => h.category === la.name && h.active);
    let avgRate = 0;
    if (habitsInCat.length > 0) {
      const totalRate = habitsInCat.reduce((sum, h) => sum + hStats(h.id).rate, 0);
      avgRate = Math.round(totalRate / habitsInCat.length);
    }
    return { name: la.name, score: avgRate, icon: la.icon, color: la.color };
  }).sort((a, b) => b.score - a.score);

  return `
    <div class="card rev-card">
      <div class="rev-header bg-monthly">
        <h3 class="rev-title">Monthly Growth Statement</h3>
        <p class="rev-subtitle">${monthLabel}</p>
      </div>

      <div class="rev-main-metrics">
        <div class="rev-metric-ring-box">
          <svg class="rev-metric-ring" viewBox="0 0 36 36">
            <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path class="ring-fill border-monthly" stroke-dasharray="${avgScore}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          </svg>
          <div class="rev-metric-ring-val">${avgScore}%</div>
          <div class="rev-metric-ring-lbl">Monthly Score</div>
        </div>

        <div class="rev-metrics-details">
          <div class="rev-det-item">🎯 Deep Work Focused: <strong>${Math.round(focusMins / 60)} hrs</strong></div>
          <div class="rev-det-item">✅ Project Tasks Cleared: <strong>${tasksCompleted}</strong></div>
          <div class="rev-det-item">📊 Tracked Life Domains: <strong>${activeAreas.length} Areas</strong></div>
          <div class="rev-det-item">💪 Strongest Domain: <strong>${categoryScores.length > 0 ? categoryScores[0].icon + ' ' + categoryScores[0].name : 'None'}</strong></div>
        </div>
      </div>

      <div class="rev-insights">
        <h4 class="rev-sec-title">🌱 Category Balance Standings</h4>
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px">
          ${categoryScores.map(cs => `
            <div class="flex aic jb" style="padding: 6px 0; border-bottom: 1px solid var(--border-color)">
              <span class="flex aic gap2"><span style="color:${cs.color}">${cs.icon}</span> ${cs.name}</span>
              <span class="badge" style="background:${cs.color}15; color:${cs.color}; font-weight:700">${cs.score}%</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function generateYearlyReviewHTML() {
  const currentYear = new Date().getFullYear();
  const activeAreas = S.lifeAreas ? S.lifeAreas.filter(la => !la.archived) : [];
  const habitsCount = S.habits ? S.habits.length : 0;
  const completedGoals = S.goals ? S.goals.filter(g => g.progress === 100).length : 0;
  const activeChallenges = S.challenges ? S.challenges.length : 0;
  
  // Year average
  let yearAvgScore = 75; // Default fallback representation if no records
  if (S.productivityScores) {
    const scores = Object.values(S.productivityScores).map(s => s.total);
    if (scores.length > 0) {
      yearAvgScore = Math.round(scores.reduce((a,b) => a+b, 0) / scores.length);
    }
  }

  return `
    <div class="card rev-card">
      <div class="rev-header bg-yearly">
        <h3 class="rev-title">Yearly Summary Dashboard</h3>
        <p class="rev-subtitle">Year ${currentYear}</p>
      </div>

      <div class="rev-main-metrics">
        <div class="rev-metric-ring-box">
          <svg class="rev-metric-ring" viewBox="0 0 36 36">
            <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path class="ring-fill border-yearly" stroke-dasharray="${yearAvgScore}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 -31.831" />
          </svg>
          <div class="rev-metric-ring-val">${yearAvgScore}%</div>
          <div class="rev-metric-ring-lbl">Year Average</div>
        </div>

        <div class="rev-metrics-details">
          <div class="rev-det-item">🏃 Habits Maintained: <strong>${habitsCount}</strong></div>
          <div class="rev-det-item">🎯 Long-term Goals Accomplished: <strong>${completedGoals}</strong></div>
          <div class="rev-det-item">🏆 Challenges Attempted: <strong>${activeChallenges}</strong></div>
          <div class="rev-det-item">🌱 Growth Areas Formulated: <strong>${activeAreas.length} Areas</strong></div>
        </div>
      </div>

      <div class="rev-insights border-yearly-inset">
        <h4 class="rev-sec-title">🌟 Annual Reflection</h4>
        <p class="rev-insights-text">
          Congratulations on investing in yourself this year. Across ${activeAreas.length} custom-defined domains of life, you have formulated structured systems to maintain focus, track milestones, and reflect on consistency. Here is to another year of progress and higher momentum!
        </p>
      </div>
    </div>
  `;
}

// Hook to daily checks (runs once when system is opened)
function initProductivityScores() {
  updateTodayProductivityScore();
}

// Expose globally
window.calculateDailyScore = calculateDailyScore;
window.updateTodayProductivityScore = updateTodayProductivityScore;
window.renderProductivityScoreWidget = renderProductivityScoreWidget;
window.renderReviews = renderReviews;
window.switchReviewTab = switchReviewTab;
window.initProductivityScores = initProductivityScores;
