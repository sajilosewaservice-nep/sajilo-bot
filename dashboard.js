/**
 * =============================================================================
 * TITAN ENTERPRISE CRM v4.0.0 - PRO MASTER ENGINE (EXTENDED PRODUCTION)
 * =============================================================================
 * Optimized for Vercel & Supabase Real-time
 * Schema Sync: customers (income, operator_instruction, chat_summary)
 * =============================================================================
 */
// dashboard.js को सुरुमै यो मात्र राख्नुहोस्
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('titan_session') === 'active') {
        const lp = document.getElementById('loginPage');
        const dp = document.getElementById('dashboardPage');
        if (lp) lp.classList.add('hidden');
        if (dp) dp.classList.remove('hidden');
    }
});

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
        tbody.innerHTML = `<tr><td colspan="12" class="text-center py-32">
            <div class="relative inline-block">
                <div class="absolute inset-0 blur-2xl bg-blue-500/20 rounded-full"></div>
                <i class="fas fa-database text-6xl mb-4 text-slate-700 relative z-10"></i>
            </div>
            <p class="text-slate-500 font-bold tracking-[3px] uppercase text-[10px] mt-4">System: No Data Strings Found</p>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = TITAN_STATE.filteredLeads.map(lead => `
        <tr class="group hover:bg-white/[0.04] transition-all duration-500 border-b border-white/5 relative overflow-hidden">
            <td class="px-8 py-6 relative">
                <div class="flex flex-col gap-1">
                    <span class="text-[10px] font-black text-blue-400 tracking-tighter uppercase italic">
                        <i class="fas fa-bolt mr-1 text-[8px]"></i>${new Date(lead.created_at).toLocaleDateString()}
                    </span>
                    <span class="text-[9px] text-slate-500 font-mono font-medium">
                        ${new Date(lead.created_at).toLocaleTimeString()}
                    </span>
                </div>
            </td>

            <td class="px-8 py-6">
                <div class="relative group-hover:scale-110 transition-transform duration-500">
                    <div class="absolute -inset-2 bg-gradient-to-tr from-blue-600/20 to-purple-600/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    ${renderPlatformBadge(lead.platform)}
                </div>
            </td>

            <td class="px-8 py-6">
                <div class="flex items-center gap-4">
                    <div class="relative">
                        <div class="absolute -inset-1 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl blur opacity-20 group-hover:opacity-50 transition-opacity"></div>
                        <div class="h-11 w-11 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center font-black text-white text-xs relative">
                            ${(lead.customer_name || 'T').charAt(0).toUpperCase()}
                        </div>
                    </div>
                    <div>
                        <div class="text-sm font-black text-slate-100 tracking-tight group-hover:text-blue-400 transition-colors">
                            ${lead.customer_name || 'Neural_Guest'}
                        </div>
                        <div class="text-[10px] text-slate-500 font-bold flex items-center gap-2">
                           <span class="h-1 w-1 bg-blue-500 rounded-full"></span>
                           ${lead.phone_number || 'ENC_ACCESS_ONLY'}
                        </div>
                    </div>
                </div>
            </td>

            <td class="px-8 py-6">
                <div class="inline-flex items-center gap-3 px-4 py-2 bg-slate-950/50 border border-white/5 rounded-2xl">
                    <div class="relative flex h-2 w-2">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full ${getStatusColor(lead.status)} opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2 w-2 ${getStatusColor(lead.status)}"></span>
                    </div>
                    <span class="text-[9px] font-black uppercase tracking-[2px] text-slate-300">${lead.status}</span>
                </div>
            </td>

            <td class="px-8 py-6 max-w-[280px]">
                <div class="p-3 bg-white/[0.02] border border-white/5 rounded-xl group-hover:border-blue-500/20 transition-all">
                    <p class="text-[11px] leading-relaxed text-slate-400 font-medium italic opacity-80 group-hover:opacity-100 line-clamp-2">
                        "${lead.chat_summary || 'No protocol summary logs generated in this session.'}"
                    </p>
                </div>
            </td>

            <td class="px-8 py-6 text-right">
                <div class="flex flex-col items-end">
                    <span class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Income</span>
                    <span class="text-lg font-black text-emerald-400 tracking-tighter shadow-emerald-500/20 drop-shadow-md">
                        Rs. ${(parseFloat(lead.income) || 0).toLocaleString()}
                    </span>
                </div>
            </td>

            <td class="px-8 py-6">
                <div class="flex items-center justify-end gap-3 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500">
                    <button onclick="viewLeadDetail('${lead.id}')" class="group/btn h-10 w-10 rounded-xl bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white border border-blue-500/20 transition-all shadow-lg">
                        <i class="fas fa-terminal text-xs"></i>
                    </button>
                    <button onclick="triggerDelete('${lead.id}')" class="group/btn h-10 w-10 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all shadow-lg">
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
        whatsapp: { icon: 'fab fa-whatsapp', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        messenger: { icon: 'fab fa-facebook-messenger', color: 'text-blue-500', bg: 'bg-blue-500/10' }
    };
    
    const p = cfg[platform.toLowerCase()] || { icon: 'fas fa-robot', color: 'text-slate-400', bg: 'bg-slate-400/10' };
    
    return `
        <div class="inline-flex items-center justify-center w-10 h-10 rounded-xl ${p.bg} border border-white/5">
            <i class="${p.icon} ${p.color} text-lg"></i>
        </div>
    `;
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

function authGuard() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    // ब्राउजरको बेकारको अटो-फिल रोक्न
    form.setAttribute('autocomplete', 'off');
    document.getElementById('username').setAttribute('autocomplete', 'one-time-code');
    document.getElementById('password').setAttribute('autocomplete', 'new-password');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // .trim() प्रयोग गर्दा झुक्किएर स्पेस थपिएको भए पनि हट्छ
        const u = document.getElementById('username').value.trim();
        const p = document.getElementById('password').value.trim();

        const btn = form.querySelector('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Authenticating...';
        btn.disabled = true;

        await new Promise(resolve => setTimeout(resolve, 600));

        // यहाँ तपाईँको लगिन चेक हुन्छ
        if (u === 'admin' && p === 'pass123') { // पासवर्ड SQL सँग मिलाउनुहोस्
            localStorage.setItem('titan_session', 'active');
            
            // ड्यासबोर्ड देखाउने ग्यारेन्टी तरिका
            const loginPage = document.getElementById('loginPage');
            const dashboardPage = document.getElementById('dashboardPage');
            
            if (loginPage && dashboardPage) {
                loginPage.classList.add('hidden');
                dashboardPage.classList.remove('hidden');
                
                // लोड हुन सजिलो होस् भनेर २ सेकेन्डको म्याद दिने
                await bootSystem(); 
                showGlobalToast("Welcome back, Admin", "success");
            }
        } else {
            btn.innerHTML = originalText;
            btn.disabled = false;
            showGlobalToast("Login Failed: Check Credentials", "error");
            form.classList.add('animate-shake');
            setTimeout(() => form.classList.remove('animate-shake'), 500);
        }
    });
}

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
function checkLoginSession() {
    return localStorage.getItem('titan_session') === 'active';
}