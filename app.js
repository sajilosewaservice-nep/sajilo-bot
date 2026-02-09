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

// १. PDF खोल्ने फङ्सन (यो नभई VIEW PDF बटनले काम गर्दैन)
function viewPDF(url) {
    if (!url) return;
    window.open(url, '_blank');
}

// --- 2. MULTIMEDIA ENGINE (Corrected & Stable) ---
function renderFileIcons(docs, id) {
    let docsArray = [];
    
    if (!docs || docs === '[]' || docs === '') {
        return '<span class="text-slate-300 italic text-[9px]">No Docs</span>';
    }

    try {
        docsArray = typeof docs === 'string' ? JSON.parse(docs) : docs;
        if (typeof docsArray === 'string') docsArray = JSON.parse(docsArray);
    } catch (e) {
        console.error("Parsing error:", e);
        docsArray = [];
    }

    if (!Array.isArray(docsArray) || docsArray.length === 0) {
        return '<span class="text-slate-300 italic text-[9px]">No Docs</span>';
    }

    const images = docsArray.map(item => {
        return (typeof item === 'object' && item !== null) ? item.url : item;
    }).filter(url => url && typeof url === 'string' && (
        url.match(/\.(jpg|jpeg|png|webp|gif|svg)/i) || 
        url.includes('fbcdn.net') || 
        url.includes('supabase.co/storage') ||
        url.includes('messenger.com')
    ));

    const pdfs = docsArray.map(item => (typeof item === 'object' && item !== null ? item.url : item))
        .filter(url => url && typeof url === 'string' && url.toLowerCase().includes('.pdf'));

    const audios = docsArray.map(item => (typeof item === 'object' && item !== null ? item.url : item))
        .filter(url => url && typeof url === 'string' && url.match(/\.(mp3|wav|ogg|m4a)/i));

let html = `<div style="display: flex; flex-wrap: nowrap; gap: 6px; align-items: center; justify-content: flex-start; background: #f8fafc; padding: 6px; border-radius: 10px; border: 1.5px dashed #cbd5e1; max-width: 140px; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none;">`;
    if (images.length > 0) {
        html += `
            <div class="relative cursor-pointer group" onclick="openGallery(${JSON.stringify(images).replace(/"/g, '&quot;')}, '${id}')">
                <img src="${images[0]}" class="w-10 h-10 rounded-lg border-2 border-white shadow-md object-cover group-hover:scale-110 transition-transform" 
                     onerror="this.src='https://cdn-icons-png.flaticon.com/512/3342/3342137.png'">
                ${images.length > 1 ? `<div class="absolute -top-2 -right-2 bg-blue-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-lg">+${images.length - 1}</div>` : ''}
            </div>`;
    }

    // २. PDF हरूलाई एउटै बाकस भित्र राख्ने
    if (pdfs.length > 0) {
        pdfs.forEach((url) => {
            html += `
                <a href="${url}" target="_blank" rel="noopener noreferrer" 
                    style="display: inline-flex; flex-direction: column; align-items: center; justify-content: center; width: 38px; height: 38px; background: white; border-radius: 8px; border: 1px solid #eee; text-decoration: none; margin: 2px;">
                    <i class="fas fa-file-pdf" style="color: #ef4444; font-size: 16px;"></i>
                    <span style="font-size: 6px; font-weight: 900; color: #ef4444; margin-top: 1px;">PDF</span>
                </a>`;
        });
    }

    // ३. अडियोलाई पनि एउटै साइजमा मिलाउने
    if (audios.length > 0) {
        audios.forEach((url) => {
            html += `
                <button onclick="new Audio('${url}').play()" 
                    style="display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; background: #ecfdf5; border-radius: 8px; border: 1px solid #10b981; cursor: pointer; margin: 2px;">
                    <i class="fas fa-play-circle" style="color: #10b981; font-size: 18px;"></i>
                </button>`;
        });
    }

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
        tr.className = 'border-b hover:bg-slate-50 transition-colors text-[10px]';
        
        tr.innerHTML = `
            <td class="p-4 font-mono text-slate-500">${new Date(row.created_at).toLocaleDateString('ne-NP')}</td>
            <td class="p-1 text-center">${row.platform === 'whatsapp' ? '🟢' : '🔵'}</td>
            <td class="p-4">
                <div class="font-black text-slate-800 text-[11px]">${row.customer_name || 'rt9736782'}</div>
                <div class="text-[10px] text-blue-600 font-bold">${row.phone_number || ''}</div>
            </td>
            
            <td class="p-4">
                <select class="w-full border rounded-lg p-1.5 font-black bg-white shadow-sm" onchange="commitUpdate('${row.id}', {service: this.value}, 'सेवा फेरियो')">
                    <option value="Passport" ${row.service==='Passport'?'selected':''}>Passport</option>
                    <option value="PCC" ${row.service==='PCC'?'selected':''}>PCC</option>
                    <option value="NID" ${row.service==='NID'?'selected':''}>NID</option>
                    <option value="License" ${row.service==='License'?'selected':''}>License</option>
                    <option value="PAN" ${row.service==='PAN'?'selected':''}>PAN</option>
                    <option value="Visa" ${row.service==='Visa'?'selected':''}>Visa</option>
                    <option value="Other" ${row.service==='Other'?'selected':''}>Other</option>
                </select>
                <input type="text" class="w-full text-[8px] border-b border-dotted mt-1 outline-none italic text-slate-400" 
                placeholder="More..." value="${row.other_service_name || ''}" 
                onblur="commitUpdate('${row.id}', {other_service_name: this.value.toUpperCase()}, 'Saved')">
            </td>

            <td class="p-4">
                <div class="flex flex-col gap-1.5">
                    <button onclick="launchAIAutoFill('${row.id}', '${row.service}')" class="bg-orange-600 text-white text-[9px] font-black py-1.5 px-3 rounded-lg shadow-md hover:bg-orange-700 transition">🚀 AUTO</button>
                    
                    <button onclick="handleChatClick('${row.phone_number}', '${row.platform}', '${row.sender_id}')" 
                        class="bg-blue-600 text-white text-[9px] font-black py-1.5 px-3 rounded-lg shadow-md hover:bg-blue-700 transition">
                        💬 CHAT
                    </button>
                </div>
            </td>
            <td class="p-4">
                <select class="w-full font-black p-1 rounded border-2 bg-white" onchange="commitUpdate('${row.id}', {status: this.value}, 'Status Updated')" style="border-color: ${getStatusColor(row.status)}; color: ${getStatusColor(row.status)}">
                    <option value="inquiry" ${row.status==='inquiry'?'selected':''}>📩 INQ</option>
                    <option value="pending" ${row.status==='pending'?'selected':''}>⏳ PND</option>
                    <option value="working" ${row.status==='working'?'selected':''}>🛠️ WRK</option>
                    <option value="success" ${row.status==='success'?'selected':''}>✅ SUC</option>
                    <option value="problem" ${row.status==='problem'?'selected':''}>❌ PRB</option>
                </select>
            </td>
            <td class="p-4">
                <textarea class="w-32 h-14 text-[9px] border rounded-xl p-2 bg-white resize-none" readonly>${row.chat_summary || ''}</textarea>
            </td>
            <td class="p-4">
                 <input type="text" class="w-full border-b-2 border-slate-100 bg-transparent text-[10px] font-bold text-slate-600 outline-none" 
                 placeholder="Add note..." value="${row.operator_instruction || ''}" 
                 onblur="commitUpdate('${row.id}', {operator_instruction: this.value}, 'Note Saved')">
            </td>
            <td class="p-4 text-center font-bold text-emerald-600">
                Rs.<input type="text" class="w-16 bg-transparent text-center border-b-2 border-dotted border-emerald-200 outline-none" 
                value="${row.income || 0}" placeholder="0/0" onblur="commitUpdate('${row.id}', {income: this.value}, 'Income Saved')">
            </td>
            <td class="p-4 text-center text-[10px] font-black text-slate-400 uppercase">${row.last_updated_by || 'ADMIN'}</td>
            <td class="p-4">${renderFileIcons(row.documents, row.id)}</td>
        `;
        tableBody.appendChild(tr);
    });
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

function openLargeNote(id, content) {
    const modalHtml = `
        <div id="noteModal" class="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[9999999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div class="bg-white w-full max-w-2xl rounded-[30px] shadow-2xl overflow-hidden border-4 border-slate-900 flex flex-col max-h-[85vh]">
                
                <div class="bg-slate-900 p-5 text-white flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <div class="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                        <h2 class="font-black italic text-sm tracking-widest uppercase">Titan AI Process Logs</h2>
                    </div>
                    <button onclick="document.getElementById('noteModal').remove()" class="text-3xl hover:text-red-500 transition-colors">&times;</button>
                </div>

                <div class="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-4 font-mono text-xs" id="modalScrollBody">
                    <div class="bg-blue-100 border-l-4 border-blue-600 p-4 rounded-r-xl text-blue-900 whitespace-pre-wrap leading-relaxed shadow-sm">
                        ${content || 'अहिलेसम्म कुनै लग रेकर्ड गरिएको छैन।'}
                    </div>
                </div>

                <div class="p-4 bg-white border-t border-slate-200 flex flex-col gap-3">
                    <textarea id="manualNoteInput" class="w-full border-2 border-slate-200 rounded-2xl p-3 text-xs outline-none focus:border-blue-500 h-20 resize-none" placeholder="यहाँ केही लेख्नुहोस् (उदा: ok)...">${content.replace(/<br>/g, '\n')}</textarea>
                    <div class="flex gap-2">
                        <button onclick="document.getElementById('noteModal').remove()" class="flex-1 py-3 font-black text-slate-400 uppercase text-[10px]">Close</button>
                        <button onclick="saveManualNote('${id}')" class="flex-[2] py-3 bg-slate-900 text-white rounded-xl font-black shadow-lg text-[10px] hover:bg-blue-700 transition-all">UPDATE NOTE / SEND OK</button>
                    </div>
                </div>
            </div>
        </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // सधैँ तल (Latest message) मा स्क्रोल गर्ने
    const body = document.getElementById('modalScrollBody');
    body.scrollTop = body.scrollHeight;
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