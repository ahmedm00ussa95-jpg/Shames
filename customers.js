/* ============================================================
   customers.js — إدارة العملاء + البحث الشامل
   الشمس - Al Shams ERP | المرحلة الأولى
   ============================================================ */

let editingCust = null;

async function saveCustomer() {
  const name  = (document.getElementById('cf-name').value||'').trim();
  if (!name) { toast('يرجى إدخال الاسم','error'); return; }
  const phone = (document.getElementById('cf-phone').value||'').trim();
  const allCusts = Object.entries(S.customers);
  if (phone) {
    const dupPhone = allCusts.find(([id,c]) => c.phone===phone && id!==editingCust);
    if (dupPhone) { toast('رقم الهاتف '+phone+' مستخدم بالفعل للعميل: '+dupPhone[1].name,'error'); return; }
  }
  const dupName = allCusts.find(([id,c]) => c.name===name && id!==editingCust);
  if (dupName) toast('تنبيه: الاسم "'+name+'" موجود بالفعل','info');
  const data = {name, phone, email:document.getElementById('cf-email').value.trim(), addr:document.getElementById('cf-addr').value.trim(), notes:document.getElementById('cf-notes').value.trim(), updatedAt:new Date().toISOString(), updatedBy:getCU()};
  const path = editingCust ? `customers/${editingCust}` : `customers/${uid()}`;
  if (!editingCust) { data.createdAt=new Date().toISOString(); data.totalBuy=0; data.balance=0; }
  await dbUpdate(path, data)
    .then(() => { closeModal('modal-customer'); toast('تم حفظ العميل'); editingCust=null; })
    .catch(e => toast(e.message,'error'));
}

function renderCustomers() {
  const tbody  = document.getElementById('cust-tbl'); if (!tbody) return;
  const search = (document.getElementById('cust-search')?.value||'').toLowerCase();
  const custs  = Object.entries(S.customers).filter(([,c]) => !search || c.name?.toLowerCase().includes(search) || c.phone?.includes(search));
  tbody.innerHTML = custs.length
    ? custs.map(([id,c]) => `<tr>
        <td style="font-size:11px;color:var(--text2);">${id.slice(-6).toUpperCase()}</td>
        <td><strong>${c.name}</strong></td>
        <td>${c.phone||'-'}</td>
        <td>${c.addr||'-'}</td>
        <td style="color:var(--accent);">${N(c.totalBuy||0)} EGP</td>
        <td style="color:${(+c.balance||0)>0?'var(--red)':'var(--text2)'};font-weight:${(+c.balance||0)>0?'700':'400'};">${(+c.balance||0)>0?N(c.balance)+' EGP':'لا ديون'}</td>
        <td style="white-space:nowrap;">
          ${(+c.balance||0)>0?`<button class="btn btn-success btn-xs" onclick="openPayDebt('cust','${id}','${id}')"><i class="fas fa-hand-holding-usd"></i></button> `:''}
          <button class="btn btn-ghost btn-xs" onclick="editCust('${id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-xs" onclick="delCust('${id}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:20px;">لا يوجد عملاء</td></tr>';
}

function editCust(id) {
  editingCust = id;
  const c = S.customers[id];
  document.getElementById('cust-modal-title').textContent = 'تعديل عميل';
  document.getElementById('cf-name').value  = c.name  || '';
  document.getElementById('cf-phone').value = c.phone || '';
  document.getElementById('cf-email').value = c.email || '';
  document.getElementById('cf-addr').value  = c.addr  || '';
  document.getElementById('cf-notes').value = c.notes || '';
  openModal('modal-customer');
}

async function delCust(id) {
  if (!confirm('حذف هذا العميل؟')) return;
  await dbRemove(`customers/${id}`);
  toast('تم الحذف');
}

// Duplicate check helpers
function checkCustNameDup(val) {
  const hint = document.getElementById('cf-name-hint'); if (!hint) return;
  const name = (val||'').trim(); if (!name) { hint.style.display='none'; return; }
  const dup = Object.entries(S.customers).find(([id,c]) => c.name===name && id!==editingCust);
  if (dup) { hint.textContent='⚠️ هذا الاسم موجود: '+dup[1].name+(dup[1].phone?' - '+dup[1].phone:''); hint.style.display='block'; }
  else hint.style.display='none';
}
function checkCustPhoneDup(val) {
  const hint = document.getElementById('cf-phone-hint'); if (!hint) return;
  const phone = (val||'').trim(); if (!phone) { hint.style.display='none'; return; }
  const dup = Object.entries(S.customers).find(([id,c]) => c.phone===phone && id!==editingCust);
  if (dup) { hint.textContent='❌ رقم الهاتف مستخدم: '+dup[1].name; hint.style.display='block'; }
  else hint.style.display='none';
}

// Customer search modal
function openCustomerSearch() {
  document.getElementById('cs-input').value = '';
  document.getElementById('cs-list').style.display = 'none';
  document.getElementById('cs-list').innerHTML = '';
  document.getElementById('cs-profile').style.display = 'none';
  document.getElementById('cs-empty').style.display = 'block';
  document.getElementById('cs-notfound').style.display = 'none';
  openModal('modal-cust-search');
  setTimeout(() => document.getElementById('cs-input')?.focus(), 200);
}

function runCustomerSearch() {
  const q = (document.getElementById('cs-input')?.value||'').trim().toLowerCase();
  ['cs-profile','cs-notfound','cs-empty','cs-list'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display='none';
  });
  if (!q) { document.getElementById('cs-empty').style.display='block'; return; }
  const matches = Object.entries(S.customers||{}).filter(([id,c]) => {
    const shortId = id.slice(-6).toUpperCase();
    return shortId===q.toUpperCase() || id.toLowerCase()===q
      || (c.name&&c.name.toLowerCase().includes(q))
      || (c.phone&&c.phone.includes(q));
  });
  if (!matches.length) { document.getElementById('cs-notfound').style.display='block'; return; }
  if (matches.length === 1) { loadCustomerProfile(matches[0][0], matches[0][1]); return; }
  const listEl = document.getElementById('cs-list');
  listEl.innerHTML = matches.map(([id,c]) => `
    <div onclick="loadCustomerProfile('${id}',null)" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border2);display:flex;align-items:center;gap:10px;transition:background .15s;" onmouseover="this.style.background='var(--accent-bg)'" onmouseout="this.style.background=''">
      <div style="width:32px;height:32px;background:var(--accent-bg);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">👤</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;">${c.name||'-'}</div>
        <div style="font-size:11px;color:var(--text2);">📞 ${c.phone||'-'} | رقم: <span style="color:var(--accent);font-weight:700;">${id.slice(-6).toUpperCase()}</span></div>
      </div>
      ${(+c.balance||0)>0?`<span style="background:var(--red-bg);color:var(--red);border-radius:8px;padding:3px 8px;font-size:11px;font-weight:700;">${N(c.balance)} EGP دين</span>`:''}
    </div>`).join('');
  listEl.style.display = 'block';
}

function loadCustomerProfile(id, cObj) {
  const c = cObj || S.customers[id]; if (!c) { toast('لم يُعثر على بيانات العميل','error'); return; }
  ['cs-list','cs-empty','cs-notfound'].forEach(i => { const el=document.getElementById(i); if(el) el.style.display='none'; });
  document.getElementById('cs-name').textContent        = c.name || '-';
  document.getElementById('cs-id-display').textContent  = 'رقم العميل: ' + id.slice(-6).toUpperCase();
  document.getElementById('cs-phone').textContent       = c.phone || 'لا يوجد';
  document.getElementById('cs-addr').textContent        = c.addr  || 'لا يوجد';
  document.getElementById('cs-total').textContent       = N(c.totalBuy||0) + ' EGP';
  const debt = +c.balance||0;
  const debtEl = document.getElementById('cs-debt');
  if (debtEl) { debtEl.textContent = debt>0 ? N(debt)+' EGP' : 'لا ديون'; debtEl.style.color = debt>0?'var(--red)':'var(--green)'; }
  document.getElementById('cs-edit-btn').onclick = () => { closeModal('modal-cust-search'); editCust(id); };
  document.getElementById('cs-goto-btn').onclick = () => { closeModal('modal-cust-search'); nav('customers'); setTimeout(()=>{ const el=document.getElementById('cust-search'); if(el){el.value=c.name||''; renderCustomers();} },300); };
  const payBtn = document.getElementById('cs-pay-btn');
  if (debt>0) { payBtn.style.display=''; payBtn.onclick=()=>{ closeModal('modal-cust-search'); openPayDebt('cust',id,id); }; }
  else payBtn.style.display='none';
  const custSales = Object.entries(S.sales||{}).filter(([,s]) => (s.customerId===id||s.custId===id)).sort(([,a],[,b]) => new Date(b.date||0)-new Date(a.date||0));
  const cntEl = document.getElementById('cs-inv-count'); if(cntEl) cntEl.textContent = custSales.length;
  const tbody = document.getElementById('cs-inv-tbl');
  tbody.innerHTML = custSales.length
    ? custSales.map(([sid,s]) => {
        const statusMap = {paid:'<span class="badge badge-success">مدفوع</span>',partial:'<span class="badge badge-warning">جزئي</span>',unpaid:'<span class="badge badge-danger">غير مدفوع</span>'};
        const bal = +s.balance||0;
        return `<tr style="border-bottom:1px solid var(--border2);">
          <td style="padding:9px 12px;font-weight:700;color:var(--accent);">#${sid.slice(-5).toUpperCase()}</td>
          <td style="padding:9px 12px;color:var(--text2);">${s.date?new Date(s.date).toLocaleDateString('ar-EG'):'-'}</td>
          <td style="padding:9px 12px;font-weight:700;">${N(s.total||0)} EGP</td>
          <td style="padding:9px 12px;color:var(--green);">${N(s.amountPaid||s.amtPaid||0)} EGP</td>
          <td style="padding:9px 12px;color:${bal>0?'var(--red)':'var(--text2)'};font-weight:${bal>0?'700':'400'};">${bal>0?N(bal)+' EGP':'—'}</td>
          <td style="padding:9px 12px;">${statusMap[s.status]||statusMap.unpaid}</td>
          <td style="padding:9px 12px;"><button class="btn btn-ghost btn-xs" onclick="viewSale('${sid}')"><i class="fas fa-eye"></i></button></td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7" style="text-align:center;padding:18px;color:var(--text2);font-size:12px;">لا توجد فواتير لهذا العميل</td></tr>';
  document.getElementById('cs-profile').style.display = 'block';
}

// Collect all debts
async function collectAllDebts() {
  const debtors = Object.entries(S.customers).filter(([,c]) => (+c.balance||0) > 0);
  if (!debtors.length) { toast('لا توجد ديون للتحصيل','info'); return; }
  if (!confirm(`تحصيل ${debtors.length} دين إجمالاً؟`)) return;
  for (const [id,c] of debtors) {
    await dbUpdate('customers/'+id, {balance:0, lastDebtPaidAt:new Date().toISOString()});
    const unpaidSales = Object.entries(S.sales).filter(([,s]) => (s.custId===id||s.customerId===id) && (+s.balance||0)>0);
    for (const [sid] of unpaidSales) {
      const s = S.sales[sid];
      await dbUpdate('sales/'+sid, {balance:0, amountPaid:s.total, amtPaid:s.total, status:'paid'});
    }
  }
  toast(`تم تحصيل ديون ${debtors.length} عميل ✅`);
}
