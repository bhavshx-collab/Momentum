/**
 * lifeareas.js — Custom Life Areas management and Life Wheel radar chart
 */

function lifeAreasEnsureData() {
  if (!S.lifeAreas || S.lifeAreas.length === 0) {
    S.lifeAreas = [
      { id: 'la_learning', name: 'Learning', icon: '📚', color: '#3b82f6', archived: false, order: 0 },
      { id: 'la_fitness', name: 'Fitness', icon: '🏋️', color: '#ef4444', archived: false, order: 1 },
      { id: 'la_career', name: 'Career', icon: '💻', color: '#8b5cf6', archived: false, order: 2 },
      { id: 'la_finance', name: 'Finance', icon: '💰', color: '#10b981', archived: false, order: 3 },
      { id: 'la_mental', name: 'Mental Health', icon: '🧠', color: '#06b6d4', archived: false, order: 4 },
      { id: 'la_relationships', name: 'Relationships', icon: '❤️', color: '#ec4899', archived: false, order: 5 }
    ];
    save();
  }
}

// Populate drop-downs dynamically
function updateCategoryDropdowns() {
  const hCat = document.getElementById('h-cat');
  const tCat = document.getElementById('t-cat');
  const categories = getLifeAreaCategories();
  
  if (hCat) {
    hCat.innerHTML = categories.map(c => `<option>${c}</option>`).join('');
  }
  if (tCat) {
    tCat.innerHTML = categories.map(c => `<option>${c}</option>`).join('');
  }
}

function getLifeAreaCategories() {
  lifeAreasEnsureData();
  return S.lifeAreas
    .filter(a => !a.archived)
    .sort((a, b) => a.order - b.order)
    .map(a => a.name);
}

function renderLifeAreas() {
  lifeAreasEnsureData();
  const listEl = document.getElementById('lifeareas-list');
  const archivedListEl = document.getElementById('lifeareas-archived-list');
  if (!listEl) return;

  const activeAreas = S.lifeAreas.filter(a => !a.archived).sort((a, b) => a.order - b.order);
  const archivedAreas = S.lifeAreas.filter(a => a.archived).sort((a, b) => a.order - b.order);

  // Render Active Areas
  if (activeAreas.length === 0) {
    listEl.innerHTML = `<div class="es"><p class="t2">No active life areas. Add one to get started!</p></div>`;
  } else {
    listEl.innerHTML = activeAreas.map((a, idx) => {
      // Habit count
      const habitsCount = S.habits.filter(h => h.category === a.name && h.active).length;
      const tasksCount = S.tasks ? S.tasks.filter(t => t.category === a.name && t.status !== 'completed').length : 0;
      
      return `
        <div class="card la-card" style="border-left: 4px solid ${a.color}">
          <div class="la-header">
            <div class="la-icon-box" style="background: ${a.color}15; color: ${a.color}">${a.icon}</div>
            <div class="la-info">
              <h4 class="la-name">${a.name}</h4>
              <p class="la-stats">${habitsCount} habits · ${tasksCount} active tasks</p>
            </div>
            <div class="la-actions">
              <button class="btn bg btn-ico btn-sm" onclick="reorderLifeArea('${a.id}', -1)" ${idx === 0 ? 'disabled' : ''} title="Move Up">↑</button>
              <button class="btn bg btn-ico btn-sm" onclick="reorderLifeArea('${a.id}', 1)" ${idx === activeAreas.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
              <button class="btn bg btn-ico btn-sm" onclick="openLifeAreaModal('${a.id}')" title="Edit">✏️</button>
              <button class="btn bg btn-ico btn-sm" onclick="archiveLifeArea('${a.id}', true)" title="Archive" ${activeAreas.length <= 3 ? 'disabled' : ''}>📥</button>
              <button class="btn bd btn-ico btn-sm" onclick="deleteLifeArea('${a.id}')" title="Delete" ${activeAreas.length <= 3 ? 'disabled' : ''}>🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Archived Areas
  if (archivedListEl) {
    if (archivedAreas.length === 0) {
      archivedListEl.innerHTML = `<p class="txs tm" style="padding: 10px 0;">No archived life areas.</p>`;
    } else {
      archivedListEl.innerHTML = archivedAreas.map(a => `
        <div class="card la-card archived-la" style="opacity: 0.7; border-left: 4px solid var(--border-color)">
          <div class="la-header">
            <div class="la-icon-box" style="background: rgba(148,163,184,0.1); color: var(--t3)">${a.icon}</div>
            <div class="la-info">
              <h4 class="la-name">${a.name} <span class="badge bg" style="font-size: 9px; padding: 2px 6px;">Archived</span></h4>
            </div>
            <div class="la-actions">
              <button class="btn bg btn-ico btn-sm" onclick="archiveLifeArea('${a.id}', false)" title="Unarchive">📤</button>
              <button class="btn bd btn-ico btn-sm" onclick="deleteLifeArea('${a.id}')" title="Delete">🗑️</button>
            </div>
          </div>
        </div>
      `).join('');
    }
  }

  // Update dropdown options
  updateCategoryDropdowns();
}

function openLifeAreaModal(eid) {
  const modal = document.getElementById('m-lifearea');
  if (!modal) return;
  
  const a = eid ? S.lifeAreas.find(x => x.id === eid) : null;
  document.getElementById('la-eid').value = eid || '';
  document.getElementById('lam-title').textContent = a ? '✏️ Edit Life Area' : '🌱 Add Life Area';
  document.getElementById('la-name').value = a ? a.name : '';
  
  // Icon selector
  const selectedIcon = a ? a.icon : '📚';
  document.getElementById('la-icons').innerHTML = ICONS.slice(0, 16).map(ic => `
    <button type="button" class="ib ${ic === selectedIcon ? 'sel' : ''}" onclick="selectPriority(this, '${ic}', 'la-icons-sel')">${ic}</button>
  `).join('');
  
  // Color selector
  const selectedCol = a ? a.color : COLS[0];
  document.getElementById('la-colors').innerHTML = COLS.map(c => `
    <div class="sw ${c === selectedCol ? 'sel' : ''}" style="background:${c}" data-c="${c}" onclick="selectColorSwatch(this, 'la-colors-sel')"></div>
  `).join('');
  
  modal.classList.remove('hid');
  document.getElementById('la-name').focus();
}

function selectColorSwatch(el, containerClass) {
  el.parentElement.querySelectorAll('.sw').forEach(sw => sw.classList.remove('sel'));
  el.classList.add('sel');
}

function closeLifeAreaModal() {
  document.getElementById('m-lifearea').classList.add('hid');
}

function saveLifeArea() {
  const name = document.getElementById('la-name').value.trim();
  if (!name) {
    toast('Please enter a name', 'error');
    return;
  }
  
  // Check if we are exceeding 12 categories
  const activeCount = S.lifeAreas.filter(a => !a.archived).length;
  const eid = document.getElementById('la-eid').value;
  
  if (!eid && activeCount >= 12) {
    toast('Maximum of 12 life areas allowed', 'error');
    return;
  }
  
  const selectedIconEl = document.querySelector('#la-icons .ib.sel') || document.querySelector('#la-icons .ib');
  const icon = selectedIconEl ? selectedIconEl.textContent.trim() : '📚';
  
  const selectedColEl = document.querySelector('#la-colors .sw.sel') || document.querySelector('#la-colors .sw');
  const color = selectedColEl ? selectedColEl.dataset.c : '#8b5cf6';
  
  if (eid) {
    const i = S.lifeAreas.findIndex(a => a.id === eid);
    if (i >= 0) {
      const oldName = S.lifeAreas[i].name;
      S.lifeAreas[i].name = name;
      S.lifeAreas[i].icon = icon;
      S.lifeAreas[i].color = color;
      
      // Update categories for current habits/tasks if name changed
      if (oldName !== name) {
        S.habits.forEach(h => { if (h.category === oldName) h.category = name; });
        if (S.tasks) S.tasks.forEach(t => { if (t.category === oldName) t.category = name; });
      }
      toast('✅ Life Area updated!', 'success');
    }
  } else {
    const newOrder = S.lifeAreas.length;
    S.lifeAreas.push({
      id: 'la_' + Date.now(),
      name,
      icon,
      color,
      archived: false,
      order: newOrder
    });
    toast('🌱 Life Area created!', 'success');
    
    // Log timeline event
    if (typeof addTimelineEvent === 'function') {
      addTimelineEvent('lifearea', 'New Life Area Created', `You added a new focus domain: ${icon} ${name}`);
    }
  }
  
  save();
  closeLifeAreaModal();
  renderLifeAreas();
}

function archiveLifeArea(id, toggle) {
  const i = S.lifeAreas.findIndex(a => a.id === id);
  if (i >= 0) {
    const activeAreas = S.lifeAreas.filter(a => !a.archived);
    if (toggle && activeAreas.length <= 3) {
      toast('Must keep at least 3 active life areas', 'error');
      return;
    }
    
    S.lifeAreas[i].archived = toggle;
    save();
    toast(toggle ? '📥 Archived Life Area' : '📤 Restored Life Area', 'success');
    renderLifeAreas();
  }
}

function deleteLifeArea(id) {
  const a = S.lifeAreas.find(x => x.id === id);
  if (!a) return;
  
  const activeAreas = S.lifeAreas.filter(a => !a.archived);
  if (!a.archived && activeAreas.length <= 3) {
    toast('Must keep at least 3 active life areas', 'error');
    return;
  }
  
  document.getElementById('conf-icon').textContent = a.icon || '🌱';
  document.getElementById('conf-title').textContent = 'Delete Life Area';
  document.getElementById('conf-msg').innerHTML = `
    Delete <strong>"${a.name}"</strong>? 
    <br><br>
    <span class="txs tm" style="color:var(--red)">
      Note: Existing habits & tasks will keep their category name in history, but you will not be able to assign this category to new items.
    </span>
  `;
  document.getElementById('conf-ok').textContent = 'Delete';
  document.getElementById('conf-ok').onclick = () => {
    S.lifeAreas = S.lifeAreas.filter(x => x.id !== id);
    save();
    closeConf();
    renderLifeAreas();
    toast('🗑️ Deleted Life Area', 'info');
  };
  document.getElementById('m-confirm').classList.remove('hid');
}

function reorderLifeArea(id, direction) {
  const activeAreas = S.lifeAreas.filter(a => !a.archived).sort((a, b) => a.order - b.order);
  const idx = activeAreas.findIndex(a => a.id === id);
  if (idx < 0) return;
  
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= activeAreas.length) return;
  
  // Swap order values
  const temp = activeAreas[idx].order;
  activeAreas[idx].order = activeAreas[targetIdx].order;
  activeAreas[targetIdx].order = temp;
  
  save();
  renderLifeAreas();
}

// Radar Chart for Analytics -> Life Balance tab
function rLifeWheel() {
  lifeAreasEnsureData();
  const cv = document.getElementById('c-life-wheel');
  if (!cv) return;
  
  if (charts.lifeWheel) {
    charts.lifeWheel.destroy();
  }
  
  const activeAreas = S.lifeAreas.filter(a => !a.archived).sort((a, b) => a.order - b.order);
  const labels = [];
  const scores = [];
  const borderColors = [];
  const bgColors = [];
  
  activeAreas.forEach(a => {
    labels.push(`${a.icon} ${a.name}`);
    
    // Calculate score: average completion rate of habits in this category over 30 days
    const habitsInCat = S.habits.filter(h => h.category === a.name && h.active);
    let avgRate = 0;
    if (habitsInCat.length > 0) {
      const totalRate = habitsInCat.reduce((sum, h) => {
        const stats = hStats(h.id);
        return sum + stats.rate;
      }, 0);
      avgRate = Math.round(totalRate / habitsInCat.length);
    } else {
      // Default to a small base score or task completion if no habits
      const tasksInCat = S.tasks ? S.tasks.filter(t => t.category === a.name) : [];
      if (tasksInCat.length > 0) {
        const completed = tasksInCat.filter(t => t.status === 'completed').length;
        avgRate = Math.round((completed / tasksInCat.length) * 100);
      }
    }
    
    scores.push(avgRate);
    borderColors.push(a.color);
    bgColors.push(a.color + '33');
  });
  
  // Chart.js Radar
  charts.lifeWheel = new Chart(cv, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Balance Score',
        data: scores,
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        borderColor: '#8b5cf6',
        pointBackgroundColor: borderColors,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: borderColors,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Score: ${context.raw}%`;
            }
          }
        }
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20,
            color: '#64748b',
            backdropColor: 'transparent',
            font: { size: 9, family: 'Inter' }
          },
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
          angleLines: { color: 'rgba(148, 163, 184, 0.08)' },
          pointLabels: {
            color: '#94a3b8',
            font: { size: 11, family: 'Inter', weight: '600' }
          }
        }
      }
    }
  });
}

// Expose functions globally
window.lifeAreasEnsureData = lifeAreasEnsureData;
window.renderLifeAreas = renderLifeAreas;
window.openLifeAreaModal = openLifeAreaModal;
window.closeLifeAreaModal = closeLifeAreaModal;
window.saveLifeArea = saveLifeArea;
window.archiveLifeArea = archiveLifeArea;
window.deleteLifeArea = deleteLifeArea;
window.reorderLifeArea = reorderLifeArea;
window.getLifeAreaCategories = getLifeAreaCategories;
window.rLifeWheel = rLifeWheel;
window.updateCategoryDropdowns = updateCategoryDropdowns;
