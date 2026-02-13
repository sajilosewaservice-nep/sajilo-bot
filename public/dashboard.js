import { SYSTEM_CONFIG, STATE } from './config.js';
import { buildTableRows, updatePaginationUI, showFinancialReport } from './design.js';

// Global variable jasle Supabase connect garchha
let supabaseClient;

// --- १. INITIALIZATION (REVISED) ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // १. सुपाबेस क्लाइन्ट सुरु गर्ने (ठूलो 'supabase' लाइब्रेरी प्रयोग गरेर)
        if (typeof supabase !== 'undefined') {
            supabaseClient = supabase.createClient(SYSTEM_CONFIG.SUPABASE_URL, SYSTEM_CONFIG.SUPABASE_KEY);
        } else {
            alert("Error: Supabase library not loaded. Please refresh.");
            return;
        }

        // २. सेसन र इभेन्टहरू लोड गर्ने
        validateSession();
        registerGlobalEvents();
        
        // ३. डाटा तान्न सुरु गर्ने (यो छुटेको थियो)
        if (typeof syncCoreDatabase === 'function') {
            syncCoreDatabase();
        }

        // ४. रियलटाइम अपडेट सुरु गर्ने
        startRealtimeBridge();

        // ५. लाइभ घडी (Clock)
        setInterval(() => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit', 
                hour12: true 
            });
            const lastUpdateEl = document.getElementById('lastUpdate');
            if (lastUpdateEl) {
                lastUpdateEl.innerHTML = `LIVE: <span class="text-blue-600 font-bold">${timeStr}</span>`;
            }
        }, 1000);

    } catch (err) {
        console.error("Dashboard Init Error:", err);
    }
});

// --- ४. ANALYTICS & SETTINGS ---
function saveSettings() {
    localStorage.setItem('rpa_url', document.getElementById('set_rpa_url').value);
    localStorage.setItem('ai_rules_master', document.getElementById('set_rules_master').value);
    localStorage.setItem('ai_rules_nid', document.getElementById('set_rules_nid').value);
    localStorage.setItem('ai_rules_pcc', document.getElementById('set_rules_pcc').value);
    localStorage.setItem('ai_rules_passport', document.getElementById('set_rules_passport').value);
    localStorage.setItem('ai_rules_license', document.getElementById('set_rules_license').value);
    localStorage.setItem('ai_rules_pan', document.getElementById('set_rules_pan').value);
    
    notify("सबै सेटिङहरू सुरक्षित गरियो!", "success");
    document.getElementById('settingsModal').remove();
    setTimeout(() => { location.reload(); }, 1000);
}

// सुधारिएको Launch Function (यसले अब सेटिङबाट सही रुल तान्छ)
async function launchAIAutoFill(id, service) {
    if (!service || service === 'Other') return notify("कृपया सेवा (PCC/NID) छान्नुहोस्!", "error");
    const customer = STATE.allData.find(c => c.id === id);
    
    // यहाँबाट मास्टर र स्पेसिफिक रुल जोडेर पठाउने
    const master = localStorage.getItem('ai_rules_master') || "";
    const specific = (service === 'NID') ? localStorage.getItem('ai_rules_nid') : (service === 'PCC' ? localStorage.getItem('ai_rules_pcc') : "");
    const finalRules = `${master}\n${specific}`;

    const selectedDocs = JSON.parse(localStorage.getItem(`selected_docs_${id}`) || "[]");
    const finalDocs = selectedDocs.length > 0 ? selectedDocs : customer.documents;

    try {
        const response = await fetch(`${SYSTEM_CONFIG.RPA_SERVER_URL}/start-automation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_data: { ...customer, documents: finalDocs }, 
                service_type: service,
                ai_instructions: finalRules,
                operator: STATE.currentUser.full_name
            })
        });
        if (response.ok) notify("RPA र AI सक्रिय भयो!", "success");
    } catch (err) {
        notify("RPA सर्भर अफलाइन छ!", "error");
    }
}

function getStatusColor(status) {
    const s = (status || '').toLowerCase().trim();
    const colors = {
        inquiry: '#64748b', // Slate
        pending: '#f59e0b', // Amber
        working: '#3b82f6', // Blue
        success: '#10b981', // Emerald
        problem: '#ef4444'  // Red
    };
    return colors[s] || '#cbd5e1'; // Default color
}



/**
 * CHAT बटन थिच्दा कुन प्लेटफर्म खोल्ने भन्ने निर्णय गर्ने सच्याइएको फङ्सन
 */
function handleChatClick(phone, platform, senderId) {
    // १. यदि नम्बर र आइडी दुवै छैन भने अलर्ट दिने
    if (!phone && !senderId) {
        if (typeof notify === "function") {
            notify("विवरण फेला परेन!", "error");
        } else {
            alert("विवरण फेला परेन!");
        }
        return;
    }

    // २. ह्वाट्सएपको लागि लजिक (सिधै एप वा वेब खोल्छ)
    if (platform === 'whatsapp' || (phone && phone.length > 5)) {
        // नम्बरबाट अनावश्यक चिन्ह (+, -, स्पेस) हटाउने
        const cleanNumber = (phone || senderId).replace(/\D/g, '');
        window.open(`https://wa.me/${cleanNumber}`, '_blank');
    } 
    // ३. मेसेन्जरको लागि लजिक (m.me भन्दा messenger.com बढी भरपर्दो हुन्छ)
    else {
        // यदि senderId छ भने त्यसको म्यासेज थ्रेड सिधै खोल्ने
        const targetId = senderId || '';
        if (targetId && targetId !== 'undefined') {
            window.open(`https://www.messenger.com/t/${targetId}`, '_blank');
        } else {
            // आइडी नभएमा मेसेन्जरको होम पेज खोल्ने
            window.open(`https://www.messenger.com`, '_blank');
        }
    }
}

// २. यो फिल्टर फङ्सन पनि app.js मा थप्नुहोस् (यदि छैन भने)
function filterByPlatform(p) {
    if (p === 'all') {
        STATE.filteredData = [...STATE.allData];
    } else {
        STATE.filteredData = STATE.allData.filter(d => (d.platform || '').toLowerCase() === p.toLowerCase());
    }
    STATE.currentPage = 1;
    buildTableRows();
    updatePaginationUI();
}



// नोट सेभ गर्ने सानो फङ्सन
async function saveManualNote(id) {
    const newVal = document.getElementById('manualNoteInput').value;
    await commitUpdate(id, { operator_instruction: newVal }, "Note Updated!");
    document.getElementById('noteModal').remove();
}

async function commitUpdate(id, updates, msg) {
    try {
        // सुरक्षित नाम राख्ने ताकि कोड क्र्यास नहोस्
        const userName = (STATE.currentUser && STATE.currentUser.full_name) ? STATE.currentUser.full_name : 'Operator';

        const payload = { 
            ...updates, 
            last_updated_by: userName, 
            updated_at: new Date().toISOString() 
        };

        const { data, error } = await supabaseClient
            .from('customers')
            .update(payload)
            .eq('id', id)
            .select(); 

        if (error) {
            console.error("Supabase Error:", error.message);
            return notify("Error: " + error.message, "error");
        }

        if (data && data.length > 0) {
            if (msg) notify(msg, "success");
            const index = STATE.allData.findIndex(d => d.id === id);
            if (index !== -1) {
                STATE.allData[index] = { ...STATE.allData[index], ...data[0] };
                // हिसाब र टेबल अपडेट गर्ने
                buildTableRows(); 
                refreshFinancialAnalytics();
            }
        }
    } catch (err) {
        console.error("Critical Error:", err);
    }
}

function changePage(direction) {
    const totalItems = STATE.filteredData.length;
    const maxPage = Math.ceil(totalItems / SYSTEM_CONFIG.PAGE_SIZE) || 1;

    if (direction === 'next' && STATE.currentPage < maxPage) {
        STATE.currentPage++;
    } else if (direction === 'prev' && STATE.currentPage > 1) {
        STATE.currentPage--;
    } else {
        return; // केही नगर्ने
    }

    buildTableRows();
    updatePaginationUI();
    window.scrollTo({ top: 0, behavior: 'smooth' }); // पेज फेरिएपछि माथि सार्ने
}

function updatePaginationUI() {
    const pageDisplay = document.getElementById('pageInfo');
    const totalItems = STATE.filteredData.length;
    const maxPage = Math.ceil(totalItems / SYSTEM_CONFIG.PAGE_SIZE) || 1;

    if(pageDisplay) {
        pageDisplay.innerHTML = `PAGE <span style="color: #2563eb; font-weight: 900;">${STATE.currentPage}</span> / ${maxPage}`;
    }
}

async function syncCoreDatabase() {
    const { data, error } = await supabaseClient
        .from('customers')
        .select('*')
        .order('updated_at', { ascending: false }); 

    if (!error) {
        STATE.allData = data;
        // यहाँ false राख्नुपर्छ ताकि तपाईँ काम गरिरहेको पेजबाट नहल्लिनुहोस्
        applyLogicFilters(false); 
        refreshFinancialAnalytics();
    }
}

function refreshFinancialAnalytics() {
    const today = new Date().toISOString().split('T')[0];
    
    const stats = STATE.allData.reduce((acc, curr) => {
        const s = (curr.status || '').toLowerCase().trim();
        acc.counts[s] = (acc.counts[s] || 0) + 1;

        if (s === 'success') {
            // 777/77 बाट पहिलो भाग आम्दानी र दोस्रो भाग बाँकी निकाल्ने
            const parts = String(curr.income || "0/0").split('/');
            const incomeAmt = parseFloat(parts[0].replace(/[^0-9.]/g, '')) || 0;
            const pendingAmt = parts[1] ? (parseFloat(parts[1].replace(/[^0-9.]/g, '')) || 0) : 0;

            acc.revenue += incomeAmt;
            acc.totalPending += pendingAmt;

            // आजको आम्दानी चेक गर्ने
            const entryDate = curr.updated_at ? curr.updated_at.split('T')[0] : '';
            if (entryDate === today) {
                acc.dailyIncome += incomeAmt;
            }
        }
        return acc;
    }, { counts: {}, revenue: 0, totalPending: 0, dailyIncome: 0 });

    const updateUI = (id, val) => { 
        if(document.getElementById(id)) document.getElementById(id).textContent = val; 
    };
    
    updateUI('statIncome', `Rs. ${stats.revenue.toLocaleString()}`);
    updateUI('statDaily', `Rs. ${stats.dailyIncome.toLocaleString()}`); // HTML मा यो ID थप्नुहोला
    updateUI('statPendingTotal', `Rs. ${stats.totalPending.toLocaleString()}`); // HTML मा यो ID थप्नुहोला
    
    updateUI('statSuccess', stats.counts['success'] || 0);
    updateUI('statPending', stats.counts['pending'] || 0);
    updateUI('statInquiry', stats.counts['inquiry'] || 0);
    updateUI('statWorking', stats.counts['working'] || 0);
    updateUI('statProblem', stats.counts['problem'] || 0); 
    updateUI('totalRecords', `TOTAL: ${STATE.allData.length} RECORDS`);
}

function startRealtimeBridge() {
    supabaseClient.channel('any').on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'customers' 
    }, (payload) => {
        if (payload.eventType === 'UPDATE') {
            // १. सिधै STATE मा मात्र अपडेट गर्ने (पुरै डेटा नतान्ने)
            const index = STATE.allData.findIndex(d => d.id === payload.new.id);
            if (index !== -1) {
                // मेसेज र डकुमेन्ट दुवैलाई सुरक्षित राख्दै अपडेट गर्ने
                STATE.allData[index] = { ...STATE.allData[index], ...payload.new };
                applyLogicFilters(false);
                refreshFinancialAnalytics();
            }
        } else {
            // २. नयाँ डेटा थपिँदा मात्र ताली बजाउने र पूरै तान्ने
            if (payload.eventType === 'INSERT') {
                new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play();
                notify("नयाँ ग्राहक थपियो!", "success");
            }
            syncCoreDatabase();
        }
    }).subscribe();
}

// --- ६. AUTH & GLOBAL EVENTS ---

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

    // Set Operator Name

    if(document.getElementById('userDisplay')) {

        document.getElementById('userDisplay').textContent = `OP: ${STATE.currentUser.full_name}`;

    }

    // --- थपिएको: Financial Report बटनलाई प्रोग्रामेटिक रूपमा सक्रिय गर्ने ---

    const btnContainer = document.getElementById('reportBtnContainer');

    if(btnContainer) {

        btnContainer.innerHTML = `<button onclick="showFinancialReport()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-2xl font-black text-[11px] shadow-lg transition-all active:scale-95 uppercase">📊 Analytics Report</button>`;

    }

    await syncCoreDatabase();

}

function notify(msg, type) {

    const n = document.createElement('div');

    n.className = `fixed bottom-10 left-1/2 -translate-x-1/2 px-10 py-4 rounded-3xl text-white font-black z-[1000000] shadow-2xl animate-bounce ${type==='success'?'bg-slate-900 border-2 border-emerald-500':'bg-red-600'}`;

    n.textContent = msg;

    document.body.appendChild(n);

    setTimeout(() => n.remove(), 3000);

}

// --- ६. फिल्टर लोजिक (सुधारिएको: Search र Platform दुवै चल्ने) ---
function applyLogicFilters(reset = true) {
    const searchInput = document.getElementById('searchInput');
    const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    let filtered = [...STATE.allData];

    // २. सर्च कोवेरी (नाम वा नम्बर) फिल्टर गर्ने
    if (q) {
        filtered = filtered.filter(d => 
            (d.customer_name || '').toLowerCase().includes(q) || 
            (d.phone_number || '').includes(q)
        );
    }

    // STATE.selectedPlatform मा 'whatsapp' वा 'messenger' बस्छ
    if (STATE.selectedPlatform && STATE.selectedPlatform !== 'all') {
        filtered = filtered.filter(d => 
            (d.platform || '').toLowerCase() === STATE.selectedPlatform.toLowerCase()
        );
    }

    STATE.filteredData = filtered;

    if(reset) STATE.currentPage = 1;
    
    buildTableRows();
    updatePaginationUI();
}

// प्लेटफर्म बटन थिच्दा चल्ने नयाँ सहयोगी फङ्सन
function filterByPlatform(p) {
    
    STATE.selectedPlatform = p; 
    
    console.log("Filtering by platform:", p);

    applyLogicFilters(true); 
}

// --- ७. ग्लोबल इभेन्टहरू (Login & Search) ---
function registerGlobalEvents() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const userVal = document.getElementById('username').value.trim();
            const passVal = document.getElementById('password').value.trim();

            // सुधारेको कोवेरी: Error handle गर्न 'data' र 'error' दुवै चेक गर्ने
            const { data, error } = await supabaseClient
                .from('staff')
                .select('*')
                .eq('username', userVal)
                .eq('password', passVal)
                .maybeSingle(); // single() को साटो maybeSingle() राम्रो हुन्छ

            if (data && !error) {
                STATE.currentUser = data;
                sessionStorage.setItem('titan_user', JSON.stringify(data));
                notify("सफलतापूर्वक लगइन भयो!", "success");
                loadDashboardInterface();
            } else {
                notify("Username वा Password मिलेन!", "error");
            }
        });
    }

    const sInput = document.getElementById('searchInput');
    if (sInput) {
        sInput.addEventListener('input', () => applyLogicFilters(true));
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => { 
            sessionStorage.clear(); 
            location.reload(); 
        });
    }
}

// Yo thapेपछि मात्र HTML ka buttons le kaam garchhan
window.launchAIAutoFill = launchAIAutoFill;
window.commitUpdate = commitUpdate;
window.handleChatClick = handleChatClick;
window.saveSettings = saveSettings;
window.filterByPlatform = filterByPlatform;
window.changePage = changePage;
window.saveManualNote = saveManualNote;
window.viewPDF = viewPDF;
window.syncCoreDatabase = syncCoreDatabase; // Initialization ko lagi chainchha