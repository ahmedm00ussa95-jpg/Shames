/* ============================================================
   auth.js — المصادقة: Login + Users + IDB + Offline
   ============================================================ */

let CURRENT_USER = null;

// ============================================================
// SESSION
// ============================================================
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
  CURRENT_USER = u;
  const ls = document.getElementById('login-screen');
  const ly = document.querySelector('.layout');
  if (ls) ls.style.display = 'none';
  if (ly) ly.style.display = 'flex';

  // Update topbar user info
  const infoEl = document.getElementById('topbar-user-info');
  if (infoEl) {
    infoEl.style.display = 'flex';
    const roleInfo = (typeof ROLES !== 'undefined' && ROLES[u.role]) || {label:u.role, icon:'👤', color:'var(--text2)', badge:'badge-info'};
    const branch = u.branchId && BS.branches[u.branchId] ? BS.branches[u.branchId].name : '';
    infoEl.innerHTML = `
      <div style="width:28px;height:28px;background:${roleInfo.color}22;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;">${roleInfo.icon}</div>
      <div><strong>${u.name||u.username}</strong>${branch?`<div style="font-size:10px;color:var(--text2);">${branch}</div>`:''}</div>
      <span class="user-role-badge ${roleInfo.badge||'badge-info'}" style="background:${roleInfo.color}22;color:${roleInfo.color};">${roleInfo.label}</span>`;
  }

  // Apply role permissions
  if (typeof applyRolePermissions === 'function') setTimeout(applyRolePermissions, 100);
  if (typeof renderBranchSelector === 'function') setTimeout(renderBranchSelector, 200);

  // Set branch for user
  if (u.role !== 'superadmin' && u.branchId) {
    BS.currentBranchId = u.branchId;
    BS.currentBranch   = BS.branches[u.branchId] || null;
    listenBranchData(u.branchId);
    if (typeof updateBranchIndicator === 'function') updateBranchIndicator();
  } else if (u.role === 'superadmin') {
    const saved = localStorage.getItem('ctg-branch');
    if (saved && BS.branches[saved]) {
      setTimeout(() => switchBranch && switchBranch(saved), 500);
    } else {
      const first = Object.entries(BS.branches).find(([,b]) => b.status === 'active');
      if (first) setTimeout(() => switchBranch && switchBranch(first[0]), 500);
    }
  }

  // Update last login
  const userEntry = Object.entries(S.users||{}).find(([,uu])=>uu.username===u.username);
  if (userEntry && DB) {
    FB.$update(FB.$ref(DB,'ctg/users/'+userEntry[0]),{lastLogin:new Date().toISOString()}).catch(()=>{});
  }

  // Restore shift if open
  if (typeof checkOpenShift === 'function') setTimeout(checkOpenShift, 800);

  nav('dashboard');
}

// ============================================================
// LOGIN
// ============================================================
async function doLogin() {
  const username = (document.getElementById('login-user')?.value||'').trim().toLowerCase();
  const pass     = document.getElementById('login-pass')?.value||'';
  const errEl    = document.getElementById('login-err');
  if (errEl) errEl.style.display = 'none';
  if (!username||!pass) { if(errEl){errEl.textContent='يرجى إدخال اسم المستخدم وكلمة المرور';errEl.style.display='block';} return; }

  let found = Object.entries(S.users||{}).find(([,u])=>u.username===username&&u.status!=='inactive');
  if (!found) {
    const offlineUsers = await IDB.getStore('users').catch(()=>({}));
    found = Object.entries({...S.users,...offlineUsers}).find(([,u])=>u.username===username&&u.status!=='inactive');
  }
  if (!found) { if(errEl){errEl.textContent='اسم المستخدم غير موجود أو معطل';errEl.style.display='block';} return; }
  const [,user] = found;
  if (user.password !== btoa(pass)) { if(errEl){errEl.textContent='كلمة المرور غير صحيحة';errEl.style.display='block';} return; }

  sessionStorage.setItem('ctg-user', JSON.stringify(user));
  showMainLayout(user);
}

// ============================================================
// LOGOUT
// ============================================================
function doLogout() {
  if (typeof AL !== 'undefined') AL.record('logout','تسجيل خروج').catch(()=>{});
  CURRENT_USER = null;
  sessionStorage.removeItem('ctg-user');
  const ls=document.getElementById('login-screen'); if(ls) ls.style.display='flex';
  const ly=document.querySelector('.layout');       if(ly) ly.style.display='none';
  const p=document.getElementById('login-pass');   if(p)  p.value='';
}

// ============================================================
// USERS CRUD
// ============================================================
let editingUser = null;

async function initDefaultUsers() {
  if (S.users && Object.keys(S.users).length > 0) return;
  const adminId = uid();
  const defaultAdmin = {username:'admin',password:btoa('admin123'),name:'المدير العام',role:'superadmin',branchId:'',status:'active',createdAt:new Date().toISOString()};
  await FB.$update(FB.$ref(DB,'ctg/users/'+adminId), defaultAdmin);
  S.users = {[adminId]: defaultAdmin};
}

function openAddUser() {
  editingUser = null;
  document.getElementById('user-modal-title').textContent = 'مستخدم جديد';
  resetForm('uf');
  document.getElementById('uf-role').value   = 'cashier';
  document.getElementById('uf-status').value = 'active';
  if (typeof populateBranchSelect === 'function') populateBranchSelect('uf-branch');
  openModal('modal-user');
}

function editUser(id) {
  const u = S.users[id]; if (!u) return;
  editingUser = id;
  document.getElementById('user-modal-title').textContent = 'تعديل المستخدم';
  document.getElementById('uf-username').value = u.username||'';
  document.getElementById('uf-name').value     = u.name||'';
  document.getElementById('uf-pass').value     = '';
  document.getElementById('uf-role').value     = u.role||'cashier';
  document.getElementById('uf-status').value   = u.status||'active';
  if (typeof populateBranchSelect === 'function') {
    populateBranchSelect('uf-branch');
    setTimeout(()=>{ const el=document.getElementById('uf-branch'); if(el) el.value=u.branchId||''; },100);
  }
  openModal('modal-user');
}

async function saveUser() {
  const username = (document.getElementById('uf-username').value||'').trim().toLowerCase().replace(/\s+/g,'');
  const name     = (document.getElementById('uf-name').value||'').trim();
  const pass     = document.getElementById('uf-pass').value||'';
  const role     = document.getElementById('uf-role').value;
  const status   = document.getElementById('uf-status').value;
  const branchId = document.getElementById('uf-branch')?.value||'';
  if (!username||!name) { toast('يرجى ملء الحقول الإلزامية','error'); return; }
  if (!editingUser&&!pass) { toast('يرجى إدخال كلمة المرور','error'); return; }
  if (pass&&pass.length<6) { toast('كلمة المرور 6 أحرف على الأقل','error'); return; }
  const dup = Object.entries(S.users||{}).find(([id,u])=>u.username===username&&id!==editingUser);
  if (dup) { toast('اسم المستخدم مستخدم بالفعل','error'); return; }
  const data = {username,name,role,status,branchId,updatedAt:new Date().toISOString()};
  if (pass) data.password = btoa(pass);
  if (!editingUser) data.createdAt = new Date().toISOString();
  try {
    const id = editingUser || uid();
    await FB.$update(FB.$ref(DB,'ctg/users/'+id), data);
    closeModal('modal-user');
    toast(editingUser?'تم تحديث المستخدم ✅':'تم إضافة المستخدم ✅');
    editingUser = null;
  } catch(e) { toast('خطأ: '+e.message,'error'); }
}

async function delUser(id) {
  const u=S.users[id]; if(!u) return;
  if (u.username==='admin') { toast('لا يمكن حذف حساب المدير الرئيسي','error'); return; }
  if (!confirm(`حذف المستخدم "${u.name}"؟`)) return;
  await FB.$remove(FB.$ref(DB,'ctg/users/'+id));
  toast('تم الحذف');
}

function renderUsers() {
  const tbody=document.getElementById('users-tbl'); if(!tbody) return;
  const users=S.users||{};
  const roleInfo=r=>(typeof ROLES!=='undefined'&&ROLES[r])||{label:r,badge:'badge-info',icon:'👤',color:'var(--text2)'};
  tbody.innerHTML=Object.entries(users).length
    ? Object.entries(users).map(([id,u])=>{
        const ri=roleInfo(u.role);
        const branchName=u.branchId?(BS.branches[u.branchId]?.name||u.branchId):'كل الفروع';
        return `<tr>
          <td><strong>${u.name||'—'}</strong><br><span style="font-size:10px;color:var(--text2);">@${u.username}</span></td>
          <td><span class="badge ${ri.badge}" style="background:${ri.color}22;color:${ri.color};">${ri.icon} ${ri.label}</span></td>
          <td style="font-size:11px;">${branchName}</td>
          <td><span class="badge ${u.status==='active'?'badge-success':'badge-danger'}">${u.status==='active'?'نشط':'معطل'}</span></td>
          <td><button class="btn btn-ghost btn-xs" onclick="editUser('${id}')"><i class="fas fa-edit"></i></button>${u.username!=='admin'?`<button class="btn btn-danger btn-xs" onclick="delUser('${id}')"><i class="fas fa-trash"></i></button>`:''}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text2);">لا يوجد مستخدمون</td></tr>';
}

// ============================================================
// INDEXEDDB
// ============================================================
const IDB = {
  db:null, DB_NAME:'ctg_offline', DB_VERSION:1,
  STORES:['products','customers','warehouses','sales','purchases','expenses','suppliers',
          'movements','categories','cashboxes','cashboxLog','users','settings','pending_queue','returns'],
  open() {
    return new Promise((resolve,reject)=>{
      if(this.db){resolve(this.db);return;}
      const req=indexedDB.open(this.DB_NAME,this.DB_VERSION);
      req.onupgradeneeded=e=>{const db=e.target.result;this.STORES.forEach(store=>{if(!db.objectStoreNames.contains(store))db.createObjectStore(store,{keyPath:'_key'});});};
      req.onsuccess=e=>{this.db=e.target.result;resolve(this.db);};
      req.onerror=e=>reject(e.target.error);
    });
  },
  async saveStore(name,data){try{const db=await this.open();const tx=db.transaction(name,'readwrite');const st=tx.objectStore(name);st.clear();if(name==='settings'){st.put({_key:'__cfg__',...(data||{})});}else{Object.entries(data||{}).forEach(([k,v])=>{st.put({_key:k,...(v&&typeof v==='object'?v:{_v:v})});});}return new Promise((res,rej)=>{tx.oncomplete=()=>res(true);tx.onerror=e=>rej(e);});}catch(e){console.warn('IDB save error',name,e);}},
  async getStore(name){try{const db=await this.open();return new Promise((res,rej)=>{const tx=db.transaction(name,'readonly');const req=tx.objectStore(name).getAll();req.onsuccess=e=>{const rows=e.target.result||[];if(name==='settings'){const r=rows[0]||{};const{_key,...rest}=r;res(rest);}else{const obj={};rows.forEach(r=>{const{_key,...rest}=r;obj[_key]=rest;});res(obj);}};req.onerror=e=>rej(e.target.error);});}catch(e){return {};}}
};

// ============================================================
// OFFLINE MANAGER
// ============================================================
const OM = {
  isOnline: navigator.onLine,
  init() {
    window.addEventListener('online',  ()=>this.goOnline());
    window.addEventListener('offline', ()=>this.goOffline());
    this.updateUI();
  },
  goOnline()  { this.isOnline=true;  this.updateUI(); toast('🌐 عاد الإنترنت','info'); },
  goOffline() { this.isOnline=false; this.updateUI(); toast('📴 انقطع الإنترنت','info'); },
  updateUI() {
    const sb=document.querySelector('.sb-status');
    if(sb){
      sb.innerHTML=this.isOnline
        ?'<span style="width:7px;height:7px;border-radius:50%;background:var(--green);display:inline-block;margin-left:5px;"></span>متصل بالسحابة'
        :'<span style="width:7px;height:7px;border-radius:50%;background:var(--yellow);display:inline-block;margin-left:5px;"></span>أوف لاين';
      sb.style.color=this.isOnline?'var(--green)':'var(--yellow)';
    }
  }
};
