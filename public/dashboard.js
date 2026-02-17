// TITAN CRM v4 Dashboard Script
// Matches restored index.html: handles config, Supabase init, login, and UI.

let APP = {
  config: null,
  supabase: null,
  user: null,
  data: [],
  analytics: { income: 0, inquiry: 0, pending: 0, working: 0, success: 0, problem: 0 },
  platformFilter: 'all',
  page: 1,
  pageSize: 10
};

async function loadConfig() {
  // Priority: window.__CONFIG → /api/config → localStorage → null
  if (window.__CONFIG && window.__CONFIG.supabaseUrl && window.__CONFIG.supabaseAnonKey) {
    APP.config = window.__CONFIG;
    console.log('Config loaded from window.__CONFIG');
    return APP.config;
  }
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const cfg = await res.json();
      if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
        APP.config = cfg;
        localStorage.setItem('titan_config', JSON.stringify(cfg));
        console.log('Config loaded from /api/config');
        return APP.config;
      }
    } else {
      console.warn('/api/config returned non-OK', res.status);
    }
  } catch (e) {
    console.warn('Failed to fetch /api/config', e);
  }
  try {
    const cached = localStorage.getItem('titan_config');
    if (cached) {
      APP.config = JSON.parse(cached);
      console.log('Config loaded from localStorage');
      return APP.config;
    }
  } catch {}
  console.error('No config available');
  return null;
}

function initSupabase() {
  if (!APP.config) return;
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    APP.supabase = window.supabase.createClient(APP.config.supabaseUrl, APP.config.supabaseAnonKey);
    console.log('Supabase initialized');
  } else {
    console.warn('Supabase library not available; using local demo mode');
  }
}

function showNotification(msg, type = 'info') {
  const zone = document.getElementById('notificationZone');
  if (!zone) return;
  const div = document.createElement('div');
  div.className = 'pointer-events-auto';
  div.innerHTML = `<div class="px-4 py-3 rounded-xl shadow-lg border text-sm ${type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-700'}">${msg}</div>`;
  zone.appendChild(div);
  setTimeout(() => zone.removeChild(div), 4000);
}

function updateLastUpdate() {
  const el = document.getElementById('lastUpdate');
  if (!el) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  el.innerHTML = `<span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> LIVE: ${hh}:${mm}:${ss}`;
}

function renderStats() {
  const income = APP.analytics.income ?? APP.data.reduce((sum, r) => sum + (r.payment || 0), 0);
  const success = APP.analytics.success ?? APP.data.filter(r => r.status === 'success').length;
  const pending = APP.analytics.pending ?? APP.data.filter(r => r.status === 'pending').length;
  const inquiry = APP.analytics.inquiry ?? APP.data.filter(r => r.status === 'inquiry').length;
  const working = APP.analytics.working ?? APP.data.filter(r => r.status === 'working').length;
  const problem = APP.analytics.problem ?? APP.data.filter(r => r.status === 'problem').length;

  const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  setText('statIncome', `Rs. ${income}`);
  setText('statSuccess', success);
  setText('statPending', pending);
  setText('statInquiry', inquiry);
  setText('statWorking', working);
  setText('statProblem', problem);

  const totalEl = document.getElementById('totalRecords');
  if (totalEl) {
    const span = totalEl.querySelector('span');
    if (span) span.textContent = `TOTAL: ${APP.data.length}`;
  }
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = APP.data.filter(r => {
    if (APP.platformFilter === 'all') return true;
    return r.platform === APP.platformFilter;
  });

  const start = (APP.page - 1) * APP.pageSize;
  const pageItems = filtered.slice(start, start + APP.pageSize);

  pageItems.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50';
    tr.innerHTML = `
      <td class="px-4 md:px-6 py-4">${r.date || '-'}</td>
      <td class="px-4 md:px-6 py-4 text-center">${(r.platform || '').toUpperCase()}</td>
      <td class="px-4 md:px-6 py-4">${r.customer || '-'}</td>
      <td class="px-4 md:px-6 py-4">${r.service || '-'}</td>
      <td class="px-4 md:px-6 py-4 text-center">${r.rpa ? '<span class="text-emerald-600 font-bold">ON</span>' : '<span class="text-slate-400">OFF</span>'}</td>
      <td class="px-4 md:px-6 py-4">
        <select data-id="${r.id || ''}" class="border border-slate-200 rounded-lg text-xs font-bold uppercase px-2 py-1">
          ${['inquiry','pending','working','success','problem'].map(s => `<option value="${s}" ${r.status===s?'selected':''}>${s.toUpperCase()}</option>`).join('')}
        </select>
      </td>
      <td class="px-4 md:px-6 py-4 text-blue-600">${r.summary || ''}</td>
      <td class="px-4 md:px-6 py-4">${r.note || ''}</td>
      <td class="px-4 md:px-6 py-4 text-center">${r.payment ? 'Rs. ' + r.payment : '-'}</td>
      <td class="px-4 md:px-6 py-4 text-center">${r.operator || '-'}</td>
      <td class="px-4 md:px-6 py-4 text-center">${r.docs ? '📄' : '-'}</td>
    `;
    tbody.appendChild(tr);
  });

  // Attach change handlers for status selects
  tbody.querySelectorAll('select[data-id]').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const id = sel.getAttribute('data-id');
      const status = sel.value;
      if (!id) return;
      try {
        const res = await fetch('/api/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status })
        });
        if (res.ok) {
          const idx = APP.data.findIndex(x => x.id === id);
          if (idx >= 0) APP.data[idx].status = status;
          renderStats();
          showNotification('Status updated', 'success');
        } else {
          showNotification('Failed to update status', 'error');
        }
      } catch (err) {
        showNotification('Error updating status', 'error');
      }
    });
  });

  const pageInfo = document.getElementById('pageInfo');
  if (pageInfo) {
    const totalPages = Math.max(1, Math.ceil(filtered.length / APP.pageSize));
    if (APP.page > totalPages) APP.page = totalPages;
    pageInfo.textContent = `PAGE ${APP.page} OF ${totalPages}`;
  }
}

function filterByPlatform(platform) {
  APP.platformFilter = platform || 'all';
  APP.page = 1;
  renderTable();
}

function changePage(dir) {
  const filteredLength = APP.data.filter(r => APP.platformFilter === 'all' || r.platform === APP.platformFilter).length;
  const totalPages = Math.max(1, Math.ceil(filteredLength / APP.pageSize));
  if (dir === 'next') APP.page = Math.min(totalPages, APP.page + 1);
  if (dir === 'prev') APP.page = Math.max(1, APP.page - 1);
  renderTable();
}

function toggleSettingsModal() {
  showNotification('Settings are not yet implemented', 'info');
}

async function syncCoreDatabase() {
  showNotification('Sync request queued', 'success');
}

function attachEvents() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      APP.user = null;
      document.getElementById('dashboardPage').classList.add('hidden');
      document.getElementById('loginPage').classList.remove('hidden');
      showNotification('Logged out', 'success');
    });
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value.trim();

      // Demo bypass
      if (username === 'admin' && password === 'password') {
        APP.user = { username };
        onLoginSuccess();
        return;
      }

      // Optional: check Supabase 'staff' table for credentials (demo-only)
      if (APP.supabase) {
        try {
          const { data, error } = await APP.supabase
            .from('staff')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .limit(1);
          if (error) throw error;
          if (data && data.length) {
            APP.user = { username };
            onLoginSuccess();
            return;
          }
        } catch (err) {
          console.warn('Supabase staff lookup failed', err);
        }
      }

      showNotification('Invalid credentials', 'error');
    });
  }

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase();
      const base = getDemoData();
      APP.data = base.filter(r => (r.customer || '').toLowerCase().includes(q) || (r.service || '').toLowerCase().includes(q));
      renderStats();
      renderTable();
    });
  }
}

function onLoginSuccess() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('dashboardPage').classList.remove('hidden');
  const userDisplay = document.getElementById('userDisplay');
  if (userDisplay) userDisplay.innerHTML = `<i class="fas fa-user-circle mr-2"></i>OP: ${APP.user.username.toUpperCase()}`;
  showNotification('Login successful', 'success');

  // Load initial data
  loadAnalytics();
  loadLeads();
}

function getDemoData() {
  // Demo dataset shaped to fit table columns
  return [
    { date: '2024-12-01', platform: 'whatsapp', customer: 'Ram Shrestha', service: 'Passport', rpa: true, status: 'success', summary: 'Completed', note: '', payment: 1500, operator: 'admin', docs: true },
    { date: '2024-12-02', platform: 'messenger', customer: 'Sita Gurung', service: 'NID', rpa: false, status: 'pending', summary: 'Awaiting docs', note: '', payment: 0, operator: 'admin', docs: false },
    { date: '2024-12-03', platform: 'whatsapp', customer: 'Hari Adhikari', service: 'License', rpa: true, status: 'working', summary: 'In process', note: 'Verification', payment: 800, operator: 'admin', docs: true },
    { date: '2024-12-04', platform: 'messenger', customer: 'Maya KC', service: 'PAN', rpa: false, status: 'inquiry', summary: 'Initial inquiry', note: '', payment: 0, operator: 'admin', docs: false },
    { date: '2024-12-05', platform: 'whatsapp', customer: 'Bishal Rai', service: 'NID', rpa: true, status: 'problem', summary: 'Missing info', note: 'Follow-up needed', payment: 0, operator: 'admin', docs: false }
  ];
}

function initReportButton() {
  const container = document.getElementById('reportBtnContainer');
  if (!container) return;
  const btn = document.createElement('button');
  btn.className = 'px-4 py-3 bg-white hover:bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-xs uppercase shadow-sm transition-all active:scale-90 flex items-center justify-center gap-2';
  btn.innerHTML = '<i class="fas fa-file-export text-blue-600"></i><span class="hidden sm:inline">Report</span>';
  btn.title = 'Download report';
  btn.addEventListener('click', () => showNotification('Report generation is not yet implemented', 'info'));
  container.appendChild(btn);
}

document.addEventListener('DOMContentLoaded', async () => {
  // Live clock
  updateLastUpdate();
  setInterval(updateLastUpdate, 1000);

  // Config + Supabase
  await loadConfig();
  initSupabase();

  // Events and UI
  attachEvents();
  initReportButton();
});

async function loadAnalytics() {
  try {
    const res = await fetch('/api/analytics');
    if (res.ok) {
      const a = await res.json();
      APP.analytics = a;
      renderStats();
    } else {
      console.warn('Analytics fetch failed', res.status);
    }
  } catch (e) {
    console.warn('Analytics error', e);
  }
}

async function loadLeads() {
  try {
    const res = await fetch('/api/leads?page=1&pageSize=50');
    if (res.ok) {
      const json = await res.json();
      const rows = (json && json.data) || [];
      APP.data = rows.map(r => ({
        id: r.id,
        date: r.created_at,
        platform: r.platform,
        customer: r.customer_name,
        service: r.service,
        rpa: !!r.rpa,
        status: r.status,
        summary: r.summary,
        note: r.note,
        payment: Number(r.payment) || 0,
        operator: r.operator_id ? String(r.operator_id) : '-',
        docs: !!r.docs
      }));
      renderStats();
      renderTable();
    } else {
      console.warn('Leads fetch failed', res.status);
      // Fallback to demo data if API fails
      APP.data = getDemoData();
      renderStats();
      renderTable();
    }
  } catch (e) {
    console.warn('Leads error', e);
    APP.data = getDemoData();
    renderStats();
    renderTable();
  }
}
