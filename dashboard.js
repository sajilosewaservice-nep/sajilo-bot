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
    form.setAttribute('autocomplete', 'off');
    document.getElementById('username').setAttribute('autocomplete', 'one-time-code');
    document.getElementById('password').setAttribute('autocomplete', 'new-password');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('username').value.trim();
        const p = document.getElementById('password').value.trim();
        const btn = form.querySelector('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Authenticating...';
        btn.disabled = true;
        await new Promise(resolve => setTimeout(resolve, 600));
        if (u === 'admin' && p === 'pass123') {
            localStorage.setItem('titan_session', 'active');
            const loginPage = document.getElementById('loginPage');
            const dashboardPage = document.getElementById('dashboardPage');
            if (loginPage && dashboardPage) {
                loginPage.classList.add('hidden');
                dashboardPage.classList.remove('hidden');
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

window.filterByPlatform = (p) => { TITAN_STATE.ui.currentPlatform = p; applyFilters(); };
window.syncCoreDatabase = syncCoreData;
window.exportFinancials = exportData;
window.viewLeadDetail = (id) => { console.log("Detail View for:", id); };
function checkLoginSession() {
    return localStorage.getItem('titan_session') === 'active';
}

// ...existing logic, state, and authentication code...
// ...existing logic, state, and authentication code...

// Import React, Recharts, Lucide-react
import React, { useEffect, useState } from 'react';
import { Home, BarChart, MessageSquare, Users, Settings } from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, BarChart as RBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const BLUE = "#0061FF";
const ORANGE = "#FF9F43";
const LIGHT_BLUE = "#A5D8FA";
const PEACH = "#FFDAB9";

function Dashboard() {
    // Map your actual TITAN_STATE data to chart formats
    const donutData = [
        { value: TITAN_STATE.stats.conversionRate || 88 },
        { value: 100 - (TITAN_STATE.stats.conversionRate || 88) }
    ];

    const lineData = TITAN_STATE.rawLeads.map((lead, idx) => ({
        name: lead.customer_name || `Lead ${idx + 1}`,
        blue: lead.income || 0,
        orange: lead.problemCount || 0
    }));

    const barData = TITAN_STATE.rawLeads.map((lead, idx) => ({
        name: lead.customer_name || `Lead ${idx + 1}`,
        blue: lead.successCount || 0,
        lightBlue: lead.workingCount || 0
    }));

    const areaData = TITAN_STATE.rawLeads.map((lead, idx) => ({
        month: lead.created_at ? new Date(lead.created_at).toLocaleString('default', { month: 'short' }) : `M${idx + 1}`,
        value: lead.income || 0
    }));

    // Auth logic (keep as is)
    if (!checkLoginSession()) {
        // ...existing login/auth UI...
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                {/* ...existing login form... */}
                <form id="loginForm" className="bg-white p-8 rounded-xl shadow-sm">
                    {/* ...login fields and logic... */}
                </form>
            </div>
        );
    }

    // Main UI
    return (
        <div className="flex bg-white min-h-screen">
            {/* Sidebar */}
            <aside className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-6 shadow-sm">
                <div className="mb-8">
                    <img src="/avatar.png" alt="User" className="w-10 h-10 rounded-full" />
                </div>
                <nav className="flex flex-col gap-6">
                    <Home className="text-blue-600 w-6 h-6" />
                    <BarChart className="text-blue-600 w-6 h-6" />
                    <MessageSquare className="text-blue-600 w-6 h-6" />
                    <Users className="text-blue-600 w-6 h-6" />
                    <Settings className="text-blue-600 w-6 h-6" />
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 grid grid-cols-4 gap-6 bg-gray-50">
                {/* Top Cards */}
                <div className="bg-white shadow-sm rounded-xl p-6 flex flex-col min-w-[220px]">
                    <h3 className="text-blue-600 font-bold mb-2">Schedule 1</h3>
                    <ResponsiveContainer width="100%" height={120}>
                        <PieChart>
                            <Pie
                                data={donutData}
                                innerRadius={40}
                                outerRadius={55}
                                dataKey="value"
                                startAngle={90}
                                endAngle={-270}
                            >
                                <Cell key="cell-1" fill={BLUE} />
                                <Cell key="cell-2" fill="#F3F4F6" />
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="text-center text-blue-600 text-2xl font-bold mt-2">{donutData[0].value}%</div>
                </div>

                <div className="bg-white shadow-sm rounded-xl p-6 flex flex-col min-w-[220px]">
                    <h3 className="text-blue-600 font-bold mb-2">Schedule 3</h3>
                    <ResponsiveContainer width="100%" height={120}>
                        <LineChart data={lineData}>
                            <Line type="monotone" dataKey="blue" stroke={BLUE} strokeWidth={2} dot={{ r: 5, fill: BLUE }} />
                            <Line type="monotone" dataKey="orange" stroke={ORANGE} strokeWidth={2} dot={{ r: 5, fill: ORANGE }} />
                            <XAxis dataKey="name" />
                            <Tooltip />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-white shadow-sm rounded-xl p-6 flex flex-col min-w-[220px]">
                    <h3 className="text-blue-600 font-bold mb-2">Schedule 3</h3>
                    <div className="h-8 w-full flex rounded-xl overflow-hidden mt-4">
                        <div className="bg-blue-600 h-full w-1/3"></div>
                        <div className="bg-blue-300 h-full w-1/3"></div>
                        <div className="bg-orange-300 h-full w-1/3"></div>
                    </div>
                </div>

                <div className="bg-white shadow-sm rounded-xl p-6 flex flex-col min-w-[220px]">
                    <h3 className="text-blue-600 font-bold mb-2">Schedule 4</h3>
                    <div className="flex flex-col items-center">
                        <span className="text-green-500 text-xl font-bold">${TITAN_STATE.stats.totalIncome}</span>
                        {/* Gauge Chart: Use PieChart for half-circle */}
                        <ResponsiveContainer width={100} height={60}>
                            <PieChart>
                                <Pie
                                    data={[{ value: 50 }, { value: 50 }]}
                                    startAngle={180}
                                    endAngle={0}
                                    innerRadius={20}
                                    outerRadius={40}
                                    dataKey="value"
                                >
                                    <Cell fill={BLUE} />
                                    <Cell fill="#E5E7EB" />
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Middle Section */}
                <div className="col-span-2">
                    <div className="bg-white shadow-sm rounded-xl p-6">
                        <h3 className="text-blue-600 font-bold mb-2">General stats</h3>
                        <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={areaData}>
                                <Line type="monotone" dataKey="value" stroke={BLUE} strokeWidth={2} dot={{ r: 5, fill: ORANGE }} />
                                <XAxis dataKey="month" />
                                <Tooltip />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div>
                    <div className="bg-white shadow-sm rounded-xl p-6">
                        <h3 className="text-blue-600 font-bold mb-2">Main schedule</h3>
                        <ResponsiveContainer width="100%" height={180}>
                            <RBarChart data={barData}>
                                <Bar dataKey="blue" fill={BLUE} />
                                <Bar dataKey="lightBlue" fill={LIGHT_BLUE} />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                            </RBarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div>
                    <div className="bg-white shadow-sm rounded-xl p-6">
                        <h3 className="text-blue-600 font-bold mb-2">Calendar</h3>
                        <div className="flex flex-col items-center">
                            <span className="text-gray-400 text-sm">MAY</span>
                            <span className="text-2xl font-bold text-blue-600">17</span>
                            <div className="flex gap-2 mt-2">
                                <span className="bg-green-100 text-green-600 rounded-xl px-2 py-1 text-xs">Go</span>
                                <span className="bg-orange-100 text-orange-600 rounded-xl px-2 py-1 text-xs">Happy Hour</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Dashboard;
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