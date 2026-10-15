// PassWish CRM - Minimalist Client Application

let currentTab = 'dashboard';
let currentBdayTimeframe = 'today';
let currentExpiryMonths = 6;
let searchDebounceTimer = null;
let selectedUploadFile = null;
let currentTemplates = [];
let shopSettings = {};

// Auto Queue State Tracker
let currentBirthdayItems = [];
let currentExpiryItems = [];
let currentBroadcastItems = [];
let lastSkippedItems = [];
let autoQueueState = {
    active: false,
    type: 'birthday',
    items: [],
    currentIndex: 0,
    delaySeconds: 8,
    isPaused: false,
    countdownTimer: null,
    countdownRemaining: 0,
    sentCount: 0,
    skippedCount: 0
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    lucide.createIcons();
    initCurrentUser();
    loadProfileDetails();
    loadDashboardStats();
    loadTemplates();
    loadSnapshots();
    initBrowserNotifications();
});

// --- Current User & Role Management ---
window.CURRENT_USER = null;

async function initCurrentUser() {
    try {
        const res = await fetch('/api/me');
        if (res.ok) {
            const user = await res.json();
            window.CURRENT_USER = user;

            const userBadge = document.getElementById('currentUserBadge');
            const navUserName = document.getElementById('navUserName');
            const navUserRoleBadge = document.getElementById('navUserRoleBadge');
            if (userBadge) userBadge.classList.remove('hidden');
            if (navUserName) navUserName.textContent = user.full_name || user.username;
            if (navUserRoleBadge) {
                navUserRoleBadge.textContent = user.role;
                if (user.role === 'admin') {
                    navUserRoleBadge.className = 'text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700';
                } else {
                    navUserRoleBadge.className = 'text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700';
                }
            }

            const tabUsers = document.getElementById('tab-users');
            if (tabUsers) {
                if (user.role === 'admin') {
                    tabUsers.classList.remove('hidden');
                } else {
                    tabUsers.classList.add('hidden');
                }
            }

            const adminHeaderBtn = document.getElementById('adminPortalHeaderBtn');
            if (adminHeaderBtn) {
                if (user.role === 'admin') {
                    adminHeaderBtn.classList.remove('hidden');
                } else {
                    adminHeaderBtn.classList.add('hidden');
                }
            }
        }
    } catch (e) {
        console.warn('Failed to load user info:', e);
    }
}

function initBrowserNotifications() {
    if ('Notification' in window && Notification.permission === 'default') {
        // Quietly ask for permission so browser notifications work for zero-download web users
        setTimeout(() => {
            Notification.requestPermission().catch(() => {});
        }, 3000);
    }
}

// --- Theme Engine (Light / Dark Mode) ---
function initTheme() {
    const savedTheme = localStorage.getItem('passwish_theme');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (!savedTheme && systemPrefersDark);

    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    updateThemeUI(isDark, savedTheme || 'system');
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    const newTheme = isDark ? 'dark' : 'light';
    localStorage.setItem('passwish_theme', newTheme);
    updateThemeUI(isDark, newTheme);
}

function updateThemeUI(isDark, themeMode) {
    const icon = document.getElementById('themeToggleIcon');
    const btn = document.getElementById('themeToggleBtn');
    if (icon) {
        icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        lucide.createIcons();
    }
    if (btn) {
        btn.setAttribute('title', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    }

    // Update Profile radio buttons if present
    const radLight = document.getElementById('themeRadioLight');
    const radDark = document.getElementById('themeRadioDark');
    const radSystem = document.getElementById('themeRadioSystem');
    if (radLight && radDark && radSystem) {
        if (themeMode === 'light') radLight.checked = true;
        else if (themeMode === 'dark') radDark.checked = true;
        else radSystem.checked = true;
    }
}

function handleThemeSelectChange(val) {
    if (val === 'system') {
        localStorage.removeItem('passwish_theme');
        const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', systemDark);
        updateThemeUI(systemDark, 'system');
    } else {
        localStorage.setItem('passwish_theme', val);
        const isDark = (val === 'dark');
        document.documentElement.classList.toggle('dark', isDark);
        updateThemeUI(isDark, val);
    }
}

// --- Tab Switching ---
function switchTab(tab) {
    currentTab = tab;
    const views = ['dashboard', 'customers', 'upload', 'birthdays', 'broadcast', 'expiries', 'templates', 'reports', 'safety', 'profile', 'users'];
    
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        const btn = document.getElementById(`tab-${v}`);
        if (el) el.classList.add('hidden');
        if (btn) btn.classList.remove('active');
    });

    const activeView = document.getElementById(`view-${tab}`);
    const activeBtn = document.getElementById(`tab-${tab}`);
    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) activeBtn.classList.add('active');

    // Trigger tab-specific refresh
    if (tab === 'dashboard') { loadDashboardStats(); loadProfileDetails(); }
    if (tab === 'customers') loadCustomers(1);
    if (tab === 'birthdays') loadBirthdays(currentBdayTimeframe);
    if (tab === 'broadcast') initBroadcastTab();
    if (tab === 'expiries') loadExpiries(currentExpiryMonths);
    if (tab === 'templates') loadTemplates();
    if (tab === 'reports') loadReports(1);
    if (tab === 'safety') { loadSnapshots(); loadDashboardStats(); }
    if (tab === 'profile') { loadProfileDetails(); loadReminderSettings(); }
    if (tab === 'users') loadUsers();

    setTimeout(() => lucide.createIcons(), 50);
}

// --- Dashboard Stats ---
async function loadDashboardStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        document.getElementById('statTotalCustomers').innerText = data.total_customers.toLocaleString();
        document.getElementById('statBirthdaysToday').innerText = data.birthdays_today;
        document.getElementById('statBirthdaysWeek').innerText = data.birthdays_week;
        document.getElementById('statExpiries6M').innerText = data.expiries_6m;
        document.getElementById('todayDateBadge').innerText = data.today_date;
        document.getElementById('dbTypeName').innerText = data.db_type;
        document.getElementById('safetyDbStatus').innerText = data.db_type;

        // Nav badge
        const badge = document.getElementById('badgeBdayNav');
        if (data.birthdays_today > 0) {
            badge.innerText = data.birthdays_today;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        // License Information
        if (data.license && data.license.is_valid) {
            const licBadge = document.getElementById('licBadge');
            const licBadgeText = document.getElementById('licBadgeText');
            if (licBadge) licBadge.classList.remove('hidden');
            if (licBadgeText) licBadgeText.innerText = data.license.expiry === 'LIFETIME' ? 'Lifetime License' : 'Licensed';

            const cName = document.getElementById('licClientName');
            const cExp = document.getElementById('licExpiry');
            const cMid = document.getElementById('licMachineId');
            if (cName) cName.innerText = data.license.client_name;
            if (cExp) cExp.innerText = data.license.expiry === 'LIFETIME' ? 'Lifetime (Permanent)' : `Expires on ${data.license.expiry}`;
            if (cMid) cMid.innerText = data.machine_id || data.license.machine_id;
        }

        loadDashboardBirthdaySpotlight();
    } catch (e) {
        console.error('Error loading stats:', e);
    }
}

async function loadDashboardBirthdaySpotlight() {
    const container = document.getElementById('dashTodayBirthdayList');
    try {
        const res = await fetch('/api/birthdays?timeframe=today');
        const data = await res.json();

        if (!data.birthdays || data.birthdays.length === 0) {
            container.innerHTML = `
                <div class="text-center py-6 text-zinc-400 text-xs">
                    No birthdays today. Switch to the 'Birthday Wishes' tab to view upcoming dates.
                </div>
            `;
            return;
        }

        container.innerHTML = data.birthdays.slice(0, 5).map(item => `
            <div class="flex items-center justify-between p-3 rounded-lg border border-zinc-100 hover:border-zinc-200 transition">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center font-bold text-xs">
                        🎂
                    </div>
                    <div>
                        <h4 class="font-medium text-zinc-900 text-xs">${escapeHtml(item.customer.name)}</h4>
                        <p class="text-zinc-400 text-[11px] font-mono">${item.customer.phone} ${item.customer.city ? '• ' + item.customer.city : ''}</p>
                    </div>
                </div>
                <button type="button" onclick="promptOrSendWhatsApp(${JSON.stringify(item.customer).replace(/"/g, '&quot;')}, ${JSON.stringify(item.rendered_message).replace(/"/g, '&quot;')}, 'birthday', this)" class="inline-flex items-center gap-1 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs rounded transition">
                    <i data-lucide="send" class="w-3 h-3"></i>
                    <span>WhatsApp</span>
                </button>
            </div>
        `).join('');

        lucide.createIcons();
    } catch (e) {
        console.error('Spotlight error:', e);
    }
}

// --- Customer Directory ---
let custPage = 1;
let custLimit = 25;

function renderServiceStatusDropdown(id, currentStatus) {
    const statuses = [
        { val: 'New', label: 'New', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
        { val: 'Alert Sent', label: 'Alert Sent', color: 'bg-blue-50 text-blue-700 border-blue-200' },
        { val: 'In Discussion', label: 'In Discussion', color: 'bg-amber-50 text-amber-700 border-amber-200' },
        { val: 'Docs Collected', label: 'Docs Collected', color: 'bg-purple-50 text-purple-700 border-purple-200' },
        { val: 'Appointment / Applied', label: 'Appointment / Applied', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
        { val: 'Passport Delivered', label: 'Delivered', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        { val: 'Not Interested', label: 'Not Interested', color: 'bg-red-50 text-red-700 border-red-200' }
    ];
    const cur = currentStatus || 'New';
    const found = statuses.find(s => s.val === cur) || statuses[0];

    return `
        <select onchange="updateServiceStatus(${id}, this.value, this)" class="text-[11px] font-medium rounded px-1.5 py-0.5 border ${found.color} focus:outline-none transition cursor-pointer">
            ${statuses.map(s => `<option value="${s.val}" ${s.val === cur ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
    `;
}

async function updateServiceStatus(id, newStatus, selectElem) {
    try {
        const res = await fetch(`/api/customers/${id}/service-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (data.status === 'success' && selectElem) {
            const colors = {
                'New': 'bg-zinc-100 text-zinc-700 border-zinc-200',
                'Alert Sent': 'bg-blue-50 text-blue-700 border-blue-200',
                'In Discussion': 'bg-amber-50 text-amber-700 border-amber-200',
                'Docs Collected': 'bg-purple-50 text-purple-700 border-purple-200',
                'Appointment / Applied': 'bg-indigo-50 text-indigo-700 border-indigo-200',
                'Passport Delivered': 'bg-emerald-50 text-emerald-700 border-emerald-200',
                'Not Interested': 'bg-red-50 text-red-700 border-red-200'
            };
            selectElem.className = `text-[11px] font-medium rounded px-1.5 py-0.5 border ${colors[newStatus] || colors['New']} focus:outline-none transition cursor-pointer`;
        }
    } catch (e) {
        console.error('Failed to update service status:', e);
    }
}

async function loadCustomers(page = 1) {
    custPage = page;
    const search = document.getElementById('custSearchInput').value.trim();
    const month = document.getElementById('custMonthFilter').value;
    const expiry = document.getElementById('custExpiryFilter').value;
    const serviceStatus = document.getElementById('custStatusFilter') ? document.getElementById('custStatusFilter').value : 'all';
    const waStatus = document.getElementById('custWaFilter') ? document.getElementById('custWaFilter').value : 'all';

    const tbody = document.getElementById('customersTableBody');
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-zinc-400">Loading customer records...</td></tr>`;

    try {
        const url = `/api/customers?page=${page}&limit=${custLimit}&q=${encodeURIComponent(search)}&month=${month}&expiry_window=${expiry}&service_status=${serviceStatus}&wa_status=${waStatus}`;
        const res = await fetch(url);
        const data = await res.json();

        document.getElementById('custTotalCount').innerText = data.total.toLocaleString();
        document.getElementById('custCurrentPage').innerText = data.page;
        document.getElementById('custTotalPages').innerText = data.pages || 1;

        document.getElementById('custBtnPrev').disabled = (data.page <= 1);
        document.getElementById('custBtnNext').disabled = (data.page >= data.pages);

        if (!data.customers || data.customers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-zinc-400">No customer records found.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.customers.map(c => `
            <tr class="hover:bg-zinc-50/80 transition border-b border-zinc-100">
                <td class="px-4 py-2.5 font-medium text-zinc-900">${escapeHtml(c.name)}</td>
                <td class="px-4 py-2.5 font-mono text-zinc-600">
                    <div class="flex items-center gap-1.5">
                        <span class="font-semibold text-zinc-800">${c.phone}</span>
                        ${c.whatsapp_status === 'no_whatsapp' 
                            ? `<button type="button" onclick="toggleWhatsAppStatus(${c.id}, 'active')" class="px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition" title="No WhatsApp recorded. Click to mark active">No WA</button>`
                            : `<button type="button" onclick="toggleWhatsAppStatus(${c.id}, 'no_whatsapp')" class="opacity-30 hover:opacity-100 text-zinc-400 hover:text-red-600 text-xs px-1" title="Mark as No WhatsApp">⊘</button>`}
                    </div>
                    ${c.phone2 ? `<div class="text-[11px] text-zinc-500 font-mono flex items-center gap-1 mt-0.5"><span class="text-[9px] bg-blue-50 text-blue-700 px-1 py-0.2 rounded border border-blue-200 font-sans font-medium">Alt</span><span>${c.phone2}</span></div>` : ''}
                </td>
                <td class="px-4 py-2.5 text-zinc-600">${c.dob || '<span class="text-zinc-300">-</span>'}</td>
                <td class="px-4 py-2.5 font-mono text-zinc-700">${c.passport_no || '<span class="text-zinc-300">-</span>'}</td>
                <td class="px-4 py-2.5 text-zinc-600">${formatExpiryBadge(c.expiry_date)}</td>
                <td class="px-4 py-2.5">${renderServiceStatusDropdown(c.id, c.service_status)}</td>
                <td class="px-4 py-2.5 text-zinc-600">${c.city || '<span class="text-zinc-300">-</span>'}</td>
                <td class="px-4 py-2.5 text-right">
                    <div class="inline-flex items-center gap-1">
                        <button onclick="handleCustomerWhatsAppClick(${JSON.stringify(c).replace(/"/g, '&quot;')})" class="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded" title="Send WhatsApp">
                            <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="editCustomer(${JSON.stringify(c).replace(/"/g, '&quot;')})" class="p-1 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded" title="Edit">
                            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="deleteCustomer(${c.id})" class="p-1 text-zinc-400 hover:text-red-600 hover:bg-zinc-100 rounded" title="Delete">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        lucide.createIcons();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-red-500">Error: ${e.message}</td></tr>`;
    }
}

async function toggleWhatsAppStatus(id, newStatus) {
    try {
        const res = await fetch(`/api/customers/${id}/toggle-whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (data.status === 'success') {
            loadCustomers(custPage);
        }
    } catch (err) {
        console.error('Failed to toggle whatsapp status:', err);
    }
}

function formatExpiryBadge(expDate) {
    if (!expDate) return '<span class="text-zinc-300">-</span>';
    const now = new Date();
    const exp = new Date(expDate);
    const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return `<span class="bg-red-50 text-red-700 border border-red-200 text-[10px] px-1.5 py-0.5 rounded font-medium">Expired (${expDate})</span>`;
    } else if (diffDays <= 180) {
        return `<span class="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] px-1.5 py-0.5 rounded font-medium">⏳ ${diffDays}d (${expDate})</span>`;
    }
    return `<span>${expDate}</span>`;
}

function debounceCustomerSearch() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        loadCustomers(1);
    }, 300);
}

function changeCustomerPage(delta) {
    loadCustomers(custPage + delta);
}

// Add / Edit Customer Modal
function openAddCustomerModal() {
    document.getElementById('custModalTitle').innerText = 'Add New Customer';
    document.getElementById('custFormId').value = '';
    document.getElementById('customerForm').reset();
    const p2 = document.getElementById('custFormPhone2');
    if (p2) p2.value = '';
    document.getElementById('customerModal').classList.remove('hidden');
}

function editCustomer(c) {
    document.getElementById('custModalTitle').innerText = 'Edit Customer Details';
    document.getElementById('custFormId').value = c.id;
    document.getElementById('custFormName').value = c.name;
    document.getElementById('custFormPhone').value = c.phone;
    const p2 = document.getElementById('custFormPhone2');
    if (p2) p2.value = c.phone2 || '';
    document.getElementById('custFormDob').value = c.dob || '';
    document.getElementById('custFormPassport').value = c.passport_no || '';
    document.getElementById('custFormExpiry').value = c.expiry_date || '';
    document.getElementById('custFormCity').value = c.city || '';
    document.getElementById('custFormNotes').value = c.notes || '';
    document.getElementById('customerModal').classList.remove('hidden');
}

function closeCustomerModal() {
    document.getElementById('customerModal').classList.add('hidden');
}

async function submitCustomerForm(e) {
    e.preventDefault();
    const id = document.getElementById('custFormId').value;
    const p2Input = document.getElementById('custFormPhone2');
    const payload = {
        name: document.getElementById('custFormName').value.trim(),
        phone: document.getElementById('custFormPhone').value.trim(),
        phone2: p2Input ? p2Input.value.trim() : '',
        dob: document.getElementById('custFormDob').value,
        passport_no: document.getElementById('custFormPassport').value.trim(),
        expiry_date: document.getElementById('custFormExpiry').value,
        city: document.getElementById('custFormCity').value.trim(),
        notes: document.getElementById('custFormNotes').value.trim()
    };

    const url = id ? `/api/customers/${id}` : '/api/customers';
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.status === 401) {
            alert('Your session has expired. Please log in again.');
            window.location.href = '/login';
            return;
        }
        const data = await res.json();
        if (res.ok) {
            closeCustomerModal();
            alert(id ? 'Customer updated successfully!' : 'Customer added successfully!');
            loadCustomers(custPage);
            loadDashboardStats();
        } else {
            alert(data.error || 'Failed to save customer');
        }
    } catch (err) {
        alert('Server error: ' + err.message);
    }
}

async function deleteCustomer(id) {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    try {
        const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadCustomers(custPage);
            loadDashboardStats();
        } else {
            alert('Failed to delete customer.');
        }
    } catch (e) {
        alert(e.message);
    }
}

// --- WhatsApp Messaging with Dual-Number Selector (Primary / Secondary / Both) ---
let pendingWaCustomer = null;
let pendingWaMessage = '';
let pendingWaType = 'direct';
let pendingWaBtn = null;

function promptOrSendWhatsApp(customer, messageText, messageType = 'direct', btnElement = null) {
    if (!customer) return;

    // Normalize customer phone numbers
    const p1 = customer.phone ? String(customer.phone).trim() : '';
    const p2 = customer.phone2 ? String(customer.phone2).trim() : '';

    // If customer has ONLY 1 phone number, send directly without extra modal prompt
    if (!p2) {
        const url = `https://web.whatsapp.com/send?phone=${p1}&text=${encodeURIComponent(messageText)}`;
        window.open(url, '_blank');
        logMessageSent(customer.id, customer.name, p1, messageType, messageText);
        if (btnElement && btnElement.classList) {
            btnElement.classList.add('opacity-50');
        }
        return;
    }

    // Customer has BOTH Primary and Secondary numbers -> Open Selection Modal!
    pendingWaCustomer = customer;
    pendingWaMessage = messageText;
    pendingWaType = messageType;
    pendingWaBtn = btnElement;

    const nameEl = document.getElementById('waSelectCustName');
    const p1El = document.getElementById('waSelectPhone1');
    const p2El = document.getElementById('waSelectPhone2');
    const modalEl = document.getElementById('waSelectModal');

    if (nameEl) nameEl.textContent = `${customer.name} — २ मोबाईल नंबर उपलब्ध आहेत`;
    if (p1El) p1El.textContent = p1;
    if (p2El) p2El.textContent = p2;
    if (modalEl) {
        modalEl.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
    }
}

function closeWaSelectModal() {
    const modalEl = document.getElementById('waSelectModal');
    if (modalEl) modalEl.classList.add('hidden');
    pendingWaCustomer = null;
    pendingWaMessage = '';
    pendingWaType = 'direct';
    pendingWaBtn = null;
}

function dispatchSelectedWa(target) {
    if (!pendingWaCustomer) {
        closeWaSelectModal();
        return;
    }

    const c = pendingWaCustomer;
    const msg = pendingWaMessage;
    const type = pendingWaType;
    const btn = pendingWaBtn;

    const p1 = c.phone ? String(c.phone).trim() : '';
    const p2 = c.phone2 ? String(c.phone2).trim() : '';

    if (target === 'primary') {
        const url1 = `https://web.whatsapp.com/send?phone=${p1}&text=${encodeURIComponent(msg)}`;
        window.open(url1, '_blank');
        logMessageSent(c.id, c.name, p1, type, msg);
    } else if (target === 'secondary') {
        const url2 = `https://web.whatsapp.com/send?phone=${p2}&text=${encodeURIComponent(msg)}`;
        window.open(url2, '_blank');
        logMessageSent(c.id, c.name, p2, type, msg);
    } else if (target === 'both') {
        // Open Primary WhatsApp
        const url1 = `https://web.whatsapp.com/send?phone=${p1}&text=${encodeURIComponent(msg)}`;
        window.open(url1, '_blank');
        logMessageSent(c.id, c.name, p1, type, msg);

        // Open Secondary WhatsApp with short delay to allow browser tab creation
        setTimeout(() => {
            const url2 = `https://web.whatsapp.com/send?phone=${p2}&text=${encodeURIComponent(msg)}`;
            window.open(url2, '_blank');
            logMessageSent(c.id, c.name, p2, type, msg);
        }, 500);
    }

    if (btn && btn.classList) {
        btn.classList.add('opacity-50');
    }

    closeWaSelectModal();
}

function handleCustomerWhatsAppClick(c) {
    const defaultText = `Hello ${c.name}, greetings from our passport consultancy. Please let us know if you need any assistance with your passport application or renewal.`;
    promptOrSendWhatsApp(c, defaultText, 'direct');
}

function openCustomerWhatsApp(phone, name) {
    if (typeof phone === 'object') {
        handleCustomerWhatsAppClick(phone);
        return;
    }
    const text = `Hello ${name || ''}, thank you for contacting us. Please let us know if you need any assistance with your passport services.`;
    const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

// --- Excel Import & Smart Weekly Append ---
function handleFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    selectedUploadFile = file;
    document.getElementById('uploadFileTitle').innerText = file.name;
    document.getElementById('selectedFileBadge').innerText = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    document.getElementById('selectedFileBadge').classList.remove('hidden');

    uploadPreview(file);
}

async function uploadPreview(file) {
    const formData = new FormData();
    formData.append('file', file);

    const previewSection = document.getElementById('uploadPreviewSection');
    const thead = document.getElementById('previewTableHead');
    const tbody = document.getElementById('previewTableBody');

    try {
        const res = await fetch('/api/upload/preview', {
            method: 'POST',
            body: formData
        });
        if (res.status === 401) {
            alert('Your session has expired. Please log in again.');
            window.location.href = '/login';
            return;
        }
        const data = await res.json();

        if (data.status === 'success') {
            thead.innerHTML = '<tr>' + data.columns.map(c => `<th class="px-3 py-2 border-b">${escapeHtml(c)}</th>`).join('') + '</tr>';
            tbody.innerHTML = data.preview_rows.map(row => 
                '<tr class="hover:bg-zinc-50 border-b border-zinc-100">' + 
                data.columns.map(c => `<td class="px-3 py-2 text-zinc-700">${escapeHtml(row[c] || '')}</td>`).join('') + 
                '</tr>'
            ).join('');

            previewSection.classList.remove('hidden');
            document.getElementById('uploadResultCard').classList.add('hidden');
            lucide.createIcons();
        } else {
            alert(data.message || data.error || 'Error parsing file.');
        }
    } catch (e) {
        alert('Server communication error: ' + e.message + '\nPlease ensure the Python server is running (run_app.bat or python app.py).');
    }
}

function cancelUploadPreview() {
    selectedUploadFile = null;
    document.getElementById('excelFileInput').value = '';
    document.getElementById('uploadFileTitle').innerText = 'Click to choose Excel/CSV file or drag and drop';
    document.getElementById('selectedFileBadge').classList.add('hidden');
    document.getElementById('uploadPreviewSection').classList.add('hidden');
}

async function executeUploadProcess() {
    if (!selectedUploadFile) return;

    const mode = document.querySelector('input[name="importMode"]:checked').value;
    const btn = document.getElementById('btnStartImport');
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Processing...`;
    lucide.createIcons();

    const formData = new FormData();
    formData.append('file', selectedUploadFile);
    formData.append('mode', mode);

    try {
        const res = await fetch('/api/upload/process', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.status === 'success') {
            document.getElementById('uploadPreviewSection').classList.add('hidden');
            const resCard = document.getElementById('uploadResultCard');
            document.getElementById('resTotalRows').innerText = data.total_rows.toLocaleString();
            document.getElementById('resAdded').innerText = data.added.toLocaleString();
            document.getElementById('resSkipped').innerText = data.skipped_duplicates.toLocaleString();
            document.getElementById('resFinalTotal').innerText = data.current_total_customers.toLocaleString();
            resCard.classList.remove('hidden');

            loadDashboardStats();
            loadSnapshots();
        } else {
            alert(data.message || 'Import failed.');
        }
    } catch (e) {
        alert('Server error: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="database" class="w-3.5 h-3.5"></i> Save / Append to Database`;
        lucide.createIcons();
    }
}

// --- Birthday Hub ---
async function loadBirthdays(timeframe = 'today') {
    currentBdayTimeframe = timeframe;
    const container = document.getElementById('birthdayListContainer');
    container.innerHTML = `<div class="text-center py-6 text-zinc-400 text-xs">Finding birthdays...</div>`;

    ['today', 'tomorrow', 'week'].forEach(t => {
        const btn = document.getElementById(`bdayBtn-${t}`);
        if (t === timeframe) {
            btn.className = 'bday-filter-btn px-3 py-1 font-medium rounded text-zinc-800 bg-white shadow-xs';
        } else {
            btn.className = 'bday-filter-btn px-3 py-1 font-medium rounded text-zinc-500 hover:text-zinc-800';
        }
    });

    const templateId = document.getElementById('bdayTemplateSelect').value;

    try {
        const url = `/api/birthdays?timeframe=${timeframe}${templateId ? '&template_id=' + templateId : ''}`;
        const res = await fetch(url);
        const data = await res.json();

        currentBirthdayItems = data.birthdays || [];

        if (!data.birthdays || data.birthdays.length === 0) {
            container.innerHTML = `
                <div class="text-center py-10 text-zinc-400 bg-white rounded-lg border border-zinc-200 text-xs">
                    No birthdays found for this timeframe.
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="flex justify-between items-center text-xs text-zinc-500 px-1">
                <span>Matching Birthdays: <strong>${data.birthdays.length}</strong></span>
                <span>Click WhatsApp or run <strong>⚡ Start Auto Queue</strong></span>
            </div>
            ${data.birthdays.map(b => `
                <div class="bg-white border border-zinc-200 rounded-lg p-3 hover:border-zinc-300 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3" id="bday-row-${b.customer.id}">
                    <div class="space-y-1 max-w-xl">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-medium text-zinc-900 text-xs">${escapeHtml(b.customer.name)}</span>
                            <span class="text-[11px] font-mono text-zinc-600 font-semibold">${b.customer.phone}</span>
                            ${b.customer.phone2 ? `<span class="text-[10px] text-blue-700 font-mono bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">Alt: ${b.customer.phone2}</span>` : ''}
                            <span class="text-[11px] text-zinc-400">DOB: ${b.customer.dob || ''}</span>
                        </div>
                        <p class="text-xs text-zinc-600 bg-zinc-50 p-2 rounded border border-zinc-100 whitespace-pre-line leading-relaxed">${escapeHtml(b.rendered_message)}</p>
                    </div>
                    <div class="flex sm:flex-col items-center gap-2 w-full sm:w-auto">
                        <button type="button" data-cust-btn="${b.customer.id}" onclick="promptOrSendWhatsApp(${JSON.stringify(b.customer).replace(/"/g, '&quot;')}, ${JSON.stringify(b.rendered_message).replace(/"/g, '&quot;')}, 'birthday', this)" class="w-full sm:w-auto px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs rounded transition flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs">
                            <i data-lucide="send" class="w-3 h-3"></i> Send WhatsApp
                        </button>
                        <button onclick="copyToClipboard('${escapeHtml(b.rendered_message)}')" class="text-[11px] text-zinc-400 hover:text-zinc-700">
                            Copy Text
                        </button>
                    </div>
                </div>
            `).join('')}
        `;
        lucide.createIcons();
    } catch (e) {
        container.innerHTML = `<div class="text-center py-6 text-red-500 text-xs">Error: ${e.message}</div>`;
    }
}

// --- Festival Broadcast ---
function initBroadcastTab() {
    loadBroadcastTemplates();
    handleFestivalSelectChange();
}

function handleFestivalSelectChange() {
    const val = document.getElementById('broadcastFestivalSelect').value;
    const wrapper = document.getElementById('customFestivalInputWrapper');
    if (val === 'custom') {
        wrapper.classList.remove('hidden');
    } else {
        wrapper.classList.add('hidden');
    }
    loadBroadcastTemplateBody();
}

function handleAudienceChange() {
    const val = document.getElementById('broadcastTargetSelect').value;
    const cityWrap = document.getElementById('broadcastCityWrapper');
    if (val === 'city') {
        cityWrap.classList.remove('hidden');
    } else {
        cityWrap.classList.add('hidden');
    }
}

function loadBroadcastTemplates() {
    const select = document.getElementById('broadcastTemplateSelect');
    const festivalTpls = currentTemplates.filter(t => t.category === 'diwali' || t.category === 'festival' || t.category === 'general');
    
    select.innerHTML = festivalTpls.map(t => `
        <option value="${t.id}">${t.name} (${t.category})</option>
    `).join('');

    loadBroadcastTemplateBody();
}

function loadBroadcastTemplateBody() {
    const select = document.getElementById('broadcastTemplateSelect');
    const tid = parseInt(select.value);
    const tpl = currentTemplates.find(t => t.id === tid);
    if (tpl) {
        document.getElementById('broadcastBodyText').value = tpl.body;
    }
}

function insertTag(tag) {
    const textarea = document.getElementById('broadcastBodyText');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    textarea.value = text.substring(0, start) + tag + text.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + tag.length;
}

async function generateBroadcastPreview() {
    const festivalSelect = document.getElementById('broadcastFestivalSelect').value;
    const festivalName = festivalSelect === 'custom' 
        ? (document.getElementById('customFestivalInput').value.trim() || 'Festival')
        : festivalSelect;

    const target = document.getElementById('broadcastTargetSelect').value;
    const city = document.getElementById('broadcastCityInput').value.trim();
    const body = document.getElementById('broadcastBodyText').value.trim();

    const listContainer = document.getElementById('broadcastPreviewList');
    listContainer.innerHTML = `<div class="text-center py-8 text-zinc-400 text-xs">Generating previews...</div>`;

    try {
        const res = await fetch('/api/broadcast/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                target: target,
                city: city,
                festival_name: festivalName,
                body: body
            })
        });
        const data = await res.json();

        currentBroadcastItems = data.recipients || [];
        document.getElementById('broadcastRecipientCount').innerText = data.total_recipients.toLocaleString();

        if (!data.recipients || data.recipients.length === 0) {
            listContainer.innerHTML = `
                <div class="text-center py-10 text-zinc-400 text-xs bg-white rounded border border-zinc-200">
                    No customers match the selected filter.
                </div>
            `;
            return;
        }

        listContainer.innerHTML = data.recipients.map((r, i) => `
            <div class="p-3 bg-white border border-zinc-200 rounded-lg hover:border-zinc-300 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div class="space-y-1 max-w-lg">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="w-4 h-4 rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-mono flex items-center justify-center">${i + 1}</span>
                        <h4 class="font-medium text-xs text-zinc-900">${escapeHtml(r.name)}</h4>
                        <span class="text-[11px] font-mono text-zinc-600 font-semibold">${r.phone}</span>
                        ${r.phone2 ? `<span class="text-[10px] text-blue-700 font-mono bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">Alt: ${r.phone2}</span>` : ''}
                    </div>
                    <div class="text-xs text-zinc-700 bg-zinc-50 p-2 rounded border border-zinc-100 whitespace-pre-line leading-relaxed">
                        ${escapeHtml(r.message)}
                    </div>
                </div>
                <button type="button" onclick="promptOrSendWhatsApp(${JSON.stringify(r).replace(/"/g, '&quot;')}, ${JSON.stringify(r.message).replace(/"/g, '&quot;')}, 'festival', this)" class="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs rounded transition flex items-center gap-1 whitespace-nowrap shadow-xs">
                    <i data-lucide="send" class="w-3 h-3"></i> Send
                </button>
            </div>
        `).join('');

        lucide.createIcons();
    } catch (e) {
        listContainer.innerHTML = `<div class="text-center py-6 text-red-500 text-xs">Error: ${e.message}</div>`;
    }
}

// --- Passport Expiry Radar ---
async function loadExpiries(months = 6) {
    currentExpiryMonths = months;
    const container = document.getElementById('expiryListContainer');
    container.innerHTML = `<div class="text-center py-6 text-zinc-400 text-xs">Checking validity dates...</div>`;

    [3, 6, 12].forEach(m => {
        const btn = document.getElementById(`expBtn-${m}`);
        if (m === months) {
            btn.className = 'exp-filter-btn px-3 py-1 font-medium rounded text-zinc-800 bg-white shadow-xs';
        } else {
            btn.className = 'exp-filter-btn px-3 py-1 font-medium rounded text-zinc-500 hover:text-zinc-800';
        }
    });

    try {
        const res = await fetch(`/api/expiries?months=${months}`);
        const data = await res.json();
        currentExpiryItems = data.customers || [];

        if (!data.customers || data.customers.length === 0) {
            container.innerHTML = `
                <div class="text-center py-10 text-zinc-400 bg-white rounded-lg border border-zinc-200 text-xs">
                    No passports expiring within the next ${months} months.
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="flex justify-between items-center text-xs text-zinc-500 px-1">
                <span>Expiring Passports: <strong>${data.total}</strong></span>
                <span>Click Renewal Alert or run <strong>⚡ Start Auto Queue</strong></span>
            </div>
            ${data.customers.map(item => `
                <div class="bg-white border border-zinc-200 rounded-lg p-3 hover:border-zinc-300 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3" id="expiry-row-${item.customer.id}">
                    <div class="space-y-1 max-w-xl">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-medium text-zinc-900 text-xs">${item.customer.name}</span>
                            <span class="text-[11px] font-mono text-zinc-600 font-semibold">${item.customer.phone}</span>
                            ${item.customer.phone2 ? `<span class="text-[10px] text-blue-700 font-mono bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">Alt: ${item.customer.phone2}</span>` : ''}
                            <span class="text-[11px] font-mono text-zinc-500">Passport: ${item.customer.passport_no || 'N/A'}</span>
                            <span class="text-[11px] font-semibold text-amber-700">Exp: ${item.customer.expiry_date}</span>
                        </div>
                        <p class="text-xs text-zinc-600 bg-zinc-50 p-2 rounded border border-zinc-100 whitespace-pre-line leading-relaxed">${escapeHtml(item.rendered_message)}</p>
                    </div>
                    <div class="flex sm:flex-col items-center gap-2 w-full sm:w-auto">
                        <button type="button" data-cust-btn="${item.customer.id}" onclick="promptOrSendWhatsApp(${JSON.stringify(item.customer).replace(/"/g, '&quot;')}, ${JSON.stringify(item.rendered_message).replace(/"/g, '&quot;')}, 'expiry', this)" class="w-full sm:w-auto px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs rounded transition flex items-center justify-center gap-1 whitespace-nowrap shadow-xs">
                            <i data-lucide="send" class="w-3 h-3"></i> Renewal Alert
                        </button>
                        <button onclick="copyToClipboard('${escapeHtml(item.rendered_message)}')" class="text-[11px] text-zinc-400 hover:text-zinc-700">
                            Copy Text
                        </button>
                    </div>
                </div>
            `).join('')}
        `;
        lucide.createIcons();
    } catch (e) {
        container.innerHTML = `<div class="text-center py-6 text-red-500 text-xs">Error: ${e.message}</div>`;
    }
}

// --- Automated WhatsApp Queue Dispatcher (Desktop Hands-Free Bot) ---
let botPollTimer = null;

async function startAutoQueue(type) {
    let itemsToProcess = [];
    let title = '';
    let subtitle = '';

    if (type === 'birthday') {
        if (!currentBirthdayItems || currentBirthdayItems.length === 0) {
            alert('No birthday contacts found for this timeframe to send.');
            return;
        }
        itemsToProcess = currentBirthdayItems.map(item => ({
            id: item.customer.id,
            name: item.customer.name,
            phone: item.customer.phone,
            message: item.rendered_message,
            whatsapp_status: item.customer.whatsapp_status || 'active',
            category: 'birthday'
        }));
        title = 'Automated Birthday Wishes (Hands-Free Bot)';
        subtitle = `Sequential zero-click WhatsApp sending for ${itemsToProcess.length} contact(s)`;
    } else if (type === 'expiry') {
        if (!currentExpiryItems || currentExpiryItems.length === 0) {
            alert('No expiring passports found in this timeframe to send.');
            return;
        }
        itemsToProcess = currentExpiryItems.map(item => ({
            id: item.customer.id,
            name: item.customer.name,
            phone: item.customer.phone,
            message: item.rendered_message,
            whatsapp_status: item.customer.whatsapp_status || 'active',
            category: 'expiry'
        }));
        title = 'Automated Passport Renewal Alerts (Hands-Free Bot)';
        subtitle = `Sequential zero-click WhatsApp sending for ${itemsToProcess.length} renewal alert(s)`;
    } else if (type === 'broadcast') {
        if (!currentBroadcastItems || currentBroadcastItems.length === 0) {
            alert('Please click "Generate Recipient Preview" first to load recipients.');
            return;
        }
        itemsToProcess = currentBroadcastItems.map(item => ({
            id: item.id,
            name: item.name,
            phone: item.phone,
            message: item.message,
            whatsapp_status: item.whatsapp_status || 'active',
            category: 'broadcast'
        }));
        title = 'Automated Festival Broadcast (Hands-Free Bot)';
        subtitle = `Sequential zero-click WhatsApp sending for ${itemsToProcess.length} contact(s)`;
    }

    // Check if on cloud/remote host or mobile device where desktop GUI bot cannot run
    const isCloudOrRemote = window.location.hostname !== '127.0.0.1' && window.location.hostname !== 'localhost';
    const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
    if (isCloudOrRemote || isMobile) {
        startWebQueue(type, itemsToProcess);
        return;
    }

    const delayEl = document.getElementById('queueDelaySelect');
    const delaySec = delayEl ? (parseInt(delayEl.value) || 5) : 5;

    // Reset Modal UI
    document.getElementById('queueModalTitle').innerText = title;
    document.getElementById('queueModalSubtitle').innerText = subtitle;
    document.getElementById('queueActiveContainer').classList.remove('hidden');
    document.getElementById('queueControlFooter').classList.remove('hidden');
    document.getElementById('queueCompletedCard').classList.add('hidden');
    document.getElementById('autoQueueModal').classList.remove('hidden');

    // Initial state
    document.getElementById('queueProgressLabel').innerText = `Preparing 1 of ${itemsToProcess.length}...`;
    document.getElementById('queueProgressPercent').innerText = `0%`;
    document.getElementById('queueProgressBar').style.width = `0%`;
    document.getElementById('queueContactName').innerText = itemsToProcess[0].name;
    document.getElementById('queueContactPhone').innerText = itemsToProcess[0].phone;
    document.getElementById('queueMessagePreview').innerText = itemsToProcess[0].message;
    document.getElementById('queueStatusText').innerText = 'Starting automated bot...';

    const statusBadge = document.getElementById('queueStatusBadge');
    if (statusBadge) {
        statusBadge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5';
    }
    lucide.createIcons();

    try {
        const res = await fetch('/api/bot/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: type,
                delay: delaySec,
                items: itemsToProcess,
                image_path: (type === 'broadcast' ? broadcastPosterPath : (type === 'birthday' ? birthdayPosterPath : ''))
            })
        });
        const data = await res.json();
        if (data.status === 'already_running') {
            alert('A WhatsApp bot task is already running. Please wait or stop it first.');
        }

        // Start polling bot status every 500ms for ultra responsiveness
        if (botPollTimer) clearInterval(botPollTimer);
        botPollTimer = setInterval(pollBotStatus, 500);
    } catch (err) {
        console.warn('Desktop bot could not start, falling back to Web Queue:', err);
        document.getElementById('autoQueueModal').classList.add('hidden');
        startWebQueue(type, itemsToProcess);
    }
}

async function skipCurrentContact() {
    try {
        const res = await fetch('/api/bot/skip', { method: 'POST' });
        const data = await res.json();
        const statusText = document.getElementById('queueStatusText');
        if (statusText) statusText.innerText = 'Skipping contact and closing tab...';
    } catch (err) {
        console.error('Error skipping contact:', err);
    }
}

function copySkippedList() {
    if (!lastSkippedItems || lastSkippedItems.length === 0) {
        alert('No skipped numbers to copy.');
        return;
    }
    const text = lastSkippedItems.map(it => `${it.name}, ${it.phone}, ${it.reason}`).join('\n');
    copyToClipboard(text);
    alert(`Copied ${lastSkippedItems.length} skipped numbers to clipboard!`);
}

async function pollBotStatus() {
    try {
        const res = await fetch('/api/bot/status');
        const data = await res.json();

        if (data.status === 'idle') return;

        const currentNum = data.current || 0;
        const total = data.total || 1;
        const percent = Math.min(100, Math.round((currentNum / total) * 100));

        // Update progress UI
        const labelEl = document.getElementById('queueProgressLabel');
        const percentEl = document.getElementById('queueProgressPercent');
        const barEl = document.getElementById('queueProgressBar');
        if (labelEl) labelEl.innerText = `Contact ${currentNum} of ${total}`;
        if (percentEl) percentEl.innerText = `${percent}%`;
        if (barEl) barEl.style.width = `${percent}%`;

        // Update contact card if active
        if (data.current_name) {
            const nameEl = document.getElementById('queueContactName');
            const phoneEl = document.getElementById('queueContactPhone');
            const previewEl = document.getElementById('queueMessagePreview');
            if (nameEl) nameEl.innerText = data.current_name;
            if (phoneEl) phoneEl.innerText = data.current_phone;
            if (previewEl && data.current_message) previewEl.innerText = data.current_message;
        }

        // Update status text and badges
        const statusText = document.getElementById('queueStatusText');
        const statusBadge = document.getElementById('queueStatusBadge');
        if (statusText && data.status_text) {
            statusText.innerText = data.status_text;
        }
        if (statusBadge) {
            if (data.status === 'cooling_down') {
                statusBadge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1.5';
            } else {
                statusBadge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5';
            }
        }

        // Mark row in list as sent
        if (data.current_id) {
            markCustomerRowSent(data.current_id);
        }

        // Check if finished
        if (data.status === 'finished') {
            clearInterval(botPollTimer);
            botPollTimer = null;
            document.getElementById('queueActiveContainer').classList.add('hidden');
            document.getElementById('queueControlFooter').classList.add('hidden');
            document.getElementById('queueCompletedCard').classList.remove('hidden');

            const sentCountEl = document.getElementById('queueStatSentCount');
            const skipCountEl = document.getElementById('queueStatSkippedCount');
            if (sentCountEl) sentCountEl.innerText = data.sent_count || 0;
            if (skipCountEl) skipCountEl.innerText = data.skipped_count || 0;

            const stats = `Completed! ${data.sent_count} sent, ${data.skipped_count} skipped of ${data.total} total contacts.`;
            document.getElementById('queueCompletedStats').innerText = stats;

            lastSkippedItems = data.skipped_items || [];
            const skippedSec = document.getElementById('queueSkippedListSection');
            const skippedList = document.getElementById('queueSkippedItemsList');
            if (lastSkippedItems.length > 0 && skippedSec && skippedList) {
                skippedSec.classList.remove('hidden');
                skippedList.innerHTML = lastSkippedItems.map(it => `
                    <div class="flex items-center justify-between p-1 bg-white rounded border border-zinc-200">
                        <span><strong>${escapeHtml(it.name)}</strong> (${it.phone})</span>
                        <span class="text-amber-700 font-semibold">${escapeHtml(it.reason)}</span>
                    </div>
                `).join('');
            } else if (skippedSec) {
                skippedSec.classList.add('hidden');
            }

            lucide.createIcons();
        } else if (data.status === 'stopped') {
            clearInterval(botPollTimer);
            botPollTimer = null;
            if (statusBadge) {
                statusBadge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5';
            }
            if (statusText) statusText.innerText = data.status_text || 'Queue Stopped';
        } else if (data.status === 'error') {
            clearInterval(botPollTimer);
            botPollTimer = null;
            if (statusBadge) {
                statusBadge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 flex items-center gap-1.5';
            }
            if (statusText) statusText.innerText = `Error: ${data.error || 'Failed'}`;
        }
    } catch (e) {
        console.warn('Bot status polling error:', e);
    }
}

async function stopAutoQueue() {
    if (botPollTimer) {
        clearInterval(botPollTimer);
        botPollTimer = null;
    }
    try {
        await fetch('/api/bot/stop', { method: 'POST' });
    } catch (e) {
        console.warn('Stop bot request failed:', e);
    }
    document.getElementById('autoQueueModal').classList.add('hidden');
}

function markCustomerRowSent(custId) {
    const btn = document.querySelector(`[data-cust-btn="${custId}"]`);
    if (btn) {
        btn.classList.remove('bg-zinc-900', 'hover:bg-zinc-800');
        btn.classList.add('bg-emerald-600', 'hover:bg-emerald-700', 'text-white');
        btn.innerHTML = `<i data-lucide="check" class="w-3 h-3"></i> Sent ✓`;
        lucide.createIcons();
    }
}

// --- Message Templates Studio ---
async function loadTemplates() {
    try {
        const res = await fetch('/api/templates');
        const data = await res.json();
        currentTemplates = data.templates || [];

        // Update template selectors in other tabs
        const bdaySelect = document.getElementById('bdayTemplateSelect');
        const bdayTpls = currentTemplates.filter(t => t.category === 'birthday');
        bdaySelect.innerHTML = bdayTpls.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

        const grid = document.getElementById('templatesListGrid');
        if (grid) {
            grid.innerHTML = currentTemplates.map(t => `
                <div class="bg-white border border-zinc-200 rounded-lg p-4 space-y-2.5">
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">${t.category}</span>
                            <h3 class="font-medium text-zinc-900 text-xs mt-1">${escapeHtml(t.name)}</h3>
                        </div>
                        <div class="flex items-center gap-1">
                            <button onclick="editTemplate(${JSON.stringify(t).replace(/"/g, '&quot;')})" class="p-1 text-zinc-500 hover:text-zinc-800 rounded">
                                <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                            </button>
                            <button onclick="deleteTemplate(${t.id})" class="p-1 text-zinc-400 hover:text-red-600 rounded">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </div>
                    <p class="text-xs text-zinc-600 bg-zinc-50 p-2.5 rounded border border-zinc-100 whitespace-pre-line leading-relaxed">${escapeHtml(t.body)}</p>
                    ${t.is_default ? '<span class="text-[10px] text-zinc-500 font-mono block">✓ Default template</span>' : ''}
                </div>
            `).join('');
            lucide.createIcons();
        }
    } catch (e) {
        console.error('Template loading error:', e);
    }
}

function openTemplateModal() {
    document.getElementById('tplModalTitle').innerText = 'New Message Template';
    document.getElementById('tplFormId').value = '';
    document.getElementById('templateForm').reset();
    document.getElementById('templateModal').classList.remove('hidden');
}

function editTemplate(t) {
    document.getElementById('tplModalTitle').innerText = 'Edit Template';
    document.getElementById('tplFormId').value = t.id;
    document.getElementById('tplFormCategory').value = t.category;
    document.getElementById('tplFormName').value = t.name;
    document.getElementById('tplFormBody').value = t.body;
    document.getElementById('tplFormDefault').checked = t.is_default;
    document.getElementById('templateModal').classList.remove('hidden');
}

function closeTemplateModal() {
    document.getElementById('templateModal').classList.add('hidden');
}

function insertTplTag(tag) {
    const textarea = document.getElementById('tplFormBody');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    textarea.value = text.substring(0, start) + tag + text.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + tag.length;
}

async function submitTemplateForm(e) {
    e.preventDefault();
    const id = document.getElementById('tplFormId').value;
    const payload = {
        name: document.getElementById('tplFormName').value.trim(),
        category: document.getElementById('tplFormCategory').value,
        body: document.getElementById('tplFormBody').value.trim(),
        is_default: document.getElementById('tplFormDefault').checked
    };

    const url = id ? `/api/templates/${id}` : '/api/templates';
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            closeTemplateModal();
            loadTemplates();
        } else {
            alert('Failed to save template');
        }
    } catch (err) {
        alert(err.message);
    }
}

async function deleteTemplate(id) {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
        const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
        if (res.ok) loadTemplates();
    } catch (e) {
        alert(e.message);
    }
}

// --- Data Safety & Backup ---
function downloadBackup() {
    window.location.href = '/api/backup/export';
}

function exportCustomersExcel() {
    const q = encodeURIComponent((document.getElementById('custSearchInput')?.value || '').trim());
    const month = encodeURIComponent(document.getElementById('custMonthFilter')?.value || '');
    const expiry = encodeURIComponent(document.getElementById('custExpiryFilter')?.value || '');
    const stage = encodeURIComponent(document.getElementById('custStatusFilter')?.value || '');
    const wa = encodeURIComponent(document.getElementById('custWaFilter')?.value || '');

    const url = `/api/customers/export?q=${q}&month=${month}&expiry_window=${expiry}&service_status=${stage}&wa_status=${wa}`;
    window.location.href = url;
}

async function executeRestore() {
    const input = document.getElementById('restoreFileInput');
    if (!input.files || !input.files[0]) {
        alert('Please choose a backup (.json) file to restore.');
        return;
    }

    if (!confirm('Restore this backup file? Existing data will be preserved and merged.')) return;

    const formData = new FormData();
    formData.append('file', input.files[0]);
    formData.append('mode', 'merge');

    try {
        const res = await fetch('/api/backup/restore', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.status === 'success') {
            alert(`Database successfully restored! Added: ${data.added}, Updated: ${data.updated}`);
            loadDashboardStats();
            loadCustomers(1);
        } else {
            alert(data.error || 'Restore failed');
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function loadSnapshots() {
    const container = document.getElementById('snapshotListContainer');
    if (!container) return;

    try {
        const res = await fetch('/api/backup/snapshots');
        const data = await res.json();

        if (!data.snapshots || data.snapshots.length === 0) {
            container.innerHTML = `<p class="py-2 text-zinc-400">No pre-import snapshots recorded yet.</p>`;
            return;
        }

        container.innerHTML = `
            <table class="min-w-full text-left text-xs divide-y divide-zinc-200">
                <thead class="font-medium text-zinc-500">
                    <tr>
                        <th class="py-1.5">File</th>
                        <th class="py-1.5">Type</th>
                        <th class="py-1.5">Records</th>
                        <th class="py-1.5">Size</th>
                        <th class="py-1.5">Date</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-zinc-100 text-zinc-700">
                    ${data.snapshots.map(s => `
                        <tr>
                            <td class="py-1.5 font-mono text-zinc-800">${s.filename}</td>
                            <td class="py-1.5 text-zinc-500">${s.backup_type}</td>
                            <td class="py-1.5 font-medium">${s.customer_count}</td>
                            <td class="py-1.5 text-zinc-400">${s.size_kb} KB</td>
                            <td class="py-1.5 text-zinc-400">${s.modified_at}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (e) {
        console.error('Snapshots error:', e);
    }
}
// (Profile & Shop management is handled via loadProfileDetails and saveProfileDetails below)

// --- Profile & Shop Management ---
async function loadProfileDetails() {
    try {
        const res = await fetch('/api/profile');
        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }
        const data = await res.json();

        // Update form fields if present
        const pShop = document.getElementById('profileShopName');
        const pOwner = document.getElementById('profileOwnerName');
        const pPhone = document.getElementById('profilePhone');
        const pAddress = document.getElementById('profileAddress');

        if (pShop) pShop.value = data.shop_name || '';
        if (pOwner) pOwner.value = data.owner_name || '';
        if (pPhone) pPhone.value = data.phone || '';
        if (pAddress) pAddress.value = data.address || '';

        // Header and Dashboard updates
        const badge = document.getElementById('navShopBadge');
        const display = document.getElementById('navShopNameDisplay');
        const notice = document.getElementById('shopNameNotice');

        if (data.shop_name && data.shop_name.trim() !== '') {
            if (display) display.innerText = data.shop_name;
            if (badge) badge.classList.remove('hidden');
            if (notice) notice.classList.add('hidden');
        } else {
            if (badge) badge.classList.add('hidden');
            if (notice) notice.classList.remove('hidden');
        }
    } catch (e) {
        console.error('Error loading profile:', e);
    }
}

async function saveProfileDetails(e) {
    e.preventDefault();
    const payload = {
        shop_name: document.getElementById('profileShopName').value.trim(),
        owner_name: document.getElementById('profileOwnerName').value.trim(),
        phone: document.getElementById('profilePhone').value.trim(),
        address: document.getElementById('profileAddress').value.trim()
    };

    try {
        const res = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            alert('Shop details saved successfully!');
            loadProfileDetails();
        } else {
            alert(data.error || 'Failed to save shop details');
        }
    } catch (err) {
        alert('Server error: ' + err.message);
    }
}

async function changeAccountPassword(e) {
    e.preventDefault();
    const current = document.getElementById('pwdCurrent').value;
    const newPwd = document.getElementById('pwdNew').value;
    const confirmPwd = document.getElementById('pwdConfirm').value;

    if (newPwd !== confirmPwd) {
        alert('New passwords do not match!');
        return;
    }

    try {
        const res = await fetch('/api/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                current_password: current,
                new_password: newPwd
            })
        });
        const data = await res.json();
        if (res.ok) {
            alert('Password updated successfully!');
            document.getElementById('pwdCurrent').value = '';
            document.getElementById('pwdNew').value = '';
            document.getElementById('pwdConfirm').value = '';
        } else {
            alert(data.error || 'Failed to update password');
        }
    } catch (err) {
        alert('Server error: ' + err.message);
    }
}

// --- Utilities ---
function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Text copied to clipboard!');
    });
}

async function logMessageSent(custId, name, phone, type, content) {
    try {
        await fetch('/api/broadcast/log-send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_id: custId,
                customer_name: name,
                phone: phone,
                message_type: type,
                message_content: content,
                status: 'sent'
            })
        });
    } catch (e) {
        console.warn('Logging error:', e);
    }
}

// Hotkey listener: Press Spacebar or Right Arrow to fast-forward to next contact in Auto Queue
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('autoQueueModal');
    if (modal && !modal.classList.contains('hidden') && autoQueueState.active) {
        if (e.code === 'Space' || e.code === 'ArrowRight') {
            e.preventDefault();
            dispatchNextQueueItem(true);
        }
    }
});

// --- Poster / Banner Uploads ---
let birthdayPosterPath = '';
let broadcastPosterPath = '';

async function handlePosterUpload(type, event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
        const res = await fetch('/api/upload/poster', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.status === 'success') {
            if (type === 'birthday') {
                birthdayPosterPath = data.file_path;
                const prev = document.getElementById('birthdayPosterPreview');
                const img = document.getElementById('birthdayPosterImg');
                const name = document.getElementById('birthdayPosterName');
                if (img) img.src = data.url;
                if (name) name.innerText = data.filename;
                if (prev) prev.classList.remove('hidden');
            } else if (type === 'broadcast') {
                broadcastPosterPath = data.file_path;
                const prev = document.getElementById('broadcastPosterPreview');
                const img = document.getElementById('broadcastPosterImg');
                const name = document.getElementById('broadcastPosterName');
                if (img) img.src = data.url;
                if (name) name.innerText = data.filename;
                if (prev) prev.classList.remove('hidden');
            }
        } else {
            alert(data.error || 'Failed to upload image.');
        }
    } catch (e) {
        alert('Upload error: ' + e.message);
    }
}

function removePoster(type) {
    if (type === 'birthday') {
        birthdayPosterPath = '';
        const prev = document.getElementById('birthdayPosterPreview');
        const inp = document.getElementById('birthdayPosterInput');
        if (prev) prev.classList.add('hidden');
        if (inp) inp.value = '';
    } else if (type === 'broadcast') {
        broadcastPosterPath = '';
        const prev = document.getElementById('broadcastPosterPreview');
        const inp = document.getElementById('broadcastPosterInput');
        if (prev) prev.classList.add('hidden');
        if (inp) inp.value = '';
    }
}

// --- Reports & Logs View ---
let reportPage = 1;
let reportLimit = 25;
let reportSearchTimer = null;

function debounceReportSearch() {
    clearTimeout(reportSearchTimer);
    reportSearchTimer = setTimeout(() => {
        loadReports(1);
    }, 350);
}

function changeReportPage(delta) {
    loadReports(reportPage + delta);
}

async function loadReports(page = 1) {
    reportPage = page;
    const search = document.getElementById('reportSearchInput') ? document.getElementById('reportSearchInput').value.trim() : '';
    const cat = document.getElementById('reportCategoryFilter') ? document.getElementById('reportCategoryFilter').value : 'all';
    const st = document.getElementById('reportStatusFilter') ? document.getElementById('reportStatusFilter').value : 'all';
    const tf = document.getElementById('reportTimeframeFilter') ? document.getElementById('reportTimeframeFilter').value : 'all';

    const tbody = document.getElementById('reportLogsTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-zinc-400">Loading audit logs...</td></tr>`;
    }

    try {
        const url = `/api/reports/logs?page=${page}&limit=${reportLimit}&category=${cat}&status=${st}&timeframe=${tf}&q=${encodeURIComponent(search)}`;
        const res = await fetch(url);
        const data = await res.json();

        // Update Summary Stats
        if (data.summary) {
            const totEl = document.getElementById('reportStatTotal');
            const bdayEl = document.getElementById('reportStatBirthday');
            const expEl = document.getElementById('reportStatExpiry');
            const skpEl = document.getElementById('reportStatSkipped');
            if (totEl) totEl.innerText = data.summary.total.toLocaleString();
            if (bdayEl) bdayEl.innerText = data.summary.birthday.toLocaleString();
            if (expEl) expEl.innerText = data.summary.expiry.toLocaleString();
            if (skpEl) skpEl.innerText = data.summary.skipped.toLocaleString();
        }

        // Pagination
        const curEl = document.getElementById('reportCurrentPage');
        const totalEl = document.getElementById('reportTotalPages');
        const prevBtn = document.getElementById('reportBtnPrev');
        const nextBtn = document.getElementById('reportBtnNext');
        if (curEl) curEl.innerText = data.page;
        if (totalEl) totalEl.innerText = data.pages || 1;
        if (prevBtn) prevBtn.disabled = (data.page <= 1);
        if (nextBtn) nextBtn.disabled = (data.page >= data.pages);

        if (!data.logs || data.logs.length === 0) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-zinc-400">No sent logs found matching filters.</td></tr>`;
            return;
        }

        const typeLabels = {
            'birthday': { label: 'Birthday Wish', color: 'bg-pink-50 text-pink-700 border-pink-200' },
            'expiry': { label: 'Renewal Alert', color: 'bg-amber-50 text-amber-700 border-amber-200' },
            'festival': { label: 'Festival Wish', color: 'bg-purple-50 text-purple-700 border-purple-200' },
            'broadcast': { label: 'Broadcast', color: 'bg-blue-50 text-blue-700 border-blue-200' }
        };

        const statusBadges = {
            'sent': '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Sent</span>',
            'skipped_no_whatsapp': '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Skipped (No WA)</span>',
            'failed_no_whatsapp': '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">Skipped (Flagged)</span>',
            'skipped_invalid': '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200">Invalid Mobile</span>'
        };

        if (tbody) {
            tbody.innerHTML = data.logs.map(log => {
                const tInfo = typeLabels[log.message_type] || { label: log.message_type, color: 'bg-zinc-100 text-zinc-700 border-zinc-200' };
                const sBadge = statusBadges[log.status] || `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">${log.status}</span>`;

                return `
                    <tr class="hover:bg-zinc-50/80 transition border-b border-zinc-100">
                        <td class="px-4 py-2.5 font-mono text-zinc-500 whitespace-nowrap">${log.sent_at}</td>
                        <td class="px-4 py-2.5 font-medium text-zinc-900">${escapeHtml(log.customer_name || 'Customer #' + (log.customer_id || ''))}</td>
                        <td class="px-4 py-2.5 font-mono text-zinc-600">${log.phone || '-'}</td>
                        <td class="px-4 py-2.5">
                            <span class="px-2 py-0.5 rounded text-[10px] font-semibold border ${tInfo.color}">${tInfo.label}</span>
                        </td>
                        <td class="px-4 py-2.5 text-zinc-600 max-w-xs truncate" title="${escapeHtml(log.message_content)}">
                            ${escapeHtml(log.message_content)}
                        </td>
                        <td class="px-4 py-2.5">${sBadge}</td>
                    </tr>
                `;
            }).join('');
        }

        lucide.createIcons();
    } catch (e) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-red-500">Error: ${e.message}</td></tr>`;
    }
}

function exportReportsExcel() {
    const search = document.getElementById('reportSearchInput') ? document.getElementById('reportSearchInput').value.trim() : '';
    const cat = document.getElementById('reportCategoryFilter') ? document.getElementById('reportCategoryFilter').value : 'all';
    const st = document.getElementById('reportStatusFilter') ? document.getElementById('reportStatusFilter').value : 'all';
    const tf = document.getElementById('reportTimeframeFilter') ? document.getElementById('reportTimeframeFilter').value : 'all';

    const url = `/api/reports/export?category=${cat}&status=${st}&timeframe=${tf}&q=${encodeURIComponent(search)}`;
    window.location.href = url;
}

// --- Daily Morning Desktop Reminder Settings ---
async function loadReminderSettings() {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        const settings = data.settings || {};

        const chk = document.getElementById('settingReminderEnabled');
        const timeInp = document.getElementById('settingReminderTime');

        if (chk) {
            chk.checked = (settings.reminder_enabled !== 'false');
        }
        if (timeInp && settings.reminder_time) {
            timeInp.value = settings.reminder_time;
        }
    } catch (e) {
        console.error('Error loading reminder settings:', e);
    }
}

async function saveReminderSettings() {
    const chk = document.getElementById('settingReminderEnabled');
    const timeInp = document.getElementById('settingReminderTime');

    const enabled = chk ? (chk.checked ? 'true' : 'false') : 'true';
    const timeVal = timeInp ? timeInp.value.trim() : '10:00';

    if (!timeVal) {
        alert('Please choose a valid notification time (e.g. 10:00)');
        return;
    }

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reminder_enabled: enabled,
                reminder_time: timeVal
            })
        });
        if (res.ok) {
            alert('Notification preferences saved successfully! Windows popup will alert you daily at ' + timeVal + '.');
        } else {
            alert('Failed to save notification preferences.');
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function testDesktopReminder() {
    const btn = document.getElementById('btnTestReminder');
    if (btn) btn.disabled = true;

    try {
        const res = await fetch('/api/reminder/test', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
            alert('A test desktop notification was dispatched to your Windows screen tray!');
        } else {
            alert('Could not trigger notification: ' + (data.error || 'Unknown error'));
        }
    } catch (e) {
        alert('Error testing notification: ' + e.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

// =========================================================================
// Multi-User Management (Admin Only)
// =========================================================================

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    try {
        const res = await fetch('/api/users');
        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-500 font-medium">Failed to load users (Status: ${res.status}). Administrator privilege required.</td></tr>`;
            return;
        }
        const users = await res.json();

        let adminCount = 0;
        let staffCount = 0;
        users.forEach(u => {
            if (u.role === 'admin') adminCount++;
            else staffCount++;
        });

        const elTotal = document.getElementById('statTotalUsers');
        const elAdmin = document.getElementById('statAdminUsers');
        const elStaff = document.getElementById('statStaffUsers');
        if (elTotal) elTotal.textContent = users.length;
        if (elAdmin) elAdmin.textContent = adminCount;
        if (elStaff) elStaff.textContent = staffCount;

        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-zinc-400">No user accounts found.</td></tr>`;
            return;
        }

        tbody.innerHTML = users.map(u => {
            const isMe = window.CURRENT_USER && window.CURRENT_USER.id === u.id;
            const roleBadge = u.role === 'admin'
                ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Administrator</span>`
                : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Staff Consultant</span>`;

            const statusBadge = u.is_active
                ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>`
                : `<span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">Deactivated</span>`;

            const toggleBtnText = u.is_active ? 'Deactivate' : 'Activate';
            const toggleBtnClass = u.is_active ? 'text-amber-600 hover:text-amber-800' : 'text-emerald-600 hover:text-emerald-800';

            return `
                <tr class="hover:bg-zinc-50/80 transition">
                    <td class="py-2.5 px-3">
                        <div class="flex items-center gap-2">
                            <div class="w-7 h-7 rounded-full bg-zinc-800 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                                ${(u.username || 'U')[0].toUpperCase()}
                            </div>
                            <div>
                                <p class="font-medium text-zinc-900">${escapeHtml(u.full_name || u.username)} ${isMe ? '<span class="text-[10px] text-zinc-400 font-normal">(You)</span>' : ''}</p>
                                <p class="text-[11px] text-zinc-400 font-mono">@${escapeHtml(u.username)}</p>
                            </div>
                        </div>
                    </td>
                    <td class="py-2.5 px-3">${roleBadge}</td>
                    <td class="py-2.5 px-3 font-mono text-[11px] text-zinc-600">${escapeHtml(u.phone || '—')}</td>
                    <td class="py-2.5 px-3">${statusBadge}</td>
                    <td class="py-2.5 px-3 text-zinc-400 text-[11px]">${escapeHtml(u.created_at || '—')}</td>
                    <td class="py-2.5 px-3 text-right whitespace-nowrap">
                        <div class="inline-flex items-center gap-2">
                            <button onclick="openEditUserModal(${u.id})" class="text-zinc-600 hover:text-zinc-900 font-medium">Edit</button>
                            ${!isMe ? `
                                <button onclick="toggleUserStatus(${u.id})" class="${toggleBtnClass} font-medium">${toggleBtnText}</button>
                                ${u.username !== 'admin' ? `
                                    <button onclick="deleteUser(${u.id}, '${escapeHtml(u.username)}')" class="text-red-500 hover:text-red-700 font-medium">Delete</button>
                                ` : ''}
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-500">Error loading users: ${escapeHtml(err.message)}</td></tr>`;
    }
}

function openAddUserModal() {
    document.getElementById('addFullName').value = '';
    document.getElementById('addUsername').value = '';
    document.getElementById('addPassword').value = '';
    document.getElementById('addPhone').value = '';
    document.getElementById('addRole').value = 'staff';
    document.getElementById('addUserModal').classList.remove('hidden');
    lucide.createIcons();
}

function closeAddUserModal() {
    document.getElementById('addUserModal').classList.add('hidden');
}

async function submitAddUser(e) {
    e.preventDefault();
    const fullName = document.getElementById('addFullName').value.trim();
    const username = document.getElementById('addUsername').value.trim();
    const password = document.getElementById('addPassword').value.trim();
    const phone = document.getElementById('addPhone').value.trim();
    const role = document.getElementById('addRole').value;

    try {
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ full_name: fullName, username, password, phone, role })
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'Failed to create user');
            return;
        }
        alert(data.message || 'User created successfully!');
        closeAddUserModal();
        loadUsers();
    } catch (err) {
        alert('Network error: ' + err.message);
    }
}

async function openEditUserModal(userId) {
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        const user = users.find(u => u.id === userId);
        if (!user) return alert('User not found');

        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUsername').value = user.username;
        document.getElementById('editFullName').value = user.full_name || '';
        document.getElementById('editRole').value = user.role || 'staff';
        document.getElementById('editPhone').value = user.phone || '';
        document.getElementById('editPassword').value = '';
        document.getElementById('editIsActive').checked = Boolean(user.is_active);

        const isMe = window.CURRENT_USER && window.CURRENT_USER.id === user.id;
        document.getElementById('editRole').disabled = isMe;
        document.getElementById('editIsActive').disabled = isMe;

        document.getElementById('editUserModal').classList.remove('hidden');
        lucide.createIcons();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

function closeEditUserModal() {
    document.getElementById('editUserModal').classList.add('hidden');
}

async function submitEditUser(e) {
    e.preventDefault();
    const userId = document.getElementById('editUserId').value;
    const fullName = document.getElementById('editFullName').value.trim();
    const role = document.getElementById('editRole').value;
    const phone = document.getElementById('editPhone').value.trim();
    const password = document.getElementById('editPassword').value.trim();
    const isActive = document.getElementById('editIsActive').checked;

    const payload = {
        full_name: fullName,
        role: role,
        phone: phone,
        is_active: isActive
    };
    if (password) payload.password = password;

    try {
        const res = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'Failed to update user');
            return;
        }
        alert(data.message || 'User updated successfully!');
        closeEditUserModal();
        loadUsers();
        initCurrentUser();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function toggleUserStatus(userId) {
    if (!confirm('Are you sure you want to change this user account status?')) return;
    try {
        const res = await fetch(`/api/users/${userId}/toggle-status`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'Action failed');
        alert(data.message);
        loadUsers();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to permanently delete user account '${username}'?`)) return;
    try {
        const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) return alert(data.error || 'Failed to delete user');
        alert(data.message || 'User deleted successfully.');
        loadUsers();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// =========================================================================
// Web-Native WhatsApp Queue Dispatcher (Zero Client Dependencies)
// =========================================================================

let webQueueItems = [];
let webQueueIndex = 0;
let webQueueTimer = null;
let webQueueCountdown = 5;

async function startWebQueue(type, customItems, templateId, customText, festivalName) {
    let rawList = customItems;
    if (!rawList) {
        if (type === 'birthday') {
            rawList = currentBirthdayItems ? currentBirthdayItems.map(i => i.customer) : [];
        } else if (type === 'expiry') {
            rawList = currentExpiryItems ? currentExpiryItems.map(i => i.customer) : [];
        } else if (type === 'broadcast') {
            rawList = currentBroadcastItems || [];
        }
    }

    if (!rawList || rawList.length === 0) {
        alert('No contacts available in the current selection to dispatch.');
        return;
    }

    // Check if any contact in the batch has a secondary phone number
    const hasAltNumbers = rawList.some(item => {
        const c = item.customer || item;
        return c && c.phone2 && String(c.phone2).trim() !== '';
    });

    let sendTarget = 'primary';
    if (hasAltNumbers) {
        const opt = confirm("या यादीतील काही ग्राहकांकडे २ मोबाईल नंबर उपलब्ध आहेत (Primary व Alternate).\n\n[OK] = दोन्ही नंबरवर मेसेज पाठवा (Send to BOTH Numbers)\n[Cancel] = फक्त मुख्य नंबरवर पाठवा (Primary Only)");
        sendTarget = opt ? 'both' : 'primary';
    }

    try {
        const res = await fetch('/api/queue/prepare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: type,
                items: rawList,
                template_id: templateId,
                custom_text: customText,
                festival_name: festivalName,
                send_target: sendTarget
            })
        });
        const data = await res.json();
        if (!res.ok || data.status !== 'success') {
            alert(data.error || 'Failed to prepare web queue');
            return;
        }

        webQueueItems = data.items || [];
        if (webQueueItems.length === 0) {
            alert('Queue list is empty.');
            return;
        }

        webQueueIndex = 0;
        document.getElementById('webQueueModal').classList.remove('hidden');
        document.getElementById('webQueueActiveBody').classList.remove('hidden');
        document.getElementById('webQueueFinishedBody').classList.add('hidden');

        let typeTitle = 'Customer Wishes';
        if (type === 'birthday') typeTitle = 'Birthday Wishes';
        else if (type === 'expiry') typeTitle = 'Passport Renewal Alerts';
        else if (type === 'broadcast') typeTitle = 'Festival Broadcast';

        document.getElementById('webQueueTitle').textContent = `Web Queue: ${typeTitle}`;
        document.getElementById('webQueueSubtitle').textContent = `Zero-download browser dispatch for ${webQueueItems.length} recipient(s)`;

        renderWebQueueItem();
        lucide.createIcons();
    } catch (e) {
        alert('Error starting web queue: ' + e.message);
    }
}

function renderWebQueueItem() {
    if (webQueueTimer) {
        clearInterval(webQueueTimer);
        webQueueTimer = null;
    }

    if (webQueueIndex >= webQueueItems.length) {
        document.getElementById('webQueueActiveBody').classList.add('hidden');
        document.getElementById('webQueueFinishedBody').classList.remove('hidden');
        document.getElementById('webQueueFinishedStats').textContent = `Successfully completed sending to all ${webQueueItems.length} recipient(s).`;
        return;
    }

    const item = webQueueItems[webQueueIndex];
    const total = webQueueItems.length;
    const currentNum = webQueueIndex + 1;
    const percent = Math.round((currentNum / total) * 100);

    document.getElementById('webQueueCounter').textContent = `Recipient ${currentNum} of ${total}`;
    document.getElementById('webQueuePercent').textContent = `${percent}%`;
    document.getElementById('webQueueBar').style.width = `${percent}%`;

    document.getElementById('webQueueName').textContent = item.name || 'Customer';
    document.getElementById('webQueuePhone').textContent = item.clean_phone ? `+${item.clean_phone}` : item.phone;
    document.getElementById('webQueueText').textContent = item.message_text;

    const badge = document.getElementById('webQueueStatusBadge');
    if (badge) {
        badge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200';
        badge.textContent = 'Ready to Send';
    }
}

function dispatchCurrentWebQueue(target) {
    if (webQueueIndex >= webQueueItems.length) return;
    const item = webQueueItems[webQueueIndex];

    const url = target === 'mobile' ? item.mobile_url : item.web_url;
    window.open(url, '_blank');

    fetch('/api/broadcast/log-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            customer_id: item.customer_id,
            customer_name: item.name,
            phone: item.clean_phone || item.phone,
            message_type: 'web_queue',
            message_content: item.message_text,
            status: 'sent'
        })
    }).catch(e => console.warn('Log error:', e));

    const badge = document.getElementById('webQueueStatusBadge');
    if (badge) {
        badge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200';
        badge.textContent = 'Dispatched ✓';
    }

    const autoAdvance = document.getElementById('webQueueAutoAdvance').checked;
    if (autoAdvance) {
        webQueueCountdown = 5;
        const delaySpan = document.getElementById('webQueueDelaySec');
        if (delaySpan) delaySpan.textContent = webQueueCountdown;

        webQueueTimer = setInterval(() => {
            webQueueCountdown--;
            if (delaySpan) delaySpan.textContent = webQueueCountdown;
            if (webQueueCountdown <= 0) {
                clearInterval(webQueueTimer);
                webQueueTimer = null;
                webQueueIndex++;
                renderWebQueueItem();
            }
        }, 1000);
    } else {
        webQueueIndex++;
        renderWebQueueItem();
    }
}

async function skipCurrentWebQueue() {
    if (webQueueIndex >= webQueueItems.length) return;
    const item = webQueueItems[webQueueIndex];

    if (item.customer_id) {
        try {
            await fetch(`/api/customers/${item.customer_id}/toggle-whatsapp`, { method: 'POST' });
        } catch (e) {}
    }

    fetch('/api/broadcast/log-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            customer_id: item.customer_id,
            customer_name: item.name,
            phone: item.clean_phone || item.phone,
            message_type: 'web_queue',
            message_content: item.message_text,
            status: 'skipped_no_whatsapp'
        })
    }).catch(e => console.warn('Log error:', e));

    webQueueIndex++;
    renderWebQueueItem();
}

function closeWebQueue() {
    if (webQueueTimer) {
        clearInterval(webQueueTimer);
        webQueueTimer = null;
    }
    document.getElementById('webQueueModal').classList.add('hidden');
    loadDashboardStats();
}
