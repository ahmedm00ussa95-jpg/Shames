/* ============================================================
   auth.js — المصادقة: Login + Users + IDB + Offline Manager
   الشمس - Al Shams ERP | المرحلة الأولى
   ============================================================ */

// ============================================================
// AUTH
// ============================================================
let CURRENT_USER = null;

function getCU() { return CURRENT_USER?.username || CURRENT_USER?.name || 'system'; }

function checkSession() {
  const raw = sessionStorage.getItem('ctg-user');
  if (!raw) return false;
  try {
    const u = JSON.parse(raw);
    if (!u || !u.username) return false;
    CURRENT_USER = u;
    showMainLayout(u);
    return true;
  } catch { return false; }
}

function showMainLayout(u) {
  document.getElementById('login-screen').style.display = 'none';
  document.querySelector('.layout').style.display = 'flex';
  const infoEl = document.getElementById('topbar-user-info');
  if (infoEl) {
    infoEl.style.display = 'flex';
    const roleMap = {admin:'role-admin', cashier:'role-cashier', accountant:'role-accountant'};
    const roleNameMap = {admin:'مدير', cashier:'كاشير', accountant:'محاسب'};
    infoEl.innerHTML = `
      <div style="width:28px;height:28px;background:var(--accent-bg);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:12px;">👤</div>
      <div><strong>${u.name || u.username}</strong></div>
      <span class="user-role-badge ${roleMap[u.role] || 'role-cashier'}">${roleNameMap[u.role] || u.role}</span>`;
  }
  // Restrict cashier access
  if (u.role === 'cashier') {
    const restricted = ['users','settings','inv-settings','finance','debts','reports','expenses'];
    document.querySelectorAll('.sb-item').forEach(el => {
      if (restricted.includes(el.dataset.page)) el.style.display = 'none';
    });
  }
  nav('dashboard');
}

async function doLogin() {
  const username = (document.getElementById('login-user')?.value || '').trim().toLowerCase();
  const pass     = document.getElementById('login-pass')?.value || '';
  const errEl    = document.getElementById('login-err');
  if (errEl) errEl.style.display = 'none';
  if (!username || !pass) { if (errEl) { errEl.textContent = 'يرجى إدخال اسم المستخدم وكلمة المرور'; errEl.style.display = 'block'; } return; }

  const users = S.users || {};
  let found = Object.entries(users).find(([, u]) => u.username === username && u.status !== 'inactive');
  if (!found) {
    // Try offline IDB
    const offlineUsers = await IDB.getStore('users').catch(() => ({}));
    const all = {...users, ...offlineUsers};
    found = Object.entries(all).find(([, u]) => u.username === username && u.status !== 'inactive');
  }
  if (!found) { if (errEl) { errEl.textContent = 'اسم المستخدم غير موجود أو معطل'; errEl.style.display = 'block'; } return; }
  const [, user] = found;
  if (user.password !== btoa(pass)) { if (errEl) { errEl.textContent = 'كلمة المرور غير صحيحة'; errEl.style.display = 'block'; } return; }

  CURRENT_USER = user;
  sessionStorage.setItem('ctg-user', JSON.stringify(user));
  showMainLayout(user);
}

function doLogout() {
  CURRENT_USER = null;
  sessionStorage.removeItem('ctg-user');
  document.getElementById('login-screen').style.display = 'flex';
  document.querySelector('.layout').style.display = 'none';
  const passEl = document.getElementById('login-pass');
  if (passEl) passEl.value = '';
}

// ============================================================
// USERS MANAGEMENT
// ============================================================
let editingUser = null;

async function initDefaultUsers() {
  if (S.users && Object.keys(S.users).length) return;
  const adminId = uid();
  const defaultAdmin = { username:'admin', password:btoa('admin123'), name:'المدير', role:'admin', status:'active', createdAt:new Date().toISOString() };
  await dbUpdate('users/' + adminId, defaultAdmin);
  S.users = { [adminId]: defaultAdmin };
}

function renderUsers() {
  const tbody = document.getElementById('users-tbl'); if (!tbody) return;
  const users = S.users || {};
  const roleNameMap = {admin:'مدير', cashier:'كاشير', accountant:'محاسب'};
  const roleBadge = {admin:'badge-danger', cashier:'badge-success', accountant:'badge-purple'};
  const rows = Object.entries(users);
  tbody.innerHTML = rows.length
    ? rows.map(([id, u]) => `<tr>
        <td><strong>${u.name || '-'}</strong></td>
        <td style="color:var(--accent);">${u.username}</td>
        <td><span class="badge ${roleBadge[u.role]||'badge-info'}">${roleNameMap[u.role]||u.role}</span></td>
        <td><span class="badge ${u.status==='active'?'badge-success':'badge-danger'}">${u.status==='active'?'نشط':'معطل'}</span></td>
        <td>
          <button class="btn btn-ghost btn-xs" onclick="editUser('${id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-xs" onclick="delUser('${id}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text2);">لا يوجد مستخدمون</td></tr>';
}

function openAddUser() {
  editingUser = null;
  document.getElementById('user-modal-title').textContent = 'مستخدم جديد';
  resetForm('uf');
  openModal('modal-user');
}

function editUser(id) {
  const u = S.users[id]; if (!u) return;
  editingUser = id;
  document.getElementById('user-modal-title').textContent = 'تعديل المستخدم';
  document.getElementById('uf-username').value = u.username || '';
  document.getElementById('uf-name').value     = u.name || '';
  document.getElementById('uf-pass').value     = '';
  document.getElementById('uf-role').value     = u.role || 'cashier';
  document.getElementById('uf-status').value   = u.status || 'active';
  openModal('modal-user');
}

async function saveUser() {
  const username = (document.getElementById('uf-username').value || '').trim().toLowerCase().replace(/\s+/g,'');
  const name     = (document.getElementById('uf-name').value || '').trim();
  const pass     = document.getElementById('uf-pass').value || '';
  const role     = document.getElementById('uf-role').value;
  const status   = document.getElementById('uf-status').value;
  if (!username || !name) { toast('يرجى ملء الحقول الإلزامية','error'); return; }
  if (!editingUser && !pass) { toast('يرجى إدخال كلمة المرور','error'); return; }
  if (pass && pass.length < 6) { toast('كلمة المرور يجب أن تكون 6 أحرف على الأقل','error'); return; }
  // Check duplicate username
  const dup = Object.entries(S.users||{}).find(([id,u]) => u.username===username && id!==editingUser);
  if (dup) { toast('اسم المستخدم مستخدم بالفعل','error'); return; }
  const data = { username, name, role, status, updatedAt:new Date().toISOString() };
  if (pass) data.password = btoa(pass);
  if (!editingUser) data.createdAt = new Date().toISOString();
  try {
    const id = editingUser || uid();
    await dbUpdate('users/' + id, editingUser ? data : {...data});
    closeModal('modal-user');
    toast(editingUser ? 'تم تحديث المستخدم ✅' : 'تم إضافة المستخدم ✅');
    editingUser = null;
  } catch(e) { toast('خطأ: ' + e.message,'error'); }
}

async function delUser(id) {
  const u = S.users[id]; if (!u) return;
  if (u.username === 'admin') { toast('لا يمكن حذف حساب المدير الرئيسي','error'); return; }
  if (!confirm(`حذف المستخدم "${u.name}"؟`)) return;
  await dbRemove('users/' + id);
  toast('تم الحذف');
}

// ============================================================
// INDEXEDDB ENGINE
// ============================================================
const IDB = {
  db: null, DB_NAME:'ctg_offline', DB_VERSION:1,
  STORES:['products','customers','warehouses','sales','purchases',
          'expenses','suppliers','movements','categories',
          'cashboxes','cashboxLog','users','settings','pending_queue','returns'],
  open() {
    return new Promise((resolve, reject) => {
      if (this.db) { resolve(this.db); return; }
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        this.STORES.forEach(store => {
          if (!db.objectStoreNames.contains(store))
            db.createObjectStore(store, {keyPath:'_key'});
        });
      };
      req.onsuccess = e => { this.db = e.target.result; resolve(this.db); };
      req.onerror   = e => reject(e.target.error);
    });
  },
  async saveStore(name, data) {
    try {
      const db = await this.open();
      const tx = db.transaction(name, 'readwrite');
      const st = tx.objectStore(name);
      st.clear();
      if (name === 'settings') {
        st.put({_key:'__cfg__', ...(data||{})});
      } else {
        Object.entries(data||{}).forEach(([k,v]) => {
          st.put({_key:k, ...(v&&typeof v==='object' ? v : {_v:v})});
        });
      }
      return new Promise((res,rej) => { tx.oncomplete=()=>res(true); tx.onerror=e=>rej(e); });
    } catch(e) { console.warn('IDB saveStore error', name, e); }
  },
  async getStore(name) {
    try {
      const db = await this.open();
      return new Promise((res,rej) => {
        const tx = db.transaction(name,'readonly');
        const req= tx.objectStore(name).getAll();
        req.onsuccess = e => {
          const rows = e.target.result||[];
          if (name === 'settings') {
            const r = rows[0]||{}; const {_key,...rest}=r; res(rest);
          } else {
            const obj = {};
            rows.forEach(r => { const {_key,...rest}=r; obj[_key]=rest; });
            res(obj);
          }
        };
        req.onerror = e => rej(e.target.error);
      });
    } catch(e) { return {}; }
  },
  async addToQueue(op) {
    try {
      const db = await this.open();
      const tx = db.transaction('pending_queue','readwrite');
      tx.objectStore('pending_queue').put({_key: Date.now()+'-'+Math.random(), ...op, ts: Date.now()});
      return new Promise((res,rej) => { tx.oncomplete=()=>res(); tx.onerror=e=>rej(e); });
    } catch(e) { console.warn('IDB addToQueue error', e); }
  },
  async getQueue() {
    try {
      const db = await this.open();
      return new Promise((res,rej) => {
        const req = db.transaction('pending_queue','readonly').objectStore('pending_queue').getAll();
        req.onsuccess = e => res(e.target.result||[]);
        req.onerror   = e => rej(e.target.error);
      });
    } catch(e) { return []; }
  },
  async clearQueue() {
    try {
      const db = await this.open();
      const tx = db.transaction('pending_queue','readwrite');
      tx.objectStore('pending_queue').clear();
      return new Promise((res,rej) => { tx.oncomplete=()=>res(); tx.onerror=e=>rej(e); });
    } catch(e) {}
  }
};

// ============================================================
// OFFLINE MANAGER
// ============================================================
const OM = {
  isOnline: navigator.onLine,
  syncing: false,

  init() {
    window.addEventListener('online',  () => this.goOnline());
    window.addEventListener('offline', () => this.goOffline());
    IDB.open().then(async () => {
      const q = await IDB.getQueue();
      updateQueueBadge(q.length);
    });
    this.updateUI();
    setInterval(() => { if (this.isOnline) this.syncToIDB(); }, 30000);
    this._createOfflineBadge();
  },

  _createOfflineBadge() {
    const badge = document.createElement('div');
    badge.id = 'offline-badge';
    badge.innerHTML = '<div class="dot"></div><span id="badge-msg">أوف لاين — اضغط لعرض العمليات المعلقة</span><span class="badge-count" id="badge-ops" style="display:none;">0 عملية</span>';
    badge.onclick = () => openQueuePanel();
    document.body.appendChild(badge);
  },

  goOnline() {
    this.isOnline = true;
    if (window.$db) window._fbAvailable = true;
    this.updateUI();
    document.getElementById('offline-badge')?.classList.remove('show');
    toast('🌐 عاد الإنترنت — جاري رفع العمليات المعلقة...','info');
    setTimeout(() => this.flushQueue(), 1500);
  },

  goOffline() {
    this.isOnline = false;
    this.updateUI();
    document.getElementById('offline-badge')?.classList.add('show');
    toast('📴 انقطع الإنترنت — يعمل أوف لاين','info');
  },

  updateUI() {
    const sb  = document.querySelector('.sb-status');
    if (sb) {
      if (this.isOnline) {
        sb.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:var(--green);display:inline-block;margin-left:5px;"></span>متصل بالسحابة';
        sb.style.color = 'var(--green)';
      } else {
        sb.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:var(--yellow);display:inline-block;margin-left:5px;animation:_pulse 1s infinite;"></span>أوف لاين';
        sb.style.color = 'var(--yellow)';
      }
    }
    const ind = document.getElementById('conn-indicator');
    const dot = document.getElementById('conn-dot');
    const txt = document.getElementById('conn-text');
    if (ind && dot && txt) {
      ind.style.display='flex'; ind.style.visibility='visible'; ind.style.opacity='1';
      if (this.isOnline) {
        ind.style.background='var(--green-bg)'; ind.style.borderColor='var(--green)'; ind.style.color='var(--green)';
        dot.style.background='var(--green)'; dot.style.animation='none';
        txt.textContent='متصل'; ind.onclick=null; ind.style.cursor='default';
      } else {
        ind.style.background='var(--yellow-bg)'; ind.style.borderColor='var(--yellow)'; ind.style.color='var(--yellow)';
        dot.style.background='var(--yellow)'; dot.style.animation='_pulse 1s infinite';
        txt.textContent='أوف لاين'; ind.style.cursor='pointer'; ind.onclick=()=>openQueuePanel();
      }
    }
  },

  _rerender(store) {
    try {
      if (store==='customers') { renderCustomers(); updateCustSelects(); }
      else if (store==='products') { renderProducts(); renderPosGrid(); updateBCSelects(); }
      else if (store==='sales') renderSales();
      else if (store==='purchases') renderPurchases();
      else if (store==='expenses') renderExpenses();
      else if (store==='suppliers') { renderSuppliers(); fillSupSelects(); }
      else if (store==='warehouses') { renderWarehouses(); updateWhSelects(); }
      else if (store==='cashboxes') { renderCashboxes(); fillCashboxSelects(); }
      else if (store==='categories') { renderCategories(); fillCatSelects(); }
      else if (store==='users') renderUsers();
      updateDashboard();
    } catch(e) {}
  },

  async loadFromIDB() {
    const stores = ['products','customers','warehouses','sales','purchases',
                    'expenses','suppliers','movements','categories','cashboxes','cashboxLog','users'];
    let found = false;
    for (const st of stores) {
      const d = await IDB.getStore(st);
      if (Object.keys(d).length) { S[st]=d; found=true; }
    }
    const cfg = await IDB.getStore('settings');
    if (cfg && cfg.company) S.settings = {...S.settings, ...cfg};
    if (found) {
      this._rerender('customers'); this._rerender('products'); this._rerender('sales');
      toast('📦 تم تحميل البيانات المحفوظة محلياً','info');
    } else {
      toast('⚠️ لا توجد بيانات محلية — يرجى الاتصال بالإنترنت أولاً','error');
    }
  },

  async flushQueue() {
    if (this.syncing || !this.isOnline || !window._fbAvailable) return;
    this.syncing = true;
    const skipped = [];
    try {
      const queue = await IDB.getQueue();
      if (!queue.length) { this.syncing=false; return; }
      toast(`🔄 مراجعة ${queue.length} عملية معلقة...`,'info');
      for (const op of queue) {
        try {
          if (op.type==='push')   { await _origDbPush(op.path, op.data);   continue; }
          if (op.type==='remove') { await _origDbRemove(op.path);           continue; }
          const localTs   = new Date(op.data?.updatedAt||op.data?.createdAt||op.data?.date||0).getTime();
          const localUser = op.data?.updatedBy||op.data?.createdBy||'';
          const key = op.path.split('/')[1];
          if (key && localTs > 0) {
            const cloudVal = await new Promise(res => {
              try { FB.$onValue(FB.$ref(DB,'ctg/'+op.path), s=>res(s.val()), {onlyOnce:true}); setTimeout(()=>res(null),4000); }
              catch(e) { res(null); }
            });
            if (cloudVal) {
              const cloudTs   = new Date(cloudVal.updatedAt||cloudVal.createdAt||cloudVal.date||0).getTime();
              const cloudUser = cloudVal.updatedBy||cloudVal.createdBy||'';
              if (cloudTs > localTs) { skipped.push({path:op.path, localUser, cloudUser}); continue; }
              if (cloudTs===localTs && cloudUser && localUser && cloudUser!==localUser) { skipped.push({path:op.path, localUser, cloudUser}); continue; }
            }
          }
          if (op.type==='set') await _origDbSet(op.path, op.data);
          else                  await _origDbUpdate(op.path, op.data);
        } catch(e) { console.warn('flush op failed:', op.type, op.path, e); }
      }
      await IDB.clearQueue();
      updateQueueBadge(0);
      const uploaded = queue.length - skipped.length;
      if (skipped.length) toast(`✅ مزامنة مكتملة — ${uploaded} رُفعت، ${skipped.length} تجاهلت (السحابة أحدث)`,'info');
      else                toast(`✅ تمت المزامنة — ${queue.length} عملية رُفعت بنجاح`,'success');
    } catch(e) { toast('⚠️ خطأ في المزامنة','error'); console.error('flushQueue error',e); }
    this.syncing = false;
  },

  async syncToIDB() {
    const stores = ['products','customers','warehouses','sales','purchases',
                    'expenses','suppliers','movements','categories','cashboxes','cashboxLog','users'];
    for (const st of stores) {
      if (S[st] && Object.keys(S[st]).length) await IDB.saveStore(st, S[st]).catch(()=>{});
    }
    if (S.settings?.company) await IDB.saveStore('settings', S.settings).catch(()=>{});
  }
};

// ============================================================
// DB INTERCEPTS (passthrough — cloud only mode)
// ============================================================
const _origDbSet    = (...a) => dbSet(...a);
const _origDbPush   = (...a) => dbPush(...a);
const _origDbUpdate = (...a) => dbUpdate(...a);
const _origDbRemove = (...a) => dbRemove(...a);

// ============================================================
// QUEUE PANEL UI
// ============================================================
function updateQueueBadge(count) {
  const btn = document.getElementById('queue-btn');
  const cnt = document.getElementById('queue-count');
  if (btn && cnt) {
    if (count>0) { btn.style.display='flex'; cnt.textContent=count; }
    else           btn.style.display='none';
  }
  const badgeOps = document.getElementById('badge-ops');
  if (badgeOps) {
    if (count>0) { badgeOps.style.display='inline-block'; badgeOps.textContent=count+' عملية معلقة'; }
    else           badgeOps.style.display='none';
  }
}

async function openQueuePanel() {
  const queue = await IDB.getQueue();
  const listEl= document.getElementById('queue-list');
  const syncBtn= document.getElementById('sync-now-btn');
  if (syncBtn) syncBtn.style.display = queue.length ? 'flex' : 'none';
  if (!listEl) { openModal('modal-queue'); return; }
  if (!queue.length) {
    listEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text2);font-size:12px;"><i class="fas fa-check-circle" style="font-size:28px;color:var(--green);display:block;margin-bottom:10px;"></i>لا توجد عمليات معلقة</div>';
    openModal('modal-queue'); return;
  }
  const TYPE_LABELS = {set:'تحديث',update:'تحديث',push:'إضافة',remove:'حذف'};
  const OP_LABELS = {products:'منتج',customers:'عميل',sales:'فاتورة بيع',purchases:'فاتورة شراء',expenses:'مصروف',suppliers:'مورد',warehouses:'مخزن',cashboxes:'خزينة',categories:'فئة',users:'مستخدم'};
  const TYPE_ICONS= {set:'fa-edit',update:'fa-edit',push:'fa-plus-circle',remove:'fa-trash'};
  const TYPE_COLORS={set:'var(--accent)',update:'var(--accent)',push:'var(--green)',remove:'var(--red)'};
  listEl.innerHTML = queue.map((op,i) => {
    const store   = op.path ? op.path.split('/')[0] : '';
    const label   = OP_LABELS[store]||store;
    const typeLabel= TYPE_LABELS[op.type]||op.type;
    const icon    = TYPE_ICONS[op.type]||'fa-circle';
    const color   = TYPE_COLORS[op.type]||'var(--text2)';
    const time    = op.ts ? new Date(op.ts).toLocaleString('ar-EG') : '';
    const name    = op.data?.name||op.data?.customerName||op.data?.productName||'';
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:8px;background:var(--card2);margin-bottom:8px;">
      <div style="width:34px;height:34px;border-radius:8px;background:${color}22;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="fas ${icon}" style="color:${color};font-size:13px;"></i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;">${typeLabel} ${label}${name?' — '+name:''}</div>
        <div style="font-size:11px;color:var(--text2);">${time}</div>
      </div>
      <div style="font-size:10px;color:var(--text3);background:var(--card);padding:2px 8px;border-radius:12px;">#${i+1}</div>
    </div>`;
  }).join('');
  openModal('modal-queue');
}

// Initialize
window.addEventListener('fbReady', () => {
  setTimeout(() => OM.syncToIDB(), 5000);
  setInterval(() => { if (OM.isOnline && window._fbAvailable) OM.syncToIDB(); }, 120000);
}, {once:true});

window.addEventListener('fbOffline', () => {
  console.warn('fbOffline event received but offline mode is disabled - cloud only');
});

OM.init();

// ============================================================
// PHASE 2 — ENHANCED AUTH with Roles + Branch
// ============================================================

// Override showMainLayout to apply new role permissions
const _origShowMainLayout = showMainLayout;
function showMainLayout(u) {
  CURRENT_USER = u;
  document.getElementById('login-screen').style.display = 'none';
  document.querySelector('.layout').style.display = 'flex';

  const infoEl = document.getElementById('topbar-user-info');
  if (infoEl) {
    infoEl.style.display = 'flex';
    const roleInfo = ROLES && ROLES[u.role] ? ROLES[u.role] : {label:u.role,icon:'👤',color:'var(--text2)'};
    const branch   = u.branchId && BS && BS.branches[u.branchId] ? BS.branches[u.branchId].name : '';
    infoEl.innerHTML = `
      <div style="width:28px;height:28px;background:${roleInfo.color}22;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;">${roleInfo.icon}</div>
      <div><strong>${u.name || u.username}</strong>${branch ? `<div style="font-size:10px;color:var(--text2);">${branch}</div>` : ''}</div>
      <span class="user-role-badge ${roleInfo.badge||'badge-info'}" style="background:${roleInfo.color}22;color:${roleInfo.color};">${roleInfo.label}</span>`;
  }

  // Log login activity
  if (typeof AL !== 'undefined') {
    setTimeout(() => AL.record('login', `تسجيل دخول من ${navigator.userAgent.includes('Mobile')?'جهاز محمول':'حاسوب'}`), 2000);
  }

  // Update last login time
  const userEntry = Object.entries(S.users||{}).find(([,uu]) => uu.username === u.username);
  if (userEntry) {
    dbUpdate('users/' + userEntry[0], {lastLogin: new Date().toISOString()}).catch(()=>{});
  }

  // Apply role permissions
  setTimeout(() => {
    if (typeof applyRolePermissions === 'function') applyRolePermissions();
    if (typeof renderBranchSelector === 'function') renderBranchSelector();
    // For non-superadmin: lock to their branch
    if (u.role !== 'superadmin' && u.branchId) {
      BS.currentBranchId = u.branchId;
      BS.currentBranch   = BS.branches[u.branchId] || null;
      listenBranchData(u.branchId);
      updateBranchIndicator();
    } else if (u.role === 'superadmin') {
      // superadmin: restore last selected branch
      const saved = localStorage.getItem('ctg-branch');
      if (saved && BS.branches[saved]) switchBranch(saved);
    }
  }, 500);

  nav('dashboard');
}

// Override doLogout to log activity
const _origDoLogout = doLogout;
function doLogout() {
  if (typeof AL !== 'undefined') AL.record('logout','تسجيل خروج').catch(()=>{});
  sessionStorage.removeItem('ctg-user');
  sessionStorage.removeItem('ctg-branch');
  CURRENT_USER = null;
  document.getElementById('login-screen').style.display = 'flex';
  document.querySelector('.layout').style.display = 'none';
  const p = document.getElementById('login-pass'); if (p) p.value='';
}

// Override saveUser to include branchId
async function saveUser() {
  const username = (document.getElementById('uf-username').value||'').trim().toLowerCase().replace(/\s+/g,'');
  const name     = (document.getElementById('uf-name').value||'').trim();
  const pass     = document.getElementById('uf-pass').value||'';
  const role     = document.getElementById('uf-role').value;
  const status   = document.getElementById('uf-status').value;
  const branchId = document.getElementById('uf-branch')?.value || '';
  if (!username || !name) { toast('يرجى ملء الحقول الإلزامية','error'); return; }
  if (!editingUser && !pass) { toast('يرجى إدخال كلمة المرور','error'); return; }
  if (pass && pass.length < 6) { toast('كلمة المرور يجب أن تكون 6 أحرف على الأقل','error'); return; }
  const dup = Object.entries(S.users||{}).find(([id,u]) => u.username===username && id!==editingUser);
  if (dup) { toast('اسم المستخدم مستخدم بالفعل','error'); return; }
  const data = {username, name, role, status, branchId, updatedAt:new Date().toISOString()};
  if (pass) data.password = btoa(pass);
  if (!editingUser) data.createdAt = new Date().toISOString();
  try {
    // Users are global (not per-branch)
    const id = editingUser || uid();
    await FB.$update(FB.$ref(DB, 'ctg/users/' + id), data);
    closeModal('modal-user');
    toast(editingUser ? 'تم تحديث المستخدم ✅' : 'تم إضافة المستخدم ✅');
    if (typeof AL !== 'undefined') AL.record('user_saved', `${editingUser?'تعديل':'إضافة'} مستخدم: ${name}`, 'users');
    editingUser = null;
  } catch(e) { toast('خطأ: '+e.message,'error'); }
}

// Override openAddUser to populate branch
function openAddUser() {
  editingUser = null;
  document.getElementById('user-modal-title').textContent = 'مستخدم جديد';
  ['uf-username','uf-name','uf-pass'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('uf-role').value   = 'cashier';
  document.getElementById('uf-status').value = 'active';
  if (typeof populateBranchSelect === 'function') populateBranchSelect('uf-branch');
  openModal('modal-user');
}

function editUser(id) {
  const u = S.users[id]; if (!u) return;
  editingUser = id;
  document.getElementById('user-modal-title').textContent = 'تعديل المستخدم';
  document.getElementById('uf-username').value = u.username || '';
  document.getElementById('uf-name').value     = u.name     || '';
  document.getElementById('uf-pass').value     = '';
  document.getElementById('uf-role').value     = u.role     || 'cashier';
  document.getElementById('uf-status').value   = u.status   || 'active';
  if (typeof populateBranchSelect === 'function') {
    populateBranchSelect('uf-branch');
    setTimeout(() => {
      const el = document.getElementById('uf-branch');
      if (el) el.value = u.branchId || '';
    }, 100);
  }
  openModal('modal-user');
}

// Enhanced render users
function renderUsers() {
  const tbody = document.getElementById('users-tbl'); if (!tbody) return;
  if (typeof renderUsersEnhanced === 'function') { renderUsersEnhanced(); return; }
  const users = S.users || {};
  const rows = Object.entries(users);
  const roleInfo = r => ROLES && ROLES[r] ? ROLES[r] : {label:r, badge:'badge-info', icon:'👤', color:'var(--text2)'};
  tbody.innerHTML = rows.length
    ? rows.map(([id,u]) => {
        const ri = roleInfo(u.role);
        const branchName = u.branchId ? (BS.branches[u.branchId]?.name || u.branchId) : 'كل الفروع';
        return `<tr>
          <td><strong>${u.name||'-'}</strong><br><span style="font-size:10px;color:var(--text2);">@${u.username}</span></td>
          <td><span class="badge ${ri.badge}" style="background:${ri.color}22;color:${ri.color};">${ri.icon} ${ri.label}</span></td>
          <td style="font-size:11px;">${branchName}</td>
          <td><span class="badge ${u.status==='active'?'badge-success':'badge-danger'}">${u.status==='active'?'نشط':'معطل'}</span></td>
          <td>
            <button class="btn btn-ghost btn-xs" onclick="editUser('${id}')"><i class="fas fa-edit"></i></button>
            ${u.username!=='admin'?`<button class="btn btn-danger btn-xs admin-only" onclick="delUser('${id}')"><i class="fas fa-trash"></i></button>`:''}
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text2);">لا يوجد مستخدمون</td></tr>';
}

// Override initDefaultUsers to create superadmin
async function initDefaultUsers() {
  if (S.users && Object.keys(S.users).length) return;
  const adminId = uid();
  const defaultAdmin = {
    username:'admin', password:btoa('admin123'), name:'المدير العام',
    role:'superadmin', branchId:'', status:'active',
    createdAt: new Date().toISOString()
  };
  await FB.$update(FB.$ref(DB,'ctg/users/' + adminId), defaultAdmin);
  S.users = {[adminId]: defaultAdmin};
}
