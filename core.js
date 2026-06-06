/* ============================================================
   core.js — النواة: State + Firebase + DB Helpers + Utilities
   ============================================================ */

// ============================================================
// STATE المركزي
// ============================================================
const S = {
  products:{}, customers:{}, warehouses:{}, sales:{},
  purchases:{}, expenses:{}, suppliers:{}, movements:{},
  categories:{}, cashboxes:{}, cashboxLog:{}, users:{}, returns:{},
  settings:{
    company:'الشمس - Al Shams', phone:'01028631512',
    web:'', addr:'', curr:'EGP', warranty:3, bank:'', account:'', swift:''
  }
};

let DB  = null;
const FB = {};
const BS = { branches:{}, currentBranch:null, currentBranchId:null };

// ============================================================
// DB HELPERS
// ============================================================
function getBranchPath(path) {
  if (!BS.currentBranchId) return 'ctg/' + path;
  return `ctg/branches/${BS.currentBranchId}/${path}`;
}

async function dbSet   (path,val) { await FB.$set(FB.$ref(DB, getBranchPath(path)), val); }
async function dbPush  (path,val) { return await FB.$push(FB.$ref(DB, getBranchPath(path)), val); }
async function dbUpdate(path,val) { await FB.$update(FB.$ref(DB, getBranchPath(path)), val); }
async function dbRemove(path)     { await FB.$remove(FB.$ref(DB, getBranchPath(path))); }

// ============================================================
// UTILITIES
// ============================================================
function N(n,d=2)  { return (+n||0).toLocaleString('ar-EG',{minimumFractionDigits:d,maximumFractionDigits:d}); }
function fNum(n,d=2){ return N(n,d); }
function fDate(d)  { if(!d) return '—'; try{ return new Date(d).toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'}); }catch{return d;} }
function uid()     { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function today()   { return new Date().toISOString().split('T')[0]; }
function escHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escRegex(s){ return (s||'').replace(/[-.*+?^${}()|\[\]\\]/g,'\\$&'); }
function getCU()   { return CURRENT_USER?.username || CURRENT_USER?.name || 'system'; }

const PAY_NAMES = {cash:'نقدي', card:'بطاقة', transfer:'تحويل', credit:'آجل', check:'شيك'};
const CB_TYPES  = {cash:'نقدي', bank:'بنكي', transfer:'تحويل', card:'بطاقة'};

// ============================================================
// FIREBASE INIT — called once when fbReady fires
// ============================================================
window.addEventListener('fbReady', function initFirebase() {
  DB           = window.$db;
  FB.$ref      = window.$ref;
  FB.$set      = window.$set;
  FB.$push     = window.$push;
  FB.$update   = window.$update;
  FB.$remove   = window.$remove;
  FB.$onValue  = window.$onValue;

  console.log('✅ Firebase connected');

  // Helper to listen + save to IDB
  function listen(path, cb) {
    FB.$onValue(FB.$ref(DB, 'ctg/' + path), snap => cb(snap.val() || {}));
  }
  function listenBranch(branchId, path, cb) {
    FB.$onValue(FB.$ref(DB, `ctg/branches/${branchId}/${path}`), snap => cb(snap.val() || {}));
  }

  // Global listeners (not per-branch)
  FB.$onValue(FB.$ref(DB, 'ctg/users'), snap => {
    S.users = snap.val() || {};
    IDB.saveStore('users', S.users).catch(()=>{});
    if (typeof renderUsers === 'function') renderUsers();
  });

  FB.$onValue(FB.$ref(DB, 'ctg/settings'), snap => {
    const v = snap.val();
    if (v && v.company) {
      S.settings = { ...S.settings, ...v };
      IDB.saveStore('settings', S.settings).catch(()=>{});
      if (typeof loadSettingsUI === 'function') loadSettingsUI();
    }
  });

  // Branch data listeners
  FB.$onValue(FB.$ref(DB, 'ctg/branches'), snap => {
    const data = snap.val() || {};
    BS.branches = {};
    Object.entries(data).forEach(([id, b]) => {
      if (b && b.name) BS.branches[id] = {
        name:b.name, city:b.city||'', addr:b.addr||'', phone:b.phone||'',
        mgr:b.mgr||'', icon:b.icon||'🏪', notes:b.notes||'',
        status:b.status||'active', createdAt:b.createdAt||'', updatedAt:b.updatedAt||''
      };
    });
    if (typeof renderBranches === 'function') renderBranches();
  });

  // Hide loading + check session after init
  setTimeout(async () => {
    // Try to init default users if none exist
    if (typeof initDefaultUsers === 'function') await initDefaultUsers();

    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('out');

    if (typeof checkSession === 'function') {
      const ok = checkSession();
      if (!ok) {
        const ls = document.getElementById('login-screen');
        const ly = document.querySelector('.layout');
        if (ls) ls.style.display = 'flex';
        if (ly) ly.style.display = 'none';
      }
    }

    if (typeof checkAutoBackup === 'function') checkAutoBackup();
    if (typeof OM !== 'undefined') OM.init();
  }, 800);

  // Dashboard auto-refresh
  setInterval(() => {
    const pg = document.getElementById('pg-dashboard');
    if (pg && pg.classList.contains('active') && typeof updateDashboard === 'function') {
      updateDashboard();
    }
  }, 30000);

}, { once: true });

// ============================================================
// listenBranchData — called when switching branches
// ============================================================
function listenBranchData(branchId) {
  if (!DB || !branchId) return;
  const base = `ctg/branches/${branchId}`;

  function sub(path, cb) {
    FB.$onValue(FB.$ref(DB, `${base}/${path}`), snap => {
      const val = snap.val() || {};
      cb(val);
      IDB.saveStore(path, val).catch(()=>{});
    });
  }

  sub('products',   v => { S.products  = v; if(typeof renderProducts==='function') renderProducts(); if(typeof renderPosGrid==='function') renderPosGrid(); if(typeof updateDashboard==='function') updateDashboard(); if(typeof updateBCSelects==='function') updateBCSelects(); if(typeof fillCatSelects==='function') fillCatSelects(); });
  sub('customers',  v => { S.customers = v; if(typeof renderCustomers==='function') renderCustomers(); if(typeof updateDashboard==='function') updateDashboard(); });
  sub('warehouses', v => { S.warehouses= v; if(typeof renderWarehouses==='function') renderWarehouses(); if(typeof updateWhSelects==='function') updateWhSelects(); });
  sub('sales',      v => { S.sales     = v; if(typeof renderSales==='function') renderSales(); if(typeof updateDashboard==='function') updateDashboard(); if(typeof updateFinance==='function') updateFinance(); });
  sub('purchases',  v => { S.purchases = v; if(typeof renderPurchases==='function') renderPurchases(); });
  sub('expenses',   v => { S.expenses  = v; if(typeof renderExpenses==='function') renderExpenses(); if(typeof updateFinance==='function') updateFinance(); });
  sub('suppliers',  v => { S.suppliers = v; if(typeof renderSuppliers==='function') renderSuppliers(); if(typeof fillSupSelects==='function') fillSupSelects(); });
  sub('movements',  v => { S.movements = v; if(typeof renderMovements==='function') renderMovements(); });
  sub('categories', v => { S.categories= v; if(typeof renderCategories==='function') renderCategories(); if(typeof fillCatSelects==='function') fillCatSelects(); });
  sub('cashboxes',  v => { S.cashboxes = v; if(typeof renderCashboxes==='function') renderCashboxes(); if(typeof fillCashboxSelects==='function') fillCashboxSelects(); });
  sub('cashboxLog', v => { S.cashboxLog= v; if(typeof renderCashboxLog==='function') renderCashboxLog(); });
  sub('returns',    v => { S.returns   = v; });
  sub('settings',   v => { if(v&&v.company){ S.settings={...S.settings,...v}; if(typeof loadSettingsUI==='function') loadSettingsUI(); } });
}

// ============================================================
// SELECT HELPERS
// ============================================================
function updateWhSelects() {
  const opts      = Object.entries(S.warehouses).map(([id,w])=>`<option value="${id}">${w.name}</option>`).join('');
  const emptyOpts = '<option value="">-- اختر مخزن --</option>'+opts;
  const filterOpts= '<option value="">كل المخازن</option>'+opts;
  ['pf-wh','purf-wh','mi-wh'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=emptyOpts;});
  ['pos-wh','prod-wh-filter','rep-wh'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=filterOpts;});
  // mov-wh-filter
  const movWh=document.getElementById('mov-wh-filter');
  if(movWh) movWh.innerHTML='<option value="">كل المخازن</option>'+opts;
  // sc-wh
  const scWh=document.getElementById('sc-wh');
  if(scWh) scWh.innerHTML='<option value="">-- اختر المخزن --</option>'+opts;
  // tr-from tr-to
  ['tr-from','tr-to'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML='<option value="">--</option>'+opts;});
}

function updateBCSelects() {
  const el=document.getElementById('bc-prod'); if(!el) return;
  el.innerHTML='<option value="">-- اختر منتج --</option>'+
    Object.entries(S.products).map(([id,p])=>`<option value="${id}">${p.name} (${p.code||'—'})</option>`).join('');
}

function fillCashboxSelects() {
  const opts='<option value="">-- بدون خزينة --</option>'+
    Object.entries(S.cashboxes).map(([id,cb])=>`<option value="${id}">${cb.name} (${N(cb.balance||0)} EGP)</option>`).join('');
  ['pos-cashbox','mi-cashbox','purf-cashbox','ef-cashbox','retf-cashbox'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=opts;});
  const pdCb=document.getElementById('pd-cashbox');
  if(pdCb) pdCb.innerHTML='<option value="">-- اختر الخزينة (إلزامي) --</option>'+
    Object.entries(S.cashboxes).map(([id,cb])=>`<option value="${id}">${cb.name} (${N(cb.balance||0)} EGP)</option>`).join('');
  const shiftCb=document.getElementById('shift-open-cb');
  if(shiftCb) shiftCb.innerHTML='<option value="">-- اختر الخزينة --</option>'+
    Object.entries(S.cashboxes).map(([id,cb])=>`<option value="${id}">${cb.name}</option>`).join('');
  if(typeof updatePosPayCashbox==='function') updatePosPayCashbox();
}

function fillCatSelects() {
  const cats=getAllCats();
  const opts=Object.entries(cats).map(([id,c])=>`<option value="${id}">${c.icon||'📦'} ${c.name}</option>`).join('');
  ['pf-cat','ef-cat'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML='<option value="">-- فئة --</option>'+opts;});
  const posEl=document.getElementById('pos-cat');
  if(posEl) posEl.innerHTML='<option value="">كل الفئات</option>'+opts;
}

function fillSupSelects() {}
function updateCustSelects() {}

// ============================================================
// CASHBOX ENTRY
// ============================================================
async function addCashboxEntry(cbId, amount, type, desc, ref='') {
  if(!cbId) return;
  const cb=S.cashboxes[cbId]; if(!cb) return;
  const newBal=(+cb.balance||0)+(type==='deposit'?amount:-amount);
  await dbUpdate('cashboxes/'+cbId, {balance:Math.max(0,newBal), updatedAt:new Date().toISOString()});
  await dbPush('cashboxLog', {cbId, cbName:cb.name, type, amount, desc, ref, createdAt:new Date().toISOString(), date:today(), createdBy:getCU()});
}

// ============================================================
// POS helpers
// ============================================================
function calcChange() {
  const total=parseFloat(document.getElementById('pos-total')?.textContent?.replace(/[^\d.]/g,''))||0;
  const paid =parseFloat(document.getElementById('pos-paid')?.value)||0;
  const row  =document.getElementById('change-row');
  const val  =document.getElementById('change-val');
  if(paid>0&&paid>=total){if(row)row.style.display='flex';if(val)val.textContent=N(paid-total);}
  else{if(row)row.style.display='none';}
}

function updatePosPayCashbox() {
  const pay=document.getElementById('pos-pay')?.value||'cash';
  const cbSel=document.getElementById('pos-cashbox'); if(!cbSel) return;
  const typeMap={cash:'cash',card:'card',transfer:'transfer'};
  const cbType=typeMap[pay]||'cash';
  if(pay==='credit'){cbSel.innerHTML='<option value="">-- لا خزينة (آجل) --</option>';cbSel.disabled=true;return;}
  cbSel.disabled=false;
  const opts='<option value="">-- اختر خزينة --</option>'+
    Object.entries(S.cashboxes).map(([id,cb])=>`<option value="${id}" ${cb.type===cbType?'selected':''}>${cb.name}</option>`).join('');
  cbSel.innerHTML=opts;
  const matching=Object.entries(S.cashboxes).find(([,cb])=>cb.type===cbType);
  if(matching) cbSel.value=matching[0];
}

function togglePosAddCust() {
  const form=document.getElementById('pos-add-cust-form'); if(!form) return;
  const isHidden=form.style.display==='none'||form.style.display==='';
  form.style.display=isHidden?'flex':'none';
  if(isHidden) setTimeout(()=>document.getElementById('pos-new-cust-name')?.focus(),50);
}

async function savePosNewCust() {
  const name=(document.getElementById('pos-new-cust-name')?.value||'').trim();
  if(!name){toast('يرجى إدخال اسم العميل','error');return;}
  const phone=(document.getElementById('pos-new-cust-phone')?.value||'').trim();
  const addr =(document.getElementById('pos-new-cust-addr')?.value||'').trim();
  const data ={name,phone,addr,email:'',notes:'',totalBuy:0,balance:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  try {
    const newKey=uid();
    await dbUpdate('customers/'+newKey,data);
    const wrap=document.getElementById('pos-cust-wrap');
    if(wrap){const h=wrap.querySelector('input[type=hidden]');const l=wrap.querySelector('.ss-label');if(h)h.value=newKey;if(l){l.textContent=name;l.style.color='var(--text)';}}
    togglePosAddCust();
    toast('تم إضافة العميل ✅');
  } catch(e){toast('خطأ: '+e.message,'error');}
}

