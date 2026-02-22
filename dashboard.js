/**
 * =============================================================================
 * TITAN ENTERPRISE CRM v4.0.0 - ULTIMATE MASTER ENGINE
 * =============================================================================
 * System: Advanced RPA & Neural Interface
 * Framework: Vanilla JS / Supabase / Tailwind
 * Modules: Analytics, Real-time Sync, Financial Engine, UI Orchestrator
 * =============================================================================
 */
const TITAN_CONFIG = {
    URL: "https://ratgpvubjrcoipardzdp.supabase.co",
    KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhdGdwdnVianJjb2lwYXJkemRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTg0OTMsImV4cCI6MjA4Mzg5NDQ5M30.t1eofJj9dPK-Psp_oL3LpCWimyz621T21JNpZljEGZk",
    TABLE: 'customers', // यहाँ 'leads' थियो, यसलाई मात्र 'customers' बनाउनुहोस्
    VERSION: '4.0.0-PRO'
};
(function() {
    "use strict";

    // 1. CONSTANTS & SECURITY CONFIG
    const CONFIG = {
        VERSION: '4.2.0-ULTIMATE',
        DB_TABLE: 'customers', // यहाँ 'leads' लाई हटाएर 'customers' राख्नुहोस्
        PAGE_LIMIT: 15,        // १५ वटा मात्र डाटा देखाउन यो थप्नुहोस्
        REFRESH_INTERVAL: 30000,
        CURRENCY: 'Rs.',
        LOG_PREFIX: '🚀 [TITAN_CORE]',
        SOUNDS: {
            NOTIFICATION: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3',
            SUCCESS: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'
        }
    };

    // 2. MASTER STATE MANAGEMENT (Central Truth)
    const STATE = {
        rawLeads: [],
        filteredLeads: [],
        analytics: {
            revenue: 0,
            growth: 12.5,
            successRate: 0,
            avgResolutionTime: 0
        },
        ui: {
            activePlatform: 'all',
            searchTerm: '',
            isSyncing: false,
            sidebarOpen: true,
            selectedLeadId: null
        },
        auth: {
            user: JSON.parse(localStorage.getItem('titan_session')),
            role: 'ADMIN_OPERATOR'
        }
    };

    /**
     * [MODULE: CORE ENGINE INITIALIZER]
     */
    const TitanEngine = {
        async init() {
            try {
                this.setupSupabase();
                await this.performFirstSync();
                this.initRealtimeWebSocket();
            } catch (err) {
                // यहाँ ErrorHandler छैन, त्यसैले सिधै console.error लेख्नुहोस्
                console.error("INIT_FAILURE:", err);
            }
        },

        setupSupabase() {
            // सिधै TITAN_CONFIG बाट URL र KEY तान्ने
            const url = TITAN_CONFIG.URL; 
            const key = TITAN_CONFIG.KEY;
            
            if (!url || !key) {
                console.error("API Keys missing in TITAN_CONFIG");
                return;
            }
            this.client = window.supabase.createClient(url, key);
        },

        async performFirstSync() {
            UI.toggleLoader(true);
            await DataLayer.fetchLeads();
            AnalyticsEngine.computeAll();
            UI.refreshAll();
            UI.toggleLoader(false);
        },

        initRealtimeWebSocket() {
            this.client
                .channel('titan-realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: CONFIG.DB_TABLE }, payload => {
                    this.handleRealtimeEvent(payload);
                })
                .subscribe();
        },

        handleRealtimeEvent(payload) {
            console.log(`${CONFIG.LOG_PREFIX} REALTIME_EVENT:`, payload.eventType);
            DataLayer.fetchLeads().then(() => {
                AnalyticsEngine.computeAll();
                UI.refreshAll();
                Utils.playSfx('NOTIFICATION');
                UI.notify(`DATABASE ${payload.eventType}: ${payload.new?.customer_name || 'System Update'}`, 'info');
            });
        }
    };

    /**
     * [MODULE: DATA ACCESS LAYER]
     */
    const DataLayer = {
        async fetchLeads() {
            STATE.isSyncing = true;
            const { data, error } = await TitanEngine.client
                .from(CONFIG.DB_TABLE)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            STATE.rawLeads = data;
            STATE.filteredLeads = [...data];
            STATE.isSyncing = false;
        },

        async updateLead(id, updates) {
            const { error } = await TitanEngine.client
                .from(CONFIG.DB_TABLE)
                .update(updates)
                .eq('id', id);

            if (error) {
                UI.notify("Update Failed", "error");
                return false;
            }
            UI.notify("Lead Synchronized", "success");
            return true;
        }
    };

    const AnalyticsEngine = {
        computeAll() {
            const stats = {
                income: 0,
                success: 0,
                pending: 0,
                inquiry: 0,
                working: 0,
                problem: 0,
                wa: 0,
                msgr: 0
            };

            STATE.rawLeads.forEach(l => {
                const val = parseFloat(l.income || 0);
                
                // Status गणना (यहाँ 'success' एक पटक मात्र छ)
                if (l.status === 'success') {
                    stats.income += val;
                    stats.success++;
                } else if (l.status === 'pending') {
                    stats.pending++;
                } else if (l.status === 'inquiry') {
                    stats.inquiry++;
                } else if (l.status === 'working') {
                    stats.working++;
                } else if (l.status === 'problem') {
                    stats.problem++;
                }

                // Platform गणना
                l.platform === 'whatsapp' ? stats.wa++ : stats.msgr++;
            });

            STATE.analytics = stats;
        }
    };

    /**
     * [MODULE: UI ORCHESTRATOR]
     */
    const UI = {
        refreshAll() {
            this.renderStats();
            this.renderTable();
            // this.renderCharts(); // यसरी बन्द गरिदिनुहोस्
        },
        renderStats() {
            const ids = {
                'statIncome': `${CONFIG.CURRENCY} ${STATE.analytics.income.toLocaleString()}`,
                'statSuccess': STATE.analytics.success,
                'statPending': STATE.analytics.pending,
                'statInquiry': STATE.analytics.inquiry,
                'statWorking': STATE.analytics.working,
                'statProblem': STATE.analytics.problem
            };

            for (const [id, val] of Object.entries(ids)) {
                const el = document.getElementById(id);
                if (el) {
                    el.innerText = val;
                }
            }
        },

        renderTable() {
            const tbody = document.getElementById('tableBody');
            if (!tbody) return;

            const filtered = STATE.rawLeads.filter(customer => {
                const matchesSearch = customer.customer_name?.toLowerCase().includes(STATE.ui.searchTerm.toLowerCase()) ||
                                     customer.service?.toLowerCase().includes(STATE.ui.searchTerm.toLowerCase());
                const matchesPlatform = STATE.ui.activePlatform === 'all' || customer.platform === STATE.ui.activePlatform;
                return matchesSearch && matchesPlatform;
            });

            tbody.innerHTML = filtered.map(customer => this.createRowHTML(customer)).join('');
        },

        createRowHTML(customer) {
            const platformIcon = customer.platform === 'whatsapp' 
                ? '<i class="fab fa-whatsapp text-emerald-500"></i>' 
                : '<i class="fab fa-facebook-messenger text-blue-500"></i>';

            return `
                <tr class="vibrant-table-row border-b border-white/5 hover:bg-white/5 transition-all">
                    <td class="px-3 py-4 text-[10px] font-mono text-slate-400">
                        ${new Date(customer.created_at).toLocaleString('ne-NP')}
                    </td>
                    <td class="px-3 py-4 text-center">${platformIcon}</td>
                    <td class="px-3 py-4">
                        <div class="font-bold text-slate-100">${customer.customer_name || 'Walk-in'}</div>
                        <div class="text-[8px] opacity-40 uppercase">ID: ${customer.id.slice(0,8)}</div>
                    </td>
                    <td class="px-3 py-4">
                        <span class="bg-slate-800/50 px-2 py-1 rounded border border-white/5 text-[10px]">
                            ${customer.service || 'N/A'}
                        </span>
                    </td>
                    <td class="px-3 py-4">
                        <select onchange="window.TitanEngine.updateStatus('${customer.id}', this.value)" 
                                class="bg-transparent text-[9px] font-black uppercase border border-white/10 rounded-md p-1 outline-none">
                            <option value="inquiry" ${customer.status === 'inquiry' ? 'selected' : ''}>Inquiry</option>
                            <option value="pending" ${customer.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="working" ${customer.status === 'working' ? 'selected' : ''}>Working</option>
                            <option value="success" ${customer.status === 'success' ? 'selected' : ''}>Success</option>
                            <option value="problem" ${customer.status === 'problem' ? 'selected' : ''}>Problem</option>
                        </select>
                    </td>
                    <td class="px-3 py-4 text-[10px] text-blue-300 italic max-w-[150px] truncate">
                        ${customer.summary || 'Waiting for AI...'}
                    </td>
                    <td class="px-3 py-4">
                         <input type="text" value="${customer.operator_instruction || ''}" 
                                onblur="window.TitanEngine.updateNote('${customer.id}', this.value)"
                                class="bg-transparent border-b border-white/10 w-full text-[10px] outline-none focus:border-blue-500">
                    </td>
                    <td class="px-3 py-4 text-right font-black text-emerald-400">
                        ${CONFIG.CURRENCY} ${parseFloat(customer.income || 0).toLocaleString()}
                    </td>
                    <td class="px-3 py-4 text-center">
                        ${customer.file_url ? `<button onclick="window.open('${customer.file_url}')" class="text-blue-400 hover:text-white"><i class="fas fa-file-alt"></i></button>` : '-'}
                    </td>
                    <td class="px-3 py-4 text-right">
                        <button onclick="window.TitanEngine.deleteRow('${customer.id}')" class="text-red-500/50 hover:text-red-500">
                            <i class="fas fa-trash-alt text-xs"></i>
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
                success: 'border-emerald-500 bg-emerald-500/10 text-emerald-400',
                error: 'border-red-500 bg-red-500/10 text-red-400',
                info: 'border-blue-500 bg-blue-500/10 text-blue-400'
            };

            toast.className = `glass-panel px-6 py-3 rounded-xl border-l-4 shadow-2xl mb-3 animate-slide-in ${colors[type]}`;
            toast.innerHTML = `<div class="flex items-center gap-3">
                                <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
                                <span class="text-[10px] font-black uppercase tracking-widest">${msg}</span>
                               </div>`;
            
            zone.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);
        },

        toggleLoader(show) {
            const btn = document.querySelector('button[onclick="syncCoreDatabase()"]');
            if (btn) {
                btn.innerHTML = show ? '<i class="fas fa-circle-notch animate-spin"></i> SYNCING...' : '<i class="fas fa-sync-alt"></i> Force Cloud Sync';
                btn.disabled = show;
            }
        }
    };

    /**
     * [MODULE: UTILS & HELPERS]
     */
    const Utils = {
        playSfx(key) {
            const audio = new Audio(CONFIG.SOUNDS[key]);
            audio.volume = 0.4;
            audio.play().catch(() => {});
        },
        debounce(func, wait) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }
    };

window.TitanEngine = {
        get client() { return TitanEngine.client; }, 
        
        async updateStatus(id, status) {
            const ok = await DataLayer.updateLead(id, { status });
            if (ok) await TitanEngine.performFirstSync();
        },
        // ... बाँकी अरू कोड उस्तै
        async updateNote(id, operator_note) {
            await DataLayer.updateLead(id, { operator_instruction: operator_note });
        },
        async deleteRow(id) {
            if (!confirm("Confirm Destruction?")) return;
            const { error } = await TitanEngine.client.from(CONFIG.DB_TABLE).delete().eq('id', id);
            if (!error) {
                UI.notify("Record Deleted", "error");
                await TitanEngine.performFirstSync();
            }
        },
        filterPlatform(p) {
            STATE.ui.activePlatform = p;
            UI.renderTable();
        }
    };

    window.syncCoreDatabase = () => TitanEngine.performFirstSync();

    // Start Everything
    TitanEngine.init();

    // Attach Search Debounce
    document.getElementById('searchInput')?.addEventListener('input', Utils.debounce((e) => {
        STATE.ui.searchTerm = e.target.value;
        UI.renderTable();
    }, 300));

})();

/**
 * =============================================================================
 * END OF MASTER ENGINE - TITAN CRM v4
 * =============================================================================
 */