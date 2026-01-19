/** * =============================================================================
 * TITAN ENTERPRISE CRM SYSTEM v2.5.0 (FINAL PRODUCTION READY)
 * =============================================================================
 * Developed for: High-Performance Data Management
 * Author: Gemini AI Thought Partner
 * Date: 2026-01-12
 * Features: Multi-operator, Real-time Sync, Financial Stats, Data Security
 * =============================================================================
 */

const SYSTEM_CONFIG = {
    // यहाँ process.env नराख्नुहोस्, सिधै कोटेसन भित्र Key राख्नुहोस्
    SUPABASE_URL: "https://ratgpvubjrcoipardzdp.supabase.co",
    SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhdGdwdnVianJjb2lwYXJkemRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTg0OTMsImV4cCI6MjA4Mzg5NDQ5M30.t1eofJj9dPK-Psp_oL3LpCWimyz621T21JNpZljEGZk", 
    PAGE_SIZE: 15,
    AUTO_REFRESH_RATE: 1800000, 
    THEME_COLOR: '#3b82f6'
};

let supabaseClient;
document.addEventListener('DOMContentLoaded', () => {
    supabaseClient = supabase.createClient(SYSTEM_CONFIG.SUPABASE_URL, SYSTEM_CONFIG.SUPABASE_KEY);
});

// --- २. GLOBAL APPLICATION STATE ---
let STATE = {
    currentUser: null,
    allData: [],
    filteredData: [],
    currentPage: 1,
    isSearching: false,
    selectedRows: new Set(),
    sortConfig: { column: 'created_at', direction: 'desc' },
    lastSync: null,
    isLoading: false
};

// --- ३. DOM ELEMENT REGISTRY (SAFE SELECTION) ---
const UI = {
    // Pages
    loginView: document.getElementById('loginPage'),
    dashboardView: document.getElementById('dashboardPage'),
    
    // Form Elements
    loginForm: document.getElementById('loginForm'),
    userInput: document.getElementById('username'),
    passInput: document.getElementById('password'),
    
    // Dashboard Header
    userNameDisplay: document.getElementById('userDisplay'),
    logoutBtn: document.getElementById('logoutBtn'),
    syncStatus: document.getElementById('lastUpdate'),
    
    // Table Core
    tableBody: document.getElementById('tableBody'),
    
    // Controls
    searchBar: document.getElementById('searchInput'),
    statusFilter: document.getElementById('statusFilter'),
    platformFilter: document.getElementById('platformFilter'),
    
    // Pagination
    pagination: {
        prev: document.getElementById('prevBtn'),
        next: document.getElementById('nextBtn'),
        current: document.getElementById('currentPageInput'),
        total: document.getElementById('totalPages'),
        count: document.getElementById('totalRecords')
    },
    
    // Analytics Boxes
    analytics: {
        income: document.getElementById('statIncome'),
        success: document.getElementById('statSuccess'),
        progress: document.getElementById('statProgress'),
        problem: document.getElementById('statProblem')
    }
};

// --- ४. APP STARTUP & BOOTSTRAP ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("%c[TITAN SYSTEM] Booting core engine...", "color: #3b82f6; font-weight: bold;");
    initializeSystem();
});

function initializeSystem() {
    validateSession();
    registerGlobalEvents();
    startRealtimeBridge();
    setupHeartbeat();

    // --- यहाँ यो नयाँ घडीको कोड थप्नुहोस् (यसले सेकेन्ड-सेकेन्डमा समय बदल्छ) ---
    setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ne-NP', { hour12: true });
        const dateStr = now.toLocaleDateString('ne-NP', { 
            year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' 
        });
        
        if (UI.syncStatus) {
            UI.syncStatus.innerHTML = `LIVE: <span style="color: #2563eb;">${timeStr}</span> | ${dateStr}`;
        }
    }, 1000); 
}

// --- ५. SECURITY & SESSION MANAGEMENT (MULTI-USER SAFE) ---
function validateSession() {
    // sessionStorage ले गर्दा हरेक नयाँ विन्डो वा ट्याबमा लगइन माग्नेछ
    const sessionToken = sessionStorage.getItem('titan_user');
    
    if (sessionToken) {
        try {
            STATE.currentUser = JSON.parse(sessionToken);
            loadDashboardInterface();
        } catch (e) {
            handleSystemLockout(true);
        }
    } else {
        // यदि यो विन्डोमा लगइन छैन भने लगइन पेज देखाउने
        UI.loginView.classList.remove('hidden');
        UI.dashboardView.classList.add('hidden');
    }
}

async function handleLoginRequest(event) {
    event.preventDefault();
    setLoading(true);

    const user = UI.userInput.value.trim();
    const pass = UI.passInput.value.trim();

    try {
        const { data, error } = await supabaseClient
            .from('staff')
            .select('*')
            .eq('username', user)
            .eq('password', pass)
            .single();

        if (error || !data) throw new Error("Invalid Credentials");

        STATE.currentUser = data;
        
        // डाटालाई sessionStorage मा सेभ गर्ने ताकि अर्को विन्डोमा यो सेयर नहोस्
        sessionStorage.setItem('titan_user', JSON.stringify(data));
        
        loadDashboardInterface();
        notify(`स्वागत छ, ${data.full_name}!`, 'success');
    } catch (err) {
        notify("युजरनेम वा पासवर्ड गलत छ!", "error");
    } finally {
        setLoading(false);
    }
}

function handleSystemLockout(force = false) {
    if (force || confirm("के तपाईँ लगआउट गर्न चाहनुहुन्छ?")) {
        // सेसन क्लियर गर्ने
        sessionStorage.removeItem('titan_user');
        // कहिलेकाहीँ ब्राउजरमा पुरानो डाटा अड्किन सक्छ, त्यसैले 'Local' पनि क्लियर गरिदिने
        localStorage.removeItem('titan_user'); 
        window.location.reload();
    }
}

// --- ६. DATA ENGINE (FETCH & PROCESS) ---
async function loadDashboardInterface() {
    UI.loginView.classList.add('hidden');
    UI.dashboardView.classList.remove('hidden');
    UI.userNameDisplay.textContent = `अहिलेको अपरेटर: ${STATE.currentUser.full_name}`;
    
    await syncCoreDatabase();
}

async function syncCoreDatabase() {
    if (STATE.isLoading) return;
    STATE.isLoading = true;

    try {
        const { data, error } = await supabaseClient
            .from('customers')
            .select('*')
            .order(STATE.sortConfig.column, { ascending: STATE.sortConfig.direction === 'asc' });

        if (error) throw error;

        STATE.allData = data || [];
        applyLogicFilters(false);
        refreshFinancialAnalytics();
        updateSyncTime();
    } catch (err) {
        notify("डाटा सिंक गर्न सकिएन!", "error");
    } finally {
        STATE.isLoading = false;
    }
}

// --- ७. RENDERING ENGINE (THE 10-COLUMN CORE) ---
function buildTableRows() {
    const startIndex = (STATE.currentPage - 1) * SYSTEM_CONFIG.PAGE_SIZE;
    const paginatedItems = STATE.filteredData.slice(startIndex, startIndex + SYSTEM_CONFIG.PAGE_SIZE);

    UI.tableBody.innerHTML = '';

    if (paginatedItems.length === 0) {
        UI.tableBody.innerHTML = `<tr><td colspan="10" class="py-20 text-center text-slate-400 italic">कुनै पनि डाटा भेटिएन।</td></tr>`;
        return;
    }

    paginatedItems.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-100 hover:bg-blue-50/30 transition-all duration-200';
        tr.setAttribute('data-id', row.id);

        tr.innerHTML = `
            <td class="px-6 py-4 text-[11px] font-mono text-slate-500">
                ${formatSystemDate(row.created_at)}
            </td>

            <td class="px-2 py-4 text-center">
                ${row.platform === 'whatsapp' 
                    ? '<i class="fab fa-whatsapp text-green-500 text-xl" title="WhatsApp"></i>' 
                    : '<i class="fab fa-facebook-messenger text-blue-600 text-xl" title="Messenger"></i>'}
            </td>

            <td class="px-6 py-4">
                <div class="font-bold text-slate-800 text-sm">${row.customer_name || 'Anonymous'}</div>
                <div class="text-[10px] text-blue-500 font-bold">${row.phone_number || 'N/A'}</div>
            </td>

           <td class="px-6 py-4">
                <select class="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 text-xs outline-none focus:border-blue-500 font-bold" 
                        onchange="commitUpdate('${row.id}', {service: this.value}, 'सेवा अपडेट गरियो')">
                    <option value="NID" ${row.service === 'NID' ? 'selected' : ''}>NID Card</option>
                    <option value="PCC" ${row.service === 'PCC' ? 'selected' : ''}>PCC Report</option>
                    <option value="Passport" ${row.service === 'Passport' ? 'selected' : ''}>Passport</option>
                    <option value="License" ${row.service === 'License' ? 'selected' : ''}>License</option>
                    <option value="PAN" ${row.service === 'PAN' ? 'selected' : ''}>PAN Service</option>
                    
                    <option value="Other" ${(!['NID','PCC','Passport','License','PAN'].includes(row.service)) ? 'selected' : ''}>Other / Mixed</option>
                </select>
                ${(!['NID','PCC','Passport','License','PAN', null].includes(row.service)) 
                    ? `<div class="text-[9px] text-red-500 font-bold mt-1 uppercase">Note: ${row.service}</div>` 
                    : ''
                }
            </td>

 <td class="px-6 py-4">
    <div onclick="alert('FULL MESSAGE:\n\n' + this.innerText)" 
         class="max-w-[180px] cursor-pointer hover:text-blue-600 transition-colors"
         title="Click to read full message">
        
        <div class="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-slate-600 font-medium mb-2 border-b border-slate-50 pb-1">
            <i class="fas fa-comment-dots text-blue-400 mr-1"></i> 
            ${row.chat_summary || '<span class="text-slate-300 italic">No message yet</span>'}
        </div>
    </div>

    ${row.platform === 'whatsapp' 
        ? `<a href="https://wa.me/${row.phone_number.replace(/\D/g,'')}" 
              target="_blank" 
              class="inline-flex items-center gap-1.5 text-[9px] font-bold text-green-600 bg-green-50/50 hover:bg-green-600 hover:text-white px-2 py-1 rounded transition-all shadow-sm">
               <i class="fab fa-whatsapp"></i> REPLY VIA WHATSAPP
           </a>`
        : `<a href="https://m.me/${row.phone_number}" 
              target="_blank" 
              class="inline-flex items-center gap-1.5 text-[9px] font-bold text-blue-600 bg-blue-50/50 hover:bg-blue-600 hover:text-white px-2 py-1 rounded transition-all shadow-sm">
               <i class="fab fa-facebook-messenger"></i> REPLY VIA MESSENGER
           </a>`
    }
</td>

            <td class="px-6 py-4">
                <select class="status-badge status-${row.status} w-full" 
                        onchange="commitUpdate('${row.id}', {status: this.value}, 'अवस्था अपडेट गरियो')">
                    <option value="success" ${row.status === 'success' ? 'selected' : ''}>✅ SUCCESS</option>
                    <option value="in_progress" ${row.status === 'in_progress' ? 'selected' : ''}>⏳ WORKING</option>
                    <option value="problem" ${row.status === 'problem' ? 'selected' : ''}>❌ PROBLEM</option>
                </select>
            </td>

            <td class="px-6 py-4">
                <textarea class="w-full text-[11px] border border-slate-100 rounded p-1 outline-none focus:ring-1 focus:ring-blue-400" 
                          placeholder="Note here..."
                          onblur="commitUpdate('${row.id}', {operator_instruction: this.value}, 'नोट सेभ भयो')">${row.operator_instruction || ''}</textarea>
            </td>

            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center font-bold text-emerald-600">
                    <span class="text-[10px] mr-1">Rs.</span>
                    <input type="number" class="w-16 bg-transparent border-b border-transparent focus:border-emerald-400 outline-none text-center" 
                           value="${row.income || 0}" 
                           onblur="commitUpdate('${row.id}', {income: this.value}, 'पेमेन्ट अपडेट भयो')">
                </div>
            </td>

            <td class="px-6 py-4 text-center">
                <span class="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-full uppercase tracking-tighter">
                    ${row.last_updated_by || 'SYSTEM'}
                </span>
            </td>

            <td class="px-6 py-4 text-center">
                <div class="flex gap-2 justify-center">
                    ${renderFileIcons(row.documents)}
                </div>
            </td>
        `;
        UI.tableBody.appendChild(tr);
    });

    updatePaginationStatus();
}

// --- ८. UPDATE ENGINE ---
async function commitUpdate(id, dataObject, successMessage) {
    if (!id || id === 'undefined') {
        notify("ग्राहकको ID भेटिएन!", "error");
        return;
    }

    const payload = {
        ...dataObject,
        last_updated_by: STATE.currentUser.full_name,
        updated_at: new Date().toISOString()
    };

    try {
        const { data, error } = await supabaseClient
            .from('customers')
            .update(payload)
            .eq('id', id)
            .select();

        if (error) throw error;

        if (data && data.length > 0) {
            STATE.allData = STATE.allData.map(c => c.id === id ? { ...c, ...payload } : c);
            refreshFinancialAnalytics();
            notify(successMessage, 'success');
        } else {
            notify("डेटाबेसमा यो डाटा भेटिएन!", "error");
        }
    } catch (err) {
        console.error("Update Fail:", err);
        notify("अपडेट असफल! सुपवेस नियम जाँच गर्नुहोस्।", "error");
    }
}

function handleRemoteTrigger(payload) {
    console.log("🚀 Realtime Trigger Received:", payload.eventType);
    
    if (payload.eventType === 'INSERT') {
        // नयाँ म्यासेज आउने बित्तिकै लिस्टको सुरुमा थप्ने
        STATE.allData = [payload.new, ...STATE.allData];
        
        // नयाँ म्यासेज आएको थाहा पाउन नोटिफिकेसन दिने
        notify("नयाँ म्यासेज प्राप्त भयो!", "success");
    } 
    else if (payload.eventType === 'UPDATE') {
        STATE.allData = STATE.allData.map(c => c.id === payload.new.id ? payload.new : c);
        flashRow(payload.new.id);
    } 
    else if (payload.eventType === 'DELETE') {
        STATE.allData = STATE.allData.filter(c => c.id !== payload.old.id);
    }

    // यो सबैभन्दा महत्वपूर्ण लाइन हो: यसले नयाँ डाटालाई टेबलमा तुरुन्तै देखाउँछ
    applyLogicFilters(false); 
    refreshFinancialAnalytics();
}

// --- यहाँ हाल्नुहोस् (यो म्यासेज पठाउने मुख्य इन्जिन हो) ---
function startRealtimeBridge() {
    console.log("🔌 Connecting to Realtime Bridge...");
    
    supabaseClient
        .channel('public-sync')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'customers' }, 
            (payload) => {
                // यो लाइनले म्यासेज आएको वा गएको थाहा पाउँछ
                handleRemoteTrigger(payload);
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log("✅ Realtime Bridge Connected! Now WhatsApp will work.");
            }
        });
}

// --- ९. ANALYTICS & FILTERS ---
function applyLogicFilters(resetPage = true) {
    const query = UI.searchBar.value.toLowerCase().trim();
    const statusVal = UI.statusFilter.value;
    const platformVal = UI.platformFilter.value;

    STATE.filteredData = STATE.allData.filter(item => {
        const matchQuery = !query || 
            (item.customer_name || '').toLowerCase().includes(query) || 
            (item.phone_number || '').includes(query) ||
            (item.service || '').toLowerCase().includes(query);
            
        const matchStatus = !statusVal || item.status === statusVal;
        const matchPlatform = !platformVal || item.platform === platformVal;

        return matchQuery && matchStatus && matchPlatform;
    });

    if (resetPage) STATE.currentPage = 1;
    buildTableRows();
}

function refreshFinancialAnalytics() {
    const report = STATE.allData.reduce((acc, current) => {
        // नयाँ थपिएको: status 'start' भएमा वा खाली भएमा inquiry गन्ने
        if (!current.status || current.status === 'start') acc.inquiry++;
        
        if (current.status === 'success') acc.success++;
        if (current.status === 'in_progress') acc.progress++;
        if (current.status === 'problem') acc.problem++;
        acc.revenue += (parseFloat(current.income) || 0);
        return acc;
    }, { inquiry: 0, success: 0, progress: 0, problem: 0, revenue: 0 });

    // HTML मा संख्या देखाउन
    const inquiryBox = document.getElementById('statInquiry');
    if (inquiryBox) inquiryBox.textContent = report.inquiry;

    UI.analytics.income.textContent = `Rs. ${report.revenue.toLocaleString()}`;
    UI.analytics.success.textContent = report.success;
    UI.analytics.progress.textContent = report.progress;
    UI.analytics.problem.textContent = report.problem;
}

// --- १०. GLOBAL HELPERS ---
function registerGlobalEvents() {
    UI.loginForm.addEventListener('submit', handleLoginRequest);
    UI.logoutBtn.addEventListener('click', handleSystemLockout);

    UI.searchBar.addEventListener('input', debounce(() => {
        STATE.isSearching = !!UI.searchBar.value;
        applyLogicFilters(true);
    }, 400));

    UI.statusFilter.addEventListener('change', () => applyLogicFilters(true));
    UI.platformFilter.addEventListener('change', () => applyLogicFilters(true));

    UI.pagination.prev.addEventListener('click', () => {
        if (STATE.currentPage > 1) { STATE.currentPage--; buildTableRows(); scrollToTop(); }
    });

    UI.pagination.next.addEventListener('click', () => {
        const max = Math.ceil(STATE.filteredData.length / SYSTEM_CONFIG.PAGE_SIZE);
        if (STATE.currentPage < max) { STATE.currentPage++; buildTableRows(); scrollToTop(); }
    });
}

function formatSystemDate(iso) {
    return new Date(iso).toLocaleString('ne-NP', { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
    });
}

function renderFileIcons(docs) {
    if (!docs || docs.length === 0) return '<span class="text-slate-200">-</span>';
    
    return docs.map(url => {
        // यहाँ हामीले 'fbcdn' थपेका छौँ जसले मेसेन्जरका फोटोहरू चिन्छ
        const isImage = url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)/g) || 
                        url.includes('msg_') || 
                        url.includes('_wa') ||
                        url.includes('fbcdn') || 
                        url.includes('messenger');
        
        if (isImage) {
            return `
                <div class="inline-block m-1">
                    <img src="${url}" 
                         onclick="window.open('${url}', '_blank')" 
                         class="w-10 h-10 object-cover rounded border border-slate-200 hover:scale-150 cursor-pointer transition-transform shadow-md" 
                         onerror="this.src='https://via.placeholder.com/40?text=IMG'" 
                         title="फोटो हेर्नुहोस्">
                </div>`;
        } else {
            const pdfUrl = url.split('?')[0].toLowerCase().endsWith('.pdf') ? `${url}#toolbar=1` : url;
            return `
                <a href="${pdfUrl}" target="_blank" rel="noopener noreferrer"
                   class="inline-flex items-center justify-center w-10 h-10 bg-red-50 border border-red-200 rounded text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm m-1 text-center" 
                   title="PDF फाइल खोल्नुहोस्">
                    <div class="flex flex-col items-center justify-center leading-none">
                        <i class="fas fa-file-pdf" style="font-size: 14px;"></i>
                        <span style="font-size: 7px; font-weight: 900; margin-top: 1px;">VIEW</span>
                    </div>
                </a>`;
        }
    }).join('');
}

function notify(msg, type) {
    const div = document.createElement('div');
    div.className = `fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white font-bold z-[9999] shadow-2xl transition-all duration-500 transform translate-y-20 ${type==='success'?'bg-slate-800':'bg-red-600'}`;
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.classList.remove('translate-y-20'), 100);
    setTimeout(() => {
        div.classList.add('translate-y-20');
        setTimeout(() => div.remove(), 500);
    }, 3000);
}

function flashRow(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (row) {
        row.classList.add('bg-yellow-100');
        setTimeout(() => row.classList.remove('bg-yellow-100'), 2000);
    }
}

function updatePaginationStatus() {
    const total = Math.ceil(STATE.filteredData.length / SYSTEM_CONFIG.PAGE_SIZE) || 1;
    UI.pagination.count.textContent = STATE.filteredData.length;
    UI.pagination.total.textContent = total;
    UI.pagination.current.value = STATE.currentPage;
    UI.pagination.prev.disabled = (STATE.currentPage === 1);
    UI.pagination.next.disabled = (STATE.currentPage === total);
}

function updateSyncTime() {
    // यसलाई खाली छोड्नुहोस् ताकि माथिको लाइभ घडी नमेटियोस्
    console.log("डाटा सिंक भयो: " + new Date().toLocaleTimeString());
}

function setupHeartbeat() {
    setInterval(() => {
        if (STATE.currentUser && !STATE.isSearching) syncCoreDatabase();
    }, SYSTEM_CONFIG.AUTO_REFRESH_RATE);
}

function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setLoading(val) {
    STATE.isLoading = val;
    // यहाँ लोडिङ स्पिनर देखाउने लजिक थप्न सकिन्छ।
}

/** * FINISHED: Titan CRM Enterprise Logic
 * Optimized for Scale and Speed.
 * =============================================================================
 */