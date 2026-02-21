
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

// ड्यासबोर्ड सिधै खुलाउने नियम
window.onload = async () => {
    if (checkLoginSession()) {
        // यदि लगिन छ भने ड्यासबोर्ड देखाउने
        document.getElementById('loginPage')?.classList.add('hidden');
        document.getElementById('dashboardPage')?.classList.remove('hidden');
        
        // डाटा लोड गर्ने
        if (typeof bootSystem === 'function') {
            await bootSystem();
        } else {
            await syncCoreData();
            registerGlobalEvents();
        }
    } else {
        // लगिन छैन भने लगिन फर्म सुचारु गर्ने
        authGuard();
    }
};