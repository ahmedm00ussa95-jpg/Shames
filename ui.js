/* ============================================================
   ui.js — واجهة المستخدم: Navigation + Toast + Modal + Theme
   الشمس - Al Shams ERP | المرحلة الأولى
   ============================================================ */

// ============================================================
// PAGE CONFIG
// ============================================================
const PAGE_CFG = {
  dashboard:    {title:'لوحة التحكم',         icon:'fa-chart-pie'},
  pos:          {title:'نقطة البيع',            icon:'fa-cash-register'},
  sales:        {title:'الفواتير والمبيعات',    icon:'fa-file-invoice'},
  customers:    {title:'العملاء',               icon:'fa-users'},
  products:     {title:'المنتجات',              icon:'fa-laptop'},
  returns:      {title:'المرتجعات',             icon:'fa-undo-alt'},
  categories:   {title:'إدارة الفئات',          icon:'fa-tags'},
  warehouses:   {title:'المخازن',               icon:'fa-warehouse'},
  purchases:    {title:'المشتريات',             icon:'fa-cart-plus'},
  barcode:      {title:'منشئ الباركود',          icon:'fa-barcode'},
  cashboxes:    {title:'إدارة الخزائن',          icon:'fa-safe'},
  finance:      {title:'الإدارة المالية',        icon:'fa-coins'},
  debts:        {title:'إدارة الديون',           icon:'fa-hand-holding-usd'},
  expenses:     {title:'المصروفات',             icon:'fa-money-bill-wave'},
  suppliers:    {title:'الموردون',               icon:'fa-truck'},
  reports:      {title:'التقارير',               icon:'fa-chart-bar'},
  users:        {title:'إدارة المستخدمين',       icon:'fa-users-cog'},
  settings:     {title:'الإعدادات',              icon:'fa-cog'},
  'inv-settings':{title:'إعدادات الفاتورة',      icon:'fa-file-invoice-dollar'}
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
  document.getElementById('pg-title').textContent = cfg.title || name;
  document.getElementById('pg-icon').className = 'fas ' + (cfg.icon || 'fa-circle');

  if (name === 'barcode')   setTimeout(initBC, 120);
  if (name === 'reports')   setPeriod('month');
  if (name === 'debts')     renderDebtsPage();
  if (name === 'returns')   renderReturns();
  if (name === 'users')     renderUsers();
  if (name === 'settings')  setTimeout(updateBackupInfo, 300);
  if (name === 'inv-settings') loadInvSettingsUI();

  if (name === 'pos') {
    setTimeout(() => document.getElementById('pos-scan-input')?.focus(), 100);
    const st = S.settings || {};
    const discEl    = document.getElementById('pos-disc');
    const discTypeEl= document.getElementById('pos-disc-type');
    const taxEl     = document.getElementById('pos-tax');
    const taxTypeEl = document.getElementById('pos-tax-type');
    if (discEl    && !parseFloat(discEl.value))    { discEl.value = st.defaultDisc || 0; }
    if (discTypeEl&& st.defaultDiscType)            { discTypeEl.value = st.defaultDiscType; }
    if (taxEl     && !parseFloat(taxEl.value))     { taxEl.value = st.defaultTax || 0; }
    if (taxTypeEl && st.defaultTaxType)             { taxTypeEl.value = st.defaultTaxType; }
    calcCart();
  }
}
const nav_direct = nav;

// Mobile sidebar
function toggleMobSidebar() {
  const sb = document.querySelector('.sidebar');
  const ov = document.getElementById('mob-sidebar-overlay');
  if (!sb || !ov) return;
  const isOpen = sb.classList.contains('mob-open');
  sb.classList.toggle('mob-open', !isOpen);
  ov.classList.toggle('show', !isOpen);
  document.body.style.overflow = isOpen ? '' : 'hidden';
}

// Sidebar click handlers (attached after DOM ready)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.sb-item').forEach(el => {
    el.addEventListener('click', () => {
      nav(el.dataset.page);
      if (window.innerWidth <= 900) {
        const sb = document.querySelector('.sidebar');
        const ov = document.getElementById('mob-sidebar-overlay');
        if (sb) sb.classList.remove('mob-open');
        if (ov) ov.classList.remove('show');
        document.body.style.overflow = '';
      }
    });
  });
});

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
document.addEventListener('DOMContentLoaded', () => {
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', () => applyTheme(!isDark));
  applyTheme(localStorage.getItem('ctg-theme') !== 'light');
});

// ============================================================
// CLOCK
// ============================================================
function updateClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleString('ar-EG');
}
setInterval(updateClock, 1000);
document.addEventListener('DOMContentLoaded', updateClock);

// ============================================================
// TOAST
// ============================================================
let _toastTimer;
function toast(msg, type='success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.className = 'toast toast-' + type + ' show';
  el.innerHTML = (type==='success' ? '✅ ' : type==='error' ? '❌ ' : 'ℹ️ ') + msg;
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
    if (el.tagName==='INPUT' || el.tagName==='TEXTAREA') el.value = '';
    else if (el.tagName==='SELECT') el.selectedIndex = 0;
  });
}

// Close modal on overlay click
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.overlay').forEach(ov => {
    ov.addEventListener('click', e => {
      if (e.target === ov) ov.classList.remove('open');
    });
  });
});

// Enter key for login
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-screen')?.style.display !== 'none') {
    doLogin();
  }
});

// ============================================================
// PHASE 2 — Extended PAGE_CFG + nav overrides
// ============================================================
PAGE_CFG['branches'] = {title:'إدارة الفروع',   icon:'fa-code-branch'};
PAGE_CFG['activity'] = {title:'سجل النشاط',      icon:'fa-history'};

// Override nav to handle branches + activity + branch stats
const _origNav = nav;
function nav(name) {
  _origNav(name);
  if (name === 'branches') {
    renderBranches();
    // Update stats counters
    const total  = Object.keys(BS.branches).length;
    const active = Object.values(BS.branches).filter(b=>b.status==='active').length;
    const el1 = document.getElementById('total-branches');  if(el1) el1.textContent = total;
    const el2 = document.getElementById('active-branches'); if(el2) el2.textContent = active;
    // Count users
    const allUsers = Object.values(S.users||{});
    const el3 = document.getElementById('total-branch-users'); if(el3) el3.textContent = allUsers.length;
    // Today sales across all branches (async)
    let allTodaySales = 0;
    const today = new Date().toISOString().split('T')[0];
    const bIds  = Object.keys(BS.branches);
    if (!bIds.length) return;
    let done = 0;
    bIds.forEach(bid => {
      FB.$onValue(FB.$ref(DB, `ctg/branches/${bid}/sales`), snap => {
        const sales = snap.val()||{};
        Object.values(sales).filter(s=>(s.date||'').startsWith(today)).forEach(s=>{allTodaySales+=s.total||0;});
        done++;
        if (done === bIds.length) {
          const el4 = document.getElementById('branches-today-sales');
          if(el4) el4.textContent = N(allTodaySales,0) + ' EGP';
        }
      },{onlyOnce:true});
    });
    // Populate branch filter for activity
    const actBranch = document.getElementById('act-filter-branch');
    if (actBranch) {
      actBranch.innerHTML = '<option value="">كل الفروع</option>' +
        Object.entries(BS.branches).map(([id,b])=>`<option value="${id}">${b.name}</option>`).join('');
    }
  }
  if (name === 'activity') {
    renderActivityLog();
    // Populate branch filter
    const actBranch = document.getElementById('act-filter-branch');
    if (actBranch) {
      actBranch.innerHTML = '<option value="">كل الفروع</option>' +
        Object.entries(BS.branches).map(([id,b])=>`<option value="${id}">${b.name}</option>`).join('');
    }
  }
  if (name === 'users') {
    // Render enhanced users with branch info
    renderUsers();
  }
}

// ============================================================
// PHASE 3 — Nav hook for inventory dashboard
// ============================================================
const _origNavP3 = nav;
function nav(name) {
  _origNavP3(name);
  if (name === 'warehouses') {
    setTimeout(() => {
      if (typeof updateInventoryDashboard === 'function') updateInventoryDashboard();
      if (typeof renderStockAlerts === 'function') renderStockAlerts();
    }, 200);
  }
  if (name === 'products') {
    setTimeout(() => {
      if (typeof renderProducts === 'function') renderProducts();
    }, 100);
  }
}

// Phase 4 - shifts page config
PAGE_CFG['shifts'] = {title:'إدارة الورديات', icon:'fa-business-time'};

// Patch nav for shifts page
const _origNavP4 = nav;
function nav(name) {
  _origNavP4(name);
  if (name === 'shifts') {
    setTimeout(renderShifts, 200);
    // Update current shift card
    const infoEl = document.getElementById('current-shift-info');
    if (infoEl) {
      if (SHIFT?.isOpen && SHIFT?.current) {
        const sh = SHIFT.current;
        infoEl.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
            <div style="background:var(--green-bg);border:1px solid var(--green);border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:11px;color:var(--text2);">الكاشير</div>
              <div style="font-size:15px;font-weight:900;color:var(--green);">${sh.cashierName}</div>
            </div>
            <div style="background:var(--card2);border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:11px;color:var(--text2);">وقت الفتح</div>
              <div style="font-size:14px;font-weight:700;">${new Date(sh.openedAt).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
            <div style="background:var(--card2);border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:11px;color:var(--text2);">الفواتير</div>
              <div style="font-size:18px;font-weight:900;color:var(--accent);">${sh.salesCount||0}</div>
            </div>
            <div style="background:var(--card2);border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:11px;color:var(--text2);">المبيعات</div>
              <div style="font-size:15px;font-weight:900;color:var(--green);">${N(sh.totalSales||0)} EGP</div>
            </div>
          </div>`;
      } else {
        infoEl.innerHTML = '<div style="text-align:center;color:var(--text2);padding:24px;font-size:13px;"><i class="fas fa-moon" style="font-size:28px;display:block;margin-bottom:8px;opacity:.3;"></i>لا توجد وردية مفتوحة</div>';
      }
    }
  }
  if (name === 'pos') {
    // Update shift open cashier name in modal
    const el = document.getElementById('shift-open-cashier-name');
    if (el) el.textContent = CURRENT_USER?.name || CURRENT_USER?.username || '';
    // Check shift status for lock
    setTimeout(() => {
      const lockEl = document.getElementById('pos-shift-lock');
      const req    = S.settings?.requireShift !== false;
      if (lockEl) lockEl.style.display = (req && SHIFT && !SHIFT.isOpen) ? 'flex' : 'none';
    }, 300);
  }
}
