/* ============================================================
   ui.js — Navigation + Toast + Modal + Theme + Clock
   ============================================================ */

// ============================================================
// PAGE CONFIG
// ============================================================
const PAGE_CFG = {
  dashboard:    {title:'لوحة التحكم',          icon:'fa-chart-pie'},
  pos:          {title:'نقطة البيع',             icon:'fa-cash-register'},
  sales:        {title:'الفواتير والمبيعات',     icon:'fa-file-invoice'},
  customers:    {title:'العملاء',                icon:'fa-users'},
  products:     {title:'المنتجات',               icon:'fa-laptop'},
  returns:      {title:'المرتجعات',              icon:'fa-undo-alt'},
  categories:   {title:'إدارة الفئات',           icon:'fa-tags'},
  warehouses:   {title:'المخازن',                icon:'fa-warehouse'},
  purchases:    {title:'المشتريات',              icon:'fa-cart-plus'},
  barcode:      {title:'منشئ الباركود',           icon:'fa-barcode'},
  cashboxes:    {title:'إدارة الخزائن',           icon:'fa-safe'},
  finance:      {title:'الإدارة المالية',         icon:'fa-coins'},
  debts:        {title:'إدارة الديون',            icon:'fa-hand-holding-usd'},
  expenses:     {title:'المصروفات',              icon:'fa-money-bill-wave'},
  suppliers:    {title:'الموردون',                icon:'fa-truck'},
  reports:      {title:'التقارير',                icon:'fa-chart-bar'},
  users:        {title:'إدارة المستخدمين',        icon:'fa-users-cog'},
  settings:     {title:'الإعدادات',               icon:'fa-cog'},
  'inv-settings':{title:'إعدادات الفاتورة',       icon:'fa-file-invoice-dollar'},
  branches:     {title:'إدارة الفروع',            icon:'fa-code-branch'},
  activity:     {title:'سجل النشاط',              icon:'fa-history'},
  shifts:       {title:'إدارة الورديات',           icon:'fa-business-time'},
};

// ============================================================
// NAVIGATION
// ============================================================
function nav(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));

  const pg = document.getElementById('pg-' + name);
  if (pg) pg.classList.add('active');

  const sb = document.querySelector(`.sb-item[data-page="${name}"]`);
  if (sb) sb.classList.add('active');

  const cfg = PAGE_CFG[name] || {};
  const titleEl = document.getElementById('pg-title');
  const iconEl  = document.getElementById('pg-icon');
  if (titleEl) titleEl.textContent = cfg.title || name;
  if (iconEl)  iconEl.className    = 'fas ' + (cfg.icon || 'fa-circle');

  // Page-specific init
  if (name === 'barcode')     setTimeout(initBC, 120);
  if (name === 'reports')     setTimeout(() => setAdvPeriod('month'), 100);
  if (name === 'debts')       setTimeout(renderDebtsPage, 100);
  if (name === 'returns')     setTimeout(renderReturns, 100);
  if (name === 'users')       setTimeout(renderUsers, 100);
  if (name === 'settings')    setTimeout(updateBackupInfo, 300);
  if (name === 'inv-settings')setTimeout(loadInvSettingsUI, 100);
  if (name === 'warehouses')  setTimeout(() => { updateInventoryDashboard && updateInventoryDashboard(); renderStockAlerts && renderStockAlerts(); }, 200);
  if (name === 'branches') {
    renderBranches && renderBranches();
    const total  = Object.keys(BS.branches).length;
    const active = Object.values(BS.branches).filter(b=>b.status==='active').length;
    const el1=document.getElementById('total-branches');  if(el1) el1.textContent=total;
    const el2=document.getElementById('active-branches'); if(el2) el2.textContent=active;
    const el3=document.getElementById('total-branch-users'); if(el3) el3.textContent=Object.keys(S.users||{}).length;
    const actBranch=document.getElementById('act-filter-branch');
    if(actBranch) actBranch.innerHTML='<option value="">كل الفروع</option>'+Object.entries(BS.branches).map(([id,b])=>`<option value="${id}">${b.name}</option>`).join('');
  }
  if (name === 'activity')    setTimeout(renderActivityLog, 200);
  if (name === 'shifts') {
    setTimeout(renderShifts, 200);
    const infoEl=document.getElementById('current-shift-info');
    if(infoEl){
      if(typeof SHIFT!=='undefined'&&SHIFT.isOpen&&SHIFT.current){
        const sh=SHIFT.current;
        infoEl.innerHTML=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
          <div style="background:var(--green-bg);border:1px solid var(--green);border-radius:10px;padding:14px;text-align:center;"><div style="font-size:11px;color:var(--text2);">الكاشير</div><div style="font-size:15px;font-weight:900;color:var(--green);">${sh.cashierName}</div></div>
          <div style="background:var(--card2);border-radius:10px;padding:14px;text-align:center;"><div style="font-size:11px;color:var(--text2);">وقت الفتح</div><div style="font-size:14px;font-weight:700;">${new Date(sh.openedAt).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</div></div>
          <div style="background:var(--card2);border-radius:10px;padding:14px;text-align:center;"><div style="font-size:11px;color:var(--text2);">الفواتير</div><div style="font-size:18px;font-weight:900;color:var(--accent);">${sh.salesCount||0}</div></div>
          <div style="background:var(--card2);border-radius:10px;padding:14px;text-align:center;"><div style="font-size:11px;color:var(--text2);">المبيعات</div><div style="font-size:15px;font-weight:900;color:var(--green);">${N(sh.totalSales||0)} EGP</div></div>
        </div>`;
      } else {
        infoEl.innerHTML='<div style="text-align:center;color:var(--text2);padding:24px;"><i class="fas fa-moon" style="font-size:28px;display:block;margin-bottom:8px;opacity:.3;"></i>لا توجد وردية مفتوحة</div>';
      }
    }
  }
  if (name === 'pos') {
    setTimeout(()=>document.getElementById('pos-scan-input')?.focus(),100);
    setTimeout(()=>{
      const lockEl=document.getElementById('pos-shift-lock');
      const req=S.settings?.requireShift!==false;
      if(lockEl) lockEl.style.display=(req&&typeof SHIFT!=='undefined'&&!SHIFT.isOpen)?'flex':'none';
      const el=document.getElementById('shift-open-cashier-name');
      if(el) el.textContent=CURRENT_USER?.name||CURRENT_USER?.username||'';
    },300);
    calcCart && calcCart();
  }

  // Mobile: close sidebar
  if (window.innerWidth <= 900) {
    const sb2=document.querySelector('.sidebar');
    const ov=document.getElementById('mob-sidebar-overlay');
    if(sb2) sb2.classList.remove('mob-open');
    if(ov)  ov.classList.remove('show');
    document.body.style.overflow='';
  }
}

// ============================================================
// THEME
// ============================================================
let isDark = true;
function applyTheme(dark) {
  isDark = dark;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const btn = document.getElementById('themeBtn');
  if (btn) btn.innerHTML = dark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  localStorage.setItem('ctg-theme', dark ? 'dark' : 'light');
}

// ============================================================
// CLOCK
// ============================================================
function updateClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleString('ar-EG');
}
setInterval(updateClock, 1000);

// ============================================================
// TOAST
// ============================================================
let _toastTimer;
function toast(msg, type='success') {
  const el = document.getElementById('toast'); if (!el) return;
  el.className = 'toast toast-' + type + ' show';
  el.innerHTML = (type==='success'?'✅ ':type==='error'?'❌ ':'ℹ️ ') + msg;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ============================================================
// MODAL
// ============================================================
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
function resetForm(prefix) {
  document.querySelectorAll(`[id^="${prefix}-"]`).forEach(el => {
    if (el.tagName==='INPUT'||el.tagName==='TEXTAREA') el.value='';
    else if (el.tagName==='SELECT') el.selectedIndex=0;
  });
}

// ============================================================
// MOBILE SIDEBAR
// ============================================================
function toggleMobSidebar() {
  const sb=document.querySelector('.sidebar');
  const ov=document.getElementById('mob-sidebar-overlay');
  if(!sb||!ov) return;
  const isOpen=sb.classList.contains('mob-open');
  sb.classList.toggle('mob-open',!isOpen);
  ov.classList.toggle('show',!isOpen);
  document.body.style.overflow=isOpen?'':'hidden';
}

// ============================================================
// DOM READY
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Apply theme
  applyTheme(localStorage.getItem('ctg-theme') !== 'light');

  // Clock
  updateClock();

  // Theme button
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', () => applyTheme(!isDark));

  // Sidebar click
  document.querySelectorAll('.sb-item[data-page]').forEach(el => {
    el.addEventListener('click', () => nav(el.dataset.page));
  });

  // Close overlay on click outside modal
  document.querySelectorAll('.overlay').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
  });

  // Enter key on login
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const ls = document.getElementById('login-screen');
      if (ls && ls.style.display !== 'none') doLogin && doLogin();
    }
  });
});
