/**
 * knowledge.js — Knowledge Vault
 */

function knowledgeEnsureData() {
  if (!S.knowledge) {
    S.knowledge = [
      {
        id: 'k_default_1',
        topic: 'Building Habits of Excellence',
        content: 'Habits are the compound interest of self-improvement. Getting 1% better each day builds massive momentum over time. Focus on systems rather than goals.',
        category: 'Learning',
        date: today(),
        tags: ['habits', 'systems', 'productivity']
      },
      {
        id: 'k_default_2',
        topic: 'Cardio vs Strength Streaks',
        content: 'Maintain balance. Doing intense cardio every day breaks down muscle. Alternate strength days with active recovery or light zone-2 runs.',
        category: 'Fitness',
        date: today(),
        tags: ['fitness', 'health', 'running']
      }
    ];
    save();
  }
}

let activeKnowledgeTag = '';
let activeKnowledgeCategory = 'All';

function renderKnowledge() {
  knowledgeEnsureData();
  const listEl = document.getElementById('knowledge-list');
  const tagListEl = document.getElementById('knowledge-tags');
  const catFilterEl = document.getElementById('knowledge-cat-filter');
  
  if (!listEl) return;

  const searchQuery = document.getElementById('knowledge-search')?.value.toLowerCase().trim() || '';

  // Get active Life Areas for category filter options
  const activeCategories = getLifeAreaCategories();
  if (catFilterEl && catFilterEl.children.length <= 1) {
    catFilterEl.innerHTML = `<option value="All">All Categories</option>` +
      activeCategories.map(c => `<option value="${c}">${c}</option>`).join('');
    catFilterEl.value = activeKnowledgeCategory;
  }

  // Gather all unique tags
  const allTags = new Set();
  S.knowledge.forEach(k => {
    if (k.tags) k.tags.forEach(t => allTags.add(t));
  });

  // Render tag chips
  if (tagListEl) {
    let tagsHtml = `<button class="tag-chip ${activeKnowledgeTag === '' ? 'active' : ''}" onclick="filterKnowledgeByTag('')">🏷️ All Tags</button>`;
    allTags.forEach(t => {
      tagsHtml += `<button class="tag-chip ${activeKnowledgeTag === t ? 'active' : ''}" onclick="filterKnowledgeByTag('${t}')">#${t}</button>`;
    });
    tagListEl.innerHTML = tagsHtml;
  }

  // Filter notes
  const filtered = S.knowledge.filter(k => {
    // Search query match
    const matchesSearch = searchQuery === '' || 
      k.topic.toLowerCase().includes(searchQuery) ||
      k.content.toLowerCase().includes(searchQuery) ||
      (k.tags && k.tags.some(t => t.toLowerCase().includes(searchQuery)));
      
    // Tag match
    const matchesTag = activeKnowledgeTag === '' || (k.tags && k.tags.includes(activeKnowledgeTag));
    
    // Category match
    const matchesCat = activeKnowledgeCategory === 'All' || k.category === activeKnowledgeCategory;
    
    return matchesSearch && matchesTag && matchesCat;
  });

  // Render notes list
  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="es" style="grid-column: 1/-1; padding: 40px 20px;">
        <div class="ei">💡</div>
        <p class="t2">No vault items found</p>
        <p class="tm txs mt1">Add a new item or adjust your search filters</p>
      </div>
    `;
  } else {
    listEl.innerHTML = filtered.map(k => {
      const tagsChips = k.tags ? k.tags.map(t => `<span class="k-card-tag">#${t}</span>`).join(' ') : '';
      const dateStr = fDisp(k.date);
      const area = S.lifeAreas.find(la => la.name === k.category && !la.archived);
      const dotColor = area ? area.color : '#8b5cf6';
      
      // Truncate preview
      const preview = k.content.length > 120 ? k.content.substring(0, 120) + '...' : k.content;
      
      return `
        <div class="card k-card" onclick="viewKnowledgeEntry('${k.id}')">
          <div class="k-card-header">
            <span class="badge" style="background: ${dotColor}15; color: ${dotColor}; font-size: 10px; padding: 2px 8px;">
              ${area ? area.icon : '💡'} ${k.category}
            </span>
            <span class="k-card-date">${dateStr}</span>
          </div>
          <h4 class="k-card-title">${k.topic}</h4>
          <p class="k-card-body">${preview}</p>
          <div class="k-card-footer">
            <div class="k-card-tags-list">${tagsChips}</div>
            <div class="k-card-actions" onclick="event.stopPropagation()">
              <button class="btn bg btn-ico btn-sm" onclick="openKnowledgeModal('${k.id}')" title="Edit">✏️</button>
              <button class="btn bd btn-ico btn-sm" onclick="deleteKnowledge('${k.id}')" title="Delete">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

function filterKnowledgeByTag(tag) {
  activeKnowledgeTag = tag;
  renderKnowledge();
}

function handleKnowledgeSearch() {
  renderKnowledge();
}

function handleKnowledgeCategoryFilter(val) {
  activeKnowledgeCategory = val;
  renderKnowledge();
}

function openKnowledgeModal(eid) {
  const modal = document.getElementById('m-knowledge');
  if (!modal) return;
  
  const k = eid ? S.knowledge.find(x => x.id === eid) : null;
  document.getElementById('k-eid').value = eid || '';
  document.getElementById('km-title').textContent = k ? '✏️ Edit Vault Item' : '💡 Add Vault Item';
  document.getElementById('k-topic').value = k ? k.topic : '';
  document.getElementById('k-content').value = k ? k.content : '';
  document.getElementById('k-tags').value = k ? k.tags.join(', ') : '';
  
  // Render category options dynamically
  const kCat = document.getElementById('k-cat');
  if (kCat) {
    const categories = getLifeAreaCategories();
    kCat.innerHTML = categories.map(c => `<option>${c}</option>`).join('');
    if (k) kCat.value = k.category;
  }
  
  modal.classList.remove('hid');
  document.getElementById('k-topic').focus();
}

function closeKnowledgeModal() {
  document.getElementById('m-knowledge').classList.add('hid');
}

function saveKnowledge() {
  const topic = document.getElementById('k-topic').value.trim();
  const content = document.getElementById('k-content').value.trim();
  if (!topic || !content) {
    toast('Topic and content are required', 'error');
    return;
  }
  
  const eid = document.getElementById('k-eid').value;
  const category = document.getElementById('k-cat').value;
  const tagsRaw = document.getElementById('k-tags').value;
  const tags = tagsRaw.split(',')
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 0);
    
  if (eid) {
    const i = S.knowledge.findIndex(k => k.id === eid);
    if (i >= 0) {
      S.knowledge[i].topic = topic;
      S.knowledge[i].content = content;
      S.knowledge[i].category = category;
      S.knowledge[i].tags = tags;
      toast('✅ Vault item updated!', 'success');
    }
  } else {
    S.knowledge.unshift({
      id: 'k_' + Date.now(),
      topic,
      content,
      category,
      tags,
      date: today()
    });
    toast('💡 Added to Knowledge Vault!', 'success');
  }
  
  save();
  closeKnowledgeModal();
  renderKnowledge();
}

function deleteKnowledge(id) {
  const k = S.knowledge.find(x => x.id === id);
  if (!k) return;
  
  document.getElementById('conf-icon').textContent = '💡';
  document.getElementById('conf-title').textContent = 'Delete Vault Item';
  document.getElementById('conf-msg').innerHTML = `Delete <strong>"${k.topic}"</strong>?`;
  document.getElementById('conf-ok').textContent = 'Delete';
  document.getElementById('conf-ok').onclick = () => {
    S.knowledge = S.knowledge.filter(x => x.id !== id);
    save();
    closeConf();
    renderKnowledge();
    toast('🗑️ Vault item deleted', 'info');
  };
  document.getElementById('m-confirm').classList.remove('hid');
}

function viewKnowledgeEntry(id) {
  const k = S.knowledge.find(x => x.id === id);
  if (!k) return;
  
  const area = S.lifeAreas.find(la => la.name === k.category);
  const icon = area ? area.icon : '💡';
  
  document.getElementById('conf-icon').textContent = icon;
  document.getElementById('conf-title').textContent = k.topic;
  document.getElementById('conf-msg').innerHTML = `
    <div style="text-align:left">
      <div style="margin-bottom:12px; display:flex; align-items:center; gap:8px">
        <span class="badge bg" style="font-size: 10px; padding: 2px 6px;">${k.category}</span>
        <span style="font-size: 11px; color: var(--t3)">📅 ${fFull(k.date)}</span>
      </div>
      <div style="color:var(--t2); line-height:1.7; font-size:13px; white-space:pre-wrap; background:rgba(255,255,255,0.02); padding:12px; border-radius:8px; border:1px solid var(--border-color); margin-bottom:12px;">${k.content}</div>
      <div class="k-card-tags-list">
        ${k.tags.map(t => `<span class="k-card-tag">#${t}</span>`).join(' ')}
      </div>
    </div>
  `;
  
  document.getElementById('conf-ok').textContent = 'Close';
  document.getElementById('conf-ok').onclick = closeConf;
  document.getElementById('m-confirm').classList.remove('hid');
}

// Expose functions globally
window.knowledgeEnsureData = knowledgeEnsureData;
window.renderKnowledge = renderKnowledge;
window.filterKnowledgeByTag = filterKnowledgeByTag;
window.handleKnowledgeSearch = handleKnowledgeSearch;
window.handleKnowledgeCategoryFilter = handleKnowledgeCategoryFilter;
window.openKnowledgeModal = openKnowledgeModal;
window.closeKnowledgeModal = closeKnowledgeModal;
window.saveKnowledge = saveKnowledge;
window.deleteKnowledge = deleteKnowledge;
window.viewKnowledgeEntry = viewKnowledgeEntry;
