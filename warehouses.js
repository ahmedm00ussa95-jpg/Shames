/* ============================================================
   warehouses.js — إدارة المخازن وحركات المخزون
   الشمس - Al Shams ERP | المرحلة الأولى
   ============================================================ */

let editingWh = null;

async function saveWarehouse() {
  const name = (document.getElementById('wf-name').value||'').trim();
  if (!name) { toast('يرجى إدخال اسم المخزن','error'); return; }
  const data = {
    name,
    loc:   document.getElementById('wf-loc').value.trim(),
    mgr:   document.getElementById('wf-mgr').value.trim(),
    notes: document.getElementById('wf-notes').value.trim(),
    updatedAt: new Date().toISOString(), updatedBy: getCU()
  };
  const path = editingWh ? `warehouses/${editingWh}` : `warehouses/${uid()}`;
  if (!editingWh) data.createdAt = new Date().toISOString();
  await dbUpdate(path, data)
    .then(() => { closeModal('modal-wh'); toast('تم حفظ المخزن'); editingWh = null; })
    .catch(e => toast(e.message,'error'));
}

function renderWarehouses() {
  const grid = document.getElementById('wh-grid'); if (!grid) return;
  const whs = Object.entries(S.warehouses);
  if (!whs.length) { grid.innerHTML = '<div style="color:var(--text2);font-size:13px;">لا توجد مخازن — أضف مخزناً جديداً</div>'; return; }
  grid.innerHTML = whs.map(([id, w]) => {
    const prods    = Object.values(S.products).filter(p => p.whId === id);
    const totalQty = prods.reduce((s, p) => s + (+p.qty||0), 0);
    const totalVal = prods.reduce((s, p) => s + ((+p.qty||0) * (+p.price||0)), 0);
    const lowStock = prods.filter(p => (+p.qty||0) <= (+p.min||0) && (+p.qty||0) > 0).length;
    const outStock = prods.filter(p => (+p.qty||0) === 0).length;
    return `<div class="wh-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:13px;">
        <div>
          <div style="font-size:16px;font-weight:900;">${w.name}</div>
          <div style="font-size:11px;color:var(--text2);">${w.loc||''}</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-ghost btn-xs" onclick="editWh('${id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-xs" onclick="delWh('${id}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <div style="background:var(--card2);border-radius:8px;padding:9px;text-align:center;"><div style="font-size:20px;font-weight:900;color:var(--accent);">${prods.length}</div><div style="font-size:10px;color:var(--text2);">أنواع المنتجات</div></div>
        <div style="background:var(--card2);border-radius:8px;padding:9px;text-align:center;"><div style="font-size:20px;font-weight:900;color:var(--green);">${totalQty}</div><div style="font-size:10px;color:var(--text2);">إجمالي الوحدات</div></div>
      </div>
      <div style="background:var(--card2);border-radius:8px;padding:9px;text-align:center;margin-bottom:8px;"><div style="font-size:10px;color:var(--text2);">قيمة المخزون</div><div style="font-size:15px;font-weight:700;color:var(--yellow);">${N(totalVal)} EGP</div></div>
      ${lowStock > 0 ? `<div style="font-size:11px;color:var(--yellow);"><i class="fas fa-exclamation-triangle"></i> ${lowStock} منتج مخزونه منخفض</div>` : ''}
      ${outStock > 0 ? `<div style="font-size:11px;color:var(--red);"><i class="fas fa-times-circle"></i> ${outStock} منتج نفد</div>` : ''}
      ${w.mgr ? `<div style="font-size:11px;color:var(--text2);margin-top:5px;"><i class="fas fa-user"></i> ${w.mgr}</div>` : ''}
    </div>`;
  }).join('');
}

function editWh(id) {
  editingWh = id;
  const w = S.warehouses[id];
  document.getElementById('wf-name').value  = w.name  || '';
  document.getElementById('wf-loc').value   = w.loc   || '';
  document.getElementById('wf-mgr').value   = w.mgr   || '';
  document.getElementById('wf-notes').value = w.notes || '';
  openModal('modal-wh');
}

async function delWh(id) {
  if (!confirm('حذف هذا المخزن؟')) return;
  await dbRemove(`warehouses/${id}`);
  toast('تم الحذف');
}

function renderMovements() {
  const tbody = document.getElementById('mov-tbl'); if (!tbody) return;
  const movs = Object.entries(S.movements).sort(([,a],[,b]) => new Date(b.date) - new Date(a.date)).slice(0, 60);
  tbody.innerHTML = movs.length
    ? movs.map(([,m]) => `<tr>
        <td>${fDate(m.date)}</td>
        <td>${m.product}</td>
        <td><span class="badge ${m.type==='in'?'badge-success':'badge-danger'}">${m.type==='in'?'وارد':'صادر'}</span></td>
        <td>${m.qty}</td>
        <td>${S.warehouses[m.whId]?.name||'-'}</td>
        <td style="font-size:11px;color:var(--text2);">${m.note||''}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:20px;">لا توجد حركات</td></tr>';
}

// Transfer between warehouses
function updateTransferProds() {
  const fromId = document.getElementById('tr-from')?.value || '';
  const sel = document.getElementById('tr-prod'); if (!sel) return;
  const prods = Object.entries(S.products).filter(([,p]) => p.whId === fromId && (+p.qty||0) > 0);
  sel.innerHTML = '<option value="">-- اختر منتج --</option>' +
    prods.map(([id,p]) => `<option value="${id}">${p.name} (متاح: ${p.qty})</option>`).join('');
  updateTransferMax();
}

function updateTransferMax() {
  const prodId = document.getElementById('tr-prod')?.value || '';
  const maxEl  = document.getElementById('tr-max');
  if (maxEl) maxEl.value = prodId ? (S.products[prodId]?.qty || 0) : '';
}

async function saveTransfer() {
  const fromId = document.getElementById('tr-from')?.value || '';
  const toId   = document.getElementById('tr-to')?.value   || '';
  const prodId = document.getElementById('tr-prod')?.value || '';
  const qty    = parseInt(document.getElementById('tr-qty')?.value) || 0;
  const note   = document.getElementById('tr-note')?.value || '';
  if (!fromId || !toId || !prodId || qty <= 0) { toast('يرجى إكمال جميع الحقول','error'); return; }
  if (fromId === toId) { toast('المخزن المصدر والمستهدف متطابقان','error'); return; }
  const p = S.products[prodId];
  if (!p) { toast('المنتج غير موجود','error'); return; }
  if ((+p.qty||0) < qty) { toast('الكمية المطلوبة أكبر من المتاح','error'); return; }
  try {
    await dbUpdate('products/' + prodId, {qty: Math.max(0, (+p.qty||0) - qty)});
    // Check if product exists in destination warehouse
    const destProd = Object.entries(S.products).find(([,dp]) => dp.whId===toId && (dp.code===p.code || dp.name===p.name));
    if (destProd) {
      await dbUpdate('products/' + destProd[0], {qty: (+destProd[1].qty||0) + qty});
    } else {
      await dbUpdate('products/' + uid(), {...p, whId:toId, qty, createdAt: new Date().toISOString()});
    }
    const fromName = S.warehouses[fromId]?.name || fromId;
    const toName   = S.warehouses[toId]?.name   || toId;
    await dbPush('movements', {date:new Date().toISOString(), product:p.name, type:'out', qty, whId:fromId, note:`تحويل إلى ${toName}${note?' - '+note:''}`});
    await dbPush('movements', {date:new Date().toISOString(), product:p.name, type:'in',  qty, whId:toId,   note:`تحويل من ${fromName}${note?' - '+note:''}`});
    closeModal('modal-transfer');
    toast(`تم تحويل ${qty} وحدة من ${fromName} إلى ${toName} ✅`);
  } catch(e) { toast('خطأ: ' + e.message,'error'); }
}

// ============================================================
// PHASE 3 — Populate movement warehouse filter on data load
// ============================================================
function updateWhMovFilter() {
  const el = document.getElementById('mov-wh-filter'); if (!el) return;
  el.innerHTML = '<option value="">كل المخازن</option>' +
    Object.entries(S.warehouses).map(([id,w])=>`<option value="${id}">${w.name}</option>`).join('');
}

// Override renderWarehouses to also update filters and dashboard
const _origRenderWarehouses = renderWarehouses;
function renderWarehouses() {
  _origRenderWarehouses();
  updateWhMovFilter();
  if (typeof updateInventoryDashboard === 'function') {
    setTimeout(updateInventoryDashboard, 150);
  }
}

// Enhanced saveWarehouse to log activity
const _origSaveWarehouse = saveWarehouse;
async function saveWarehouse() {
  await _origSaveWarehouse();
  if (typeof AL !== 'undefined') {
    const name = document.getElementById('wf-name')?.value||'';
    AL.record(editingWh?'wh_edited':'wh_added', name, 'warehouses');
  }
}
