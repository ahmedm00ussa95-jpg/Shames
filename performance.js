/* ============================================================
   performance.js — الأداء + الأمان + التحسينات النهائية
   Phase 6: Pagination + Lazy Loading + Cache + Optimization
   ============================================================ */

// ============================================================
// PAGINATION ENGINE
// ============================================================
const PAGINATOR = {
  state: {},

  init(tableId, data, perPage = 25) {
    this.state[tableId] = { page: 1, perPage, data };
    return this.getPage(tableId);
  },

  getPage(tableId) {
    const st = this.state[tableId]; if (!st) return [];
    const start = (st.page - 1) * st.perPage;
    return st.data.slice(start, start + st.perPage);
  },

  setPage(tableId, page) {
    const st = this.state[tableId]; if (!st) return;
    const maxPage = Math.ceil(st.data.length / st.perPage);
    st.page = Math.max(1, Math.min(page, maxPage));
    return this.getPage(tableId);
  },

  renderControls(tableId, renderFn) {
    const st = this.state[tableId]; if (!st) return '';
    const total   = st.data.length;
    const maxPage = Math.ceil(total / st.perPage);
    const cur     = st.page;
    if (maxPage <= 1) return '';
    const start   = (cur - 1) * st.perPage + 1;
    const end     = Math.min(cur * st.perPage, total);
    const pages   = [];
    pages.push(cur > 1 ? `<button class="pg-btn" onclick="PAGINATOR.setPage('${tableId}',${cur-1});(${renderFn})()"><i class="fas fa-chevron-right"></i></button>` : '<button class="pg-btn" disabled><i class="fas fa-chevron-right"></i></button>');
    const range   = this._range(cur, maxPage);
    range.forEach(p => {
      if (p === '...') pages.push('<span class="pg-dots">...</span>');
      else pages.push(`<button class="pg-btn ${p===cur?'active':''}" onclick="PAGINATOR.setPage('${tableId}',${p});(${renderFn})()">${p}</button>`);
    });
    pages.push(cur < maxPage ? `<button class="pg-btn" onclick="PAGINATOR.setPage('${tableId}',${cur+1});(${renderFn})()"><i class="fas fa-chevron-left"></i></button>` : '<button class="pg-btn" disabled><i class="fas fa-chevron-left"></i></button>');
    return `<div class="pagination"><span class="pg-info">${start}–${end} من ${total}</span>${pages.join('')}</div>`;
  },

  _range(cur, max) {
    if (max <= 7) return Array.from({length:max},(_,i)=>i+1);
    if (cur <= 4) return [1,2,3,4,5,'...',max];
    if (cur >= max-3) return [1,'...',max-4,max-3,max-2,max-1,max];
    return [1,'...',cur-1,cur,cur+1,'...',max];
  }
};

// ============================================================
// CACHE ENGINE — تقليل قراءات Firebase
// ============================================================
const CACHE = {
  _store: new Map(),
  _ttl:   new Map(),
  TTL_MS: 5 * 60 * 1000, // 5 minutes

  set(key, value, ttlMs) {
    this._store.set(key, value);
    this._ttl.set(key, Date.now() + (ttlMs || this.TTL_MS));
  },

  get(key) {
    if (!this._store.has(key)) return null;
    if (Date.now() > this._ttl.get(key)) { this.del(key); return null; }
    return this._store.get(key);
  },

  del(key) { this._store.delete(key); this._ttl.delete(key); },
  clear()  { this._store.clear(); this._ttl.clear(); },

  async getOrFetch(key, fetchFn, ttlMs) {
    const cached = this.get(key);
    if (cached !== null) return cached;
    const result = await fetchFn();
    this.set(key, result, ttlMs);
    return result;
  }
};

// ============================================================
// LAZY RENDER — render هو التحديثات الكبيرة فقط عند الحاجة
// ============================================================
const LAZY = {
  _pending: new Set(),
  _timer:   null,
  DELAY_MS: 80,

  schedule(name) {
    this._pending.add(name);
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._flush(), this.DELAY_MS);
  },

  _flush() {
    const pending = [...this._pending];
    this._pending.clear();
    pending.forEach(name => {
      try {
        const fn = window[name];
        if (typeof fn === 'function') fn();
      } catch(e) { console.warn('LAZY render error:', name, e); }
    });
  }
};

// ============================================================
// DEBOUNCE + THROTTLE
// ============================================================
function debounce(fn, ms = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function throttle(fn, ms = 200) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
  };
}

// Apply to search inputs on load
document.addEventListener('DOMContentLoaded', () => {
  const searchInputs = [
    ['prod-search',    'renderProducts'],
    ['cust-search',    'renderCustomers'],
    ['sales-search',   'renderSales'],
    ['sup-search',     'renderSuppliers'],
    ['pur-search',     'renderPurchases'],
    ['mov-search',     'renderMovements'],
  ];
  searchInputs.forEach(([id, fn]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', debounce(() => { if (typeof window[fn]==='function') window[fn](); }, 250));
  });
});

// ============================================================
// VIRTUAL SCROLL for large lists (POS grid)
// ============================================================
function renderPosGridOptimized() {
  const grid = document.getElementById('pos-grid'); if (!grid) return;
  const search = (document.getElementById('pos-scan-input')?.value||'').toLowerCase();
  const cat    = document.getElementById('pos-cat')?.value   || '';
  const wh     = document.getElementById('pos-wh')?.value    || '';
  const prods  = Object.entries(S.products).filter(([,p]) =>
    (+p.qty||0) > 0 &&
    (!search || p.name?.toLowerCase().includes(search) || p.code?.toLowerCase().includes(search)) &&
    (!cat || p.cat === cat) && (!wh || p.whId === wh)
  );

  if (!prods.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text2);padding:32px;font-size:12px;"><i class="fas fa-box-open" style="font-size:28px;display:block;margin-bottom:8px;opacity:.4;"></i>لا توجد منتجات</div>';
    return;
  }

  // Only render visible + buffer (max 60 cards for performance)
  const visible = prods.slice(0, 60);
  const remaining = prods.length - 60;

  grid.innerHTML = visible.map(([id,p]) => `
    <div class="pos-card" onclick="addToCart('${id}')">
      <span class="pos-card-icon">${getCatIcon(p.cat)}</span>
      <div class="pos-card-name">${p.name}</div>
      <div class="pos-card-price">${N(p.price)} EGP</div>
      <div class="pos-card-stock">${p.qty}</div>
    </div>`).join('') +
    (remaining > 0 ? `<div style="grid-column:1/-1;text-align:center;color:var(--text2);padding:14px;font-size:12px;"><i class="fas fa-info-circle"></i> ${remaining} منتج إضافي — استخدم البحث للتصفية</div>` : '');
}

// ============================================================
// FIREBASE SECURITY RULES GENERATOR
// ============================================================
function generateFirebaseRules() {
  const rules = {
    rules: {
      ctg: {
        users: {
          '.read': 'auth != null',
          '.write': 'auth != null'
        },
        settings: {
          '.read': 'auth != null',
          '.write': 'auth != null'
        },
        activity: {
          '.read': 'auth != null',
          '.write': 'auth != null'
        },
        branches: {
          '.read': 'auth != null',
          '$branchId': {
            '.read': 'auth != null',
            '.write': 'auth != null'
          }
        }
      }
    }
  };
  return JSON.stringify(rules, null, 2);
}

function showFirebaseRules() {
  const rules = generateFirebaseRules();
  const modal = document.getElementById('modal-fb-rules');
  const pre   = document.getElementById('fb-rules-content');
  if (pre)   pre.textContent = rules;
  if (modal) openModal('modal-fb-rules');
}

function copyFirebaseRules() {
  const rules = generateFirebaseRules();
  navigator.clipboard.writeText(rules).then(() => toast('تم نسخ القواعد ✅')).catch(() => toast('خطأ في النسخ','error'));
}

// ============================================================
// PERFORMANCE MONITOR
// ============================================================
const PERF = {
  marks: {},

  start(label) { this.marks[label] = performance.now(); },
  end(label)   {
    if (!this.marks[label]) return;
    const ms = performance.now() - this.marks[label];
    delete this.marks[label];
    return ms;
  },

  measure(label, fn) {
    this.start(label);
    const result = fn();
    const ms     = this.end(label);
    if (ms > 200) console.warn(`⚠️ Slow: ${label} took ${ms.toFixed(0)}ms`);
    return result;
  }
};

// ============================================================
// DATA SIZE MONITOR
// ============================================================
function getDataStats() {
  const stats = {};
  ['products','customers','sales','purchases','expenses','suppliers',
   'warehouses','movements','categories','cashboxes','returns','users'].forEach(key => {
    stats[key] = Object.keys(S[key]||{}).length;
  });
  stats.totalRecords = Object.values(stats).reduce((a,b)=>a+b,0);
  return stats;
}

// ============================================================
// BACKUP STATUS
// ============================================================
function updateBackupInfo() {
  const el = document.getElementById('last-backup-info'); if (!el) return;
  const ts = localStorage.getItem('ctg-last-backup');
  el.textContent = ts
    ? 'آخر نسخ: ' + new Date(parseInt(ts)).toLocaleString('ar-EG')
    : 'لم يتم إجراء نسخ احتياطي بعد';
}

function scheduleAutoBackup() {
  const last = localStorage.getItem('ctg-last-backup');
  const now  = Date.now();
  if (!last || now - parseInt(last) > 7 * 24 * 60 * 60 * 1000) {
    localStorage.setItem('ctg-last-backup', now.toString());
    updateBackupInfo();
  }
}

// ============================================================
// PAGINATION CSS injection
// ============================================================
(function injectPaginationCSS() {
  const style = document.createElement('style');
  style.textContent = `
    .pagination { display:flex;align-items:center;gap:5px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap; }
    .pg-btn { min-width:32px;height:32px;padding:0 8px;border-radius:7px;border:1px solid var(--border);background:var(--card2);color:var(--text2);cursor:pointer;font-family:Cairo,sans-serif;font-size:12px;transition:all .15s;display:flex;align-items:center;justify-content:center; }
    .pg-btn:hover:not([disabled]) { background:var(--accent-bg);color:var(--accent);border-color:var(--accent); }
    .pg-btn.active { background:var(--accent);color:#fff;border-color:var(--accent); }
    .pg-btn[disabled] { opacity:.35;cursor:default; }
    .pg-dots { color:var(--text3);padding:0 4px;font-size:13px; }
    .pg-info { font-size:11px;color:var(--text2);margin-left:8px; }
  `;
  document.head.appendChild(style);
})();

// ============================================================
// OVERRIDE renderSales with pagination
// ============================================================
function renderSales() {
  const tbody  = document.getElementById('sales-tbl'); if (!tbody) return;
  const pgWrap = document.getElementById('sales-pagination');
  const search = (document.getElementById('sales-search')?.value||'').toLowerCase();
  const status = document.getElementById('sales-status')?.value || '';
  const from   = document.getElementById('sales-from')?.value   || '';
  const to     = document.getElementById('sales-to')?.value     || '';
  const all    = Object.entries(S.sales).filter(([,s]) => {
    const d = (s.date||'').split('T')[0];
    const name = (s.custName||s.customerName||'').toLowerCase();
    return (!search||name.includes(search)) && (!status||s.status===status) && (!from||d>=from) && (!to||d<=to);
  }).sort(([,a],[,b]) => new Date(b.date) - new Date(a.date));

  const paged = PAGINATOR.init('sales-tbl', all, 25);
  const stM   = {paid:['badge-success','مدفوع'], partial:['badge-warning','جزئي'], unpaid:['badge-danger','غير مدفوع']};

  tbody.innerHTML = paged.length
    ? paged.map(([id,s]) => {
        const [cls,lbl] = stM[s.status]||['badge-info',''];
        return `<tr>
          <td style="color:var(--accent);font-weight:700;">#${id.slice(-5).toUpperCase()}</td>
          <td style="font-size:11px;">${fDate(s.date)}</td>
          <td>${s.custName||s.customerName||'نقدي'}</td>
          <td>${S.warehouses[s.warehouseId||s.whId]?.name||'—'}</td>
          <td style="font-weight:700;">${N(s.total)} EGP</td>
          <td style="color:var(--green);">${N(s.amountPaid||s.amtPaid||0)} EGP</td>
          <td style="color:${(s.balance||0)>0?'var(--red)':'var(--text2)'};">${N(s.balance||0)} EGP</td>
          <td><span class="badge ${cls}">${lbl}</span></td>
          <td style="font-size:11px;color:var(--text2);">${s.createdBy||'—'}</td>
          <td style="white-space:nowrap;">
            <button class="btn btn-ghost btn-xs" onclick="viewSale('${id}')"><i class="fas fa-eye"></i></button>
            <button class="btn btn-xs" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red);" onclick="openReturnFromInvoice('sale','${id}')"><i class="fas fa-undo-alt"></i></button>
            ${(s.balance||0)>0?`<button class="btn btn-success btn-xs" onclick="openPayDebt('sale','${id}','${id}')"><i class="fas fa-hand-holding-usd"></i></button>`:''}
            <button class="btn btn-danger btn-xs admin-only" onclick="delSale('${id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="10" style="text-align:center;color:var(--text2);padding:20px;">لا توجد فواتير</td></tr>';

  if (pgWrap) pgWrap.innerHTML = PAGINATOR.renderControls('sales-tbl', 'renderSales');
}

// Paginated customers
function renderCustomers() {
  const tbody  = document.getElementById('cust-tbl'); if (!tbody) return;
  const pgWrap = document.getElementById('cust-pagination');
  const search = (document.getElementById('cust-search')?.value||'').toLowerCase();
  const all    = Object.entries(S.customers).filter(([,c]) =>
    !search || c.name?.toLowerCase().includes(search) || c.phone?.includes(search)
  );

  const paged = PAGINATOR.init('cust-tbl', all, 30);
  tbody.innerHTML = paged.length
    ? paged.map(([id,c]) => `<tr>
        <td style="font-size:11px;color:var(--text2);">${id.slice(-6).toUpperCase()}</td>
        <td><strong>${c.name}</strong></td>
        <td>${c.phone||'—'}</td>
        <td>${c.addr||'—'}</td>
        <td style="color:var(--accent);">${N(c.totalBuy||0)} EGP</td>
        <td style="color:${(+c.balance||0)>0?'var(--red)':'var(--text2)'};font-weight:${(+c.balance||0)>0?'700':'400'};">${(+c.balance||0)>0?N(c.balance)+' EGP':'لا ديون'}</td>
        <td style="white-space:nowrap;">
          ${(+c.balance||0)>0?`<button class="btn btn-success btn-xs" onclick="openPayDebt('cust','${id}','${id}')"><i class="fas fa-hand-holding-usd"></i></button> `:''}
          <button class="btn btn-ghost btn-xs" onclick="editCust('${id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-xs admin-only" onclick="delCust('${id}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:20px;">لا يوجد عملاء</td></tr>';

  if (pgWrap) pgWrap.innerHTML = PAGINATOR.renderControls('cust-tbl', 'renderCustomers');
}

// Paginated purchases
function renderPurchases() {
  const tbody  = document.getElementById('pur-tbl'); if (!tbody) return;
  const pgWrap = document.getElementById('pur-pagination');
  const q      = (document.getElementById('pur-search')?.value||'').toLowerCase();
  const all    = Object.entries(S.purchases).filter(([,p])=>!q||p.supplier?.toLowerCase().includes(q)).sort(([,a],[,b])=>new Date(b.date)-new Date(a.date));

  const paged  = PAGINATOR.init('pur-tbl', all, 25);
  tbody.innerHTML = paged.length
    ? paged.map(([id,p]) => {
        const[cls,lbl]={paid:['badge-success','مدفوع'],partial:['badge-warning','جزئي'],unpaid:['badge-danger','غير مدفوع']}[p.status]||['badge-info',''];
        return `<tr>
          <td style="color:var(--green);font-weight:700;">#${id.slice(-5).toUpperCase()}</td>
          <td>${p.date||'—'}</td><td><strong>${p.supplier}</strong></td>
          <td>${S.warehouses[p.warehouseId]?.name||'—'}</td>
          <td style="font-weight:700;">${N(p.total)} EGP</td>
          <td style="color:var(--green);">${N(p.amountPaid||0)} EGP</td>
          <td style="color:${(p.balance||0)>0?'var(--red)':'var(--text2)'};">${N(p.balance||0)} EGP</td>
          <td><span class="badge ${cls}">${lbl}</span> <span class="badge badge-purple">${PAY_NAMES[p.paymentMethod]||p.paymentMethod}</span></td>
          <td style="font-size:11px;color:var(--text2);">${p.createdBy||'—'}</td>
          <td style="white-space:nowrap;">
            <button class="btn btn-ghost btn-xs" onclick="viewPurchase('${id}')"><i class="fas fa-eye"></i></button>
            <button class="btn btn-xs" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red);" onclick="openReturnFromInvoice('purchase','${id}')"><i class="fas fa-undo-alt"></i></button>
            ${(p.balance||0)>0?`<button class="btn btn-success btn-xs" onclick="openPayDebt('pur','${id}','${id}')"><i class="fas fa-hand-holding-usd"></i></button>`:''}
            <button class="btn btn-danger btn-xs admin-only" onclick="delPurchase('${id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="10" style="text-align:center;color:var(--text2);padding:16px;">لا توجد مشتريات</td></tr>';

  if (pgWrap) pgWrap.innerHTML = PAGINATOR.renderControls('pur-tbl', 'renderPurchases');
}

// Apply POS grid optimization
window.renderPosGrid = renderPosGridOptimized;

