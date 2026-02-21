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

function renderMasterTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    // यदि डाटा छैन भने यो देखाउँछ
    if (!TITAN_STATE.filteredLeads || TITAN_STATE.filteredLeads.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-center py-20 opacity-20 italic font-black tracking-[5px]">NEURAL DATA EMPTY</td></tr>`;
        return;
    }

    // डाटा टेबलमा भर्ने मुख्य कोड
    tbody.innerHTML = TITAN_STATE.filteredLeads.map(lead => `
        <tr class="group hover:bg-blue-500/[0.04] transition-all border-b border-white/5 text-slate-300">
            <td class="px-3 py-2 whitespace-nowrap border-l-2 border-transparent group-hover:border-blue-500 transition-all">
                <div class="font-bold text-blue-400 text-[10px]">${new Date(lead.created_at).toLocaleDateString()}</div>
                <div class="text-[8px] text-slate-500 font-mono uppercase">${new Date(lead.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </td>

            <td class="px-3 py-2 text-center">
                <div class="scale-75 origin-center">${typeof renderPlatformBadge === 'function' ? renderPlatformBadge(lead.platform) : lead.platform}</div>
            </td>

            <td class="px-3 py-2 min-w-[130px]">
                <div class="font-black text-slate-100 text-[11px] truncate uppercase tracking-tight">${lead.customer_name || 'Anonymous'}</div>
                <div class="text-[9px] text-blue-500/70 font-mono">${lead.phone_number || '---'}</div>
            </td>

            <td class="px-3 py-2">
                <span class="px-2 py-0.5 bg-slate-900/50 border border-white/10 rounded-full text-[8px] font-black uppercase text-slate-400 tracking-tighter">
                    ${lead.service || 'General'}
                </span>
            </td>

            <td class="px-3 py-2">
                <select onchange="handleStatusUpdate('${lead.id}', this.value)" 
                    class="bg-slate-950 text-[9px] font-black uppercase px-2 py-1 rounded-lg border border-white/5 text-slate-400 w-full cursor-pointer hover:border-blue-500/50 outline-none transition-all">
                    ${['inquiry', 'pending', 'working', 'success', 'problem'].map(s => 
                        `<option value="${s}" ${lead.status === s ? 'selected' : ''}>${s}</option>`
                    ).join('')}
                </select>
            </td>

            <td class="px-3 py-2 max-w-[160px]">
                <p class="text-[9px] leading-tight text-slate-500 italic line-clamp-1 group-hover:text-slate-300 transition-colors" title="${lead.chat_summary || ''}">
                    ${lead.chat_summary || 'Waiting for neural sync...'}
                </p>
            </td>

            <td class="px-3 py-2">
                <textarea onchange="handleNoteUpdate('${lead.id}', this.value)" 
                    placeholder="Log note..."
                    class="w-full bg-white/[0.02] border border-white/5 rounded-lg px-2 py-1 text-[9px] text-slate-400 outline-none h-7 resize-none focus:h-14 focus:bg-slate-900 focus:border-blue-500/30 transition-all font-medium">${lead.operator_instruction || ''}</textarea>
            </td>

            <td class="px-3 py-2 text-right">
                <div class="text-[11px] font-black text-emerald-500 tracking-tighter">
                    <span class="text-[8px] opacity-50 mr-0.5">Rs.</span>${(parseFloat(lead.income) || 0).toLocaleString()}
                </div>
            </td>

            <td class="px-3 py-2 text-center">
                ${lead.documents ? 
                    `<i class="fas fa-layer-group text-blue-500 text-[10px] animate-pulse"></i>` : 
                    `<i class="fas fa-minus text-slate-800 text-[9px]"></i>`}
            </td>

            <td class="px-3 py-2">
                <code class="text-[8px] bg-white/5 px-1.5 py-0.5 rounded text-slate-600 font-mono">${(lead.id || '').slice(0, 5)}</code>
            </td>

            <td class="px-3 py-2 text-right">
                <div class="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                    <button onclick="viewLeadDetail('${lead.id}')" class="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-lg shadow-blue-500/10">
                        <i class="fas fa-terminal text-[9px]"></i>
                    </button>
                    <button onclick="triggerDelete('${lead.id}')" class="h-7 w-7 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/10">
                        <i class="fas fa-trash-alt text-[9px]"></i>
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
function checkLoginSession() {
    return localStorage.getItem('titan_session') === 'active';
}