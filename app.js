/** * =============================================================================

 * TITAN ENTERPRISE CRM v4.0.0 (ULTIMATE RPA EDITION)

 * =============================================================================

 */



const SYSTEM_CONFIG = {

    SUPABASE_URL: "https://ratgpvubjrcoipardzdp.supabase.co",

    SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhdGdwdnVianJjb2lwYXJkemRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTg0OTMsImV4cCI6MjA4Mzg5NDQ5M30.t1eofJj9dPK-Psp_oL3LpCWimyz621T21JNpZljEGZk",

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

    

    // Live Clock Update

    setInterval(() => {

        const now = new Date();

        const timeStr = now.toLocaleTimeString('ne-NP', { hour12: true });

        if (document.getElementById('lastUpdate')) {

            document.getElementById('lastUpdate').innerHTML = `LIVE: <span class="text-blue-600 font-bold">${timeStr}</span>`;

        }

    }, 1000);

});



// --- २. RPA & AI MASTER ENGINE ---

async function launchAIAutoFill(id, service) {

    if (!service || service === 'Other') return notify("कृपया सेवा (PCC/NID) छान्नुहोस्!", "error");

    

    const customer = STATE.allData.find(c => c.id === id);

    const aiRules = localStorage.getItem('ai_rules') || "फारम बुद्धिमानीपूर्वक भर्नु।";

    

    notify(`${service} को लागि AI रोबोट सुरु भयो...`, "success");

    

    try {

        const response = await fetch(`${SYSTEM_CONFIG.RPA_SERVER_URL}/start-automation`, {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({

                customer_data: customer,

                service_type: service,

                ai_instructions: aiRules,

                operator: STATE.currentUser.full_name

            })

        });

        if (!response.ok) throw new Error();

        notify("RPA ले काम सुरु गर्यो!", "success");

    } catch (err) {

        notify("पाइथन RPA सर्भर अफलाइन छ!", "error");

    }

}



// --- ३. MULTIMEDIA ENGINE (Voice, PDF, Gallery) ---

function renderFileIcons(docs) {

    if (!docs || docs.length === 0) return '<span class="text-slate-300 italic text-[9px]">No Docs</span>';

    

    const images = docs.filter(url => url.match(/\.(jpg|jpeg|png|webp|gif)/i));

    const audios = docs.filter(url => url.match(/\.(mp3|wav|ogg|m4a)/i));

    const pdfs = docs.filter(url => url.match(/\.(pdf)/i));



    let html = `<div class="flex flex-wrap gap-2 items-center justify-center">`;



    if (images.length > 0) {

        html += `

            <div class="relative cursor-pointer group" onclick="openGallery(${JSON.stringify(images).replace(/"/g, '&quot;')})">

                <img src="${images[0]}" class="w-10 h-10 rounded-lg border-2 border-white shadow-md object-cover group-hover:scale-110 transition-transform">

                ${images.length > 1 ? `<div class="absolute -top-2 -right-2 bg-blue-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-lg">+${images.length - 1}</div>` : ''}

            </div>`;

    }



    pdfs.forEach(url => {

        html += `<button onclick="window.open('${url}')" class="text-red-500 hover:scale-125 transition-all p-1"><i class="fas fa-file-pdf text-xl"></i></button>`;

    });



    audios.forEach(url => {

        html += `<button onclick="new Audio('${url}').play(); notify('अडियो प्ले हुँदैछ...','success')" class="text-emerald-500 hover:scale-125 transition-all p-1"><i class="fas fa-play-circle text-xl"></i></button>`;

    });



    return html + `</div>`;

}



function openGallery(images) {

    const modalHtml = `

        <div id="galleryModal" class="fixed inset-0 bg-black/95 z-[9999999] flex flex-col p-6 animate-in fade-in">

            <div class="flex justify-between items-center text-white mb-6">

                <h2 class="font-black tracking-widest uppercase text-sm italic">Customer Documents</h2>

                <button onclick="document.getElementById('galleryModal').remove()" class="text-4xl hover:text-red-500">&times;</button>

            </div>

            <div class="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-4 gap-4">

                ${images.map(img => `<img src="${img}" class="w-full h-64 object-cover rounded-2xl border-2 border-white/10 hover:border-blue-500 transition-all cursor-zoom-in" onclick="window.open('${img}')">`).join('')}

            </div>

        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

}



// --- ४. ANALYTICS & SETTINGS ---

function showFinancialReport() {

    const now = new Date();

    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth(), 1);



    const stats = STATE.allData.reduce((acc, curr) => {

        const date = new Date(curr.created_at);

        const amt = parseFloat(curr.income) || 0;

        

        if (curr.status === 'success') {

            acc.total += amt;

            if (date >= oneWeekAgo) acc.weekly += amt;

            if (date >= oneMonthAgo) acc.monthly += amt;

        }

        return acc;

    }, { total: 0, weekly: 0, monthly: 0 });



    const modalHtml = `

        <div id="reportModal" class="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[999999] p-4">

            <div class="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden border-4 border-slate-900 animate-in slide-in-from-bottom duration-300">

                <div class="bg-slate-900 p-8 text-white">

                    <h2 class="text-2xl font-black italic">FINANCIAL <span class="text-emerald-400">REPORT</span></h2>

                    <p class="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Real-time Business Tracking</p>

                </div>

                <div class="p-8 space-y-4">

                    <div class="flex justify-between items-center p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-100">

                        <span class="text-xs font-black text-emerald-700 uppercase">यो हप्ताको कमाइ:</span>

                        <span class="text-xl font-black text-emerald-800">Rs. ${stats.weekly.toLocaleString()}</span>

                    </div>

                    <div class="flex justify-between items-center p-4 bg-blue-50 rounded-2xl border-2 border-blue-100">

                        <span class="text-xs font-black text-blue-700 uppercase">यो महिनाको कमाइ:</span>

                        <span class="text-xl font-black text-blue-800">Rs. ${stats.monthly.toLocaleString()}</span>

                    </div>

                    <div class="flex justify-between items-center p-4 bg-slate-100 rounded-2xl">

                        <span class="text-xs font-black text-slate-600 uppercase">कुल जम्मा (Life-time):</span>

                        <span class="text-xl font-black text-slate-900">Rs. ${stats.total.toLocaleString()}</span>

                    </div>

                </div>

                <div class="p-6 bg-slate-50 border-t">

                    <button onclick="document.getElementById('reportModal').remove()" class="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-slate-800 transition-all">बन्द गर्नुहोस्</button>

                </div>

            </div>

        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

}



function toggleSettingsModal() {

    const aiRules = localStorage.getItem('ai_rules') || "१. नाम ठुलो अक्षरमा लेख्नु।\n२. ठेगाना नागरिकता अनुसार मिलाउनु।";

    const modalHtml = `

        <div id="settingsModal" class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[999999] p-4">

            <div class="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden border-4 border-slate-900 animate-in zoom-in duration-200">

                <div class="bg-slate-900 p-6 text-white flex justify-between items-center">

                    <h2 class="font-black italic">TITAN <span class="text-blue-400">AI CONTROL PANEL</span></h2>

                    <button onclick="document.getElementById('settingsModal').remove()" class="text-3xl hover:text-red-400">&times;</button>

                </div>

                <div class="p-8 space-y-6">

                    <div>

                        <label class="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">🤖 RPA Server URL</label>

                        <input type="text" id="set_rpa_url" value="${SYSTEM_CONFIG.RPA_SERVER_URL}" class="w-full bg-slate-100 border-2 rounded-2xl p-4 font-mono text-sm outline-none focus:border-blue-500">

                    </div>

                    <div>

                        <label class="block text-[11px] font-black text-blue-600 uppercase tracking-widest mb-2">🧠 AI Master Rules (Instructions)</label>

                        <textarea id="set_ai_rules" rows="6" class="w-full bg-blue-50 border-2 border-blue-100 rounded-2xl p-4 text-sm font-medium outline-none focus:border-blue-500">${aiRules}</textarea>

                    </div>

                </div>

                <div class="p-6 bg-slate-50 border-t flex gap-4">

                    <button onclick="document.getElementById('settingsModal').remove()" class="flex-1 py-4 font-black text-slate-400 uppercase">Cancel</button>

                    <button onclick="saveSettings()" class="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl">SAVE SETTINGS</button>

                </div>

            </div>

        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

}



function saveSettings() {

    const newUrl = document.getElementById('set_rpa_url').value;

    const newRules = document.getElementById('set_ai_rules').value;

    SYSTEM_CONFIG.RPA_SERVER_URL = newUrl;

    localStorage.setItem('rpa_url', newUrl);

    localStorage.setItem('ai_rules', newRules);

    notify("सेटिंग सेभ भयो!", "success");

    document.getElementById('settingsModal').remove();

}

function buildTableRows() {
    const tableBody = document.getElementById('tableBody');
    if(!tableBody) return;
    tableBody.innerHTML = '';
    const startIndex = (STATE.currentPage - 1) * SYSTEM_CONFIG.PAGE_SIZE;
    const items = STATE.filteredData.slice(startIndex, startIndex + SYSTEM_CONFIG.PAGE_SIZE);

    items.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'border-b hover:bg-blue-50/40 transition-all';
        tr.innerHTML = `
            <td class="px-6 py-5 text-[10px] font-mono text-slate-400">${new Date(row.created_at).toLocaleString('ne-NP')}</td>
            <td class="px-2 py-5 text-center text-xl">${row.platform === 'whatsapp' ? '🟢' : '🔵'}</td>
            <td class="px-6 py-5">
                <div class="font-bold text-sm text-slate-800">${row.customer_name || 'New Lead'}</div>
                <div class="text-[10px] text-blue-600 font-black tracking-widest">${row.phone_number}</div>
            </td>
            <td class="px-6 py-5">
                <select class="w-full border rounded-xl p-2 text-xs font-bold bg-slate-50 outline-none" onchange="commitUpdate('${row.id}', {service: this.value}, 'सेवा फेरियो')">
                    <option value="PCC" ${row.service==='PCC'?'selected':''}>PCC Report</option>
                    <option value="NID" ${row.service==='NID'?'selected':''}>NID Card</option>
                    <option value="Passport" ${row.service==='Passport'?'selected':''}>Passport</option>
                    <option value="License" ${row.service==='License'?'selected':''}>License</option>
                    <option value="Other" ${row.service==='Other'?'selected':''}>Other</option>
                </select>
                <div class="mt-1">
                    <input type="text" 
                        class="w-full text-[9px] font-bold border-b border-dashed outline-none bg-transparent text-blue-600 placeholder:text-slate-300 uppercase" 
                        placeholder="विवरण (उदा: PAN)" 
                        value="${row.other_service_name || ''}"
                        onblur="commitUpdate('${row.id}', {other_service_name: this.value.toUpperCase()}, 'विवरण अपडेट भयो')">
                </div>
            </td>
            <td class="px-4 py-5">
                <div class="flex flex-col gap-2">
                    <button onclick="launchAIAutoFill('${row.id}', '${row.service}')" class="bg-orange-500 text-white text-[9px] font-black py-2 px-3 rounded-lg shadow-md hover:bg-orange-600 transition-all">🚀 AUTO-FORM</button>
                    <button onclick="window.open(isNaN('${row.sender_id}') ? 'https://m.me/${row.sender_id}' : 'https://wa.me/${row.sender_id}')" class="bg-blue-600 text-white text-[9px] font-black py-2 px-3 rounded-lg shadow-md hover:bg-blue-700 transition-all">💬 CRM CHAT</button>
                </div>
            </td>
            <td class="px-6 py-5">
                <select class="w-full text-[10px] font-black p-2 rounded-xl border-2" onchange="commitUpdate('${row.id}', {status: this.value}, 'Status Updated')" style="border-color: ${getStatusColor(row.status)}; color: ${getStatusColor(row.status)}">
                    <option value="inquiry" ${row.status==='inquiry'?'selected':''}>📩 INQUIRY</option>
                    <option value="pending" ${row.status==='pending'?'selected':''}>⏳ PENDING</option>
                    <option value="working" ${row.status==='working'?'selected':''}>🛠️ WORKING</option>
                    <option value="success" ${row.status==='success'?'selected':''}>✅ SUCCESS</option>
                    <option value="problem" ${row.status==='problem'?'selected':''}>❌ PROBLEM</option>
                </select>
            </td>
            <td class="px-6 py-5"><textarea class="w-full text-[10px] border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-400" placeholder="Note..." onblur="commitUpdate('${row.id}', {operator_instruction: this.value}, 'Note Saved')">${row.operator_instruction || ''}</textarea></td>
            <td class="px-6 py-5 text-center font-bold text-emerald-600">Rs. <input type="number" class="w-16 border-b-2 border-emerald-100 bg-transparent text-center font-black" value="${row.income || 0}" onblur="commitUpdate('${row.id}', {income: this.value}, 'पेमेन्ट सेभ भयो')"></td>
            <td class="px-4 py-5 text-center text-[9px] font-bold text-slate-400 uppercase">${row.last_updated_by || 'SYSTEM'}</td>
            <td class="px-6 py-5">${renderFileIcons(row.documents)}</td>
        `;
        tableBody.appendChild(tr);
    });
}

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

function refreshFinancialAnalytics() {
    const stats = STATE.allData.reduce((acc, curr) => {
        // Status लाई सधैँ सानो अक्षरमा तुलना गर्ने (inquiry, pending, success)
        const s = (curr.status || '').toLowerCase().trim();
        acc.counts[s] = (acc.counts[s] || 0) + 1;
        
        if (s === 'success') {
            acc.revenue += (parseFloat(curr.income) || 0);
        }
        return acc;
    }, { counts: {}, revenue: 0 });

    const updateUI = (id, val) => { if(document.getElementById(id)) document.getElementById(id).textContent = val; };
    
    updateUI('statIncome', `Rs. ${stats.revenue.toLocaleString()}`);
    updateUI('statSuccess', stats.counts['success'] || 0);
    updateUI('statPending', stats.counts['pending'] || 0);
    updateUI('statInquiry', stats.counts['inquiry'] || 0);
    updateUI('statWorking', stats.counts['working'] || 0);
    
    // Total Records पनि यहाँ थपिएको छ
    updateUI('totalRecords', STATE.allData.length);
}

function startRealtimeBridge() {

    supabaseClient.channel('any').on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (payload) => {

        if (payload.eventType === 'INSERT') {

            new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play();

            notify("नयाँ ग्राहक थपियो!", "success");

        }

        syncCoreDatabase();

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

            notify("Username वा Password मिलेन!", "error");

        }

    });

    document.getElementById('searchInput').addEventListener('input', () => applyLogicFilters());

    document.getElementById('logoutBtn').addEventListener('click', () => { sessionStorage.clear(); location.reload(); });

}