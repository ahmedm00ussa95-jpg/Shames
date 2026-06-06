/* ============================================================
   roles.js — نظام الصلاحيات المتقدم (RBAC)
   الشمس - Al Shams ERP | المرحلة الثانية
   ============================================================ */

// ============================================================
// ROLES DEFINITION
// ============================================================
const ROLES = {
  superadmin: {
    label: 'مدير عام',     badge: 'role-superadmin', icon: '👑',
    color: 'var(--purple)',
    pages: ['dashboard','pos','sales','customers','products','returns','categories',
            'warehouses','purchases','barcode','cashboxes','finance','debts','expenses',
            'suppliers','reports','users','settings','inv-settings','branches','activity'],
    actions: ['*'] // كل الصلاحيات
  },
  admin: {
    label: 'مدير فرع',    badge: 'role-admin',   icon: '🔑',
    color: 'var(--red)',
    pages: ['dashboard','pos','sales','customers','products','returns','categories',
            'warehouses','purchases','barcode','cashboxes','finance','debts','expenses',
            'suppliers','reports','users','settings','inv-settings'],
    actions: ['view_reports','manage_products','manage_customers','manage_suppliers',
              'manage_users','manage_settings','view_finance','manage_cashboxes',
              'create_sales','create_purchases','create_expenses','create_returns']
  },
  cashier: {
    label: 'كاشير',        badge: 'role-cashier', icon: '💳',
    color: 'var(--green)',
    pages: ['dashboard','pos','sales','customers','returns'],
    actions: ['create_sales','view_sales','create_returns','view_customers']
  },
  accountant: {
    label: 'محاسب',        badge: 'role-accountant', icon: '📊',
    color: 'var(--accent)',
    pages: ['dashboard','sales','customers','purchases','cashboxes','finance',
            'debts','expenses','suppliers','reports'],
    actions: ['view_reports','view_finance','manage_cashboxes','create_expenses',
              'view_sales','view_purchases','view_customers','view_suppliers']
  },
  warehouse: {
    label: 'مسؤول مخزن',  badge: 'role-warehouse', icon: '📦',
    color: 'var(--yellow)',
    pages: ['dashboard','products','warehouses','categories','barcode','purchases'],
    actions: ['manage_products','view_warehouses','create_purchases','view_purchases']
  }
};

// ============================================================
// PERMISSION CHECKS
// ============================================================
function hasRole(role) {
  return CURRENT_USER?.role === role || CURRENT_USER?.role === 'superadmin';
}

function canAccess(action) {
  if (!CURRENT_USER) return false;
  const role = ROLES[CURRENT_USER.role];
  if (!role) return false;
  if (role.actions.includes('*')) return true;
  return role.actions.includes(action);
}

function canSeePage(page) {
  if (!CURRENT_USER) return false;
  const role = ROLES[CURRENT_USER.role];
  if (!role) return false;
  return role.pages.includes(page);
}

// ============================================================
// APPLY PERMISSIONS TO UI
// ============================================================
function applyRolePermissions() {
  if (!CURRENT_USER) return;
  const role = ROLES[CURRENT_USER.role];
  if (!role) return;

  // Hide/show sidebar items
  document.querySelectorAll('.sb-item[data-page]').forEach(el => {
    const page = el.dataset.page;
    if (!role.pages.includes(page)) {
      el.style.display = 'none';
    } else {
      el.style.display = '';
    }
  });

  // Show branches menu item only for superadmin
  const branchItem = document.querySelector('.sb-item[data-page="branches"]');
  if (branchItem) {
    branchItem.style.display = CURRENT_USER.role === 'superadmin' ? '' : 'none';
  }

  // Show activity log for admin+
  const activityItem = document.querySelector('.sb-item[data-page="activity"]');
  if (activityItem) {
    activityItem.style.display = canAccess('view_reports') ? '' : 'none';
  }

  // Branch selector — only superadmin sees it
  const branchSelector = document.getElementById('branch-selector-wrap');
  if (branchSelector) {
    branchSelector.style.display = CURRENT_USER.role === 'superadmin' ? '' : 'none';
  }

  // Restrict branch — non-superadmin only see their branch
  if (CURRENT_USER.role !== 'superadmin' && CURRENT_USER.branchId) {
    BS.currentBranchId = CURRENT_USER.branchId;
    BS.currentBranch   = BS.branches[CURRENT_USER.branchId] || null;
    updateBranchIndicator();
  }

  // Hide delete buttons for cashier/accountant/warehouse
  if (['cashier','accountant','warehouse'].includes(CURRENT_USER.role)) {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display='none');
  }

  // Settings access
  if (!canAccess('manage_settings')) {
    document.getElementById('save-settings-btn')?.setAttribute('disabled','true');
    document.getElementById('save-inv-settings-btn')?.setAttribute('disabled','true');
    document.getElementById('clear-data-btn')?.setAttribute('disabled','true');
  }
}

// ============================================================
// ENHANCED USERS PAGE with Branch Assignment
// ============================================================
function renderUsersEnhanced() {
  const tbody = document.getElementById('users-tbl'); if (!tbody) return;
  const users = S.users || {};
  const rows = Object.entries(users);

  tbody.innerHTML = rows.length
    ? rows.map(([id, u]) => {
        const roleInfo = ROLES[u.role] || {label: u.role, icon: '👤', color:'var(--text2)'};
        const branchName = u.branchId ? (BS.branches[u.branchId]?.name || u.branchId) : 'كل الفروع';
        const lastLogin  = u.lastLogin ? new Date(u.lastLogin).toLocaleString('ar-EG') : 'لم يسجل بعد';
        return `<tr>
          <td><strong>${u.name || '-'}</strong><br><span style="font-size:10px;color:var(--text2);">@${u.username}</span></td>
          <td><span class="badge ${roleInfo.badge||'badge-info'}" style="background:${roleInfo.color}22;color:${roleInfo.color};">${roleInfo.icon} ${roleInfo.label}</span></td>
          <td><span style="font-size:11px;">${branchName}</span></td>
          <td><span class="badge ${u.status==='active'?'badge-success':'badge-danger'}">${u.status==='active'?'نشط':'معطل'}</span></td>
          <td style="font-size:10px;color:var(--text2);">${lastLogin}</td>
          <td style="white-space:nowrap;">
            <button class="btn btn-ghost btn-xs" onclick="editUser('${id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-ghost btn-xs" onclick="viewUserActivity('${id}')"><i class="fas fa-history"></i></button>
            ${u.username !== 'admin' ? `<button class="btn btn-danger btn-xs admin-only" onclick="delUser('${id}')"><i class="fas fa-trash"></i></button>` : ''}
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text2);">لا يوجد مستخدمون</td></tr>';
}

// Open Add/Edit User Modal with branch field
function openAddUserEnhanced() {
  editingUser = null;
  document.getElementById('user-modal-title').textContent = 'مستخدم جديد';
  ['uf-username','uf-name','uf-pass'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('uf-role').value   = 'cashier';
  document.getElementById('uf-status').value = 'active';
  // Populate branch select in user modal
  populateBranchSelect('uf-branch');
  openModal('modal-user');
}

function populateBranchSelect(elId) {
  const el = document.getElementById(elId); if (!el) return;
  el.innerHTML = '<option value="">كل الفروع (superadmin)</option>' +
    Object.entries(BS.branches).map(([id,b]) => `<option value="${id}">${b.icon||'🏪'} ${b.name}</option>`).join('');
  // Pre-select current branch for non-superadmin
  if (CURRENT_USER?.role !== 'superadmin' && CURRENT_USER?.branchId) {
    el.value = CURRENT_USER.branchId;
  }
}

// ============================================================
// ACTIVITY LOG
// ============================================================
const AL = {
  logs: [],

  async record(action, details='', entity='') {
    if (!CURRENT_USER || !BS.currentBranchId) return;
    const log = {
      userId:    CURRENT_USER.username,
      userName:  CURRENT_USER.name || CURRENT_USER.username,
      role:      CURRENT_USER.role,
      branchId:  BS.currentBranchId,
      branchName:BS.currentBranch?.name || '',
      action, details, entity,
      timestamp: new Date().toISOString(),
      date:      new Date().toISOString().split('T')[0]
    };
    try {
      await FB.$push(FB.$ref(DB, 'ctg/activity'), log);
    } catch(e) { console.warn('Activity log failed:', e); }
  },

  async load(limit=100) {
    return new Promise(res => {
      FB.$onValue(FB.$ref(DB,'ctg/activity'), snap => {
        const data = snap.val()||{};
        const logs = Object.entries(data)
          .map(([id,v])=>({...v,id}))
          .sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp))
          .slice(0, limit);
        this.logs = logs;
        res(logs);
      }, {onlyOnce:true});
    });
  }
};

function renderActivityLog() {
  const tbody = document.getElementById('activity-tbl'); if (!tbody) return;
  const filterUser   = document.getElementById('act-filter-user')?.value  || '';
  const filterBranch = document.getElementById('act-filter-branch')?.value || '';
  const filterDate   = document.getElementById('act-filter-date')?.value   || '';

  AL.load(200).then(logs => {
    const filtered = logs.filter(l =>
      (!filterUser   || l.userId===filterUser) &&
      (!filterBranch || l.branchId===filterBranch) &&
      (!filterDate   || l.date===filterDate)
    );
    const actionLabels = {
      'sale_created':'فاتورة بيع جديدة','purchase_created':'فاتورة شراء جديدة',
      'product_added':'إضافة منتج','product_edited':'تعديل منتج','product_deleted':'حذف منتج',
      'customer_added':'إضافة عميل','customer_edited':'تعديل عميل',
      'expense_added':'إضافة مصروف','return_created':'مرتجع جديد',
      'cashbox_deposit':'إيداع خزينة','cashbox_withdraw':'صرف من خزينة',
      'debt_collected':'تحصيل دين','login':'تسجيل دخول','logout':'تسجيل خروج'
    };
    const actionIcons = {
      'sale_created':'fa-file-invoice','purchase_created':'fa-cart-plus',
      'product_added':'fa-plus-circle','product_edited':'fa-edit','product_deleted':'fa-trash',
      'customer_added':'fa-user-plus','customer_edited':'fa-user-edit',
      'expense_added':'fa-money-bill-wave','return_created':'fa-undo-alt',
      'cashbox_deposit':'fa-arrow-circle-down','cashbox_withdraw':'fa-arrow-circle-up',
      'debt_collected':'fa-hand-holding-usd','login':'fa-sign-in-alt','logout':'fa-sign-out-alt'
    };
    tbody.innerHTML = filtered.length
      ? filtered.map(l => {
          const roleInfo = ROLES[l.role]||{label:l.role,icon:'👤'};
          const icon = actionIcons[l.action]||'fa-circle';
          const label= actionLabels[l.action]||l.action;
          return `<tr>
            <td style="font-size:11px;color:var(--text2);">${new Date(l.timestamp).toLocaleString('ar-EG')}</td>
            <td><strong>${l.userName}</strong><br><span style="font-size:10px;color:var(--text3);">@${l.userId} • ${roleInfo.icon} ${roleInfo.label}</span></td>
            <td><span style="font-size:11px;">${l.branchName||'-'}</span></td>
            <td><i class="fas ${icon}" style="color:var(--accent);margin-left:5px;"></i>${label}</td>
            <td style="font-size:11px;color:var(--text2);">${l.details||'-'}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="5" style="text-align:center;color:var(--text2);padding:20px;">لا توجد سجلات</td></tr>';
  });
}

// ============================================================
// INVOICE SEQUENCE PER BRANCH
// ============================================================
async function getBranchInvNumber() {
  if (!BS.currentBranchId) return 'INV-' + Date.now().toString(36).toUpperCase();
  const year = new Date().getFullYear();
  const key  = `ctg/branches/${BS.currentBranchId}/meta/invCounter`;
  return new Promise((resolve) => {
    FB.$onValue(FB.$ref(DB, key), async snap => {
      const current = snap.val() || 0;
      const next    = current + 1;
      await FB.$set(FB.$ref(DB, key), next);
      const branchCode = BS.currentBranch?.name?.substring(0,2).toUpperCase() || 'BR';
      resolve(`${branchCode}-${year}-${String(next).padStart(4,'0')}`);
    }, {onlyOnce: true});
  });
}

// ============================================================
// BRANCH SELECTOR DROPDOWN (topbar)
// ============================================================
function renderBranchSelector() {
  const wrap = document.getElementById('branch-selector-wrap'); if (!wrap) return;
  if (CURRENT_USER?.role !== 'superadmin') { wrap.style.display='none'; return; }
  wrap.style.display = 'flex';

  const btn = document.getElementById('branch-selector-btn');
  if (btn) {
    const b = BS.currentBranch;
    btn.innerHTML = b
      ? `${b.icon||'🏪'} <strong>${b.name}</strong> <i class="fas fa-chevron-down" style="font-size:9px;margin-right:4px;"></i>`
      : `<i class="fas fa-code-branch"></i> اختر فرعاً <i class="fas fa-chevron-down" style="font-size:9px;margin-right:4px;"></i>`;
  }
}

function toggleBranchDropdown() {
  const dd = document.getElementById('branch-dropdown');
  if (!dd) return;
  const isOpen = dd.style.display !== 'none' && dd.style.display !== '';
  if (isOpen) { dd.style.display='none'; return; }
  dd.innerHTML = Object.entries(BS.branches).map(([id,b]) => `
    <div class="branch-dd-item ${id===BS.currentBranchId?'active':''}" onclick="switchBranch('${id}');toggleBranchDropdown()">
      <span style="font-size:16px;">${b.icon||'🏪'}</span>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:12px;">${b.name}</div>
        <div style="font-size:10px;color:var(--text2);">${b.city||''}</div>
      </div>
      ${id===BS.currentBranchId?'<i class="fas fa-check" style="color:var(--accent);font-size:11px;"></i>':''}
    </div>`).join('') + `
    <div style="padding:8px 12px;border-top:1px solid var(--border);">
      <button class="btn btn-ghost btn-xs" style="width:100%;" onclick="nav('branches');toggleBranchDropdown()"><i class="fas fa-cog"></i> إدارة الفروع</button>
    </div>`;
  dd.style.display = 'block';
}

document.addEventListener('mousedown', e => {
  const dd = document.getElementById('branch-dropdown');
  const btn= document.getElementById('branch-selector-btn');
  if (dd && !dd.contains(e.target) && btn && !btn.contains(e.target)) {
    dd.style.display='none';
  }
});
