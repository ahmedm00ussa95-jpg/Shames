/* ============================================================
   smart-select.js — نظام البحث الذكي (Smart Select)
   الشمس - Al Shams ERP | المرحلة الأولى
   ============================================================ */

let _ssActive = null;

function closeAllSS() {
  if (_ssActive) { _ssActive.remove(); _ssActive = null; }
  document.querySelectorAll('.smart-select-box.open').forEach(b => b.classList.remove('open'));
}

document.addEventListener('mousedown', e => {
  if (_ssActive && !_ssActive.contains(e.target) && !e.target.closest('.smart-select-box')) closeAllSS();
});
document.addEventListener('keydown', e => { if (e.key==='Escape') closeAllSS(); });

function openSmartSelect(wrapId, dataType, placeholder, onSelectCb) {
  const wrap = document.getElementById(wrapId); if (!wrap) return;
  const box = wrap.querySelector('.smart-select-box');
  const hiddenInput = wrap.querySelector('input[type=hidden]');
  if (box && box.classList.contains('open')) { closeAllSS(); return; }
  closeAllSS();
  if (box) box.classList.add('open');

  const config = {
    customers: {
      data: S.customers||{}, icon:'👤',
      getName: (id,v) => v.name,
      getSub:  (id,v) => [v.phone, v.balance?(+v.balance>0?'دين: '+N(v.balance):''):''].filter(Boolean).join(' • '),
      clearLabel: placeholder||'عميل نقدي',
      addLabel: 'إضافة عميل جديد',
      onAdd: () => { closeAllSS(); typeof togglePosAddCust==='function'&&togglePosAddCust(); }
    },
    suppliers: {
      data: S.suppliers||{}, icon:'🏭',
      getName: (id,v) => v.name,
      getSub:  (id,v) => [v.phone,v.email].filter(Boolean).join(' • '),
      clearLabel: '-- اختر مورد --',
      addLabel: 'إضافة مورد جديد',
      onAdd: () => { closeAllSS(); }
    },
    warehouses: {
      data: S.warehouses||{}, icon:'🏪',
      getName: (id,v) => v.name,
      getSub:  (id,v) => v.loc||'',
      clearLabel: '-- اختر مخزن --',
      addLabel: null
    },
    products: {
      data: S.products||{}, icon:'📦',
      getName: (id,v) => v.name,
      getSub:  (id,v) => [(v.code?'كود: '+v.code:''),(v.price?'سعر: '+N(v.price):''),(v.qty!==undefined?'مخزون: '+v.qty:'')].filter(Boolean).join(' • '),
      clearLabel: '-- اختر منتج --',
      addLabel: 'إضافة منتج جديد',
      onAdd: () => { closeAllSS(); typeof openAddProduct==='function'&&openAddProduct(); }
    }
  };

  const cfg = config[dataType]; if (!cfg) return;
  const currentVal = hiddenInput ? hiddenInput.value : '';

  const dd = document.createElement('div');
  dd.className = 'ss-dropdown';
  const rect = (box||wrap).getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const ddMaxH = 380;
  const openUp = spaceBelow < ddMaxH && spaceAbove > spaceBelow;
  dd.style.cssText = `width:${Math.max(rect.width,300)}px;left:${rect.left}px;${openUp?`bottom:${window.innerHeight-rect.top+4}px;top:auto;`:`top:${rect.bottom+4}px;bottom:auto;`}`;

  dd.innerHTML = `
    <div class="ss-search-wrap" style="position:relative;">
      <i class="fas fa-search ss-search-icon"></i>
      <input class="ss-search" type="text" placeholder="ابحث بالاسم أو الكود..." autocomplete="off" id="ss-input-${wrapId}">
    </div>
    <div class="ss-list" id="ss-list-${wrapId}"></div>
    ${cfg.addLabel ? `<div class="ss-add-btn" onclick="_ssAdd('${wrapId}','${dataType}')"><i class="fas fa-plus-circle"></i> ${cfg.addLabel}</div>` : ''}
  `;
  document.body.appendChild(dd);
  _ssActive = dd;

  function renderList(query) {
    const listEl = document.getElementById('ss-list-'+wrapId); if (!listEl) return;
    let html = '';
    if (currentVal || dataType==='customers') {
      html += `<div class="ss-clear-item" onclick="_ssSelect('${wrapId}','','${escHtml(cfg.clearLabel)}',${onSelectCb?'_ssCb_'+wrapId:'null'})">
        <span style="font-size:15px;">✖</span><span>${cfg.clearLabel}</span></div>`;
    }
    const entries = Object.entries(cfg.data);
    if (!entries.length) { html += '<div class="ss-empty"><i class="fas fa-inbox"></i>لا توجد بيانات</div>'; listEl.innerHTML=html; return; }
    const q = (query||'').trim().toLowerCase();
    const filtered = entries.filter(([id,v]) => {
      const name = (cfg.getName(id,v)||'').toLowerCase();
      const sub  = (cfg.getSub(id,v)||'').toLowerCase();
      const code = (v.code||v.barcode||'').toLowerCase();
      return !q || name.includes(q) || sub.includes(q) || code.includes(q);
    });
    if (!filtered.length) { html += `<div class="ss-empty"><i class="fas fa-search"></i>لا نتائج لـ "${escHtml(query)}"</div>`; listEl.innerHTML=html; return; }
    const cbName = onSelectCb ? '_ssCb_'+wrapId : 'null';
    html += filtered.slice(0,60).map(([id,v]) => {
      const name = cfg.getName(id,v)||'';
      const sub  = cfg.getSub(id,v)||'';
      const isSelected = id===currentVal;
      const highlighted = q ? name.replace(new RegExp('('+escRegex(q)+')','gi'),'<span class="ss-highlight">$1</span>') : escHtml(name);
      return `<div class="ss-item${isSelected?' selected':''}" onclick="_ssSelect('${wrapId}','${escHtml(id)}','${escHtml(name)}',${cbName})">
        <div class="ss-item-avatar">${cfg.icon}</div>
        <div class="ss-item-info">
          <div class="ss-item-name">${highlighted}</div>
          ${sub?`<div class="ss-item-sub">${escHtml(sub)}</div>`:''}
        </div>
        ${isSelected?'<i class="fas fa-check ss-item-check"></i>':''}
      </div>`;
    }).join('');
    if (filtered.length>60) html += `<div class="ss-empty" style="padding:8px;"><i class="fas fa-info-circle"></i> ${filtered.length-60} نتيجة إضافية — اكتب أكثر</div>`;
    listEl.innerHTML = html;
  }

  if (onSelectCb) window['_ssCb_'+wrapId] = onSelectCb;
  renderList('');

  const searchInput = document.getElementById('ss-input-'+wrapId);
  if (searchInput) {
    searchInput.addEventListener('input', e => renderList(e.target.value));
    searchInput.addEventListener('keydown', e => {
      if (e.key==='Enter') { const first=document.querySelector(`#ss-list-${wrapId} .ss-item`); if(first) first.click(); }
    });
    setTimeout(() => searchInput.focus(), 50);
  }
}

function _ssSelect(wrapId, id, label, cb) {
  const wrap = document.getElementById(wrapId); if (!wrap) { closeAllSS(); return; }
  const hidden  = wrap.querySelector('input[type=hidden]');
  const labelEl = wrap.querySelector('.ss-label');
  if (hidden)  hidden.value     = id;
  if (labelEl) { labelEl.textContent = label||'-- اختر --'; labelEl.style.color = id?'var(--text)':'var(--text3)'; }
  closeAllSS();
  if (typeof cb==='function') cb(id,label);
  else if (typeof window[cb]==='function') window[cb](id,label);
  if (hidden) hidden.dispatchEvent(new Event('change',{bubbles:true}));
}

function _ssAdd(wrapId, dataType) {
  closeAllSS();
  const actions = {
    customers: () => { typeof togglePosAddCust==='function'&&togglePosAddCust(); },
    suppliers: () => { typeof openAddSupplier==='function'&&openAddSupplier(); },
    products:  () => { typeof openAddProduct==='function'&&openAddProduct(); },
    warehouses:() => {}
  };
  if (actions[dataType]) actions[dataType]();
}
