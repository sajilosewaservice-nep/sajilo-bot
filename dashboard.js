// Omnichannel Operations Dashboard - Advanced Multi-Operator System
// अमनिच्यानल अपरेशन्स ड्यासबोर्ड
// SUPABASE SETUP
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Global State
let currentUser = null;
let currentPage = 1;
let pageSize = 10;
let allCustomers = [];
let allOperators = [];
let filteredCustomers = [];

// DOM Elements
const loginPage = document.getElementById('loginPage');
const dashboardPage = document.getElementById('dashboardPage');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const priorityFilter = document.getElementById('priorityFilter');
const customerList = document.getElementById('customerList');
const multimediaModal = document.getElementById('multimediaModal');
const closeMultimediaModal = document.getElementById('closeMultimediaModal');
const modalContent = document.getElementById('modalContent');
const modalTitle = document.getElementById('modalTitle');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

// Authentication
function checkAuth() {
    const user = localStorage.getItem('omniUser');
    if (user) {
        currentUser = JSON.parse(user);
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    loginPage.classList.remove('hidden');
    dashboardPage.classList.add('hidden');
}

function showDashboard() {
    loginPage.classList.add('hidden');
    dashboardPage.classList.remove('hidden');
    
    // Update UI with user info
    document.getElementById('sidebarUserName').textContent = currentUser.full_name;
    document.getElementById('sidebarUserRole').textContent = currentUser.role;
    document.getElementById('userInitials').textContent = currentUser.full_name.charAt(0).toUpperCase();
    
    updateLastUpdateTime();
    loadData();
}

function updateLastUpdateTime() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Event Listeners
function setupEventListeners() {
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    searchInput.addEventListener('input', debounce(applyFilters, 300));
    statusFilter.addEventListener('change', applyFilters);
    priorityFilter.addEventListener('change', applyFilters);
    
    document.getElementById('prevBtn').addEventListener('click', () => changePage(currentPage - 1));
    document.getElementById('nextBtn').addEventListener('click', () => changePage(currentPage + 1));
    document.getElementById('currentPageInput').addEventListener('change', (e) => {
        const page = parseInt(e.target.value);
        if (page > 0) changePage(page);
    });
    
    closeMultimediaModal.addEventListener('click', () => {
        multimediaModal.classList.remove('active');
    });
    
    multimediaModal.addEventListener('click', (e) => {
        if (e.target === multimediaModal) {
            multimediaModal.classList.remove('active');
        }
    });
    
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        document.querySelectorAll('.sidebar-text').forEach(el => {
            el.style.display = sidebar.classList.contains('collapsed') ? 'none' : 'block';
        });
    });
}

// Login Handler
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (data) {
            currentUser = data;
            localStorage.setItem('omniUser', JSON.stringify(currentUser));
            showDashboard();
        } else {
            showNotification('Invalid credentials!', 'error');
        }
    } catch (err) {
        showNotification('Database error!', 'error');
    }
}

// Load Data
async function loadData() {
    try {
        // Load customers from Supabase
        const { data: custData, error: custError } = await supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (custData) allCustomers = custData;
        
        // Load operators from Supabase
        const { data: opData } = await supabase.from('staff').select('*');
        if (opData) allOperators = opData;
        
        filteredCustomers = [...allCustomers];
        
        updateStats();
        updateOperatorsList();
        renderCustomers();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showNotification('Error loading data!', 'error');
    }
}

// Update Statistics
function updateStats() {
    const success = allCustomers.filter(c => c.status === 'success').length;
    const working = allCustomers.filter(c => c.status === 'working').length;
    const problem = allCustomers.filter(c => c.status === 'problem').length;
    const pending = allCustomers.filter(c => c.status === 'pending').length;
    const totalIncome = allCustomers.reduce((sum, c) => sum + (c.income || 0), 0);
    
    document.getElementById('statSuccess').textContent = success;
    document.getElementById('statWorking').textContent = working;
    document.getElementById('statProblem').textContent = problem;
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('statIncome').textContent = `NPR ${totalIncome.toLocaleString()}`;
}

// Update Operators List
function updateOperatorsList() {
    const activeOps = allOperators.filter(op => op.status === 'online').length;
    document.getElementById('activeOperatorCount').textContent = `${activeOps}/${allOperators.length}`;
    
    const operatorsList = document.getElementById('operatorsList');
    operatorsList.innerHTML = allOperators.slice(0, 5).map(op => `
        <div class="flex items-center justify-between text-sm">
            <div class="flex items-center space-x-2">
                <i class="fas fa-circle text-xs operator-${op.status}"></i>
                <span class="text-gray-700 truncate">${op.full_name}</span>
            </div>
            <span class="text-gray-500 text-xs">${op.total_handled || 0}</span>
        </div>
    `).join('');
}

// Apply Filters
function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const statusValue = statusFilter.value;
    const priorityValue = priorityFilter.value;
    
    filteredCustomers = allCustomers.filter(customer => {
        const matchesSearch = !searchTerm || 
            customer.customer_name.toLowerCase().includes(searchTerm) ||
            customer.service.toLowerCase().includes(searchTerm) ||
            customer.chat_summary.toLowerCase().includes(searchTerm) ||
            (customer.customer_phone || '').includes(searchTerm);
        
        const matchesStatus = !statusValue || customer.status === statusValue;
        const matchesPriority = !priorityValue || customer.priority === priorityValue;
        
        return matchesSearch && matchesStatus && matchesPriority;
    });
    
    currentPage = 1;
    renderCustomers();
}

// Render Customers
function renderCustomers() {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = filteredCustomers.slice(startIndex, endIndex);
    
    document.getElementById('totalCustomers').textContent = allCustomers.length;
    
    if (pageData.length === 0) {
        customerList.innerHTML = `
            <div class="p-12 text-center text-gray-500">
                <i class="fas fa-inbox text-6xl mb-4 opacity-50"></i>
                <p class="text-lg">No customers found</p>
            </div>
        `;
        updatePagination();
        return;
    }
    
    customerList.innerHTML = pageData.map(customer => createCustomerCard(customer)).join('');
    updatePagination();
}

// Create Customer Card
function createCustomerCard(customer) {
    const date = new Date(customer.time);
    const timeStr = date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const platformIcon = customer.platform === 'whatsapp' 
        ? '<i class="fab fa-whatsapp text-green-500 text-2xl"></i>'
        : '<i class="fab fa-facebook-messenger text-blue-500 text-2xl"></i>';
    
    const statusColors = {
        'working': 'status-working',
        'success': 'status-success',
        'problem': 'status-problem',
        'pending': 'status-pending'
    };
    
    const statusEmojis = {
        'working': '🔵',
        'success': '✅',
        'problem': '❌',
        'pending': '⏳'
    };
    
    const priorityClass = `priority-${customer.priority}`;
    
    const hasDocuments = customer.documents && customer.documents.length > 0;
    const hasVoice = customer.voice_notes && customer.voice_notes.length > 0;
    
    const whatsappLink = customer.platform === 'whatsapp' 
        ? `https://wa.me/${customer.customer_phone?.replace(/\D/g, '')}`
        : `https://m.me/${customer.customer_phone}`;
    
    return `
        <div class="customer-row ${priorityClass} p-6">
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-start space-x-4">
                    <div class="flex-shrink-0">
                        ${platformIcon}
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center space-x-3 mb-2">
                            <h4 class="text-lg font-bold text-gray-800">${customer.customer_name}</h4>
                            <span class="badge ${statusColors[customer.status]} text-white">${statusEmojis[customer.status]} ${customer.status.toUpperCase()}</span>
                            ${customer.priority === 'urgent' ? '<span class="badge bg-red-500 text-white">🔥 URGENT</span>' : ''}
                        </div>
                        <p class="text-sm text-gray-600 mb-1">
                            <i class="fas fa-phone mr-2"></i>${customer.customer_phone || 'N/A'}
                            <span class="mx-2">•</span>
                            <i class="fas fa-clock mr-2"></i>${timeStr}
                        </p>
                        <p class="text-sm text-gray-700 mb-2">
                            <strong>Service:</strong> ${customer.service}
                        </p>
                        <p class="text-sm text-gray-600 italic">${customer.chat_summary}</p>
                    </div>
                </div>
                <div class="flex flex-col items-end space-y-2">
                    <span class="text-2xl font-bold text-indigo-600">NPR ${(customer.income || 0).toLocaleString()}</span>
                    <a href="${whatsappLink}" target="_blank" class="quick-action-btn bg-green-500 hover:bg-green-600 text-white">
                        <i class="fab fa-${customer.platform}"></i>
                        Open Chat
                    </a>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                    <label class="text-xs font-semibold text-gray-600 mb-1 block">Assigned To</label>
                    <select class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" onchange="assignOperator('${customer.id}', this.value)">
                        <option value="">Unassigned</option>
                        ${allOperators.map(op => `
                            <option value="${op.id}" ${customer.assigned_to === op.id ? 'selected' : ''}>
                                ${op.full_name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div>
                    <label class="text-xs font-semibold text-gray-600 mb-1 block">Status</label>
                    <select class="w-full px-3 py-2 rounded-lg text-sm text-white font-semibold ${statusColors[customer.status]}" onchange="updateStatus('${customer.id}', this.value)">
                        <option value="pending" ${customer.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                        <option value="working" ${customer.status === 'working' ? 'selected' : ''}>🔵 Working</option>
                        <option value="success" ${customer.status === 'success' ? 'selected' : ''}>✅ Success</option>
                        <option value="problem" ${customer.status === 'problem' ? 'selected' : ''}>❌ Problem</option>
                    </select>
                </div>
                
                <div>
                    <label class="text-xs font-semibold text-gray-600 mb-1 block">Priority</label>
                    <select class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" onchange="updatePriority('${customer.id}', this.value)">
                        <option value="low" ${customer.priority === 'low' ? 'selected' : ''}>⚪ Low</option>
                        <option value="normal" ${customer.priority === 'normal' ? 'selected' : ''}>🔵 Normal</option>
                        <option value="high" ${customer.priority === 'high' ? 'selected' : ''}>🟠 High</option>
                        <option value="urgent" ${customer.priority === 'urgent' ? 'selected' : ''}>🔴 Urgent</option>
                    </select>
                </div>
            </div>
            
            ${customer.problem_description ? `
                <div class="bg-red-50 border-l-4 border-red-500 p-3 rounded mb-4">
                    <p class="text-sm text-red-800">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        <strong>Problem:</strong> ${customer.problem_description}
                    </p>
                </div>
            ` : ''}
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="text-xs font-semibold text-gray-600 mb-1 block">Admin Instructions</label>
                    <textarea class="editable-area w-full text-sm" rows="2" 
                              onblur="updateField('${customer.id}', 'admin_instruction', this.value)"
                              placeholder="Enter admin instructions...">${customer.admin_instruction || ''}</textarea>
                </div>
                <div>
                    <label class="text-xs font-semibold text-gray-600 mb-1 block">Operator Notes</label>
                    <textarea class="editable-area w-full text-sm" rows="2" 
                              onblur="updateField('${customer.id}', 'operator_notes', this.value)"
                              placeholder="Operator notes...">${customer.operator_notes || ''}</textarea>
                </div>
            </div>
            
            <div class="flex items-center justify-between pt-4 border-t border-gray-200">
                <div class="flex items-center space-x-4">
                    ${hasDocuments ? `
                        <button onclick="viewMultimedia('${customer.id}', 'documents')" class="quick-action-btn bg-blue-500 hover:bg-blue-600 text-white">
                            <i class="fas fa-images"></i>
                            View Documents (${customer.documents.length})
                        </button>
                    ` : '<span class="text-gray-400 text-sm">No documents</span>'}
                    
                    ${hasVoice ? `
                        <button onclick="viewMultimedia('${customer.id}', 'voice')" class="quick-action-btn bg-purple-500 hover:bg-purple-600 text-white">
                            <i class="fas fa-microphone"></i>
                            Voice Notes (${customer.voice_notes.length})
                        </button>
                    ` : ''}
                </div>
                
                <div class="text-xs text-gray-500">
                    Last updated: ${new Date(customer.last_updated).toLocaleString()}
                </div>
            </div>
        </div>
    `;
}

// View Multimedia
function viewMultimedia(customerId, type) {
    const customer = allCustomers.find(c => c.id === customerId);
    if (!customer) return;
    
    if (type === 'documents') {
        modalTitle.innerHTML = `<i class="fas fa-images mr-2 text-indigo-600"></i>Documents - ${customer.customer_name}`;
        modalContent.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                ${customer.documents.map((url, idx) => `
                    <div class="border-2 border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition">
                        <img src="${url}" class="w-full h-auto" alt="Document ${idx + 1}">
                        <div class="p-3 bg-gray-50 flex justify-between items-center">
                            <span class="text-sm font-semibold text-gray-700">Document ${idx + 1}</span>
                            <a href="${url}" target="_blank" class="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                                <i class="fas fa-external-link-alt mr-1"></i>Open
                            </a>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (type === 'voice') {
        modalTitle.innerHTML = `<i class="fas fa-microphone mr-2 text-purple-600"></i>Voice Notes - ${customer.customer_name}`;
        modalContent.innerHTML = `
            <div class="space-y-4">
                ${customer.voice_notes.map((url, idx) => `
                    <div class="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-xl border-2 border-purple-200">
                        <div class="flex items-center justify-between mb-3">
                            <span class="font-semibold text-gray-800">
                                <i class="fas fa-volume-up mr-2 text-purple-600"></i>
                                Voice Message ${idx + 1}
                            </span>
                            <span class="text-sm text-gray-600">Customer voice note</span>
                        </div>
                        <audio controls class="audio-player">
                            <source src="${url}" type="audio/mpeg">
                            Your browser does not support audio playback.
                        </audio>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    multimediaModal.classList.add('active');
}

// Make functions global
window.viewMultimedia = viewMultimedia;
window.assignOperator = assignOperator;
window.updateStatus = updateStatus;
window.updatePriority = updatePriority;
window.updateField = updateField;

async function assignOperator(customerId, operatorId) {
    try {
        const operator = allOperators.find(op => op.id === operatorId);
        const updates = {
            assigned_to: operatorId,
            assigned_name: operator ? operator.full_name : '',
            last_updated: new Date().toISOString()
        };
        
        // Supabase Update
        await supabase.from('customers').update(updates).eq('id', customerId);
        
        const customer = allCustomers.find(c => c.id === customerId);
        if (customer) Object.assign(customer, updates);
        
        showNotification('Operator assigned successfully!', 'success');
        renderCustomers();
    } catch (error) {
        console.error('Error:', error);
        showNotification('Failed to assign operator', 'error');
    }
}

async function updateStatus(customerId, newStatus) {
    try {
        // Supabase Update
        await supabase.from('customers').update({ 
            status: newStatus,
            last_updated: new Date().toISOString()
        }).eq('id', customerId);
        
        const customer = allCustomers.find(c => c.id === customerId);
        if (customer) customer.status = newStatus;
        
        updateStats();
        renderCustomers();
        showNotification('Status updated!', 'success');
    } catch (error) {
        console.error('Error:', error);
    }
}

async function updatePriority(customerId, newPriority) {
    try {
        // Supabase Update
        await supabase.from('customers').update({ 
            priority: newPriority,
            last_updated: new Date().toISOString()
        }).eq('id', customerId);
        
        const customer = allCustomers.find(c => c.id === customerId);
        if (customer) customer.priority = newPriority;
        
        renderCustomers();
        showNotification('Priority updated!', 'success');
    } catch (error) {
        console.error('Error:', error);
    }
}

async function updateField(customerId, field, value) {
    try {
        // Supabase Update
        const payload = {};
        payload[field] = value;
        payload['last_updated'] = new Date().toISOString();
        
        await supabase.from('customers').update(payload).eq('id', customerId);
        
        const customer = allCustomers.find(c => c.id === customerId);
        if (customer) customer[field] = value;
        
        showNotification('Field updated!', 'success');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredCustomers.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize + 1;
    const endIndex = Math.min(currentPage * pageSize, filteredCustomers.length);
    
    document.getElementById('showingFrom').textContent = filteredCustomers.length > 0 ? startIndex : 0;
    document.getElementById('showingTo').textContent = endIndex;
    document.getElementById('totalRecords').textContent = filteredCustomers.length;
    document.getElementById('totalPages').textContent = totalPages;
    document.getElementById('currentPageInput').value = currentPage;
    
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages || totalPages === 0;
}

function changePage(newPage) {
    const totalPages = Math.ceil(filteredCustomers.length / pageSize);
    if (newPage < 1 || newPage > totalPages) return;
    
    currentPage = newPage;
    renderCustomers();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Utility Functions
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function showNotification(message, type = 'info') {
    const colors = {
        'success': 'bg-green-500',
        'error': 'bg-red-500',
        'info': 'bg-blue-500'
    };
    
    const notification = document.createElement('div');
    notification.className = `notification ${colors[type]} text-white`;
    notification.innerHTML = `
        <div class="flex items-center space-x-3">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'} text-xl"></i>
            <span class="font-semibold">${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Auto-refresh every 30 seconds
setInterval(() => {
    if (currentUser) {
        loadData();
        updateLastUpdateTime();
    }
}, 30000);
