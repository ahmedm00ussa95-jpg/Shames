/* ============================================================
   reports.js — التقارير + المالية + الديون
   الشمس - Al Shams ERP | المرحلة الأولى
   ============================================================ */

// ============================================================
// REPORTS
// ============================================================
function setPeriod(p) {
  const now=new Date(); const fmt=d=>d.toISOString().split('T')[0];
  let from, to=fmt(now);
  if (p==='today') from=to;
  else if (p==='week')  { const m=new Date(now); m.setDate(now.getDate()-now.getDay()); from=fmt(m); }
  else if (p==='month') from=fmt(new Date(now.getFullYear(),now.getMonth(),1));
  else from=fmt(new Date(now.getFullYear(),0,1));
  document.getElementById('rep-from').value=from;
  document.getElementById('rep-to').value=to;
  genReports();
}

function genReports() {
  const from = document.getElementById('rep-from')?.value||'';
  const to   = document.getElementById('rep-to')?.value||'';
  const wh   = document.getElementById('rep-wh')?.value||'';
  const filt = Object.entries(S.sales).filter(([,s]) => {
    const d=(s.date||'').split('T')[0];
    return (!from||d>=from)&&(!to||d<=to)&&(!wh||s.whId===wh||s.warehouseId===wh);
  });
  const totalSales = filt.reduce((s,[,v]) => s+(v.total||0), 0);
  const cogs = filt.reduce((s,[,v]) => s+(v.items||[]).reduce((ss,i) => ss+((i.cost||0)*(i.qty||0)),0), 0);
  const profit = totalSales - cogs;
  const margin = totalSales>0 ? profit/totalSales*100 : 0;
  const avg    = filt.length>0 ? totalSales/filt.length : 0;
  const set    = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set('rep-sales',N(totalSales,0)); set('rep-profit',N(profit,0)); set('rep-margin',margin.toFixed(1)+'%'); set('rep-avg',N(avg,0));

  const cols = ['#00d4ff','#a371f7','#3fb950','#d29922','#f85149','#06b6d4','#8b5cf6','#22c55e','#f97316','#ec4899','#14b8a6','#a855f7'];

  // Monthly chart (last 12 months)
  const months=[]; const mVals=[];
  for (let i=11;i>=0;i--) {
    const d=new Date(new Date().getFullYear(),new Date().getMonth()-i,1);
    const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    months.push(d.toLocaleDateString('ar-EG',{month:'short'}));
    mVals.push(filt.filter(([,s])=>(s.date||'').startsWith(key)).reduce((ss,[,s])=>ss+(s.total||0),0));
  }
  const mMax = Math.max(...mVals,1);
  const mc = document.getElementById('rep-monthly-chart');
  const ml = document.getElementById('rep-monthly-lbls');
  if (mc) mc.innerHTML = mVals.map((v,i) => `<div class="bar-col"><div class="bar" style="height:${Math.max((v/mMax)*120,v>0?3:0)}px;background:${cols[i]};opacity:.85;"></div></div>`).join('');
  if (ml) ml.innerHTML = months.map(m => `<span>${m}</span>`).join('');

  // Category breakdown
  const catTots = {};
  filt.forEach(([,s]) => (s.items||[]).forEach(item => {
    const p=S.products[item.prodId]; const cat=p?.cat||'other';
    catTots[cat]=(catTots[cat]||0)+(item.price||0)*(item.qty||0);
  }));
  const catTotal = Object.values(catTots).reduce((s,v)=>s+v,0)||1;
  const rc = document.getElementById('rep-cats');
  if (rc) rc.innerHTML = Object.entries(catTots).sort(([,a],[,b])=>b-a).map(([cat,v],i) => {
    const pct=(v/catTotal*100).toFixed(1);
    return `<div class="progress-row"><div class="progress-info"><span>${getCatName(cat)}</span><span style="color:${cols[i%12]};font-weight:700;">${N(v)} EGP (${pct}%)</span></div><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${cols[i%12]};"></div></div></div>`;
  }).join('') || '<div style="text-align:center;color:var(--text2);padding:14px;">لا توجد بيانات</div>';

  // Top customers
  const custTot = {};
  filt.forEach(([,s]) => { const k=s.custName||s.customerName||'نقدي'; if(!custTot[k])custTot[k]={n:0,t:0}; custTot[k].n++; custTot[k].t+=s.total||0; });
  const rcu = document.getElementById('rep-custs');
  if (rcu) rcu.innerHTML = Object.entries(custTot).sort(([,a],[,b])=>b.t-a.t).slice(0,8).map(([name,d],i) =>
    `<tr><td style="color:var(--accent);font-weight:900;">${i+1}</td><td><strong>${name}</strong></td><td>${d.n} فاتورة</td><td style="color:var(--green);font-weight:700;">${N(d.t)} EGP</td></tr>`
  ).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text2);padding:12px;">لا بيانات</td></tr>';

  // Payment methods
  const pmTot = {};
  filt.forEach(([,s]) => { const pm=s.paymentMethod||'cash'; pmTot[pm]=(pmTot[pm]||0)+(s.total||0); });
  const pmTotal = Object.values(pmTot).reduce((s,v)=>s+v,0)||1;
  const rp = document.getElementById('rep-payments');
  if (rp) rp.innerHTML = Object.entries(pmTot).sort(([,a],[,b])=>b-a).map(([pm,v],i) => {
    const pct=(v/pmTotal*100).toFixed(1);
    return `<div class="progress-row"><div class="progress-info"><span>${PAY_NAMES[pm]||pm}</span><span style="color:${cols[i]};font-weight:700;">${N(v)} EGP (${pct}%)</span></div><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${cols[i]};"></div></div></div>`;
  }).join('') || '<div style="text-align:center;color:var(--text2);padding:14px;">لا بيانات</div>';

  // Detail table
  let detTot = 0;
  const rd  = document.getElementById('rep-detail');
  const sm2 = {paid:'badge-success',partial:'badge-warning',unpaid:'badge-danger'};
  const st2 = {paid:'مدفوع',partial:'جزئي',unpaid:'غير مدفوع'};
  if (rd) {
    rd.innerHTML = filt.length
      ? filt.sort(([,a],[,b])=>new Date(b.date)-new Date(a.date)).map(([id,s]) => {
          const pr=(s.amountPaid||s.amtPaid||0)-(s.items||[]).reduce((ss,i)=>ss+((i.cost||0)*(i.qty||0)),0);
          detTot+=s.total||0;
          return `<tr><td>${fDate(s.date)}</td><td style="color:var(--accent);font-weight:700;">#${id.slice(-5).toUpperCase()}</td><td>${s.custName||s.customerName||'نقدي'}</td><td style="font-weight:700;">${N(s.total)} EGP</td><td style="color:var(--green);">${N(s.amountPaid||s.amtPaid||0)} EGP</td><td style="color:${pr>=0?'var(--green)':'var(--red)'};font-weight:700;">${N(pr)} EGP</td><td><span class="badge ${sm2[s.status]||'badge-info'}">${st2[s.status]||''}</span></td></tr>`;
        }).join('')
      : '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:14px;">لا بيانات في هذه الفترة</td></tr>';
  }
  const rdt = document.getElementById('rep-detail-total'); if(rdt) rdt.textContent = N(detTot)+' EGP';

  // Customer debts
  const rcd = document.getElementById('rep-cust-debts');
  if (rcd) {
    const debtors=Object.entries(S.customers).filter(([,c])=>(+c.balance||0)>0).sort(([,a],[,b])=>(+b.balance||0)-(+a.balance||0));
    rcd.innerHTML=debtors.length?debtors.map(([id,c])=>`<tr><td><strong>${c.name}</strong></td><td>${c.phone||'-'}</td><td style="color:var(--red);font-weight:700;">${N(c.balance)} EGP</td><td><button class="btn btn-success btn-xs" onclick="openPayDebt('cust','${id}','${id}')"><i class="fas fa-hand-holding-usd"></i></button></td></tr>`).join(''):
    '<tr><td colspan="4" style="text-align:center;color:var(--green);padding:12px;">لا ديون للعملاء</td></tr>';
  }

  // Supplier debts
  const rsd = document.getElementById('rep-sup-debts');
  if (rsd) {
    const supDebtMap={};
    Object.entries(S.purchases).filter(([,p])=>(+p.balance||0)>0).forEach(([id,p])=>{
      const k=p.supplierId||id;
      if(!supDebtMap[k])supDebtMap[k]={name:p.supplier,debt:0,supId:p.supplierId,phone:''};
      supDebtMap[k].debt+=+p.balance||0;
      if(p.supplierId&&S.suppliers[p.supplierId]?.phone)supDebtMap[k].phone=S.suppliers[p.supplierId].phone;
    });
    const supDebtors=Object.entries(supDebtMap).sort(([,a],[,b])=>b.debt-a.debt);
    rsd.innerHTML=supDebtors.length?supDebtors.map(([k,d])=>`<tr><td><strong>${d.name}</strong></td><td>${d.phone||'-'}</td><td style="color:var(--yellow);font-weight:700;">${N(d.debt)} EGP</td><td><button class="btn btn-warning btn-xs" onclick="openPayDebt('sup','${d.supId||k}','${k}')"><i class="fas fa-hand-holding-usd"></i></button></td></tr>`).join(''):
    '<tr><td colspan="4" style="text-align:center;color:var(--green);padding:12px;">لا ديون للموردين</td></tr>';
  }
}

// ============================================================
// FINANCE
// ============================================================
function updateFinance() {
  const income  = Object.values(S.sales).reduce((s,v)=>s+(v.amountPaid||v.amtPaid||0),0);
  const expenses= Object.values(S.expenses).reduce((s,v)=>s+(v.amount||0),0);
  const cogs    = Object.values(S.sales).reduce((s,v)=>s+(v.items||[]).reduce((ss,i)=>ss+((i.cost||0)*(i.qty||0)),0),0);
  const profit  = income-expenses-cogs;
  const recv    = Object.values(S.sales).reduce((s,v)=>s+(v.balance||0),0);
  const el = id => document.getElementById(id);
  if(el('fin-inc'))    el('fin-inc').textContent    = N(income,0);
  if(el('fin-exp'))    el('fin-exp').textContent    = N(expenses,0);
  if(el('fin-profit')) el('fin-profit').textContent = N(profit,0);
  if(el('fin-recv'))   el('fin-recv').textContent   = N(recv,0);
  const incRows = Object.entries(S.sales).sort(([,a],[,b])=>new Date(b.date)-new Date(a.date)).slice(0,10);
  if(el('fin-inc-tbl')) el('fin-inc-tbl').innerHTML=incRows.length?incRows.map(([id,s])=>`<tr><td>${fDate(s.date)}</td><td>مبيعات - ${s.custName||s.customerName}</td><td style="color:var(--green);font-weight:700;">${N(s.amountPaid||s.amtPaid||0)} EGP</td></tr>`).join(''):'<tr><td colspan="3" style="text-align:center;color:var(--text2);padding:12px;">لا بيانات</td></tr>';
  const recvRows=Object.entries(S.sales).filter(([,s])=>(s.balance||0)>0);
  if(el('fin-recv-tbl')) el('fin-recv-tbl').innerHTML=recvRows.length?recvRows.map(([id,s])=>`<tr><td>${s.custName||s.customerName}</td><td style="color:var(--red);font-weight:700;">${N(s.balance)} EGP</td><td>${fDate(s.date)}</td><td><button class="btn btn-success btn-xs" onclick="openPayDebt('sale','${id}','${id}')"><i class="fas fa-hand-holding-usd"></i></button></td></tr>`).join(''):'<tr><td colspan="4" style="text-align:center;color:var(--green);padding:12px;">لا ذمم</td></tr>';
  const supDebtMap={};
  Object.entries(S.purchases).filter(([,p])=>(+p.balance||0)>0).forEach(([id,p])=>{
    const k=p.supplierId||id; if(!supDebtMap[k])supDebtMap[k]={name:p.supplier,debt:0,supId:p.supplierId,lastDate:p.date||''};
    supDebtMap[k].debt+=+p.balance||0; if(p.date>supDebtMap[k].lastDate)supDebtMap[k].lastDate=p.date;
  });
  const supDebtEl=document.getElementById('fin-sup-debt-tbl');
  if(supDebtEl) supDebtEl.innerHTML=Object.entries(supDebtMap).sort(([,a],[,b])=>b.debt-a.debt).map(([k,d])=>`<tr><td><strong>${d.name}</strong></td><td style="color:var(--yellow);font-weight:700;">${N(d.debt)} EGP</td><td>${fDate(d.lastDate)}</td><td><button class="btn btn-warning btn-xs" onclick="openPayDebt('sup','${d.supId||k}','${k}')"><i class="fas fa-hand-holding-usd"></i> سدد</button></td></tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--green);padding:12px;">لا ديون للموردين</td></tr>';
  const totalCustDebt=Object.values(S.customers).reduce((s,c)=>s+(+c.balance||0),0);
  const totalSupDebt =Object.values(S.purchases).reduce((s,p)=>s+(+p.balance||0),0);
  const el1=document.getElementById('fin-total-cust-debt'); if(el1)el1.textContent=N(totalCustDebt,0)+' EGP';
  const el2=document.getElementById('fin-total-sup-debt');  if(el2)el2.textContent=N(totalSupDebt,0)+' EGP';
  const el3=document.getElementById('fin-net-position');    if(el3){const net=totalCustDebt-totalSupDebt;el3.textContent=N(net,0)+' EGP';el3.style.color=net>=0?'var(--green)':'var(--red)';}
}

// ============================================================
// DEBTS PAGE
// ============================================================
function renderDebtsPage() {
  const custDebt=Object.values(S.customers).reduce((s,c)=>s+(+c.balance||0),0);
  const supDebt =Object.values(S.purchases).reduce((s,p)=>s+(+p.balance||0),0);
  const net=custDebt-supDebt;
  const el1=document.getElementById('debts-cust-total');if(el1)el1.textContent=N(custDebt,0)+' EGP';
  const el2=document.getElementById('debts-sup-total'); if(el2)el2.textContent=N(supDebt,0)+' EGP';
  const el3=document.getElementById('debts-net-total'); if(el3){el3.textContent=N(net,0)+' EGP';el3.style.color=net>=0?'var(--green)':'var(--red)';}

  const cdTbl=document.getElementById('debts-cust-tbl');
  if (cdTbl) {
    const debtors=Object.entries(S.customers).filter(([,c])=>(+c.balance||0)>0).sort(([,a],[,b])=>(+b.balance||0)-(+a.balance||0));
    const custSalesCount={}; const custLastDate={};
    Object.values(S.sales).filter(s=>(s.balance||0)>0).forEach(s=>{
      const k=s.custId||s.customerId; if(!k)return;
      custSalesCount[k]=(custSalesCount[k]||0)+1;
      if(!custLastDate[k]||s.date>custLastDate[k])custLastDate[k]=s.date;
    });
    cdTbl.innerHTML=debtors.length?debtors.map(([id,c])=>`<tr>
      <td><strong>${c.name}</strong></td><td>${c.phone||'-'}</td>
      <td style="color:var(--red);font-weight:700;font-size:14px;">${N(c.balance)} EGP</td>
      <td style="text-align:center;">${custSalesCount[id]||'-'}</td>
      <td style="font-size:11px;">${fDate(custLastDate[id]||'')}</td>
      <td><button class="btn btn-success btn-sm" onclick="openPayDebt('cust','${id}','${id}')"><i class="fas fa-hand-holding-usd"></i> تحصيل</button></td>
    </tr>`).join(''):'<tr><td colspan="6" style="text-align:center;color:var(--green);padding:20px;font-size:13px;"><i class="fas fa-check-circle" style="font-size:24px;display:block;margin-bottom:8px;"></i>لا توجد ديون للعملاء! 🎉</td></tr>';
  }

  const sdTbl=document.getElementById('debts-sup-tbl');
  if (sdTbl) {
    const supDebtMap={}; const supPurCount={}; const supLastDate={};
    Object.entries(S.purchases).filter(([,p])=>(+p.balance||0)>0).forEach(([id,p])=>{
      const k=p.supplierId||id;
      if(!supDebtMap[k])supDebtMap[k]={name:p.supplier,debt:0,supId:p.supplierId,phone:''};
      supDebtMap[k].debt+=+p.balance||0; supPurCount[k]=(supPurCount[k]||0)+1;
      if(!supLastDate[k]||p.date>supLastDate[k])supLastDate[k]=p.date;
      if(p.supplierId&&S.suppliers[p.supplierId]?.phone)supDebtMap[k].phone=S.suppliers[p.supplierId].phone;
    });
    const supDebtors=Object.entries(supDebtMap).sort(([,a],[,b])=>b.debt-a.debt);
    sdTbl.innerHTML=supDebtors.length?supDebtors.map(([k,d])=>`<tr>
      <td><strong>${d.name}</strong></td><td>${d.phone||'-'}</td>
      <td style="color:var(--yellow);font-weight:700;font-size:14px;">${N(d.debt)} EGP</td>
      <td style="text-align:center;">${supPurCount[k]||'-'}</td>
      <td style="font-size:11px;">${fDate(supLastDate[k]||'')}</td>
      <td><button class="btn btn-warning btn-sm" onclick="openPayDebt('sup','${d.supId||k}','${k}')"><i class="fas fa-hand-holding-usd"></i> سداد</button></td>
    </tr>`).join(''):'<tr><td colspan="6" style="text-align:center;color:var(--green);padding:20px;"><i class="fas fa-check-circle" style="font-size:24px;display:block;margin-bottom:8px;"></i>لا ديون للموردين! 🎉</td></tr>';
  }

  const salesTbl=document.getElementById('debts-sales-tbl');
  if (salesTbl) {
    const unpaid=Object.entries(S.sales).filter(([,s])=>(s.balance||0)>0).sort(([,a],[,b])=>new Date(b.date)-new Date(a.date));
    const stM={partial:['badge-warning','جزئي'],unpaid:['badge-danger','غير مدفوع']};
    salesTbl.innerHTML=unpaid.length?unpaid.map(([id,s])=>{
      const[cls,lbl]=stM[s.status]||['badge-info',''];
      return`<tr><td style="color:var(--accent);font-weight:700;">#${id.slice(-5).toUpperCase()}</td><td style="font-size:11px;">${fDate(s.date)}</td><td>${s.custName||s.customerName||'نقدي'}</td><td style="font-weight:700;">${N(s.total)} EGP</td><td style="color:var(--green);">${N(s.amountPaid||s.amtPaid||0)} EGP</td><td style="color:var(--red);font-weight:700;">${N(s.balance||0)} EGP</td><td><span class="badge ${cls}">${lbl}</span></td><td><button class="btn btn-success btn-xs" onclick="openPayDebt('sale','${id}','${id}')"><i class="fas fa-hand-holding-usd"></i></button></td></tr>`;
    }).join(''):'<tr><td colspan="8" style="text-align:center;color:var(--green);padding:20px;">جميع الفواتير مدفوعة 🎉</td></tr>';
  }
}

// ============================================================
// PAY DEBT
// ============================================================
function openPayDebt(type, refId, key) {
  fillCashboxSelects();
  document.getElementById('pd-type').value   = type;
  document.getElementById('pd-ref-id').value = refId;
  document.getElementById('pd-amount').value = '';
  document.getElementById('pd-notes').value  = '';
  const infoEl = document.getElementById('pay-debt-info');
  if (type==='cust') {
    const c=S.customers[refId]; const debt=+c?.balance||0;
    if(infoEl)infoEl.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;"><div><div style="font-weight:700;font-size:14px;">${c?.name||'-'}</div><div style="font-size:12px;color:var(--text2);">ديون العميل (مستحقة التحصيل)</div></div><div style="font-size:20px;font-weight:900;color:var(--red);">${N(debt)} EGP</div></div>`;
    document.getElementById('pd-amount').value=debt>0?debt.toFixed(2):'';
  } else if (type==='sup') {
    const s=S.suppliers[refId]; const debt=Object.values(S.purchases).filter(p=>p.supplierId===refId).reduce((ss,p)=>ss+(+p.balance||0),0);
    if(infoEl)infoEl.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;"><div><div style="font-weight:700;font-size:14px;">${s?.name||'-'}</div><div style="font-size:12px;color:var(--text2);">ديوننا للمورد</div></div><div style="font-size:20px;font-weight:900;color:var(--yellow);">${N(debt)} EGP</div></div>`;
    document.getElementById('pd-amount').value=debt>0?debt.toFixed(2):'';
  } else if (type==='sale') {
    const sale=S.sales[refId];
    if(infoEl)infoEl.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;"><div><div style="font-weight:700;font-size:14px;">${sale?.custName||sale?.customerName||'-'}</div><div style="font-size:12px;color:var(--text2);">فاتورة #${refId.slice(-5).toUpperCase()}</div></div><div style="font-size:20px;font-weight:900;color:var(--red);">${N(sale?.balance||0)} EGP</div></div>`;
    document.getElementById('pd-amount').value=(sale?.balance||0)>0?(+sale.balance).toFixed(2):'';
  } else if (type==='pur') {
    const pur=S.purchases[refId];
    if(infoEl)infoEl.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;"><div><div style="font-weight:700;font-size:14px;">${pur?.supplier||'-'}</div><div style="font-size:12px;color:var(--text2);">فاتورة شراء #${refId.slice(-5).toUpperCase()}</div></div><div style="font-size:20px;font-weight:900;color:var(--yellow);">${N(pur?.balance||0)} EGP</div></div>`;
    document.getElementById('pd-amount').value=(pur?.balance||0)>0?(+pur.balance).toFixed(2):'';
  }
  openModal('modal-pay-debt');
}

async function saveDebtPayment() {
  const type  = document.getElementById('pd-type').value;
  const refId = document.getElementById('pd-ref-id').value;
  const amount= parseFloat(document.getElementById('pd-amount').value)||0;
  const cbId  = document.getElementById('pd-cashbox').value||'';
  const notes = document.getElementById('pd-notes').value;
  const paidBy= getCU();
  if (!amount||amount<=0) { toast('يرجى إدخال مبلغ صحيح','error'); return; }
  if (!cbId) { toast('يرجى اختيار الخزينة - الحقل إلزامي','error'); return; }
  try {
    if (type==='cust') {
      const c=S.customers[refId];
      await dbUpdate('customers/'+refId, {balance:Math.max(0,(+c.balance||0)-amount), lastDebtPaidBy:paidBy, lastDebtPaidAt:new Date().toISOString()});
      let remaining=amount;
      const unpaid=Object.entries(S.sales).filter(([,s])=>(s.custId===refId||s.customerId===refId)&&(s.balance||0)>0).sort(([,a],[,b])=>new Date(a.date)-new Date(b.date));
      for (const [sid,s] of unpaid) {
        if(remaining<=0)break;
        const pay=Math.min(remaining,s.balance||0);
        if(pay>0){const nb=Math.max(0,(s.balance||0)-pay);const np=(s.amountPaid||s.amtPaid||0)+pay;await dbUpdate('sales/'+sid,{balance:nb,amountPaid:np,amtPaid:np,status:nb<=0?'paid':'partial'});remaining-=pay;}
      }
      if(cbId)await addCashboxEntry(cbId,amount,'deposit',`تحصيل دين: ${c.name} - ${notes||''}`,refId.slice(-6).toUpperCase());
      toast(`تم تسجيل تحصيل ${N(amount)} EGP من ${c.name} ✅`);
    } else if (type==='sup') {
      let remaining=amount;
      const unpaid=Object.entries(S.purchases).filter(([,p])=>p.supplierId===refId&&(+p.balance||0)>0).sort(([,a],[,b])=>new Date(a.date)-new Date(b.date));
      for (const [pid,p] of unpaid) {
        if(remaining<=0)break;
        const pay=Math.min(remaining,p.balance||0);
        if(pay>0){const nb=Math.max(0,(p.balance||0)-pay);const np=(p.amountPaid||0)+pay;await dbUpdate('purchases/'+pid,{balance:nb,amountPaid:np,status:nb<=0?'paid':'partial'});remaining-=pay;}
      }
      if(cbId)await addCashboxEntry(cbId,amount,'withdraw',`سداد مورد: ${S.suppliers[refId]?.name||refId} - ${notes||''}`,refId.slice(-6).toUpperCase());
      toast(`تم تسجيل سداد ${N(amount)} EGP للمورد ✅`);
    } else if (type==='sale') {
      const s=S.sales[refId];
      const nb=Math.max(0,(s.balance||0)-amount); const np=(s.amountPaid||s.amtPaid||0)+amount;
      await dbUpdate('sales/'+refId,{balance:nb,amountPaid:np,amtPaid:np,status:nb<=0?'paid':'partial'});
      if(s.custId||s.customerId){const cid=s.custId||s.customerId;const c=S.customers[cid];if(c)await dbUpdate('customers/'+cid,{balance:Math.max(0,(+c.balance||0)-amount)});}
      if(cbId)await addCashboxEntry(cbId,amount,'deposit',`تحصيل فاتورة #${refId.slice(-5).toUpperCase()} - ${s.custName||s.customerName}`,refId.slice(-6).toUpperCase());
      toast(`تم تسجيل تحصيل ${N(amount)} EGP ✅`);
    } else if (type==='pur') {
      const p=S.purchases[refId];
      const nb=Math.max(0,(p.balance||0)-amount); const np=(p.amountPaid||0)+amount;
      await dbUpdate('purchases/'+refId,{balance:nb,amountPaid:np,status:nb<=0?'paid':'partial'});
      if(cbId)await addCashboxEntry(cbId,amount,'withdraw',`سداد فاتورة شراء #${refId.slice(-5).toUpperCase()} - ${p.supplier}`,refId.slice(-6).toUpperCase());
      toast(`تم تسجيل سداد ${N(amount)} EGP للمورد ✅`);
    }
    closeModal('modal-pay-debt');
  } catch(e) { toast('خطأ: '+e.message,'error'); }
}
