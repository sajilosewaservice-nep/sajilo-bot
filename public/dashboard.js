/**
 * ═════════════════════════════════════════════════════════════════════════════
 * TITAN ENTERPRISE CRM v4.0.0 - Dashboard Module
 * Main Application Logic for Customer Management & RPA Automation
 * Handles: Authentication, Data Sync, UI Updates, RPA Control
 * ═════════════════════════════════════════════════════════════════════════════
 */

// 1. GLOBAL STATE
const STATE = {
  currentUser: null,
  allData: [],
  filteredData: [],
  currentPage: 1,
  selectedPlatform: 'all',
  automation: { activeProcesses: {}, pausedProcesses: {} }
};

// 2. SYSTEM CONFIG
const SYSTEM_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_KEY: "",
  RPA_SERVER_URL: "",
  PAGE_SIZE: 15,

  SERVICES: {
    PCC: { name: "Police Clearance", icon: "🚔" },
    NID: { name: "National Identity", icon: "🆔" },
    LICENSE: { name: "Driving License", icon: "🚗" },
    PASSPORT: { name: "Passport", icon: "✈️" },
    PAN: { name: "Tax ID (PAN)", icon: "📋" }
  },

  STATUS_COLORS: {
    inquiry: '#64748b',
    pending: '#f59e0b',
    working: '#3b82f6',
    success: '#10b981',
    problem: '#ef4444',
    paused: '#8b5cf6'
  },

  PLATFORMS: ['all', 'whatsapp', 'messenger'],

  REALTIME_INTERVAL: 3000,
  SYNC_INTERVAL: 30000
};

// 3. SUPABASE CLIENT
let supabaseClient = null;
async function initializeSupabase() {
  try {
    if (typeof supabase === 'undefined') {
      console.error("❌ Supabase library not loaded");
      notify("Supabase configuration error", "error");
      return false;
    }
    supabaseClient = supabase.createClient(
      SYSTEM_CONFIG.SUPABASE_URL,
      SYSTEM_CONFIG.SUPABASE_KEY
    );
    console.log("✅ Supabase initialized successfully");
    return true;
  } catch (error) {
    console.error("❌ Supabase initialization error:", error);
    return false;
  }
}

// 4. INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
  const configLoaded = await loadConfigFromBackend();
  if (!configLoaded) {
    notify("Failed to load configuration", "error");
    return;
  }

  try {
    console.log("🚀 Dashboard initialization started...");
    const supabaseReady = await initializeSupabase();
    if (!supabaseReady) throw new Error("Supabase initialization failed");

    await syncCoreDatabase();
    buildTableRows();
    validateSession();
    registerGlobalEvents();
    startRealtimeBridge();
    initializeLiveClock();
    setInterval(() => syncCoreDatabase(), SYSTEM_CONFIG.SYNC_INTERVAL);

    console.log("✅ Dashboard initialization completed");
  } catch (error) {
    console.error("❌ Dashboard initialization error:", error);
    notify("Failed to load dashboard", "error");
  }
});

// Config loader
async function loadConfigFromBackend() {
  try {
    const response = await fetch('/api/config', { method: 'GET' });
    if (response.ok) {
      const cfg = await response.json();
      if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
        SYSTEM_CONFIG.SUPABASE_URL = cfg.supabaseUrl;
        SYSTEM_CONFIG.SUPABASE_KEY = cfg.supabaseAnonKey;
        if (cfg.rpaServerUrl) SYSTEM_CONFIG.RPA_SERVER_URL = cfg.rpaServerUrl;
        console.log('✅ Configuration loaded from backend');
        return true;
      }
      console.error('❌ Config missing keys:', cfg);
    } else {
      console.error('❌ Config fetch failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Configuration load error:', error);
  }

  // Fallbacks
  const winCfg = window.__CONFIG || {};
  const lsUrl = localStorage.getItem('supabaseUrl');
  const lsKey = localStorage.getItem('supabaseAnonKey');
  const lsRpaUrl = localStorage.getItem('rpa_url');

  const supabaseUrl = winCfg.supabaseUrl || lsUrl;
  const supabaseAnonKey = winCfg.supabaseAnonKey || lsKey;
  const rpaServerUrl = winCfg.rpaServerUrl || lsRpaUrl;

  if (supabaseUrl && supabaseAnonKey) {
    SYSTEM_CONFIG.SUPABASE_URL = supabaseUrl;
    SYSTEM_CONFIG.SUPABASE_KEY = supabaseAnonKey;
    if (rpaServerUrl) SYSTEM_CONFIG.RPA_SERVER_URL = rpaServerUrl;
    console.warn('⚠️ Using fallback configuration');
    return true;
  }
  notify('Failed to load configuration', 'error');
  return false;
}

// 5. AUTH & SESSION
function validateSession() {
  try {
    const sessionToken = sessionStorage.getItem('titan_user');
    if (sessionToken) {
      STATE.currentUser = JSON.parse(sessionToken);
      loadDashboardInterface();
      console.log(`✅ User session validated: ${STATE.currentUser.full_name}`);
    } else {
      showLoginPage();
    }
  } catch (error) {
    console.error("❌ Session validation error:", error);
    showLoginPage();
  }
}

function showLoginPage() {
  const loginPage = document.getElementById('loginPage');
  const dashboardPage = document.getElementById('dashboardPage');
  if (loginPage) loginPage.classList.remove('hidden');
  if (dashboardPage) dashboardPage.classList.add('hidden');
}

async function handleLogin(username, password) {
  try {
    if (!supabaseClient) {
      notify("Database connection failed", "error");
      return false;
    }
    const { data, error } = await supabaseClient
      .from('staff')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .maybeSingle();

    if (error) {
      console.error("❌ Login query error:", error);
      notify("Database error occurred", "error");
      return false;
    }

    if (data) {
      STATE.currentUser = data;
      sessionStorage.setItem('titan_user', JSON.stringify(data));
      notify(`Welcome, ${data.full_name}!`, "success");
      loadDashboardInterface();
      return true;
    } else {
      notify("Invalid username or password", "error");
      return false;
    }
  } catch (error) {
    console.error("❌ Login error:", error);
    notify("Login failed", "error");
    return false;
  }
}

function handleLogout() {
  try {
    sessionStorage.clear();
    STATE.currentUser = null;
    STATE.allData = [];
    STATE.filteredData = [];
    notify("Logged out successfully", "success");
    showLoginPage();
    location.reload();
  } catch (error) {
    console.error("❌ Logout error:", error);
  }
}

// 6. DASHBOARD UI
async function loadDashboardInterface() {
  try {
    const loginPage = document.getElementById('loginPage');
    const dashboardPage = document.getElementById('dashboardPage');
    if (loginPage) loginPage.classList.add('hidden');
    if (dashboardPage) dashboardPage.classList.remove('hidden');

    updateUserDisplay();
    addAnalyticsButton();
    await syncCoreDatabase();

    console.log("✅ Dashboard interface loaded");
  } catch (error) {
    console.error("❌ Dashboard interface error:", error);
  }
}

function updateUserDisplay() {
  const userDisplay = document.getElementById('userDisplay');
  const logoutBtn = document.getElementById('logoutBtn');
  if (userDisplay && STATE.currentUser) {
    userDisplay.classList.remove('hidden');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    userDisplay.innerHTML = `
      <i class="fas fa-user-circle mr-2"></i>
      <span>${STATE.currentUser.full_name}</span>
    `;
  }
}

function addAnalyticsButton() {
  const btnContainer = document.getElementById('reportBtnContainer');
  if (btnContainer) {
    btnContainer.innerHTML = `
      <button onclick="showFinancialReport()"
        class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-black text-xs uppercase shadow-lg transition-all active:scale-95">
        <i class="fas fa-chart-bar mr-2"></i> Analytics Report
      </button>
    `;
  }
}

// 7. DATABASE OPS
async function syncCoreDatabase() {
  try {
    if (!supabaseClient) {
      console.warn("⚠️ Supabase client not ready");
      return;
    }
    const { data, error } = await supabaseClient
      .from('customers')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error("❌ Database sync error:", error);
      return;
    }
    STATE.allData = data || [];
    applyLogicFilters(false);
    refreshFinancialAnalytics();
    console.log(`✅ Synced ${STATE.allData.length} customer records`);
  } catch (error) {
    console.error("❌ Database sync error:", error);
  }
}

async function commitUpdate(customerId, updates, message = null) {
  try {
    if (!supabaseClient) {
      notify("Database connection failed", "error");
      return false;
    }
    const payload = {
      ...updates,
      last_updated_by: STATE.currentUser?.full_name || 'System',
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabaseClient
      .from('customers')
      .update(payload)
      .eq('id', customerId)
      .select();

    if (error) {
      console.error("❌ Update error:", error);
      notify(`Error: ${error.message}`, "error");
      return false;
    }
    if (data && data.length > 0) {
      const index = STATE.allData.findIndex(d => d.id === customerId);
      if (index !== -1) {
        STATE.allData[index] = { ...STATE.allData[index], ...data[0] };
        applyLogicFilters(false);
        refreshFinancialAnalytics();
      }
      if (message) notify(message, "success");
      console.log(`✅ Updated customer: ${customerId}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error("❌ Commit update error:", error);
    notify("Update failed", "error");
    return false;
  }
}

// 8. ANALYTICS
function refreshFinancialAnalytics() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const stats = STATE.allData.reduce((acc, curr) => {
      const status = (curr.status || '').toLowerCase().trim();
      acc.counts[status] = (acc.counts[status] || 0) + 1;

      if (status === 'success') {
        const incomeParts = String(curr.income || "0/0").split('/');
        const incomeAmount = parseFloat(incomeParts[0]?.replace(/[^0-9.]/g, '')) || 0;
        const pendingAmount = incomeParts[1] ? parseFloat(incomeParts[1].replace(/[^0-9.]/g, '')) || 0 : 0;
        acc.revenue += incomeAmount;
        acc.totalPending += pendingAmount;
        const entryDate = curr.updated_at ? curr.updated_at.split('T')[0] : '';
        if (entryDate === today) acc.dailyIncome += incomeAmount;
      }
      return acc;
    }, { counts: {}, revenue: 0, totalPending: 0, dailyIncome: 0 });

    updateStatElement('statIncome', `Rs. ${stats.revenue.toLocaleString()}`);
    updateStatElement('statSuccess', stats.counts['success'] || 0);
    updateStatElement('statPending', stats.counts['pending'] || 0);
    updateStatElement('statInquiry', stats.counts['inquiry'] || 0);
    updateStatElement('statWorking', stats.counts['working'] || 0);
    updateStatElement('statProblem', stats.counts['problem'] || 0);
    updateStatElement('totalRecords', `TOTAL: ${STATE.allData.length}`);

    console.log("✅ Financial analytics updated");
  } catch (error) {
    console.error("❌ Analytics error:", error);
  }
}

function updateStatElement(elementId, value) {
  const element = document.getElementById(elementId);
  if (element) element.textContent = value;
}

function getStatusColor(status) {
  const normalizedStatus = (status || '').toLowerCase().trim();
  return SYSTEM_CONFIG.STATUS_COLORS[normalizedStatus] || '#cbd5e1';
}

// 9. FILTERING
function applyLogicFilters(resetPage = true) {
  try {
    const searchInput = document.getElementById('searchInput');
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
    let filtered = [...STATE.allData];

    if (searchQuery) {
      filtered = filtered.filter(customer => {
        const name = (customer.customer_name || '').toLowerCase();
        const phone = (customer.phone_number || '').toLowerCase();
        const email = (customer.email || '').toLowerCase();
        return name.includes(searchQuery) || phone.includes(searchQuery) || email.includes(searchQuery);
      });
    }
    if (STATE.selectedPlatform && STATE.selectedPlatform !== 'all') {
      filtered = filtered.filter(customer =>
        (customer.platform || '').toLowerCase() === STATE.selectedPlatform.toLowerCase()
      );
    }
    STATE.filteredData = filtered;
    if (resetPage) STATE.currentPage = 1;
    buildTableRows();
    updatePaginationUI();
    updateTotalRecords();
    console.log(`✅ Applied filters: ${filtered.length} records`);
  } catch (error) {
    console.error("❌ Filter error:", error);
  }
}

function filterByPlatform(platform) {
  try {
    STATE.selectedPlatform = platform;
    applyLogicFilters(true);
    console.log(`✅ Platform filter: ${platform}`);
  } catch (error) {
    console.error("❌ Platform filter error:", error);
  }
}

// 10. PAGINATION
function updatePaginationUI() {
  try {
    const pageInfo = document.getElementById('pageInfo');
    const totalItems = STATE.filteredData.length;
    const maxPage = Math.ceil(totalItems / SYSTEM_CONFIG.PAGE_SIZE) || 1;
    if (pageInfo) {
      pageInfo.innerHTML = `PAGE <span class="text-blue-400">${STATE.currentPage}</span> OF <span class="text-blue-400">${maxPage}</span>`;
    }
  } catch (error) {
    console.error("❌ Pagination UI error:", error);
  }
}

function updateTotalRecords() {
  try {
    const totalRecords = document.getElementById('totalRecords');
    if (totalRecords) {
      totalRecords.innerHTML = `<i class="fas fa-database mr-2"></i>TOTAL: ${STATE.filteredData.length}`;
    }
  } catch (error) {
    console.error("❌ Total records error:", error);
  }
}

function changePage(direction) {
  try {
    const totalItems = STATE.filteredData.length;
    const maxPage = Math.ceil(totalItems / SYSTEM_CONFIG.PAGE_SIZE) || 1;
    if (direction === 'next' && STATE.currentPage < maxPage) {
      STATE.currentPage++;
    } else if (direction === 'prev' && STATE.currentPage > 1) {
      STATE.currentPage--;
    } else {
      return;
    }
    buildTableRows();
    updatePaginationUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    console.error("❌ Page change error:", error);
  }
}

// 11. RPA CONTROL
async function launchAIAutoFill(customerId, serviceType) {
  try {
    if (!serviceType || serviceType === 'Other') {
      notify("Please select a valid service", "error");
      return;
    }
    const customer = STATE.allData.find(c => c.id === customerId);
    if (!customer) {
      notify("Customer not found", "error");
      return;
    }
    const masterRules = localStorage.getItem('ai_rules_master') || '';
    const serviceRules = localStorage.getItem(`ai_rules_${serviceType.toLowerCase()}`) || '';
    const finalRules = `${masterRules}\n${serviceRules}`;

    notify("Starting RPA automation...", "success");
    try {
      const response = await fetch(`${SYSTEM_CONFIG.RPA_SERVER_URL}/start-automation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          customer_data: customer,
          service_type: serviceType,
          ai_instructions: finalRules,
          operator: STATE.currentUser?.full_name || 'Unknown'
        })
      });
      if (response.ok) {
        const result = await response.json();
        STATE.automation.activeProcesses[customerId] = serviceType;
        notify(`RPA started for ${serviceType}`, "success");
        console.log("✅ Automation started:", result);
      } else {
        notify("RPA server error", "error");
      }
    } catch (error) {
      notify("RPA server offline", "error");
      console.error("❌ RPA error:", error);
    }
  } catch (error) {
    console.error("❌ Launch automation error:", error);
    notify("Failed to start automation", "error");
  }
}

async function pauseAutomation(customerId) {
  try {
    const response = await fetch(
      `${SYSTEM_CONFIG.RPA_SERVER_URL}/automation/pause/${customerId}`,
      { method: 'POST' }
    );
    if (response.ok) {
      STATE.automation.pausedProcesses[customerId] = true;
      notify("Automation paused", "success");
    }
  } catch (error) {
    console.error("❌ Pause error:", error);
  }
}

async function resumeAutomation(customerId) {
  try {
    const response = await fetch(
      `${SYSTEM_CONFIG.RPA_SERVER_URL}/automation/resume/${customerId}`,
      { method: 'POST' }
    );
    if (response.ok) {
      delete STATE.automation.pausedProcesses[customerId];
      notify("Automation resumed", "success");
    }
  } catch (error) {
    console.error("❌ Resume error:", error);
  }
}

// 12. CHAT
function handleChatClick(phone, platform, senderId) {
  try {
    if (!phone && !senderId) {
      notify("Contact information not available", "error");
      return;
    }
    const cleanPhone = (phone || senderId).replace(/\D/g, '');
    if (platform === 'whatsapp' && cleanPhone) {
      window.open(`https://wa.me/${cleanPhone}`, '_blank');
    } else if (platform === 'messenger') {
      const targetId = senderId || '';
      if (targetId && targetId !== 'undefined') {
        window.open(`https://www.messenger.com/t/${targetId}`, '_blank');
      } else {
        window.open(`https://www.messenger.com`, '_blank');
      }
    } else {
      notify("Invalid platform", "error");
    }
    console.log(`✅ Opened chat: ${platform}`);
  } catch (error) {
    console.error("❌ Chat error:", error);
  }
}

// 13. UTILS
function initializeLiveClock() {
  setInterval(() => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
    const lastUpdate = document.getElementById('lastUpdate');
    if (lastUpdate) {
      lastUpdate.innerHTML = `<span class="text-green-500 font-bold animate-pulse">●</span> LIVE: <span class="font-bold">${timeStr}</span>`;
    }
  }, 1000);
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return 'N/A';
  }
}

function getPlatformIcon(platform) {
  const icons = {
    whatsapp: '<i class="fas fa-whatsapp text-emerald-500"></i>',
    messenger: '<i class="fas fa-facebook-messenger text-blue-500"></i>'
  };
  return icons[platform?.toLowerCase()] || '<i class="fas fa-question-circle text-slate-400"></i>';
}

function notify(message, type = 'info') {
  try {
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
    notification.className = `
      fixed top-6 right-6 px-6 py-4 rounded-xl text-white font-bold
      shadow-2xl z-[10000] animate-bounce
      ${bgColor}
    `;
    notification.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} mr-2"></i>
      ${message}
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  } catch (error) {
    console.error("❌ Notification error:", error);
  }
}

// 14. SETTINGS
function saveSettings() {
  try {
    const rpaUrl = document.getElementById('set_rpa_url')?.value || SYSTEM_CONFIG.RPA_SERVER_URL;
    localStorage.setItem('rpa_url', rpaUrl);
    localStorage.setItem('ai_rules_master', document.getElementById('set_rules_master')?.value || '');
    localStorage.setItem('ai_rules_nid', document.getElementById('set_rules_nid')?.value || '');
    localStorage.setItem('ai_rules_pcc', document.getElementById('set_rules_pcc')?.value || '');
    localStorage.setItem('ai_rules_passport', document.getElementById('set_rules_passport')?.value || '');
    localStorage.setItem('ai_rules_license', document.getElementById('set_rules_license')?.value || '');
    localStorage.setItem('ai_rules_pan', document.getElementById('set_rules_pan')?.value || '');
    SYSTEM_CONFIG.RPA_SERVER_URL = rpaUrl;

    notify("Settings saved successfully", "success");
    document.getElementById('settingsModal')?.remove();
    setTimeout(() => location.reload(), 1000);
  } catch (error) {
    console.error("❌ Settings save error:", error);
    notify("Failed to save settings", "error");
  }
}

// 15. REALTIME
function startRealtimeBridge() {
  try {
    if (!supabaseClient) {
      console.warn("⚠️ Supabase not ready for realtime");
      return;
    }
    supabaseClient
      .channel('public:customers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, handleDatabaseChange)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("✅ Realtime subscription active");
        } else if (status === 'CHANNEL_ERROR') {
          console.error("❌ Realtime subscription error");
        }
      });
  } catch (error) {
    console.error("❌ Realtime bridge error:", error);
  }
}

function handleDatabaseChange(payload) {
  try {
    if (payload.eventType === 'UPDATE') {
      const index = STATE.allData.findIndex(d => d.id === payload.new.id);
      if (index !== -1) {
        STATE.allData[index] = { ...STATE.allData[index], ...payload.new };
        applyLogicFilters(false);
        refreshFinancialAnalytics();
      }
    } else if (payload.eventType === 'INSERT') {
      playNotificationSound();
      notify("New customer added", "success");
      syncCoreDatabase();
    } else if (payload.eventType === 'DELETE') {
      STATE.allData = STATE.allData.filter(d => d.id !== payload.old.id);
      applyLogicFilters(false);
      refreshFinancialAnalytics();
    }
  } catch (error) {
    console.error("❌ Database change handler error:", error);
  }
}

function playNotificationSound() {
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==');
    audio.play().catch(e => console.log("Sound play failed:", e));
  } catch (error) {
    console.log("Notification sound error:", error);
  }
}

// 16. EVENTS
function registerGlobalEvents() {
  try {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username')?.value.trim() || '';
        const password = document.getElementById('password')?.value.trim() || '';
        if (!username || !password) {
          notify("Please enter username and password", "error");
          return;
        }
        await handleLogin(username, password);
      });
    }
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', () => applyLogicFilters(true));
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    console.log("✅ Global events registered");
  } catch (error) {
    console.error("❌ Event registration error:", error);
  }
}

// 17. DOCS VIEW
function viewDocuments(customerId) {
  try {
    const customer = STATE.allData.find(c => c.id === customerId);
    if (!customer) return notify("Customer not found", "error");
    notify(`Documents for ${customer.customer_name}`, "info");
    console.log("Documents:", customer.documents);
  } catch (error) {
    console.error("❌ Document view error:", error);
  }
}

// GLOBAL HELPERS
function renderFileIcons(docs, id) {
  let docsArray = [];
  if (!docs || docs === '[]' || docs === '') {
    return '<span class="text-slate-300 italic text-[9px]">No Docs</span>';
  }
  try {
    docsArray = typeof docs === 'string' ? JSON.parse(docs) : docs;
    if (typeof docsArray === 'string') docsArray = JSON.parse(docsArray);
  } catch (e) {
    console.error("Parsing error:", e);
    docsArray = [];
  }
  if (!Array.isArray(docsArray) || docsArray.length === 0) {
    return '<span class="text-slate-300 italic text-[9px]">No Docs</span>';
  }
  const images = docsArray.map(item => (typeof item === 'object' && item !== null) ? item.url : item)
    .filter(url => url && typeof url === 'string' && (
      url.match(/\.(jpg|jpeg|png|webp|gif|svg)/i) ||
      url.includes('fbcdn.net') ||
      url.includes('supabase.co/storage') ||
      url.includes('messenger.com')
    ));
  const pdfs = docsArray.map(item => (typeof item === 'object' && item !== null ? item.url : item))
    .filter(url => url && typeof url === 'string' && url.toLowerCase().includes('.pdf'));
  const audios = docsArray.map(item => (typeof item === 'object' && item !== null ? item.url : item))
    .filter(url => url && typeof url === 'string' && url.match(/\.(mp3|wav|ogg|m4a)/i));

  let html = `<div style="display:flex;flex-wrap:nowrap;gap:6px;align-items:center;justify-content:flex-start;background:#f8fafc;padding:6px;border-radius:10px;border:1.5px dashed #cbd5e1;max-width:140px;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;">`;
  if (images.length > 0) {
    html += `
      <div class="relative cursor-pointer group" onclick="openGallery(${JSON.stringify(images).replace(/"/g, '&quot;')}, '${id}')">
        <img src="${images[0]}" class="w-10 h-10 rounded-lg border-2 border-white shadow-md object-cover group-hover:scale-110 transition-transform"
             onerror="this.src='https://cdn-icons-png.flaticon.com/512/3342/3342137.png'">
        ${images.length > 1 ? `<div class="absolute -top-2 -right-2 bg-blue-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-lg">+${images.length - 1}</div>` : ''}
      </div>`;
  }
  if (pdfs.length > 0) {
    pdfs.forEach((url) => {
      html += `
        <a href="${url}" target="_blank" rel="noopener noreferrer"
           style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:38px;height:38px;background:white;border-radius:8px;border:1px solid #eee;text-decoration:none;margin:2px;">
          <i class="fas fa-file-pdf" style="color:#ef4444;font-size:16px;"></i>
          <span style="font-size:6px;font-weight:900;color:#ef4444;margin-top:1px;">PDF</span>
        </a>`;
    });
  }
  if (audios.length > 0) {
    audios.forEach((url) => {
      html += `
        <button onclick="new Audio('${url}').play()"
          style="display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;background:#ecfdf5;border-radius:8px;border:1px solid #10b981;cursor:pointer;margin:2px;">
          <i class="fas fa-play-circle" style="color:#10b981;font-size:18px;"></i>
        </button>`;
    });
  }
  return html + `</div>`;
}

function buildTableRows() {
  const tableBody = document.getElementById('tableBody');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  const startIndex = (STATE.currentPage - 1) * SYSTEM_CONFIG.PAGE_SIZE;
  const items = STATE.filteredData.slice(startIndex, startIndex + SYSTEM_CONFIG.PAGE_SIZE);

  items.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'border-b hover:bg-slate-50 transition-colors text-[10px]';
    tr.innerHTML = `
      <td class="p-4 font-mono text-slate-500">${new Date(row.created_at).toLocaleDateString('ne-NP')}</td>
      <td class="p-1 text-center">${row.platform === 'whatsapp' ? '🟢' : '🔵'}</td>
      <td class="p-4">
        <div class="font-black text-slate-800 text-[11px]">${row.customer_name || 'rt9736782'}</div>
        <div class="text-[10px] text-blue-600 font-bold">${row.phone_number || ''}</div>
      </td>
      <td class="p-4">
        <select class="w-full border rounded-lg p-1.5 font-black bg-white shadow-sm" onchange="commitUpdate('${row.id}', {service: this.value}, 'सेवा फेरियो')">
          <option value="Passport" ${row.service==='Passport'?'selected':''}>Passport</option>
          <option value="PCC" ${row.service==='PCC'?'selected':''}>PCC</option>
          <option value="NID" ${row.service==='NID'?'selected':''}>NID</option>
          <option value="License" ${row.service==='License'?'selected':''}>License</option>
          <option value="PAN" ${row.service==='PAN'?'selected':''}>PAN</option>
          <option value="Visa" ${row.service==='Visa'?'selected':''}>Visa</option>
          <option value="Other" ${row.service==='Other'?'selected':''}>Other</option>
        </select>
        <input type="text" class="w-full text-[8px] border-b border-dotted mt-1 outline-none italic text-slate-400"
          placeholder="More..." value="${row.other_service_name || ''}"
          onblur="commitUpdate('${row.id}', {other_service_name: this.value.toUpperCase()}, 'Saved')">
      </td>
      <td class="p-4">
        <div class="flex flex-col gap-1.5">
          <button onclick="launchAIAutoFill('${row.id}', '${row.service}')" class="bg-orange-600 text-white text-[9px] font-black py-1.5 px-3 rounded-lg shadow-md hover:bg-orange-700 transition">🚀 AUTO</button>
          <button onclick="handleChatClick('${row.phone_number}', '${row.platform}', '${row.sender_id}')" class="bg-blue-600 text-white text-[9px] font-black py-1.5 px-3 rounded-lg shadow-md hover:bg-blue-700 transition">💬 CHAT</button>
        </div>
      </td>
      <td class="p-4">
        <select class="w-full font-black p-1 rounded border-2 bg-white" onchange="commitUpdate('${row.id}', {status: this.value}, 'Status Updated')" style="border-color: ${getStatusColor(row.status)}; color: ${getStatusColor(row.status)}">
          <option value="inquiry" ${row.status==='inquiry'?'selected':''}>📩 INQ</option>
          <option value="pending" ${row.status==='pending'?'selected':''}>⏳ PND</option>
          <option value="working" ${row.status==='working'?'selected':''}>🛠️ WRK</option>
          <option value="success" ${row.status==='success'?'selected':''}>✅ SUC</option>
          <option value="problem" ${row.status==='problem'?'selected':''}>❌ PRB</option>
        </select>
      </td>
      <td class="p-4">
        <textarea class="w-32 h-14 text-[9px] border rounded-xl p-2 bg-white resize-none" readonly>${row.chat_summary || ''}</textarea>
      </td>
      <td class="p-4">
        <input type="text" class="w-full border-b-2 border-slate-100 bg-transparent text-[10px] font-bold text-slate-600 outline-none"
          placeholder="Add note..." value="${row.operator_instruction || ''}"
          onblur="commitUpdate('${row.id}', {operator_instruction: this.value}, 'Note Saved')">
      </td>
      <td class="p-4 text-center font-bold text-emerald-600">
        Rs.<input type="text" class="w-16 bg-transparent text-center border-b-2 border-dotted border-emerald-200 outline-none"
          value="${row.income || 0}" placeholder="0/0" onblur="commitUpdate('${row.id}', {income: this.value}, 'Income Saved')">
      </td>
      <td class="p-4 text-center text-[10px] font-black text-slate-400 uppercase">${row.last_updated_by || 'ADMIN'}</td>
      <td class="p-4">${renderFileIcons(row.documents, row.id)}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function openGallery(images, id) {
  const selectedKey = `selected_docs_${id}`;
  let selectedDocs = JSON.parse(localStorage.getItem(selectedKey) || "[]");

  const modalHtml = `
    <div id="galleryModal" class="fixed inset-0 bg-black/95 z-[9999999] flex flex-col p-6 animate-in fade-in">
      <div class="flex justify-between items-center text-white mb-6">
        <div>
          <h2 class="font-black tracking-widest uppercase text-sm italic text-blue-400">Customer Documents</h2>
          <p class="text-[10px] text-slate-400">फारमको लागि फोटो छान्नुहोस् (Tick ✅ लगाउनुहोस्)</p>
        </div>
        <button onclick="document.getElementById('galleryModal').remove()" class="text-4xl hover:text-red-500">&times;</button>
      </div>
      <div class="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-4 gap-4">
        ${images.map(img => {
          const isChecked = selectedDocs.includes(img) ? 'checked' : '';
          const borderColor = isChecked ? 'border-blue-500' : 'border-white/10';
          return `
          <div class="relative rounded-2xl overflow-hidden border-4 ${borderColor} bg-slate-800 transition-all">
            <img src="${img}" class="w-full h-64 object-cover cursor-zoom-in" onclick="window.open('${img}')">
            <div class="absolute top-3 left-3 scale-[1.8]">
              <input type="checkbox" value="${img}" ${isChecked}
                onchange="togglePhotoSelection('${id}', '${img}', this)"
                class="cursor-pointer accent-blue-500">
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="p-4 flex justify-end">
        <button onclick="document.getElementById('galleryModal').remove()" class="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all">DONE</button>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function togglePhotoSelection(id, url, el) {
  const key = `selected_docs_${id}`;
  let selected = JSON.parse(localStorage.getItem(key) || "[]");
  if (el.checked) {
    if (!selected.includes(url)) selected.push(url);
    el.closest('div').parentElement.style.borderColor = '#3b82f6';
  } else {
    selected = selected.filter(item => item !== url);
    el.closest('div').parentElement.style.borderColor = 'rgba(255,255,255,0.1)';
  }
  localStorage.setItem(key, JSON.stringify(selected));
}

function showFinancialReport() {
  const now = new Date();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const stats = STATE.allData.reduce((acc, curr) => {
    const date = new Date(curr.created_at);
    const amt = parseFloat(curr.income) || 0;
    const status = (curr.status || '').toLowerCase();
    if (status === 'success') {
      acc.total += amt;
      if (date >= startOfWeek) acc.weekly += amt;
      if (date >= startOfMonth) acc.monthly += amt;
    }
    return acc;
  }, { total: 0, weekly: 0, monthly: 0 });

  const modalHtml = `
    <div id="reportModal" class="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[999999] p-4">
      <div class="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden border-4 border-slate-900">
        <div class="bg-slate-900 p-6 text-white text-center">
          <h2 class="text-xl font-black italic">FINANCIAL REPORT</h2>
        </div>
        <div class="p-8 space-y-4">
          <div class="flex justify-between p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-100">
            <span class="text-xs font-black text-emerald-700">यो हप्ता:</span>
            <span class="text-xl font-black text-emerald-800">Rs. ${stats.weekly.toLocaleString()}</span>
          </div>
          <div class="flex justify-between p-4 bg-blue-50 rounded-2xl border-2 border-blue-100">
            <span class="text-xs font-black text-blue-700">यो महिना:</span>
            <span class="text-xl font-black text-blue-800">Rs. ${stats.monthly.toLocaleString()}</span>
          </div>
          <div class="flex justify-between p-4 bg-slate-100 rounded-2xl">
            <span class="text-xs font-black text-slate-600">कुल जम्मा:</span>
            <span class="text-xl font-black text-slate-900">Rs. ${stats.total.toLocaleString()}</span>
          </div>
        </div>
        <div class="p-6 bg-slate-50 border-t">
          <button onclick="document.getElementById('reportModal').remove()" class="w-full py-4 bg-slate-900 text-white rounded-2xl font-black">बन्द गर्नुहोस्</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function toggleSettingsModal() {
  const rpaUrl = localStorage.getItem('rpa_url') || SYSTEM_CONFIG.RPA_SERVER_URL;
  const master = localStorage.getItem('ai_rules_master') || "";
  const nid = localStorage.getItem('ai_rules_nid') || "";
  const pcc = localStorage.getItem('ai_rules_pcc') || "";
  const passport = localStorage.getItem('ai_rules_passport') || "";
  const license = localStorage.getItem('ai_rules_license') || "";
  const pan = localStorage.getItem('ai_rules_pan') || "";

  const modalHtml = `
    <div id="settingsModal" class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[999999] p-4">
      <div class="bg-white w-full max-w-3xl rounded-[30px] shadow-2xl overflow-hidden border-4 border-slate-900">
        <div class="bg-slate-900 p-5 text-white flex justify-between items-center">
          <h2 class="font-black italic text-sm text-blue-400">TITAN AI CONTROL PANEL (ALL SERVICES)</h2>
          <button onclick="document.getElementById('settingsModal').remove()" class="text-2xl">&times;</button>
        </div>
        <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto bg-slate-50">
          <div>
            <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">🤖 RPA Server URL</label>
            <input type="text" id="set_rpa_url" value="${rpaUrl}" class="w-full border-2 rounded-xl p-3 text-xs outline-none focus:border-blue-500">
          </div>
          <div class="space-y-4">
            <div>
              <label class="text-[9px] font-bold text-blue-600 uppercase">Master Rules</label>
              <textarea id="set_rules_master" rows="2" class="w-full border-2 rounded-xl p-3 text-xs outline-none focus:border-blue-500">${master}</textarea>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="text-[9px] font-bold text-orange-500 uppercase">NID Rules</label>
                <textarea id="set_rules_nid" rows="2" class="w-full border-2 rounded-xl p-3 text-xs outline-none focus:border-orange-500">${nid}</textarea>
              </div>
              <div>
                <label class="text-[9px] font-bold text-emerald-500 uppercase">PCC Rules</label>
                <textarea id="set_rules_pcc" rows="2" class="w-full border-2 rounded-xl p-3 text-xs outline-none focus:border-emerald-500">${pcc}</textarea>
              </div>
              <div>
                <label class="text-[9px] font-bold text-blue-500 uppercase">Passport Rules</label>
                <textarea id="set_rules_passport" rows="2" class="w-full border-2 rounded-xl p-3 text-xs outline-none focus:border-blue-500">${passport}</textarea>
              </div>
              <div>
                <label class="text-[9px] font-bold text-red-500 uppercase">License Rules</label>
                <textarea id="set_rules_license" rows="2" class="w-full border-2 rounded-xl p-3 text-xs outline-none focus:border-red-500">${license}</textarea>
              </div>
              <div class="md:col-span-2">
                <label class="text-[9px] font-bold text-indigo-500 uppercase">PAN Rules</label>
                <textarea id="set_rules_pan" rows="2" class="w-full border-2 rounded-xl p-3 text-xs outline-none focus:border-indigo-500">${pan}</textarea>
              </div>
            </div>
          </div>
        </div>
        <div class="p-5 bg-white border-t flex gap-4">
          <button onclick="document.getElementById('settingsModal').remove()" class="flex-1 py-3 font-black text-slate-400 uppercase text-[10px]">Cancel</button>
          <button onclick="saveSettings()" class="flex-[2] py-3 bg-blue-600 text-white rounded-xl font-black shadow-lg text-[10px]">SAVE ALL SETTINGS</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function saveManualNote(id) {
  try {
    const textarea = document.getElementById('manualNoteInput');
    const value = (textarea?.value || '').trim();
    if (!value) return notify('Note is empty', 'error');
    commitUpdate(id, { operator_instruction: value }, 'Note Updated')
      .then(ok => ok && document.getElementById('noteModal')?.remove());
  } catch (e) {
    console.error('❌ saveManualNote error:', e);
    notify('Failed to update note', 'error');
  }
}

function openLargeNote(id, content) {
  const safe = typeof content === 'string' ? content : '';
  const displayContent = safe || 'अहिलेसम्म कुनै लग रेकर्ड गरिएको छैन।';
  const textareaContent = safe ? safe.replace(/<br>/g, '\n') : '';
  const modalHtml = `
    <div id="noteModal" class="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[9999999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div class="bg-white w-full max-w-2xl rounded-[30px] shadow-2xl overflow-hidden border-4 border-slate-900 flex flex-col max-h-[85vh]">
        <div class="bg-slate-900 p-5 text-white flex justify-between items-center">
          <div class="flex items-center gap-3">
            <div class="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            <h2 class="font-black italic text-sm tracking-widest uppercase">Titan AI Process Logs</h2>
          </div>
          <button onclick="document.getElementById('noteModal').remove()" class="text-3xl hover:text-red-500 transition-colors">&times;</button>
        </div>
        <div class="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-4 font-mono text-xs" id="modalScrollBody">
          <div class="bg-blue-100 border-l-4 border-blue-600 p-4 rounded-r-xl text-blue-900 whitespace-pre-wrap leading-relaxed shadow-sm">
            ${displayContent}
          </div>
        </div>
        <div class="p-4 bg-white border-t border-slate-200 flex flex-col gap-3">
          <textarea id="manualNoteInput" class="w-full border-2 border-slate-200 rounded-2xl p-3 text-xs outline-none focus:border-blue-500 h-20 resize-none" placeholder="यहाँ केही लेख्नुहोस् (उदा: ok)...">${textareaContent}</textarea>
          <div class="flex gap-2">
            <button onclick="document.getElementById('noteModal').remove()" class="flex-1 py-3 font-black text-slate-400 uppercase text-[10px]">Close</button>
            <button onclick="saveManualNote('${id}')" class="flex-[2] py-3 bg-slate-900 text-white rounded-2xl font-black shadow-lg text-[10px] hover:bg-blue-700 transition-all">UPDATE NOTE / SEND OK</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const body = document.getElementById('modalScrollBody');
  if (body) body.scrollTop = body.scrollHeight;
}