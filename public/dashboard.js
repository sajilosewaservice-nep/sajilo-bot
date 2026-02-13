/**
 * ═════════════════════════════════════════════════════════════════════════════
 * TITAN ENTERPRISE CRM v4.0.0 - Dashboard Module
 * 
 * Main Application Logic for Customer Management & RPA Automation
 * Handles: Authentication, Data Sync, UI Updates, RPA Control
 * ═════════════════════════════════════════════════════════════════════════════
 */

// ═════════════════════════════════════════════════════════════════════════════
// 1. GLOBAL STATE MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

const STATE = {
    currentUser: null,
    allData: [],
    filteredData: [],
    currentPage: 1,
    selectedPlatform: 'all',
    automation: {
        activeProcesses: {},
        pausedProcesses: {}
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// 2. SYSTEM CONFIGURATION
// ═════════════════════════════════════════════════════════════════════════════

const SYSTEM_CONFIG = {
    SUPABASE_URL: "https://your-supabase-instance.supabase.co",
    SUPABASE_KEY: "your-supabase-anon-key",
    RPA_SERVER_URL: "http://localhost:5000/api",
    PAGE_SIZE: 20,
    
    // Service Configuration
    SERVICES: {
        PCC: { name: "Police Clearance", icon: "🚔" },
        NID: { name: "National Identity", icon: "🆔" },
        LICENSE: { name: "Driving License", icon: "🚗" },
        PASSPORT: { name: "Passport", icon: "✈️" },
        PAN: { name: "Tax ID (PAN)", icon: "📋" }
    },
    
    // Status Colors
    STATUS_COLORS: {
        inquiry: '#64748b',
        pending: '#f59e0b',
        working: '#3b82f6',
        success: '#10b981',
        problem: '#ef4444',
        paused: '#8b5cf6'
    },
    
    // Platform Settings
    PLATFORMS: ['all', 'whatsapp', 'messenger'],
    
    // Timing
    REALTIME_INTERVAL: 3000,
    SYNC_INTERVAL: 30000
};

// ═════════════════════════════════════════════════════════════════════════════
// 3. SUPABASE CLIENT INITIALIZATION
// ═════════════════════════════════════════════════════════════════════════════

let supabaseClient = null;

async function initializeSupabase() {
    try {
        if (typeof supabase === 'undefined') {
            console.error("❌ Supabase library not loaded");
            notify("Supabase configuration error", "error");
            return false;
        }
        
        supabaseClient = supabase.createClient(
            SYSTEM_CONFIG.SUPABASE_URL,
            SYSTEM_CONFIG.SUPABASE_KEY
        );
        
        console.log("✅ Supabase initialized successfully");
        return true;
    } catch (error) {
        console.error("❌ Supabase initialization error:", error);
        return false;
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. INITIALIZATION - Application Bootstrap
// ═════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log("🚀 Dashboard initialization started...");
        
        // Step 1: Initialize Supabase
        const supabaseReady = await initializeSupabase();
        if (!supabaseReady) throw new Error("Supabase initialization failed");
        
        // Step 2: Validate session
        validateSession();
        
        // Step 3: Register event listeners
        registerGlobalEvents();
        
        // Step 4: Start realtime updates
        startRealtimeBridge();
        
        // Step 5: Initialize live clock
        initializeLiveClock();
        
        // Step 6: Setup auto-sync
        setInterval(() => syncCoreDatabase(), SYSTEM_CONFIG.SYNC_INTERVAL);
        
        console.log("✅ Dashboard initialization completed");
    } catch (error) {
        console.error("❌ Dashboard initialization error:", error);
        notify("Failed to load dashboard", "error");
    }
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. AUTHENTICATION & SESSION MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

function validateSession() {
    try {
        const sessionToken = sessionStorage.getItem('titan_user');
        
        if (sessionToken) {
            STATE.currentUser = JSON.parse(sessionToken);
            loadDashboardInterface();
            console.log(`✅ User session validated: ${STATE.currentUser.full_name}`);
        } else {
            showLoginPage();
        }
    } catch (error) {
        console.error("❌ Session validation error:", error);
        showLoginPage();
    }
}

function showLoginPage() {
    const loginPage = document.getElementById('loginPage');
    const dashboardPage = document.getElementById('dashboardPage');
    
    if (loginPage) loginPage.classList.remove('hidden');
    if (dashboardPage) dashboardPage.classList.add('hidden');
}

async function handleLogin(username, password) {
    try {
        if (!supabaseClient) {
            notify("Database connection failed", "error");
            return false;
        }
        
        const { data, error } = await supabaseClient
            .from('staff')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .maybeSingle();
        
        if (error) {
            console.error("❌ Login query error:", error);
            notify("Database error occurred", "error");
            return false;
        }
        
        if (data) {
            STATE.currentUser = data;
            sessionStorage.setItem('titan_user', JSON.stringify(data));
            notify(`Welcome, ${data.full_name}!`, "success");
            loadDashboardInterface();
            return true;
        } else {
            notify("Invalid username or password", "error");
            return false;
        }
    } catch (error) {
        console.error("❌ Login error:", error);
        notify("Login failed", "error");
        return false;
    }
}

function handleLogout() {
    try {
        sessionStorage.clear();
        STATE.currentUser = null;
        STATE.allData = [];
        STATE.filteredData = [];
        notify("Logged out successfully", "success");
        showLoginPage();
        location.reload();
    } catch (error) {
        console.error("❌ Logout error:", error);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. DASHBOARD INTERFACE MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

async function loadDashboardInterface() {
    try {
        // Hide login, show dashboard
        const loginPage = document.getElementById('loginPage');
        const dashboardPage = document.getElementById('dashboardPage');
        
        if (loginPage) loginPage.classList.add('hidden');
        if (dashboardPage) dashboardPage.classList.remove('hidden');
        
        // Update user display
        updateUserDisplay();
        
        // Add analytics button
        addAnalyticsButton();
        
        // Load initial data
        await syncCoreDatabase();
        
        console.log("✅ Dashboard interface loaded");
    } catch (error) {
        console.error("❌ Dashboard interface error:", error);
    }
}

function updateUserDisplay() {
    const userDisplay = document.getElementById('userDisplay');
    if (userDisplay && STATE.currentUser) {
        userDisplay.innerHTML = `
            <i class="fas fa-user-circle mr-2"></i>
            <span>${STATE.currentUser.full_name}</span>
        `;
    }
}

function addAnalyticsButton() {
    const btnContainer = document.getElementById('reportBtnContainer');
    if (btnContainer) {
        btnContainer.innerHTML = `
            <button onclick="showFinancialReport()" 
                class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-black text-xs uppercase shadow-lg transition-all active:scale-95">
                <i class="fas fa-chart-bar mr-2"></i> Analytics Report
            </button>
        `;
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. DATABASE OPERATIONS
// ═════════════════════════════════════════════════════════════════════════════

async function syncCoreDatabase() {
    try {
        if (!supabaseClient) {
            console.warn("⚠️ Supabase client not ready");
            return;
        }
        
        const { data, error } = await supabaseClient
            .from('customers')
            .select('*')
            .order('updated_at', { ascending: false });
        
        if (error) {
            console.error("❌ Database sync error:", error);
            return;
        }
        
        STATE.allData = data || [];
        applyLogicFilters(false);
        refreshFinancialAnalytics();
        
        const recordCount = STATE.allData.length;
        console.log(`✅ Synced ${recordCount} customer records`);
    } catch (error) {
        console.error("❌ Database sync error:", error);
    }
}

async function commitUpdate(customerId, updates, message = null) {
    try {
        if (!supabaseClient) {
            notify("Database connection failed", "error");
            return false;
        }
        
        const payload = {
            ...updates,
            last_updated_by: STATE.currentUser?.full_name || 'System',
            updated_at: new Date().toISOString()
        };
        
        const { data, error } = await supabaseClient
            .from('customers')
            .update(payload)
            .eq('id', customerId)
            .select();
        
        if (error) {
            console.error("❌ Update error:", error);
            notify(`Error: ${error.message}`, "error");
            return false;
        }
        
        if (data && data.length > 0) {
            // Update local state
            const index = STATE.allData.findIndex(d => d.id === customerId);
            if (index !== -1) {
                STATE.allData[index] = { ...STATE.allData[index], ...data[0] };
                applyLogicFilters(false);
                refreshFinancialAnalytics();
            }
            
            if (message) notify(message, "success");
            console.log(`✅ Updated customer: ${customerId}`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error("❌ Commit update error:", error);
        notify("Update failed", "error");
        return false;
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. FINANCIAL ANALYTICS & STATISTICS
// ═════════════════════════════════════════════════════════════════════════════

function refreshFinancialAnalytics() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const stats = STATE.allData.reduce((acc, curr) => {
            const status = (curr.status || '').toLowerCase().trim();
            acc.counts[status] = (acc.counts[status] || 0) + 1;
            
            if (status === 'success') {
                // Parse income format: "amount/pending"
                const incomeParts = String(curr.income || "0/0").split('/');
                const incomeAmount = parseFloat(incomeParts[0]?.replace(/[^0-9.]/g, '')) || 0;
                const pendingAmount = incomeParts[1] ? parseFloat(incomeParts[1].replace(/[^0-9.]/g, '')) || 0 : 0;
                
                acc.revenue += incomeAmount;
                acc.totalPending += pendingAmount;
                
                // Check if completed today
                const entryDate = curr.updated_at ? curr.updated_at.split('T')[0] : '';
                if (entryDate === today) {
                    acc.dailyIncome += incomeAmount;
                }
            }
            
            return acc;
        }, {
            counts: {},
            revenue: 0,
            totalPending: 0,
            dailyIncome: 0
        });
        
        // Update UI elements
        updateStatElement('statIncome', `Rs. ${stats.revenue.toLocaleString()}`);
        updateStatElement('statSuccess', stats.counts['success'] || 0);
        updateStatElement('statPending', stats.counts['pending'] || 0);
        updateStatElement('statInquiry', stats.counts['inquiry'] || 0);
        updateStatElement('statWorking', stats.counts['working'] || 0);
        updateStatElement('statProblem', stats.counts['problem'] || 0);
        updateStatElement('totalRecords', `TOTAL: ${STATE.allData.length}`);
        
        console.log("✅ Financial analytics updated");
    } catch (error) {
        console.error("❌ Analytics error:", error);
    }
}

function updateStatElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

function getStatusColor(status) {
    const normalizedStatus = (status || '').toLowerCase().trim();
    return SYSTEM_CONFIG.STATUS_COLORS[normalizedStatus] || '#cbd5e1';
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. FILTERING & SEARCH
// ═════════════════════════════════════════════════════════════════════════════

function applyLogicFilters(resetPage = true) {
    try {
        const searchInput = document.getElementById('searchInput');
        const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
        
        let filtered = [...STATE.allData];
        
        // Apply search filter
        if (searchQuery) {
            filtered = filtered.filter(customer => {
                const name = (customer.customer_name || '').toLowerCase();
                const phone = (customer.phone_number || '').toLowerCase();
                const email = (customer.email || '').toLowerCase();
                
                return name.includes(searchQuery) || 
                       phone.includes(searchQuery) || 
                       email.includes(searchQuery);
            });
        }
        
        // Apply platform filter
        if (STATE.selectedPlatform && STATE.selectedPlatform !== 'all') {
            filtered = filtered.filter(customer =>
                (customer.platform || '').toLowerCase() === STATE.selectedPlatform.toLowerCase()
            );
        }
        
        STATE.filteredData = filtered;
        
        if (resetPage) {
            STATE.currentPage = 1;
        }
        
        buildTableRows();
        updatePaginationUI();
        updateTotalRecords();
        
        console.log(`✅ Applied filters: ${filtered.length} records`);
    } catch (error) {
        console.error("❌ Filter error:", error);
    }
}

function filterByPlatform(platform) {
    try {
        STATE.selectedPlatform = platform;
        applyLogicFilters(true);
        console.log(`✅ Platform filter: ${platform}`);
    } catch (error) {
        console.error("❌ Platform filter error:", error);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 10. TABLE RENDERING & PAGINATION
// ═════════════════════════════════════════════════════════════════════════════

function buildTableRows() {
    try {
        const tableBody = document.getElementById('tableBody');
        const emptyState = document.getElementById('emptyState');
        
        if (!tableBody) return;
        
        // Calculate pagination
        const startIdx = (STATE.currentPage - 1) * SYSTEM_CONFIG.PAGE_SIZE;
        const endIdx = startIdx + SYSTEM_CONFIG.PAGE_SIZE;
        const paginatedData = STATE.filteredData.slice(startIdx, endIdx);
        
        // Show/hide empty state
        if (paginatedData.length === 0) {
            tableBody.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }
        
        if (emptyState) emptyState.classList.add('hidden');
        
        // Build rows
        tableBody.innerHTML = paginatedData.map(customer => `
            <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4 text-sm">${formatDate(customer.created_at)}</td>
                <td class="px-6 py-4 text-center">
                    <span class="inline-flex items-center gap-2">
                        ${getPlatformIcon(customer.platform)}
                        <span class="text-xs font-semibold">${customer.platform || 'Unknown'}</span>
                    </span>
                </td>
                <td class="px-6 py-4 text-sm">
                    <div class="font-semibold">${customer.customer_name || 'N/A'}</div>
                    <div class="text-xs text-slate-500">${customer.phone_number || 'N/A'}</div>
                </td>
                <td class="px-6 py-4 text-sm">${customer.service_type || 'Other'}</td>
                <td class="px-6 py-4 text-center">
                    ${customer.rpa_status === 'active' ? '<span class="inline-flex items-center gap-1"><span class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>Active</span>' : '<span class="text-slate-400">-</span>'}
                </td>
                <td class="px-6 py-4 text-sm">
                    <span class="px-3 py-1 rounded-full text-xs font-semibold text-white" style="background-color: ${getStatusColor(customer.status)}">
                        ${(customer.status || 'unknown').toUpperCase()}
                    </span>
                </td>
                <td class="px-6 py-4 text-sm">
                    <button onclick="handleChatClick('${customer.phone_number || ''}', '${customer.platform || 'messenger'}', '${customer.messenger_id || ''}')" class="text-blue-600 hover:text-blue-700 font-semibold">
                        <i class="fas fa-comment-dots"></i>
                    </button>
                </td>
                <td class="px-6 py-4 text-sm truncate">${customer.operator_instruction || 'No notes'}</td>
                <td class="px-6 py-4 text-center">
                    <span class="text-sm font-semibold">${customer.payment_status || 'Pending'}</span>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="text-xs font-semibold">${customer.operator_name || 'Unassigned'}</span>
                </td>
                <td class="px-6 py-4 text-center">
                    <button onclick="viewDocuments('${customer.id}')" class="text-green-600 hover:text-green-700">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        console.log(`✅ Rendered ${paginatedData.length} rows`);
    } catch (error) {
        console.error("❌ Table rendering error:", error);
    }
}

function updatePaginationUI() {
    try {
        const pageInfo = document.getElementById('pageInfo');
        const totalItems = STATE.filteredData.length;
        const maxPage = Math.ceil(totalItems / SYSTEM_CONFIG.PAGE_SIZE) || 1;
        
        if (pageInfo) {
            pageInfo.innerHTML = `PAGE <span class="text-blue-400">${STATE.currentPage}</span> OF <span class="text-blue-400">${maxPage}</span>`;
        }
    } catch (error) {
        console.error("❌ Pagination UI error:", error);
    }
}

function updateTotalRecords() {
    try {
        const totalRecords = document.getElementById('totalRecords');
        if (totalRecords) {
            totalRecords.innerHTML = `<i class="fas fa-database mr-2"></i>TOTAL: ${STATE.filteredData.length}`;
        }
    } catch (error) {
        console.error("❌ Total records error:", error);
    }
}

function changePage(direction) {
    try {
        const totalItems = STATE.filteredData.length;
        const maxPage = Math.ceil(totalItems / SYSTEM_CONFIG.PAGE_SIZE) || 1;
        
        if (direction === 'next' && STATE.currentPage < maxPage) {
            STATE.currentPage++;
        } else if (direction === 'prev' && STATE.currentPage > 1) {
            STATE.currentPage--;
        } else {
            return;
        }
        
        buildTableRows();
        updatePaginationUI();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        console.error("❌ Page change error:", error);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 11. RPA AUTOMATION CONTROL
// ═════════════════════════════════════════════════════════════════════════════

async function launchAIAutoFill(customerId, serviceType) {
    try {
        if (!serviceType || serviceType === 'Other') {
            notify("Please select a valid service", "error");
            return;
        }
        
        const customer = STATE.allData.find(c => c.id === customerId);
        if (!customer) {
            notify("Customer not found", "error");
            return;
        }
        
        // Get AI rules from settings
        const masterRules = localStorage.getItem('ai_rules_master') || '';
        const serviceRules = localStorage.getItem(`ai_rules_${serviceType.toLowerCase()}`) || '';
        const finalRules = `${masterRules}\n${serviceRules}`;
        
        notify("Starting RPA automation...", "success");
        
        try {
            const response = await fetch(`${SYSTEM_CONFIG.RPA_SERVER_URL}/start-automation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_id: customerId,
                    customer_data: customer,
                    service_type: serviceType,
                    ai_instructions: finalRules,
                    operator: STATE.currentUser?.full_name || 'Unknown'
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                STATE.automation.activeProcesses[customerId] = serviceType;
                notify(`RPA started for ${serviceType}`, "success");
                console.log("✅ Automation started:", result);
            } else {
                notify("RPA server error", "error");
            }
        } catch (error) {
            notify("RPA server offline", "error");
            console.error("❌ RPA error:", error);
        }
    } catch (error) {
        console.error("❌ Launch automation error:", error);
        notify("Failed to start automation", "error");
    }
}

async function pauseAutomation(customerId) {
    try {
        const response = await fetch(
            `${SYSTEM_CONFIG.RPA_SERVER_URL}/automation/pause/${customerId}`,
            { method: 'POST' }
        );
        
        if (response.ok) {
            STATE.automation.pausedProcesses[customerId] = true;
            notify("Automation paused", "success");
        }
    } catch (error) {
        console.error("❌ Pause error:", error);
    }
}

async function resumeAutomation(customerId) {
    try {
        const response = await fetch(
            `${SYSTEM_CONFIG.RPA_SERVER_URL}/automation/resume/${customerId}`,
            { method: 'POST' }
        );
        
        if (response.ok) {
            delete STATE.automation.pausedProcesses[customerId];
            notify("Automation resumed", "success");
        }
    } catch (error) {
        console.error("❌ Resume error:", error);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 12. CHAT & COMMUNICATION
// ═════════════════════════════════════════════════════════════════════════════

function handleChatClick(phone, platform, senderId) {
    try {
        if (!phone && !senderId) {
            notify("Contact information not available", "error");
            return;
        }
        
        const cleanPhone = (phone || senderId).replace(/\D/g, '');
        
        if (platform === 'whatsapp' && cleanPhone) {
            window.open(`https://wa.me/${cleanPhone}`, '_blank');
        } else if (platform === 'messenger') {
            const targetId = senderId || '';
            if (targetId && targetId !== 'undefined') {
                window.open(`https://www.messenger.com/t/${targetId}`, '_blank');
            } else {
                window.open(`https://www.messenger.com`, '_blank');
            }
        } else {
            notify("Invalid platform", "error");
        }
        
        console.log(`✅ Opened chat: ${platform}`);
    } catch (error) {
        console.error("❌ Chat error:", error);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 13. UTILITIES & HELPERS
// ═════════════════════════════════════════════════════════════════════════════

function initializeLiveClock() {
    setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        
        const lastUpdate = document.getElementById('lastUpdate');
        if (lastUpdate) {
            lastUpdate.innerHTML = `<span class="text-green-500 font-bold animate-pulse">●</span> LIVE: <span class="font-bold">${timeStr}</span>`;
        }
    }, 1000);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return 'N/A';
    }
}

function getPlatformIcon(platform) {
    const icons = {
        whatsapp: '<i class="fas fa-whatsapp text-emerald-500"></i>',
        messenger: '<i class="fas fa-facebook-messenger text-blue-500"></i>'
    };
    return icons[platform?.toLowerCase()] || '<i class="fas fa-question-circle text-slate-400"></i>';
}

function notify(message, type = 'info') {
    try {
        const notification = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
        
        notification.className = `
            fixed top-6 right-6 px-6 py-4 rounded-xl text-white font-bold
            shadow-2xl z-[10000] animate-bounce
            ${bgColor}
        `;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} mr-2"></i>
            ${message}
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    } catch (error) {
        console.error("❌ Notification error:", error);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 14. SETTINGS & CONFIGURATION
// ═════════════════════════════════════════════════════════════════════════════

function toggleSettingsModal() {
    try {
        let modal = document.getElementById('settingsModal');
        
        if (!modal) {
            modal = createSettingsModal();
            document.body.appendChild(modal);
        }
        
        modal.classList.toggle('hidden');
    } catch (error) {
        console.error("❌ Settings modal error:", error);
    }
}

function createSettingsModal() {
    const modal = document.createElement('div');
    modal.id = 'settingsModal';
    modal.className = 'hidden fixed inset-0 bg-black bg-opacity-50 z-[9000] flex items-center justify-center';
    modal.innerHTML = `
        <div class="bg-white rounded-3xl p-8 max-w-2xl max-h-96 overflow-y-auto">
            <h2 class="text-2xl font-black mb-6">⚙️ Settings</h2>
            
            <div class="space-y-4">
                <div>
                    <label class="text-sm font-bold text-slate-600">RPA Server URL</label>
                    <input type="text" id="set_rpa_url" value="${localStorage.getItem('rpa_url') || SYSTEM_CONFIG.RPA_SERVER_URL}" class="w-full p-3 border-2 border-slate-200 rounded-xl">
                </div>
                
                <div>
                    <label class="text-sm font-bold text-slate-600">Master AI Rules</label>
                    <textarea id="set_rules_master" class="w-full p-3 border-2 border-slate-200 rounded-xl h-24">${localStorage.getItem('ai_rules_master') || ''}</textarea>
                </div>
            </div>
            
            <div class="flex gap-3 mt-6">
                <button onclick="saveSettings()" class="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black">Save Settings</button>
                <button onclick="document.getElementById('settingsModal').remove()" class="flex-1 bg-slate-200 text-slate-900 py-3 rounded-xl font-black">Cancel</button>
            </div>
        </div>
    `;
    return modal;
}

function saveSettings() {
    try {
        localStorage.setItem('rpa_url', document.getElementById('set_rpa_url')?.value || SYSTEM_CONFIG.RPA_SERVER_URL);
        localStorage.setItem('ai_rules_master', document.getElementById('set_rules_master')?.value || '');
        
        notify("Settings saved successfully", "success");
        document.getElementById('settingsModal')?.remove();
        
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        console.error("❌ Settings save error:", error);
        notify("Failed to save settings", "error");
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 15. REALTIME DATABASE SYNCHRONIZATION
// ═════════════════════════════════════════════════════════════════════════════

function startRealtimeBridge() {
    try {
        if (!supabaseClient) {
            console.warn("⚠️ Supabase not ready for realtime");
            return;
        }
        
        supabaseClient
            .channel('public:customers')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'customers' },
                handleDatabaseChange
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log("✅ Realtime subscription active");
                } else if (status === 'CHANNEL_ERROR') {
                    console.error("❌ Realtime subscription error");
                }
            });
    } catch (error) {
        console.error("❌ Realtime bridge error:", error);
    }
}

function handleDatabaseChange(payload) {
    try {
        if (payload.eventType === 'UPDATE') {
            // Update existing record
            const index = STATE.allData.findIndex(d => d.id === payload.new.id);
            if (index !== -1) {
                STATE.allData[index] = { ...STATE.allData[index], ...payload.new };
                applyLogicFilters(false);
                refreshFinancialAnalytics();
            }
        } else if (payload.eventType === 'INSERT') {
            // New record added
            playNotificationSound();
            notify("New customer added", "success");
            syncCoreDatabase();
        } else if (payload.eventType === 'DELETE') {
            // Record deleted
            STATE.allData = STATE.allData.filter(d => d.id !== payload.old.id);
            applyLogicFilters(false);
            refreshFinancialAnalytics();
        }
    } catch (error) {
        console.error("❌ Database change handler error:", error);
    }
}

function playNotificationSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==');
        audio.play().catch(e => console.log("Sound play failed:", e));
    } catch (error) {
        console.log("Notification sound error:", error);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 16. EVENT REGISTRATION
// ═════════════════════════════════════════════════════════════════════════════

function registerGlobalEvents() {
    try {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('username')?.value.trim() || '';
                const password = document.getElementById('password')?.value.trim() || '';
                
                if (!username || !password) {
                    notify("Please enter username and password", "error");
                    return;
                }
                
                await handleLogin(username, password);
            });
        }
        
        // Search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => applyLogicFilters(true));
        }
        
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
        
        console.log("✅ Global events registered");
    } catch (error) {
        console.error("❌ Event registration error:", error);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 17. DOCUMENT MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

function viewDocuments(customerId) {
    try {
        const customer = STATE.allData.find(c => c.id === customerId);
        if (!customer) {
            notify("Customer not found", "error");
            return;
        }
        
        // Placeholder for document viewer
        notify(`Documents for ${customer.customer_name}`, "info");
        console.log("Documents:", customer.documents);
    } catch (error) {
        console.error("❌ Document view error:", error);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 18. ANALYTICS & REPORTS
// ═════════════════════════════════════════════════════════════════════════════

function showFinancialReport() {
    try {
        notify("Financial Report - Feature Coming Soon", "info");
        console.log("Financial Report Generated");
    } catch (error) {
        console.error("❌ Report error:", error);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 19. GLOBAL FUNCTION EXPORTS (For HTML onclick handlers)
// ═════════════════════════════════════════════════════════════════════════════

// Make functions globally accessible
window.launchAIAutoFill = launchAIAutoFill;
window.handleChatClick = handleChatClick;
window.filterByPlatform = filterByPlatform;
window.changePage = changePage;
window.syncCoreDatabase = syncCoreDatabase;
window.toggleSettingsModal = toggleSettingsModal;
window.saveSettings = saveSettings;
window.viewDocuments = viewDocuments;
window.showFinancialReport = showFinancialReport;
window.pauseAutomation = pauseAutomation;
window.resumeAutomation = resumeAutomation;

console.log("✅ Dashboard.js loaded successfully");s