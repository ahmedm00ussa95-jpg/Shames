/* ============================================================
   shifts.js — إدارة الورديات + POS المتقدم
   Phase 4: Shifts + Multi-Payment + Suspended + Returns
   ============================================================ */

// ============================================================
// SHIFT STATE
// ============================================================
const SHIFT = {
  current:    null,   // الوردية الحالية
  isOpen:     false,  // هل الوردية مفتوحة؟
  suspended:  [],     // الفواتير المعلقة
  payments:   [],     // دفعات الفاتورة الحالية (متعدد)

  get id()         { return this.current?.id || null; },
  get cashierId()  { return CURRENT_USER?.username || ''; },
  get cashierName(){ return CURRENT_USER?.name || CURRENT_USER?.username || ''; }
};

// ============================================================
// OPEN SHIFT
// ============================================================
async function openShift() {
  const cbId        = document.getElementById('shift-open-cb')?.value || '';
  const openingCash = parseFloat(document.getElementById('shift-opening-cash')?.value) || 0;
  const notes       = document.getElementById('shift-open-notes')?.value || '';

  if (!cbId) { toast('يرجى اختيار الخزينة','error'); return; }

  const shift = {
    id:            uid(),
    cashierId:     SHIFT.cashierId,
    cashierName:   SHIFT.cashierName,
    branchId:      BS.currentBranchId || '',
    branchName:    BS.currentBranch?.name || '',
    cbId,
    cbName:        S.cashboxes[cbId]?.name || '',
    openingCash,
    notes,
    status:        'open',
    openedAt:      new Date().toISOString(),
    date:          new Date().toISOString().split('T')[0],
    totalSales:    0,
    totalCash:     0,
    totalCard:     0,
    totalTransfer: 0,
    totalCredit:   0,
    salesCount:    0,
    returnsTotal:  0
  };

  try {
    await dbUpdate('shifts/' + shift.id, shift);
    SHIFT.current = shift;
    SHIFT.isOpen  = true;
    localStorage.setItem('ctg-shift-' + SHIFT.cashierId, shift.id);
    closeModal('modal-open-shift');
    updateShiftUI();
    if (typeof AL !== 'undefined') AL.record('shift_open', `فتح وردية — خزينة: ${shift.cbName}`, 'shifts');
    toast(`✅ تم فتح الوردية — ${shift.cashierName}`);
    nav('pos');
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
}

// ============================================================
// CLOSE SHIFT
// ============================================================
async function prepareCloseShift() {
  if (!SHIFT.isOpen || !SHIFT.current) { toast('لا توجد وردية مفتوحة','error'); return; }
  const sh = SHIFT.current;

  // احسب إجمالي المبيعات في الوردية
  const shiftSales = Object.values(S.sales).filter(s => s.shiftId === sh.id);
  const totalSales = shiftSales.reduce((s,v) => s+(v.total||0), 0);
  const cashSales  = shiftSales.filter(s => s.paymentMethod==='cash').reduce((s,v) => s+(v.amountPaid||0), 0);
  const cardSales  = shiftSales.filter(s => s.paymentMethod==='card').reduce((s,v) => s+(v.amountPaid||0), 0);
  const trSales    = shiftSales.filter(s => s.paymentMethod==='transfer').reduce((s,v) => s+(v.amountPaid||0), 0);
  const creditSal  = shiftSales.filter(s => s.paymentMethod==='credit').reduce((s,v) => s+(v.total||0), 0);
  const returns    = Object.values(S.returns).filter(r => r.shiftId===sh.id && r.type==='sale').reduce((s,v) => s+(v.total||0), 0);

  const expectedCash = sh.openingCash + cashSales - returns;

  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set('cls-cashier',    sh.cashierName);
  set('cls-opened',     new Date(sh.openedAt).toLocaleString('ar-EG'));
  set('cls-total-sales',N(totalSales));
  set('cls-cash',       N(cashSales));
  set('cls-card',       N(cardSales));
  set('cls-transfer',   N(trSales));
  set('cls-credit',     N(creditSal));
  set('cls-returns',    N(returns));
  set('cls-sales-count',shiftSales.length);
  set('cls-expected-cash', N(expectedCash));

  const actualInput = document.getElementById('cls-actual-cash');
  if (actualInput) actualInput.value = '';
  document.getElementById('cls-diff').textContent = '—';
  document.getElementById('cls-notes').value = '';

  // Store for use in saveCloseShift
  SHIFT._closeData = { totalSales, cashSales, cardSales, trSales, creditSal, returns, expectedCash, shiftSales };
  openModal('modal-close-shift');
}

function calcCloseShiftDiff() {
  const actual   = parseFloat(document.getElementById('cls-actual-cash')?.value) || 0;
  const expected = SHIFT._closeData?.expectedCash || 0;
  const diff     = actual - expected;
  const el       = document.getElementById('cls-diff');
  if (el) {
    el.textContent = (diff >= 0 ? '+' : '') + N(diff) + ' EGP';
    el.style.color = diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--text2)';
  }
}

async function saveCloseShift() {
  if (!SHIFT.isOpen || !SHIFT.current) return;
  const actual     = parseFloat(document.getElementById('cls-actual-cash')?.value) || 0;
  const notes      = document.getElementById('cls-notes')?.value || '';
  const d          = SHIFT._closeData;
  const diff       = actual - d.expectedCash;

  const closedShift = {
    ...SHIFT.current,
    status:        'closed',
    closedAt:      new Date().toISOString(),
    totalSales:    d.totalSales,
    totalCash:     d.cashSales,
    totalCard:     d.cardSales,
    totalTransfer: d.trSales,
    totalCredit:   d.creditSal,
    returnsTotal:  d.returns,
    salesCount:    d.shiftSales.length,
    expectedCash:  d.expectedCash,
    actualCash:    actual,
    cashDiff:      diff,
    closeNotes:    notes
  };

  try {
    await dbUpdate('shifts/' + SHIFT.current.id, closedShift);
    localStorage.removeItem('ctg-shift-' + SHIFT.cashierId);
    SHIFT.current = null;
    SHIFT.isOpen  = false;
    closeModal('modal-close-shift');
    updateShiftUI();
    if (typeof AL !== 'undefined') AL.record('shift_close', `إغلاق وردية — مبيعات: ${N(d.totalSales)} EGP — فرق: ${N(diff)} EGP`, 'shifts');
    toast('✅ تم إغلاق الوردية بنجاح');
    // Print shift report
    if (confirm('طباعة تقرير الوردية؟')) printShiftReport(closedShift);
  } catch(e) { toast('خطأ: '+e.message,'error'); }
}

// ============================================================
// SHIFT UI
// ============================================================
function updateShiftUI() {
  const indicator = document.getElementById('shift-indicator');
  const openBtn   = document.getElementById('shift-open-btn');
  const closeBtn  = document.getElementById('shift-close-btn');
  const posWrap   = document.getElementById('pos-shift-lock');

  if (SHIFT.isOpen && SHIFT.current) {
    if (indicator) {
      indicator.style.display = 'flex';
      indicator.innerHTML = `
        <span style="width:8px;height:8px;border-radius:50%;background:var(--green);animation:_pulse 1.5s infinite;flex-shrink:0;"></span>
        <span style="font-size:11px;font-weight:700;color:var(--green);">${SHIFT.current.cashierName}</span>
        <span style="font-size:10px;color:var(--text2);">${new Date(SHIFT.current.openedAt).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</span>`;
    }
    if (openBtn)  openBtn.style.display  = 'none';
    if (closeBtn) closeBtn.style.display = '';
    if (posWrap)  posWrap.style.display  = 'none';
  } else {
    if (indicator) indicator.style.display = 'none';
    if (openBtn)   openBtn.style.display   = '';
    if (closeBtn)  closeBtn.style.display  = 'none';
    // Block POS if shift required
    const requireShift = S.settings?.requireShift !== false;
    if (posWrap && requireShift) posWrap.style.display = '';
  }
}

async function checkOpenShift() {
  const savedId = localStorage.getItem('ctg-shift-' + SHIFT.cashierId);
  if (!savedId || !DB) return;
  return new Promise(res => {
    FB.$onValue(FB.$ref(DB, getBranchPath('shifts/' + savedId)), snap => {
      const sh = snap.val();
      if (sh && sh.status === 'open') {
        SHIFT.current = {...sh, id: savedId};
        SHIFT.isOpen  = true;
        updateShiftUI();
        toast(`وردية مفتوحة: ${sh.cashierName}`, 'info');
      }
      res();
    }, {onlyOnce: true});
  });
}

function openShiftModal() {
  fillCashboxSelects();
  const cbSel = document.getElementById('shift-open-cb');
  if (cbSel && Object.keys(S.cashboxes).length) cbSel.value = Object.keys(S.cashboxes)[0];
  document.getElementById('shift-opening-cash').value = '0';
  document.getElementById('shift-open-notes').value   = '';
  openModal('modal-open-shift');
}

// ============================================================
// MULTI-PAYMENT SYSTEM
// ============================================================
function initMultiPayment() {
  SHIFT.payments = [];
  renderPaymentRows();
  updatePaymentRemaining();
}

function addPaymentRow() {
  SHIFT.payments.push({ method: 'cash', amount: 0, cbId: '' });
  renderPaymentRows();
}

function removePaymentRow(i) {
  SHIFT.payments.splice(i, 1);
  renderPaymentRows();
  updatePaymentRemaining();
}

function renderPaymentRows() {
  const wrap = document.getElementById('multi-pay-rows'); if (!wrap) return;
  wrap.innerHTML = SHIFT.payments.map((p, i) => `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 32px;gap:8px;align-items:center;margin-bottom:8px;">
      <select class="fc" style="font-size:12px;" onchange="SHIFT.payments[${i}].method=this.value;renderPaymentRows()">
        ${['cash','card','transfer','credit','check'].map(m =>
          `<option value="${m}" ${p.method===m?'selected':''}>${PAY_NAMES[m]||m}</option>`
        ).join('')}
      </select>
      <input class="fc" type="number" min="0" step="0.01" placeholder="المبلغ"
        value="${p.amount||''}" style="font-size:12px;"
        oninput="SHIFT.payments[${i}].amount=+this.value;updatePaymentRemaining()">
      <select class="fc" style="font-size:12px;" onchange="SHIFT.payments[${i}].cbId=this.value">
        <option value="">-- خزينة --</option>
        ${Object.entries(S.cashboxes).map(([id,cb]) =>
          `<option value="${id}" ${p.cbId===id?'selected':''}>${cb.name}</option>`
        ).join('')}
      </select>
      <button class="btn btn-danger btn-xs" onclick="removePaymentRow(${i})"><i class="fas fa-times"></i></button>
    </div>`).join('');
}

function updatePaymentRemaining() {
  const {total} = calcCart();
  const paid    = SHIFT.payments.reduce((s,p) => s + (+p.amount||0), 0);
  const rem     = total - paid;
  const remEl   = document.getElementById('multi-pay-remaining');
  const paidEl  = document.getElementById('multi-pay-paid');
  if (remEl) {
    remEl.textContent = N(Math.abs(rem)) + ' EGP';
    remEl.style.color = rem <= 0 ? 'var(--green)' : 'var(--red)';
    const label = document.getElementById('multi-pay-remaining-label');
    if (label) label.textContent = rem <= 0 ? (rem < 0 ? 'باقي للعميل:' : 'مدفوع بالكامل') : 'متبقي:';
  }
  if (paidEl) paidEl.textContent = N(paid) + ' EGP';
}

function openMultiPayment() {
  if (!cart.length) { toast('السلة فارغة','error'); return; }
  const {total} = calcCart();
  initMultiPayment();
  // Add default cash payment
  SHIFT.payments = [{method:'cash', amount: total, cbId: Object.keys(S.cashboxes)[0]||''}];
  renderPaymentRows();
  updatePaymentRemaining();
  document.getElementById('mp-total').textContent = N(total) + ' EGP';
  openModal('modal-multi-payment');
}

async function completeMultiPayment() {
  if (!cart.length) { toast('السلة فارغة','error'); return; }
  const {sub, dv, tv, total} = calcCart();
  const payments = SHIFT.payments.filter(p => p.amount > 0);
  if (!payments.length) { toast('أدخل طريقة دفع واحدة على الأقل','error'); return; }

  const totalPaid = payments.reduce((s,p) => s+(+p.amount||0), 0);
  const balance   = Math.max(0, total - totalPaid);

  // Build sale data
  const custWrap    = document.getElementById('pos-cust-wrap');
  const custId      = custWrap?.querySelector('input[type=hidden]')?.value || '';
  const saleData    = {
    date:          new Date().toISOString(),
    custId, customerId: custId,
    custName:      custId ? (S.customers[custId]?.name||'نقدي') : 'عميل نقدي',
    customerName:  custId ? (S.customers[custId]?.name||'نقدي') : 'عميل نقدي',
    items:         cart.map(i => ({
      prodId:i.prodId, name:i.name, desc:i.desc||'',
      serial:S.products[i.prodId]?.serial||'',
      qty:i.qty, price:i.price, cost:i.cost, whId:i.whId
    })),
    subtotal: sub, discount: dv, tax: tv, total,
    amountPaid: totalPaid, amtPaid: totalPaid, balance,
    payments:   payments.map(p => ({method:p.method, amount:p.amount, cbId:p.cbId})),
    paymentMethod: payments[0].method,
    cashboxId:  payments[0].cbId||'',
    warehouseId:cart[0]?.whId||'', whId: cart[0]?.whId||'',
    notes:      document.getElementById('pos-notes')?.value||'',
    status:     totalPaid >= total ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid',
    shiftId:    SHIFT.id||'',
    soldBy:     SHIFT.cashierName || getCU(),
    createdBy:  getCU(), createdAt: new Date().toISOString()
  };

  try {
    const saleId = uid();
    await dbUpdate('sales/' + saleId, saleData);

    // Update stock
    for (const it of cart) {
      const p = S.products[it.prodId];
      if (p) {
        await dbUpdate('products/'+it.prodId, {qty: Math.max(0,(+p.qty||0)-it.qty)});
        await INV.record('out', it.prodId, it.qty, it.whId, '#'+saleId.slice(-6), 'مبيعات POS', it.cost);
      }
    }

    // Update customer balance
    if (custId) {
      const c = S.customers[custId];
      await dbUpdate('customers/'+custId, {
        totalBuy: (+c.totalBuy||0) + total,
        balance:  (+c.balance||0) + balance
      });
    }

    // Deposit to cashboxes
    for (const p of payments) {
      if (p.cbId && p.amount > 0 && p.method !== 'credit') {
        await addCashboxEntry(p.cbId, p.amount, 'deposit',
          `مبيعات POS - ${saleData.customerName}`, '#'+saleId.slice(-6).toUpperCase());
      }
    }

    // Update shift totals
    if (SHIFT.isOpen && SHIFT.current) {
      const cashTotal = payments.filter(p=>p.method==='cash').reduce((s,p)=>s+(+p.amount||0),0);
      const cardTotal = payments.filter(p=>p.method==='card').reduce((s,p)=>s+(+p.amount||0),0);
      const trTotal   = payments.filter(p=>p.method==='transfer').reduce((s,p)=>s+(+p.amount||0),0);
      const crTotal   = payments.filter(p=>p.method==='credit').reduce((s,p)=>s+(+p.amount||0),0);
      await dbUpdate('shifts/' + SHIFT.id, {
        totalSales:    (SHIFT.current.totalSales||0)    + total,
        totalCash:     (SHIFT.current.totalCash||0)     + cashTotal,
        totalCard:     (SHIFT.current.totalCard||0)     + cardTotal,
        totalTransfer: (SHIFT.current.totalTransfer||0) + trTotal,
        totalCredit:   (SHIFT.current.totalCredit||0)   + crTotal,
        salesCount:    (SHIFT.current.salesCount||0)    + 1
      });
      SHIFT.current.totalSales = (SHIFT.current.totalSales||0) + total;
      SHIFT.current.salesCount = (SHIFT.current.salesCount||0) + 1;
    }

    clearCart();
    closeModal('modal-multi-payment');
    document.getElementById('pos-notes').value = '';
    // Reset customer
    const wrap=document.getElementById('pos-cust-wrap');
    if (wrap) {
      const h=wrap.querySelector('input[type=hidden]'); const l=wrap.querySelector('.ss-label');
      if(h) h.value=''; if(l){l.textContent='عميل نقدي';l.style.color='var(--text3)';}
    }

    showInvoice({...saleData, id:saleId});
    if (typeof AL!=='undefined') AL.record('sale_created', `فاتورة #${saleId.slice(-6).toUpperCase()} — ${N(total)} EGP`, 'sales');
    toast('✅ تم البيع بنجاح');
  } catch(e) { toast('خطأ: '+e.message,'error'); }
}

// ============================================================
// SUSPENDED INVOICES
// ============================================================
function suspendInvoice() {
  if (!cart.length) { toast('السلة فارغة','error'); return; }
  const custWrap = document.getElementById('pos-cust-wrap');
  const custId   = custWrap?.querySelector('input[type=hidden]')?.value||'';
  const custName = custId?(S.customers[custId]?.name||'نقدي'):'عميل نقدي';
  const {total}  = calcCart();
  const susp     = {
    id:        uid(),
    items:     [...cart],
    custId, custName, total,
    disc:      document.getElementById('pos-disc')?.value||'0',
    discType:  document.getElementById('pos-disc-type')?.value||'percent',
    tax:       document.getElementById('pos-tax')?.value||'0',
    taxType:   document.getElementById('pos-tax-type')?.value||'percent',
    notes:     document.getElementById('pos-notes')?.value||'',
    suspendedAt: new Date().toISOString()
  };
  SHIFT.suspended.push(susp);
  clearCart();
  renderSuspendedList();
  toast(`تم تعليق الفاتورة — ${custName} (${N(total)} EGP)`, 'info');
}

function renderSuspendedList() {
  const wrap = document.getElementById('suspended-list'); if (!wrap) return;
  const btn  = document.getElementById('pos-suspended-btn');
  if (btn) {
    const count = SHIFT.suspended.length;
    btn.style.display = count > 0 ? '' : 'none';
    btn.innerHTML = `<i class="fas fa-pause-circle"></i> معلق (${count})`;
  }
  wrap.innerHTML = SHIFT.suspended.length
    ? SHIFT.suspended.map((s,i) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--card2);border-radius:9px;margin-bottom:7px;border:1px solid var(--border2);">
        <div>
          <div style="font-size:13px;font-weight:700;">👤 ${s.custName}</div>
          <div style="font-size:11px;color:var(--text2);">${s.items.length} منتجات — ${new Date(s.suspendedAt).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <strong style="color:var(--accent);">${N(s.total)} EGP</strong>
          <button class="btn btn-primary btn-xs" onclick="resumeInvoice(${i})"><i class="fas fa-play"></i> استئناف</button>
          <button class="btn btn-danger btn-xs" onclick="deleteSuspended(${i})"><i class="fas fa-trash"></i></button>
        </div>
      </div>`).join('')
    : '<div style="text-align:center;color:var(--text2);padding:20px;font-size:12px;">لا توجد فواتير معلقة</div>';
}

function resumeInvoice(i) {
  const susp = SHIFT.suspended[i]; if (!susp) return;
  if (cart.length && !confirm('سيتم استبدال السلة الحالية. متابعة؟')) return;
  cart = [...susp.items];
  // Restore customer
  const wrap = document.getElementById('pos-cust-wrap');
  if (wrap && susp.custId) {
    const h=wrap.querySelector('input[type=hidden]'); const l=wrap.querySelector('.ss-label');
    if(h) h.value=susp.custId; if(l){l.textContent=susp.custName;l.style.color='var(--text)';}
  }
  // Restore discount/tax
  const discEl     = document.getElementById('pos-disc');
  const discTypeEl = document.getElementById('pos-disc-type');
  const taxEl      = document.getElementById('pos-tax');
  const taxTypeEl  = document.getElementById('pos-tax-type');
  if (discEl)     discEl.value     = susp.disc||'0';
  if (discTypeEl) discTypeEl.value = susp.discType||'percent';
  if (taxEl)      taxEl.value      = susp.tax||'0';
  if (taxTypeEl)  taxTypeEl.value  = susp.taxType||'percent';
  const notesEl = document.getElementById('pos-notes');
  if (notesEl) notesEl.value = susp.notes||'';

  SHIFT.suspended.splice(i, 1);
  renderCart();
  renderSuspendedList();
  closeModal('modal-suspended');
  toast('تم استئناف الفاتورة ✅');
}

function deleteSuspended(i) {
  if (!confirm('حذف هذه الفاتورة المعلقة؟')) return;
  SHIFT.suspended.splice(i, 1);
  renderSuspendedList();
}

function openSuspendedModal() {
  renderSuspendedList();
  openModal('modal-suspended');
}

// ============================================================
// SHIFT REPORT
// ============================================================
function printShiftReport(sh) {
  const st    = S.settings;
  const dur   = sh.closedAt ? Math.round((new Date(sh.closedAt)-new Date(sh.openedAt))/60000) : 0;
  const hours = Math.floor(dur/60); const mins = dur%60;
  const html  = `<!DOCTYPE html><html dir="rtl" lang="ar">
  <head><meta charset="UTF-8"><title>تقرير الوردية</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
  <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Cairo,Arial,sans-serif;direction:rtl;color:#000;background:#fff;padding:10mm;}
  h1{font-size:20px;font-weight:900;text-align:center;border-bottom:3px solid #000;padding-bottom:8px;margin-bottom:16px;}
  .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #ddd;font-size:13px;}
  .lbl{color:#555;}.val{font-weight:700;}
  .total-row{display:flex;justify-content:space-between;padding:10px 0;font-size:16px;font-weight:900;border-top:3px solid #000;margin-top:8px;}
  .diff-ok{color:green;}.diff-bad{color:red;}
  @page{size:A5 portrait;margin:8mm;}</style></head>
  <body>
    <h1>تقرير الوردية — ${st.company||'الشمس'}</h1>
    <div class="row"><span class="lbl">الكاشير:</span><span class="val">${sh.cashierName}</span></div>
    <div class="row"><span class="lbl">الفرع:</span><span class="val">${sh.branchName||'—'}</span></div>
    <div class="row"><span class="lbl">فتح الوردية:</span><span class="val">${new Date(sh.openedAt).toLocaleString('ar-EG')}</span></div>
    <div class="row"><span class="lbl">إغلاق الوردية:</span><span class="val">${sh.closedAt?new Date(sh.closedAt).toLocaleString('ar-EG'):'—'}</span></div>
    <div class="row"><span class="lbl">مدة الوردية:</span><span class="val">${hours} ساعة ${mins} دقيقة</span></div>
    <div class="row"><span class="lbl">عدد الفواتير:</span><span class="val">${sh.salesCount||0}</span></div>
    <div style="margin:12px 0 8px;font-size:13px;font-weight:700;border-bottom:2px solid #000;padding-bottom:4px;">طرق الدفع</div>
    <div class="row"><span class="lbl">نقدي:</span><span class="val">${N(sh.totalCash||0)} EGP</span></div>
    <div class="row"><span class="lbl">بطاقة:</span><span class="val">${N(sh.totalCard||0)} EGP</span></div>
    <div class="row"><span class="lbl">تحويل:</span><span class="val">${N(sh.totalTransfer||0)} EGP</span></div>
    <div class="row"><span class="lbl">آجل:</span><span class="val">${N(sh.totalCredit||0)} EGP</span></div>
    <div class="row"><span class="lbl">مرتجعات:</span><span class="val">${N(sh.returnsTotal||0)} EGP</span></div>
    <div class="total-row"><span>إجمالي المبيعات:</span><span>${N(sh.totalSales||0)} EGP</span></div>
    <div style="margin:12px 0 8px;font-size:13px;font-weight:700;border-bottom:2px solid #000;padding-bottom:4px;">تسوية الصندوق</div>
    <div class="row"><span class="lbl">رصيد الفتح:</span><span class="val">${N(sh.openingCash||0)} EGP</span></div>
    <div class="row"><span class="lbl">نقدي متوقع:</span><span class="val">${N(sh.expectedCash||0)} EGP</span></div>
    <div class="row"><span class="lbl">نقدي فعلي:</span><span class="val">${N(sh.actualCash||0)} EGP</span></div>
    <div class="row"><span class="lbl">الفرق:</span><span class="val ${(sh.cashDiff||0)>=0?'diff-ok':'diff-bad'}">${(sh.cashDiff||0)>=0?'+':''}${N(sh.cashDiff||0)} EGP</span></div>
    ${sh.closeNotes?`<div style="margin-top:12px;font-size:11px;color:#555;">ملاحظات: ${sh.closeNotes}</div>`:''}
    <div style="margin-top:20px;text-align:center;font-size:11px;color:#555;">— ${st.company} | ${st.phone||''} —</div>
    <script>window.onload=()=>window.print();<\/script>
  </body></html>`;
  const w = window.open('','_blank','width=600,height=700');
  if (w) { w.document.write(html); w.document.close(); }
}

// ============================================================
// KEYBOARD SHORTCUTS (POS)
// ============================================================
document.addEventListener('keydown', e => {
  // Only active on POS page
  const posPage = document.getElementById('pg-pos');
  if (!posPage?.classList.contains('active')) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
    if (e.key === 'F1') { e.preventDefault(); document.getElementById('pos-scan-input')?.focus(); }
    return;
  }
  switch(e.key) {
    case 'F1':  e.preventDefault(); document.getElementById('pos-scan-input')?.focus(); break;
    case 'F2':  e.preventDefault(); openMultiPayment(); break;
    case 'F3':  e.preventDefault(); suspendInvoice(); break;
    case 'F4':  e.preventDefault(); openSuspendedModal(); break;
    case 'F5':  e.preventDefault(); clearCart(); break;
    case 'F9':  e.preventDefault(); if(SHIFT.isOpen) prepareCloseShift(); else openShiftModal(); break;
    case 'Escape': closeAllSS && closeAllSS(); break;
  }
});

// ============================================================
// RENDER SHIFTS TABLE
// ============================================================
function renderShifts() {
  const tbody = document.getElementById('shifts-tbl'); if (!tbody) return;
  FB.$onValue(FB.$ref(DB, getBranchPath('shifts')), snap => {
    const shifts = snap.val() || {};
    const rows   = Object.entries(shifts).sort(([,a],[,b]) => new Date(b.openedAt)-new Date(a.openedAt)).slice(0,50);
    tbody.innerHTML = rows.length
      ? rows.map(([id,sh]) => `<tr>
          <td style="font-size:11px;">${new Date(sh.openedAt).toLocaleDateString('ar-EG')}</td>
          <td><strong>${sh.cashierName}</strong></td>
          <td style="font-size:11px;">${new Date(sh.openedAt).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</td>
          <td style="font-size:11px;">${sh.closedAt?new Date(sh.closedAt).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}):'—'}</td>
          <td>${sh.salesCount||0}</td>
          <td style="color:var(--green);font-weight:700;">${N(sh.totalSales||0)}</td>
          <td style="color:var(--accent);">${N(sh.totalCash||0)}</td>
          <td style="color:${(sh.cashDiff||0)<0?'var(--red)':'var(--green)'};">${sh.cashDiff!==undefined?(sh.cashDiff>=0?'+':'')+N(sh.cashDiff):'—'}</td>
          <td><span class="badge ${sh.status==='open'?'badge-success':'badge-info'}">${sh.status==='open'?'مفتوح':'مغلق'}</span></td>
          <td><button class="btn btn-ghost btn-xs" onclick="printShiftReport(${JSON.stringify(sh).replace(/"/g,'&quot;')})"><i class="fas fa-print"></i></button></td>
        </tr>`).join('')
      : '<tr><td colspan="10" style="text-align:center;color:var(--text2);padding:20px;">لا توجد ورديات</td></tr>';
  }, {onlyOnce: true});
}

// Auto-restore shift on login
window.addEventListener('fbReady', () => {
  setTimeout(async () => {
    if (CURRENT_USER) await checkOpenShift();
  }, 2500);
}, {once: false});
