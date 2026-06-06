/* ============================================================
   sales.js — نقطة البيع + الفواتير + عرض الفاتورة
   الشمس - Al Shams ERP | المرحلة الأولى
   ============================================================ */

// ============================================================
// POS
// ============================================================
let cart = [];
let _scanTimer = null;

function handlePosSearch(val) {
  if (!val) return;
  clearTimeout(_scanTimer);
  _scanTimer = setTimeout(() => {
    const exactMatch = Object.entries(S.products).find(([,p]) => p.code && p.code === val.trim());
    if (exactMatch) { addToCart(exactMatch[0]); document.getElementById('pos-scan-input').value = ''; return; }
    renderPosGrid();
  }, 300);
}

document.addEventListener('DOMContentLoaded', () => {
  const scanInput = document.getElementById('pos-scan-input');
  if (scanInput) {
    scanInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const val = (scanInput.value||'').trim();
        if (!val) return;
        const match = Object.entries(S.products).find(([,p]) => p.code && p.code === val);
        if (match) { addToCart(match[0]); scanInput.value = ''; }
        else {
          const nameMatch = Object.entries(S.products).find(([,p]) => p.name?.toLowerCase().includes(val.toLowerCase()));
          if (nameMatch) { addToCart(nameMatch[0]); scanInput.value = ''; }
        }
      }
    });
  }
});

function renderPosGrid() {
  const grid   = document.getElementById('pos-grid'); if (!grid) return;
  const search = (document.getElementById('pos-scan-input')?.value||'').toLowerCase();
  const cat    = document.getElementById('pos-cat')?.value || '';
  const wh     = document.getElementById('pos-wh')?.value  || '';
  const prods  = Object.entries(S.products).filter(([,p]) =>
    (+p.qty||0) > 0 &&
    (!search || p.name?.toLowerCase().includes(search) || p.code?.toLowerCase().includes(search)) &&
    (!cat || p.cat === cat) && (!wh || p.whId === wh)
  );
  if (!prods.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text2);padding:32px;font-size:12px;"><i class="fas fa-box-open" style="font-size:28px;display:block;margin-bottom:8px;opacity:.4;"></i>لا توجد منتجات</div>';
    return;
  }
  grid.innerHTML = prods.map(([id,p]) => `
    <div class="pos-card" onclick="addToCart('${id}')">
      <span class="pos-card-icon">${getCatIcon(p.cat)}</span>
      <div class="pos-card-name">${p.name}</div>
      <div class="pos-card-price">${N(p.price)} EGP</div>
      <div class="pos-card-stock">مخزون: ${p.qty}</div>
    </div>`).join('');
}

function addToCart(prodId) {
  const p = S.products[prodId];
  if (!p || (+p.qty||0) <= 0) { toast('المنتج غير متاح','error'); return; }
  const ex = cart.find(i => i.prodId === prodId);
  if (ex) { if (ex.qty >= (+p.qty||0)) { toast('لا يوجد مخزون كافٍ','error'); return; } ex.qty++; }
  else cart.push({prodId, name:p.name, desc:p.desc||'', price:+p.price||0, qty:1, cost:+p.cost||0, whId:p.whId});
  renderCart();
  setTimeout(() => document.getElementById('pos-scan-input')?.focus(), 50);
}

function renderCart() {
  const countEl = document.getElementById('cart-count');
  if (countEl) countEl.textContent = cart.length + ' منتجات';
  const el = document.getElementById('cart-items');
  if (!el) return;
  if (!cart.length) {
    el.innerHTML = '<div style="text-align:center;padding:32px 16px;color:var(--text3);"><i class="fas fa-shopping-cart" style="font-size:36px;display:block;margin-bottom:12px;opacity:.3;"></i><div style="font-size:13px;font-weight:600;">السلة فارغة</div><div style="font-size:11px;margin-top:4px;">اضغط على أي منتج لإضافته</div></div>';
    calcCart(); return;
  }
  el.innerHTML = cart.map((it,i) => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name" title="${it.name}">${it.name}</div>
        <div class="cart-item-price">${N(it.price)} EGP × ${it.qty} = <strong style="color:var(--accent);font-size:13px;">${N(it.price*it.qty)} EGP</strong></div>
      </div>
      <div class="qty-ctrl">
        <button class="qty-btn" onclick="chQty(${i},-1)">−</button>
        <span class="qty-n">${it.qty}</span>
        <button class="qty-btn" onclick="chQty(${i},1)">+</button>
        <button class="qty-btn" onclick="rmCart(${i})" style="color:var(--red);font-weight:900;font-size:16px;">×</button>
      </div>
    </div>`).join('');
  calcCart();
}

function chQty(i, d) {
  const p = S.products[cart[i].prodId];
  cart[i].qty = Math.max(1, Math.min(cart[i].qty + d, +p?.qty||99));
  renderCart();
}
function rmCart(i)  { cart.splice(i, 1); renderCart(); }
function clearCart(){ cart = []; renderCart(); }

function calcCart() {
  const sub      = cart.reduce((s,i) => s + i.price * i.qty, 0);
  const discVal  = parseFloat(document.getElementById('pos-disc')?.value) || 0;
  const taxVal   = parseFloat(document.getElementById('pos-tax')?.value)  || 0;
  const discType = document.getElementById('pos-disc-type')?.value || 'percent';
  const taxType  = document.getElementById('pos-tax-type')?.value  || 'percent';
  const dv = discType==='fixed' ? Math.min(discVal,sub) : sub*discVal/100;
  const tv = taxType ==='fixed' ? taxVal                : (sub-dv)*taxVal/100;
  const total = sub - dv + tv;
  const s = id => document.getElementById(id);
  if (s('pos-sub'))    s('pos-sub').textContent    = N(sub)   + ' EGP';
  if (s('pos-disc-v')) s('pos-disc-v').textContent = '-' + N(dv) + ' EGP';
  if (s('pos-tax-v'))  s('pos-tax-v').textContent  = '+' + N(tv) + ' EGP';
  if (s('pos-total'))  s('pos-total').textContent  = N(total) + ' EGP';
  return {sub, dv, tv, total};
}

function calcChange() {
  const {total} = calcCart();
  const paid = parseFloat(document.getElementById('pos-paid')?.value) || 0;
  const row  = document.getElementById('change-row');
  if (paid > 0) { if(row) row.style.display='flex'; const v=document.getElementById('change-val'); if(v)v.textContent=N(paid-total)+' EGP'; }
  else { if(row) row.style.display='none'; }
}

async function completeSale() {
  if (!cart.length) { toast('السلة فارغة','error'); return; }
  const {sub, dv, tv, total} = calcCart();
  const custWrap  = document.getElementById('pos-cust-wrap');
  const custId    = custWrap ? (custWrap.querySelector('input[type=hidden]')?.value||'') : (document.getElementById('pos-cust')?.value||'');
  const payMethod = document.getElementById('pos-pay')?.value || 'cash';
  const paidInput = parseFloat(document.getElementById('pos-paid')?.value);
  const paid      = payMethod==='credit' ? 0 : (isNaN(paidInput) ? total : paidInput);
  const cbId      = document.getElementById('pos-cashbox')?.value || '';
  const saleData  = {
    date: new Date().toISOString(),
    custId, custName: custId?(S.customers[custId]?.name||'نقدي'):'عميل نقدي',
    customerName: custId?(S.customers[custId]?.name||'نقدي'):'عميل نقدي',
    customerId: custId,
    items: cart.map(i => ({prodId:i.prodId, name:i.name, desc:i.desc||'', serial:S.products[i.prodId]?.serial||'', qty:i.qty, price:i.price, cost:i.cost, whId:i.whId})),
    subtotal:sub, discount:dv, tax:tv, total, amountPaid:paid, amtPaid:paid,
    balance: Math.max(0, total-paid), paymentMethod:payMethod, payMethod,
    cashboxId:cbId, warehouseId:cart[0]?.whId||'', whId:cart[0]?.whId||'',
    notes: document.getElementById('pos-notes')?.value||'',
    status: paid>=total ? 'paid' : paid>0 ? 'partial' : 'unpaid',
    soldBy: S.settings['inv-salesman']||'مسؤول البيع',
    createdBy: getCU(), createdAt: new Date().toISOString()
  };
  try {
    const saleId = uid();
    await dbUpdate(`sales/${saleId}`, saleData);
    for (const it of cart) {
      const p = S.products[it.prodId];
      if (p) await dbUpdate(`products/${it.prodId}`, {qty: Math.max(0, (+p.qty||0)-it.qty)});
      await dbPush('movements', {date:new Date().toISOString(), product:it.name, type:'out', qty:it.qty, whId:it.whId, note:'مبيعات #'+saleId.slice(-6)});
    }
    if (custId) {
      const c = S.customers[custId];
      await dbUpdate(`customers/${custId}`, {totalBuy:(+c.totalBuy||0)+total, balance:(+c.balance||0)+(total-paid)});
    }
    if (cbId && paid > 0 && payMethod !== 'credit') {
      await addCashboxEntry(cbId, paid, 'deposit', `مبيعات - ${saleData.customerName}`, '#'+saleId.slice(-6).toUpperCase());
    }
    clearCart();
    ['pos-notes','pos-paid'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    // Reset customer smart select
    const wrap = document.getElementById('pos-cust-wrap');
    if (wrap) {
      const h = wrap.querySelector('input[type=hidden]');
      const l = wrap.querySelector('.ss-label');
      if (h) h.value='';
      if (l) { l.textContent='عميل نقدي'; l.style.color='var(--text3)'; }
    }
    showInvoice({...saleData, id:saleId});
    toast('تم البيع بنجاح ✅');
  } catch(e) { toast(e.message, 'error'); }
}

// ============================================================
// SALES TABLE
// ============================================================
function renderSales() {
  const tbody  = document.getElementById('sales-tbl'); if (!tbody) return;
  const search = (document.getElementById('sales-search')?.value||'').toLowerCase();
  const status = document.getElementById('sales-status')?.value || '';
  const from   = document.getElementById('sales-from')?.value   || '';
  const to     = document.getElementById('sales-to')?.value     || '';
  const sales  = Object.entries(S.sales).filter(([,s]) => {
    const d = (s.date||'').split('T')[0];
    const name = (s.custName||s.customerName||'').toLowerCase();
    return (!search||name.includes(search)) && (!status||s.status===status) && (!from||d>=from) && (!to||d<=to);
  }).sort(([,a],[,b]) => new Date(b.date) - new Date(a.date));
  const stM = {paid:['badge-success','مدفوع'], partial:['badge-warning','جزئي'], unpaid:['badge-danger','غير مدفوع']};
  tbody.innerHTML = sales.length
    ? sales.map(([id,s]) => {
        const [cls,lbl] = stM[s.status] || ['badge-info',''];
        return `<tr>
          <td style="color:var(--accent);font-weight:700;">#${id.slice(-5).toUpperCase()}</td>
          <td style="font-size:11px;">${fDate(s.date)}</td>
          <td>${s.custName||s.customerName||'نقدي'}</td>
          <td>${S.warehouses[s.warehouseId||s.whId]?.name||'-'}</td>
          <td style="font-weight:700;">${N(s.total)} EGP</td>
          <td style="color:var(--green);">${N(s.amountPaid||s.amtPaid||0)} EGP</td>
          <td style="color:${(s.balance||0)>0?'var(--red)':'var(--text2)'};">${N(s.balance||0)} EGP</td>
          <td><span class="badge ${cls}">${lbl}</span></td>
          <td style="font-size:11px;color:var(--text2);">${s.createdBy||'-'}</td>
          <td style="white-space:nowrap;">
            <button class="btn btn-ghost btn-xs" onclick="viewSale('${id}')"><i class="fas fa-eye"></i></button>
            <button class="btn btn-xs" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red);opacity:.85;" onclick="openReturnFromInvoice('sale','${id}')"><i class="fas fa-undo-alt"></i></button>
            ${(s.balance||0)>0?`<button class="btn btn-success btn-xs" onclick="openPayDebt('sale','${id}','${id}')"><i class="fas fa-hand-holding-usd"></i></button>`:''}
            <button class="btn btn-danger btn-xs" onclick="delSale('${id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="10" style="text-align:center;color:var(--text2);padding:20px;">لا توجد فواتير</td></tr>';
}
function viewSale(id, pdf=false) { const s=S.sales[id]; if(s) showInvoice({...s,id}, pdf); }
async function delSale(id) { if(!confirm('حذف هذه الفاتورة؟'))return; await dbRemove('sales/'+id); toast('تم الحذف'); }

// ============================================================
// MANUAL INVOICE
// ============================================================
let miItems = [{name:'',desc:'',qty:1,price:0}];

function openManualInvoice() {
  miItems = [{name:'',desc:'',qty:1,price:0}];
  document.getElementById('mi-date').value  = today();
  document.getElementById('mi-disc').value  = '0';
  document.getElementById('mi-tax').value   = '0';
  document.getElementById('mi-paid').value  = '0';
  updateWhSelects(); fillCashboxSelects();
  renderMiItems(); openModal('modal-manual');
  // Reset smart selects
  setTimeout(() => {
    ['mi-cust-wrap','mi-wh-wrap'].forEach(wid => {
      const wrap = document.getElementById(wid); if (!wrap) return;
      const h = wrap.querySelector('input[type=hidden]');
      const l = wrap.querySelector('.ss-label');
      if (h) h.value='';
      if (l) { l.textContent = wid.includes('cust') ? 'عميل نقدي' : '-- اختر مخزن --'; l.style.color='var(--text3)'; }
    });
  }, 100);
}

function addMiItem()  { miItems.push({name:'',desc:'',qty:1,price:0}); renderMiItems(); }
function removeMiItem(i) { miItems.splice(i,1); renderMiItems(); }

function renderMiItems() {
  document.getElementById('mi-items-list').innerHTML = miItems.map((item,i) => `
    <div style="display:grid;grid-template-columns:1fr 1fr 70px 110px 30px;gap:7px;margin-bottom:7px;align-items:center;">
      <input class="fc" placeholder="اسم المنتج/الخدمة *" value="${item.name}" oninput="miItems[${i}].name=this.value" style="font-weight:600;">
      <input class="fc" placeholder="الوصف/المواصفات" value="${item.desc||''}" oninput="miItems[${i}].desc=this.value" style="font-size:12px;">
      <input class="fc" type="number" placeholder="كمية" value="${item.qty}" min="1" oninput="miItems[${i}].qty=+this.value;calcMi()">
      <input class="fc" type="number" placeholder="السعر" value="${item.price}" min="0" step="0.01" oninput="miItems[${i}].price=+this.value;calcMi()">
      <button class="btn btn-danger btn-xs" onclick="removeMiItem(${i})"><i class="fas fa-times"></i></button>
    </div>`).join('');
  calcMi();
}

function calcMi() {
  const sub      = miItems.reduce((s,i) => s+(i.qty*i.price), 0);
  const disc     = parseFloat(document.getElementById('mi-disc')?.value) || 0;
  const tax      = parseFloat(document.getElementById('mi-tax')?.value)  || 0;
  const discAmt  = sub*disc/100;
  const taxAmt   = (sub-discAmt)*tax/100;
  const total    = sub - discAmt + taxAmt;
  const el = document.getElementById('mi-total');
  if (el) el.textContent = N(total) + ' EGP';
  return {sub, discAmt, taxAmt, total};
}

async function saveManualInvoice() {
  const {sub, discAmt, taxAmt, total} = calcMi();
  const custWrap = document.getElementById('mi-cust-wrap');
  const custId   = custWrap ? (custWrap.querySelector('input[type=hidden]')?.value||'') : (document.getElementById('mi-cust')?.value||'');
  const whWrap   = document.getElementById('mi-wh-wrap');
  const whId     = whWrap ? (whWrap.querySelector('input[type=hidden]')?.value||'') : (document.getElementById('mi-wh')?.value||'');
  const miPayMethod = document.getElementById('mi-pay').value;
  const miPaidInput = parseFloat(document.getElementById('mi-paid').value);
  const paid     = miPayMethod==='credit' ? 0 : (isNaN(miPaidInput) ? total : miPaidInput);
  const cbId     = document.getElementById('mi-cashbox')?.value || '';
  const saleData = {
    date:      document.getElementById('mi-date').value || new Date().toISOString(),
    customerId:custId, customerName:custId?(S.customers[custId]?.name||'نقدي'):'عميل نقدي',
    custName:  custId?(S.customers[custId]?.name||'نقدي'):'عميل نقدي',
    items: miItems, subtotal:sub, discount:discAmt, tax:taxAmt, total,
    amountPaid:paid, balance:Math.max(0,total-paid),
    paymentMethod:miPayMethod, warehouseId:whId, cashboxId:cbId,
    status: paid>=total?'paid':paid>0?'partial':'unpaid',
    soldBy: S.settings['inv-salesman']||'مسؤول البيع', type:'manual'
  };
  try {
    saleData.createdBy = getCU(); saleData.createdAt = new Date().toISOString();
    const r = await dbPush('sales', saleData);
    if (custId) { const c=S.customers[custId]; await dbUpdate('customers/'+custId,{totalBuy:(c.totalBuy||0)+total,balance:(c.balance||0)+Math.max(0,total-paid)}); }
    if (cbId && paid > 0 && miPayMethod !== 'credit') {
      await addCashboxEntry(cbId, paid, 'deposit', `مبيعات يدوية - ${saleData.customerName}`, '#'+r.key.slice(-6).toUpperCase());
    }
    closeModal('modal-manual');
    toast('تم حفظ الفاتورة');
    showInvoice({...saleData, id:r.key});
  } catch(e) { toast('خطأ: '+e.message,'error'); }
}

// ============================================================
// INVOICE DISPLAY
// ============================================================
function showInvoice(sale, exportPdf=false) {
  const st = S.settings;
  const ivc  = (k,def) => st[k]!==undefined ? st[k] : def;
  const ivb  = (k)     => st[k]!==undefined ? st[k] : true;
  const items = (sale.items||[]).map(item => ({
    ...item,
    desc:   item.desc   !== undefined ? item.desc   : (S.products[item.prodId]?.desc||''),
    serial: item.serial !== undefined ? item.serial : (S.products[item.prodId]?.serial||'')
  }));
  const invNum    = sale.id ? sale.id.slice(-6).toUpperCase() : '------';
  const dateStr   = sale.date ? new Date(sale.date).toLocaleDateString('ar-EG') : '';
  const whName    = S.warehouses[sale.warehouseId||sale.whId]?.name || '-';
  const invTitle  = ivc('inv-title-text','فاتورة بيع');
  const invTitleSub = ivc('inv-title-sub','SALES INVOICE');
  const headerIcon= ivc('inv-header-icon','💻');
  const logoSrc   = st.invLogo||'';
  const logoSize  = (ivc('inv-logo-size',70))+'px';
  const fontSize  = ivc('inv-font-size','12')+'px';
  const salesman  = ivc('inv-salesman','');
  const billToLabel  = ivc('inv-bill-to-label','فاتورة إلى:');
  const termsLabel   = ivc('inv-terms-label','شروط البيع:');
  const summaryLabel = ivc('inv-summary-label','إجمالي الأمر');
  const paymentLabel = ivc('inv-payment-label','الدفع المقترح');
  const grandTotalLabel = ivc('inv-grandtotal-label','إجمالي الفاتورة');
  const colNameLbl = ivc('inv-col-name-label','الوصف');
  const colQtyLbl  = ivc('inv-col-qty-label','الكمية');
  const colPriceLbl= ivc('inv-col-price-label','السعر');
  const warrantyText   = ivc('inv-warranty-text','نقدم ضماناً ضد عيوب التصنيع');
  const returnText     = ivc('inv-return-text','يمكنكم استرجاع الجهاز خلال 14 يوم');
  const noWarrantyText = ivc('inv-nowarranty-text','الكسر أو التلف المادي — التعرض للسوائل');
  const footerText     = ivc('inv-footer-text','شكراً لتعاملكم معنا');
  const footerExtra    = ivc('inv-footer-extra','');
  const showSeq     = ivb('inv-col-seq');  const showName    = ivb('inv-col-name');
  const showWh      = ivb('inv-col-wh');   const showQty     = ivb('inv-col-qty');
  const showPrice   = ivb('inv-col-price');const showTotal   = ivb('inv-col-total');
  const showDisc    = ivb('inv-col-disc'); const showSerial  = ivb('inv-col-serial');
  const showWarranty= ivb('inv-show-warranty'); const showBank   = ivb('inv-show-bank');
  const showSalesman= ivb('inv-show-salesman'); const showNotes  = ivb('inv-show-notes');

  const thCols = [
    showSeq   ? `<th style="padding:9px 12px;text-align:right;font-weight:700;width:50px;border-bottom:2px solid #000;">تسلسل</th>` : '',
    showName  ? `<th style="padding:9px 12px;text-align:right;font-weight:700;border-bottom:2px solid #000;">${colNameLbl}</th>` : '',
    showWh    ? `<th style="padding:9px 12px;text-align:right;font-weight:700;width:90px;border-bottom:2px solid #000;">المخزن</th>` : '',
    showQty   ? `<th style="padding:9px 12px;text-align:right;font-weight:700;width:60px;border-bottom:2px solid #000;">${colQtyLbl}</th>` : '',
    showPrice ? `<th style="padding:9px 12px;text-align:right;font-weight:700;width:100px;border-bottom:2px solid #000;">${colPriceLbl}</th>` : '',
    showTotal ? `<th style="padding:9px 12px;text-align:right;font-weight:700;width:110px;border-bottom:2px solid #000;">الإجمالي</th>` : '',
    showDisc  ? `<th style="padding:9px 12px;text-align:right;font-weight:700;width:100px;border-bottom:2px solid #000;">قيمة الخصم</th>` : '',
    showSerial? `<th style="padding:9px 12px;text-align:right;font-weight:700;width:80px;border-bottom:2px solid #000;">المسلسلات</th>` : ''
  ].join('');

  const custPhone = (() => { const cid=sale.customerId||sale.custId; return cid&&S.customers[cid]?.phone?S.customers[cid].phone:sale.custPhone||'-'; })();

  const html = `
  <div id="inv-content" style="direction:rtl;font-family:'Cairo',Arial,sans-serif;background:#fff;color:#000;padding:0;font-size:${fontSize};max-width:800px;margin:0 auto;border:1px solid #ddd;">
    <div style="background:#fff;color:#000;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #000;">
      <div style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;">
        ${logoSrc
          ? `<img src="${logoSrc}" style="width:${logoSize};height:${logoSize};object-fit:contain;border-radius:8px;">`
          : `<div style="width:${logoSize};height:${logoSize};border:2px solid #000;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:${parseInt(logoSize)*0.5}px;background:#fff;">${headerIcon}</div>`}
        <div><div style="font-size:15px;font-weight:900;">${st.company||'الشمس'}</div><div style="font-size:10px;">${st.web||''} | 📞 ${st.phone||''}</div></div>
      </div>
      <div style="text-align:left;"><div style="font-size:22px;font-weight:900;letter-spacing:1px;">${invTitle}</div><div style="font-size:10px;">${invTitleSub}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:2px solid #000;background:#fff;">
      <div style="padding:12px 20px;border-left:1px solid #ddd;">
        <table style="width:100%;font-size:11px;border-collapse:collapse;">
          <tr><td style="color:#000;width:130px;padding:2px 0;">اسم الشركة:</td><td style="font-weight:700;">${st.company||'الشمس'}</td></tr>
          <tr><td style="color:#000;padding:2px 0;">العنوان:</td><td>${st.addr||'-'}</td></tr>
          <tr><td style="color:#000;padding:2px 0;">الهاتف:</td><td>${st.phone||''}</td></tr>
        </table>
      </div>
      <div style="padding:12px 20px;">
        <table style="width:100%;font-size:11px;border-collapse:collapse;">
          <tr><td style="color:#000;width:100px;padding:2px 0;">${billToLabel}</td><td style="font-weight:700;">${sale.customerName||sale.custName||'عميل نقدي'}</td></tr>
          <tr><td style="color:#000;padding:2px 0;">رقم العميل:</td><td>${sale.customerId||sale.custId?((sale.customerId||sale.custId).slice(-6).toUpperCase()):'-'}</td></tr>
          <tr><td style="color:#000;padding:2px 0;">هاتف العميل:</td><td style="font-weight:700;">📞 ${custPhone}</td></tr>
        </table>
      </div>
    </div>
    <div style="background:#f9f5f0;padding:8px 20px;border-bottom:1px solid #ddd;">
      <table style="width:100%;font-size:10.5px;border-collapse:collapse;"><tr>
        <td style="padding:2px 8px 2px 0;"><span style="color:#000;">مخزن/نقطة بيع: </span><strong>${whName}</strong></td>
        <td style="padding:2px 8px;"><span>كود الأمر: </span><strong>#${invNum}</strong></td>
        <td style="padding:2px 8px;"><span>التاريخ: </span><strong>${dateStr}</strong></td>
        <td style="padding:2px 0 2px 8px;"><span>العملة: </span><strong>${st.curr||'EGP'}</strong></td>
      </tr></table>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead><tr style="background:#fff;border-bottom:2px solid #000;border-top:1px solid #000;">${thCols}</tr></thead>
      <tbody>${items.map((item,i) => `<tr style="background:${i%2===0?'#fff':'#faf6f1'};border-bottom:1px solid #e0d5c8;">
        ${showSeq   ?`<td style="padding:8px 12px;">${i+1}</td>`:''}
        ${showName  ?`<td style="padding:8px 12px;font-weight:600;">${item.name}${item.desc?`<br><span style="font-weight:400;font-size:10px;">${item.desc}</span>`:''}</td>`:''}
        ${showWh    ?`<td style="padding:8px 12px;">${whName}</td>`:''}
        ${showQty   ?`<td style="padding:8px 12px;">${item.qty}</td>`:''}
        ${showPrice ?`<td style="padding:8px 12px;">${N(item.price)} ${st.curr||'EGP'}</td>`:''}
        ${showTotal ?`<td style="padding:8px 12px;font-weight:700;">${N((item.price||0)*(item.qty||0))} ${st.curr||'EGP'}</td>`:''}
        ${showDisc  ?`<td style="padding:8px 12px;color:#c00;">${(()=>{const it=(item.price||0)*(item.qty||0);const sub=sale.subtotal||sale.total;const d=sale.discount||0;if(!d||!sub)return '-';const id2=it/sub*d;return id2>0?'- '+N(id2):'-';})()}</td>`:''}
        ${showSerial?`<td style="padding:8px 12px;font-size:10px;">${item.serial||'-'}</td>`:''}
      </tr>`).join('')}</tbody>
    </table>
    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:2px solid #000;background:#fff;">
      <div style="padding:14px 20px;border-left:1px solid #ddd;">
        ${showSalesman?`<div style="font-size:11px;margin-bottom:5px;"><span>مسؤول البيع: </span><strong>${salesman}</strong></div>`:''}
        <div style="font-size:11px;margin-bottom:5px;"><span>طريقة الدفع: </span><strong>${PAY_NAMES[sale.paymentMethod]||sale.paymentMethod||'-'}</strong></div>
        ${showNotes&&sale.notes?`<div style="font-size:11px;margin-bottom:5px;">ملاحظات: ${sale.notes}</div>`:''}
        ${showBank?`<div style="margin-top:8px;font-size:10.5px;"><div style="font-weight:700;margin-bottom:3px;">${termsLabel}</div><div>البنك: ${st.bank||'-'}</div><div>سويفت: ${st.swift||'-'}</div><div>حساب: ${st.account||'-'}</div></div>`:''}
      </div>
      <div style="padding:14px 20px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div style="background:#f9f5f0;border-radius:8px;padding:10px;border:1px solid #ddd;">
            <div style="font-size:11px;font-weight:700;margin-bottom:6px;">${summaryLabel}</div>
            <div style="font-size:11px;margin-bottom:2px;">الإجمالي: <strong>${N(sale.subtotal||sale.total)}</strong></div>
            <div style="font-size:11px;color:#c00;margin-bottom:2px;">الخصم: <strong>-${N(sale.discount||0)}</strong></div>
            <div style="font-size:11px;margin-bottom:2px;">بعد الخصم: <strong>${N((sale.subtotal||sale.total)-(sale.discount||0))}</strong></div>
            <div style="font-size:11px;color:#555;margin-bottom:2px;">الضريبة: <strong>+${N(sale.tax||0)}</strong></div>
            <div style="font-size:11px;font-weight:700;">الإجمالي النهائي: <strong>${N(sale.total)}</strong></div>
          </div>
          <div style="background:#f9f5f0;border-radius:8px;padding:10px;border:1px solid #ddd;">
            <div style="font-size:11px;font-weight:700;margin-bottom:6px;">${paymentLabel}</div>
            <div style="font-size:11px;margin-bottom:2px;">المدفوع: <strong>${N(sale.amountPaid||sale.amtPaid||0)} ${st.curr||'EGP'}</strong></div>
            <div style="font-size:11px;">المتبقي: <strong>${N(sale.balance||0)} ${st.curr||'EGP'}</strong></div>
          </div>
        </div>
        <div style="background:#fff;border:2px solid #000;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;">${grandTotalLabel}</div>
          <div style="font-size:22px;font-weight:900;">${N(sale.total)} ${st.curr||'EGP'}</div>
        </div>
      </div>
    </div>
    ${showWarranty?`<div style="border-top:2px solid #000;padding:12px 20px;background:#fdf8f0;"><div style="font-size:11px;font-weight:700;margin-bottom:6px;">شروط الضمان</div><div style="font-size:10px;line-height:1.9;"><strong>مدة الضمان:</strong> ${warrantyText} — مدة ${st.warranty||3} أشهر<br><strong>الاسترجاع:</strong> ${returnText}<br><strong>لا يشمل الضمان:</strong> ${noWarrantyText}</div></div>`:''}
    <div style="border-top:2px solid #000;padding:10px 20px;text-align:center;font-size:10.5px;"><strong>${footerText}</strong> | ${st.company||'الشمس'} | ${st.web||''} | 📞 ${st.phone||''}${footerExtra?'<br>'+footerExtra:''}</div>
  </div>`;

  if (exportPdf) {
    const invNum2 = sale.id ? sale.id.slice(-6).toUpperCase() : '------';
    const printWin = window.open('','_blank','width=900,height=700');
    if (!printWin) { toast('يرجى السماح بالنوافذ المنبثقة','error'); return; }
    printWin.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>فاتورة #${invNum2}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
      <style>*{margin:0;padding:0;box-sizing:border-box;}@page{size:A4 portrait;margin:10mm 8mm;}body{font-family:'Cairo',Arial,sans-serif;direction:rtl;background:#fff;}</style></head>
      <body>${html}<script>window.onload=function(){window.print();}<\/script></body></html>`);
    printWin.document.close();
    return;
  }

  const body = document.getElementById('inv-view-body');
  const area = document.getElementById('inv-print-area');
  if (body) body.innerHTML = html;
  if (area) area.innerHTML = html;
  openModal('modal-inv-view');
}

function printInvoice() { window.print(); }

function exportInvWord() {
  const content = document.getElementById('inv-content');
  if (!content) { toast('لا توجد فاتورة للتصدير','error'); return; }
  const st = S.settings;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><title>فاتورة</title><style>body{font-family:Arial,sans-serif;direction:rtl;}table{border-collapse:collapse;width:100%;}th,td{padding:6pt 10pt;text-align:right;}</style></head><body>${content.outerHTML}</body></html>`;
  const blob = new Blob(['\uFEFF'+html],{type:'application/msword;charset=utf-8'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='فاتورة-'+Date.now()+'.doc'; a.click();
  toast('✅ تم تصدير الفاتورة كـ Word');
}

function exportInvImage() {
  const content = document.getElementById('inv-content');
  if (!content) { toast('لا توجد فاتورة','error'); return; }
  toast('جاري تصدير الصورة...','info');
  html2canvas(content, {scale:2, useCORS:true, backgroundColor:'#ffffff', logging:false}).then(canvas => {
    const a = document.createElement('a'); a.download='invoice-'+Date.now()+'.png'; a.href=canvas.toDataURL('image/png'); a.click();
    toast('تم تصدير الصورة ✅');
  }).catch(e => toast('خطأ: '+e.message,'error'));
}

// Sequential invoice number
async function getNextInvNum() {
  const counter = S.settings.invCounter||0;
  const next = counter+1;
  await dbUpdate('settings', {invCounter:next});
  S.settings.invCounter = next;
  return `INV-${new Date().getFullYear()}-${String(next).padStart(4,'0')}`;
}

// Print reports
function printReports() {
  document.body.classList.add('printing-report');
  window.print();
  setTimeout(() => document.body.classList.remove('printing-report'), 1000);
}
