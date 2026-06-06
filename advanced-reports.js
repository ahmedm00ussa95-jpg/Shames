/* ============================================================
   advanced-reports.js — التقارير المتقدمة + التحليلات
   Phase 5: Top Products, Cashier Performance, Global Branch Report
   ============================================================ */

// ============================================================
// PERIOD SETTER
// ============================================================
function setAdvPeriod(p) {
  document.querySelectorAll('.dash-period-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === p);
  });
  const now = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  let from, to = fmt(now);
  if      (p === 'today') from = to;
  else if (p === 'week')  { const d=new Date(now); d.setDate(now.getDate()-now.getDay()); from=fmt(d); }
  else if (p === 'month') from = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
  else                    from = fmt(new Date(now.getFullYear(), 0, 1));
  const fromEl = document.getElementById('rep-from'); if (fromEl) fromEl.value = from;
  const toEl   = document.getElementById('rep-to');   if (toEl)   toEl.value   = to;
  genAdvReports();
}

// Keep backward compat alias
function setPeriod(p) { setAdvPeriod(p); }

// ============================================================
// MAIN REPORTS ENGINE
// ============================================================
function genAdvReports() {
  const from = document.getElementById('rep-from')?.value || '';
  const to   = document.getElementById('rep-to')?.value   || '';
  const wh   = document.getElementById('rep-wh')?.value   || '';
  const cols = ['#00d4ff','#a371f7','#3fb950','#d29922','#f85149','#06b6d4','#8b5cf6','#22c55e','#f97316','#ec4899','#14b8a6','#a855f7'];

  // Filter sales
  const filt = Object.entries(S.sales).filter(([,s]) => {
    const d = (s.date||'').split('T')[0];
    return (!from || d >= from) && (!to || d <= to) && (!wh || s.warehouseId===wh || s.whId===wh);
  });

  // ── KPIs
  const totalSales = filt.reduce((s,[,v]) => s + (v.total||0), 0);
  const totalPaid  = filt.reduce((s,[,v]) => s + (v.amountPaid||v.amtPaid||0), 0);
  const cogs       = filt.reduce((s,[,v]) => s + (v.items||[]).reduce((ss,i)=>ss+((i.cost||0)*(i.qty||0)),0), 0);
  const profit     = totalPaid - cogs;
  const margin     = totalSales > 0 ? profit/totalSales*100 : 0;
  const avg        = filt.length > 0 ? totalSales/filt.length : 0;
  const posCount   = filt.filter(([,s]) => s.type !== 'manual').length;
  const manCount   = filt.filter(([,s]) => s.type === 'manual').length;

  const set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set('rep-sales',       N(totalSales, 0) + ' EGP');
  set('rep-profit',      N(profit, 0) + ' EGP');
  set('rep-margin',      margin.toFixed(1) + '%');
  set('rep-avg',         N(avg, 0) + ' EGP');
  set('rep-period-total',N(totalSales, 0) + ' EGP');
  set('rep-pos-count',   posCount);
  set('rep-manual-count',manCount);

  // ── Monthly chart (last 12 months)
  const months = [], mVals = [];
  for (let i = 11; i >= 0; i--) {
    const d   = new Date(new Date().getFullYear(), new Date().getMonth()-i, 1);
    const key = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    months.push(d.toLocaleDateString('ar-EG', {month:'short'}));
    mVals.push(filt.filter(([,s])=>(s.date||'').startsWith(key)).reduce((ss,[,s])=>ss+(s.total||0),0));
  }
  const mMax = Math.max(...mVals, 1);
  const mc = document.getElementById('rep-monthly-chart');
  const ml = document.getElementById('rep-monthly-lbls');
  if (mc) mc.innerHTML = mVals.map((v,i) => `<div class="bar-col"><div class="bar" style="height:${Math.max((v/mMax)*110,v>0?3:0)}px;background:${cols[i%12]};opacity:.85;border-radius:3px 3px 0 0;"></div></div>`).join('');
  if (ml) ml.innerHTML = months.map(m=>`<span style="font-size:9px;color:var(--text3);">${m}</span>`).join('');

  // ── Top products
  const prodStats = {};
  filt.forEach(([,s]) => (s.items||[]).forEach(item => {
    const id  = item.prodId || item.name;
    const rev = (item.price||0)*(item.qty||0);
    const cos = (item.cost||0)*(item.qty||0);
    if (!prodStats[id]) prodStats[id] = {name:item.name||id, qty:0, revenue:0, cost:0};
    prodStats[id].qty     += item.qty||0;
    prodStats[id].revenue += rev;
    prodStats[id].cost    += cos;
  }));
  const topProds = Object.values(prodStats).sort((a,b)=>b.revenue-a.revenue).slice(0,10);
  const tp = document.getElementById('rep-top-prods');
  if (tp) tp.innerHTML = topProds.length
    ? topProds.map((p,i) => {
        const pft = p.revenue - p.cost;
        return `<tr>
          <td style="color:var(--accent);font-weight:900;">${i+1}</td>
          <td><strong>${p.name}</strong></td>
          <td style="font-weight:700;">${p.qty}</td>
          <td style="color:var(--accent);">${N(p.revenue)} EGP</td>
          <td style="color:${pft>=0?'var(--green)':'var(--red)'};font-weight:700;">${N(pft)} EGP</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--text2);padding:14px;">لا بيانات</td></tr>';

  // ── Top customers
  const custTot = {};
  filt.forEach(([,s]) => {
    const k = s.custName||s.customerName||'عميل نقدي';
    if (!custTot[k]) custTot[k] = {n:0, t:0};
    custTot[k].n++;
    custTot[k].t += s.total||0;
  });
  const rcu = document.getElementById('rep-custs');
  if (rcu) rcu.innerHTML = Object.entries(custTot).sort(([,a],[,b])=>b.t-a.t).slice(0,8).map(([name,d],i) =>
    `<tr>
      <td style="color:var(--accent);font-weight:900;">${i+1}</td>
      <td><strong>${name}</strong></td>
      <td>${d.n} فاتورة</td>
      <td style="color:var(--green);font-weight:700;">${N(d.t)} EGP</td>
    </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text2);padding:14px;">لا بيانات</td></tr>';

  // ── Category breakdown
  const catTots = {};
  filt.forEach(([,s]) => (s.items||[]).forEach(item => {
    const p = S.products[item.prodId]; const cat = p?.cat || 'other';
    catTots[cat] = (catTots[cat]||0) + (item.price||0)*(item.qty||0);
  }));
  const catTotal = Object.values(catTots).reduce((s,v)=>s+v,0)||1;
  const rc = document.getElementById('rep-cats');
  if (rc) rc.innerHTML = Object.entries(catTots).sort(([,a],[,b])=>b-a).map(([cat,v],i) => {
    const pct = (v/catTotal*100).toFixed(1);
    return `<div class="progress-row">
      <div class="progress-info"><span>${getCatName(cat)}</span><span style="color:${cols[i%12]};font-weight:700;">${N(v)} EGP (${pct}%)</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${cols[i%12]};"></div></div>
    </div>`;
  }).join('') || '<div style="text-align:center;color:var(--text2);padding:14px;">لا بيانات</div>';

  // ── Cashier performance
  const cashierStats = {};
  filt.forEach(([,s]) => {
    const name = s.soldBy || s.createdBy || 'غير محدد';
    if (!cashierStats[name]) cashierStats[name] = {count:0, total:0};
    cashierStats[name].count++;
    cashierStats[name].total += s.total||0;
  });
  const cashierEl = document.getElementById('rep-cashiers');
  if (cashierEl) {
    cashierEl.innerHTML = Object.entries(cashierStats).sort(([,a],[,b])=>b.total-a.total).map(([name,d]) =>
      `<tr>
        <td><strong>${name}</strong></td>
        <td style="font-weight:700;">${d.count}</td>
        <td style="color:var(--green);font-weight:700;">${N(d.total)} EGP</td>
        <td style="color:var(--text2);">${N(d.count>0?d.total/d.count:0)} EGP</td>
      </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text2);padding:14px;">لا بيانات</td></tr>';
  }

  // ── Payment methods
  const pmTot = {};
  filt.forEach(([,s]) => { const pm=s.paymentMethod||'cash'; pmTot[pm]=(pmTot[pm]||0)+(s.total||0); });
  const pmTotal = Object.values(pmTot).reduce((s,v)=>s+v,0)||1;
  const rp = document.getElementById('rep-payments');
  if (rp) rp.innerHTML = Object.entries(pmTot).sort(([,a],[,b])=>b-a).map(([pm,v],i) => {
    const pct = (v/pmTotal*100).toFixed(1);
    return `<div class="progress-row">
      <div class="progress-info"><span>${PAY_NAMES[pm]||pm}</span><span style="color:${cols[i]};font-weight:700;">${N(v)} EGP (${pct}%)</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${cols[i]};"></div></div>
    </div>`;
  }).join('') || '<div style="text-align:center;color:var(--text2);padding:14px;">لا بيانات</div>';

  // ── Customer debts
  const rcd = document.getElementById('rep-cust-debts');
  if (rcd) {
    const debtors = Object.entries(S.customers).filter(([,c])=>(+c.balance||0)>0).sort(([,a],[,b])=>b.balance-a.balance);
    rcd.innerHTML = debtors.length
      ? debtors.slice(0,10).map(([id,c]) =>
          `<tr>
            <td><strong>${c.name}</strong></td>
            <td>${c.phone||'—'}</td>
            <td style="color:var(--red);font-weight:700;">${N(c.balance)} EGP</td>
            <td><button class="btn btn-success btn-xs" onclick="openPayDebt('cust','${id}','${id}')"><i class="fas fa-hand-holding-usd"></i></button></td>
          </tr>`).join('')
      : '<tr><td colspan="4" style="text-align:center;color:var(--green);padding:14px;">لا ديون ✅</td></tr>';
  }

  // ── Supplier debts
  const rsd = document.getElementById('rep-sup-debts');
  if (rsd) {
    const supDebtMap = {};
    Object.entries(S.purchases).filter(([,p])=>(+p.balance||0)>0).forEach(([,p]) => {
      const k = p.supplierId||p.supplier;
      if (!supDebtMap[k]) supDebtMap[k] = {name:p.supplier, debt:0, supId:p.supplierId, phone:''};
      supDebtMap[k].debt += +p.balance||0;
      if (p.supplierId && S.suppliers[p.supplierId]?.phone) supDebtMap[k].phone = S.suppliers[p.supplierId].phone;
    });
    const debtors = Object.entries(supDebtMap).sort(([,a],[,b])=>b.debt-a.debt);
    rsd.innerHTML = debtors.length
      ? debtors.slice(0,10).map(([k,d]) =>
          `<tr>
            <td><strong>${d.name}</strong></td>
            <td>${d.phone||'—'}</td>
            <td style="color:var(--yellow);font-weight:700;">${N(d.debt)} EGP</td>
            <td><button class="btn btn-warning btn-xs" onclick="openPayDebt('sup','${d.supId||k}','${k}')"><i class="fas fa-hand-holding-usd"></i></button></td>
          </tr>`).join('')
      : '<tr><td colspan="4" style="text-align:center;color:var(--green);padding:14px;">لا ديون ✅</td></tr>';
  }

  // ── Detail table
  let detTot = 0;
  const stM = {paid:['badge-success','مدفوع'], partial:['badge-warning','جزئي'], unpaid:['badge-danger','غير مدفوع']};
  const rd  = document.getElementById('rep-detail');
  if (rd) {
    const sorted = filt.sort(([,a],[,b])=>new Date(b.date)-new Date(a.date));
    rd.innerHTML = sorted.length
      ? sorted.map(([id,s]) => {
          const pr   = (s.amountPaid||s.amtPaid||0) - (s.items||[]).reduce((ss,i)=>ss+((i.cost||0)*(i.qty||0)),0);
          const [cls,lbl] = stM[s.status] || ['badge-info',''];
          detTot += s.total||0;
          return `<tr>
            <td style="font-size:11px;">${fDate(s.date)}</td>
            <td style="color:var(--accent);font-weight:700;">#${id.slice(-5).toUpperCase()}</td>
            <td>${s.custName||s.customerName||'نقدي'}</td>
            <td style="font-weight:700;">${N(s.total)} EGP</td>
            <td style="color:var(--green);">${N(s.amountPaid||s.amtPaid||0)} EGP</td>
            <td style="color:${pr>=0?'var(--green)':'var(--red)'};font-weight:700;">${N(pr)} EGP</td>
            <td><span class="badge ${cls}">${lbl}</span></td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:14px;">لا بيانات في هذه الفترة</td></tr>';
    const tot = document.getElementById('rep-detail-total');
    if (tot) tot.textContent = N(detTot) + ' EGP';
  }

  // ── Show/hide global branch report for superadmin
  const gbr = document.getElementById('global-branch-report');
  if (gbr) {
    gbr.style.display = CURRENT_USER?.role === 'superadmin' ? '' : 'none';
    if (CURRENT_USER?.role === 'superadmin') loadGlobalReport();
  }
}

// ============================================================
// EXCEL EXPORT for reports
// ============================================================
function exportSalesExcel() {
  if (typeof XLSX === 'undefined') { toast('مكتبة Excel غير محملة','error'); return; }
  const from = document.getElementById('rep-from')?.value || '';
  const to   = document.getElementById('rep-to')?.value   || '';
  const filt = Object.entries(S.sales).filter(([,s]) => {
    const d=(s.date||'').split('T')[0];
    return (!from||d>=from) && (!to||d<=to);
  }).sort(([,a],[,b])=>new Date(b.date)-new Date(a.date));

  const wb = XLSX.utils.book_new();
  const stM = {paid:'مدفوع',partial:'جزئي',unpaid:'غير مدفوع'};
  const rows = [['رقم الفاتورة','التاريخ','العميل','المخزن','الإجمالي','المدفوع','المتبقي','طريقة الدفع','الحالة','المسؤول']];
  filt.forEach(([id,s]) => {
    rows.push([
      '#'+id.slice(-6).toUpperCase(),
      (s.date||'').split('T')[0],
      s.custName||s.customerName||'نقدي',
      S.warehouses[s.warehouseId||s.whId]?.name||'—',
      s.total||0, s.amountPaid||s.amtPaid||0, s.balance||0,
      PAY_NAMES[s.paymentMethod]||s.paymentMethod||'—',
      stM[s.status]||'—',
      s.soldBy||s.createdBy||'—'
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:15},{wch:12},{wch:22},{wch:15},{wch:12},{wch:12},{wch:12},{wch:12},{wch:10},{wch:14}];
  XLSX.utils.book_append_sheet(wb, ws, 'المبيعات');

  // Add summary sheet
  const summary = [
    ['التقرير', 'القيمة'],
    ['إجمالي المبيعات', filt.reduce((s,[,v])=>s+(v.total||0),0)],
    ['إجمالي المحصّل', filt.reduce((s,[,v])=>s+(v.amountPaid||v.amtPaid||0),0)],
    ['إجمالي المتبقي', filt.reduce((s,[,v])=>s+(v.balance||0),0)],
    ['عدد الفواتير', filt.length],
    ['من تاريخ', from||'—'],
    ['إلى تاريخ', to||'—'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'ملخص');
  XLSX.writeFile(wb, `تقرير-المبيعات-${from||'all'}-${to||'all'}.xlsx`);
  toast('✅ تم تصدير تقرير المبيعات');
}

function exportDebtsExcel() {
  if (typeof XLSX === 'undefined') { toast('مكتبة Excel غير محملة','error'); return; }
  const wb = XLSX.utils.book_new();
  // Customer debts
  const custRows = [['العميل','الهاتف','الدين (EGP)','آخر شراء']];
  Object.entries(S.customers).filter(([,c])=>(+c.balance||0)>0).sort(([,a],[,b])=>b.balance-a.balance).forEach(([,c]) => {
    custRows.push([c.name, c.phone||'—', +c.balance||0, c.lastDebtPaidAt||'—']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(custRows), 'ديون العملاء');
  // Supplier debts
  const supMap = {};
  Object.entries(S.purchases).filter(([,p])=>(+p.balance||0)>0).forEach(([,p]) => {
    const k = p.supplier;
    if (!supMap[k]) supMap[k] = {name:k, debt:0};
    supMap[k].debt += +p.balance||0;
  });
  const supRows = [['المورد','الدين (EGP)']];
  Object.values(supMap).sort((a,b)=>b.debt-a.debt).forEach(s => supRows.push([s.name, s.debt]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(supRows), 'ديون الموردين');
  XLSX.writeFile(wb, `تقرير-الديون-${today()}.xlsx`);
  toast('✅ تم تصدير تقرير الديون');
}

function exportProductsExcel() {
  if (typeof XLSX === 'undefined') { toast('مكتبة Excel غير محملة','error'); return; }
  const wb = XLSX.utils.book_new();
  const rows = [['الكود','اسم المنتج','الفئة','المخزن','الكمية','الحد الأدنى','سعر الشراء','سعر البيع','قيمة المخزون','الحالة']];
  Object.values(S.products).sort((a,b)=>a.name?.localeCompare(b.name,'ar')).forEach(p => {
    const qty = +p.qty||0; const min = +p.min||0;
    const status = qty===0?'نفد':qty<=min?'منخفض':'متاح';
    rows.push([p.code||'—', p.name, getCatName(p.cat), S.warehouses[p.whId]?.name||'—',
      qty, min, +p.cost||0, +p.price||0, qty*(+p.cost||0), status]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:12},{wch:28},{wch:14},{wch:16},{wch:8},{wch:8},{wch:12},{wch:12},{wch:14},{wch:8}];
  XLSX.utils.book_append_sheet(wb, ws, 'المنتجات');
  XLSX.writeFile(wb, `تقرير-المنتجات-${today()}.xlsx`);
  toast('✅ تم تصدير تقرير المنتجات');
}

function exportReturnsExcel() {
  if (typeof XLSX === 'undefined') { toast('مكتبة Excel غير محملة','error'); return; }
  const wb   = XLSX.utils.book_new();
  const rows = [['رقم المرتجع','التاريخ','العميل/المورد','النوع','الإجمالي','السبب','بواسطة']];
  Object.entries(S.returns||{}).sort(([,a],[,b])=>new Date(b.date)-new Date(a.date)).forEach(([id,r]) => {
    rows.push(['#'+id.slice(-6).toUpperCase(),(r.date||'').split('T')[0],
      r.custName||r.supplier||'—', r.type==='sale'?'مبيعات':'مشتريات',
      r.total||0, r.reason||'—', r.createdBy||'—']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'المرتجعات');
  XLSX.writeFile(wb, `تقرير-المرتجعات-${today()}.xlsx`);
  toast('✅ تم تصدير تقرير المرتجعات');
}
