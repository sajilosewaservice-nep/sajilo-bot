/**
 * =============================================================================
 * TITAN ENTERPRISE CRM v4.0.0 - PRO MASTER ENGINE (EXTENDED PRODUCTION)
 * =============================================================================
 * Optimized for Vercel & Supabase Real-time
 * Schema Sync: customers (income, operator_instruction, chat_summary)
 * =============================================================================
 */
// dashboard.js ko top ma halnus
if (typeof supabase === 'undefined') {
    console.error("Supabase SDK load bhayena! Check your internet or CDN link.");
    alert("Supabase SDK is missing. Please refresh the page.");
} else {
    console.log("Supabase SDK loaded successfully!");
}
const TITAN_CONFIG = {
    URL: "https://ratgpvubjrcoipardzdp.supabase.co",
    KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhdGdwdnVianJjb2lwYXJkemRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTg0OTMsImV4cCI6MjA4Mzg5NDQ5M30.t1eofJj9dPK-Psp_oL3LpCWimyz621T21JNpZljEGZk",
    TABLE: 'customers',
    VERSION: '4.0.0-PRO-EXTENDED',
    ANIMATION_SPEED: 300
};

const TITAN_STATE = {
    client: null,
    rawLeads: [],
    filteredLeads: [],
    stats: {
        totalIncome: 0,
        successCount: 0,
        pendingCount: 0,
        inquiryCount: 0,
        workingCount: 0,
        problemCount: 0,
        conversionRate: 0
    },
    ui: {
        currentPlatform: 'all',
        searchTerm: '',
        activePage: 1,
        rowsPerPage: 15,
        sortBy: 'created_at',
        sortOrder: 'desc',
        isSyncing: false
    },
    cache: new Map()
};

// ═══════════════════════════════════════════════════════════════════════════
// CORE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
    console.log(`%c ⚡ TITAN CRM MASTER ENGINE v${TITAN_CONFIG.VERSION} `, 'background: #000; color: #00ff00; font-family: monospace; font-size: 14px;');
    
    initSupabase();
    authGuard();
    setupRealtime();
    startClock();
    registerGlobalEvents();
    
    if (checkLoginSession()) {
        await bootSystem();
    }
});

async function bootSystem() {
    toggleMainLoader(true);
    await syncCoreData();
    toggleMainLoader(false);
}

function initSupabase() {
    if (!window.supabase) {
        showGlobalToast("Critical: Supabase SDK Missing!", "error");
        return;
    }
    TITAN_STATE.client = window.supabase.createClient(TITAN_CONFIG.URL, TITAN_CONFIG.KEY);
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA SYNC & ANALYTICS ENGINE
// ═══════════════════════════════════════════════════════════════════════════

async function syncCoreData() {
    if (TITAN_STATE.ui.isSyncing) return;
    TITAN_STATE.ui.isSyncing = true;
    updateSyncStatusUI(true);

    const { data, error } = await TITAN_STATE.client
        .from(TITAN_CONFIG.TABLE)
        .select('*')
        .order(TITAN_STATE.ui.sortBy, { ascending: TITAN_STATE.ui.sortOrder === 'asc' });

    if (error) {
        handleError("DATA_FETCH", error);
    } else {
        TITAN_STATE.rawLeads = data;
        processAnalytics();
        applyFilters();
    }

    TITAN_STATE.ui.isSyncing = false;
    updateSyncStatusUI(false);
}

function processAnalytics() {
    // Reset Stats
    const s = { totalIncome: 0, successCount: 0, pendingCount: 0, inquiryCount: 0, workingCount: 0, problemCount: 0 };
    
    TITAN_STATE.rawLeads.forEach(lead => {
        const status = (lead.status || 'inquiry').toLowerCase();
        const income = parseFloat(lead.income || 0);

        if (status === 'success') {
            s.successCount++;
            s.totalIncome += income;
        } else if (status === 'pending') s.pendingCount++;
        else if (status === 'working') s.workingCount++;
        else if (status === 'problem') s.problemCount++;
        else s.inquiryCount++;
    });

    s.conversionRate = TITAN_STATE.rawLeads.length > 0 
        ? ((s.successCount / TITAN_STATE.rawLeads.length) * 100).toFixed(1) 
        : 0;

    TITAN_STATE.stats = s;
    refreshAnalyticsUI();
}

function refreshAnalyticsUI() {
    const update = (id, val, prefix = '') => {
        const el = document.getElementById(id);
        if (el) el.innerText = prefix + val.toLocaleString();
    };

    update('statIncome', TITAN_STATE.stats.totalIncome, 'Rs. ');
    update('statSuccess', TITAN_STATE.stats.successCount);
    update('statPending', TITAN_STATE.stats.pendingCount);
    update('statInquiry', TITAN_STATE.stats.inquiryCount);
    update('statWorking', TITAN_STATE.stats.workingCount);
    update('statProblem', TITAN_STATE.stats.problemCount);
    
    const totalEl = document.getElementById('totalRecords');
    if (totalEl) totalEl.innerHTML = `<i class="fas fa-database mr-2"></i>TOTAL: ${TITAN_STATE.rawLeads.length}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// MASTER TABLE RENDERER (PRO VERSION)
// ═══════════════════════════════════════════════════════════════════════════

function renderMasterTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    if (TITAN_STATE.filteredLeads.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" class="text-center py-24">
            <div class="opacity-20"><i class="fas fa-folder-open text-6xl mb-4"></i><br>No matching records found.</div>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = TITAN_STATE.filteredLeads.map(lead => `
        <tr class="group hover:bg-slate-50 transition-colors border-b border-slate-100">
            <td class="px-6 py-4">
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    ${new Date(lead.created_at).toLocaleDateString()}
                </div>
                <div class="text-[9px] text-slate-300 font-mono">${new Date(lead.created_at).toLocaleTimeString()}</div>
            </td>
            <td class="px-6 py-4 text-center">
                ${renderPlatformBadge(lead.platform)}
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                        ${(lead.customer_name || 'G').charAt(0)}
                    </div>
                    <div>
                        <div class="text-sm font-black text-slate-800">${lead.customer_name || 'Guest'}</div>
                        <div class="text-[10px] text-blue-500 font-bold"><i class="fas fa-phone-alt mr-1"></i>${lead.phone_number || 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="text-xs font-semibold text-slate-600">${lead.service || 'General Inquiry'}</span>
            </td>
            <td class="px-6 py-4 text-center">
                <div class="text-[9px] font-black p-1 rounded bg-slate-100 text-slate-400">RPA_V4</div>
            </td>
            <td class="px-6 py-4">
                <select onchange="handleStatusUpdate('${lead.id}', this.value)" 
                    class="status-select badge-${lead.status} text-[10px] font-black uppercase p-2 rounded-xl w-full border-0 cursor-pointer shadow-sm">
                    ${['inquiry', 'pending', 'working', 'success', 'problem'].map(s => 
                        `<option value="${s}" ${lead.status === s ? 'selected' : ''}>${s}</option>`
                    ).join('')}
                </select>
            </td>
            <td class="px-6 py-4">
                <div class="max-w-[180px]">
                    <p class="text-[11px] leading-tight text-blue-700 font-medium italic">
                        "${lead.chat_summary || 'No conversation summary generated.'}"
                    </p>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="relative">
                    <i class="fas fa-pen absolute left-0 top-1 text-[9px] text-slate-300"></i>
                    <textarea onchange="handleNoteUpdate('${lead.id}', this.value)" 
                        placeholder="Operator instructions..."
                        class="w-full pl-4 bg-transparent border-b border-transparent focus:border-blue-200 text-[11px] text-slate-500 outline-none resize-none transition-all">${lead.operator_instruction || ''}</textarea>
                </div>
            </td>
            <td class="px-6 py-4 text-right">
                <div class="text-sm font-black text-emerald-600">Rs. ${(parseFloat(lead.income) || 0).toLocaleString()}</div>
            </td>
            <td class="px-6 py-4 text-center">
                ${renderMediaAction(lead.file_url)}
            </td>
            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="viewLeadDetail('${lead.id}')" class="h-8 w-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white transition-all">
                        <i class="fas fa-expand-alt text-xs"></i>
                    </button>
                    <button onclick="triggerDelete('${lead.id}')" class="h-8 w-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-600 hover:text-white transition-all">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// UI HELPERS & COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function renderPlatformBadge(platform) {
    const cfg = {
        whatsapp: { icon: 'fab fa-whatsapp', color: 'text-emerald-500', bg: 'bg-emerald-50' },
        messenger: { icon: 'fab fa-facebook-messenger', color: 'text-blue-500', bg: 'bg-blue-50' }
    };
    const p = cfg[platform] || { icon: 'fas fa-globe', color: 'text-slate-400', bg: 'bg-slate-50' };
    return `<div class="h-9 w-9 ${p.bg} ${p.color} rounded-xl flex items-center justify-center shadow-sm mx-auto">
                <i class="${p.icon} text-lg"></i>
            </div>`;
}

function renderMediaAction(url) {
    if (!url) return `<span class="text-slate-200">--</span>`;
    const isPDF = url.toLowerCase().includes('.pdf');
    return `<button onclick="window.open('${url}', '_blank')" class="h-8 w-8 rounded-full ${isPDF ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'} hover:scale-110 transition-transform shadow-sm">
                <i class="fas ${isPDF ? 'fa-file-pdf' : 'fa-image'}"></i>
            </button>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// OPERATIONS ENGINE (UPDATE/DELETE/EXPORT)
// ═══════════════════════════════════════════════════════════════════════════

async function handleStatusUpdate(id, newStatus) {
    const { error } = await TITAN_STATE.client.from(TITAN_CONFIG.TABLE).update({ status: newStatus }).eq('id', id);
    if (error) {
        showGlobalToast("Status Update Failed", "error");
    } else {
        showGlobalToast(`Status changed to ${newStatus}`, "success");
        await syncCoreData();
    }
}

async function handleNoteUpdate(id, note) {
    const { error } = await TITAN_STATE.client.from(TITAN_CONFIG.TABLE).update({ operator_instruction: note }).eq('id', id);
    if (!error) showGlobalToast("Instruction updated", "info");
}

async function triggerDelete(id) {
    if (confirm("Are you sure? This action cannot be undone.")) {
        const { error } = await TITAN_STATE.client.from(TITAN_CONFIG.TABLE).delete().eq('id', id);
        if (!error) {
            showGlobalToast("Lead deleted permanently", "success");
            await syncCoreData();
        }
    }
}

function exportData() {
    const data = TITAN_STATE.filteredLeads;
    if (data.length === 0) return;

    let csv = "\uFEFF"; // UTF-8 BOM
    csv += "Registration Date,Platform,Customer Name,Phone,Service,Status,Income,Instructions,Summary\n";
    
    data.forEach(l => {
        csv += `${new Date(l.created_at).toLocaleString()},${l.platform},${l.customer_name},${l.phone_number},${l.service},${l.status},${l.income},"${l.operator_instruction}","${l.chat_summary}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `TITAN_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showGlobalToast("Financial Report Exported", "success");
}

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH, FILTER & EVENT BUS
// ═══════════════════════════════════════════════════════════════════════════

function applyFilters() {
    let results = [...TITAN_STATE.rawLeads];

    if (TITAN_STATE.ui.currentPlatform !== 'all') {
        results = results.filter(l => l.platform === TITAN_STATE.ui.currentPlatform);
    }

    if (TITAN_STATE.ui.searchTerm) {
        const q = TITAN_STATE.ui.searchTerm.toLowerCase();
        results = results.filter(l => 
            (l.customer_name || "").toLowerCase().includes(q) ||
            (l.phone_number || "").includes(q) ||
            (l.service || "").toLowerCase().includes(q)
        );
    }

    TITAN_STATE.filteredLeads = results;
    renderMasterTable();
}

function registerGlobalEvents() {
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        TITAN_STATE.ui.searchTerm = e.target.value;
        applyFilters();
    });

    // Logout logic
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('titan_session');
        location.reload();
    });
}

function showGlobalToast(msg, type) {
    const zone = document.getElementById('notificationZone');
    if (!zone) return;
    const toast = document.createElement('div');
    toast.className = `p-4 mb-3 rounded-2xl shadow-2xl bg-white border-l-4 ${type === 'success' ? 'border-emerald-500' : 'border-blue-500'} flex items-center animate-slide-in`;
    toast.innerHTML = `<span class="text-xs font-black uppercase text-slate-700">${msg}</span>`;
    zone.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH & SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

function authGuard() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;

        if (u === 'admin' && p === 'password') {
            localStorage.setItem('titan_session', 'active');
            location.reload();
        } else {
            alert("Security Breach: Invalid Credentials");
        }
    });
}

function checkLoginSession() {
    if (localStorage.getItem('titan_session') === 'active') {
        document.getElementById('loginPage')?.classList.add('hidden');
        document.getElementById('dashboardPage')?.classList.remove('hidden');
        document.getElementById('userDisplay').innerHTML = `<i class="fas fa-shield-alt mr-2 text-blue-500"></i>OP: ROOT_ADMIN`;
        return true;
    }
    return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM UTILITIES (REALTIME/CLOCK)
// ═══════════════════════════════════════════════════════════════════════════

function setupRealtime() {
    if (!TITAN_STATE.client) return;
    TITAN_STATE.client.channel('main_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: TITAN_CONFIG.TABLE }, () => {
            syncCoreData();
            showGlobalToast("Live Update Inbound", "success");
        }).subscribe();
}

function startClock() {
    setInterval(() => {
        const el = document.getElementById('lastUpdate');
        if (el) el.innerHTML = `<span class="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></span> ENGINE_LIVE: ${new Date().toLocaleTimeString()}`;
    }, 1000);
}

function toggleMainLoader(show) {
    const statIncome = document.getElementById('statIncome');
    if (show && statIncome) statIncome.innerText = "Syncing...";
}

function updateSyncStatusUI(syncing) {
    const btn = document.querySelector('[onclick="syncCoreDatabase()"]');
    if (btn) btn.innerHTML = syncing ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-sync-alt"></i>';
}

// Window Global Hooks
window.filterByPlatform = (p) => { TITAN_STATE.ui.currentPlatform = p; applyFilters(); };
window.syncCoreDatabase = syncCoreData;
window.exportFinancials = exportData;
window.viewLeadDetail = (id) => { console.log("Detail View for:", id); };