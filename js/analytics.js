/**
 * analytics.js — Analytics page with Chart.js charts
 */

const Analytics = {
  charts: {},

  render() {
    this.renderInsights();
    this.renderRanking();
    this.renderMissedDays();
    this.renderMissReasons();

    // Charts need a small delay to ensure canvas is in DOM
    requestAnimationFrame(() => {
      this.renderCompletionTrend();
      this.renderHabitDistribution();
      this.renderWeeklyConsistency();
    });
  },

  destroyCharts() {
    Object.values(this.charts).forEach(c => { try { c.destroy(); } catch(e){} });
    this.charts = {};
  },

  renderCompletionTrend() {
    const canvas = document.getElementById('chart-trend');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const habits = DB.getHabits();
    const now = new Date(); now.setHours(0,0,0,0);
    const labels = [];
    const data = [];

    // Last 12 weeks
    for (let w = 11; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - w * 7 - 6);
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - w * 7);

      let completed = 0, total = 0;
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDate(d);
        habits.forEach(h => {
          const s = DB.getCompletion(h.id, dateStr);
          if (s !== 'empty') { total++; if (s === 'completed') completed++; }
        });
      }

      const weekLabel = weekStart.toLocaleDateString('en',{month:'short',day:'numeric'});
      labels.push(weekLabel);
      data.push(total > 0 ? Math.round((completed/total)*100) : 0);
    }

    if (this.charts.trend) this.charts.trend.destroy();
    this.charts.trend = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Completion %',
          data,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139,92,246,0.1)',
          borderWidth: 2.5,
          pointBackgroundColor: '#8b5cf6',
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4
        }]
      },
      options: chartOptions('Completion Rate %', true)
    });
  },

  renderHabitDistribution() {
    const canvas = document.getElementById('chart-distribution');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const habits = DB.getHabits();
    const catMap = {};
    habits.forEach(h => {
      const stats = DB.getHabitStats(h.id);
      catMap[h.category] = (catMap[h.category] || 0) + stats.completed;
    });

    const labels = Object.keys(catMap);
    const data = Object.values(catMap);
    const bgColors = ['#8b5cf6','#3b82f6','#10b981','#f59e0b','#06b6d4','#f43f5e','#6366f1'];

    if (this.charts.dist) this.charts.dist.destroy();
    this.charts.dist = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: bgColors.slice(0, labels.length),
          borderWidth: 0,
          hoverOffset: 8
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
              font: { family: 'Inter', size: 11 },
              padding: 12,
              usePointStyle: true,
              pointStyleWidth: 8
            }
          },
          tooltip: tooltipStyle()
        },
        cutout: '65%'
      }
    });
  },

  renderWeeklyConsistency() {
    const canvas = document.getElementById('chart-weekly');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const habits = DB.getHabits();
    const now = new Date(); now.setHours(0,0,0,0);

    // 4 weeks
    const weekData = [];
    for (let w = 3; w >= 0; w--) {
      let completed = 0, total = 0;
      for (let d = 0; d < 7; d++) {
        const date = new Date(now);
        date.setDate(date.getDate() - w * 7 - (6 - d));
        const dateStr = formatDate(date);
        habits.forEach(h => {
          const s = DB.getCompletion(h.id, dateStr);
          if (s !== 'empty') { total++; if (s === 'completed') completed++; }
        });
      }
      weekData.push(total > 0 ? Math.round((completed/total)*100) : 0);
    }

    if (this.charts.weekly) this.charts.weekly.destroy();
    this.charts.weekly = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [{
          label: 'Completion %',
          data: weekData,
          backgroundColor: weekData.map(v => v >= 80 ? 'rgba(52,211,153,0.7)' : v >= 60 ? 'rgba(139,92,246,0.7)' : 'rgba(251,113,133,0.7)'),
          borderRadius: 8,
          borderSkipped: false,
        }]
      },
      options: chartOptions('Completion %', false)
    });
  },

  renderMissedDays() {
    const habits = DB.getHabits();
    const el = document.getElementById('missed-days-grid');
    if (!el) return;

    if (habits.length === 0) {
      el.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted); grid-column: span 7;">No habit data available.</div>';
      return;
    }

    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const missCounts = [0,0,0,0,0,0,0];
    const now = new Date(); now.setHours(0,0,0,0);

    for (let i = 0; i < 30; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);
      let dow = d.getDay(); // 0=Sun
      dow = dow === 0 ? 6 : dow - 1; // Convert to Mon=0
      habits.forEach(h => {
        if (DB.getCompletion(h.id, dateStr) === 'missed') missCounts[dow]++;
      });
    }

    const maxMiss = Math.max(...missCounts);
    const worstIdx = missCounts.indexOf(maxMiss);

    el.innerHTML = days.map((day, i) => {
      const pct = maxMiss > 0 ? Math.round((missCounts[i]/maxMiss)*100) : 0;
      const isWorst = i === worstIdx && maxMiss > 0;
      return `
        <div class="missed-day-item ${isWorst ? 'worst-day' : ''}">
          <div class="missed-day-name">${day}</div>
          <div class="missed-day-count">${missCounts[i]}</div>
          <div class="missed-day-bar">
            <div class="missed-day-fill" style="width:${pct}%"></div>
          </div>
          ${isWorst ? '<div style="font-size:10px;color:var(--rose-400);font-weight:700">Worst</div>' : ''}
        </div>
      `;
    }).join('');
  },

  renderMissReasons() {
    const missReasons = DB.get().missReasons || {};
    const counts = { Busy:0, Forgot:0, 'Low Energy':0, Travel:0, 'No Motivation':0, Other:0 };
    let total = 0;
    Object.values(missReasons).forEach(r => {
      if (counts[r] !== undefined) { counts[r]++; total++; }
    });

    const el = document.getElementById('miss-reasons-list');
    if (!el) return;

    if (total === 0) {
      el.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted)">No missed habits recorded yet.</div>';
      return;
    }

    const colors = { Busy:'#3b82f6', Forgot:'#8b5cf6', 'Low Energy':'#f59e0b', Travel:'#06b6d4', 'No Motivation':'#f43f5e', Other:'#6b7280' };

    el.innerHTML = Object.entries(counts).map(([reason, count]) => {
      const pct = total > 0 ? Math.round((count/total)*100) : 0;
      return `
        <div class="miss-reason-item">
          <div class="miss-reason-label">${reasonIcon(reason)} ${reason}</div>
          <div class="miss-reason-bar-wrap">
            <div class="miss-reason-fill" style="width:${pct}%;background:${colors[reason]}"></div>
          </div>
          <div class="miss-reason-pct">${pct}%</div>
        </div>
      `;
    }).join('');
  },

  renderRanking() {
    const habits = DB.getHabits();
    const el = document.getElementById('habit-ranking');
    if (!el) return;

    if (habits.length === 0) {
      el.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted)">No habits available yet.</div>';
      return;
    }

    const ranked = habits.map(h => ({
      habit: h,
      stats: DB.getHabitStats(h.id)
    })).sort((a, b) => b.stats.rate - a.stats.rate);

    el.innerHTML = ranked.map((item, i) => {
      const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      return `
        <div class="rank-item">
          <div class="rank-position ${rankClass}">${i+1}</div>
          <div class="rank-info">
            <div class="rank-name">${item.habit.icon} ${item.habit.name}</div>
            <div class="rank-category">${item.habit.category} · ${item.stats.streak} day streak</div>
          </div>
          <div class="rank-bar-container">
            <div class="progress-bar thin">
              <div class="progress-fill" style="width:${item.stats.rate}%"></div>
            </div>
          </div>
          <div class="rank-score">${item.stats.rate}%</div>
        </div>
      `;
    }).join('');
  },

  renderInsights() {
    const habits = DB.getHabits();
    const el = document.getElementById('advanced-insights');
    if (!el) return;

    if (habits.length === 0) {
      el.innerHTML = `
        <div class="insight-card" style="grid-column: span 3; padding: 32px; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 8px">📊</div>
          <div style="font-weight: 600; font-size: 15px">No Insights Available</div>
          <div style="color: var(--text-muted); font-size: 13px; margin-top: 4px">Insights will appear here once you add habits and start tracking them.</div>
        </div>
      `;
      return;
    }

    const statsArr = habits.map(h => ({ habit: h, stats: DB.getHabitStats(h.id) }));
    statsArr.sort((a,b) => b.stats.rate - a.stats.rate);

    const best = statsArr[0];
    const worst = statsArr[statsArr.length - 1];
    const maxStreak = statsArr.reduce((m, s) => s.stats.bestStreak > m.stats.bestStreak ? s : m);

    // Most improved (highest rate this month vs last month — simplified)
    const now = new Date();
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    // Best day analysis
    const dayScores = [0,0,0,0,0,0,0];
    const dayCounts = [0,0,0,0,0,0,0];
    for (let i = 0; i < 30; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0,0,0,0);
      const dateStr = formatDate(d);
      const dow = d.getDay();
      habits.forEach(h => {
        if (DB.getCompletion(h.id, dateStr) === 'completed') dayScores[dow]++;
        dayCounts[dow]++;
      });
    }
    const dayRates = dayScores.map((s,i) => dayCounts[i] > 0 ? s/dayCounts[i] : 0);
    const bestDayIdx = dayRates.indexOf(Math.max(...dayRates));
    const worstDayIdx = dayRates.indexOf(Math.min(...dayRates));

    el.innerHTML = `
      <div class="insight-card">
        <div class="insight-icon">🌟</div>
        <div class="insight-title">Most Consistent</div>
        <div class="insight-value">${best?.habit.icon} ${best?.habit.name}</div>
        <div class="insight-sub">${best?.stats.rate}% completion rate</div>
      </div>
      <div class="insight-card">
        <div class="insight-icon">😴</div>
        <div class="insight-title">Most Neglected</div>
        <div class="insight-value">${worst?.habit.icon} ${worst?.habit.name}</div>
        <div class="insight-sub">${worst?.stats.rate}% completion rate</div>
      </div>
      <div class="insight-card">
        <div class="insight-icon">🔥</div>
        <div class="insight-title">Longest Streak</div>
        <div class="insight-value">${maxStreak?.habit.icon} ${maxStreak?.habit.name}</div>
        <div class="insight-sub">${maxStreak?.stats.bestStreak} days best streak</div>
      </div>
      <div class="insight-card">
        <div class="insight-icon">📅</div>
        <div class="insight-title">Best Day of Week</div>
        <div class="insight-value">${days[bestDayIdx]}</div>
        <div class="insight-sub">${Math.round(dayRates[bestDayIdx]*100)}% avg completion</div>
      </div>
      <div class="insight-card">
        <div class="insight-icon">⚠️</div>
        <div class="insight-title">Worst Day of Week</div>
        <div class="insight-value">${days[worstDayIdx]}</div>
        <div class="insight-sub">${Math.round(dayRates[worstDayIdx]*100)}% avg completion</div>
      </div>
      <div class="insight-card">
        <div class="insight-icon">📊</div>
        <div class="insight-title">Habits Tracked</div>
        <div class="insight-value">${habits.length} Habits</div>
        <div class="insight-sub">Across ${[...new Set(habits.map(h=>h.category))].length} categories</div>
      </div>
    `;
  }
};

function chartOptions(yLabel, showY = true) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: false },
      tooltip: tooltipStyle()
    },
    scales: {
      x: {
        grid: { color: 'rgba(148,163,184,0.06)', drawBorder: false },
        ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } }
      },
      y: {
        display: showY,
        min: 0, max: 100,
        grid: { color: 'rgba(148,163,184,0.06)', drawBorder: false },
        ticks: { color: '#64748b', font: { family: 'Inter', size: 11 },
          callback: v => v + '%' }
      }
    }
  };
}

function tooltipStyle() {
  return {
    backgroundColor: '#1e2941',
    borderColor: 'rgba(139,92,246,0.3)',
    borderWidth: 1,
    titleColor: '#f1f5f9',
    bodyColor: '#94a3b8',
    padding: 10,
    cornerRadius: 8,
    titleFont: { family: 'Inter', size: 12 },
    bodyFont: { family: 'Inter', size: 11 }
  };
}

window.Analytics = Analytics;
window.chartOptions = chartOptions;
window.tooltipStyle = tooltipStyle;
