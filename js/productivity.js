/**
 * productivity.js — Productivity Score & Growth Reviews
 * Uses CSS classes from evolution.css
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
        completedCount += 0.5;
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
    journalScore = S.journal.some(j => j.date === dateStr) ? 100 : 0;
  }

  const total = Math.round(
    (habitsScore * 0.35) +
    (tasksScore  * 0.25) +
    (focusScore  * 0.20) +
    (goalsScore  * 0.10) +
    (journalScore* 0.10)
  );

  return { habits: habitsScore, tasks: tasksScore, focus: focusScore, goals: goalsScore, journal: journalScore, total };
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

  const topbarScoreEl = document.getElementById('rt-status-score');
  if (topbarScoreEl) topbarScoreEl.textContent = `${scoreData.total}%`;

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

// ── PERFORMANCE REVIEWS ──────────────────────────────────
let activeReviewTab = 'weekly';

function renderReviews() {
  const container = document.getElementById('reviews-container');
  if (!container) return;

  const tabSelectorHtml = `
    <div class="reviews-tab-bar">
      <button class="reviews-tab-btn ${activeReviewTab === 'weekly'  ? 'active' : ''}" onclick="switchReviewTab('weekly')">📅 Weekly</button>
      <button class="reviews-tab-btn ${activeReviewTab === 'monthly' ? 'active' : ''}" onclick="switchReviewTab('monthly')">🌙 Monthly</button>
      <button class="reviews-tab-btn ${activeReviewTab === 'yearly'  ? 'active' : ''}" onclick="switchReviewTab('yearly')">🌟 Yearly</button>
    </div>
  `;

  let bodyHtml = '';
  try {
    if      (activeReviewTab === 'weekly')  bodyHtml = generateWeeklyReviewHTML();
    else if (activeReviewTab === 'monthly') bodyHtml = generateMonthlyReviewHTML();
    else                                    bodyHtml = generateYearlyReviewHTML();
  } catch(e) {
    bodyHtml = `<div class="review-empty"><div class="review-empty-icon">📊</div><p style="color:var(--t2)">Could not generate review: ${e.message}</p></div>`;
    console.error('[Reviews] Error:', e);
  }

  container.innerHTML = tabSelectorHtml + bodyHtml;
}

function switchReviewTab(tab) {
  activeReviewTab = tab;
  renderReviews();
}

// ── WEEKLY REVIEW ─────────────────────────────────────────
function generateWeeklyReviewHTML() {
  const todayDate = new Date();
  const day = todayDate.getDay();
  const sunday = new Date(todayDate);
  sunday.setDate(todayDate.getDate() - day);
  sunday.setHours(0,0,0,0);
  const monday = new Date(sunday);
  monday.setDate(sunday.getDate() - 6);

  let totalScoreSum = 0, count = 0, habitsDone = 0, tasksDone = 0;
  let totalFocusMinutes = 0, journalEntries = 0;
  const scoresData = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = fd(d);
    const dayScore = calculateDailyScore(dateStr);
    scoresData.push({ date: dateStr, score: dayScore.total });
    totalScoreSum += dayScore.total;
    count++;
    S.habits.forEach(h => {
      const s = gc(h.id, dateStr);
      if (s === 'dn' || s === 'dn_late') habitsDone++;
      else if (s === 'pt') habitsDone += 0.5;
    });
    if (S.tasks) tasksDone += S.tasks.filter(t => t.date === dateStr && t.status === 'completed').length;
    if (S.focusSessions) {
      const secs = S.focusSessions.filter(s => (s.startTime||'').substring(0,10) === dateStr).reduce((a,s) => a + (s.duration||0), 0);
      totalFocusMinutes += secs / 60;
    }
    if (S.journal && S.journal.some(j => j.date === dateStr)) journalEntries++;
  }

  const avgScore = count > 0 ? Math.round(totalScoreSum / count) : 0;
  const weekStartStr = fDisp(fd(monday));
  const weekEndStr   = fDisp(fd(sunday));
  const grade      = avgScore >= 90 ? 'S' : avgScore >= 75 ? 'A' : avgScore >= 55 ? 'B' : 'C';
  const gradeColor = avgScore >= 90 ? '#4ade80' : avgScore >= 75 ? 'var(--plite)' : avgScore >= 55 ? 'var(--amber)' : '#f87171';
  const insight    = avgScore >= 80
    ? '✨ Exceptional week! Keep harnessing this momentum and push for 90%+'
    : avgScore >= 60
      ? '👍 Good progress! Try completing a few more habits to push above 80%'
      : '⚠️ Consistent action breeds success. Set smaller targets this week to rebuild streaks';

  const barChart = scoresData.map(sd => {
    const _d = new Date(sd.date + 'T00:00:00');
    const dayName = ['S','M','T','W','T','F','S'][_d.getDay()];
    const h = Math.max(4, Math.round(sd.score * 0.88));
    const col = sd.score >= 80 ? '#4ade80' : sd.score >= 60 ? 'var(--plite)' : sd.score >= 40 ? 'var(--amber)' : '#f87171';
    return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:4px">
      <div style="font-size:9px;font-weight:700;color:var(--t2)">${sd.score}%</div>
      <div style="width:100%;max-width:26px;height:${h}px;background:${col};border-radius:4px;min-height:4px;opacity:0.85"></div>
      <div style="font-size:10px;color:var(--t3);font-weight:600">${dayName}</div>
    </div>`;
  }).join('');

  return `
    <div class="review-card">
      <div class="review-card-header" style="background:linear-gradient(135deg,rgba(139,92,246,0.18),rgba(99,102,241,0.12));border-bottom:1px solid rgba(139,92,246,0.15)">
        <div>
          <div class="review-card-period" style="color:var(--plite)">WEEKLY REPORT</div>
          <div class="review-card-title">Performance Summary</div>
          <div class="review-card-sub">${weekStartStr} – ${weekEndStr}</div>
        </div>
        <div class="review-badge" style="background:${gradeColor}22;color:${gradeColor};font-size:20px;padding:10px 18px;font-weight:800">Grade ${grade}</div>
      </div>

      <div class="review-metrics">
        <div class="review-metric">
          <div class="review-metric-icon">📊</div>
          <div class="review-metric-val" style="color:${gradeColor}">${avgScore}%</div>
          <div class="review-metric-lbl">Avg Score</div>
        </div>
        <div class="review-metric">
          <div class="review-metric-icon">🏃</div>
          <div class="review-metric-val">${Math.round(habitsDone)}</div>
          <div class="review-metric-lbl">Habits Done</div>
        </div>
        <div class="review-metric">
          <div class="review-metric-icon">✅</div>
          <div class="review-metric-val">${tasksDone}</div>
          <div class="review-metric-lbl">Tasks Done</div>
        </div>
        <div class="review-metric">
          <div class="review-metric-icon">📝</div>
          <div class="review-metric-val">${journalEntries}/7</div>
          <div class="review-metric-lbl">Journal Days</div>
        </div>
      </div>

      <div style="padding:16px 20px;border-top:1px solid rgba(148,163,184,0.07)">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--t3);margin-bottom:10px">📅 Daily Score Breakdown</div>
        <div style="display:flex;gap:6px;align-items:flex-end;height:100px">${barChart}</div>
      </div>

      <div class="review-insights">
        <div class="review-insight-box" style="grid-column:1/-1">
          <div class="review-insight-lbl">💡 Performance Insight</div>
          <div class="review-insight-val" style="font-size:12px;line-height:1.55">${insight}</div>
        </div>
        <div class="review-insight-box">
          <div class="review-insight-lbl">🎯 Focus Time</div>
          <div class="review-insight-val">${Math.round(totalFocusMinutes)} mins</div>
          <div class="review-insight-sub">deep work this week</div>
        </div>
        <div class="review-insight-box">
          <div class="review-insight-lbl">🏃 Habit Rate</div>
          <div class="review-insight-val">${S.habits.length > 0 ? Math.round((habitsDone / (S.habits.length * 7)) * 100) : 0}%</div>
          <div class="review-insight-sub">of possible completions</div>
        </div>
        <div class="review-insight-box">
          <div class="review-insight-lbl">📖 Journaling</div>
          <div class="review-insight-val">${journalEntries === 7 ? '🌟 Perfect' : journalEntries > 4 ? '👍 Good' : '📝 Keep going'}</div>
          <div class="review-insight-sub">${journalEntries} of 7 days logged</div>
        </div>
      </div>
    </div>
  `;
}

// ── MONTHLY REVIEW ────────────────────────────────────────
function generateMonthlyReviewHTML() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthDays = dim(year, month);
  const monthLabel = mnName(month) + ' ' + year;

  let totalScoreSum = 0, count = 0, focusMins = 0, tasksCompleted = 0;

  for (let d = 1; d <= monthDays; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    totalScoreSum += calculateDailyScore(dateStr).total;
    count++;
    if (S.tasks) tasksCompleted += S.tasks.filter(t => t.date === dateStr && t.status === 'completed').length;
    if (S.focusSessions) {
      const secs = S.focusSessions.filter(s => (s.startTime||'').substring(0,10) === dateStr).reduce((a,s) => a + (s.duration||0), 0);
      focusMins += secs / 60;
    }
  }

  const avgScore = count > 0 ? Math.round(totalScoreSum / count) : 0;
  const activeAreas = S.lifeAreas ? S.lifeAreas.filter(la => !la.archived) : [];
  const categoryScores = activeAreas.map(la => {
    const habitsInCat = S.habits.filter(h => h.category === la.name && h.active);
    let avgRate = 0;
    if (habitsInCat.length > 0) {
      avgRate = Math.round(habitsInCat.reduce((s,h) => s + hStats(h.id).rate, 0) / habitsInCat.length);
    }
    return { name: la.name, score: avgRate, icon: la.icon, color: la.color };
  }).sort((a, b) => b.score - a.score);

  const gradeColor = avgScore >= 90 ? '#4ade80' : avgScore >= 75 ? 'var(--plite)' : avgScore >= 55 ? 'var(--amber)' : '#f87171';

  return `
    <div class="review-card">
      <div class="review-card-header" style="background:linear-gradient(135deg,rgba(59,130,246,0.18),rgba(6,182,212,0.12));border-bottom:1px solid rgba(59,130,246,0.15)">
        <div>
          <div class="review-card-period" style="color:#60a5fa">MONTHLY REPORT</div>
          <div class="review-card-title">Monthly Growth Statement</div>
          <div class="review-card-sub">${monthLabel}</div>
        </div>
        <div class="review-badge" style="background:${gradeColor}22;color:${gradeColor};font-size:18px;font-weight:800;padding:8px 16px">${avgScore}%</div>
      </div>

      <div class="review-metrics">
        <div class="review-metric">
          <div class="review-metric-icon">📊</div>
          <div class="review-metric-val" style="color:${gradeColor}">${avgScore}%</div>
          <div class="review-metric-lbl">Month Score</div>
        </div>
        <div class="review-metric">
          <div class="review-metric-icon">🎯</div>
          <div class="review-metric-val">${Math.round(focusMins / 60)}h</div>
          <div class="review-metric-lbl">Focus Time</div>
        </div>
        <div class="review-metric">
          <div class="review-metric-icon">✅</div>
          <div class="review-metric-val">${tasksCompleted}</div>
          <div class="review-metric-lbl">Tasks Done</div>
        </div>
        <div class="review-metric">
          <div class="review-metric-icon">🌱</div>
          <div class="review-metric-val">${activeAreas.length}</div>
          <div class="review-metric-lbl">Life Areas</div>
        </div>
      </div>

      ${categoryScores.length > 0 ? `
      <div style="padding:16px 20px;border-top:1px solid rgba(148,163,184,0.07)">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--t3);margin-bottom:12px">🌱 Category Balance</div>
        <div style="display:flex;flex-direction:column;gap:9px">
          ${categoryScores.slice(0,6).map(cs => `
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:14px">${cs.icon}</span>
              <span style="font-size:12px;color:var(--t2);flex:1">${cs.name}</span>
              <div style="width:90px;height:5px;background:rgba(148,163,184,0.1);border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${cs.score}%;background:${cs.color||'var(--purple)'};border-radius:3px"></div>
              </div>
              <span style="font-size:11px;font-weight:700;color:${cs.color||'var(--plite)'};width:34px;text-align:right">${cs.score}%</span>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <div class="review-insights">
        <div class="review-insight-box" style="grid-column:1/-1">
          <div class="review-insight-lbl">💡 Monthly Takeaway</div>
          <div class="review-insight-val" style="font-size:12px;line-height:1.55">
            ${avgScore >= 80
              ? '🔥 Outstanding month! Your consistency is building real momentum — maintain these systems into next month.'
              : avgScore >= 60
                ? '📈 Solid month overall. Identify 1–2 weak areas from your category breakdown and focus there next month.'
                : '💪 Every step forward counts. Review your habits and remove any that are creating friction or low value.'}
          </div>
        </div>
        <div class="review-insight-box">
          <div class="review-insight-lbl">🏆 Top Area</div>
          <div class="review-insight-val">${categoryScores.length > 0 ? categoryScores[0].icon+' '+categoryScores[0].name : 'No data'}</div>
          <div class="review-insight-sub">${categoryScores.length > 0 ? categoryScores[0].score+'% rate' : 'Add habits to track'}</div>
        </div>
        <div class="review-insight-box">
          <div class="review-insight-lbl">⚠️ Needs Work</div>
          <div class="review-insight-val">${categoryScores.length > 1 ? categoryScores[categoryScores.length-1].icon+' '+categoryScores[categoryScores.length-1].name : 'N/A'}</div>
          <div class="review-insight-sub">${categoryScores.length > 1 ? categoryScores[categoryScores.length-1].score+'% rate' : ''}</div>
        </div>
        <div class="review-insight-box">
          <div class="review-insight-lbl">🎯 Deep Work</div>
          <div class="review-insight-val">${Math.round(focusMins)} mins</div>
          <div class="review-insight-sub">${Math.round(focusMins / monthDays)} min avg/day</div>
        </div>
      </div>
    </div>
  `;
}

// ── YEARLY REVIEW ─────────────────────────────────────────
function generateYearlyReviewHTML() {
  const currentYear = new Date().getFullYear();
  const activeAreas = S.lifeAreas ? S.lifeAreas.filter(la => !la.archived) : [];
  const habitsCount     = S.habits     ? S.habits.length : 0;
  const completedGoals  = S.goals      ? S.goals.filter(g => g.progress === 100).length : 0;
  const activeChallenges= S.challenges ? S.challenges.length : 0;
  const journalTotal    = S.journal    ? S.journal.length : 0;

  let yearAvgScore = 0;
  if (S.productivityScores) {
    const scores = Object.values(S.productivityScores).map(s => s.total);
    if (scores.length > 0) yearAvgScore = Math.round(scores.reduce((a,b) => a+b, 0) / scores.length);
  }

  const gradeColor = yearAvgScore >= 90 ? '#4ade80' : yearAvgScore >= 75 ? 'var(--plite)' : yearAvgScore >= 55 ? 'var(--amber)' : '#f87171';

  const monthlyBars = Array.from({length: 12}, (_, m) => {
    const scores = Object.entries(S.productivityScores || {})
      .filter(([k]) => k.startsWith(`${currentYear}-${String(m+1).padStart(2,'0')}`))
      .map(([,v]) => v.total);
    const avg = scores.length > 0 ? Math.round(scores.reduce((a,b) => a+b,0) / scores.length) : 0;
    return { month: ['J','F','M','A','M','J','J','A','S','O','N','D'][m], avg };
  });

  return `
    <div class="review-card">
      <div class="review-card-header" style="background:linear-gradient(135deg,rgba(245,158,11,0.18),rgba(251,191,36,0.1));border-bottom:1px solid rgba(245,158,11,0.15)">
        <div>
          <div class="review-card-period" style="color:#fbbf24">YEARLY SUMMARY</div>
          <div class="review-card-title">Annual Growth Dashboard</div>
          <div class="review-card-sub">Year ${currentYear}</div>
        </div>
        <div class="review-badge" style="background:${gradeColor}22;color:${gradeColor};font-size:18px;font-weight:800;padding:8px 16px">${yearAvgScore}%</div>
      </div>

      <div class="review-metrics">
        <div class="review-metric">
          <div class="review-metric-icon">📊</div>
          <div class="review-metric-val" style="color:${gradeColor}">${yearAvgScore}%</div>
          <div class="review-metric-lbl">Year Score</div>
        </div>
        <div class="review-metric">
          <div class="review-metric-icon">🏃</div>
          <div class="review-metric-val">${habitsCount}</div>
          <div class="review-metric-lbl">Habits</div>
        </div>
        <div class="review-metric">
          <div class="review-metric-icon">🎯</div>
          <div class="review-metric-val">${completedGoals}</div>
          <div class="review-metric-lbl">Goals Done</div>
        </div>
        <div class="review-metric">
          <div class="review-metric-icon">📝</div>
          <div class="review-metric-val">${journalTotal}</div>
          <div class="review-metric-lbl">Journal Days</div>
        </div>
      </div>

      <div style="padding:16px 20px;border-top:1px solid rgba(148,163,184,0.07)">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--t3);margin-bottom:10px">📈 Monthly Overview (${currentYear})</div>
        <div style="display:flex;gap:4px;align-items:flex-end;height:80px">
          ${monthlyBars.map(mb => {
            const h = mb.avg > 0 ? Math.max(4, Math.round(mb.avg * 0.72)) : 4;
            const col = mb.avg >= 80 ? '#4ade80' : mb.avg >= 60 ? 'var(--plite)' : mb.avg > 0 ? 'var(--amber)' : 'rgba(148,163,184,0.12)';
            return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:3px">
              <div style="width:100%;max-width:20px;height:${h}px;background:${col};border-radius:3px;min-height:4px;opacity:${mb.avg > 0 ? '0.85':'0.3'}"></div>
              <div style="font-size:8px;color:var(--t3);font-weight:600">${mb.month}</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="review-insights">
        <div class="review-insight-box" style="grid-column:1/-1">
          <div class="review-insight-lbl">🌟 Annual Reflection</div>
          <div class="review-insight-val" style="font-size:12px;line-height:1.55">
            Congratulations on investing in yourself this year. Across ${activeAreas.length} life areas, you maintained ${habitsCount} habits, completed ${completedGoals} goals, and logged ${journalTotal} journal entries. Here's to another year of growth and higher momentum! 🚀
          </div>
        </div>
        <div class="review-insight-box">
          <div class="review-insight-lbl">🏆 Challenges</div>
          <div class="review-insight-val">${activeChallenges}</div>
          <div class="review-insight-sub">challenges attempted</div>
        </div>
        <div class="review-insight-box">
          <div class="review-insight-lbl">🌱 Life Domains</div>
          <div class="review-insight-val">${activeAreas.length}</div>
          <div class="review-insight-sub">areas being tracked</div>
        </div>
        <div class="review-insight-box">
          <div class="review-insight-lbl">🎯 Goal Rate</div>
          <div class="review-insight-val">${S.goals && S.goals.length > 0 ? Math.round((completedGoals / S.goals.length) * 100) : 0}%</div>
          <div class="review-insight-sub">${completedGoals} of ${S.goals ? S.goals.length : 0} goals</div>
        </div>
      </div>
    </div>
  `;
}

// Hook to daily checks (runs once when system is opened)
function initProductivityScores() {
  updateTodayProductivityScore();
}

// Expose globally
window.calculateDailyScore       = calculateDailyScore;
window.updateTodayProductivityScore = updateTodayProductivityScore;
window.renderProductivityScoreWidget = renderProductivityScoreWidget;
window.renderReviews             = renderReviews;
window.switchReviewTab           = switchReviewTab;
window.initProductivityScores    = initProductivityScores;
