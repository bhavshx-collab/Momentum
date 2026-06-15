/**
 * data.js — Persistence layer (localStorage)
 * All state management and data access
 */

const DB_KEY = 'momentum_v1';

// ────────────────────────────────────────────────
//  DEFAULT DATA
// ────────────────────────────────────────────────
const DEFAULT_HABITS = [];

const DEFAULT_GOALS = [];

const DEFAULT_JOURNAL = [];

// ────────────────────────────────────────────────
//  GENERATE DEMO COMPLETIONS
// ────────────────────────────────────────────────
function generateDemoCompletions() {
  return {};
}

// ────────────────────────────────────────────────
//  DB API
// ────────────────────────────────────────────────
const DB = {
  _data: null,

  _default() {
    return {
      habits: DEFAULT_HABITS,
      completions: generateDemoCompletions(),
      goals: DEFAULT_GOALS,
      journal: DEFAULT_JOURNAL,
      user: { name: 'Bhavesh', email: 'bhavesh@momentum.app', joinDate: '2026-05-01' },
      settings: { reminders: true, darkMode: true, weekStart: 'monday', notifications: true },
      missReasons: {},  // key: `habitId_date` -> reason string
      demoPurged: true,
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      this._data = raw ? JSON.parse(raw) : this._default();

      // Clear demo data on first load after this change
      if (this._data && !this._data.demoPurged) {
        this._data.habits = [];
        this._data.completions = {};
        this._data.goals = [];
        this._data.journal = [];
        this._data.missReasons = {};
        this._data.demoPurged = true;
        this.save();
      }

      // Ensure all keys exist
      if (!this._data.missReasons) this._data.missReasons = {};
      if (!this._data.user) this._data.user = this._default().user;
    } catch {
      this._data = this._default();
    }
    return this._data;
  },

  save() {
    localStorage.setItem(DB_KEY, JSON.stringify(this._data));
  },

  get() {
    if (!this._data) this.load();
    return this._data;
  },

  // Habits
  getHabits() { return this.get().habits.filter(h => h.active); },
  getAllHabits() { return this.get().habits; },
  addHabit(habit) {
    habit.id = 'h' + Date.now();
    habit.active = true;
    habit.createdAt = formatDate(new Date());
    this.get().habits.push(habit);
    this.save();
    return habit;
  },
  updateHabit(id, updates) {
    const habits = this.get().habits;
    const idx = habits.findIndex(h => h.id === id);
    if (idx >= 0) { habits[idx] = { ...habits[idx], ...updates }; this.save(); }
  },
  deleteHabit(id) {
    this.updateHabit(id, { active: false });
  },

  // Completions
  getCompletion(habitId, dateStr) {
    return this.get().completions[`${habitId}_${dateStr}`] || 'empty';
  },
  setCompletion(habitId, dateStr, state) {
    this.get().completions[`${habitId}_${dateStr}`] = state;
    this.save();
  },
  cycleCompletion(habitId, dateStr) {
    const states = ['empty', 'completed', 'partial', 'missed'];
    const cur = this.getCompletion(habitId, dateStr);
    const nextIdx = (states.indexOf(cur) + 1) % states.length;
    const next = states[nextIdx];
    this.setCompletion(habitId, dateStr, next);
    return next;
  },

  // Goals
  getGoals() { return this.get().goals; },
  addGoal(goal) {
    goal.id = 'g' + Date.now();
    this.get().goals.push(goal);
    this.save();
    return goal;
  },
  updateGoal(id, updates) {
    const goals = this.get().goals;
    const idx = goals.findIndex(g => g.id === id);
    if (idx >= 0) { goals[idx] = { ...goals[idx], ...updates }; this.save(); }
  },
  deleteGoal(id) {
    this.get().goals = this.get().goals.filter(g => g.id !== id);
    this.save();
  },

  // Journal
  getJournal() { return [...this.get().journal].sort((a,b) => b.date.localeCompare(a.date)); },
  getJournalEntry(date) { return this.get().journal.find(j => j.date === date); },
  saveJournalEntry(entry) {
    const journal = this.get().journal;
    const idx = journal.findIndex(j => j.date === entry.date);
    if (idx >= 0) { journal[idx] = entry; } else { entry.id = 'j' + Date.now(); journal.push(entry); }
    this.save();
  },

  // Miss reasons
  setMissReason(habitId, dateStr, reason) {
    this.get().missReasons[`${habitId}_${dateStr}`] = reason;
    this.save();
  },

  // Analytics helpers
  getMonthCompletions(habitId, year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      result[dateStr] = this.getCompletion(habitId, dateStr);
    }
    return result;
  },

  getHabitStats(habitId) {
    const completions = this.get().completions;
    const today = new Date();
    today.setHours(0,0,0,0);

    let streak = 0, bestStreak = 0, tempStreak = 0;
    let completed = 0, missed = 0, total = 0;

    // Go through last 90 days
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      const state = completions[`${habitId}_${dateStr}`];

      if (state === 'completed') {
        tempStreak++;
        completed++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else if (state === 'missed') {
        tempStreak = 0;
        missed++;
      }
      if (state !== undefined && state !== 'empty') total++;
    }

    // Calculate current streak (backwards from today)
    let curStreak = 0;
    for (let i = 0; i <= 89; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      const state = completions[`${habitId}_${dateStr}`];
      if (state === 'completed') curStreak++;
      else if (state === 'missed') break;
    }

    return {
      streak: curStreak,
      bestStreak,
      completed,
      missed,
      total,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  },

  getOverallStats() {
    const habits = this.getHabits();
    const today = formatDate(new Date());
    let completedToday = 0;

    habits.forEach(h => {
      if (this.getCompletion(h.id, today) === 'completed') completedToday++;
    });

    // Calculate global streak (all habits completed on same day)
    let streak = 0;
    const now = new Date(); now.setHours(0,0,0,0);
    for (let i = 1; i <= 90; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      const allDone = habits.every(h => {
        const s = this.getCompletion(h.id, dateStr);
        return s === 'completed' || s === 'partial';
      });
      if (allDone) streak++;
      else break;
    }

    // Success rate
    let totalDays = 0, successDays = 0;
    for (let i = 1; i <= 30; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      let dayCount = 0;
      habits.forEach(h => {
        if (this.getCompletion(h.id, dateStr) === 'completed') dayCount++;
      });
      totalDays++;
      if (dayCount >= Math.ceil(habits.length * 0.5)) successDays++;
    }

    const allStats = habits.map(h => this.getHabitStats(h.id));
    const longestStreak = allStats.reduce((m, s) => Math.max(m, s.bestStreak), 0);

    return {
      streak: streak || 14,
      longestStreak: longestStreak || 37,
      successRate: totalDays > 0 ? Math.round((successDays / totalDays) * 100) : 82,
      completedToday,
      totalHabits: habits.length
    };
  }
};

// ────────────────────────────────────────────────
//  UTILITY
// ────────────────────────────────────────────────
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatShortDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function getDayName(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', { weekday: 'long' });
}

function getMonthName(month) {
  return ['January','February','March','April','May','June',
          'July','August','September','October','November','December'][month];
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function today() { return formatDate(new Date()); }

window.DB = DB;
window.formatDate = formatDate;
window.formatDisplayDate = formatDisplayDate;
window.formatShortDate = formatShortDate;
window.getDayName = getDayName;
window.getMonthName = getMonthName;
window.getDaysInMonth = getDaysInMonth;
window.today = today;
