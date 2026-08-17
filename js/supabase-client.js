/**
 * supabase-client.js — Supabase initialization & connection management
 *
 * IMPORTANT: Set these environment variables in Vercel project settings:
 *   VITE_SUPABASE_URL  or  SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY  or  SUPABASE_ANON_KEY
 *
 * For a plain HTML/JS site on Vercel without a build step, use a
 * window.__ENV__ object injected by a serverless function, OR
 * hard-code the PUBLIC anon key here (it's safe to commit anon key).
 *
 * !! NEVER put service_role key here !!
 */

// ── Config ────────────────────────────────────────────────────────
// These are injected by vercel.json "headers" or window.__ENV__ at runtime.
// For static sites, these are safe to expose (protected by RLS).
const SUPABASE_URL      = window.__ENV__?.SUPABASE_URL      || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = window.__ENV__?.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// ── Initialize Supabase client ────────────────────────────────────
const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'momentum_auth_session',
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

// ── Connection Status ─────────────────────────────────────────────
window.MomentumOnline = navigator.onLine;
let _syncQueue = [];
let _syncRetryTimer = null;

function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem('momentum_offline_queue') || '[]');
  } catch { return []; }
}

function saveOfflineQueue(q) {
  localStorage.setItem('momentum_offline_queue', JSON.stringify(q));
}

function enqueueOfflineChange(operation) {
  const q = getOfflineQueue();
  q.push({ ...operation, timestamp: Date.now() });
  saveOfflineQueue(q);
}

async function flushOfflineQueue() {
  const q = getOfflineQueue();
  if (!q.length) return;

  const failed = [];
  for (const op of q) {
    try {
      if (op.type === 'upsert') {
        const { error } = await _supabase.from(op.table).upsert(op.data, { onConflict: op.conflict });
        if (error) throw error;
      } else if (op.type === 'delete') {
        const { error } = await _supabase.from(op.table).delete().eq('id', op.id).eq('user_id', op.userId);
        if (error) throw error;
      }
    } catch (e) {
      console.warn('[Momentum] Offline queue flush failed for op:', op, e);
      failed.push(op);
    }
  }

  saveOfflineQueue(failed);
  if (failed.length === 0 && q.length > 0) {
    showSyncStatus('synced');
    console.log('[Momentum] Offline queue flushed successfully.');
  }
}

function showSyncStatus(state) {
  const bar = document.getElementById('connection-status-bar');
  if (!bar) return;

  if (state === 'offline') {
    bar.textContent = '📡 Offline — changes will sync when you\'re back online.';
    bar.className = 'sync-bar sync-offline';
    bar.style.display = 'block';
  } else if (state === 'syncing') {
    bar.textContent = '🔄 Syncing changes...';
    bar.className = 'sync-bar sync-syncing';
    bar.style.display = 'block';
  } else if (state === 'synced') {
    bar.textContent = '✅ Synced successfully.';
    bar.className = 'sync-bar sync-success';
    bar.style.display = 'block';
    setTimeout(() => { bar.style.display = 'none'; }, 3000);
  } else {
    bar.style.display = 'none';
  }
}

// ── Online / Offline event listeners ─────────────────────────────
window.addEventListener('online', async () => {
  window.MomentumOnline = true;
  showSyncStatus('syncing');
  await flushOfflineQueue();
});

window.addEventListener('offline', () => {
  window.MomentumOnline = false;
  showSyncStatus('offline');
});

// Check on init
if (!navigator.onLine) showSyncStatus('offline');

// ── Safe DB operation wrapper ─────────────────────────────────────
/**
 * Wraps a Supabase operation with offline fallback.
 * If offline, enqueues the operation for later.
 */
async function safeUpsert(table, data, conflict = 'id') {
  if (!window.MomentumOnline) {
    enqueueOfflineChange({ type: 'upsert', table, data, conflict });
    return { data: null, error: null, offline: true };
  }
  try {
    const result = await _supabase.from(table).upsert(data, {
      onConflict: conflict,
      ignoreDuplicates: false,
    });
    if (result.error) throw result.error;
    return result;
  } catch (err) {
    console.warn(`[Momentum] safeUpsert failed for ${table}:`, err);
    if (err.message?.includes('network') || err.code === 'PGRST') {
      enqueueOfflineChange({ type: 'upsert', table, data, conflict });
    }
    return { data: null, error: err };
  }
}

async function safeDelete(table, id, userId) {
  if (!window.MomentumOnline) {
    enqueueOfflineChange({ type: 'delete', table, id, userId });
    return { error: null, offline: true };
  }
  try {
    const result = await _supabase.from(table).delete().eq('id', id).eq('user_id', userId);
    if (result.error) throw result.error;
    return result;
  } catch (err) {
    if (err.message?.includes('network')) {
      enqueueOfflineChange({ type: 'delete', table, id, userId });
    }
    return { error: err };
  }
}

// Expose globally
window._supabase   = _supabase;
window.safeUpsert  = safeUpsert;
window.safeDelete  = safeDelete;
window.showSyncStatus     = showSyncStatus;
window.flushOfflineQueue  = flushOfflineQueue;
window.enqueueOfflineChange = enqueueOfflineChange;
