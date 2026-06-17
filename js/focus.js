/**
 * focus.js — Focus Hub and Pomodoro Timer Module
 *
 * Exposes the global FocusTimer system and hooks into the Momentum state structure.
 */

// ── CONSTANTS & CATEGORIES ──
const FOCUS_CATEGORIES = [
  '📚 AIML',
  '💻 DSA',
  '🌐 Web Development',
  '🏋️ Fitness Learning',
  '📖 Reading',
  '🎯 Personal Growth',
  '📝 College Work'
];

const MODE_DURATIONS = {
  focus: 25 * 60,
  break: 5 * 60,
  longBreak: 15 * 60,
  deepWork: 50 * 60
};

// ── GLOBAL TIMER STATE ──
window.FocusTimerState = {
  timeLeft: 25 * 60,
  totalDuration: 25 * 60,
  isPlaying: false,
  mode: 'focus', // 'focus' | 'break' | 'longBreak' | 'deepWork' | 'custom'
  category: FOCUS_CATEGORIES[0],
  intervalId: null,
  pomodorosCompletedToday: 0
};

// ── INITIALIZATION ──
function focusEnsureData() {
  if (typeof S === 'undefined') return;
  if (!S.focusSettings) {
    S.focusSettings = {
      focusGoal: 4, // 4 hours default
      pomodoroLength: 25,
      breakLength: 5,
      longBreakLength: 15,
      deepWorkLength: 50,
      focusNotifications: true
    };
  }
  if (!S.focusSessions) S.focusSessions = [];
  if (!S.focusStreak) {
    S.focusStreak = {
      currentStreak: 0,
      longestStreak: 0,
      lastFocusedDate: ''
    };
  }
}

// Initialize Focus Hub
(function initFocusHub() {
  focusEnsureData();
  syncTimerSettings();
  
  // Set up background tick loop
  startBackgroundTimerLoop();
})();

function syncTimerSettings() {
  focusEnsureData();
  const settings = S.focusSettings;
  MODE_DURATIONS.focus = settings.pomodoroLength * 60;
  MODE_DURATIONS.break = settings.breakLength * 60;
  MODE_DURATIONS.longBreak = settings.longBreakLength * 60;
  MODE_DURATIONS.deepWork = settings.deepWorkLength * 60;

  if (window.FocusTimerState.mode !== 'custom' && !window.FocusTimerState.isPlaying) {
    const dur = MODE_DURATIONS[window.FocusTimerState.mode];
    window.FocusTimerState.timeLeft = dur;
    window.FocusTimerState.totalDuration = dur;
  }
}

// ── TIMER CONTROL FUNCTIONS ──

function setTimerMode(mode) {
  if (window.FocusTimerState.isPlaying) {
    if (!confirm('Abandon current focus session? Progress will not be saved.')) {
      return;
    }
    pauseTimer();
  }

  window.FocusTimerState.mode = mode;
  const dur = MODE_DURATIONS[mode];
  window.FocusTimerState.timeLeft = dur;
  window.FocusTimerState.totalDuration = dur;
  
  updateTimerUI();
  
  // Update mode pills style
  document.querySelectorAll('.mode-pill').forEach(btn => {
    btn.classList.toggle('active', btn.id === `btn-mode-${mode}`);
  });
}

function openCustomTimerModal() {
  const modal = document.getElementById('m-focus-custom');
  if (modal) modal.classList.remove('hid');
}

function closeCustomTimerModal() {
  const modal = document.getElementById('m-focus-custom');
  if (modal) modal.classList.add('hid');
}

function saveCustomTimer() {
  const input = document.getElementById('custom-timer-duration');
  if (!input) return;
  const mins = parseInt(input.value);
  if (isNaN(mins) || mins < 1 || mins > 180) {
    toast('Please enter focus minutes between 1 and 180', 'error');
    return;
  }

  if (window.FocusTimerState.isPlaying) {
    pauseTimer();
  }

  window.FocusTimerState.mode = 'custom';
  const dur = mins * 60;
  window.FocusTimerState.timeLeft = dur;
  window.FocusTimerState.totalDuration = dur;
  
  closeCustomTimerModal();
  updateTimerUI();

  document.querySelectorAll('.mode-pill').forEach(btn => {
    btn.classList.toggle('active', btn.id === 'btn-mode-custom');
  });
  
  toast(`Custom focus timer set to ${mins} minutes`, 'success');
}

function selectCategory(catName) {
  window.FocusTimerState.category = catName;
  updateCategoryPills();
}

function updateCategoryPills() {
  const container = document.getElementById('focus-cat-pills');
  if (!container) return;
  
  container.innerHTML = FOCUS_CATEGORIES.map(cat => {
    const isSelected = window.FocusTimerState.category === cat;
    return `<button class="category-pill ${isSelected ? 'selected' : ''}" onclick="selectCategory('${cat}')">${cat}</button>`;
  }).join('');
}

function toggleTimer() {
  if (window.FocusTimerState.isPlaying) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  if (window.FocusTimerState.isPlaying) return;
  
  window.FocusTimerState.isPlaying = true;
  window.FocusTimerState.startTime = new Date().toISOString();
  
  const startBtn = document.getElementById('btn-timer-start');
  if (startBtn) {
    startBtn.textContent = 'Pause Session';
    startBtn.className = 'btn bd';
  }

  const skipBtn = document.getElementById('btn-timer-skip');
  if (skipBtn) {
    skipBtn.style.display = (window.FocusTimerState.mode === 'break' || window.FocusTimerState.mode === 'longBreak') ? 'inline-flex' : 'none';
  }
  
  toast(`🚀 Session started: ${window.FocusTimerState.mode === 'focus' || window.FocusTimerState.mode === 'deepWork' || window.FocusTimerState.mode === 'custom' ? 'Focusing' : 'Break time'}`, 'info');
}

function pauseTimer() {
  if (!window.FocusTimerState.isPlaying) return;
  
  window.FocusTimerState.isPlaying = false;
  
  const startBtn = document.getElementById('btn-timer-start');
  if (startBtn) {
    startBtn.textContent = 'Resume Session';
    startBtn.className = 'btn bp';
  }
  
  toast('⏸️ Session paused', 'info');
}

function resetTimer() {
  if (window.FocusTimerState.isPlaying) {
    if (!confirm('Reset current session? Focus time will be lost.')) return;
  }
  
  window.FocusTimerState.isPlaying = false;
  const dur = window.FocusTimerState.mode === 'custom' 
    ? window.FocusTimerState.totalDuration 
    : MODE_DURATIONS[window.FocusTimerState.mode];
    
  window.FocusTimerState.timeLeft = dur;
  window.FocusTimerState.totalDuration = dur;
  
  const startBtn = document.getElementById('btn-timer-start');
  if (startBtn) {
    startBtn.textContent = 'Start Focus';
    startBtn.className = 'btn bp';
  }

  const skipBtn = document.getElementById('btn-timer-skip');
  if (skipBtn) skipBtn.style.display = 'none';
  
  updateTimerUI();
  toast('🔁 Timer reset', 'info');
}

function skipTimerMode() {
  if (window.FocusTimerState.isPlaying) {
    window.FocusTimerState.isPlaying = false;
  }
  toast('⏭️ Break skipped', 'info');
  setTimerMode('focus');
}

// ── BACKGROUND TICK LOOP & UI SYNC ──

function startBackgroundTimerLoop() {
  if (window.FocusTimerState.intervalId) {
    clearInterval(window.FocusTimerState.intervalId);
  }
  
  window.FocusTimerState.intervalId = setInterval(() => {
    if (window.FocusTimerState.isPlaying) {
      window.FocusTimerState.timeLeft--;
      
      // Update browser tab title
      const mins = Math.floor(window.FocusTimerState.timeLeft / 60);
      const secs = window.FocusTimerState.timeLeft % 60;
      const padSecs = String(secs).padStart(2, '0');
      const emoji = window.FocusTimerState.mode.includes('break') ? '☕' : '🎯';
      document.title = `${emoji} (${mins}:${padSecs}) Momentum`;
      
      if (window.FocusTimerState.timeLeft <= 0) {
        completeSession();
      }
    } else {
      document.title = 'Momentum — Habit Tracker';
    }
    
    // Refresh UI if Focus Hub is active
    if (curPage === 'focus') {
      updateTimerUI();
    }
  }, 1000);
}

function updateTimerUI() {
  const timeEl = document.getElementById('focus-time-display');
  const labelEl = document.getElementById('focus-state-label');
  const ringEl = document.getElementById('timer-progress-ring');
  
  if (!timeEl) return;
  
  const m = Math.floor(window.FocusTimerState.timeLeft / 60);
  const s = window.FocusTimerState.timeLeft % 60;
  timeEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
  
  // Set state label
  if (window.FocusTimerState.isPlaying) {
    if (window.FocusTimerState.mode.includes('break')) {
      labelEl.textContent = 'Relaxing...';
      labelEl.style.color = 'var(--green)';
    } else {
      labelEl.textContent = 'Focusing...';
      labelEl.style.color = 'var(--purple)';
    }
  } else {
    labelEl.textContent = window.FocusTimerState.timeLeft === window.FocusTimerState.totalDuration ? 'Ready to Focus' : 'Paused';
    labelEl.style.color = 'var(--t3)';
  }

  // Update ring dashoffset (603 is the stroke-dasharray circumferance)
  if (ringEl) {
    const pct = window.FocusTimerState.totalDuration > 0
      ? window.FocusTimerState.timeLeft / window.FocusTimerState.totalDuration
      : 1;
    const offset = 603 * (1 - pct);
    ringEl.setAttribute('stroke-dashoffset', offset);
    
    // Color code ring based on mode
    if (window.FocusTimerState.mode.includes('break')) {
      ringEl.setAttribute('stroke', '#22c55e'); // green
    } else {
      ringEl.setAttribute('stroke', '#8b5cf6'); // purple
    }
  }
}

// ── SESSION STORAGE AND STREAK CORE ──

function completeSession() {
  window.FocusTimerState.isPlaying = false;
  const isWork = window.FocusTimerState.mode === 'focus' || window.FocusTimerState.mode === 'deepWork' || window.FocusTimerState.mode === 'custom';
  
  // Play chime sound (defined in realtime.js)
  if (typeof playNotificationSound === 'function') {
    playNotificationSound('success');
  }

  if (isWork) {
    focusEnsureData();
    const durationMins = Math.round(window.FocusTimerState.totalDuration / 60);
    const dateStr = fd(new Date());

    const session = {
      id: 'fs_' + Date.now(),
      date: dateStr,
      startTime: window.FocusTimerState.startTime || new Date(Date.now() - window.FocusTimerState.totalDuration * 1000).toISOString(),
      endTime: new Date().toISOString(),
      category: window.FocusTimerState.category,
      duration: durationMins,
      status: 'Completed'
    };

    S.focusSessions.push(session);
    
    // Update streaks
    recalculateFocusStreaks(dateStr);
    save();

    // Trigger Notification
    if (typeof triggerNotification === 'function') {
      triggerNotification(
        '🎯 Focus Session Completed!',
        `Excellent! You completed ${durationMins} minutes of focus on ${window.FocusTimerState.category}.`,
        'system',
        () => go('focus')
      );
    }
    
    // Increment completed pomodoro count for today
    window.FocusTimerState.pomodorosCompletedToday++;
    
    // Increment stats metrics
    toast(`🏆 Focus session recorded: +${durationMins}m!`, 'success');
    
    // Auto shift to Break
    const completedPomodoros = S.focusSessions.filter(s => s.date === dateStr).length;
    if (completedPomodoros % 4 === 0) {
      toast('☕ Time for a Long Break!', 'info');
      setTimerMode('longBreak');
    } else {
      toast('☕ Time for a Break!', 'info');
      setTimerMode('break');
    }
  } else {
    // Break finished
    if (typeof triggerNotification === 'function') {
      triggerNotification(
        '☕ Break Ended!',
        'Your break has finished. Ready to start focusing again?',
        'system',
        () => go('focus')
      );
    }
    toast('🎯 Break completed! Back to focus.', 'info');
    setTimerMode('focus');
  }

  // Reload views
  if (curPage === 'focus') {
    rFocus();
  }
  if (curPage === 'dashboard' && typeof rDash === 'function') {
    rDash();
  }
}

function recalculateFocusStreaks(todayDateStr) {
  focusEnsureData();
  const streak = S.focusStreak;
  
  if (streak.lastFocusedDate === todayDateStr) {
    // Already focused today, streak remains same but check goals
    return;
  }
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDateStr = fd(yesterday);
  
  if (streak.lastFocusedDate === yesterdayDateStr) {
    // Consecutive day focus
    streak.currentStreak++;
  } else if (streak.lastFocusedDate === '') {
    // First focus ever
    streak.currentStreak = 1;
  } else {
    // Streak broken, reset to 1
    streak.currentStreak = 1;
  }
  
  streak.lastFocusedDate = todayDateStr;
  streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
}

// ── VIEW RENDERING AND CHARTS ──

function rFocus() {
  focusEnsureData();
  syncTimerSettings();
  
  // 1. Update Timer View elements
  updateTimerUI();
  updateCategoryPills();
  
  // Reset mode pill classes
  document.querySelectorAll('.mode-pill').forEach(btn => {
    btn.classList.toggle('active', btn.id === `btn-mode-${window.FocusTimerState.mode}`);
  });
  
  const startBtn = document.getElementById('btn-timer-start');
  if (startBtn) {
    if (window.FocusTimerState.isPlaying) {
      startBtn.textContent = 'Pause Session';
      startBtn.className = 'btn bd';
    } else {
      startBtn.textContent = window.FocusTimerState.timeLeft === window.FocusTimerState.totalDuration ? 'Start Focus' : 'Resume Session';
      startBtn.className = 'btn bp';
    }
  }

  const skipBtn = document.getElementById('btn-timer-skip');
  if (skipBtn) {
    skipBtn.style.display = (window.FocusTimerState.isPlaying && (window.FocusTimerState.mode === 'break' || window.FocusTimerState.mode === 'longBreak')) ? 'inline-flex' : 'none';
  }

  // 2. Render Focus Dashboard Stats Cards
  renderFocusDashboardStats();

  // 3. Render Focus Streaks Widget
  renderFocusStreaksWidget();

  // 4. Render Insights Widget
  renderFocusInsightsWidget();

  // 5. Render Patterns / Best Focus Hour Widget
  renderFocusPatternsWidget();

  // 6. Render Heatmap
  renderFocusHeatmap();

  // 7. Render Completed Sessions Log Table
  renderFocusSessionLogs();

  // 8. Render Category Breakdown Chart
  requestAnimationFrame(() => {
    renderFocusCategoryChart();
  });
}

function renderFocusDashboardStats() {
  focusEnsureData();
  const dateStr = fd(new Date());
  
  // Sum today's focus sessions
  const todaySessions = S.focusSessions.filter(s => s.date === dateStr);
  const totalMins = todaySessions.reduce((sum, s) => sum + s.duration, 0);
  const goalHours = S.focusSettings.focusGoal;
  const goalMins = goalHours * 60;
  
  const progressPct = goalMins > 0 ? Math.min(100, Math.round((totalMins / goalMins) * 100)) : 0;
  
  // Format focus hours display
  const dispHrs = Math.floor(totalMins / 60);
  const dispMins = totalMins % 60;
  const focusTimeStr = dispHrs > 0 ? `${dispHrs}h ${dispMins}m` : `${dispMins}m`;

  const container = document.getElementById('focus-stats');
  if (!container) return;
  
  container.innerHTML = `
    <div class="card sc cp">
      <div class="si">🎯</div>
      <div class="sv">${goalHours} Hours</div>
      <div class="sl">Focus Goal</div>
      <div class="ss">daily target</div>
    </div>
    <div class="card sc sc-b">
      <div class="si">⏱️</div>
      <div class="sv">${focusTimeStr}</div>
      <div class="sl">Focus Completed</div>
      <div class="ss">${progressPct}% of goal reached</div>
    </div>
    <div class="card sc cg">
      <div class="si">📈</div>
      <div class="sv">${progressPct}%</div>
      <div class="sl">Goal Progress</div>
      <div class="ss">
        <div style="width:100%;height:4px;background:rgba(148,163,184,.1);border-radius:2px;margin-top:3px">
          <div style="height:100%;width:${progressPct}%;background:#22c55e;border-radius:2px"></div>
        </div>
      </div>
    </div>
    <div class="card sc ca">
      <div class="si">🔥</div>
      <div class="sv">${S.focusStreak.currentStreak} Days</div>
      <div class="sl">Focus Streak</div>
      <div class="ss">consecutive days</div>
    </div>
  `;
}

function renderFocusStreaksWidget() {
  focusEnsureData();
  const streak = S.focusStreak;
  const container = document.getElementById('focus-streaks-widget');
  if (!container) return;
  
  // Calculate Weekly Goal Streak: consecutive weeks with at least 4 successful focus days
  const weeklyStreak = calculateWeeklyGoalStreak();
  const pomodorosToday = window.FocusTimerState.pomodorosCompletedToday;

  container.innerHTML = `
    <div class="focus-streak-item">
      <div class="focus-streak-icon">🔥</div>
      <div class="focus-streak-info">
        <div class="focus-streak-title">Daily Focus Streak</div>
        <div class="focus-streak-val">${streak.currentStreak} Days</div>
      </div>
    </div>
    <div class="focus-streak-item">
      <div class="focus-streak-icon">📅</div>
      <div class="focus-streak-info">
        <div class="focus-streak-title">Weekly Goal Streak</div>
        <div class="focus-streak-val">${weeklyStreak} Weeks</div>
      </div>
    </div>
    <div class="focus-streak-item">
      <div class="focus-streak-icon">🍅</div>
      <div class="focus-streak-info">
        <div class="focus-streak-title">Pomodoro Streak</div>
        <div class="focus-streak-val">${pomodorosToday} Completed Today</div>
      </div>
    </div>
    <div class="focus-streak-item">
      <div class="focus-streak-icon">🏆</div>
      <div class="focus-streak-info">
        <div class="focus-streak-title">Longest Focus Streak</div>
        <div class="focus-streak-val">${streak.longestStreak} Days</div>
      </div>
    </div>
  `;
}

function calculateWeeklyGoalStreak() {
  focusEnsureData();
  const sessions = S.focusSessions;
  if (!sessions || sessions.length === 0) return 0;

  // Group focus time by week identifier
  const weekGoalsMap = {};
  const goalMins = S.focusSettings.focusGoal * 60;

  sessions.forEach(s => {
    const sDate = new Date(s.date + 'T00:00:00');
    // Simple week identifier: Year-WeekNumber
    const weekYear = getWeekYearAndNumber(sDate);
    if (!weekGoalsMap[weekYear]) {
      weekGoalsMap[weekYear] = {};
    }
    // Track focus time per day within the week
    weekGoalsMap[weekYear][s.date] = (weekGoalsMap[weekYear][s.date] || 0) + s.duration;
  });

  // Check how many days in each week met the goal
  const sortedWeeks = Object.keys(weekGoalsMap).sort();
  let weeklyStreak = 0;

  for (let i = sortedWeeks.length - 1; i >= 0; i--) {
    const wKey = sortedWeeks[i];
    const daysMap = weekGoalsMap[wKey];
    // Count days meeting Focus Goal
    const successfulDays = Object.values(daysMap).filter(mins => mins >= goalMins).length;
    
    // A week is successful if focused at least 4 days
    if (successfulDays >= 4) {
      weeklyStreak++;
    } else {
      break; // Streak broken
    }
  }

  return weeklyStreak;
}

function getWeekYearAndNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

function renderFocusInsightsWidget() {
  focusEnsureData();
  const container = document.getElementById('focus-insights-widget');
  if (!container) return;

  const sessions = S.focusSessions;
  if (!sessions || sessions.length === 0) {
    container.innerHTML = `<div class="txs tm" style="padding:10px 0">No focus insights available. Complete Pomodoro sessions to generate insights.</div>`;
    return;
  }

  const insights = [];

  // Insight 1: Most Focused Category
  const catMins = {};
  sessions.forEach(s => {
    catMins[s.category] = (catMins[s.category] || 0) + s.duration;
  });
  const sortedCats = Object.entries(catMins).sort((a,b) => b[1] - a[1]);
  if (sortedCats.length > 0) {
    insights.push({
      text: `🚀 <strong>${sortedCats[0][0]}</strong> receives most of your focus time (${Math.round(sortedCats[0][1]/60)}h completed).`,
      type: 'positive'
    });
  }

  // Insight 2: Least Focused Category
  if (sortedCats.length > 1) {
    const leastCat = sortedCats[sortedCats.length - 1];
    insights.push({
      text: `⚠️ <strong>${leastCat[0]}</strong> receives the least focus attention (${leastCat[1]} mins). Try scheduling more focus blocks for it.`,
      type: 'alert'
    });
  }

  // Insight 3: Weekdays vs Weekends Focus
  let weekdayMins = 0, weekendMins = 0;
  let weekdayCount = 0, weekendCount = 0;
  
  // Track days
  const daysSeen = {};
  sessions.forEach(s => {
    if (!daysSeen[s.date]) {
      daysSeen[s.date] = true;
      const dVal = new Date(s.date + 'T00:00:00').getDay();
      if (dVal === 0 || dVal === 6) weekendCount++; else weekdayCount++;
    }
    const dVal = new Date(s.date + 'T00:00:00').getDay();
    if (dVal === 0 || dVal === 6) weekendMins += s.duration; else weekdayMins += s.duration;
  });

  const avgWeekday = weekdayCount > 0 ? weekdayMins / weekdayCount : 0;
  const avgWeekend = weekendCount > 0 ? weekendMins / weekendCount : 0;

  if (avgWeekday > 0 || avgWeekend > 0) {
    if (avgWeekday >= avgWeekend) {
      const diffPct = avgWeekend > 0 ? Math.round(((avgWeekday - avgWeekend) / avgWeekend) * 100) : 100;
      insights.push({
        text: `📈 You focus <strong>${diffPct}% more</strong> on weekdays than weekends on average.`,
        type: 'positive'
      });
    } else {
      const diffPct = avgWeekday > 0 ? Math.round(((avgWeekend - avgWeekday) / avgWeekday) * 100) : 100;
      insights.push({
        text: `🧘 You focus <strong>${diffPct}% more</strong> on weekends than weekdays. Great weekend discipline!`,
        type: 'positive'
      });
    }
  }

  // Insight 4: Best focus hours block
  const hourMins = Array(24).fill(0);
  sessions.forEach(s => {
    const startHour = new Date(s.startTime).getHours();
    hourMins[startHour] += s.duration;
  });
  
  // Find highest sliding 3-hour window
  let bestWindowStart = 9;
  let maxWindowMins = 0;
  for (let h = 0; h < 22; h++) {
    const sum = hourMins[h] + hourMins[h+1] + hourMins[h+2];
    if (sum > maxWindowMins) {
      maxWindowMins = sum;
      bestWindowStart = h;
    }
  }

  if (maxWindowMins > 0) {
    const formatH = (hr) => {
      const ampm = hr >= 12 ? 'PM' : 'AM';
      const displayH = hr % 12 || 12;
      return `${displayH} ${ampm}`;
    };
    insights.push({
      text: `🕒 You focus best between <strong>${formatH(bestWindowStart)} and ${formatH(bestWindowStart + 3)}</strong>.`,
      type: 'positive'
    });
  }

  container.innerHTML = insights.map(ins => `
    <div class="focus-insight-item ${ins.type}">
      <div>${ins.text}</div>
    </div>
  `).join('');
}

function renderFocusPatternsWidget() {
  focusEnsureData();
  const container = document.getElementById('focus-best-time-widget');
  if (!container) return;

  const sessions = S.focusSessions;
  if (!sessions || sessions.length === 0) {
    container.innerHTML = `<div class="txs tm" style="padding:10px 0">No focus patterns recorded yet.</div>`;
    return;
  }

  // Best focus hour block
  const hourMins = Array(24).fill(0);
  sessions.forEach(s => {
    const startHour = new Date(s.startTime).getHours();
    hourMins[startHour] += s.duration;
  });
  
  // Find top 2-hour window
  let bestStartHour = 19; // 7 PM
  let maxMins = 0;
  for (let h = 0; h < 23; h++) {
    const sum = hourMins[h] + hourMins[h+1];
    if (sum > maxMins) {
      maxMins = sum;
      bestStartHour = h;
    }
  }
  const formatHrBlock = (hr) => {
    const ampm = (h) => h >= 12 ? 'PM' : 'AM';
    const disp = (h) => h % 12 || 12;
    return `${disp(hr)} ${ampm(hr)} - ${disp(hr+2)} ${ampm(hr+2)}`;
  };

  const bestTimeStr = maxMins > 0 ? formatHrBlock(bestStartHour) : '7 PM - 9 PM';

  // Highest Focus Rate (defined as category with highest focus completed)
  const catMins = {};
  sessions.forEach(s => {
    catMins[s.category] = (catMins[s.category] || 0) + s.duration;
  });
  const topCat = Object.entries(catMins).sort((a,b) => b[1] - a[1])[0];
  const highestFocusRateStr = topCat ? `${topCat[0]} (${Math.round(topCat[1]/60)}h)` : 'AIML (0h)';

  // Most Sessions Completed
  const totalCompleted = sessions.length;

  container.innerHTML = `
    <div class="pattern-row">
      <div class="pattern-left">
        <span class="pattern-icon">🕒</span>
        <span class="pattern-title">Most Productive Block</span>
      </div>
      <span class="pattern-val">${bestTimeStr}</span>
    </div>
    <div class="pattern-row">
      <div class="pattern-left">
        <span class="pattern-icon">📈</span>
        <span class="pattern-title">Highest Focus Category</span>
      </div>
      <span class="pattern-val">${highestFocusRateStr}</span>
    </div>
    <div class="pattern-row">
      <div class="pattern-left">
        <span class="pattern-icon">🍅</span>
        <span class="pattern-title">Sessions Completed</span>
      </div>
      <span class="pattern-val">${totalCompleted} sessions</span>
    </div>
  `;
}

function renderFocusHeatmap() {
  focusEnsureData();
  const container = document.getElementById('focus-heatmap');
  if (!container) return;

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const goalMins = S.focusSettings.focusGoal * 60;
  
  // Aggregate focus sessions by date in the last 12 weeks
  const daySums = {};
  S.focusSessions.forEach(s => {
    daySums[s.date] = (daySums[s.date] || 0) + s.duration;
  });

  const columns = [];
  // 12 weeks = 84 days. Let's align with Sunday/Monday week starts
  const startDay = new Date(now);
  startDay.setDate(now.getDate() - 83); // 12 weeks ago
  
  // Render column list of weeks
  let html = '';
  
  for (let w = 0; w < 12; w++) {
    let weekCellsHtml = '<div class="focus-heatmap-col">';
    for (let d = 0; d < 7; d++) {
      const curDate = new Date(startDay);
      curDate.setDate(startDay.getDate() + w * 7 + d);
      const ds = fd(curDate);
      const totalMins = daySums[ds] || 0;
      
      let level = 0;
      if (totalMins > 0) {
        if (totalMins >= goalMins) level = 4; // Excellent
        else if (totalMins >= goalMins * 0.5) level = 3; // Good
        else if (totalMins >= 60) level = 2; // Average
        else level = 1; // Poor
      }
      
      const hrDisp = (totalMins/60).toFixed(1);
      const tipText = `${fDisp(ds)}: ${hrDisp} hrs focus`;
      
      weekCellsHtml += `<div class="focus-heatmap-cell level-${level}" data-tooltip="${tipText}"></div>`;
    }
    weekCellsHtml += '</div>';
    html += weekCellsHtml;
  }
  
  container.innerHTML = html;
}

function renderFocusSessionLogs() {
  focusEnsureData();
  const container = document.getElementById('focus-session-logs-tbody');
  if (!container) return;

  const sessions = [...S.focusSessions].sort((a,b) => b.startTime.localeCompare(a.startTime));
  
  if (sessions.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:var(--t3);padding:24px">No focus sessions completed yet.</td>
      </tr>
    `;
    return;
  }

  container.innerHTML = sessions.map((s, index) => {
    const num = sessions.length - index;
    const timeLabel = new Date(s.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const dateLabel = fDisp(s.date);
    return `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 16px;font-weight:600">Session #${num}</td>
        <td style="padding:10px 16px;color:var(--t2)">${dateLabel} · ${timeLabel}</td>
        <td style="padding:10px 16px"><span class="badge bp2">${s.category}</span></td>
        <td style="padding:10px 16px;font-weight:700">${s.duration} mins</td>
        <td style="padding:10px 16px"><span class="badge bg2">✓ Completed</span></td>
      </tr>
    `;
  }).join('');
}

let focusCharts = {};

function renderFocusCategoryChart() {
  focusEnsureData();
  const canvas = document.getElementById('c-focus-donut');
  if (!canvas) return;

  // Clean old chart
  if (focusCharts.donut) {
    try {
      focusCharts.donut.destroy();
    } catch(e){}
    delete focusCharts.donut;
  }

  const catMins = {};
  FOCUS_CATEGORIES.forEach(cat => catMins[cat] = 0);
  S.focusSessions.forEach(s => {
    catMins[s.category] = (catMins[s.category] || 0) + s.duration;
  });

  const labels = Object.keys(catMins).filter(k => catMins[k] > 0);
  const data = labels.map(k => catMins[k]);

  // If no sessions, render placeholder donut
  if (labels.length === 0) {
    labels.push('No Sessions');
    data.push(1);
  }

  focusCharts.donut = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#f43f5e', '#6366f1', '#ec4899'],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 10 },
            padding: 10,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: '#1a2440',
          borderColor: 'rgba(139,92,246,.25)',
          borderWidth: 1,
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          padding: 10,
          cornerRadius: 8,
          titleFont: { family: 'Inter', size: 11 },
          bodyFont: { family: 'Inter', size: 10 },
          callbacks: {
            label: function(context) {
              if (context.label === 'No Sessions') return 'No sessions logged yet';
              const val = context.raw;
              const hrs = Math.floor(val / 60);
              const mins = val % 60;
              return `${context.label}: ${hrs > 0 ? hrs + 'h ' : ''}${mins}m`;
            }
          }
        }
      },
      cutout: '65%'
    }
  });
}

// Expose render callback globally
window.rFocus = rFocus;
window.setTimerMode = setTimerMode;
window.toggleTimer = toggleTimer;
window.resetTimer = resetTimer;
window.skipTimerMode = skipTimerMode;
window.selectCategory = selectCategory;
window.openCustomTimerModal = openCustomTimerModal;
window.closeCustomTimerModal = closeCustomTimerModal;
window.saveCustomTimer = saveCustomTimer;
