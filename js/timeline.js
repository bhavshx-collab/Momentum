/**
 * timeline.js — Life Timeline
 */

function timelineEnsureData() {
  if (!S.timeline) {
    S.timeline = [
      {
        id: 't_default_1',
        type: 'milestone',
        title: 'Welcome to Momentum Growth OS',
        date: today(),
        detail: 'Started tracking habits and tasks on Momentum. Your growth journey begins!'
      }
    ];
    save();
  }
}

function renderTimeline() {
  timelineEnsureData();
  const listEl = document.getElementById('timeline-list');
  if (!listEl) return;

  if (S.timeline.length === 0) {
    listEl.innerHTML = `
      <div class="es" style="padding: 40px 20px;">
        <div class="ei">🌍</div>
        <p class="t2">Your timeline is empty</p>
        <p class="tm txs mt1">Events will be added automatically as you build streaks and complete goals.</p>
        <button class="btn bp mt3" onclick="openTimelineEventModal()">+ Add Event</button>
      </div>
    `;
    return;
  }

  // Sort timeline events: newest first
  const sorted = [...S.timeline].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const typeIcons = {
    habit: '✅',
    goal: '🎯',
    challenge: '🏆',
    lifearea: '🌱',
    reflection: '📝',
    milestone: '✨',
    custom: '✏️'
  };

  listEl.innerHTML = `
    <div class="timeline-line"></div>
    ${sorted.map(e => {
      const icon = typeIcons[e.type] || '✨';
      const displayDate = fDisp(e.date);
      return `
        <div class="timeline-event">
          <div class="timeline-event-marker" title="${e.type}">${icon}</div>
          <div class="card timeline-event-card">
            <div class="timeline-event-header">
              <h4 class="timeline-event-title">${e.title}</h4>
              <span class="timeline-event-date">${displayDate}</span>
            </div>
            <p class="timeline-event-detail">${e.detail}</p>
            <div class="timeline-event-actions">
              <button class="btn bd btn-ico btn-sm" onclick="deleteTimelineEvent('${e.id}')" title="Delete Event">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('')}
  `;
}

function addTimelineEvent(type, title, detail, dateStr) {
  timelineEnsureData();
  const newEvent = {
    id: 't_event_' + Date.now(),
    type: type || 'custom',
    title,
    detail,
    date: dateStr || today()
  };
  S.timeline.unshift(newEvent);
  save();
  
  // If active tab is timeline, render it
  if (typeof curPage !== 'undefined' && curPage === 'timeline') {
    renderTimeline();
  }
}

function openTimelineEventModal() {
  const modal = document.getElementById('m-timeline-event');
  if (!modal) return;
  
  document.getElementById('te-title').value = '';
  document.getElementById('te-detail').value = '';
  document.getElementById('te-date').value = today();
  document.getElementById('te-type').value = 'custom';
  
  modal.classList.remove('hid');
  document.getElementById('te-title').focus();
}

function closeTimelineEventModal() {
  document.getElementById('m-timeline-event').classList.add('hid');
}

function saveTimelineEvent() {
  const title = document.getElementById('te-title').value.trim();
  const detail = document.getElementById('te-detail').value.trim();
  const dateStr = document.getElementById('te-date').value || today();
  const type = document.getElementById('te-type').value || 'custom';
  
  if (!title || !detail) {
    toast('Title and detail are required', 'error');
    return;
  }
  
  addTimelineEvent(type, title, detail, dateStr);
  closeTimelineEventModal();
  renderTimeline();
  toast('✨ Event added to timeline!', 'success');
}

function deleteTimelineEvent(id) {
  const e = S.timeline.find(x => x.id === id);
  if (!e) return;
  
  document.getElementById('conf-icon').textContent = '🗑️';
  document.getElementById('conf-title').textContent = 'Delete Timeline Event';
  document.getElementById('conf-msg').innerHTML = `Remove event <strong>"${e.title}"</strong> from your life timeline?`;
  document.getElementById('conf-ok').textContent = 'Delete';
  document.getElementById('conf-ok').onclick = () => {
    S.timeline = S.timeline.filter(x => x.id !== id);
    save();
    closeConf();
    renderTimeline();
    toast('🗑️ Event removed', 'info');
  };
  document.getElementById('m-confirm').classList.remove('hid');
}

// Expose globally
window.timelineEnsureData = timelineEnsureData;
window.renderTimeline = renderTimeline;
window.addTimelineEvent = addTimelineEvent;
window.openTimelineEventModal = openTimelineEventModal;
window.closeTimelineEventModal = closeTimelineEventModal;
window.saveTimelineEvent = saveTimelineEvent;
window.deleteTimelineEvent = deleteTimelineEvent;
