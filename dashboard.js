/**
 * ==========================================================================================
 * TITAN ENTERPRISE CRM v4.2.0 - ULTIMATE NEURAL ENGINE
 * ==========================================================================================
 * System Structure:
 * 1. Configuration & Constants Matrix
 * 2. Master State Management (Global Store)
 * 3. Supabase Neural Connectivity (Real-time Custom Engine)
 * 4. Data Access Layer (CRUD Operations)
 * 5. Advanced UI Orchestrator (DOM Manipulation)
 * 6. Analytics & Chart Engine (Chart.js Integration)
 * 7. RPA Modal Controller (Form Filler UI)
 * 8. WhatsApp / Messenger Custom Messaging Engine
 * ==========================================================================================
 */

const TITAN_CONFIG = {
    // Hybrid Connectivity: Try Vite Env first, fallback to hardcoded for safety
    URL: import.meta.env?.VITE_SUPABASE_URL || "https://ratgpvubjrcoipardzdp.supabase.co",
    KEY: import.meta.env?.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhdGdwdnVianJjb2lwYXJkemRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTg0OTMsImV4cCI6MjA4Mzg5NDQ5M30.t1eofJj9dPK-Psp_oL3LpCWimyz621T21JNpZljEGZk",
    TABLE_CUSTOMERS: 'customers',
    TABLE_STAFF: 'staff',
    VERSION: '4.2.0-ULTIMATE',
    POLLING_RATE: 30000, // For fallback background sync
};

(function() {
    "use strict";

    /**
     * ==========================================
     * 1. MASTER STATE MANAGEMENT (GLOBAL STORE)
     * ==========================================
     */
    const STATE = {
        data: {
            raw: [],
            filtered: []
        },
        analytics: {
            income: 0, inquiry: 0, pending: 0, working: 0, success: 0, problem: 0,
            weeklyTrend: [0,0,0,0,0,0,0] // For Chart.js
        },
        ui: {
            activePlatform: 'all',
            searchTerm: '',
            isSyncing: false,
            selectedCustomerId: null
        },
        system: {
            isDatabaseConnected: false,
            chartInstance: null
        }
    };

    /**
     * ==========================================
     * 2. CORE ENGINE INITIALIZER
     * ==========================================
     */
    const TitanEngine = {
        async init() {
            try {
                UI.notify("System Initializing...", "info");
                this.setupSupabase();
                
                if (this.client) {
                    STATE.system.isDatabaseConnected = true;
                    await this.performCloudSync();
                    this.initRealtimeWebSocket();
                    UI.notify("Neural Network Connected", "success");
                }
            } catch (err) {
                console.error("❌ CRITICAL BOOT ERROR:", err);
                UI.notify("System Boot Failure. Check Logs.", "error");
            }
        },

        setupSupabase() {
            if (!TITAN_CONFIG.URL || !TITAN_CONFIG.KEY) {
                console.error("Missing Supabase Credentials");
                return;
            }
            // Expose client globally for inline HTML calls
            this.client = window.supabase.createClient(TITAN_CONFIG.URL, TITAN_CONFIG.KEY);
            window.TitanClient = this.client;
        },

        /**
         * Initializes Real-Time Custom Messaging listener.
         * We use custom code for real-time messaging updates rather than polling/scraping.
         */
        initRealtimeWebSocket() {
            console.log("🔗 Establishing Real-time Custom Socket...");
            this.client
                .channel('titan-realtime-engine')
                .on('postgres_changes', { event: '*', schema: 'public', table: TITAN_CONFIG.TABLE_CUSTOMERS }, payload => {
                    this.handleRealtimePayload(payload);
                })
                .subscribe((status) => {
                    if(status === 'SUBSCRIBED') console.log("✅ Real-time Socket Subscribed");
                });
        },

        handleRealtimePayload(payload) {
            console.log("⚡ Real-time Custom Event Triggered:", payload.eventType);
            Utils.playNotificationSound();
            
            // Re-fetch logic to ensure data integrity
            this.performCloudSync().then(() => {
                UI.notify(`Live Update Received: ${payload.new?.customer_name || 'System'}`, "info");
            });
        },

        async performCloudSync() {
            if(STATE.ui.isSyncing) return;
            STATE.ui.isSyncing = true;
            UI.toggleSyncButton(true);

            try {
                await DataLayer.fetchAllCustomers();
                AnalyticsLayer.computeAll();
                UI.renderDashboard();
            } catch(e) {
                console.error("Sync Failed", e);
                UI.notify("Cloud Sync Failed", "error");
            } finally {
                STATE.ui.isSyncing = false;
                UI.toggleSyncButton(false);
            }
        }
    };

    /**
     * ==========================================
     * 3. DATA ACCESS LAYER (CRUD OPERATIONS)
     * ==========================================
     */
    const DataLayer = {
        async fetchAllCustomers() {
            const { data, error } = await TitanEngine.client
                .from(TITAN_CONFIG.TABLE_CUSTOMERS)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            STATE.data.raw = data || [];
            this.applyFilters();
        },

        applyFilters() {
            const term = STATE.ui.searchTerm.toLowerCase();
            const platform = STATE.ui.activePlatform;

            STATE.data.filtered = STATE.data.raw.filter(c => {
                const matchSearch = (c.customer_name?.toLowerCase().includes(term) || 
                                     c.phone_number?.includes(term) || 
                                     c.id.includes(term));
                const matchPlatform = platform === 'all' || c.platform === platform;
                return matchSearch && matchPlatform;
            });
        },

        async updateCustomerField(id, field, value) {
            const payload = {};
            payload[field] = value;
            payload['updated_at'] = new Date().toISOString();

            const { error } = await TitanEngine.client
                .from(TITAN_CONFIG.TABLE_CUSTOMERS)
                .update(payload)
                .eq('id', id);

            if (error) {
                UI.notify(`Failed to update ${field}`, "error");
                return false;
            }
            UI.notify(`Data synchronized successfully`, "success");
            return true;
        }
    };

    /**
     * ==========================================
     * 4. ANALYTICS & CHART CONTROLLER
     * ==========================================
     */
    const AnalyticsLayer = {
        computeAll() {
            // Reset Stats
            STATE.analytics = { income: 0, inquiry: 0, pending: 0, working: 0, success: 0, problem: 0, weeklyTrend: [0,0,0,0,0,0,0] };

            STATE.data.raw.forEach(customer => {
                // Compute Revenue
                if (customer.status === 'success') {
                    STATE.analytics.income += parseFloat(customer.income || 0);
                    STATE.analytics.success++;
                } else if (customer.status === 'inquiry') STATE.analytics.inquiry++;
                else if (customer.status === 'pending') STATE.analytics.pending++;
                else if (customer.status === 'working') STATE.analytics.working++;
                else if (customer.status === 'problem') STATE.analytics.problem++;

                // Simulate weekly trend for Chart
                const dayIndex = new Date(customer.created_at).getDay(); // 0 (Sun) to 6 (Sat)
                STATE.analytics.weeklyTrend[dayIndex] += 1;
            });
        },

        renderChart() {
            const ctx = document.getElementById('analyticsChart')?.getContext('2d');
            if (!ctx) return;

            // Destroy old chart instance if exists
            if (STATE.system.chartInstance) {
                STATE.system.chartInstance.destroy();
            }

            // Requires Chart.js included in HTML
            if(typeof Chart !== 'undefined') {
                STATE.system.chartInstance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                        datasets: [{
                            label: 'Customer Volume',
                            data: STATE.analytics.weeklyTrend,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 5,
                            pointBackgroundColor: '#10b981',
                            borderWidth: 3
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
                            x: { grid: { display: false }, ticks: { color: '#64748b' } }
                        }
                    }
                });
            }
        }
    };

    /**
     * ==========================================
     * 5. UI ORCHESTRATOR (DOM MANIPULATION)
     * ==========================================
     */
    const UI = {
        renderDashboard() {
            this.renderStats();
            this.renderTable();
            AnalyticsLayer.renderChart();
        },

        renderStats() {
            document.getElementById('statIncome').innerText = `Rs. ${STATE.analytics.income.toLocaleString()}`;
            document.getElementById('statInquiry').innerText = STATE.analytics.inquiry;
            document.getElementById('statPending').innerText = STATE.analytics.pending;
            document.getElementById('statWorking').innerText = STATE.analytics.working;
            document.getElementById('statSuccess').innerText = STATE.analytics.success;
            document.getElementById('statProblem').innerText = STATE.analytics.problem;
        },

        renderTable() {
            const tbody = document.getElementById('tableBody');
            if (!tbody) return;

            if (STATE.data.filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-slate-500 font-bold uppercase tracking-widest text-xs">No Records Found in Database</td></tr>`;
                return;
            }

            tbody.innerHTML = STATE.data.filtered.map(c => this.generateRowHTML(c)).join('');
        },

        generateRowHTML(c) {
            const platformUI = c.platform === 'whatsapp' 
                ? `<span class="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded border border-emerald-500/20 text-[9px] font-bold"><i class="fab fa-whatsapp mr-1"></i> WA</span>` 
                : `<span class="bg-blue-500/10 text-blue-500 px-3 py-1 rounded border border-blue-500/20 text-[9px] font-bold"><i class="fab fa-facebook-messenger mr-1"></i> MSG</span>`;

            const statColors = {
                inquiry: 'text-cyan-400 border-cyan-400/30',
                pending: 'text-amber-400 border-amber-400/30',
                working: 'text-purple-400 border-purple-400/30',
                success: 'text-emerald-400 border-emerald-400/30',
                problem: 'text-red-400 border-red-400/30'
            };

            return `
                <tr class="hover:bg-blue-500/5 transition-all group">
                    <td class="px-8 py-5">
                        <div class="text-[10px] text-slate-300 font-bold">${Utils.formatDate(c.created_at)}</div>
                        <div class="text-[9px] font-mono text-slate-500 mt-1 uppercase">#${c.id.slice(0,8)}</div>
                    </td>
                    <td class="px-8 py-5">${platformUI}</td>
                    <td class="px-8 py-5">
                        <div class="font-black text-white text-xs">${c.customer_name || 'Walk-in Client'}</div>
                        <div class="text-[10px] text-slate-400 mt-1"><i class="fas fa-phone mr-1"></i> ${c.phone_number || 'No Number'}</div>
                    </td>
                    <td class="px-8 py-5">
                        <select onchange="window.TitanEngine.updateStatus('${c.id}', this.value)" 
                                class="bg-[#0f172a] text-[9px] font-black uppercase border rounded-lg p-2 outline-none cursor-pointer w-full ${statColors[c.status] || 'text-slate-400 border-slate-600'}">
                            <option value="inquiry" ${c.status === 'inquiry' ? 'selected' : ''}>Inquiry</option>
                            <option value="pending" ${c.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="working" ${c.status === 'working' ? 'selected' : ''}>Working</option>
                            <option value="success" ${c.status === 'success' ? 'selected' : ''}>Success</option>
                            <option value="problem" ${c.status === 'problem' ? 'selected' : ''}>Problem</option>
                        </select>
                    </td>
                    <td class="px-8 py-5 relative">
                        <div class="text-[10px] text-slate-300 italic max-w-[200px] truncate group-hover:whitespace-normal group-hover:bg-[#1e293b] group-hover:absolute group-hover:z-50 group-hover:p-4 group-hover:rounded-xl group-hover:border group-hover:border-blue-500/30 group-hover:shadow-2xl transition-all cursor-help">
                            ${c.chat_summary || 'Waiting for AI processing...'}
                        </div>
                    </td>
                    <td class="px-8 py-5">
                        <input type="text" value="${c.operator_instruction || ''}" 
                               placeholder="Type & press enter..."
                               onblur="window.TitanEngine.updateNote('${c.id}', this.value)"
                               onkeydown="if(event.key === 'Enter') this.blur();"
                               class="bg-transparent border-b border-slate-600 w-full text-[11px] py-1 outline-none focus:border-blue-500 text-amber-200 transition-colors">
                    </td>
                    <td class="px-8 py-5 text-right font-black text-emerald-400 text-xs tracking-wider">
                        Rs. ${parseFloat(c.income || 0).toLocaleString()}
                    </td>
                    <td class="px-8 py-5 text-center">
                        <button onclick="window.TitanEngine.openFormModal('${c.id}')" class="bg-blue-600 hover:bg-blue-500 text-white h-8 w-12 rounded-lg transition-all shadow-[0_0_10px_rgba(59,130,246,0.3)] hover:scale-110 active:scale-95 flex items-center justify-center mx-auto">
                            <i class="fas fa-folder-open text-xs"></i>
                        </button>
                    </td>
                </tr>
            `;
        },

        notify(msg, type = 'info') {
            const zone = document.getElementById('notificationZone');
            if (!zone) return;

            const toast = document.createElement('div');
            const colors = {
                success: 'border-emerald-500 bg-emerald-500/20 text-emerald-400',
                error: 'border-red-500 bg-red-500/20 text-red-400',
                info: 'border-blue-500 bg-blue-500/20 text-blue-400'
            };

            toast.className = `backdrop-blur-md px-6 py-4 rounded-2xl border-l-4 shadow-2xl mb-3 animate-fade-in-up flex items-center gap-4 ${colors[type]}`;
            toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle'} text-lg"></i>
                               <span class="text-[10px] font-black uppercase tracking-widest">${msg}</span>`;
            
            zone.appendChild(toast);
            setTimeout(() => toast.remove(), 5000);
        },

        toggleSyncButton(isLoading) {
            const btns = document.querySelectorAll('button[onclick="syncCoreDatabase()"]');
            btns.forEach(btn => {
                btn.innerHTML = isLoading 
                    ? `<i class="fas fa-circle-notch animate-spin mr-2"></i> SYNCING...` 
                    : `<i class="fas fa-sync-alt mr-2"></i> Force Cloud Sync`;
                btn.style.opacity = isLoading ? '0.7' : '1';
                btn.style.pointerEvents = isLoading ? 'none' : 'auto';
            });
        }
    };

    /**
     * ==========================================
     * 6. UTILITIES MODULE
     * ==========================================
     */
    const Utils = {
        debounce(func, delay) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), delay);
            };
        },
        formatDate(isoString) {
            if(!isoString) return 'Unknown Date';
            const d = new Date(isoString);
            return d.toLocaleDateString('ne-NP', { year: 'numeric', month: 'short', day: 'numeric' });
        },
        playNotificationSound() {
            // Optional: Add a subtle beep for incoming messages
            try {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
                audio.volume = 0.2;
                audio.play();
            } catch(e) {}
        }
    };

    /**
     * ==========================================
     * 7. WINDOW / GLOBAL EXPORTS (API)
     * ==========================================
     */
    window.TitanEngine = {
        async updateStatus(id, newStatus) {
            const success = await DataLayer.updateCustomerField(id, 'status', newStatus);
            if(success) TitanEngine.performCloudSync();
        },

        async updateNote(id, newInstruction) {
            await DataLayer.updateCustomerField(id, 'operator_instruction', newInstruction);
        },

        filterPlatform(platformCode) {
            STATE.ui.activePlatform = platformCode;
            DataLayer.applyFilters();
            UI.renderTable();
            UI.notify(`Filtered by: ${platformCode.toUpperCase()}`, "info");
        },

        openFormModal(customerId) {
            const customer = STATE.data.raw.find(c => c.id === customerId);
            if(!customer) return;

            const modal = document.getElementById('formModal');
            if(modal) {
                modal.classList.remove('hidden');
                // Future Implementation: Inject customer data into Modal Inputs
                console.log("Opening Form Filler for:", customer.customer_name);
            }
        }
    };

    window.syncCoreDatabase = () => {
        Utils.playNotificationSound();
        TitanEngine.performCloudSync();
    };

    // Event Listeners for Search
    document.getElementById('searchInput')?.addEventListener('input', Utils.debounce((e) => {
        STATE.ui.searchTerm = e.target.value;
        DataLayer.applyFilters();
        UI.renderTable();
    }, 400));

    // Execute Boot Sequence
    document.addEventListener("DOMContentLoaded", () => {
        TitanEngine.init();
    });

})(); // End of Neural Engine