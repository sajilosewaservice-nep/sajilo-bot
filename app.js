/** * =============================================================================
 * TITAN ENTERPRISE CRM v4.0.0 (ULTIMATE EDITION)
 * =============================================================================
 * Features: 5-Status Engine, RPA Auto-Form Integration, Live Messenger, 
 * Advanced Security, Real-time Financial Analytics.
 * =============================================================================
 */

const SYSTEM_CONFIG = {
    SUPABASE_URL: "https://ratgpvubjrcoipardzdp.supabase.co",
    SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhdGdwdnVianJjb2lwYXJkemRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTg0OTMsImV4cCI6MjA4Mzg5NDQ5M30.t1eofJj9dPK-Psp_oL3LpCWimyz621T21JNpZljEGZk",
    PAGE_ACCESS_TOKEN: "EAAcaSLIPpeYBQtd8KAJjlnZCmcMWXRCCWSWNeWye0ucjX2KBp5sNp4tO1HD19d4ZBx06BFEsxZCgDcBm7VxlGBwFxU7rZCDnadrXYU3z0yfWHZBByyqOZCoZCIlTARxRbD1AbuXsN2v1UbCWGS72TbfUaDGcVTTL2qW3R8p2eEqv6nqPWjj6qFw3IWvR27ualAO1FEmUtHvUAZDZD",
    RPA_SERVER_URL: localStorage.getItem('rpa_url') || "http://localhost:5000",
    PAGE_SIZE: 15
};

let supabaseClient;
let STATE = {
    currentUser: null,
    allData: [],
    filteredData: [],
    currentPage: 1,
    isLoading: false
};

// --- १. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    supabaseClient = supabase.createClient(SYSTEM_CONFIG.SUPABASE_URL, SYSTEM_CONFIG.SUPABASE_KEY);
    validateSession();
    registerGlobalEvents();
    startRealtimeBridge();
    
    // Live Clock Engine
    setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ne-NP', { hour12: true });
        if (document.getElementById('lastUpdate')) {
            document.getElementById('lastUpdate').innerHTML = `LIVE: <span class="text-blue-600 font-bold">${timeStr}</span>`;
        }
    }, 1000);
});

// --- २. RPA & AUTO-FORM ENGINE ---
async function launchAIAutoFill(id, service) {
    if (!service || service === 'Other') return notify("कृपया सेवा (PCC/NID) छान्नुहोस्!", "error");
    
    const customer = STATE.allData.find(c => c.id === id);
    notify(`${service} को लागि RPA रोबोट सक्रिय हुँदैछ...`, "success");
    
    try {
        const response = await fetch(`${SYSTEM_CONFIG.RPA_SERVER_URL}/start-automation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_id: id,
                service_type: service,
                customer_name: customer.customer_name,
                phone: customer.phone_number,
                operator: STATE.currentUser.full_name
            })
        });
        if (!response.ok) throw new Error();
        notify("RPA ले फारम भर्न सुरु गर्यो!", "success");
    } catch (err) {
        notify("RPA सर्भर अफलाइन छ! पाइथन एप चलाउनुहोस्।", "error");
    }
}

// --- ३. SETTINGS MODAL (CONFIG ENGINE) ---
function toggleSettingsModal() {
    const modalHtml = `
        <div id="settingsModal" class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[999999] p-4">
            <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div class="bg-slate-900 p-4 text-white flex justify-between items-center">
                    <h2 class="font-bold text-sm tracking-widest uppercase"><i class="fas fa-microchip mr-2 text-blue-400"></i> System Control</h2>
                    <button onclick="document.getElementById('settingsModal').remove()" class="text-2xl hover:text-red-400">&times;</button>
                </div>
                <div class="p-6 space-y-5">
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 mb-1 uppercase">RPA Robot Gateway (URL)</label>
                        <input type="text" id="set_rpa_url" value="${SYSTEM_CONFIG.RPA_SERVER_URL}" class="w-full border-2 rounded-xl p-3 text-sm font-mono focus:border-blue-500 outline-none">
                    </div>
                    <div class="p-3 bg-blue-50 rounded-xl">
                        <p class="text-[10px] text-blue-700 font-medium italic">* RPA लिङ्क परिवर्तन गरेपछि सेभ गर्नुहोस्। सामान्यतया यो 'localhost:5000' नै हुन्छ।</p>
                    </div>
                </div>
                <div class="p-4 bg-slate-50 flex gap-3">
                    <button onclick="document.getElementById('settingsModal').remove()" class="flex-1 py-3 text-xs font-bold text-slate-500">बन्द गर्नुहोस्</button>
                    <button onclick="saveSettings()" class="flex-1 py-3 text-xs font-bold bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200">SAVE SETTINGS</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function saveSettings() {
    const newUrl = document.getElementById('set_rpa_url').value;
    SYSTEM_CONFIG.RPA_SERVER_URL = newUrl;
    localStorage.setItem('rpa_url', newUrl);
    notify("सेटिंग अपडेट भयो!", "success");
    document.getElementById('settingsModal').remove();
}

// --- ४. RENDERING CORE (10 COLUMNS + 5 STATUSES) ---
function buildTableRows() {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';
    const startIndex = (STATE.currentPage - 1) * SYSTEM_CONFIG.PAGE_SIZE;
    const items = STATE.filteredData.slice(startIndex, startIndex + SYSTEM_CONFIG.PAGE_SIZE);

    items.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'border-b hover:bg-blue-50/40 transition-all';
        tr.innerHTML = `
            <td class="px-4 py-4 text-[10px] font-mono text-slate-500">${new Date(row.created_at).toLocaleString('ne-NP')}</td>
            <td class="px-2 py-4 text-center text-xl">${row.platform === 'whatsapp' ? '🟢' : '🔵'}</td>
            <td class="px-4 py-4">
                <div class="font-bold text-sm text-slate-800">${row.customer_name || 'नयाँ ग्राहक'}</div>
                <div class="text-[10px] text-blue-600 font-black">${row.phone_number}</div>
            </td>
            <td class="px-4 py-4">
                <select class="w-full border rounded-lg p-1.5 text-xs font-bold bg-slate-50" onchange="commitUpdate('${row.id}', {service: this.value}, 'सेवा अपडेट भयो')">
                    <option value="PCC" ${row.service==='PCC'?'selected':''}>PCC Report</option>
                    <option value="NID" ${row.service==='NID'?'selected':''}>NID Card</option>
                    <option value="Passport" ${row.service==='Passport'?'selected':''}>Passport</option>
                    <option value="License" ${row.service==='License'?'selected':''}>License</option>
                    <option value="Other" ${row.service==='Other'?'selected':''}>Other</option>
                </select>
            </td>
            <td class="px-4 py-4">
                <div class="flex flex-col gap-1.5">
                    <button onclick="launchAIAutoFill('${row.id}', '${row.service}')" class="bg-orange-500 text-white text-[9px] font-black py-1.5 px-2 rounded-lg hover:bg-orange-600 transition-all shadow-sm">🚀 AUTO-FORM</button>
                    <button onclick="openMessengerHistory('${row.phone_number}', '${row.customer_name}')" class="bg-blue-600 text-white text-[9px] font-black py-1.5 px-2 rounded-lg hover:bg-blue-700 transition-all shadow-sm">💬 CRM CHAT</button>
                </div>
            </td>
            <td class="px-4 py-4">
                <select class="status-badge w-full text-[10px] font-black p-1.5 rounded-lg border-2" 
                        onchange="commitUpdate('${row.id}', {status: this.value}, 'अवस्था अपडेट गरियो')"
                        style="border-color: ${getStatusColor(row.status)}">
                    <option value="inquiry" ${row.status==='inquiry'?'selected':''}>📩 INQUIRY</option>
                    <option value="pending" ${row.status==='pending'?'selected':''}>⏳ PENDING</option>
                    <option value="working" ${row.status==='working'?'selected':''}>🛠️ WORKING</option>
                    <option value="success" ${row.status==='success'?'selected':''}>✅ SUCCESS</option>
                    <option value="problem" ${row.status==='problem'?'selected':''}>❌ PROBLEM</option>
                </select>
            </td>
            <td class="px-4 py-4">
                <textarea class="w-full text-[10px] border rounded p-1 outline-none focus:ring-1 focus:ring-blue-400" 
                          placeholder="Note..." onblur="commitUpdate('${row.id}', {operator_instruction: this.value}, 'नोट सेभ भयो')">${row.operator_instruction || ''}</textarea>
            </td>
            <td class="px-4 py-4 text-center">
                <div class="font-bold text-emerald-600 flex items-center justify-center">
                    <span class="text-[10px] mr-1">Rs.</span>
                    <input type="number" class="w-14 border-b bg-transparent outline-none text-center" value="${row.income || 0}" onblur="commitUpdate('${row.id}', {income: this.value}, 'पेमेन्ट सेभ भयो')">
                </div>
            </td>
            <td class="px-4 py-4 text-center">
                <span class="text-[9px] font-bold bg-slate-100 px-2 py-1 rounded text-slate-500 uppercase">${row.last_updated_by || 'SYSTEM'}</span>
            </td>
            <td class="px-4 py-4"><div class="flex gap-1 justify-center">${renderFileIcons(row.documents)}</div></td>
        `;
        tableBody.appendChild(tr);
    });
}

function getStatusColor(status) {
    const map = { inquiry: '#94a3b8', pending: '#f59e0b', working: '#3b82f6', success: '#10b981', problem: '#ef4444' };
    return map[status] || '#cbd5e1';
}

// --- ५. FINANCIAL ANALYTICS ENGINE ---
function refreshFinancialAnalytics() {
    const stats = STATE.allData.reduce((acc, curr) => {
        acc.counts[curr.status] = (acc.counts[curr.status] || 0) + 1;
        if (curr.status === 'success') acc.revenue += (parseFloat(curr.income) || 0);
        return acc;
    }, { counts: {}, revenue: 0 });

    const updateUI = (id, val) => { if(document.getElementById(id)) document.getElementById(id).textContent = val; };
    
    updateUI('statIncome', `Rs. ${stats.revenue.toLocaleString()}`);
    updateUI('statSuccess', stats.counts['success'] || 0);
    updateUI('statPending', stats.counts['pending'] || 0);
    updateUI('statInquiry', stats.counts['inquiry'] || 0);
    updateUI('statWorking', stats.counts['working'] || 0);
}

// --- ६. SYSTEM UTILS (SYNC, SECURITY, EVENTS) ---
async function commitUpdate(id, updates, msg) {
    const payload = { ...updates, last_updated_by: STATE.currentUser.full_name, updated_at: new Date().toISOString() };
    await supabaseClient.from('customers').update(payload).eq('id', id);
    notify(msg, "success");
    syncCoreDatabase();
}

async function syncCoreDatabase() {
    const { data, error } = await supabaseClient.from('customers').select('*').order('created_at', { ascending: false });
    if (!error) {
        STATE.allData = data;
        applyLogicFilters(false);
        refreshFinancialAnalytics();
    }
}

function startRealtimeBridge() {
    supabaseClient.channel('any').on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (payload) => {
        if (payload.eventType === 'INSERT') {
            new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play();
            notify("नयाँ डाटा आयो!", "success");
        }
        syncCoreDatabase();
    }).subscribe();
}

function renderFileIcons(docs) {
    if (!docs || docs.length === 0) return '-';
    return docs.map(url => `<img src="${url}" onclick="window.open('${url}')" class="w-8 h-8 rounded border-2 border-white shadow-sm cursor-pointer hover:scale-125 transition-transform">`).join('');
}

function validateSession() {
    const sessionToken = sessionStorage.getItem('titan_user');
    if (sessionToken) {
        STATE.currentUser = JSON.parse(sessionToken);
        loadDashboardInterface();
    } else {
        document.getElementById('loginPage').classList.remove('hidden');
    }
}

async function loadDashboardInterface() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.remove('hidden');
    document.getElementById('userDisplay').textContent = `अहिलेको अपरेटर: ${STATE.currentUser.full_name}`;
    await syncCoreDatabase();
}

function notify(msg, type) {
    const n = document.createElement('div');
    n.className = `fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-3 rounded-full text-white font-bold z-[1000000] shadow-2xl animate-bounce ${type==='success'?'bg-slate-900':'bg-red-600'}`;
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

function applyLogicFilters(reset = true) {
    const q = document.getElementById('searchInput').value.toLowerCase();
    STATE.filteredData = STATE.allData.filter(d => (d.customer_name || '').toLowerCase().includes(q) || (d.phone_number || '').includes(q));
    if(reset) STATE.currentPage = 1;
    buildTableRows();
}

function registerGlobalEvents() {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('username').value;
        const pass = document.getElementById('password').value;
        const { data } = await supabaseClient.from('staff').select('*').eq('username', user).eq('password', pass).single();
        if (data) {
            STATE.currentUser = data;
            sessionStorage.setItem('titan_user', JSON.stringify(data));
            loadDashboardInterface();
        } else {
            notify("पासवर्ड मिलेन!", "error");
        }
    });
    document.getElementById('searchInput').addEventListener('input', () => applyLogicFilters());
    document.getElementById('logoutBtn').addEventListener('click', () => { sessionStorage.clear(); location.reload(); });
}