/**
 * realtime.js — Real-Time Productivity & Notification System
 *
 * Integrates dynamically with the S / save() / toast() / fd() / planner / versioning system.
 * Does NOT modify any existing database structures or core logic.
 *
 * Exposes:
 *   - Real-Time Clock tick loop
 *   - Today Status Bar (instantly updated)
 *   - Habit / Task / Deadline reminders loop
 *   - Audio synthesizer chime player
 *   - Notification Drawer & Notification Center
 *   - Notification Settings panel
 *   - Notification Analytics page
 */

// ────────────────────────────────────────────────────────────────
//  INITIALIZATION & STATE
// ────────────────────────────────────────────────────────────────

let _rtLastCheckedMinute = '';
let _rtDrawerFilter = 'all';

function realtimeEnsureData() {
  if (!S.notificationSettings) {
    S.notificationSettings = {
      enabled: true,
      habitsEnabled: true,
      tasksEnabled: true,
      streaksEnabled: true,
      dailyReviewEnabled: true,
      tomorrowPreviewEnabled: true,
      sound: 'gentle',
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      streakWarningTime: '21:00',
      dailyReviewTime: '21:30',
      tomorrowPreviewTime: '22:00'
    };
  }
  if (!S.notifications) S.notifications = [];
  if (!S.sentNotifications) S.sentNotifications = {};
  if (!S.notificationAnalytics) {
    S.notificationAnalytics = {
      sentCount: 0,
      clickedCount: 0,
      history: {}
    };
  }
  if (!S.lastReminderSent) S.lastReminderSent = {};
}

// ────────────────────────────────────────────────────────────────
//  REAL-TIME CLOCK LOOP
// ────────────────────────────────────────────────────────────────

function startRealTimeLoop() {
  realtimeEnsureData();
  
  // Render status bar and clock instantly
  updateClockAndStatus();

  // Run tick loop every 1 second
  setInterval(() => {
    updateClockAndStatus();
    checkRemindersLoop();
  }, 1000);
}

function updateClockAndStatus() {
  const now = new Date();
  
  // 1. Update Real-Time Clock inside topbar-center (if elements exist)
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  
  const timeEl = document.getElementById('rt-time');
  const dateEl = document.getElementById('rt-date');
  if (timeEl) timeEl.textContent = timeStr;
  if (dateEl) dateEl.textContent = dateStr;

  // 2. Update Today's Status Bar
  updateTodayStatusBar();
}

function updateTodayStatusBar() {
  realtimeEnsureData();
  const dateStr = fd(new Date());

  // Habit count today
  const habits = S.habits || [];
  const habitsDone = habits.filter(h => gc(h.id, dateStr) === 'dn').length;
  
  // Tasks count today
  let tasksDone = 0, tasksTotal = 0;
  if (S.tasks) {
    const todayTasks = S.tasks.filter(t => t.dueDate === dateStr);
    tasksTotal = todayTasks.length;
    tasksDone = todayTasks.filter(t => t.status === 'completed').length;
  }

  // Calculate Productivity Score
  const scoreData = getCalculatedProductivityScore();

  // Update DOM
  const habitsVal = document.getElementById('rt-status-habits');
  const tasksVal = document.getElementById('rt-status-tasks');
  const scoreVal = document.getElementById('rt-status-score');

  if (habitsVal) habitsVal.textContent = `${habitsDone}/${habits.length}`;
  if (tasksVal) tasksVal.textContent = `${tasksDone}/${tasksTotal}`;
  if (scoreVal) {
    scoreVal.textContent = `${scoreData.score}%`;
    scoreVal.title = `Score rating: ${scoreData.label}`;
    // Apply styling based on rating
    scoreVal.style.color = scoreData.color;
  }
}

function getCalculatedProductivityScore() {
  realtimeEnsureData();
  const dateStr = fd(new Date());

  // Habit completion % (default 100% if no habits)
  const habits = S.habits || [];
  let habitPct = 1.0;
  if (habits.length > 0) {
    const done = habits.filter(h => gc(h.id, dateStr) === 'dn').length;
    habitPct = done / habits.length;
  }

  // Task completion % (default 100% if no tasks today)
  let taskPct = 1.0;
  if (S.tasks) {
    const todayTasks = S.tasks.filter(t => t.dueDate === dateStr);
    if (todayTasks.length > 0) {
      const done = todayTasks.filter(t => t.status === 'completed').length;
      taskPct = done / todayTasks.length;
    }
  }

  // Goal average progress % (default 100% if no goals)
  let goalPct = 1.0;
  const goals = S.goals || [];
  if (goals.length > 0) {
    const sum = goals.reduce((s, g) => s + (g.progress || 0), 0);
    goalPct = (sum / goals.length) / 100;
  }

  // Score = Habit % * Task % * Goal %
  const score = Math.round(habitPct * taskPct * goalPct * 100);
  
  let label = 'Needs Improvement';
  let color = '#f87171'; // red
  if (score >= 90) {
    label = 'Excellent';
    color = '#4ade80'; // green
  } else if (score >= 70) {
    label = 'Good';
    color = 'var(--plite)'; // purple
  } else if (score >= 50) {
    label = 'Average';
    color = 'var(--amber)'; // orange
  }

  return { score, label, color };
}

// ────────────────────────────────────────────────────────────────
//  AUDIO SYNTHESIZER
// ────────────────────────────────────────────────────────────────

function playNotificationSound(soundName) {
  if (soundName === 'none' || !soundName) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    
    if (soundName === 'gentle') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.3);
      osc.start(now);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.22); // E5
      gain2.gain.setValueAtTime(0.08, now + 0.22);
      gain2.gain.exponentialRampToValueAtTime(0.005, now + 0.6);
      osc2.start(now + 0.22);
      
      osc.stop(now + 0.32);
      osc2.stop(now + 0.62);
    } 
    else if (soundName === 'success') {
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.12, now);
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.24); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.36); // C6
      gain.gain.setValueAtTime(0.12, now + 0.36);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.7);
      osc.start(now);
      osc.stop(now + 0.72);
    } 
    else if (soundName === 'digital') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now); // A5
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.setValueAtTime(0.0, now + 0.08);
      osc.frequency.setValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.04, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.24);
    }
  } catch (e) {
    console.warn('[RealTime] Audio synth blocked or failed:', e);
  }
}

// ────────────────────────────────────────────────────────────────
//  NOTIFICATION DISPATCHER
// ────────────────────────────────────────────────────────────────

function triggerNotification(title, body, type, clickAction, relatedId = null) {
  realtimeEnsureData();
  const settings = S.notificationSettings;
  
  if (!settings.enabled) return;

  // 1. Determine quiet hours
  if (isQuietHours(settings)) {
    // Suppress notification unless it is an urgent alert (like streak alerts)
    if (type !== 'system') return;
  }

  // 2. Play Audio Sound
  playNotificationSound(settings.sound);

  // 3. Show In-App Banner
  showInAppBannerNotification(title, body, type, clickAction, relatedId);

  // 4. Show Native Browser Notification
  if ('Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body: body,
        icon: '/icons/icon-192.png',
        tag: `${type}_${relatedId || Date.now()}`,
        data: {
          type,
          relatedId,
          timestamp: Date.now()
        }
      });
    });
  }

  // 5. Add to Notification Center History
  addNotificationToHistory(title, body, type, relatedId);
}

function isQuietHours(settings) {
  if (!settings.quietHoursEnabled) return false;
  const now = new Date();
  const time = now.getHours() * 60 + now.getMinutes();
  
  const [sh, sm] = settings.quietHoursStart.split(':').map(Number);
  const [eh, em] = settings.quietHoursEnd.split(':').map(Number);
  
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  
  if (start <= end) {
    return time >= start && time <= end;
  } else {
    // Crosses midnight
    return time >= start || time <= end;
  }
}

function showInAppBannerNotification(title, body, type, clickAction, relatedId) {
  // Clear any existing banner with same type/id
  const oldBanners = document.querySelectorAll('.noti-banner');
  oldBanners.forEach(b => b.remove());

  const banner = document.createElement('div');
  banner.className = 'noti-banner';
  
  const typeIcons = { habit: '🏃', task: '📅', goal: '🎯', system: '⚡' };
  
  banner.innerHTML = `
    <div class="noti-item-icon">${typeIcons[type] || '🔔'}</div>
    <div class="noti-item-content" style="padding-right: 15px;">
      <div class="noti-item-title">${title}</div>
      <div class="noti-item-body">${body}</div>
    </div>
    <button class="noti-banner-close" onclick="event.stopPropagation(); this.closest('.noti-banner').remove();">✕</button>
  `;

  banner.onclick = () => {
    if (clickAction) clickAction();
    banner.classList.add('slide-out');
    setTimeout(() => banner.remove(), 300);

    // Track analytics click
    trackNotificationClick(relatedId);
  };

  document.body.appendChild(banner);

  // Auto remove after 8 seconds
  setTimeout(() => {
    if (banner.parentElement) {
      banner.classList.add('slide-out');
      setTimeout(() => banner.remove(), 300);
    }
  }, 8000);
}

function addNotificationToHistory(title, body, type, relatedId) {
  realtimeEnsureData();
  const noti = {
    id: 'n_' + Date.now(),
    title,
    body,
    type,
    timestamp: new Date().toISOString(),
    read: false,
    clicked: false,
    relatedId
  };

  S.notifications.unshift(noti);
  
  // Clamp history size
  if (S.notifications.length > 50) S.notifications.pop();

  // Track Analytics
  S.notificationAnalytics.sentCount = (S.notificationAnalytics.sentCount || 0) + 1;
  if (relatedId) {
    if (!S.notificationAnalytics.history[relatedId]) {
      S.notificationAnalytics.history[relatedId] = { sent: 0, completedAfter: 0 };
    }
    S.notificationAnalytics.history[relatedId].sent++;
    S.lastReminderSent[relatedId] = Date.now();
  }

  save();
  updateUnreadNotificationCount();
  renderNotificationList();
}

function trackNotificationClick(relatedId) {
  realtimeEnsureData();
  S.notificationAnalytics.clickedCount = (S.notificationAnalytics.clickedCount || 0) + 1;
  save();
}

// ────────────────────────────────────────────────────────────────
//  TRIGGER CHECKING LOOP
// ────────────────────────────────────────────────────────────────

function checkRemindersLoop() {
  realtimeEnsureData();
  const now = new Date();
  const dateStr = fd(now);
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

  // Only run minute-level notifications once when the minute ticks
  if (timeStr !== _rtLastCheckedMinute) {
    _rtLastCheckedMinute = timeStr;
    
    // Run checks
    checkHabitReminders(dateStr, timeStr);
    checkStreakProtection(dateStr, timeStr);
    checkMissedHabits(dateStr, now);
    checkDailyReview(dateStr, timeStr);
    checkTomorrowPreview(dateStr, timeStr);
  }

  // Run seconds-sensitive task notifications (runs continuously)
  checkTaskReminders(now);
}

// 1. Habit Reminders
function checkHabitReminders(dateStr, timeStr) {
  if (!S.notificationSettings.habitsEnabled) return;
  const habits = S.habits || [];
  
  habits.forEach(h => {
    // If habit has a reminder set, matches current HH:MM, and remains pending today
    if (h.reminder === timeStr && gc(h.id, dateStr) !== 'dn') {
      const key = `habit_reminder_${h.id}_${dateStr}`;
      if (!S.sentNotifications[key]) {
        S.sentNotifications[key] = true;
        save();

        const stats = hStats(h.id);
        const nameAndTarget = h.target ? `${h.name} (${h.target})` : h.name;
        const streakText = stats.streak > 0 ? `Current Streak: ${stats.streak} Days` : 'Build your streak today!';
        const body = `Time for ${nameAndTarget}! ${streakText} · Rate: ${stats.rate}%`;

        triggerNotification(
          `🔔 Habit Reminder`,
          body,
          'habit',
          () => { go('dashboard'); },
          h.id
        );
      }
    }
  });
}

// 2. Task Reminders
function checkTaskReminders(now) {
  if (!S.notificationSettings.tasksEnabled) return;
  const tasks = S.tasks || [];
  const dateStr = fd(now);
  const curTimeMs = now.getTime();

  tasks.forEach(t => {
    if (t.status === 'pending' && t.reminderDate && t.reminderTime) {
      const remDateTime = new Date(`${t.reminderDate}T${t.reminderTime}:00`);
      // If current time is past the reminder datetime, and within the same day, and not yet notified
      if (curTimeMs >= remDateTime.getTime()) {
        const key = `task_reminder_${t.id}`;
        if (!S.sentNotifications[key]) {
          S.sentNotifications[key] = true;
          save();

          const dueLabel = t.dueDate === dateStr ? 'due today' : `due on ${fDisp(t.dueDate)}`;
          const timeLabel = t.dueTime ? ` at ${t.dueTime}` : '';

          triggerNotification(
            `🔔 Upcoming Task`,
            `${t.title} is ${dueLabel}${timeLabel}. Keep going!`,
            'task',
            () => { go('planner'); },
            t.id
          );
        }
      }
    }
  });

  // 3. Deadline Alert System
  checkDeadlineAlerts(tasks, now);
}

function checkDeadlineAlerts(tasks, now) {
  const curTimeMs = now.getTime();
  tasks.forEach(t => {
    if (t.status === 'pending' && t.dueDate) {
      // Parse due time (fallback to 23:59:59 of due date if not set)
      const dueTimeStr = t.dueTime || '23:59';
      const dueDateTime = new Date(`${t.dueDate}T${dueTimeStr}:00`);
      const diffMs = dueDateTime.getTime() - curTimeMs;

      if (diffMs > 0) {
        const diffMins = Math.round(diffMs / 60000);
        
        // A. 15 minutes before
        if (diffMins <= 15) {
          const key = `task_deadline_15m_${t.id}`;
          if (!S.sentNotifications[key]) {
            S.sentNotifications[key] = true;
            save();
            triggerNotification(
              `⚠️ Deadline: 15 Mins Left`,
              `"${t.title}" is due in 15 minutes. Priority: ${t.priority.toUpperCase()}`,
              'task',
              () => { go('planner'); },
              t.id
            );
          }
        }
        // B. 1 hour before
        else if (diffMins <= 60) {
          const key = `task_deadline_1h_${t.id}`;
          if (!S.sentNotifications[key]) {
            S.sentNotifications[key] = true;
            save();
            triggerNotification(
              `⚠️ Deadline: 1 Hour Left`,
              `"${t.title}" is due in 1 hour. Priority: ${t.priority.toUpperCase()}`,
              'task',
              () => { go('planner'); },
              t.id
            );
          }
        }
        // C. 24 hours before
        else if (diffMins <= 1440) {
          const key = `task_deadline_24h_${t.id}`;
          if (!S.sentNotifications[key]) {
            S.sentNotifications[key] = true;
            save();
            triggerNotification(
              `📅 Task Due Tomorrow`,
              `"${t.title}" is due in 24 hours. Priority: ${t.priority.toUpperCase()}`,
              'task',
              () => { go('planner'); },
              t.id
            );
          }
        }
      }
    }
  });
}

// 4. Streak Protection System
function checkStreakProtection(dateStr, timeStr) {
  if (!S.notificationSettings.streaksEnabled) return;
  const settings = S.notificationSettings;

  if (timeStr === settings.streakWarningTime) {
    const habits = S.habits || [];
    habits.forEach(h => {
      const stats = hStats(h.id);
      // If habit has a streak and is pending today
      if (stats.streak > 0 && gc(h.id, dateStr) !== 'dn') {
        const key = `streak_warning_${h.id}_${dateStr}`;
        if (!S.sentNotifications[key]) {
          S.sentNotifications[key] = true;
          save();
          triggerNotification(
            `🔥 Streak At Risk`,
            `Complete "${h.name}" before midnight to protect your ${stats.streak}-day streak!`,
            'system',
            () => { go('dashboard'); },
            h.id
          );
        }
      }
    });
  }
}

// 5. Missed Habit Alerts
function checkMissedHabits(dateStr, now) {
  const habits = S.habits || [];
  habits.forEach(h => {
    if (h.reminder && gc(h.id, dateStr) !== 'dn') {
      const [rh, rm] = h.reminder.split(':').map(Number);
      const reminderTime = new Date();
      reminderTime.setHours(rh, rm, 0, 0);

      // Check if current time is exactly 2 hours after the reminder
      const diffHrs = (now.getTime() - reminderTime.getTime()) / 3600000;
      
      // If past reminder by 2 hours (up to 2.1 hours to align with loop)
      if (diffHrs >= 2 && diffHrs < 2.1) {
        const key = `missed_alert_${h.id}_${dateStr}`;
        if (!S.sentNotifications[key]) {
          S.sentNotifications[key] = true;
          save();
          
          const stats = hStats(h.id);
          triggerNotification(
            `⚠️ Habit Pending`,
            `"${h.name}" was due 2 hours ago. Protect your ${stats.streak}d streak! Complete it?`,
            'habit',
            () => { togToday(h.id); },
            h.id
          );
        }
      }
    }
  });
}

// 6. Daily Review Notification
function checkDailyReview(dateStr, timeStr) {
  const settings = S.notificationSettings;
  if (!settings.dailyReviewEnabled) return;

  if (timeStr === settings.dailyReviewTime) {
    const key = `daily_review_${dateStr}`;
    if (!S.sentNotifications[key]) {
      S.sentNotifications[key] = true;
      save();

      const score = getCalculatedProductivityScore();
      const habits = S.habits || [];
      const habitsDone = habits.filter(h => gc(h.id, dateStr) === 'dn').length;

      let tasksDone = 0, tasksTotal = 0;
      if (S.tasks) {
        const todayTasks = S.tasks.filter(t => t.dueDate === dateStr);
        tasksTotal = todayTasks.length;
        tasksDone = todayTasks.filter(t => t.status === 'completed').length;
      }

      triggerNotification(
        `🌙 Daily Review`,
        `Today's completion: Habits ${habitsDone}/${habits.length} · Tasks ${tasksDone}/${tasksTotal}. Click to record daily reflection!`,
        'system',
        () => { go('journal'); }
      );
    }
  }
}

// 7. Tomorrow Preview System
function checkTomorrowPreview(dateStr, timeStr) {
  const settings = S.notificationSettings;
  if (!settings.tomorrowPreviewEnabled) return;

  if (timeStr === settings.tomorrowPreviewTime) {
    const key = `tomorrow_preview_${dateStr}`;
    if (!S.sentNotifications[key]) {
      S.sentNotifications[key] = true;
      save();

      // Find tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomStr = fd(tomorrow);

      // Core habits (always active/scheduled if daily)
      const habitsCount = (S.habits || []).length;
      
      // Tasks scheduled for tomorrow
      const tomTasks = (S.tasks || []).filter(t => t.dueDate === tomStr && t.status === 'pending');
      const tasksCount = tomTasks.length;

      // Find top priority task
      let topPriorityText = '';
      if (tasksCount > 0) {
        const sorted = [...tomTasks].sort((a,b) => {
          const order = { urgent: 0, high: 1, medium: 2, low: 3 };
          return (order[a.priority] || 2) - (order[b.priority] || 2);
        });
        topPriorityText = ` · Top Priority: ${sorted[0].title}`;
      }

      triggerNotification(
        `📅 Tomorrow Overview`,
        `Tomorrow workload: ${habitsCount} Habits scheduled & ${tasksCount} Tasks pending${topPriorityText}`,
        'system',
        () => { go('planner'); }
      );
    }
  }
}

// ────────────────────────────────────────────────────────────────
//  NOTIFICATION CENTER DRAWER
// ────────────────────────────────────────────────────────────────

function toggleNotificationCenter() {
  const overlay = document.getElementById('noti-drawer-overlay');
  const drawer  = document.getElementById('noti-drawer');
  if (!drawer) return;

  const isOpen = drawer.classList.contains('open');
  if (isOpen) {
    drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  } else {
    // Read all unreads
    markAllNotificationsAsRead();
    drawer.classList.add('open');
    if (overlay) overlay.classList.add('open');
    renderNotificationList();
  }
}

function updateUnreadNotificationCount() {
  realtimeEnsureData();
  const unreadCount = S.notifications.filter(n => !n.read).length;
  const badge = document.getElementById('noti-unread-count');
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.classList.remove('hid');
    } else {
      badge.classList.add('hid');
    }
  }
}

function markAllNotificationsAsRead() {
  realtimeEnsureData();
  S.notifications.forEach(n => n.read = true);
  save();
  updateUnreadNotificationCount();
}

function dismissNotification(id, event) {
  if (event) event.stopPropagation();
  realtimeEnsureData();
  S.notifications = S.notifications.filter(n => n.id !== id);
  save();
  updateUnreadNotificationCount();
  renderNotificationList();
}

function clearAllNotificationHistory() {
  realtimeEnsureData();
  S.notifications = [];
  save();
  updateUnreadNotificationCount();
  renderNotificationList();
}

function setNotiDrawerFilter(filter, btn) {
  _rtDrawerFilter = filter;
  document.querySelectorAll('.noti-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderNotificationList();
}

function renderNotificationList() {
  realtimeEnsureData();
  const el = document.getElementById('noti-list-container');
  if (!el) return;

  const filtered = _rtDrawerFilter === 'all'
    ? S.notifications
    : S.notifications.filter(n => n.type === _rtDrawerFilter);

  if (filtered.length === 0) {
    el.innerHTML = `
      <div class="es" style="padding: 40px 20px;">
        <div class="ei">🔔</div>
        <p class="t2">No notifications found.</p>
      </div>
    `;
    return;
  }

  const typeIcons = { habit: '🏃', task: '📅', goal: '🎯', system: '⚡' };

  el.innerHTML = filtered.map(n => {
    const timeLabel = new Date(n.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const dateLabel = new Date(n.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    const isUnread = !n.read;
    return `
      <div class="noti-item ${isUnread ? 'unread' : ''}" onclick="handleNotificationItemClick('${n.id}')">
        <div class="noti-item-icon">${typeIcons[n.type] || '🔔'}</div>
        <div class="noti-item-content">
          <div class="noti-item-title">${n.title}</div>
          <div class="noti-item-body">${n.body}</div>
          <div class="noti-item-time">⏱️ ${dateLabel} · ${timeLabel}</div>
        </div>
        <button class="noti-item-dismiss" onclick="dismissNotification('${n.id}', event)" title="Dismiss">✕</button>
      </div>
    `;
  }).join('');
}

function handleNotificationItemClick(id) {
  realtimeEnsureData();
  const noti = S.notifications.find(n => n.id === id);
  if (!noti) return;

  noti.read = true;
  noti.clicked = true;
  save();

  // Route to the appropriate page
  if (noti.type === 'habit') {
    go('dashboard');
    if (noti.relatedId && typeof openHabitDetail === 'function') {
      setTimeout(() => openHabitDetail(noti.relatedId), 300);
    }
  } else if (noti.type === 'task') {
    go('planner');
  } else if (noti.type === 'system') {
    if (noti.title.includes('Review')) {
      go('journal');
    } else {
      go('planner');
    }
  }

  // Close Drawer
  toggleNotificationCenter();
}

// ────────────────────────────────────────────────────────────────
//  SETTINGS RENDER & SAVE
// ────────────────────────────────────────────────────────────────

function renderNotificationSettings() {
  realtimeEnsureData();
  const settings = S.notificationSettings;
  const container = document.getElementById('settings-noti-content');
  if (!container) return;

  const permissionStatus = 'Notification' in window ? Notification.permission : 'Not supported';
  const grantLabel = permissionStatus === 'granted' ? '✅ Permitted' : permissionStatus === 'denied' ? '❌ Denied' : '⚠️ Request Permission';
  const buttonStyle = permissionStatus === 'default' ? 'bp' : 'bg';

  container.innerHTML = `
    <div class="settings-grid-2">
      <!-- Global Controls -->
      <div class="card cp settings-col-full">
        <div class="ct mb3">⚙️ Notification Permissions</div>
        <div class="sr">
          <div class="sri">
            <div class="srl">Permission Status</div>
            <div class="srd">Must be permitted to show OS push reminders</div>
          </div>
          <button class="btn ${buttonStyle} btn-sm" id="btn-request-perms" onclick="requestNotificationPermission()">${grantLabel}</button>
        </div>
        <div class="sr">
          <div class="sri">
            <div class="srl">Master Notification Toggle</div>
            <div class="srd">Enable or disable all notifications</div>
          </div>
          <div class="tgl ${settings.enabled ? 'on' : ''}" onclick="togNotiSetting('enabled', this)"></div>
        </div>
      </div>

      <!-- Feature Toggles -->
      <div class="card cp">
        <div class="ct mb3">🏃 Habit Reminders</div>
        <div class="sr">
          <div class="sri">
            <div class="srl">Habit Alerts</div>
            <div class="srd">Remind me to complete daily habits</div>
          </div>
          <div class="tgl ${settings.habitsEnabled ? 'on' : ''}" onclick="togNotiSetting('habitsEnabled', this)"></div>
        </div>
        <div class="sr-group">
          <div class="time-picker-row">
            <label>Streak Protection Alert</label>
            <input type="time" class="time-picker-input" id="set-streak-time" value="${settings.streakWarningTime || '21:00'}" onchange="saveNotiTimeSetting('streakWarningTime', this.value)">
          </div>
          <div class="sr">
            <div class="sri">
              <div class="srl" style="font-size:11.5px">Streak Warning</div>
              <div class="srd">Warn if active streak is pending</div>
            </div>
            <div class="tgl ${settings.streaksEnabled ? 'on' : ''}" onclick="togNotiSetting('streaksEnabled', this)"></div>
          </div>
        </div>
      </div>

      <!-- Planner Reminders -->
      <div class="card cp">
        <div class="ct mb3">📅 Planner Reminders</div>
        <div class="sr">
          <div class="sri">
            <div class="srl">Task Reminders</div>
            <div class="srd">Alert when task reminder time arrives</div>
          </div>
          <div class="tgl ${settings.tasksEnabled ? 'on' : ''}" onclick="togNotiSetting('tasksEnabled', this)"></div>
        </div>
        <div class="sr-group">
          <div class="time-picker-row">
            <label>🌙 Daily Review Time</label>
            <input type="time" class="time-picker-input" id="set-review-time" value="${settings.dailyReviewTime || '21:30'}" onchange="saveNotiTimeSetting('dailyReviewTime', this.value)">
          </div>
          <div class="sr" style="margin-bottom:0">
            <div class="sri">
              <div class="srl" style="font-size:11.5px">Daily Review Alert</div>
              <div class="srd">Evening wrap-up nudge</div>
            </div>
            <div class="tgl ${settings.dailyReviewEnabled ? 'on' : ''}" onclick="togNotiSetting('dailyReviewEnabled', this)"></div>
          </div>
        </div>
        <div class="sr-group" style="margin-top:8px">
          <div class="time-picker-row">
            <label>📅 Tomorrow Preview Time</label>
            <input type="time" class="time-picker-input" id="set-preview-time" value="${settings.tomorrowPreviewTime || '22:00'}" onchange="saveNotiTimeSetting('tomorrowPreviewTime', this.value)">
          </div>
          <div class="sr" style="margin-bottom:0">
            <div class="sri">
              <div class="srl" style="font-size:11.5px">Tomorrow Overview Alert</div>
              <div class="srd">Preview tomorrow's focus</div>
            </div>
            <div class="tgl ${settings.tomorrowPreviewEnabled ? 'on' : ''}" onclick="togNotiSetting('tomorrowPreviewEnabled', this)"></div>
          </div>
        </div>
      </div>

      <!-- Tone and Quiet Hours -->
      <div class="card cp">
        <div class="ct mb3">🔔 Alert Settings</div>
        <div class="sr">
          <div class="sri">
            <div class="srl">Notification Sound</div>
            <div class="srd">Select synthesizer tone alert</div>
          </div>
          <select class="fsl" style="width:100px;font-size:11px;padding:5px" onchange="saveNotiSoundSetting(this.value)">
            <option value="none" ${settings.sound === 'none' ? 'selected' : ''}>None 🔈</option>
            <option value="gentle" ${settings.sound === 'gentle' ? 'selected' : ''}>Gentle 🎶</option>
            <option value="success" ${settings.sound === 'success' ? 'selected' : ''}>Success 🏆</option>
            <option value="digital" ${settings.sound === 'digital' ? 'selected' : ''}>Digital 🤖</option>
          </select>
        </div>
        <div style="text-align:right;margin-bottom:12px">
          <button class="btn bs btn-sm" onclick="playNotificationSound(S.notificationSettings.sound)">🔊 Test Tone</button>
        </div>
        <div class="sr-group">
          <div class="sr" style="margin-bottom:4px">
            <div class="sri">
              <div class="srl">Do Not Disturb</div>
              <div class="srd">Silence alerts in designated hours</div>
            </div>
            <div class="tgl ${settings.quietHoursEnabled ? 'on' : ''}" onclick="togNotiSetting('quietHoursEnabled', this)"></div>
          </div>
          <div class="quiet-hours-row" style="justify-content:space-between">
            <div class="flex aic gap2">
              <span class="txs tm">Start</span>
              <input type="time" class="time-picker-input" id="set-quiet-start" value="${settings.quietHoursStart || '22:00'}" onchange="saveNotiTimeSetting('quietHoursStart', this.value)">
            </div>
            <div class="flex aic gap2">
              <span class="txs tm">End</span>
              <input type="time" class="time-picker-input" id="set-quiet-end" value="${settings.quietHoursEnd || '07:00'}" onchange="saveNotiTimeSetting('quietHoursEnd', this.value)">
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function requestNotificationPermission() {
  if (!('Notification' in window)) {
    toast('Notifications not supported by browser', 'error');
    return;
  }
  Notification.requestPermission().then(permission => {
    const btn = document.getElementById('btn-request-perms');
    if (btn) {
      if (permission === 'granted') {
        btn.className = 'btn bg btn-sm';
        btn.textContent = '✅ Permitted';
        toast('🎉 Notifications enabled!', 'success');
      } else {
        btn.className = 'btn bd btn-sm';
        btn.textContent = '❌ Denied';
        toast('⚠️ Notification permission denied', 'error');
      }
    }
  });
}

function togNotiSetting(key, el) {
  realtimeEnsureData();
  S.notificationSettings[key] = !S.notificationSettings[key];
  el.classList.toggle('on', S.notificationSettings[key]);
  save();
  toast('Setting updated', 'info');
}

function saveNotiTimeSetting(key, val) {
  realtimeEnsureData();
  S.notificationSettings[key] = val;
  save();
  toast('Alert time updated', 'success');
}

function saveNotiSoundSetting(val) {
  realtimeEnsureData();
  S.notificationSettings.sound = val;
  save();
  playNotificationSound(val);
  toast('Sound profile saved', 'success');
}

// ────────────────────────────────────────────────────────────────
//  ANALYTICS: NOTIFICATIONS PAGE RENDER
// ────────────────────────────────────────────────────────────────

function renderNotificationAnalytics() {
  realtimeEnsureData();
  const container = document.getElementById('analytics-panel-notifications');
  if (!container) return;

  const ana = S.notificationAnalytics;
  const sent = ana.sentCount || 0;
  const clicks = ana.clickedCount || 0;
  const openRate = sent > 0 ? Math.round((clicks / sent) * 100) : 0;

  // Calculate effectiveness metrics
  const rows = [];
  
  // Track habits
  (S.habits || []).forEach(h => {
    const data = ana.history[h.id] || { sent: 0, completedAfter: 0 };
    if (data.sent > 0) {
      const pct = Math.round((data.completedAfter / data.sent) * 100);
      rows.push({ name: `${h.icon} ${h.name}`, type: 'Habit', sent: data.sent, completed: data.completedAfter, pct });
    }
  });

  // Track tasks
  (S.tasks || []).forEach(t => {
    const data = ana.history[t.id] || { sent: 0, completedAfter: 0 };
    if (data.sent > 0) {
      const pct = Math.round((data.completedAfter / data.sent) * 100);
      rows.push({ name: t.title, type: 'Task', sent: data.sent, completed: data.completedAfter, pct });
    }
  });

  // Calculate overall average effectiveness
  const totalSentReminders = rows.reduce((s, r) => s + r.sent, 0);
  const totalCompletionsAfterReminders = rows.reduce((s, r) => s + r.completed, 0);
  const avgEffectiveness = totalSentReminders > 0 ? Math.round((totalCompletionsAfterReminders / totalSentReminders) * 100) : 0;

  rows.sort((a,b) => b.pct - a.pct); // sort by highest effectiveness

  container.innerHTML = `
    <!-- Stat Cards -->
    <div class="noti-stats-summary">
      <div class="card cp" style="text-align:center">
        <div style="font-size:22px;font-weight:800;color:var(--purple)">${sent}</div>
        <div class="txs tm mt3">🔔 Notifications Sent</div>
      </div>
      <div class="card cp" style="text-align:center">
        <div style="font-size:22px;font-weight:800;color:var(--blue)">${openRate}%</div>
        <div class="txs tm mt3">🖱️ Notification Open Rate</div>
      </div>
      <div class="card cp" style="text-align:center">
        <div style="font-size:22px;font-weight:800;color:var(--green)">${avgEffectiveness}%</div>
        <div class="txs tm mt3">📈 Completion After Reminder</div>
      </div>
    </div>

    <!-- Details Table -->
    <div class="card cp">
      <div class="ct mb4">📊 Reminder Effectiveness Breakdown</div>
      <div style="overflow-x:auto">
        <table class="noti-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Type</th>
              <th>Reminders Sent</th>
              <th>Completed After</th>
              <th>Success Rate</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0 ? `
              <tr>
                <td colspan="5" style="text-align:center;color:var(--t3);padding:24px">No notification analytics recorded yet.</td>
              </tr>
            ` : rows.map(r => `
              <tr>
                <td style="font-weight:600">${r.name}</td>
                <td><span class="badge ${r.type === 'Habit' ? 'bp2' : 'bb'}">${r.type}</span></td>
                <td>${r.sent}</td>
                <td>${r.completed}</td>
                <td style="color:${r.pct >= 80 ? 'var(--green)' : r.pct >= 50 ? 'var(--amber)' : '#f87171'};font-weight:700">${r.pct}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="ag mt4">
      <div class="card">
        <div class="ch"><span class="ct">🍩 Notification Type Share</span></div>
        <div class="cp"><div class="cw"><canvas id="c-noti-donut"></canvas></div></div>
      </div>
      <div class="card">
        <div class="ch"><span class="ct">📈 Response Rate Trend</span></div>
        <div class="cp"><div class="cw"><canvas id="c-noti-effectiveness"></canvas></div></div>
      </div>
    </div>
  `;

  // Draw chart widgets
  if (rows.length > 0) {
    requestAnimationFrame(() => renderNotificationCharts(rows));
  }
}

function renderNotificationCharts(rows) {
  // 1. Donut chart
  const donutCv = document.getElementById('c-noti-donut');
  if (donutCv) {
    const habitSent = rows.filter(r => r.type === 'Habit').reduce((s,r) => s + r.sent, 0);
    const taskSent  = rows.filter(r => r.type === 'Task').reduce((s,r) => s + r.sent, 0);
    
    new Chart(donutCv, {
      type: 'doughnut',
      data: {
        labels: ['Habits', 'Tasks'],
        datasets: [{
          data: [habitSent, taskSent],
          backgroundColor: ['#8b5cf6', '#3b82f6'],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Inter', size: 10 }, usePointStyle: true } },
          tooltip: tooltipCfg()
        },
        cutout: '65%'
      }
    });
  }

  // 2. Effectiveness Bar Chart
  const effCv = document.getElementById('c-noti-effectiveness');
  if (effCv) {
    // Show top 5 most effective reminders
    const top5 = rows.slice(0, 5);
    new Chart(effCv, {
      type: 'bar',
      data: {
        labels: top5.map(r => r.name),
        datasets: [{
          data: top5.map(r => r.pct),
          backgroundColor: top5.map(r => r.pct >= 80 ? 'rgba(34,197,94,.6)' : 'rgba(139,92,246,.6)'),
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: tooltipCfg()
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } } },
          y: { min: 0, max: 100, grid: { color: 'rgba(148,163,184,.06)' }, ticks: { color: '#64748b', font: { family: 'Inter', size: 10 }, callback: v => v+'%' } }
        }
      }
    });
  }
}

// ────────────────────────────────────────────────────────────────
//  REACTIVE HOOKS (RAPID UPDATES)
// ────────────────────────────────────────────────────────────────

// Capture completion status changes and check if within 1 hour of a reminder
function checkCompletionAfterReminder(id) {
  realtimeEnsureData();
  const lastSent = S.lastReminderSent[id];
  if (lastSent) {
    const diff = Date.now() - lastSent;
    // Checked completed within 1 hour
    if (diff > 0 && diff <= 3600000) {
      if (!S.notificationAnalytics.history[id]) {
        S.notificationAnalytics.history[id] = { sent: 0, completedAfter: 0 };
      }
      S.notificationAnalytics.history[id].completedAfter++;
      // Clean up pointer to count exactly once per reminder
      delete S.lastReminderSent[id];
      save();
    }
  }
}

// ────────────────────────────────────────────────────────────────
//  INSTALL / BOOTSTRAP
// ────────────────────────────────────────────────────────────────

(function bootRealTimeSystem() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _installRealTimeSystem);
  } else {
    _installRealTimeSystem();
  }
})();

function _installRealTimeSystem() {
  realtimeEnsureData();

  // 1. Wrap global save()
  const originalSave = window.save;
  window.save = function() {
    originalSave();
    updateTodayStatusBar();
    // Auto-refresh Dashboard if active view
    if (curPage === 'dashboard' && typeof rDash === 'function') {
      rDash();
    }
  };

  // 2. Wrap switchAnalyticsTab()
  if (window.switchAnalyticsTab) {
    const originalSwitch = window.switchAnalyticsTab;
    window.switchAnalyticsTab = function(tab) {
      originalSwitch(tab);
      if (tab === 'notifications') {
        renderNotificationAnalytics();
      }
    };
  }

  // 3. Inject listeners for checking completions
  const originalTogToday = window.togToday;
  if (originalTogToday) {
    window.togToday = function(hid) {
      originalTogToday(hid);
      const isCompleted = gc(hid, ts()) === 'dn';
      if (isCompleted) {
        checkCompletionAfterReminder(hid);
      }
    };
  }

  const originalPlannerToggleTask = window.plannerToggleTask;
  if (originalPlannerToggleTask) {
    window.plannerToggleTask = function(taskId, dateStr) {
      originalPlannerToggleTask(taskId, dateStr);
      const task = S.tasks.find(t => t.id === taskId);
      if (task && task.status === 'completed') {
        checkCompletionAfterReminder(taskId);
      }
    };
  }

  // 4. Expose Drawer actions globally
  window.toggleNotificationCenter     = toggleNotificationCenter;
  window.dismissNotification           = dismissNotification;
  window.clearAllNotificationHistory   = clearAllNotificationHistory;
  window.setNotiDrawerFilter           = setNotiDrawerFilter;
  window.requestNotificationPermission = requestNotificationPermission;
  window.togNotiSetting                = togNotiSetting;
  window.saveNotiTimeSetting           = saveNotiTimeSetting;
  window.saveNotiSoundSetting          = saveNotiSoundSetting;
  window.playNotificationSound         = playNotificationSound;

  // 5. Build settings view hook
  const originalRSettings = window.rSettings;
  if (originalRSettings) {
    window.rSettings = function() {
      originalRSettings();
      renderNotificationSettings();
    };
  }

  // 6. Listen for SW messages
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
        const parts = event.data.tag ? event.data.tag.split('_') : [];
        const type = parts[0];
        const relatedId = parts[1];
        
        // Track analytics click
        trackNotificationClick(relatedId);

        if (type === 'habit') {
          go('dashboard');
          if (relatedId && typeof openHabitDetail === 'function') {
            setTimeout(() => openHabitDetail(relatedId), 300);
          }
        } else if (type === 'task') {
          go('planner');
        } else if (type === 'system') {
          go('journal');
        }
      }
    });
  }

  // 7. Fire clock loop
  startRealTimeLoop();
}
