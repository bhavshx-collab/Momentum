/**
 * challenges.js — Challenge System
 */

function challengesEnsureData() {
  if (!S.challenges) {
    S.challenges = [
      {
        id: 'ch_default_1',
        title: '30-Day Sleep Reset',
        icon: '😴',
        color: '#3b82f6',
        totalDays: 30,
        startDate: today(),
        completedDays: [1, 2, 3], // relative day numbers
        milestones: [
          { dayNum: 7, text: 'First Week Complete', completed: true },
          { dayNum: 14, text: 'Halfway Mark', completed: false },
          { dayNum: 30, text: 'Sleep Master', completed: false }
        ]
      },
      {
        id: 'ch_default_2',
        title: '21-Day No Sugar',
        icon: '🍎',
        color: '#ef4444',
        totalDays: 21,
        startDate: today(),
        completedDays: [1, 2],
        milestones: [
          { dayNum: 7, text: 'Sugar Free 1 Week', completed: false },
          { dayNum: 21, text: 'Sweet Cleanse Complete', completed: false }
        ]
      }
    ];
    save();
  }
}

function renderChallenges() {
  challengesEnsureData();
  const container = document.getElementById('challenges-container');
  if (!container) return;

  if (S.challenges.length === 0) {
    container.innerHTML = `
      <div class="es" style="grid-column: 1/-1; padding: 40px 20px;">
        <div class="ei">🏆</div>
        <p class="t2">No active challenges</p>
        <button class="btn bp mt3" onclick="openChallengeModal()">+ Start Challenge</button>
      </div>
    `;
    return;
  }

  container.innerHTML = S.challenges.map(ch => {
    const stats = getChallengeStats(ch);
    const progress = Math.round((ch.completedDays.length / ch.totalDays) * 100);
    
    // Generate day grid cells
    let gridHtml = '';
    for (let d = 1; d <= ch.totalDays; d++) {
      const isCompleted = ch.completedDays.includes(d);
      gridHtml += `
        <div class="ch-grid-cell ${isCompleted ? 'completed' : ''}" 
             style="--ch-theme: ${ch.color}" 
             onclick="toggleChallengeDay('${ch.id}', ${d})" 
             title="Day ${d}">
          ${d}
        </div>
      `;
    }

    // Milestones status
    const milestonesHtml = ch.milestones && ch.milestones.length > 0 ? `
      <div class="ch-milestones">
        <div class="ch-sec-title">📍 Milestones</div>
        ${ch.milestones.map((m, idx) => {
          const isReached = ch.completedDays.length >= m.dayNum;
          return `
            <div class="ch-milestone-item ${isReached ? 'reached' : ''}" onclick="toggleChallengeMilestone('${ch.id}', ${idx})">
              <div class="ch-milestone-check">${isReached || m.completed ? '✓' : ''}</div>
              <div class="ch-milestone-text">
                <span class="fw6">Day ${m.dayNum}:</span> ${m.text}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : '';

    return `
      <div class="card ch-card" style="border-top: 5px solid ${ch.color}">
        <div class="ch-header">
          <div class="ch-icon-box" style="background: ${ch.color}15; color: ${ch.color}">${ch.icon}</div>
          <div style="flex:1">
            <h4 class="ch-title">${ch.title}</h4>
            <div class="ch-meta">Started on ${fDisp(ch.startDate)} · ${ch.totalDays} Days</div>
          </div>
          <div class="ch-actions">
            <button class="btn bg btn-ico btn-sm" onclick="openChallengeModal('${ch.id}')" title="Edit">✏️</button>
            <button class="btn bd btn-ico btn-sm" onclick="deleteChallenge('${ch.id}')" title="Delete">🗑️</button>
          </div>
        </div>

        <div class="ch-stats-grid">
          <div class="ch-stat-box">
            <div class="ch-stat-val" style="color: ${ch.color}">${progress}%</div>
            <div class="ch-stat-lbl">Progress</div>
          </div>
          <div class="ch-stat-box">
            <div class="ch-stat-val">🔥 ${stats.currentStreak}</div>
            <div class="ch-stat-lbl">Streak</div>
          </div>
          <div class="ch-stat-box">
            <div class="ch-stat-val">🏆 ${stats.bestStreak}</div>
            <div class="ch-stat-lbl">Best Streak</div>
          </div>
        </div>

        <div class="ch-grid-container">
          <div class="ch-sec-title">📅 Check-in Grid</div>
          <div class="ch-grid">${gridHtml}</div>
        </div>

        ${milestonesHtml}
      </div>
    `;
  }).join('');
}

function getChallengeStats(ch) {
  const completed = [...ch.completedDays].sort((a, b) => a - b);
  
  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;

  // Longest and current streak algorithm based on consecutive integers
  for (let i = 1; i <= ch.totalDays; i++) {
    if (completed.includes(i)) {
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  // Current streak (working backwards from the maximum completed day)
  if (completed.length > 0) {
    const maxDay = Math.max(...completed);
    let check = maxDay;
    while (completed.includes(check)) {
      currentStreak++;
      check--;
    }
  }

  return {
    currentStreak,
    bestStreak,
    completionRate: Math.round((completed.length / ch.totalDays) * 100)
  };
}

function toggleChallengeDay(id, dayNum) {
  const ch = S.challenges.find(x => x.id === id);
  if (!ch) return;

  const idx = ch.completedDays.indexOf(dayNum);
  if (idx >= 0) {
    ch.completedDays.splice(idx, 1);
  } else {
    ch.completedDays.push(dayNum);
  }
  
  // Auto-check milestones based on completion days count
  if (ch.milestones) {
    ch.milestones.forEach(m => {
      if (ch.completedDays.length >= m.dayNum) {
        m.completed = true;
      }
    });
  }

  save();
  renderChallenges();
  
  // Show streak hit event
  const stats = getChallengeStats(ch);
  if (stats.currentStreak > 0 && idx < 0) {
    toast(`Day ${dayNum} checked! Streak: ${stats.currentStreak} days 🔥`, 'success');
    
    // Log timeline event on milestones/streaks
    if (stats.currentStreak % 7 === 0 && typeof addTimelineEvent === 'function') {
      addTimelineEvent('challenge', 'Challenge Streak Milestone', `You reached a ${stats.currentStreak}-day streak in "${ch.title}"!`);
    }
  } else {
    toast('Challenge day updated', 'info');
  }
}

function toggleChallengeMilestone(id, idx) {
  const ch = S.challenges.find(x => x.id === id);
  if (ch && ch.milestones[idx]) {
    ch.milestones[idx].completed = !ch.milestones[idx].completed;
    save();
    renderChallenges();
    toast('Milestone updated', 'success');
  }
}

function openChallengeModal(eid) {
  const modal = document.getElementById('m-challenge');
  if (!modal) return;
  
  const ch = eid ? S.challenges.find(x => x.id === eid) : null;
  document.getElementById('ch-eid').value = eid || '';
  document.getElementById('chm-title').textContent = ch ? '✏️ Edit Challenge' : '🏆 Start New Challenge';
  document.getElementById('ch-title').value = ch ? ch.title : '';
  document.getElementById('ch-days').value = ch ? ch.totalDays : 30;
  
  // Milestones text area
  document.getElementById('ch-ms').value = ch && ch.milestones ? ch.milestones.map(m => `Day ${m.dayNum}: ${m.text}`).join('\n') : 'Day 7: First week consistency\nDay 15: Halfway victory\nDay 30: Challenge conqueror';
  
  // Select icon
  const selectedIcon = ch ? ch.icon : '🏆';
  document.getElementById('ch-icons').innerHTML = GOAL_ICONS.map(ic => `
    <button type="button" class="ib ${ic === selectedIcon ? 'sel' : ''}" onclick="selectPriority(this, '${ic}', 'ch-icons-sel')">${ic}</button>
  `).join('');
  
  // Select color
  const selectedCol = ch ? ch.color : COLS[0];
  document.getElementById('ch-colors').innerHTML = COLS.map(c => `
    <div class="sw ${c === selectedCol ? 'sel' : ''}" style="background:${c}" data-c="${c}" onclick="selectColorSwatch(this, 'ch-colors-sel')"></div>
  `).join('');
  
  modal.classList.remove('hid');
  document.getElementById('ch-title').focus();
}

function closeChallengeModal() {
  document.getElementById('m-challenge').classList.add('hid');
}

function saveChallenge() {
  const title = document.getElementById('ch-title').value.trim();
  const totalDays = parseInt(document.getElementById('ch-days').value) || 30;
  
  if (!title) {
    toast('Title is required', 'error');
    return;
  }
  
  const eid = document.getElementById('ch-eid').value;
  const icon = document.querySelector('#ch-icons .ib.sel')?.textContent.trim() || '🏆';
  const color = document.querySelector('#ch-colors .sw.sel')?.dataset.c || '#8b5cf6';
  
  // Parse milestones from textarea
  const msLines = document.getElementById('ch-ms').value.trim().split('\n').filter(Boolean);
  const milestones = msLines.map(line => {
    // Format is "Day X: Description text"
    const match = line.match(/^Day\s*(\d+)\s*:\s*(.+)$/i);
    if (match) {
      return {
        dayNum: parseInt(match[1]),
        text: match[2].trim(),
        completed: false
      };
    }
    return null;
  }).filter(Boolean);

  if (eid) {
    const idx = S.challenges.findIndex(c => c.id === eid);
    if (idx >= 0) {
      S.challenges[idx].title = title;
      S.challenges[idx].totalDays = totalDays;
      S.challenges[idx].icon = icon;
      S.challenges[idx].color = color;
      S.challenges[idx].milestones = milestones;
      toast('✅ Challenge updated!', 'success');
    }
  } else {
    S.challenges.push({
      id: 'ch_' + Date.now(),
      title,
      icon,
      color,
      totalDays,
      startDate: today(),
      completedDays: [],
      milestones
    });
    toast('🏆 New Challenge started!', 'success');
    
    // Log timeline event
    if (typeof addTimelineEvent === 'function') {
      addTimelineEvent('challenge', 'New Challenge Started', `You began the challenge: ${icon} ${title} for ${totalDays} days.`);
    }
  }
  
  save();
  closeChallengeModal();
  renderChallenges();
}

function deleteChallenge(id) {
  const ch = S.challenges.find(x => x.id === id);
  if (!ch) return;
  
  document.getElementById('conf-icon').textContent = ch.icon || '🏆';
  document.getElementById('conf-title').textContent = 'Delete Challenge';
  document.getElementById('conf-msg').innerHTML = `Delete <strong>"${ch.title}"</strong> and all check-in history?`;
  document.getElementById('conf-ok').textContent = 'Delete';
  document.getElementById('conf-ok').onclick = () => {
    S.challenges = S.challenges.filter(x => x.id !== id);
    save();
    closeConf();
    renderChallenges();
    toast('🗑️ Challenge deleted', 'info');
  };
  document.getElementById('m-confirm').classList.remove('hid');
}

// Expose globally
window.challengesEnsureData = challengesEnsureData;
window.renderChallenges = renderChallenges;
window.toggleChallengeDay = toggleChallengeDay;
window.toggleChallengeMilestone = toggleChallengeMilestone;
window.openChallengeModal = openChallengeModal;
window.closeChallengeModal = closeChallengeModal;
window.saveChallenge = saveChallenge;
window.deleteChallenge = deleteChallenge;
window.getChallengeStats = getChallengeStats;
