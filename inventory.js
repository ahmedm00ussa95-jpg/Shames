/* ============================================================
   inventory.js — إدارة المخزون الاحترافية
   Phase 3: حركات + تحويلات + جرد + تسويات + تنبيهات
   ============================================================ */

// ============================================================
// MOVEMENT ENGINE — كل حركة مخزون تمر هنا
// ============================================================
const INV = {

  /**
   * تسجيل حركة مخزون مع كل التفاصيل
   * @param {string} type        — 'in' | 'out' | 'transfer_in' | 'transfer_out' | 'adjust' | 'count'
   * @param {string} prodId
   * @param {number} qty
   * @param {string} whId
   * @param {string} ref         — رقم مرجعي (فاتورة، تحويل...)
   * @param {string} note
   * @param {number} costPrice
   */
  async record(type, prodId, qty, whId, ref='', note='', costPrice=0) {
    const p = S.products[prodId];
    if (!p) return;
    const mov = {
      type, prodId, prodName: p.name, prodCode: p.code||'',
      qty, whId, whName: S.warehouses[whId]?.name||whId,
      costPrice: costPrice || p.cost || 0,
      totalCost: qty * (costPrice || p.cost || 0),
      ref, note,
      branchId:  BS.currentBranchId || '',
      createdBy: getCU(),
      date:      new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };
    await dbPush('movements', mov);
    return mov;
  },

  /**
   * تحديث كمية منتج مع تسجيل الحركة تلقائياً
   */
  async updateQty(prodId, delta, type, ref='', note='', costPrice=0) {
    const p = S.products[prodId]; if (!p) return;
    const newQty = Math.max(0, (+p.qty||0) + delta);
    await dbUpdate('products/' + prodId, {
      qty: newQty,
      updatedAt: new Date().toISOString(),
      updatedBy: getCU()
    });
    await this.record(type, prodId, Math.abs(delta), p.whId, ref, note, costPrice);
    return newQty;
  },

  /**
   * احتساب قيمة المخزون الكلية
   */
  calcTotalValue(whId='') {
    return Object.values(S.products)
      .filter(p => !whId || p.whId === whId)
      .reduce((s, p) => s + (+p.qty||0) * (+p.cost||0), 0);
  },

  /**
   * احتساب قيمة البيع المتوقعة
   */
  calcSaleValue(whId='') {
    return Object.values(S.products)
      .filter(p => !whId || p.whId === whId)
      .reduce((s, p) => s + (+p.qty||0) * (+p.price||0), 0);
  },

  /**
   * جلب المنتجات منخفضة المخزون
   */
  getLowStock() {
    return Object.entries(S.products).filter(([,p]) => (+p.qty||0) <= (+p.min||0) && (+p.qty||0) > 0);
  },

  /**
   * جلب المنتجات المنتهية
   */
  getOutOfStock() {
    return Object.entries(S.products).filter(([,p]) => (+p.qty||0) === 0);
  },

  /**
   * جلب حركات منتج معين
   */
  getProductMovements(prodId, limit=50) {
    return Object.entries(S.movements)
      .filter(([,m]) => m.prodId === prodId)
      .sort(([,a],[,b]) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }
};

// ============================================================
// ENHANCED TRANSFER — تحويل بين الفروع والمخازن
// ============================================================
function openTransfer() {
  updateWhSelects();
  const fromSel = document.getElementById('tr-from');
  const toSel   = document.getElementById('tr-to');
  if (fromSel) {
    const opts = Object.entries(S.warehouses)
      .map(([id,w]) => `<option value="${id}">${w.name}</option>`).join('');
    fromSel.innerHTML = '<option value="">-- مخزن المصدر --</option>' + opts;
    if (toSel) toSel.innerHTML = '<option value="">-- مخزن الهدف --</option>' + opts;
  }
  document.getElementById('tr-qty').value  = '';
  document.getElementById('tr-note').value = '';
  // Reset product select
  const prodSel = document.getElementById('tr-prod');
  if (prodSel) prodSel.innerHTML = '<option value="">-- اختر مخزن المصدر أولاً --</option>';
  openModal('modal-transfer');
}

function updateTransferProds() {
  const fromId = document.getElementById('tr-from')?.value || '';
  const sel    = document.getElementById('tr-prod'); if (!sel) return;
  const prods  = Object.entries(S.products).filter(([,p]) => p.whId===fromId && (+p.qty||0)>0);
  if (!fromId) { sel.innerHTML='<option value="">-- اختر مخزن المصدر أولاً --</option>'; return; }
  if (!prods.length) { sel.innerHTML='<option value="">لا توجد منتجات في هذا المخزن</option>'; return; }
  sel.innerHTML = '<option value="">-- اختر منتج --</option>' +
    prods.map(([id,p])=>`<option value="${id}">${p.name} (متاح: ${p.qty})</option>`).join('');
  updateTransferMax();
}

function updateTransferMax() {
  const prodId = document.getElementById('tr-prod')?.value || '';
  const maxEl  = document.getElementById('tr-max'); if (!maxEl) return;
  if (!prodId) { maxEl.value=''; return; }
  const p = S.products[prodId];
  maxEl.value = p ? p.qty : 0;
}

async function saveTransfer() {
  const fromId = document.getElementById('tr-from')?.value || '';
  const toId   = document.getElementById('tr-to')?.value   || '';
  const prodId = document.getElementById('tr-prod')?.value || '';
  const qty    = parseInt(document.getElementById('tr-qty')?.value)||0;
  const note   = document.getElementById('tr-note')?.value || '';

  if (!fromId)  { toast('اختر مخزن المصدر','error');   return; }
  if (!toId)    { toast('اختر مخزن الهدف','error');    return; }
  if (!prodId)  { toast('اختر المنتج','error');         return; }
  if (qty <= 0) { toast('أدخل كمية صحيحة','error');    return; }
  if (fromId === toId) { toast('المخزنان متطابقان','error'); return; }

  const p        = S.products[prodId];
  const fromName = S.warehouses[fromId]?.name || fromId;
  const toName   = S.warehouses[toId]?.name   || toId;

  if (!p) { toast('المنتج غير موجود','error'); return; }
  if ((+p.qty||0) < qty) { toast(`المخزون المتاح ${p.qty} فقط`,'error'); return; }

  try {
    const transferRef = 'TR-' + Date.now().toString(36).toUpperCase();

    // خصم من المخزن المصدر
    await dbUpdate('products/' + prodId, {
      qty: Math.max(0, (+p.qty||0) - qty),
      updatedAt: new Date().toISOString()
    });
    await INV.record('transfer_out', prodId, qty, fromId, transferRef,
      `تحويل إلى ${toName}${note?' — '+note:''}`, p.cost);

    // البحث عن المنتج في المخزن الهدف
    const destEntry = Object.entries(S.products).find(([id,dp]) =>
      dp.whId === toId && (dp.code===p.code || dp.name===p.name) && id !== prodId
    );

    if (destEntry) {
      await dbUpdate('products/' + destEntry[0], {
        qty: (+destEntry[1].qty||0) + qty,
        updatedAt: new Date().toISOString()
      });
    } else {
      // إنشاء نسخة المنتج في المخزن الهدف
      await dbUpdate('products/' + uid(), {
        ...p, whId: toId, qty,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    await INV.record('transfer_in', prodId, qty, toId, transferRef,
      `تحويل من ${fromName}${note?' — '+note:''}`, p.cost);

    // Activity log
    if (typeof AL !== 'undefined') {
      AL.record('transfer', `${qty} × ${p.name} من ${fromName} إلى ${toName}`, 'transfer');
    }

    closeModal('modal-transfer');
    toast(`✅ تم تحويل ${qty} وحدة من "${fromName}" إلى "${toName}"`);
  } catch(e) { toast('خطأ: '+e.message,'error'); }
}

// ============================================================
// STOCK COUNT — الجرد المخزني
// ============================================================
let countSession = { items: [], whId: '', started: false };

function openStockCount() {
  updateWhSelects();
  const sel = document.getElementById('sc-wh');
  if (sel) {
    sel.innerHTML = '<option value="">-- اختر المخزن --</option>' +
      Object.entries(S.warehouses).map(([id,w])=>`<option value="${id}">${w.name}</option>`).join('');
  }
  countSession = { items: [], whId: '', started: false };
  document.getElementById('sc-items-wrap').style.display = 'none';
  document.getElementById('sc-start-btn').style.display  = '';
  document.getElementById('sc-save-btn').style.display   = 'none';
  document.getElementById('sc-summary').style.display    = 'none';
  openModal('modal-stock-count');
}

function startStockCount() {
  const whId = document.getElementById('sc-wh')?.value;
  if (!whId) { toast('اختر المخزن أولاً','error'); return; }
  countSession.whId    = whId;
  countSession.started = true;
  const prods = Object.entries(S.products).filter(([,p]) => p.whId === whId);
  if (!prods.length) { toast('لا توجد منتجات في هذا المخزن','error'); return; }

  countSession.items = prods.map(([id,p]) => ({
    prodId: id, name: p.name, code: p.code||'',
    systemQty: +p.qty||0, actualQty: +p.qty||0,
    cost: +p.cost||0
  }));

  renderCountItems();
  document.getElementById('sc-items-wrap').style.display = '';
  document.getElementById('sc-start-btn').style.display  = 'none';
  document.getElementById('sc-save-btn').style.display   = '';
  calcCountSummary();
}

function renderCountItems() {
  const list = document.getElementById('sc-items-list'); if (!list) return;
  const q = (document.getElementById('sc-search')?.value||'').toLowerCase();
  const items = countSession.items.filter(i =>
    !q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)
  );
  list.innerHTML = items.length ? items.map((item,i) => {
    const diff = item.actualQty - item.systemQty;
    const diffColor = diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--text2)';
    return `<div style="display:grid;grid-template-columns:1fr 90px 90px 90px 100px;gap:8px;align-items:center;padding:9px 12px;background:var(--card2);border-radius:9px;margin-bottom:6px;border:1px solid ${diff!==0?diffColor+'55':'var(--border2)'};">
      <div>
        <div style="font-size:13px;font-weight:700;">${item.name}</div>
        <div style="font-size:10px;color:var(--text3);">${item.code||'—'}</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:11px;color:var(--text2);">نظام</div>
        <div style="font-size:14px;font-weight:900;color:var(--accent);">${item.systemQty}</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:11px;color:var(--text2);">فعلي</div>
        <input type="number" min="0" value="${item.actualQty}"
          style="width:70px;text-align:center;background:var(--card);border:1px solid var(--border);border-radius:7px;padding:4px;font-family:Cairo,sans-serif;font-size:13px;font-weight:700;color:var(--text);"
          oninput="countSession.items[${countSession.items.indexOf(item)}].actualQty=+this.value;calcCountSummary()">
      </div>
      <div style="text-align:center;">
        <div style="font-size:11px;color:var(--text2);">فرق</div>
        <div style="font-size:14px;font-weight:900;color:${diffColor};">${diff>0?'+':''}${diff}</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:11px;color:var(--text2);">قيمة الفرق</div>
        <div style="font-size:12px;font-weight:700;color:${diffColor};">${N(Math.abs(diff)*item.cost)}</div>
      </div>
    </div>`;
  }).join('') : '<div style="text-align:center;color:var(--text2);padding:20px;">لا نتائج</div>';
}

function calcCountSummary() {
  const over  = countSession.items.filter(i => i.actualQty > i.systemQty);
  const short = countSession.items.filter(i => i.actualQty < i.systemQty);
  const match = countSession.items.filter(i => i.actualQty === i.systemQty);
  const overVal  = over.reduce((s,i)=>s+(i.actualQty-i.systemQty)*i.cost,0);
  const shortVal = short.reduce((s,i)=>s+(i.systemQty-i.actualQty)*i.cost,0);

  const sumEl = document.getElementById('sc-summary');
  if (sumEl) {
    sumEl.style.display = '';
    sumEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:12px;background:var(--card2);border-radius:10px;border:1px solid var(--border);">
        <div style="text-align:center;"><div style="font-size:20px;font-weight:900;color:var(--green);">${over.length}</div><div style="font-size:11px;color:var(--text2);">زيادة</div><div style="font-size:11px;color:var(--green);">+${N(overVal)} EGP</div></div>
        <div style="text-align:center;"><div style="font-size:20px;font-weight:900;color:var(--red);">${short.length}</div><div style="font-size:11px;color:var(--text2);">نقص</div><div style="font-size:11px;color:var(--red);">-${N(shortVal)} EGP</div></div>
        <div style="text-align:center;"><div style="font-size:20px;font-weight:900;color:var(--accent);">${match.length}</div><div style="font-size:11px;color:var(--text2);">مطابق</div></div>
        <div style="text-align:center;"><div style="font-size:20px;font-weight:900;">${countSession.items.length}</div><div style="font-size:11px;color:var(--text2);">إجمالي</div></div>
      </div>`;
  }
}

async function saveStockCount() {
  const diffs = countSession.items.filter(i => i.actualQty !== i.systemQty);
  if (!diffs.length) { toast('لا توجد فروقات للتسوية','info'); closeModal('modal-stock-count'); return; }
  if (!confirm(`تطبيق تسوية ${diffs.length} منتج؟`)) return;

  const countRef = 'CNT-' + new Date().toISOString().split('T')[0];
  let adjusted = 0;
  for (const item of diffs) {
    const diff = item.actualQty - item.systemQty;
    await dbUpdate('products/' + item.prodId, {
      qty: item.actualQty,
      updatedAt: new Date().toISOString()
    });
    await INV.record(
      diff > 0 ? 'adjust_in' : 'adjust_out',
      item.prodId, Math.abs(diff), countSession.whId,
      countRef, `جرد مخزني — فرق: ${diff>0?'+':''}${diff}`, item.cost
    );
    adjusted++;
  }

  if (typeof AL !== 'undefined') {
    AL.record('stock_count', `جرد ${S.warehouses[countSession.whId]?.name||''} — تسوية ${adjusted} منتج`);
  }

  closeModal('modal-stock-count');
  toast(`✅ تم تطبيق الجرد — تسوية ${adjusted} منتج`);
}

// ============================================================
// STOCK ADJUSTMENT — تسوية منتج واحد
// ============================================================
function openAdjustStock(prodId) {
  const p = S.products[prodId]; if (!p) return;
  document.getElementById('adj-prod-id').value   = prodId;
  document.getElementById('adj-prod-name').textContent = p.name;
  document.getElementById('adj-current-qty').textContent = p.qty || 0;
  document.getElementById('adj-qty').value   = '';
  document.getElementById('adj-reason').value= '';
  document.getElementById('adj-type').value  = 'in';
  openModal('modal-adj-stock');
}

async function saveAdjustment() {
  const prodId = document.getElementById('adj-prod-id').value;
  const type   = document.getElementById('adj-type').value;
  const qty    = parseInt(document.getElementById('adj-qty').value)||0;
  const reason = document.getElementById('adj-reason').value.trim();
  if (!prodId || qty <= 0) { toast('أدخل كمية صحيحة','error'); return; }
  const p = S.products[prodId]; if (!p) return;
  if (type==='out' && (+p.qty||0) < qty) { toast(`المخزون المتاح ${p.qty} فقط`,'error'); return; }

  const newQty = (+p.qty||0) + (type==='in' ? qty : -qty);
  await dbUpdate('products/'+prodId, {qty:newQty, updatedAt:new Date().toISOString()});
  await INV.record(type==='in'?'adjust_in':'adjust_out', prodId, qty, p.whId,
    'ADJ-'+Date.now().toString(36).toUpperCase(), reason||'تسوية يدوية', p.cost);

  if (typeof AL !== 'undefined') AL.record('stock_adjust', `${p.name}: ${type==='in'?'+':'-'}${qty} — ${reason||'تسوية'}`);
  closeModal('modal-adj-stock');
  toast(`✅ تم تعديل مخزون "${p.name}": ${type==='in'?'+':'-'}${qty}`);
}

// ============================================================
// ENHANCED MOVEMENTS TABLE
// ============================================================
function renderMovements() {
  const tbody = document.getElementById('mov-tbl'); if (!tbody) return;
  const search= (document.getElementById('mov-search')?.value||'').toLowerCase();
  const type  = document.getElementById('mov-type-filter')?.value  || '';
  const wh    = document.getElementById('mov-wh-filter')?.value    || '';
  const from  = document.getElementById('mov-from-filter')?.value  || '';
  const to    = document.getElementById('mov-to-filter')?.value    || '';

  const movs = Object.entries(S.movements)
    .filter(([,m]) => {
      const d = (m.date||m.createdAt||'').split('T')[0];
      return (!search || (m.prodName||m.product||'').toLowerCase().includes(search))
          && (!type   || m.type === type)
          && (!wh     || m.whId === wh)
          && (!from   || d >= from)
          && (!to     || d <= to);
    })
    .sort(([,a],[,b]) => new Date(b.createdAt||b.date) - new Date(a.createdAt||a.date))
    .slice(0, 100);

  const typeConfig = {
    in:          {label:'وارد',          cls:'badge-success', icon:'fa-arrow-down'},
    out:         {label:'صادر',          cls:'badge-danger',  icon:'fa-arrow-up'},
    transfer_in: {label:'تحويل وارد',   cls:'badge-info',    icon:'fa-exchange-alt'},
    transfer_out:{label:'تحويل صادر',  cls:'badge-warning', icon:'fa-exchange-alt'},
    adjust_in:   {label:'تسوية زيادة', cls:'badge-success', icon:'fa-plus-circle'},
    adjust_out:  {label:'تسوية نقص',   cls:'badge-danger',  icon:'fa-minus-circle'},
    count:       {label:'جرد',          cls:'badge-purple',  icon:'fa-clipboard-list'}
  };

  tbody.innerHTML = movs.length
    ? movs.map(([,m]) => {
        const cfg = typeConfig[m.type] || {label:m.type, cls:'badge-info', icon:'fa-circle'};
        const name= m.prodName||m.product||'—';
        const cost= m.totalCost||0;
        return `<tr>
          <td style="font-size:11px;color:var(--text2);">${fDate(m.date||m.createdAt)}</td>
          <td><strong>${name}</strong>${m.prodCode?`<br><span style="font-size:10px;color:var(--text3);">${m.prodCode}</span>`:''}</td>
          <td><span class="badge ${cfg.cls}"><i class="fas ${cfg.icon}" style="font-size:10px;"></i> ${cfg.label}</span></td>
          <td style="font-weight:700;font-size:14px;">${m.qty}</td>
          <td>${S.warehouses[m.whId]?.name||m.whName||'—'}</td>
          ${cost>0?`<td style="font-size:11px;color:var(--text2);">${N(cost)} EGP</td>`:'<td style="color:var(--text3);">—</td>'}
          <td style="font-size:11px;color:var(--text2);">${m.ref||'—'}</td>
          <td style="font-size:11px;color:var(--text2);max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.note||'—'}</td>
          <td style="font-size:10px;color:var(--text3);">${m.createdBy||'—'}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="9" style="text-align:center;color:var(--text2);padding:24px;">لا توجد حركات</td></tr>';

  // Update totals
  const totalIn  = movs.filter(([,m])=>m.type==='in'||m.type==='transfer_in'||m.type==='adjust_in').reduce((s,[,m])=>s+m.qty,0);
  const totalOut = movs.filter(([,m])=>m.type==='out'||m.type==='transfer_out'||m.type==='adjust_out').reduce((s,[,m])=>s+m.qty,0);
  const el1 = document.getElementById('mov-total-in');  if(el1) el1.textContent = totalIn;
  const el2 = document.getElementById('mov-total-out'); if(el2) el2.textContent = totalOut;
}

// ============================================================
// LOW STOCK ALERTS
// ============================================================
function renderStockAlerts() {
  const low    = INV.getLowStock();
  const outOf  = INV.getOutOfStock();
  const alertEl= document.getElementById('stock-alerts-wrap');
  const countEl= document.getElementById('stock-alerts-count');
  if (countEl) countEl.textContent = low.length + outOf.length;

  if (!alertEl) return;
  if (!low.length && !outOf.length) {
    alertEl.innerHTML = '<div style="text-align:center;color:var(--green);padding:24px;font-size:13px;"><i class="fas fa-check-circle" style="font-size:28px;display:block;margin-bottom:8px;"></i>كل المنتجات في مستواها الطبيعي ✅</div>';
    return;
  }

  const rows = [...outOf.map(([id,p]) => ({id,p,level:'out'})), ...low.map(([id,p]) => ({id,p,level:'low'}))];
  alertEl.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:var(--card2);">
        <th style="padding:9px 12px;text-align:right;">المنتج</th>
        <th style="padding:9px 12px;text-align:right;">المخزن</th>
        <th style="padding:9px 12px;text-align:right;">الكمية</th>
        <th style="padding:9px 12px;text-align:right;">الحد الأدنى</th>
        <th style="padding:9px 12px;text-align:right;">الحالة</th>
        <th style="padding:9px 12px;text-align:right;">إجراء</th>
      </tr></thead>
      <tbody>${rows.map(({id,p,level}) => `<tr style="border-bottom:1px solid var(--border2);">
        <td style="padding:8px 12px;font-weight:700;">${p.name}</td>
        <td style="padding:8px 12px;font-size:11px;">${S.warehouses[p.whId]?.name||'—'}</td>
        <td style="padding:8px 12px;font-weight:900;color:${level==='out'?'var(--red)':'var(--yellow)'};">${p.qty||0}</td>
        <td style="padding:8px 12px;color:var(--text2);">${p.min||5}</td>
        <td style="padding:8px 12px;"><span class="badge ${level==='out'?'badge-danger':'badge-warning'}">${level==='out'?'نفد المخزون':'مخزون منخفض'}</span></td>
        <td style="padding:8px 12px;">
          <button class="btn btn-ghost btn-xs" onclick="openAdjustStock('${id}')"><i class="fas fa-plus"></i> تسوية</button>
          <button class="btn btn-ghost btn-xs" onclick="editProduct('${id}')"><i class="fas fa-edit"></i></button>
        </td>
      </tr>`).join('')}</tbody>
    </table>`;
}

// ============================================================
// PRODUCT MOVEMENT HISTORY (in product view)
// ============================================================
function viewProductHistory(prodId) {
  const p = S.products[prodId]; if (!p) return;
  document.getElementById('ph-prod-name').textContent = p.name;
  document.getElementById('ph-prod-code').textContent = p.code||'—';
  document.getElementById('ph-current-qty').textContent = p.qty||0;
  document.getElementById('ph-cost-val').textContent   = N(p.cost);
  document.getElementById('ph-price-val').textContent  = N(p.price);
  document.getElementById('ph-wh-val').textContent     = S.warehouses[p.whId]?.name||'—';

  const movs = INV.getProductMovements(prodId);
  const tbody= document.getElementById('ph-mov-tbl');
  const typeConfig = {
    in:'وارد',out:'صادر',transfer_in:'تحويل وارد',transfer_out:'تحويل صادر',
    adjust_in:'تسوية+',adjust_out:'تسوية-',count:'جرد'
  };
  const typeClass = {
    in:'badge-success',out:'badge-danger',transfer_in:'badge-info',transfer_out:'badge-warning',
    adjust_in:'badge-success',adjust_out:'badge-danger',count:'badge-purple'
  };

  // Running balance
  let balance = 0;
  const reversedMovs = [...movs].reverse();
  const balances = {};
  reversedMovs.forEach(([id,m]) => {
    const isIn = ['in','transfer_in','adjust_in','count'].includes(m.type);
    balance += isIn ? +m.qty : -m.qty;
    balances[id] = balance;
  });

  tbody.innerHTML = movs.length
    ? movs.map(([id,m]) => `<tr>
        <td style="font-size:11px;">${fDate(m.date||m.createdAt)}</td>
        <td><span class="badge ${typeClass[m.type]||'badge-info'}">${typeConfig[m.type]||m.type}</span></td>
        <td style="font-weight:700;">${m.qty}</td>
        <td style="font-size:11px;">${S.warehouses[m.whId]?.name||m.whName||'—'}</td>
        <td style="font-size:11px;color:var(--text2);">${m.ref||'—'}</td>
        <td style="font-size:11px;color:var(--text2);">${m.note||'—'}</td>
        <td style="font-size:10px;color:var(--text3);">${m.createdBy||'—'}</td>
      </tr>`).join('')
    : '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:16px;">لا توجد حركات لهذا المنتج</td></tr>';

  openModal('modal-product-history');
}

// ============================================================
// INVENTORY DASHBOARD STATS
// ============================================================
function updateInventoryDashboard() {
  const totalVal  = INV.calcTotalValue();
  const saleVal   = INV.calcSaleValue();
  const potential = saleVal - totalVal;
  const lowCount  = INV.getLowStock().length;
  const outCount  = INV.getOutOfStock().length;
  const totalProds= Object.keys(S.products).length;

  const el = id => document.getElementById(id);
  if(el('inv-dash-total-val'))    el('inv-dash-total-val').textContent    = N(totalVal,0) + ' EGP';
  if(el('inv-dash-sale-val'))     el('inv-dash-sale-val').textContent     = N(saleVal,0)  + ' EGP';
  if(el('inv-dash-potential'))    el('inv-dash-potential').textContent    = N(potential,0)+ ' EGP';
  if(el('inv-dash-low'))          el('inv-dash-low').textContent          = lowCount;
  if(el('inv-dash-out'))          el('inv-dash-out').textContent          = outCount;
  if(el('inv-dash-total-prods'))  el('inv-dash-total-prods').textContent  = totalProds;

  // Per-warehouse breakdown
  const whBreakEl = document.getElementById('wh-breakdown-tbl');
  if (whBreakEl) {
    const whs = Object.entries(S.warehouses);
    whBreakEl.innerHTML = whs.length
      ? whs.map(([id,w]) => {
          const prods = Object.values(S.products).filter(p=>p.whId===id);
          const val   = prods.reduce((s,p)=>s+(+p.qty||0)*(+p.cost||0),0);
          const qty   = prods.reduce((s,p)=>s+(+p.qty||0),0);
          const low   = prods.filter(p=>(+p.qty||0)<=(+p.min||0)&&(+p.qty||0)>0).length;
          const out   = prods.filter(p=>(+p.qty||0)===0).length;
          return `<tr>
            <td><strong>${w.name}</strong></td>
            <td style="font-weight:700;">${prods.length}</td>
            <td style="font-weight:700;">${qty}</td>
            <td style="color:var(--yellow);font-weight:700;">${N(val,0)} EGP</td>
            <td>${low>0?`<span class="badge badge-warning">${low} منخفض</span>`:'—'}</td>
            <td>${out>0?`<span class="badge badge-danger">${out} نفد</span>`:'—'}</td>
            <td><button class="btn btn-ghost btn-xs" onclick="nav('warehouses')"><i class="fas fa-eye"></i></button></td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:16px;">لا توجد مخازن</td></tr>';
  }

  renderStockAlerts();
}
