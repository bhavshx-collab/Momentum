/**
 * goals.js — Goals tracking page
 */

const GoalsPage = {
  render() {
    this.renderGoals();
  },

  renderGoals() {
    const goals = DB.getGoals();
    const el = document.getElementById('goals-container');
    if (!el) return;

    if (goals.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎯</div>
          <h3>No goals yet</h3>
          <p>Set your first long-term goal and track your progress towards it.</p>
          <button class="btn btn-primary" onclick="GoalsPage.showAddGoal()">+ Add Goal</button>
        </div>
      `;
      return;
    }

    const gradients = [
      'var(--gradient-purple)', 'var(--gradient-blue)', 'var(--gradient-green)',
      'var(--gradient-amber)', 'var(--gradient-rose)'
    ];

    el.innerHTML = `
      <div class="goals-grid">
        ${goals.map((g, i) => this.renderGoalCard(g, gradients[i % gradients.length])).join('')}
      </div>
    `;
  },

  renderGoalCard(g, gradient) {
    const done = g.milestones.filter(m => m.done).length;
    const total = g.milestones.length;
    const deadlineDate = new Date(g.deadline + 'T00:00:00');
    const daysLeft = Math.ceil((deadlineDate - new Date()) / (1000*60*60*24));
    const daysText = daysLeft > 0 ? `${daysLeft} days left` : 'Deadline passed';

    return `
      <div class="card goal-card">
        <div class="goal-card-header">
          <div class="goal-icon" style="background:${g.color}22;color:${g.color};border:1px solid ${g.color}33">${g.icon}</div>
          <div class="goal-info">
            <div class="goal-title">${g.title}</div>
            <div class="goal-deadline">
              <span>📅</span>
              <span>${deadlineDate.toLocaleDateString('en-IN',{month:'short',day:'numeric',year:'numeric'})}</span>
              <span class="badge ${daysLeft < 30 ? 'badge-rose' : 'badge-purple'}">${daysText}</span>
            </div>
          </div>
        </div>

        <div class="goal-progress-section">
          <div class="goal-progress-header">
            <span class="goal-progress-label">${done}/${total} milestones complete</span>
            <span class="goal-progress-pct">${g.progress}%</span>
          </div>
          <div class="progress-bar thick">
            <div class="progress-fill" style="width:${g.progress}%;background:${gradient}"></div>
          </div>
        </div>

        <div class="goal-milestones">
          ${g.milestones.map((m, mi) => `
            <div class="milestone-item ${m.done ? 'done' : ''}" 
                 onclick="GoalsPage.toggleMilestone('${g.id}',${mi})">
              <div class="milestone-check">${m.done ? '✓' : ''}</div>
              <span class="milestone-text">${m.text}</span>
            </div>
          `).join('')}
        </div>

        <div style="display:flex;gap:8px;margin-top:4px" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-sm" style="flex:1" onclick="GoalsPage.showEditGoal('${g.id}')">✏️ Edit</button>
          <button class="btn btn-secondary btn-sm" style="flex:1" onclick="GoalsPage.updateProgress('${g.id}')">📊 Progress</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="GoalsPage.deleteGoal('${g.id}')">🗑</button>
        </div>
      </div>
    `;
  },

  toggleMilestone(goalId, milestoneIdx) {
    const goals = DB.getGoals();
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    goal.milestones[milestoneIdx].done = !goal.milestones[milestoneIdx].done;
    const done = goal.milestones.filter(m => m.done).length;
    goal.progress = Math.round((done / goal.milestones.length) * 100);
    DB.updateGoal(goalId, goal);
    this.renderGoals();
    showToast(goal.milestones[milestoneIdx].done ? '✅ Milestone completed!' : '↩️ Milestone unchecked', 'success');
  },

  updateProgress(goalId) {
    const goal = DB.getGoals().find(g => g.id === goalId);
    if (!goal) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal animate-scale-in" style="max-width:360px">
        <div class="modal-header">
          <div class="modal-title">Update Progress</div>
          <button class="btn btn-icon btn-ghost" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div style="text-align:center;margin-bottom:20px">
            <div style="font-size:48px">${goal.icon}</div>
            <div style="font-weight:700;margin-top:8px">${goal.title}</div>
          </div>
          <div class="form-group">
            <label class="form-label">Progress: <span id="prog-display">${goal.progress}%</span></label>
            <input type="range" min="0" max="100" value="${goal.progress}" id="prog-slider"
              style="width:100%;accent-color:var(--purple-500);margin-top:8px"
              oninput="document.getElementById('prog-display').textContent=this.value+'%'">
          </div>
          <div class="progress-bar thick mt-2">
            <div class="progress-fill" id="prog-bar-preview" style="width:${goal.progress}%;transition:width 0.1s"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <button class="btn btn-primary" onclick="GoalsPage.saveProgress('${goalId}',this.closest('.modal-overlay'))">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('prog-slider')?.addEventListener('input', (e) => {
      document.getElementById('prog-bar-preview').style.width = e.target.value + '%';
    });
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  },

  saveProgress(goalId, modal) {
    const pct = parseInt(document.getElementById('prog-slider')?.value) || 0;
    DB.updateGoal(goalId, { progress: pct });
    modal.remove();
    this.renderGoals();
    showToast(`🎯 Progress updated to ${pct}%`, 'success');
  },

  showAddGoal() {
    this._showGoalModal(null);
  },

  showEditGoal(id) {
    const goal = DB.getGoals().find(g => g.id === id);
    this._showGoalModal(goal);
  },

  _showGoalModal(goal) {
    const icons = ['🎯','📚','💪','💼','🌱','🏠','💰','🎨','🎵','✈️','🤖','⚖️','🏃','🧠','🌍'];
    const colors = ['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ef4444','#06b6d4','#6366f1','#ec4899'];

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'goal-modal';
    modal.innerHTML = `
      <div class="modal animate-scale-in">
        <div class="modal-header">
          <div class="modal-title">${goal ? '✏️ Edit Goal' : '🎯 New Goal'}</div>
          <button class="btn btn-icon btn-ghost" onclick="document.getElementById('goal-modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Goal Title *</label>
            <input class="form-input" id="gf-title" placeholder="e.g. Read 12 Books" value="${goal?.title||''}">
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Deadline</label>
              <input class="form-input" id="gf-deadline" type="date" value="${goal?.deadline||''}">
            </div>
            <div class="form-group">
              <label class="form-label">Initial Progress %</label>
              <input class="form-input" id="gf-progress" type="number" min="0" max="100" value="${goal?.progress||0}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Icon</label>
            <div class="icon-picker-row">
              ${icons.map(ic => `
                <button class="icon-option ${goal?.icon===ic?'selected':''}" onclick="this.parentElement.querySelectorAll('.icon-option').forEach(e=>e.classList.remove('selected'));this.classList.add('selected')">${ic}</button>
              `).join('')}
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Color</label>
            <div class="color-picker-row">
              ${colors.map(c => `
                <div class="color-option ${goal?.color===c?'selected':''}" style="background:${c}" onclick="this.parentElement.querySelectorAll('.color-option').forEach(e=>e.classList.remove('selected'));this.classList.add('selected')"></div>
              `).join('')}
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Milestones (one per line)</label>
            <textarea class="form-textarea" id="gf-milestones" placeholder="Complete Python basics&#10;Finish ML course&#10;Build first model">${goal ? goal.milestones.map(m=>m.text).join('\n') : ''}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="document.getElementById('goal-modal').remove()">Cancel</button>
          <button class="btn btn-primary" onclick="GoalsPage._saveGoal('${goal?.id||''}')">
            ${goal ? 'Save Changes' : '+ Add Goal'}
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('gf-title')?.focus();
  },

  _saveGoal(existingId) {
    const title = document.getElementById('gf-title')?.value.trim();
    if (!title) { showToast('Please enter a goal title', 'error'); return; }
    const icon = document.querySelector('#goal-modal .icon-option.selected')?.textContent || '🎯';
    const color = document.querySelector('#goal-modal .color-option.selected')?.style.background || '#8b5cf6';
    const deadline = document.getElementById('gf-deadline')?.value || '';
    const progress = parseInt(document.getElementById('gf-progress')?.value) || 0;
    const milestonesRaw = document.getElementById('gf-milestones')?.value.trim().split('\n').filter(Boolean) || [];
    const milestones = milestonesRaw.map(text => {
      if (existingId) {
        const g = DB.getGoals().find(g => g.id === existingId);
        const existing = g?.milestones.find(m => m.text === text);
        return existing || { text, done: false };
      }
      return { text, done: false };
    });

    const goalData = { title, icon, color, deadline, progress, milestones };

    if (existingId) {
      DB.updateGoal(existingId, goalData);
      showToast('✅ Goal updated!', 'success');
    } else {
      DB.addGoal(goalData);
      showToast('🎯 Goal created!', 'success');
    }

    document.getElementById('goal-modal')?.remove();
    this.renderGoals();
  },

  deleteGoal(id) {
    const goal = DB.getGoals().find(g => g.id === id);
    if (!confirm(`Delete goal "${goal?.title}"?`)) return;
    DB.deleteGoal(id);
    showToast('🗑 Goal deleted', 'info');
    this.renderGoals();
  }
};

window.GoalsPage = GoalsPage;
