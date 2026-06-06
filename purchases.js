/* ============================================================
   purchases.js — المشتريات
   الشمس - Al Shams ERP | المرحلة الأولى
   ============================================================ */
let purItems = [{prodId:'',qty:1,price:0}];

function openAddPurchase() {
  purItems = [{prodId:'',qty:1,price:0}];
  document.getElementById('purf-date').value = today();
  fillCashboxSelects(); updateWhSelects();
  renderPurItems(); openModal('modal-purchase');
  setTimeout(() => {
    ['purf-sup-wrap','purf-wh-wrap'].forEach(wid => {
      const wrap=document.getElementById(wid); if(!wrap)return;
      const h=wrap.querySelector('input[type=hidden]'); const l=wrap.querySelector('.ss-label');
      if(h)h.value='';
      if(l){l.textContent=wid.includes('sup')?'-- اختر مورد --':'-- اختر مخزن --';l.style.color='var(--text3)';}
    });
  },100);
}

function addPurItem() { purItems.push({prodId:'',qty:1,price:0}); renderPurItems(); }

function renderPurItems() {
  document.getElementById('pur-items-list').innerHTML = purItems.map((item,i) => {
    const prod = S.products[item.prodId];
    return `<div style="display:grid;grid-template-columns:1fr 80px 130px 32px;gap:7px;margin-bottom:8px;align-items:center;">
      <div class="smart-select-wrap" id="pur-prod-wrap-${i}">
        <div class="smart-select-box fc" onclick="openSmartSelect('pur-prod-wrap-${i}','products','اختر منتجاً',function(id,l){purItems[${i}].prodId=id;autoFillPurPrice(${i});})" tabindex="0" style="font-size:12px;padding:6px 10px;">
          <span class="ss-icon" style="font-size:13px;">${prod?'📦':'🔍'}</span>
          <span class="ss-label" style="font-size:12px;">${prod?prod.name:'-- اختر منتج --'}</span>
          <i class="fas fa-chevron-down ss-arrow"></i>
        </div>
        <input type="hidden" id="pur-prod-${i}" value="${item.prodId}">
      </div>
      <input class="fc" type="number" placeholder="كمية" value="${item.qty}" min="1" style="font-size:12px;" oninput="purItems[${i}].qty=+this.value;calcPurTotal()">
      <input class="fc" type="number" placeholder="سعر الشراء" value="${item.price}" min="0" step="0.01" style="font-size:12px;" oninput="purItems[${i}].price=+this.value;calcPurTotal()">
      <button class="btn btn-danger btn-xs" onclick="purItems.splice(${i},1);renderPurItems()"><i class="fas fa-times"></i></button>
    </div>`;
  }).join('');
  calcPurTotal();
}

function autoFillPurPrice(i) {
  const h = document.getElementById('pur-prod-'+i);
  if (h && h.value) purItems[i].prodId = h.value;
  const p = S.products[purItems[i].prodId];
  if (p) purItems[i].price = p.cost||0;
  renderPurItems();
}

function calcPurTotal() {
  const t    = purItems.reduce((s,i) => s+(i.qty*i.price), 0);
  const paid = parseFloat(document.getElementById('purf-paid')?.value)||0;
  const tv   = document.getElementById('pur-total-val');   if(tv)   tv.textContent   = N(t);
  const bv   = document.getElementById('pur-balance-val'); if(bv)   bv.textContent   = N(Math.max(0,t-paid));
}
function calcPurBalance() { calcPurTotal(); }

async function savePurchase() {
  const supWrap = document.getElementById('purf-sup-wrap');
  const supId   = supWrap ? (supWrap.querySelector('input[type=hidden]')?.value||'') : (document.getElementById('purf-sup')?.value||'');
  const whWrap  = document.getElementById('purf-wh-wrap');
  const whId    = whWrap ? (whWrap.querySelector('input[type=hidden]')?.value||'') : (document.getElementById('purf-wh')?.value||'');
  purItems.forEach((item,i) => { const h=document.getElementById('pur-prod-'+i); if(h&&h.value) item.prodId=h.value; });
  const supName = supId ? (S.suppliers[supId]?.name||supId) : 'مورد غير محدد';
  if (!supId) { toast('يرجى اختيار المورد','error'); return; }
  if (!whId)  { toast('يرجى اختيار المخزن','error'); return; }
  const valid = purItems.filter(i => i.prodId && i.qty>0);
  if (!valid.length) { toast('يرجى إضافة منتجات','error'); return; }
  const total   = valid.reduce((s,i) => s+i.qty*i.price, 0);
  const paid    = parseFloat(document.getElementById('purf-paid').value)||0;
  const balance = Math.max(0, total-paid);
  const cbId    = document.getElementById('purf-cashbox')?.value||'';
  try {
    await dbPush('purchases', {
      createdBy:getCU(), date:document.getElementById('purf-date').value,
      supplierId:supId, supplier:supName, warehouseId:whId,
      paymentMethod:document.getElementById('purf-pay').value,
      amountPaid:paid, balance, cashboxId:cbId, items:valid, total,
      status:paid>=total?'paid':paid>0?'partial':'unpaid', createdAt:new Date().toISOString()
    });
    for (const item of valid) {
      const p = S.products[item.prodId];
      if (p) { await dbUpdate('products/'+item.prodId, {qty:(+p.qty||0)+item.qty}); await dbPush('movements',{date:new Date().toISOString(),product:p.name,type:'in',qty:item.qty,whId,note:'مشتريات - '+supName}); }
    }
    if (balance>0) { const sup=S.suppliers[supId]; await dbUpdate('suppliers/'+supId,{debt:(+sup?.debt||0)+balance,updatedAt:new Date().toISOString()}); }
    if (cbId&&paid>0&&document.getElementById('purf-pay').value!=='credit') { await addCashboxEntry(cbId,paid,'withdraw',`مشتريات من ${supName}`,'مشتريات'); }
    closeModal('modal-purchase'); toast('تم حفظ فاتورة الشراء');
  } catch(e) { toast('خطأ: '+e.message,'error'); }
}

function renderPurchases() {
  const q = (document.getElementById('pur-search')?.value||'').toLowerCase();
  const rows = Object.entries(S.purchases).filter(([,p])=>!q||p.supplier?.toLowerCase().includes(q)).sort(([,a],[,b])=>new Date(b.date)-new Date(a.date));
  document.getElementById('pur-tbl').innerHTML = rows.length
    ? rows.map(([id,p]) => {
        const[cls,lbl]={paid:['badge-success','مدفوع'],partial:['badge-warning','جزئي'],unpaid:['badge-danger','غير مدفوع']}[p.status]||['badge-info',''];
        return `<tr>
          <td style="color:var(--green);font-weight:700;">#${id.slice(-5).toUpperCase()}</td>
          <td>${p.date||'-'}</td><td><strong>${p.supplier}</strong></td>
          <td>${S.warehouses[p.warehouseId]?.name||'-'}</td>
          <td style="font-weight:700;">${N(p.total)} EGP</td>
          <td style="color:var(--green);">${N(p.amountPaid||0)} EGP</td>
          <td style="color:${(p.balance||0)>0?'var(--red)':'var(--text2)'};">${N(p.balance||0)} EGP</td>
          <td><span class="badge ${cls}">${lbl}</span> <span class="badge badge-purple">${PAY_NAMES[p.paymentMethod]||p.paymentMethod}</span></td>
          <td style="font-size:11px;color:var(--text2);">${p.createdBy||'-'}</td>
          <td style="white-space:nowrap;">
            <button class="btn btn-ghost btn-xs" onclick="viewPurchase('${id}')"><i class="fas fa-eye"></i></button>
            <button class="btn btn-xs" style="background:var(--red-bg);color:var(--red);border:1px solid var(--red);opacity:.85;" onclick="openReturnFromInvoice('purchase','${id}')"><i class="fas fa-undo-alt"></i></button>
            ${(p.balance||0)>0?`<button class="btn btn-success btn-xs" onclick="openPayDebt('pur','${id}','${id}')"><i class="fas fa-hand-holding-usd"></i></button>`:''}
            <button class="btn btn-danger btn-xs" onclick="delPurchase('${id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="10" style="text-align:center;color:var(--text2);padding:16px;">لا توجد مشتريات</td></tr>';
}
async function delPurchase(id) { if(!confirm('حذف؟'))return; await dbRemove('purchases/'+id); toast('تم الحذف'); }

function viewPurchase(id) {
  const p = S.purchases[id]; if (!p) { toast('لا توجد فاتورة','error'); return; }
  const st=S.settings; const sup=S.suppliers[p.supplierId]||{name:p.supplier||'-'};
  const wh=S.warehouses[p.warehouseId]||{name:'-'}; const invNum=id.slice(-6).toUpperCase();
  const html=`<div style="direction:rtl;font-family:Cairo,Arial,sans-serif;background:#fff;color:#111;padding:0;">
    <div style="background:#1a3a1a;color:#fff;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:10px;"><div style="width:40px;height:40px;background:linear-gradient(135deg,#3fb950,#00d4ff);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:20px;">🛒</div><div><div style="font-size:14px;font-weight:900;">${st.company||'الشمس'}</div><div style="font-size:10px;opacity:.8;">${st.web||''}</div></div></div>
      <div style="text-align:left;"><div style="font-size:20px;font-weight:900;">فاتورة شراء</div><div style="font-size:10px;opacity:.7;">PURCHASE INVOICE</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:2px solid #1a3a1a;">
      <div style="padding:12px 20px;border-left:1px solid #e0e0e0;"><table style="width:100%;font-size:11px;border-collapse:collapse;"><tr><td style="color:#666;width:130px;padding:2px 0;">الشركة:</td><td style="font-weight:700;">${st.company}</td></tr><tr><td style="color:#666;padding:2px 0;">المخزن:</td><td>${wh.name}</td></tr></table></div>
      <div style="padding:12px 20px;"><table style="width:100%;font-size:11px;border-collapse:collapse;"><tr><td style="color:#666;width:100px;padding:2px 0;">المورد:</td><td style="font-weight:700;">${sup.name}</td></tr><tr><td style="color:#666;padding:2px 0;">الهاتف:</td><td>${sup.phone||'-'}</td></tr></table></div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="background:#1a3a1a;color:#fff;"><th style="padding:9px 12px;text-align:right;">المنتج</th><th style="padding:9px 12px;text-align:right;">الكمية</th><th style="padding:9px 12px;text-align:right;">سعر الشراء</th><th style="padding:9px 12px;text-align:right;">الإجمالي</th></tr></thead>
    <tbody>${(p.items||[]).map((it,i)=>`<tr style="background:${i%2?'#f9f9f9':'#fff'};border-bottom:1px solid #eee;"><td style="padding:8px 12px;font-weight:600;">${S.products[it.prodId]?.name||it.prodId}</td><td style="padding:8px 12px;">${it.qty}</td><td style="padding:8px 12px;">${N(it.price)} EGP</td><td style="padding:8px 12px;font-weight:700;">${N(it.qty*it.price)} EGP</td></tr>`).join('')}</tbody></table>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px 20px;border-top:2px solid #1a3a1a;">
      <div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:10px;"><div style="font-weight:700;margin-bottom:6px;">تفاصيل الدفع</div><div>الإجمالي: <strong>${N(p.total)} EGP</strong></div><div>المدفوع: <strong style="color:var(--green);">${N(p.amountPaid||0)} EGP</strong></div><div>المتبقي: <strong style="color:${(p.balance||0)>0?'var(--red)':'var(--green)'};">${N(p.balance||0)} EGP</strong></div></div>
      <div style="background:#1a3a1a;border-radius:8px;padding:10px;color:#fff;text-align:center;"><div style="font-size:11px;opacity:.8;">الإجمالي</div><div style="font-size:20px;font-weight:900;">${N(p.total)} EGP</div></div>
    </div>
  </div>`;
  const body=document.getElementById('pur-view-body'); if(body) body.innerHTML=html;
  const area=document.getElementById('inv-print-area'); if(area) area.innerHTML=html;
  openModal('modal-pur-view');
}
