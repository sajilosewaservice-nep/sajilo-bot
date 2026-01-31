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
    // १. सुरुमै सेवा चेक गर्ने
    if (!service || service === 'Other') return notify("कृपया सेवा (PCC/NID) छान्नुहोस्!", "error");

    const customer = STATE.allData.find(c => c.id === id);
    
    // २. टिक लगाएका फोटोहरू मेमोरीबाट तान्ने
    const selectedKey = `selected_docs_${id}`;
    const selectedDocs = JSON.parse(localStorage.getItem(selectedKey) || "[]");
    
    // ३. यदि फोटो छानिएको छ भने छानिएका मात्र पठाउने, छैन भने सबै पठाउने
    const finalDocs = selectedDocs.length > 0 ? selectedDocs : customer.documents;

    const aiRules = localStorage.getItem('ai_rules') || "फारम बुद्धिमानीपूर्वक भर्नु।";
    notify(`${service} को लागि AI ले ${finalDocs.length} फोटो प्रयोग गर्दैछ...`, "success");

    try {
        const response = await fetch(`${SYSTEM_CONFIG.RPA_SERVER_URL}/start-automation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_data: { ...customer, documents: finalDocs }, 
                service_type: service,
                ai_instructions: aiRules,
                operator: STATE.currentUser.full_name
            })
        });

        // ४. सर्भर रेस्पोन्स चेक गर्ने (मैले थप्न लगाएको सही ठाउँ यही हो)
        if (!response.ok) {
            throw new Error("Server Error");
        }

        const result = await response.json();
        if (result.status === "ai_error") {
            notify("AI मा समस्या आयो, तर रोबोट खुल्दैछ!", "error");
        } else {
            notify("RPA र AI दुवै सक्रिय छन्!", "success");
        }

    } catch (err) {
        notify("पाइथन RPA सर्भर अफलाइन छ!", "error");
    }
}


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

// --- ४. ANALYTICS & SETTINGS ---

// १. रिपोर्ट सच्याइएको फङ्सन
function showFinancialReport() {
    const now = new Date();
    // हप्ता र महिनाको सुरुवाती समय सही निकाल्ने
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const stats = STATE.allData.reduce((acc, curr) => {
        const date = new Date(curr.created_at);
        const amt = parseFloat(curr.income) || 0;
        const status = (curr.status || '').toLowerCase();

        if (status === 'success') {
            acc.total += amt;
            if (date >= startOfWeek) acc.weekly += amt;
            if (date >= startOfMonth) acc.monthly += amt;
        }
        return acc;
    }, { total: 0, weekly: 0, monthly: 0 });

    const modalHtml = `
        <div id="reportModal" class="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[999999] p-4">
            <div class="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden border-4 border-slate-900">
                <div class="bg-slate-900 p-6 text-white text-center">
                    <h2 class="text-xl font-black italic">FINANCIAL REPORT</h2>
                </div>
                <div class="p-8 space-y-4">
                    <div class="flex justify-between p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-100">
                        <span class="text-xs font-black text-emerald-700">यो हप्ता:</span>
                        <span class="text-xl font-black text-emerald-800">Rs. ${stats.weekly.toLocaleString()}</span>
                    </div>
                    <div class="flex justify-between p-4 bg-blue-50 rounded-2xl border-2 border-blue-100">
                        <span class="text-xs font-black text-blue-700">यो महिना:</span>
                        <span class="text-xl font-black text-blue-800">Rs. ${stats.monthly.toLocaleString()}</span>
                    </div>
                    <div class="flex justify-between p-4 bg-slate-100 rounded-2xl">
                        <span class="text-xs font-black text-slate-600">कुल जम्मा:</span>
                        <span class="text-xl font-black text-slate-900">Rs. ${stats.total.toLocaleString()}</span>
                    </div>
                </div>
                <div class="p-6 bg-slate-50 border-t">
                    <button onclick="document.getElementById('reportModal').remove()" class="w-full py-4 bg-slate-900 text-white rounded-2xl font-black">बन्द गर्नुहोस्</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// २. सर्विस अनुसार रुल थप्न मिल्ने सेटिङ मोडाल
function toggleSettingsModal() {
    const rpaUrl = localStorage.getItem('rpa_url') || "http://localhost:5000";
    const masterRules = localStorage.getItem('ai_rules_master') || "सबै फारमको लागि साझा नियम...";
    const nidRules = localStorage.getItem('ai_rules_nid') || "";
    const pccRules = localStorage.getItem('ai_rules_pcc') || "";

    const modalHtml = `
        <div id="settingsModal" class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[999999] p-4">
            <div class="bg-white w-full max-w-2xl rounded-[30px] shadow-2xl overflow-hidden border-4 border-slate-900">
                <div class="bg-slate-900 p-5 text-white flex justify-between items-center">
                    <h2 class="font-black italic text-sm">TITAN AI CONTROL PANEL</h2>
                    <button onclick="document.getElementById('settingsModal').remove()" class="text-2xl">&times;</button>
                </div>
                
                <div class="p-6 space-y-6 max-h-[65vh] overflow-y-auto bg-slate-50">
                    <div>
                        <label class="block text-[10px] font-black text-slate-500 uppercase mb-2">🤖 RPA Server URL</label>
                        <input type="text" id="set_rpa_url" value="${rpaUrl}" class="w-full bg-white border-2 rounded-xl p-3 text-xs outline-none">
                    </div>
                    
                    <div class="space-y-4">
                        <h3 class="text-blue-600 font-black text-[11px] uppercase border-b pb-1">AI Master Rules (Instructions)</h3>
                        <div>
                            <label class="text-[9px] font-bold text-slate-400">MAIN MASTER RULES</label>
                            <textarea id="set_rules_master" rows="3" class="w-full border-2 rounded-xl p-3 text-xs outline-none focus:border-blue-500">${masterRules}</textarea>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="text-[9px] font-bold text-orange-500">NID SPECIFIC RULES</label>
                                <textarea id="set_rules_nid" rows="3" class="w-full border-2 rounded-xl p-3 text-xs outline-none focus:border-orange-500" placeholder="NID को लागि मात्र...">${nidRules}</textarea>
                            </div>
                            <div>
                                <label class="text-[9px] font-bold text-emerald-500">PCC SPECIFIC RULES</label>
                                <textarea id="set_rules_pcc" rows="3" class="w-full border-2 rounded-xl p-3 text-xs outline-none focus:border-emerald-500" placeholder="PCC को लागि मात्र...">${pccRules}</textarea>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="p-5 bg-white border-t flex gap-4">
                    <button onclick="document.getElementById('settingsModal').remove()" class="flex-1 py-4 font-black text-slate-400 uppercase text-xs">Cancel</button>
                    <button onclick="saveSettings()" class="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl hover:bg-blue-700 text-xs">SAVE ALL SETTINGS</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// ३. नयाँ सेटिङ सेभ गर्ने फङ्सन
function saveSettings() {
    localStorage.setItem('rpa_url', document.getElementById('set_rpa_url').value);
    localStorage.setItem('ai_rules_master', document.getElementById('set_rules_master').value);
    localStorage.setItem('ai_rules_nid', document.getElementById('set_rules_nid').value);
    localStorage.setItem('ai_rules_pcc', document.getElementById('set_rules_pcc').value);
    
    notify("सबै रुल र सेटिङ सेभ भयो!", "success");
    document.getElementById('settingsModal').remove();
    setTimeout(() => location.reload(), 500); // कन्फिगरेसन अपडेट गर्न रिलोड
}

// --- ४. SETTINGS & AI LOGIC (Final Merged Version) ---

function toggleSettingsModal() {
    const rpaUrl = localStorage.getItem('rpa_url') || "http://localhost:5000";
    const master = localStorage.getItem('ai_rules_master') || "";
    const nid = localStorage.getItem('ai_rules_nid') || "";
    const pcc = localStorage.getItem('ai_rules_pcc') || "";

    const modalHtml = `
        <div id="settingsModal" class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[999999] p-4">
            <div class="bg-white w-full max-w-2xl rounded-[30px] shadow-2xl overflow-hidden border-4 border-slate-900">
                <div class="bg-slate-900 p-5 text-white flex justify-between items-center">
                    <h2 class="font-black italic text-sm text-blue-400">TITAN AI CONTROL PANEL</h2>
                    <button onclick="document.getElementById('settingsModal').remove()" class="text-2xl">&times;</button>
                </div>
                <div class="p-6 space-y-4 max-h-[65vh] overflow-y-auto bg-slate-50">
                    <div>
                        <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">🤖 RPA Server URL</label>
                        <input type="text" id="set_rpa_url" value="${rpaUrl}" class="w-full border-2 rounded-xl p-3 text-xs outline-none focus:border-blue-500">
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="text-[9px] font-bold text-blue-600 uppercase">Master Rules (All Forms)</label>
                            <textarea id="set_rules_master" rows="3" class="w-full border-2 rounded-xl p-3 text-xs outline-none focus:border-blue-500">${master}</textarea>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="text-[9px] font-bold text-orange-500 uppercase">NID Rules</label>
                                <textarea id="set_rules_nid" rows="3" class="w-full border-2 rounded-xl p-3 text-xs outline-none focus:border-orange-500">${nid}</textarea>
                            </div>
                            <div>
                                <label class="text-[9px] font-bold text-emerald-500 uppercase">PCC Rules</label>
                                <textarea id="set_rules_pcc" rows="3" class="w-full border-2 rounded-xl p-3 text-xs outline-none focus:border-emerald-500">${pcc}</textarea>
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
    
    notify("सेटिङ सुरक्षित गरियो!", "success");
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
                    <button onclick="launchAIAutoFill('${row.id}', '${row.service}')" class="bg-orange-500 text-white text-[8px] font-black py-1 px-2 rounded">🚀 AUTO</button>
                    <button onclick="window.open(isNaN('${row.sender_id}') ? 'https://m.me/${row.sender_id}' : 'https://wa.me/${row.sender_id}')" class="bg-blue-600 text-white text-[8px] font-black py-1 px-2 rounded">💬 CHAT</button>
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
    <textarea 
        class="w-full text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-xl p-2 outline-none h-12 resize-none shadow-inner leading-tight" 
        placeholder="च्याट समरी यहाँ लेख्नुहोस्..."
        onblur="commitUpdate('${row.id}', {chat_summary: this.value}, 'Summary Saved')"
    >${row.chat_summary || ''}</textarea>
</td>
            <td class="p-2"><textarea class="w-full text-[9px] border rounded p-1 h-8 outline-none" onblur="commitUpdate('${row.id}', {operator_instruction: this.value}, 'Note Saved')">${row.operator_instruction || ''}</textarea></td>
            <td class="p-2 text-center font-bold text-emerald-600 text-[10px]">Rs.<input type="number" class="w-10 bg-transparent text-center font-black" value="${row.income || 0}" onblur="commitUpdate('${row.id}', {income: this.value}, 'Saved')"></td>
            <td class="p-2 text-center text-[8px] font-bold text-slate-400 uppercase">${row.last_updated_by || 'SYS'}</td>
            <td class="p-2">${renderFileIcons(row.documents, row.id)}</td>
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

    const updateUI = (id, val) => { 
    if(document.getElementById(id)) document.getElementById(id).textContent = val; 
};
    
updateUI('statIncome', `Rs. ${stats.revenue.toLocaleString()}`);
updateUI('statSuccess', stats.counts['success'] || 0);
updateUI('statPending', stats.counts['pending'] || 0);
updateUI('statInquiry', stats.counts['inquiry'] || 0);
updateUI('statWorking', stats.counts['working'] || 0);
// Problem को लागि यो लाइन थप्नुहोस् (यदि HTML मा statProblem ID छ भने)
updateUI('statProblem', stats.counts['problem'] || 0); 

updateUI('totalRecords', `TOTAL: ${STATE.allData.length} RECORDS`);
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
    const searchInput = document.getElementById('searchInput');
    const q = searchInput ? searchInput.value.toLowerCase() : '';
    
    // सुधार: यदि सर्च खाली छ भने सबै डाटा देखाउने, नत्र फिल्टर गर्ने
    if (!q) {
        STATE.filteredData = [...STATE.allData];
    } else {
        STATE.filteredData = STATE.allData.filter(d => 
            (d.customer_name || '').toLowerCase().includes(q) || 
            (d.phone_number || '').includes(q)
        );
    }

    if(reset) STATE.currentPage = 1;
    
    buildTableRows();
    updatePaginationUI(); // यो थप्नुहोस् ताकि पेज नम्बर अपडेट होस्
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
