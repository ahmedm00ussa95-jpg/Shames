/* ============================================================
   core.js — النواة: State + Firebase + DB Helpers + Utilities
   الشمس - Al Shams ERP | المرحلة الأولى
   ============================================================ */

// ============================================================
// STATE المركزي — كل بيانات التطبيق
// ============================================================
const S = {
  products:{}, customers:{}, warehouses:{}, sales:{},
  purchases:{}, expenses:{}, suppliers:{}, movements:{},
  categories:{}, cashboxes:{}, cashboxLog:{}, users:{}, returns:{},
  settings:{
    company:'الشمس - Al Shams', phone:'01028631512',
    web:'https://computer.ordersapps.com/ar', addr:'', curr:'EGP',
    warranty:3, bank:'', account:'', swift:''
  }
};
let DB = null;
const FB = {};

// ============================================================
// FIREBASE — الاتصال والاستماع للبيانات
// ============================================================
window.addEventListener('fbReady', () => {
  DB = window.$db;
  FB.db = DB;
  FB.$ref    = window.$ref;
  FB.$set    = window.$set;
  FB.$push   = window.$push;
  FB.$update = window.$update;
  FB.$remove = window.$remove;
  FB.$onValue= window.$onValue;

  const listen = (path, cb) =>
    FB.$onValue(FB.$ref(DB, 'ctg/' + path), snap => cb(snap.val() || {}));

  const listenAndSave = (path, cb) =>
    listen(path, v => { cb(v); IDB.saveStore(path, v).catch(() => {}); });

  listenAndSave('products',    v => { S.products    = v; renderProducts();   renderPosGrid(); updateDashboard(); updateBCSelects(); fillCatSelects(); renderWarehouses(); renderCategories(); });
  listenAndSave('customers',   v => { S.customers   = v; renderCustomers();  updateCustSelects(); updateDashboard(); if(document.getElementById('pg-debts')?.classList.contains('active')) renderDebtsPage(); });
  listenAndSave('warehouses',  v => { S.warehouses  = v; renderWarehouses(); updateWhSelects(); updateDashboard(); });
  listenAndSave('sales',       v => { S.sales       = v; renderSales();      updateDashboard(); updateFinance(); if(document.getElementById('pg-debts')?.classList.contains('active')) renderDebtsPage(); });
  listenAndSave('purchases',   v => { S.purchases   = v; renderPurchases();  renderSuppliers(); if(document.getElementById('pg-debts')?.classList.contains('active')) renderDebtsPage(); });
  listenAndSave('expenses',    v => { S.expenses    = v; renderExpenses();   updateFinance(); });
  listenAndSave('suppliers',   v => { S.suppliers   = v; renderSuppliers();  fillSupSelects(); });
  listenAndSave('movements',   v => { S.movements   = v; renderMovements(); });
  listenAndSave('categories',  v => { S.categories  = v; renderCategories(); fillCatSelects(); renderProducts(); });
  listenAndSave('cashboxes',   v => { S.cashboxes   = v; renderCashboxes();  fillCashboxSelects(); });
  listenAndSave('cashboxLog',  v => { S.cashboxLog  = v; renderCashboxLog(); });
  listenAndSave('returns',     v => { S.returns     = v; if(document.getElementById('pg-returns')?.classList.contains('active')) renderReturns(); });
  listen('settings', v => {
    if (v && v.company) {
      S.settings = { ...S.settings, ...v };
      IDB.saveStore('settings', S.settings).catch(() => {});
      loadSettingsUI();
      if (document.getElementById('pg-inv-settings')?.classList.contains('active')) loadInvSettingsUI();
    }
  });
  listen('users', v => {
    S.users = v || {};
    IDB.saveStore('users', S.users).catch(() => {});
    renderUsers();
  });

  setTimeout(async () => {
    document.getElementById('loading').classList.add('out');
    await initDefaultUsers();
    if (S.users && Object.keys(S.users).length) {
      IDB.saveStore('users', S.users).catch(() => {});
    }
    if (!checkSession()) {
      document.getElementById('login-screen').style.display = 'flex';
      document.querySelector('.layout').style.display = 'none';
    }
  }, 1800);

  setTimeout(() => { renderCategories(); renderWarehouses(); fillCatSelects(); }, 2500);
  setTimeout(checkAutoBackup, 3000);
  document.getElementById('pos-scan-input')?.focus();

  setInterval(() => {
    const pg = document.getElementById('pg-dashboard');
    if (pg && pg.classList.contains('active')) updateDashboard();
  }, 30000);
});

// ============================================================
// DB HELPERS — عمليات Firebase المركزية
// ============================================================
async function dbSet(path, val)    { await FB.$set(FB.$ref(DB, 'ctg/' + path), val); }
async function dbPush(path, val)   { return await FB.$push(FB.$ref(DB, 'ctg/' + path), val); }
async function dbUpdate(path, val) { await FB.$update(FB.$ref(DB, 'ctg/' + path), val); }
async function dbRemove(path)      { await FB.$remove(FB.$ref(DB, 'ctg/' + path)); }

// ============================================================
// UTILITIES — دوال مساعدة مشتركة
// ============================================================
function N(n, d=2)    { return (+n||0).toLocaleString('ar-EG', {minimumFractionDigits:d, maximumFractionDigits:d}); }
function fNum(n, d=2) { return N(n, d); }
function fDate(d)     {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('ar-EG', {year:'numeric', month:'short', day:'numeric'}); }
  catch { return d; }
}
function uid()  { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function today(){ return new Date().toISOString().split('T')[0]; }
function escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function escRegex(s){ return (s||'').replace(/[-.*+?^${}()|\[\]\\]/g,'\\$&'); }

const PAY_NAMES = {cash:'نقدي', card:'بطاقة', transfer:'تحويل', credit:'آجل', check:'شيك'};
const CB_TYPES  = {cash:'نقدي', bank:'بنكي', transfer:'تحويل', card:'بطاقة'};

// ============================================================
// SELECT HELPERS
// ============================================================
function updateWhSelects() {
  const opts     = Object.entries(S.warehouses).map(([id,w]) => `<option value="${id}">${w.name}</option>`).join('');
  const emptyOpts= '<option value="">-- اختر مخزن --</option>' + opts;
  const filterOpts='<option value="">كل المخازن</option>' + opts;
  ['pf-wh','purf-wh','mi-wh'].forEach(id => { const el=document.getElementById(id); if(el) el.innerHTML=emptyOpts; });
  ['pos-wh','prod-wh-filter','rep-wh'].forEach(id => { const el=document.getElementById(id); if(el) el.innerHTML=filterOpts; });
}
function updateCustSelects() {
  // Smart selects يقرأون من S.customers مباشرة
}
function fillSupSelects() {
  // Smart selects يقرأون من S.suppliers مباشرة
}
function updateBCSelects() {
  const el = document.getElementById('bc-prod'); if (!el) return;
  el.innerHTML = '<option value="">-- اختر منتج --</option>' +
    Object.entries(S.products).map(([id,p]) => `<option value="${id}">${p.name} (${p.code||'-'})</option>`).join('');
}
function fillCashboxSelects() {
  const opts = Object.entries(S.cashboxes).map(([id,cb]) => `<option value="${id}">${cb.name}</option>`).join('');
  ['ef-cashbox','purf-cashbox','pos-cashbox'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<option value="">-- اختر خزينة --</option>' + opts;
  });
  // خزينة دفع الديون
  const pdEl = document.getElementById('pd-cashbox');
  if (pdEl) pdEl.innerHTML = opts;
  // خزينة المرتجع
  const retEl = document.getElementById('retf-cashbox');
  if (retEl) retEl.innerHTML = '<option value="">-- اختر خزينة --</option>' + opts;
}
function fillCatSelects() {
  const cats = getAllCats();
  const opts = Object.entries(cats).map(([id,c]) => `<option value="${id}">${c.icon||'📦'} ${c.name}</option>`).join('');
  ['pf-cat','ef-cat'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<option value="">-- فئة --</option>' + opts;
  });
  const posEl = document.getElementById('pos-cat');
  if (posEl) posEl.innerHTML = '<option value="">كل الفئات</option>' + opts;
}

// ============================================================
// CASHBOX ENTRY
// ============================================================
async function addCashboxEntry(cbId, amount, type, desc, ref='') {
  if (!cbId) return;
  const cb = S.cashboxes[cbId]; if (!cb) return;
  const newBal = (+cb.balance||0) + (type==='deposit' ? amount : -amount);
  await dbUpdate('cashboxes/' + cbId, {balance: Math.max(0, newBal), updatedAt: new Date().toISOString()});
  await dbPush('cashboxLog', {cbId, cbName:cb.name, type, amount, desc, ref, createdAt:new Date().toISOString(), date:today(), createdBy:getCU()});
}

// ============================================================
// POS - Inline Add Customer
// ============================================================
function togglePosAddCust() {
  const form = document.getElementById('pos-add-cust-form');
  if (!form) return;
  const isHidden = form.style.display === 'none' || form.style.display === '';
  form.style.display = isHidden ? 'flex' : 'none';
  if (isHidden) {
    document.getElementById('pos-new-cust-name').value = '';
    document.getElementById('pos-new-cust-phone').value = '';
    document.getElementById('pos-new-cust-addr').value = '';
    setTimeout(() => document.getElementById('pos-new-cust-name')?.focus(), 50);
  }
}

async function savePosNewCust() {
  const name  = (document.getElementById('pos-new-cust-name')?.value||'').trim();
  if (!name) { toast('يرجى إدخال اسم العميل','error'); return; }
  const phone = (document.getElementById('pos-new-cust-phone')?.value||'').trim();
  const addr  = (document.getElementById('pos-new-cust-addr')?.value||'').trim();
  const data  = {name, phone, addr, email:'', notes:'', totalBuy:0, balance:0, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()};
  try {
    const newKey = uid();
    await dbUpdate('customers/' + newKey, data);
    const wrap = document.getElementById('pos-cust-wrap');
    if (wrap) {
      const hidden = wrap.querySelector('input[type=hidden]');
      const labelEl= wrap.querySelector('.ss-label');
      if (hidden) hidden.value = newKey;
      if (labelEl) { labelEl.textContent = name; labelEl.style.color = 'var(--text)'; }
    }
    togglePosAddCust && togglePosAddCust();
    toast('تم إضافة العميل واختياره ✅');
  } catch(e) { toast('خطأ: ' + e.message,'error'); }
}

function updatePosPayCashbox() {
  const pay   = document.getElementById('pos-pay')?.value||'cash';
  const cbSel = document.getElementById('pos-cashbox'); if (!cbSel) return;
  const typeMap = {cash:'cash', card:'card', transfer:'transfer'};
  const cbType  = typeMap[pay]||'cash';
  const matching= Object.entries(S.cashboxes).filter(([,cb]) => cb.type===cbType);
  const opts = '<option value="">-- اختر خزينة --</option>' +
    Object.entries(S.cashboxes).map(([id,cb]) =>
      `<option value="${id}" ${cb.type===cbType?'selected':''}>${cb.name}</option>`).join('');
  cbSel.innerHTML = opts;
  if (matching.length > 0) cbSel.value = matching[0][0];
}

function calcChange() {
  const total = parseFloat(document.getElementById('pos-total')?.textContent?.replace(/[^\d.]/g,''))||0;
  const paid  = parseFloat(document.getElementById('pos-paid')?.value)||0;
  const row   = document.getElementById('change-row');
  const val   = document.getElementById('change-val');
  if (paid > 0 && paid >= total) {
    if (row) row.style.display = 'flex';
    if (val) val.textContent = N(paid - total);
  } else {
    if (row) row.style.display = 'none';
  }
}

// ============================================================
// PHASE 2 — DB PATCH: route all writes through branch
// ============================================================
// Override the base dbSet/dbPush/dbUpdate/dbRemove to use branch path
// Called after branch is selected
function patchCoreFunctions() {
  // These wrap the originals to go through getBranchPath
  const origDbSet    = dbSet;
  const origDbPush   = dbPush;
  const origDbUpdate = dbUpdate;
  const origDbRemove = dbRemove;

  window.dbSet    = async (path,val)  => FB.$set(FB.$ref(DB, getBranchPath(path)), val);
  window.dbPush   = async (path,val)  => FB.$push(FB.$ref(DB, getBranchPath(path)), val);
  window.dbUpdate = async (path,val)  => FB.$update(FB.$ref(DB, getBranchPath(path)), val);
  window.dbRemove = async (path)      => FB.$remove(FB.$ref(DB, getBranchPath(path)));
}

// ============================================================
// PHASE 2 — ENHANCED FIREBASE INIT: multi-branch listeners
// ============================================================
window.addEventListener('fbReady', () => {
  // Override listeners on branch switch
  DB = window.$db;
  FB.db = DB;
  FB.$ref    = window.$ref;
  FB.$set    = window.$set;
  FB.$push   = window.$push;
  FB.$update = window.$update;
  FB.$remove = window.$remove;
  FB.$onValue= window.$onValue;

  // Listen to global users (across all branches)
  FB.$onValue(FB.$ref(DB, 'ctg/users'), snap => {
    S.users = snap.val() || {};
    IDB.saveStore('users', S.users).catch(()=>{});
    if (typeof renderUsers === 'function') renderUsers();
  });

  // Listen to global settings
  FB.$onValue(FB.$ref(DB, 'ctg/settings'), snap => {
    const v = snap.val();
    if (v && v.company) {
      S.settings = {...S.settings, ...v};
      IDB.saveStore('settings', S.settings).catch(()=>{});
      if (typeof loadSettingsUI === 'function') loadSettingsUI();
    }
  });

  // Init default users and auth check
  setTimeout(async () => {
    document.getElementById('loading').classList.add('out');
    await initDefaultUsers();
    // Listen to all branches (superadmin needs this)
    if (typeof listenAllBranches === 'function') listenAllBranches();
    if (!checkSession()) {
      document.getElementById('login-screen').style.display = 'flex';
      document.querySelector('.layout').style.display = 'none';
    }
  }, 1800);

  setTimeout(checkAutoBackup, 3000);
  setInterval(() => {
    const pg = document.getElementById('pg-dashboard');
    if (pg && pg.classList.contains('active')) updateDashboard();
  }, 30000);
}, {once: true});
