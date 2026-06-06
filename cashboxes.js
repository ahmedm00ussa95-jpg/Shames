/* ============================================================
   cashboxes.js — إدارة الخزائن
   الشمس - Al Shams ERP | المرحلة الأولى
   ============================================================ */

let editingCb = null;

function renderCashboxes() {
  const grid = document.getElementById('cashbox-grid'); if (!grid) return;
  const cbs = Object.entries(S.cashboxes);
  if (!cbs.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text2);padding:32px;font-size:13px;">
      <i class="fas fa-safe" style="font-size:32px;display:block;margin-bottom:10px;opacity:.4;"></i>
      لا توجد خزائن - أضف خزينة جديدة
    </div>`;
    return;
  }
  grid.innerHTML = cbs.map(([id, cb]) => `
    <div class="cashbox-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div class="cashbox-name">${cb.name}</div>
          <div class="cashbox-type"><span class="badge badge-info">${CB_TYPES[cb.type]||cb.type||'نقدي'}</span></div>
        </div>
        <div style="display:flex;gap:5px;">
          <button class="btn btn-ghost btn-xs" onclick="openCashboxTx('deposit','${id}')"><i class="fas fa-plus"></i></button>
          <button class="btn btn-ghost btn-xs" onclick="openCashboxTx('withdraw','${id}')"><i class="fas fa-minus"></i></button>
          <button class="btn btn-ghost btn-xs" onclick="editCb('${id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-xs" onclick="delCb('${id}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="cashbox-balance">${N(cb.balance||0)} EGP</div>
      ${cb.notes ? `<div style="font-size:11px;color:var(--text2);">${cb.notes}</div>` : ''}
    </div>`).join('');
}

function renderCashboxLog() {
  const tbody = document.getElementById('cashbox-log'); if (!tbody) return;
  const rows = Object.entries(S.cashboxLog).sort(([,a],[,b]) => new Date(b.date) - new Date(a.date)).slice(0, 80);
  tbody.innerHTML = rows.length
    ? rows.map(([,l]) => `<tr>
        <td>${fDate(l.date)}</td>
        <td>${S.cashboxes[l.cbId]?.name||l.cbName||'-'}</td>
        <td><span class="badge ${l.type==='deposit'?'badge-success':'badge-danger'}">${l.type==='deposit'?'إيداع':'صرف'}</span></td>
        <td style="font-weight:700;color:${l.type==='deposit'?'var(--green)':'var(--red)'};">${l.type==='deposit'?'+':'-'}${N(l.amount)} EGP</td>
        <td style="font-size:12px;">${l.desc||'-'}</td>
        <td style="font-size:11px;color:var(--text2);">${l.ref||'-'}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:16px;">لا توجد حركات</td></tr>';
}

async function saveCashbox() {
  const name = (document.getElementById('cbf-name').value||'').trim();
  if (!name) { toast('يرجى إدخال اسم الخزينة','error'); return; }
  const data = {
    name,
    type:    document.getElementById('cbf-type').value,
    balance: parseFloat(document.getElementById('cbf-balance').value)||0,
    notes:   document.getElementById('cbf-notes').value.trim(),
    updatedAt: new Date().toISOString()
  };
  try {
    if (editingCb) await dbUpdate('cashboxes/' + editingCb, data);
    else { data.createdAt = new Date().toISOString(); await dbUpdate('cashboxes/' + uid(), data); }
    closeModal('modal-cashbox');
    toast('تم حفظ الخزينة');
    editingCb = null;
  } catch(e) { toast('خطأ: ' + e.message,'error'); }
}

function editCb(id) {
  editingCb = id;
  const cb = S.cashboxes[id];
  const titleEl = document.getElementById('cb-modal-title');
  if (titleEl) titleEl.textContent = 'تعديل خزينة';
  document.getElementById('cbf-name').value    = cb.name    || '';
  document.getElementById('cbf-type').value    = cb.type    || 'cash';
  document.getElementById('cbf-balance').value = cb.balance || 0;
  document.getElementById('cbf-notes').value   = cb.notes   || '';
  openModal('modal-cashbox');
}

async function delCb(id) {
  if (!confirm('حذف هذه الخزينة؟')) return;
  await dbRemove('cashboxes/' + id);
  toast('تم الحذف');
}

function openCashboxTx(type, cbId='') {
  document.getElementById('cbtx-type').value = type;
  const titleEl = document.getElementById('cbtx-title');
  if (titleEl) titleEl.innerHTML = `<i class="fas fa-${type==='deposit'?'plus':'minus'}-circle" style="color:var(--${type==='deposit'?'green':'yellow'})"></i> ${type==='deposit'?'إيداع في خزينة':'صرف من خزينة'}`;
  const btn = document.getElementById('cbtx-btn');
  if (btn) btn.className = `btn btn-${type==='deposit'?'success':'warning'}`;
  const sel = document.getElementById('cbtx-cb');
  sel.innerHTML = Object.entries(S.cashboxes).map(([id,cb]) => `<option value="${id}" ${id===cbId?'selected':''}>${cb.name}</option>`).join('');
  document.getElementById('cbtx-amount').value = '';
  document.getElementById('cbtx-desc').value   = '';
  document.getElementById('cbtx-date').value   = today();
  openModal('modal-cashbox-tx');
}

async function saveCashboxTx() {
  const cbId   = document.getElementById('cbtx-cb').value;
  const amount = parseFloat(document.getElementById('cbtx-amount').value)||0;
  const type   = document.getElementById('cbtx-type').value;
  const desc   = document.getElementById('cbtx-desc').value.trim();
  const date   = document.getElementById('cbtx-date').value || today();
  if (!cbId)       { toast('يرجى اختيار خزينة','error'); return; }
  if (amount <= 0) { toast('يرجى إدخال مبلغ صحيح','error'); return; }
  const cb = S.cashboxes[cbId];
  if (!cb) { toast('الخزينة غير موجودة','error'); return; }
  if (type==='withdraw' && (cb.balance||0) < amount) { toast('رصيد الخزينة غير كافٍ','error'); return; }
  try {
    const newBal = (+cb.balance||0) + (type==='deposit' ? amount : -amount);
    await dbUpdate('cashboxes/' + cbId, {balance: newBal, updatedAt: new Date().toISOString()});
    await dbPush('cashboxLog', {cbId, cbName:cb.name, type, amount, desc, date, ref:'يدوي', createdAt:new Date().toISOString(), createdBy:getCU()});
    closeModal('modal-cashbox-tx');
    toast(type==='deposit' ? 'تم الإيداع بنجاح' : 'تم الصرف بنجاح');
  } catch(e) { toast('خطأ: ' + e.message,'error'); }
}

function fillCashboxSelects() {
  const opts = '<option value="">-- بدون خزينة --</option>' +
    Object.entries(S.cashboxes).map(([id,cb]) => `<option value="${id}">${cb.name} (${N(cb.balance||0)} EGP)</option>`).join('');
  ['pos-cashbox','mi-cashbox','purf-cashbox','ef-cashbox','retf-cashbox'].forEach(elId => {
    const el = document.getElementById(elId); if (el) el.innerHTML = opts;
  });
  const pdCb = document.getElementById('pd-cashbox');
  if (pdCb) {
    pdCb.innerHTML = '<option value="">-- اختر الخزينة (إلزامي) --</option>' +
      Object.entries(S.cashboxes).map(([id,cb]) => `<option value="${id}">${cb.name} (${N(cb.balance||0)} EGP)</option>`).join('');
  }
  updatePosPayCashbox();
}

function updatePosPayCashbox() {
  const pay       = document.getElementById('pos-pay')?.value || 'cash';
  const cbSel     = document.getElementById('pos-cashbox');
  const paidInput = document.getElementById('pos-paid');
  const changeRow = document.getElementById('change-row');
  if (!cbSel) return;
  if (pay === 'credit') {
    if (paidInput) { paidInput.value=''; paidInput.placeholder='آجل - لا يوجد دفع'; paidInput.disabled=true; paidInput.style.opacity='.5'; }
    if (changeRow) changeRow.style.display = 'none';
    cbSel.innerHTML = '<option value="">-- لا خزينة (آجل) --</option>';
    cbSel.disabled = true; cbSel.style.opacity = '.5';
    return;
  }
  if (paidInput) { paidInput.disabled=false; paidInput.style.opacity='1'; paidInput.placeholder='المدفوع'; }
  cbSel.disabled = false; cbSel.style.opacity = '1';
  const typeMap = {cash:'cash', card:'card', transfer:'transfer'};
  const cbType  = typeMap[pay] || 'cash';
  const matching= Object.entries(S.cashboxes).filter(([,cb]) => cb.type===cbType);
  const opts = '<option value="">-- اختر خزينة --</option>' +
    Object.entries(S.cashboxes).map(([id,cb]) => `<option value="${id}" ${cb.type===cbType?'selected':''}>${cb.name}</option>`).join('');
  cbSel.innerHTML = opts;
  if (matching.length > 0) cbSel.value = matching[0][0];
}
