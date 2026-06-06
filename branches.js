/* ============================================================
   branches.js — نظام الفروع المتعددة
   الشمس - Al Shams ERP | المرحلة الثانية
   ============================================================ */

// ============================================================
// BRANCH STATE
// ============================================================
const BS = {
  branches: {},          // كل الفروع (superadmin فقط)
  currentBranch: null,   // الفرع الحالي المختار
  currentBranchId: null
};

// ============================================================
// BRANCH DB HELPERS — كل العمليات تمر عبر الفرع الحالي
// ============================================================
function getBranchPath(path) {
  if (!BS.currentBranchId) return 'ctg/' + path;
  return `ctg/branches/${BS.currentBranchId}/${path}`;
}

async function bSet(path, val)    { await FB.$set(FB.$ref(DB, getBranchPath(path)), val); }
async function bPush(path, val)   { return await FB.$push(FB.$ref(DB, getBranchPath(path)), val); }
async function bUpdate(path, val) { await FB.$update(FB.$ref(DB, getBranchPath(path)), val); }
async function bRemove(path)      { await FB.$remove(FB.$ref(DB, getBranchPath(path))); }

// تحديث dbSet/dbPush/dbUpdate/dbRemove لتستخدم الفرع الحالي
function patchDbFunctions() {
  window._dbSet    = async (path,val)  => await bSet(path,val);
  window._dbPush   = async (path,val)  => await bPush(path,val);
  window._dbUpdate = async (path,val)  => await bUpdate(path,val);
  window._dbRemove = async (path)      => await bRemove(path);
}

// ============================================================
// BRANCH LISTENER
// ============================================================
function listenBranchData(branchId) {
  if (!DB) return;
  const base = `ctg/branches/${branchId}`;

  const listenAndSave = (path, cb) => {
    FB.$onValue(FB.$ref(DB, `${base}/${path}`), snap => {
      const val = snap.val() || {};
      cb(val);
      IDB.saveStore(path, val).catch(() => {});
    });
  };

  listenAndSave('products',   v => { S.products   = v; renderProducts(); renderPosGrid(); updateDashboard(); updateBCSelects(); fillCatSelects(); });
  listenAndSave('customers',  v => { S.customers  = v; renderCustomers(); updateCustSelects(); updateDashboard(); });
  listenAndSave('warehouses', v => { S.warehouses = v; renderWarehouses(); updateWhSelects(); });
  listenAndSave('sales',      v => { S.sales      = v; renderSales(); updateDashboard(); updateFinance(); });
  listenAndSave('purchases',  v => { S.purchases  = v; renderPurchases(); renderSuppliers(); });
  listenAndSave('expenses',   v => { S.expenses   = v; renderExpenses(); updateFinance(); });
  listenAndSave('suppliers',  v => { S.suppliers  = v; renderSuppliers(); fillSupSelects(); });
  listenAndSave('movements',  v => { S.movements  = v; renderMovements(); });
  listenAndSave('categories', v => { S.categories = v; renderCategories(); fillCatSelects(); renderProducts(); });
  listenAndSave('cashboxes',  v => { S.cashboxes  = v; renderCashboxes(); fillCashboxSelects(); });
  listenAndSave('cashboxLog', v => { S.cashboxLog = v; renderCashboxLog(); });
  listenAndSave('returns',    v => { S.returns    = v; });

  FB.$onValue(FB.$ref(DB, `${base}/settings`), snap => {
    const val = snap.val();
    if (val && val.company) { S.settings = {...S.settings, ...val}; loadSettingsUI(); }
  });
}

// ============================================================
// RENDER BRANCHES PAGE
// ============================================================
function renderBranches() {
  const grid = document.getElementById('branches-grid');
  if (!grid) return;
  const branches = Object.entries(BS.branches);
  if (!branches.length) {
    grid.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text2);">
      <i class="fas fa-code-branch" style="font-size:40px;display:block;margin-bottom:12px;opacity:.3;"></i>
      لا توجد فروع — أضف فرعاً جديداً
    </div>`;
    return;
  }
  grid.innerHTML = branches.map(([id, b]) => {
    const isCurrent = id === BS.currentBranchId;
    return `<div class="branch-card ${isCurrent ? 'current' : ''}" onclick="switchBranch('${id}')">
      <div class="branch-card-header">
        <div class="branch-icon">${b.icon || '🏪'}</div>
        <div class="branch-info">
          <div class="branch-name">${b.name}</div>
          <div class="branch-loc"><i class="fas fa-map-marker-alt"></i> ${b.city || '-'}</div>
        </div>
        <div class="branch-actions" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-xs" onclick="editBranch('${id}')"><i class="fas fa-edit"></i></button>
          ${!isCurrent ? `<button class="btn btn-danger btn-xs" onclick="delBranch('${id}')"><i class="fas fa-trash"></i></button>` : ''}
        </div>
      </div>
      <div class="branch-stats">
        <div class="branch-stat"><span class="branch-stat-val" id="bs-sales-${id}">—</span><span class="branch-stat-lbl">مبيعات اليوم</span></div>
        <div class="branch-stat"><span class="branch-stat-val" id="bs-prods-${id}">—</span><span class="branch-stat-lbl">المنتجات</span></div>
        <div class="branch-stat"><span class="branch-stat-val" id="bs-users-${id}">—</span><span class="branch-stat-lbl">المستخدمون</span></div>
      </div>
      <div class="branch-footer">
        <span class="badge ${b.status === 'active' ? 'badge-success' : 'badge-danger'}">${b.status === 'active' ? 'نشط' : 'معطل'}</span>
        ${isCurrent ? '<span class="badge badge-info"><i class="fas fa-check"></i> الفرع الحالي</span>' : ''}
        <span style="font-size:10px;color:var(--text3);">📞 ${b.phone || '-'}</span>
      </div>
    </div>`;
  }).join('');

  // Load branch quick stats
  branches.forEach(([id]) => loadBranchStats(id));
}

async function loadBranchStats(branchId) {
  const today = new Date().toISOString().split('T')[0];
  try {
    // Sales today
    FB.$onValue(FB.$ref(DB, `ctg/branches/${branchId}/sales`), snap => {
      const sales = snap.val() || {};
      const todaySales = Object.values(sales).filter(s => (s.date||'').startsWith(today));
      const total = todaySales.reduce((s,v) => s+(v.total||0), 0);
      const el = document.getElementById(`bs-sales-${branchId}`);
      if (el) el.textContent = N(total, 0);
    }, {onlyOnce: true});

    FB.$onValue(FB.$ref(DB, `ctg/branches/${branchId}/products`), snap => {
      const prods = snap.val() || {};
      const el = document.getElementById(`bs-prods-${branchId}`);
      if (el) el.textContent = Object.keys(prods).length;
    }, {onlyOnce: true});

    FB.$onValue(FB.$ref(DB, `ctg/users`), snap => {
      const users = snap.val() || {};
      const branchUsers = Object.values(users).filter(u => u.branchId === branchId || u.role === 'superadmin');
      const el = document.getElementById(`bs-users-${branchId}`);
      if (el) el.textContent = branchUsers.length;
    }, {onlyOnce: true});
  } catch(e) {}
}

// ============================================================
// SWITCH BRANCH
// ============================================================
function switchBranch(branchId) {
  if (branchId === BS.currentBranchId) return;
  const b = BS.branches[branchId];
  if (!b) { toast('الفرع غير موجود', 'error'); return; }
  if (b.status !== 'active') { toast('هذا الفرع معطل', 'error'); return; }

  BS.currentBranchId = branchId;
  BS.currentBranch   = b;
  localStorage.setItem('ctg-branch', branchId);

  // Update DB functions to use new branch
  patchDbFunctions();

  // Update UI
  updateBranchIndicator();

  // Reset state
  Object.assign(S, {products:{}, customers:{}, warehouses:{}, sales:{}, purchases:{},
    expenses:{}, suppliers:{}, movements:{}, categories:{}, cashboxes:{}, cashboxLog:{}, returns:{}});

  // Listen to new branch data
  listenBranchData(branchId);

  renderBranches();
  nav('dashboard');
  toast(`تم التبديل إلى فرع: ${b.name} ✅`);
}

function updateBranchIndicator() {
  const el = document.getElementById('current-branch-name');
  if (el) el.textContent = BS.currentBranch?.name || 'لا يوجد فرع';
  const icon = document.getElementById('current-branch-icon');
  if (icon) icon.textContent = BS.currentBranch?.icon || '🏪';
}

// ============================================================
// CRUD BRANCHES
// ============================================================
let editingBranch = null;

function openAddBranch() {
  editingBranch = null;
  document.getElementById('branch-modal-title').textContent = 'فرع جديد';
  ['bf-name','bf-city','bf-addr','bf-phone','bf-mgr','bf-icon','bf-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const ic = document.getElementById('bf-icon'); if (ic) ic.value = '🏪';
  const st = document.getElementById('bf-status'); if (st) st.value = 'active';
  openModal('modal-branch');
}

function editBranch(id) {
  editingBranch = id;
  const b = BS.branches[id]; if (!b) return;
  document.getElementById('branch-modal-title').textContent = 'تعديل فرع';
  const set = (elId, val) => { const el=document.getElementById(elId); if(el) el.value=val||''; };
  set('bf-name',   b.name);   set('bf-city',  b.city);
  set('bf-addr',   b.addr);   set('bf-phone', b.phone);
  set('bf-mgr',    b.mgr);    set('bf-icon',  b.icon||'🏪');
  set('bf-notes',  b.notes);  set('bf-status',b.status||'active');
  openModal('modal-branch');
}

async function saveBranch() {
  const name = (document.getElementById('bf-name')?.value||'').trim();
  if (!name) { toast('يرجى إدخال اسم الفرع','error'); return; }
  const data = {
    name,
    city:   document.getElementById('bf-city')?.value.trim()   || '',
    addr:   document.getElementById('bf-addr')?.value.trim()   || '',
    phone:  document.getElementById('bf-phone')?.value.trim()  || '',
    mgr:    document.getElementById('bf-mgr')?.value.trim()    || '',
    icon:   document.getElementById('bf-icon')?.value.trim()   || '🏪',
    notes:  document.getElementById('bf-notes')?.value.trim()  || '',
    status: document.getElementById('bf-status')?.value        || 'active',
    updatedAt: new Date().toISOString(), updatedBy: getCU()
  };
  try {
    const id = editingBranch || uid();
    if (!editingBranch) data.createdAt = new Date().toISOString();
    await FB.$update(FB.$ref(DB, `ctg/branches/${id}`), {name:data.name, city:data.city, addr:data.addr, phone:data.phone, mgr:data.mgr, icon:data.icon, notes:data.notes, status:data.status, updatedAt:data.updatedAt, createdAt:data.createdAt||BS.branches[id]?.createdAt||data.updatedAt});
    BS.branches[id] = {...(BS.branches[id]||{}), ...data};
    closeModal('modal-branch');
    renderBranches();
    toast(editingBranch ? 'تم تحديث الفرع ✅' : 'تم إنشاء الفرع ✅');
    editingBranch = null;
    // If first branch, switch to it automatically
    if (Object.keys(BS.branches).length === 1) switchBranch(id);
  } catch(e) { toast('خطأ: '+e.message,'error'); }
}

async function delBranch(id) {
  if (id === BS.currentBranchId) { toast('لا يمكن حذف الفرع الحالي','error'); return; }
  if (!confirm(`حذف الفرع "${BS.branches[id]?.name}"؟ سيتم حذف كل بياناته نهائياً!`)) return;
  try {
    await FB.$remove(FB.$ref(DB, `ctg/branches/${id}`));
    delete BS.branches[id];
    renderBranches();
    toast('تم حذف الفرع');
  } catch(e) { toast('خطأ: '+e.message,'error'); }
}

// ============================================================
// LISTEN ALL BRANCHES (superadmin only)
// ============================================================
function listenAllBranches() {
  FB.$onValue(FB.$ref(DB, 'ctg/branches'), snap => {
    const data = snap.val() || {};
    // Extract only metadata (not full data) for branch list
    BS.branches = {};
    Object.entries(data).forEach(([id, b]) => {
      BS.branches[id] = {
        name: b.name||'', city: b.city||'', addr: b.addr||'',
        phone: b.phone||'', mgr: b.mgr||'', icon: b.icon||'🏪',
        notes: b.notes||'', status: b.status||'active',
        createdAt: b.createdAt||'', updatedAt: b.updatedAt||''
      };
    });
    renderBranches();
    // Auto-select saved branch
    const saved = localStorage.getItem('ctg-branch');
    if (saved && BS.branches[saved] && BS.currentBranchId !== saved) {
      switchBranch(saved);
    } else if (!BS.currentBranchId && Object.keys(BS.branches).length > 0) {
      const firstActive = Object.entries(BS.branches).find(([,b]) => b.status==='active');
      if (firstActive) switchBranch(firstActive[0]);
    }
  });
}
