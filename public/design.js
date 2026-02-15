export const SYSTEM_CONFIG = {
    SUPABASE_URL: window.ENV.SUPABASE_URL,
    SUPABASE_KEY: window.ENV.SUPABASE_ANON_KEY,
    RPA_SERVER_URL: localStorage.getItem('rpa_url') || "http://localhost:5000",
    PAGE_SIZE: 15
};

export let STATE = {
    currentUser: null,
    allData: [],
    filteredData: [],
    currentPage: 1,
    isLoading: false
};

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
                    <option value="Passport" ${row.service==='Passport'?'selected':'}>Passport</option>
                    <option value="PCC" ${row.service==='PCC'?'selected':'}>PCC</option>
                    <option value="NID" ${row.service==='NID'?'selected':'}>NID</option>
                    <option value="License" ${row.service==='License'?'selected':'}>License</option>
                    <option value="PAN" ${row.service==='PAN'?'selected':'}>PAN</option>
                    <option value="Visa" ${row.service==='Visa'?'selected':'}>Visa</option>
                    <option value="Other" ${row.service==='Other'?'selected':'}>Other</option>
                </select>
                <input type="text" class="w-full text-[8px] border-b border-dotted mt-1 outline-none italic text-slate-400" 
                placeholder="More..." value="${row.other_service_name || ''}" 
                onblur="commitUpdate('${row.id}', {other_service_name: this.value.toUpperCase()}, 'Saved')">
            </td>
            <td class="p-4">
                <div class="flex flex-col gap-1.5">
                    <button onclick="launchAIAutoFill('${row.id}', '${row.service}')" class="bg-orange-600 text-white text-[9px] font-black py-1.5 px-3 rounded-lg shadow-md hover:bg-orange-700 transition">🚀 AUTO</button>
                    <button onclick="handleChatClick('${row.phone_number}', '${row.platform}', '${row.sender_id}')" 
                        class="bg-blue-600 text-white text-[9px] font-black py-1.5 px-3 rounded-lg shadow-md hover:bg-blue-700 transition">💬 CHAT</button>
                </div>
            </td>
            <td class="p-4">
                <select class="w-full font-black p-1 rounded border-2 bg-white" onchange="commitUpdate('${row.id}', {status: this.value}, 'Status Updated')" style="border-color: ${getStatusColor(row.status)}; color: ${getStatusColor(row.status)}">
                    <option value="inquiry" ${row.status==='inquiry'?'selected':'}>📩 INQ</option>
                    <option value="pending" ${row.status==='pending'?'selected':'}>⏳ PND</option>
                    <option value="working" ${row.status==='working'?'selected':'}>🛠️ WRK</option>
                    <option value="success" ${row.status==='success'?'selected':'}>✅ SUC</option>
                    <option value="problem" ${row.status==='problem'?'selected':'}>❌ PRB</option>
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
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
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

function toggleSettingsModal() {
    const rpaUrl = localStorage.getItem('rpa_url') || "http://localhost:5000";
    const master = localStorage.getItem('ai_rules_master') || "";
    const nid = localStorage.getItem('ai_rules_nid') || "";
    const pcc = localStorage.getItem('ai_rules_pcc') || "";
    const passport = localStorage.getItem('ai_rules_passport') || "";
    const license = localStorage.getItem('ai_rules_license') || "";
    const pan = localStorage.getItem('ai_rules_pan') || "";

    const modalHtml = `
        <div id="settingsModal" class="fixed inset-0 bg-black/80 backdrop-blur-md flex items center justify-center z-[999999] p-4">
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

function openLargeNote(id, content) {
    const safeContent = content || '';
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
                        ${safeContent || 'अहिलेसम्म कुनै लग रेकर्ड गरिएको छैन।'}
                    </div>
                </div>
                <div class="p-4 bg-white border-t border-slate-200 flex flex-col gap-3">
                    <textarea id="manualNoteInput" class="w-full border-2 border-slate-200 rounded-2xl p-3 text-xs outline-none focus:border-blue-500 h-20 resize-none" placeholder="यहाँ केही लेख्नुहोस् (उदा: ok)...">${safeContent.replace(/<br>/g, '\n')}</textarea>
                    <div class="flex gap-2">
                        <button onclick="document.getElementById('noteModal').remove()" class="flex-1 py-3 font-black text-slate-400 uppercase text-[10px]">Close</button>
                        <button onclick="saveManualNote('${id}')" class="flex-[2] py-3 bg-slate-900 text-white rounded-xl font-black shadow-lg text-[10px] hover:bg-blue-700 transition-all">UPDATE NOTE / SEND OK</button>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const body = document.getElementById('modalScrollBody');
    if (body) body.scrollTop = body.scrollHeight;
}

export { 
    renderFileIcons, 
    buildTableRows, 
    openGallery, 
    showFinancialReport, 
    toggleSettingsModal, 
    openLargeNote,
    togglePhotoSelection
};

