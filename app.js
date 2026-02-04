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

// --- ३. MULTIMEDIA ENGINE (Voice, PDF, Gallery) ---

function renderFileIcons(docs, id) { // यहाँ id थपिएको छ
    if (!docs || docs.length === 0) return '<span class="text-slate-300 italic text-[9px]">No Docs</span>';

    const images = docs.filter(url => url.match(/\.(jpg|jpeg|png|webp|gif)/i));
    const audios = docs.filter(url => url.match(/\.(mp3|wav|ogg|m4a)/i));
    const pdfs = docs.filter(url => url.match(/\.(pdf)/i));

    let html = `<div class="flex flex-wrap gap-2 items-center justify-center">`;

    if (images.length > 0) {
        // यहाँ '${id}' मात्र लेख्दा पुग्छ किनकि हामीले माथि id पास गरेका छौँ
        html += `
            <div class="relative cursor-pointer group" onclick="openGallery(${JSON.stringify(images).replace(/"/g, '&quot;')}, '${id}')">
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

// यो सानो फङ्सन पनि कतै खाली ठाउँमा टाँसिदिनुहोस्, जसले टिक लगाएको याद राख्छ
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
    if (!STATE.allData || STATE.allData.length === 0) {
        notify("डाटा लोड हुँदैछ, कृपया एकछिन पर्खिनुहोस्!", "error");
        return;
    }

    const now = new Date();
    // स्थानीय मिति निकाल्ने सहि तरिका
    const todayStr = now.toLocaleDateString('en-CA'); 

    // हप्ताको सुरु
    const startOfWeekDate = new Date(now);
    startOfWeekDate.setDate(now.getDate() - now.getDay());
    const startOfWeek = startOfWeekDate.toLocaleDateString('en-CA');

    // महिनाको सुरु
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');

    const stats = STATE.allData.reduce((acc, curr) => {
        const status = (curr.status || '').toLowerCase().trim();
        
        if (status === 'success') {
            const fullDate = curr.created_at || "";
            const date = fullDate.split('T')[0]; 
            
            if (!date) return acc;

            const incomeValue = curr.income || "0/0";
            const parts = incomeValue.toString().split('/');
            const income = parseFloat(parts[0]) || 0;
            const invest = parseFloat(parts[1]) || 0;

            acc.total_in += income;
            acc.total_inv += invest;

            if (date === todayStr) { 
                acc.daily_in += income; 
                acc.daily_inv += invest; 
            }
            if (date >= startOfWeek) { 
                acc.weekly_in += income; 
                acc.weekly_inv += invest; 
            }
            if (date >= startOfMonth) { 
                acc.monthly_in += income; 
                acc.monthly_inv += invest; 
            }
        }
        return acc;
    }, { 
        total_in: 0, total_inv: 0, 
        daily_in: 0, daily_inv: 0, 
        weekly_in: 0, weekly_inv: 0, 
        monthly_in: 0, monthly_inv: 0 
    });

    // यहाँ पछि तपाईँको modalHtml सुरु हुन्छ... (जुन तपाईँसँग पहिले नै छ)
    const modalHtml = `
        <div id="reportModal" class="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-center z-[999999] p-4">
            <div class="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden border-4 border-slate-900">
                <div class="bg-slate-900 p-6 text-white flex justify-between items-center">
                    <div>
                        <h2 class="text-xl font-black italic text-blue-400">FINANCIAL ANALYTICS</h2>
                        <p class="text-[10px] text-emerald-400 font-bold uppercase">Real-time Income Update</p>
                    </div>
                    <button onclick="document.getElementById('reportModal').remove()" class="text-white hover:text-red-500 text-3xl">&times;</button>
                </div>
                
                <div class="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="p-4 bg-orange-50 rounded-3xl border-2 border-orange-100">
                        <span class="text-[10px] font-black text-orange-600 uppercase">Daily (आज)</span>
                        <div class="text-lg font-black text-slate-900">Rs. ${stats.daily_in}</div>
                        <div class="text-[9px] font-bold text-red-500">Invest: Rs. ${stats.daily_inv}</div>
                    </div>
                    <div class="p-4 bg-blue-50 rounded-3xl border-2 border-blue-100">
                        <span class="text-[10px] font-black text-blue-600 uppercase">Weekly (हप्ता)</span>
                        <div class="text-lg font-black text-slate-900">Rs. ${stats.weekly_in}</div>
                        <div class="text-[9px] font-bold text-red-500">Invest: Rs. ${stats.weekly_inv}</div>
                    </div>
                    <div class="p-4 bg-emerald-50 rounded-3xl border-2 border-emerald-100">
                        <span class="text-[10px] font-black text-emerald-600 uppercase">Monthly (महिना)</span>
                        <div class="text-lg font-black text-slate-900">Rs. ${stats.monthly_in}</div>
                        <div class="text-[9px] font-bold text-red-500">Invest: Rs. ${stats.monthly_inv}</div>
                    </div>
                </div>

                <div class="px-6 pb-6">
                    <div class="bg-slate-900 text-white p-6 rounded-[30px] flex justify-between items-center shadow-xl">
                        <div>
                            <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Net Profit</p>
                            <p class="text-3xl font-black text-emerald-400">Rs. ${stats.total_in - stats.total_inv}</p>
                        </div>
                        <div class="text-right border-l border-slate-700 pl-6">
                            <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Investment</p>
                            <p class="text-xl font-black text-red-400">Rs. ${stats.total_inv}</p>
                        </div>
                    </div>
                </div>

                <div class="p-4 bg-slate-50 border-t flex gap-2">
                    <button onclick="document.getElementById('reportModal').remove()" class="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs">बन्द गर्नुहोस्</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// --- ४. SETTINGS & AI LOGIC (Final Merged Version) ---

function toggleSettingsModal() {
    const rpaUrl = localStorage.getItem('rpa_url') || "http://localhost:5000";
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
                            <label class="text-[9px] font-bold text-blue-600 uppercase">Master Rules (सबैमा लागु हुने साझा नियम)</label>
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
    const specific = localStorage.getItem(`ai_rules_${service.toLowerCase()}`) || "";
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

/**
 * TITAN AI - Professional Dashboard Core System
 */

// १. Status Color Logic
function getStatusColor(status) {
    const s = (status || '').toLowerCase().trim();
    const colors = {
        inquiry: '#64748b', pending: '#f59e0b',
        working: '#3b82f6', success: '#10b981', problem: '#ef4444'
    };
    return colors[s] || '#cbd5e1';
}

// २. Table Builder (with scrolling fix)
function buildTableRows() {
    const tableBody = document.getElementById('tableBody');
    if(!tableBody) return;
    tableBody.innerHTML = '';
    
    const startIndex = (STATE.currentPage - 1) * SYSTEM_CONFIG.PAGE_SIZE;
    const items = STATE.filteredData.slice(startIndex, startIndex + SYSTEM_CONFIG.PAGE_SIZE);

    items.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'border-b hover:bg-slate-50 transition-colors';
        
        tr.innerHTML = `
            <td class="p-2 text-[10px] font-mono text-slate-500">${new Date(row.created_at).toLocaleDateString('ne-NP')}</td>
            <td class="p-1 text-center">${row.platform === 'whatsapp' ? '🟢' : '🔵'}</td>
            <td class="p-2">
                <div class="font-bold text-[11px] truncate max-w-[100px]">${row.customer_name || 'New Lead'}</div>
                <div class="text-[9px] text-blue-600 font-bold">${row.phone_number}</div>
            </td>
            <td class="p-2">
                <select class="w-full border p-1 rounded text-[10px] font-bold" onchange="commitUpdate('${row.id}', {service: this.value}, 'सेवा फेरियो')">
                    <option value="PCC" ${row.service==='PCC'?'selected':''}>PCC</option>
                    <option value="NID" ${row.service==='NID'?'selected':''}>NID</option>
                    <option value="Passport" ${row.service==='Passport'?'selected':''}>Passport</option>
                    <option value="License" ${row.service==='License'?'selected':''}>License</option>
                    <option value="PAN" ${row.service==='PAN'?'selected':''}>PAN</option>
                    <option value="Other" ${row.service==='Other'?'selected':''}>Other</option>
                </select>
                <input type="text" class="w-full text-[9px] border-b border-dotted outline-none mt-1" placeholder="More..." value="${row.other_service_name || ''}" onblur="commitUpdate('${row.id}', {other_service_name: this.value.toUpperCase()}, 'Saved')">
            </td>
            <td class="p-2">
                <div class="flex flex-col gap-1">
                    <button onclick="launchAIAutoFill('${row.id}', '${row.service}')" class="bg-orange-500 text-white text-[8px] font-black py-1 px-2 rounded hover:scale-105 transition-transform">🚀 AUTO</button>
                    <button onclick="window.open(isNaN('${row.sender_id}') ? 'https://m.me/${row.sender_id}' : 'https://wa.me/${row.sender_id}')" class="bg-blue-600 text-white text-[8px] font-black py-1 px-2 rounded hover:scale-105 transition-transform">💬 CHAT</button>
                </div>
            </td>
            <td class="p-2">
                <select class="w-full text-[9px] font-black p-1 rounded border-2" onchange="commitUpdate('${row.id}', {status: this.value}, 'Status Updated')" style="border-color: ${getStatusColor(row.status)}; color: ${getStatusColor(row.status)}">
                    <option value="inquiry" ${row.status==='inquiry'?'selected':''}>📩 INQ</option>
                    <option value="pending" ${row.status==='pending'?'selected':''}>⏳ PND</option>
                    <option value="working" ${row.status==='working'?'selected':''}>🛠️ WRK</option>
                    <option value="success" ${row.status==='success'?'selected':''}>✅ SUC</option>
                    <option value="problem" ${row.status==='problem'?'selected':''}>❌ PRB</option>
                </select>
            </td>
            <td class="p-2">
                <textarea class="w-full text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-xl p-2 outline-none h-12 resize-none shadow-inner leading-tight" 
                    placeholder="Summary..." onblur="commitUpdate('${row.id}', {chat_summary: this.value}, 'Summary Saved')">${row.chat_summary || ''}</textarea>
            </td>
            <td class="p-2">
                <div onclick="openLargeNote('${row.id}', \`${(row.operator_instruction || '').replace(/`/g, '\\`').replace(/\n/g, '<br>')}\`)"
                    class="w-full text-[9px] border rounded-lg p-2 h-12 overflow-hidden cursor-pointer bg-white hover:bg-blue-50 transition-all shadow-sm">
                    <div class="font-black text-blue-500 mb-1">📋 AI LOGS:</div>
                    <div class="line-clamp-2 text-slate-600">${row.operator_instruction || 'Click to view...'}</div>
                </div>
            </td>
            <td class="p-2 text-center">
                <div class="relative w-full min-w-[90px]">
                    <span class="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] font-black text-emerald-500">Rs.</span>
                    <input type="text" class="w-full bg-slate-50 border-2 border-slate-200 rounded-lg py-1 pl-5 text-center font-black text-slate-800 outline-none focus:border-blue-500" 
                        value="${row.income || '0/0'}" onblur="commitUpdate('${row.id}', {income: this.value}, 'Saved')">
                </div>
            </td>
            <td class="p-2 text-center text-[8px] font-bold text-slate-400 uppercase">${row.last_updated_by || 'SYS'}</td>
            <td class="p-2">${renderFileIcons(row.documents, row.id)}</td>
        `;
        tableBody.appendChild(tr);
    });
}

// ३. Financial Analytics Fix
function refreshFinancialAnalytics() {
    const stats = STATE.allData.reduce((acc, curr) => {
        const s = (curr.status || '').toLowerCase().trim();
        acc.counts[s] = (acc.counts[s] || 0) + 1;
        
        if (s === 'success') {
            const incomePart = (curr.income || "0/0").split('/')[0];
            acc.revenue += (parseFloat(incomePart) || 0);
        }
        return acc;
    }, { counts: {}, revenue: 0 });

    const updateUI = (id, val) => { if(document.getElementById(id)) document.getElementById(id).textContent = val; };
    
    updateUI('statIncome', `Rs. ${stats.revenue.toLocaleString()}`);
    updateUI('statSuccess', stats.counts['success'] || 0);
    updateUI('statPending', stats.counts['pending'] || 0);
    updateUI('statInquiry', stats.counts['inquiry'] || 0);
    updateUI('statWorking', stats.counts['working'] || 0);
    updateUI('statProblem', stats.counts['problem'] || 0); 
    updateUI('totalRecords', `TOTAL: ${STATE.allData.length} RECORDS`);
}

// ४. Database & Sync Functions
async function syncCoreDatabase() {
    const { data, error } = await supabaseClient.from('customers').select('*').order('created_at', { ascending: false });
    if (!error) {
        STATE.allData = data;
        applyLogicFilters(false);
        refreshFinancialAnalytics();
    }
}

async function commitUpdate(id, updates, msg) {
    const payload = { ...updates, last_updated_by: STATE.currentUser.full_name, updated_at: new Date().toISOString() };
    await supabaseClient.from('customers').update(payload).eq('id', id);
    notify(msg, "success");
    syncCoreDatabase();
}

// ५. Pagination & Filters
function applyLogicFilters(reset = true) {
    const q = document.getElementById('searchInput')?.value.toLowerCase() || '';
    STATE.filteredData = q ? STATE.allData.filter(d => 
        (d.customer_name || '').toLowerCase().includes(q) || (d.phone_number || '').includes(q)
    ) : [...STATE.allData];

    if(reset) STATE.currentPage = 1;
    buildTableRows();
    updatePaginationUI();
}

function changePage(direction) {
    const maxPage = Math.ceil(STATE.filteredData.length / SYSTEM_CONFIG.PAGE_SIZE) || 1;
    if (direction === 'next' && STATE.currentPage < maxPage) STATE.currentPage++;
    else if (direction === 'prev' && STATE.currentPage > 1) STATE.currentPage--;
    else return;
    buildTableRows();
    updatePaginationUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updatePaginationUI() {
    const el = document.getElementById('pageInfo');
    const max = Math.ceil(STATE.filteredData.length / SYSTEM_CONFIG.PAGE_SIZE) || 1;
    if(el) el.innerHTML = `PAGE <span style="color: #2563eb; font-weight: 900;">${STATE.currentPage}</span> / ${max}`;
}

// ६. Modal System
function openLargeNote(id, content) {
    const modalHtml = `
        <div id="noteModal" class="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[999999] flex items-center justify-center p-4">
            <div class="bg-white w-full max-w-2xl rounded-[30px] shadow-2xl overflow-hidden border-4 border-slate-900 flex flex-col max-h-[85vh]">
                <div class="bg-slate-900 p-5 text-white flex justify-between items-center">
                    <h2 class="font-black italic text-sm uppercase">Titan AI Process Logs</h2>
                    <button onclick="document.getElementById('noteModal').remove()" class="text-2xl">&times;</button>
                </div>
                <div class="p-6 overflow-y-auto flex-1 bg-slate-50 font-mono text-xs" id="modalScrollBody">
                    <div class="bg-blue-100 border-l-4 border-blue-600 p-4 rounded-r-xl text-blue-900 whitespace-pre-wrap">${content || 'नो लग।'}</div>
                </div>
                <div class="p-4 bg-white border-t flex flex-col gap-3">
                    <textarea id="manualNoteInput" class="w-full border rounded-xl p-3 text-xs h-20">${content.replace(/<br>/g, '\n')}</textarea>
                    <div class="flex gap-2">
                        <button onclick="document.getElementById('noteModal').remove()" class="flex-1 py-2 font-bold text-slate-400">CLOSE</button>
                        <button onclick="saveManualNote('${id}')" class="flex-[2] py-2 bg-slate-900 text-white rounded-xl font-bold">UPDATE NOTE</button>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('modalScrollBody').scrollTop = 9999;
}

async function saveManualNote(id) {
    const val = document.getElementById('manualNoteInput').value;
    await commitUpdate(id, { operator_instruction: val }, "Note Updated!");
    document.getElementById('noteModal').remove();
}

// ७. Auth & Interface
async function loadDashboardInterface() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.remove('hidden');
    if(document.getElementById('userDisplay')) document.getElementById('userDisplay').textContent = `OP: ${STATE.currentUser.full_name}`;
    
    const btnContainer = document.getElementById('reportBtnContainer');
    if(btnContainer) btnContainer.innerHTML = `<button onclick="showFinancialReport()" class="bg-emerald-600 text-white px-6 py-2 rounded-2xl font-black text-[11px] uppercase">📊 Analytics Report</button>`;
    
    await syncCoreDatabase();
    startRealtimeBridge();
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

function registerGlobalEvents() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                const { data: profile } = await supabaseClient.from('profiles').select('full_name').eq('id', data.user.id).single();
                STATE.currentUser = { ...data.user, full_name: profile?.full_name || 'Admin' };
                sessionStorage.setItem('titan_user', JSON.stringify(STATE.currentUser));
                notify("सफलतापूर्वक लगइन भयो!", "success");
                loadDashboardInterface();
            } catch (err) { notify("Error: " + err.message, "error"); }
        };
    }
    document.getElementById('searchInput')?.addEventListener('input', () => applyLogicFilters(true));
}

function notify(msg, type) {
    const n = document.createElement('div');
    n.className = `fixed bottom-10 left-1/2 -translate-x-1/2 px-10 py-4 rounded-3xl text-white font-black z-[1000000] shadow-2xl animate-bounce ${type==='success'?'bg-slate-900 border-2 border-emerald-500':'bg-red-600'}`;
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

function logout() { sessionStorage.removeItem('titan_user'); location.reload(); }