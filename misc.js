/* ============================================================
   expenses.js — المصروفات
   الشمس - Al Shams ERP | المرحلة الأولى
   ============================================================ */
async function saveExpense() {
  const desc   = (document.getElementById('ef-desc').value||'').trim();
  const amount = parseFloat(document.getElementById('ef-amount').value)||0;
  if (!desc||!amount) { toast('يرجى إدخال البيان والمبلغ','error'); return; }
  const cbId = document.getElementById('ef-cashbox')?.value||'';
  try {
    await dbPush('expenses',{date:document.getElementById('ef-date').value, desc, cat:document.getElementById('ef-cat').value, amount, cashboxId:cbId, createdAt:new Date().toISOString(), createdBy:getCU()});
    if (cbId) await addCashboxEntry(cbId, amount, 'withdraw', `مصروف: ${desc}`, 'مصروفات');
    closeModal('modal-exp'); toast('تم حفظ المصروف');
  } catch(e) { toast('خطأ: '+e.message,'error'); }
}
function renderExpenses() {
  const catN = {rent:'إيجار',salary:'مرتبات',utilities:'كهرباء',transport:'مواصلات',marketing:'تسويق',maintenance:'صيانة',other:'أخرى'};
  const rows = Object.entries(S.expenses).sort(([,a],[,b])=>new Date(b.date)-new Date(a.date));
  document.getElementById('exp-tbl').innerHTML = rows.length
    ? rows.map(([id,e])=>`<tr><td>${e.date||'-'}</td><td>${e.desc}</td><td><span class="badge badge-purple">${catN[e.cat]||e.cat}</span></td><td style="color:var(--red);font-weight:700;">${N(e.amount)} EGP</td><td style="font-size:11px;color:var(--text2);">${e.createdBy||'-'}</td><td><button class="btn btn-danger btn-xs" onclick="delExpense('${id}')"><i class="fas fa-trash"></i></button></td></tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:16px;">لا توجد مصروفات</td></tr>';
}
async function delExpense(id) { if(!confirm('حذف؟'))return; await dbRemove('expenses/'+id); toast('تم الحذف'); }

/* ============================================================
   returns.js — المرتجعات
   ============================================================ */
function renderReturns() {
  const tbody = document.getElementById('ret-tbl'); if(!tbody) return;
  const rows  = Object.entries(S.returns||{}).sort(([,a],[,b])=>new Date(b.date)-new Date(a.date));
  tbody.innerHTML = rows.length
    ? rows.map(([id,r])=>`<tr>
        <td style="color:var(--purple);font-weight:700;">#${id.slice(-5).toUpperCase()}</td>
        <td style="font-size:11px;">${fDate(r.date)}</td>
        <td>${r.custName||r.supplier||'-'}</td>
        <td><span class="badge badge-purple">${r.type==='sale'?'مرتجع مبيعات':'مرتجع مشتريات'}</span></td>
        <td style="font-weight:700;">${N(r.total||0)} EGP</td>
        <td style="font-size:11px;color:var(--text2);">${r.reason||'-'}</td>
        <td style="font-size:11px;color:var(--text2);">${r.createdBy||'-'}</td>
        <td><button class="btn btn-danger btn-xs" onclick="delReturn('${id}')"><i class="fas fa-trash"></i></button></td>
      </tr>`).join('')
    : '<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:20px;">لا توجد مرتجعات</td></tr>';
}

async function delReturn(id) { if(!confirm('حذف هذا المرتجع؟'))return; await dbRemove('returns/'+id); toast('تم الحذف'); }

function openReturnFromInvoice(type, invoiceId) {
  const r = document.getElementById('retf-type');   if(r)r.value=type;
  const ri= document.getElementById('retf-inv-id'); if(ri)ri.value=invoiceId;
  document.getElementById('retf-reason').value='';
  document.getElementById('retf-date').value=today();
  const itemsEl = document.getElementById('retf-items');
  if (type==='sale') {
    const sale=S.sales[invoiceId]; if(!sale){toast('الفاتورة غير موجودة','error');return;}
    document.getElementById('ret-modal-title').textContent = 'مرتجع مبيعات - فاتورة #'+invoiceId.slice(-5).toUpperCase();
    if(itemsEl) itemsEl.innerHTML=(sale.items||[]).map((it,i)=>`
      <div style="display:flex;align-items:center;gap:10px;padding:9px;background:var(--card2);border-radius:8px;margin-bottom:7px;">
        <input type="checkbox" class="ret-chk" data-idx="${i}" data-max="${it.qty}" data-price="${it.price}" data-name="${it.name}" data-prod-id="${it.prodId||''}" style="accent-color:var(--accent);width:16px;height:16px;">
        <div style="flex:1;font-size:13px;font-weight:600;">${it.name}</div>
        <div style="font-size:12px;color:var(--text2);">${it.qty} × ${N(it.price)} = ${N(it.qty*it.price)} EGP</div>
        <input type="number" class="fc ret-qty-in" style="width:70px;font-size:12px;" value="${it.qty}" min="1" max="${it.qty}" placeholder="كمية">
      </div>`).join('');
  } else {
    const pur=S.purchases[invoiceId]; if(!pur){toast('الفاتورة غير موجودة','error');return;}
    document.getElementById('ret-modal-title').textContent = 'مرتجع مشتريات - فاتورة #'+invoiceId.slice(-5).toUpperCase();
    if(itemsEl) itemsEl.innerHTML=(pur.items||[]).map((it,i)=>{
      const prod=S.products[it.prodId]||{name:it.prodId};
      return `<div style="display:flex;align-items:center;gap:10px;padding:9px;background:var(--card2);border-radius:8px;margin-bottom:7px;">
        <input type="checkbox" class="ret-chk" data-idx="${i}" data-max="${it.qty}" data-price="${it.price}" data-name="${prod.name}" data-prod-id="${it.prodId||''}" style="accent-color:var(--accent);width:16px;height:16px;">
        <div style="flex:1;font-size:13px;font-weight:600;">${prod.name}</div>
        <div style="font-size:12px;color:var(--text2);">${it.qty} × ${N(it.price)} = ${N(it.qty*it.price)} EGP</div>
        <input type="number" class="fc ret-qty-in" style="width:70px;font-size:12px;" value="${it.qty}" min="1" max="${it.qty}" placeholder="كمية">
      </div>`;
    }).join('');
  }
  fillCashboxSelects();
  openModal('modal-return');
}

async function saveReturn() {
  const type      = document.getElementById('retf-type').value;
  const invoiceId = document.getElementById('retf-inv-id').value;
  const reason    = document.getElementById('retf-reason').value.trim();
  const date      = document.getElementById('retf-date').value||today();
  const cbId      = document.getElementById('retf-cashbox')?.value||'';
  const checked   = [...document.querySelectorAll('.ret-chk:checked')];
  if (!checked.length) { toast('يرجى تحديد المنتجات المرتجعة','error'); return; }
  const retItems  = checked.map((chk,ci) => {
    const row     = chk.closest('div');
    const qtyIn   = row.querySelector('.ret-qty-in');
    const qty     = Math.max(1, Math.min(parseInt(qtyIn?.value)||1, parseInt(chk.dataset.max)||1));
    return {prodId:chk.dataset.prodId, name:chk.dataset.name, qty, price:+chk.dataset.price};
  });
  const total = retItems.reduce((s,i)=>s+(i.qty*i.price),0);
  try {
    const retData = {type, invoiceId, date, reason, items:retItems, total, createdBy:getCU(), createdAt:new Date().toISOString()};
    if (type==='sale') {
      const sale=S.sales[invoiceId]; retData.custName=sale?.custName||sale?.customerName||'';
      for(const it of retItems){const p=S.products[it.prodId];if(p)await dbUpdate('products/'+it.prodId,{qty:(+p.qty||0)+it.qty});}
      if(cbId&&total>0)await addCashboxEntry(cbId,total,'withdraw',`مرتجع مبيعات #${invoiceId.slice(-5).toUpperCase()}`,invoiceId.slice(-6));
    } else {
      const pur=S.purchases[invoiceId]; retData.supplier=pur?.supplier||'';
      for(const it of retItems){const p=S.products[it.prodId];if(p)await dbUpdate('products/'+it.prodId,{qty:Math.max(0,(+p.qty||0)-it.qty)});}
      if(cbId&&total>0)await addCashboxEntry(cbId,total,'deposit',`مرتجع مشتريات #${invoiceId.slice(-5).toUpperCase()}`,invoiceId.slice(-6));
    }
    await dbPush('returns', retData);
    closeModal('modal-return');
    toast(`تم تسجيل المرتجع - إجمالي: ${N(total)} EGP ✅`);
  } catch(e) { toast('خطأ: '+e.message,'error'); }
}

/* ============================================================
   settings.js — الإعدادات
   ============================================================ */
function loadSettingsUI() {
  const cfg = S.settings;
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.value=v; };
  set('s-company', cfg.company||''); set('s-phone', cfg.phone||'');
  set('s-web',     cfg.web||'');     set('s-addr',   cfg.addr||'');
  set('s-curr',    cfg.curr||'EGP'); set('s-warranty',cfg.warranty||3);
  set('s-bank',    cfg.bank||'');    set('s-account', cfg.account||'');
  set('s-swift',   cfg.swift||'');
  set('s-default-disc',      cfg.defaultDisc||0);
  set('s-default-disc-type', cfg.defaultDiscType||'percent');
  set('s-default-tax',       cfg.defaultTax||0);
  set('s-default-tax-type',  cfg.defaultTaxType||'percent');
}

async function saveSettings() {
  const g = id => document.getElementById(id)?.value;
  S.settings = {...S.settings,
    company: g('s-company').trim(), phone:   g('s-phone').trim(),
    web:     g('s-web').trim(),     addr:    g('s-addr').trim(),
    curr:    g('s-curr'),           warranty:parseInt(g('s-warranty'))||3,
    bank:    g('s-bank').trim(),    account: g('s-account').trim(),
    swift:   g('s-swift').trim(),
    defaultDisc:     parseFloat(g('s-default-disc'))||0,
    defaultDiscType: g('s-default-disc-type')||'percent',
    defaultTax:      parseFloat(g('s-default-tax'))||0,
    defaultTaxType:  g('s-default-tax-type')||'percent'
  };
  await dbUpdate('settings', S.settings)
    .then(() => toast('تم حفظ الإعدادات'))
    .catch(e => toast(e.message,'error'));
}

// Invoice settings
function previewLogo(event) {
  const file=event.target.files[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{ S.settings.invLogo=e.target.result; const p=document.getElementById('inv-logo-preview'); if(p) p.innerHTML=`<img src="${e.target.result}" style="max-width:100%;max-height:100%;object-fit:contain;">`; };
  reader.readAsDataURL(file);
}
function clearLogo() { S.settings.invLogo=''; const p=document.getElementById('inv-logo-preview'); if(p) p.innerHTML='<i class="fas fa-image" style="font-size:24px;color:var(--text3);"></i>'; }

function loadInvSettingsUI() {
  const c=S.settings;
  const g=(id,def)=>{const el=document.getElementById(id);if(el&&c[id]!==undefined)el.value=c[id];else if(el&&def!==undefined)el.value=def;};
  const gc=(id,def)=>{const el=document.getElementById(id);if(el)el.checked=(c[id]!==undefined?c[id]:def);};
  g('inv-title-text','فاتورة بيع');g('inv-title-sub','SALES INVOICE');g('inv-header-icon','💻');
  g('inv-font-size','12');g('inv-logo-size',c['inv-logo-size']||70);
  g('inv-warranty-text','نقدم ضماناً ضد عيوب التصنيع');g('inv-return-text','يمكنكم الاسترجاع خلال 14 يوم');
  g('inv-nowarranty-text','الكسر أو التلف المادي');g('inv-footer-text','شكراً لتعاملكم معنا');
  g('inv-footer-extra','');g('inv-salesman','');g('inv-bill-to-label','فاتورة إلى:');
  g('inv-summary-label','إجمالي الأمر');g('inv-payment-label','الدفع المقترح');
  g('inv-grandtotal-label','إجمالي الفاتورة');g('inv-col-name-label','الوصف');
  g('inv-col-qty-label','الكمية');g('inv-col-price-label','السعر');
  gc('inv-col-seq',true);gc('inv-col-name',true);gc('inv-col-wh',true);gc('inv-col-qty',true);
  gc('inv-col-price',true);gc('inv-col-total',true);gc('inv-col-disc',true);gc('inv-col-serial',true);
  gc('inv-show-warranty',true);gc('inv-show-bank',true);gc('inv-show-salesman',true);gc('inv-show-notes',true);
  if(c.invLogo){const p=document.getElementById('inv-logo-preview');if(p)p.innerHTML=`<img src="${c.invLogo}" style="max-width:100%;max-height:100%;object-fit:contain;">`;}
  const szLbl=document.getElementById('inv-logo-size-lbl');if(szLbl)szLbl.textContent=(c['inv-logo-size']||70)+'px';
  const fsLbl=document.getElementById('inv-font-size-lbl');if(fsLbl)fsLbl.textContent=(c['inv-font-size']||12)+'px';
}

async function saveInvSettings() {
  const g  = id=>{const el=document.getElementById(id);return el?el.value:undefined;};
  const gc = id=>{const el=document.getElementById(id);return el?el.checked:true;};
  const invCfg = {
    'inv-title-text':g('inv-title-text'),'inv-title-sub':g('inv-title-sub'),
    'inv-header-icon':g('inv-header-icon'),'inv-font-size':g('inv-font-size'),
    'inv-logo-size':g('inv-logo-size'),'inv-warranty-text':g('inv-warranty-text'),
    'inv-return-text':g('inv-return-text'),'inv-nowarranty-text':g('inv-nowarranty-text'),
    'inv-footer-text':g('inv-footer-text'),'inv-footer-extra':g('inv-footer-extra'),
    'inv-salesman':g('inv-salesman'),'inv-bill-to-label':g('inv-bill-to-label'),
    'inv-summary-label':g('inv-summary-label'),'inv-payment-label':g('inv-payment-label'),
    'inv-grandtotal-label':g('inv-grandtotal-label'),'inv-col-name-label':g('inv-col-name-label'),
    'inv-col-qty-label':g('inv-col-qty-label'),'inv-col-price-label':g('inv-col-price-label'),
    'inv-col-seq':gc('inv-col-seq'),'inv-col-name':gc('inv-col-name'),'inv-col-wh':gc('inv-col-wh'),
    'inv-col-qty':gc('inv-col-qty'),'inv-col-price':gc('inv-col-price'),'inv-col-total':gc('inv-col-total'),
    'inv-col-disc':gc('inv-col-disc'),'inv-col-serial':gc('inv-col-serial'),
    'inv-show-warranty':gc('inv-show-warranty'),'inv-show-bank':gc('inv-show-bank'),
    'inv-show-salesman':gc('inv-show-salesman'),'inv-show-notes':gc('inv-show-notes'),
    invLogo:S.settings.invLogo||''
  };
  S.settings = {...S.settings, ...invCfg};
  await dbUpdate('settings', S.settings).then(()=>toast('تم حفظ إعدادات الفاتورة ✅')).catch(e=>toast(e.message,'error'));
}

function previewInvoiceSample() {
  showInvoice({id:'PREVIEW001',date:new Date().toISOString(),custName:'عميل تجريبي',customerName:'عميل تجريبي',customerId:'',custId:'',items:[{name:'منتج تجريبي - Laptop Dell',qty:2,price:15000,cost:12000}],subtotal:30000,total:30000,discount:0,amountPaid:15000,amtPaid:15000,balance:15000,paymentMethod:'cash',notes:'هذه معاينة فقط'});
}

// Backup / Restore
function exportData() {
  const b=new Blob([JSON.stringify(S,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='ctg-backup-'+today()+'.json';a.click();
}
function importData() { document.getElementById('import-file').click(); }
async function doImportData(e) {
  const file=e.target.files[0];if(!file)return;
  try {
    const text=await file.text(); const data=JSON.parse(text);
    if(!data||typeof data!=='object'){toast('ملف غير صالح','error');return;}
    if(!confirm('سيتم دمج البيانات مع الحالية. متابعة؟'))return;
    const updates={};
    ['products','customers','warehouses','sales','purchases','expenses','suppliers','movements','categories','cashboxes','cashboxLog','settings'].forEach(k=>{if(data[k])updates['ctg/'+k]=data[k];});
    await FB.$update(FB.$ref(DB),updates);
    toast('تم الاستيراد بنجاح');
    document.getElementById('import-file').value='';
  } catch(err){toast('خطأ: '+err.message,'error');}
}

function openClearAllModal() {
  if(!CURRENT_USER||CURRENT_USER.role!=='admin'){toast('هذه العملية للمدير فقط','error');return;}
  document.getElementById('clear-username').value='';document.getElementById('clear-password').value='';
  document.getElementById('clear-err').style.display='none';
  openModal('modal-clear-all');
  setTimeout(()=>document.getElementById('clear-username')?.focus(),200);
}
async function verifyClearAll() {
  const username=(document.getElementById('clear-username').value||'').trim().toLowerCase();
  const pass=document.getElementById('clear-password').value||'';
  const errEl=document.getElementById('clear-err');errEl.style.display='none';
  if(!username||!pass){errEl.textContent='يرجى إدخال اسم المستخدم وكلمة المرور';errEl.style.display='block';return;}
  const found=Object.entries(S.users||{}).find(([,u])=>u.username===username&&u.role==='admin'&&u.status==='active');
  if(!found){errEl.textContent='اسم المستخدم غير صحيح أو ليس مديراً';errEl.style.display='block';return;}
  if(found[1].password!==btoa(pass)){errEl.textContent='كلمة المرور غير صحيحة';errEl.style.display='block';return;}
  if(!confirm('⚠️ تأكيد أخير: سيتم حذف كل البيانات نهائياً!'))return;
  closeModal('modal-clear-all');
  await clearAll();
}
async function clearAll() {
  try {
    toast('جارٍ مسح البيانات...','info');
    await FB.$remove(FB.$ref(DB,'ctg'));
    ['products','customers','warehouses','sales','purchases','expenses','suppliers','movements','categories','cashboxes','cashboxLog','users','returns'].forEach(k=>S[k]={});
    S.settings={company:'الشمس - Al Shams',phone:'01028631512',web:'https://computer.ordersapps.com/ar',addr:'',curr:'EGP',warranty:3,bank:'',account:'',swift:''};
    renderProducts();renderCustomers();renderWarehouses();renderSales();renderPurchases();
    renderExpenses();renderSuppliers();renderMovements();renderCategories();renderCashboxes();
    updateDashboard();updateFinance();loadSettingsUI();
    CURRENT_USER=null;sessionStorage.removeItem('ctg-user');
    setTimeout(()=>{toast('✅ تم مسح البيانات - يرجى إعادة تسجيل الدخول');setTimeout(()=>{document.getElementById('login-screen').style.display='flex';document.querySelector('.layout').style.display='none';},1000);},500);
  } catch(e){toast('خطأ: '+e.message,'error');}
}
function confirmClearAll(){openClearAllModal();}

function updateBackupInfo() {
  const el=document.getElementById('last-backup-info');
  if(!el)return;
  const ts=localStorage.getItem('ctg-last-backup');
  el.textContent=ts?('آخر نسخ احتياطي: '+new Date(ts).toLocaleString('ar-EG')):'لم يتم إجراء نسخ احتياطي بعد';
}
function checkAutoBackup() {
  const lastBak=localStorage.getItem('ctg-last-backup');
  const now=Date.now();
  if(!lastBak||now-parseInt(lastBak)>7*24*60*60*1000){
    localStorage.setItem('ctg-last-backup',now.toString());
    updateBackupInfo();
  }
}

/* ============================================================
   barcode.js — منشئ الباركود
   ============================================================ */
function initBC() { updateBCSelects(); renderBCProdList(); genBC(); }

function genBC() {
  const val=(document.getElementById('bc-val')?.value||'').trim();
  const err=document.getElementById('bc-err');
  const preview=document.getElementById('bc-preview');
  if(preview)preview.style.background=document.getElementById('bc-bg')?.value||'#fff';
  if(!val){if(err){err.style.display='block';err.textContent='يرجى إدخال قيمة الباركود';}return;}
  if(err)err.style.display='none';
  try{
    JsBarcode('#bc-svg',val,{format:document.getElementById('bc-type')?.value||'CODE128',lineColor:document.getElementById('bc-color')?.value||'#000',background:document.getElementById('bc-bg')?.value||'#fff',width:parseFloat(document.getElementById('bc-w')?.value)||2,height:parseInt(document.getElementById('bc-h')?.value)||80,displayValue:document.getElementById('bc-show')?.value==='true',font:'Cairo',fontSize:13,textMargin:4,margin:8,valid:()=>true});
    updateBCLabel();updateSheet();
  }catch(e){if(err){err.style.display='block';err.textContent='خطأ: '+e.message;}document.getElementById('bc-svg').innerHTML='';}
}
function updateBCLabel(){
  const lbl=(document.getElementById('bc-lbl')?.value||'').trim();
  const topText=(document.getElementById('bc-top-text')?.value||'').trim();
  const bottomText=(document.getElementById('bc-bottom-text')?.value||'').trim();
  const topEnabled=document.getElementById('bc-top-enable')?.checked;
  const bottomEnabled=document.getElementById('bc-bottom-enable')?.checked;
  const elLbl=document.getElementById('bc-lbl-show');if(elLbl)elLbl.textContent=lbl;
  const elTop=document.getElementById('bc-top-lbl');
  if(elTop){elTop.textContent=topText||S.settings.company||'';elTop.style.display=topEnabled&&topText?'block':'none';}
  const elBot=document.getElementById('bc-bottom-lbl');
  if(elBot){elBot.textContent=bottomText;elBot.style.display=bottomEnabled&&bottomText?'block':'none';}
  updateSheet();
}
function updateSheet(){
  const sh=document.getElementById('bc-sheet');if(!sh)return;
  const cols=parseInt(document.getElementById('bc-cols')?.value)||3;
  const perPage=Math.min(parseInt(document.getElementById('bc-per-page')?.value)||24,100);
  const svgEl=document.getElementById('bc-svg');if(!svgEl||!svgEl.innerHTML)return;
  const svgHTML=svgEl.outerHTML;
  const lbl=(document.getElementById('bc-lbl')?.value||'').trim();
  const topText=(document.getElementById('bc-top-text')?.value||'').trim();
  const bottomText=(document.getElementById('bc-bottom-text')?.value||'').trim();
  const topEnabled=document.getElementById('bc-top-enable')?.checked;
  const bottomEnabled=document.getElementById('bc-bottom-enable')?.checked;
  const bg=document.getElementById('bc-bg')?.value||'#fff';
  sh.style.gridTemplateColumns=`repeat(${cols},1fr)`;
  const cell=`<div style="background:${bg};border:1px dashed #ccc;border-radius:4px;padding:5px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;">${topEnabled&&topText?`<div style="font-size:7px;font-weight:700;">${topText}</div>`:''}<div style="transform:scale(.5);transform-origin:top center;margin-bottom:-30px;">${svgHTML}</div>${lbl?`<div style="font-size:7px;font-weight:700;">${lbl}</div>`:''} ${bottomEnabled&&bottomText?`<div style="font-size:6px;">${bottomText}</div>`:''}</div>`;
  sh.innerHTML=Array(Math.min(perPage,50)).fill(cell).join('');
}
function importBC(){const id=document.getElementById('bc-prod')?.value;if(!id||!S.products[id])return;const p=S.products[id];const v=document.getElementById('bc-val');if(v)v.value=p.code||id.slice(-8).toUpperCase();const l=document.getElementById('bc-lbl');if(l)l.value=p.name||'';genBC();}
function renderBCProdList(){const el=document.getElementById('bc-prod-list');if(!el)return;const prods=Object.entries(S.products);if(!prods.length){el.innerHTML='<div style="text-align:center;color:var(--text2);font-size:11px;padding:10px;">لا توجد منتجات</div>';return;}el.innerHTML=prods.map(([id,p])=>`<label style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--card2);border-radius:7px;cursor:pointer;font-size:12px;border:1px solid var(--border2);"><input type="checkbox" class="bc-chk" data-id="${id}" data-code="${p.code||id.slice(-8).toUpperCase()}" data-name="${p.name||''}" data-price="${p.price||0}" style="accent-color:var(--accent);"><span style="flex:1;font-weight:600;">${p.name}</span><span style="color:var(--text3);font-size:10px;">${p.code||'-'}</span></label>`).join('');}
function dlSVG(){const svg=document.getElementById('bc-svg');if(!svg)return;const blob=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='barcode.svg';a.click();}
function dlPNG(){const svg=document.getElementById('bc-svg');if(!svg)return;const svgData=new XMLSerializer().serializeToString(svg);const canvas=document.createElement('canvas');const img=new Image();const blob=new Blob([svgData],{type:'image/svg+xml'});const url=URL.createObjectURL(blob);img.onload=()=>{canvas.width=img.width*2;canvas.height=img.height*2;const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.fillStyle=document.getElementById('bc-bg')?.value||'#fff';ctx.fillRect(0,0,img.width,img.height);ctx.drawImage(img,0,0);const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='barcode.png';a.click();URL.revokeObjectURL(url);};img.src=url;}
function printBC(){const svg=document.getElementById('bc-svg');if(!svg||!svg.innerHTML){toast('يرجى توليد الباركود أولاً','error');return;}const perPage=parseInt(document.getElementById('bc-per-page')?.value)||24;const cols=parseInt(document.getElementById('bc-cols')?.value)||3;const svgH=svg.outerHTML;const lbl=(document.getElementById('bc-lbl')?.value||'').trim();const bg=document.getElementById('bc-bg')?.value||'#fff';const cell=`<div style="display:inline-block;background:${bg};border:1px dashed #ccc;padding:8px;margin:3px;text-align:center;vertical-align:top;width:${Math.floor(100/cols)-2}%;">${svgH}${lbl?`<div style="font-size:10px;font-weight:700;">${lbl}</div>`:''}</div>`;const w=window.open('','_blank','width=860,height=700');w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>طباعة باركود</title><style>body{margin:8px;direction:rtl;}@page{size:A4 portrait;margin:8mm;}</style></head><body><div style="text-align:center;font-size:10px;color:#555;margin-bottom:6px;">${S.settings.company}</div>${Array(Math.min(perPage,100)).fill(cell).join('')}<script>window.onload=()=>window.print();<\/script></body></html>`);w.document.close();}

/* ============================================================
   dashboard.js — لوحة التحكم
   ============================================================ */
function updateDashboard() {
  const now   = new Date();
  const todayStr = today();
  const activePeriod = document.querySelector('.dash-period-btn.active')?.dataset?.period || 'month';
  let from;
  if (activePeriod==='today')  from = todayStr;
  else if (activePeriod==='week')  { const d=new Date(now); d.setDate(now.getDate()-now.getDay()); from=d.toISOString().split('T')[0]; }
  else if (activePeriod==='month') from = new Date(now.getFullYear(),now.getMonth(),1).toISOString().split('T')[0];
  else from = new Date(now.getFullYear(),0,1).toISOString().split('T')[0];
  const filt = Object.entries(S.sales).filter(([,s]) => { const d=(s.date||'').split('T')[0]; return d>=from && d<=todayStr; });
  const totalRev  = filt.reduce((s,[,v])=>s+(v.total||0),0);
  const totalPaid = filt.reduce((s,[,v])=>s+(v.amountPaid||v.amtPaid||0),0);
  const totalCOGS = filt.reduce((s,[,v])=>s+(v.items||[]).reduce((ss,i)=>ss+((i.cost||0)*(i.qty||0)),0),0);
  const profit    = totalPaid - totalCOGS;
  const products  = Object.keys(S.products).length;
  const custDebt  = Object.values(S.customers).reduce((s,c)=>s+(+c.balance||0),0);
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set('d-sales',   N(totalRev,0));
  set('d-profit',  N(profit,0));
  set('d-products',products);
  set('d-debts',   N(custDebt,0));
  // Recent sales
  const recTbl = document.getElementById('d-rec-sales');
  if (recTbl) {
    const recents = Object.entries(S.sales).sort(([,a],[,b])=>new Date(b.date)-new Date(a.date)).slice(0,6);
    const stM={paid:['badge-success','مدفوع'],partial:['badge-warning','جزئي'],unpaid:['badge-danger','غير مدفوع']};
    recTbl.innerHTML=recents.length?recents.map(([id,s])=>{const[cls,lbl]=stM[s.status]||['badge-info',''];return`<tr><td style="color:var(--accent);font-weight:700;font-size:12px;">#${id.slice(-5).toUpperCase()}</td><td style="font-size:12px;">${s.custName||s.customerName||'نقدي'}</td><td style="font-weight:700;font-size:12px;">${N(s.total)} EGP</td><td><span class="badge ${cls}" style="font-size:10px;">${lbl}</span></td><td style="font-size:11px;color:var(--text2);">${fDate(s.date)}</td></tr>`;}).join(''):'<tr><td colspan="5" style="text-align:center;color:var(--text2);padding:14px;font-size:12px;">لا توجد مبيعات</td></tr>';
  }
  // Low stock
  const lowTbl = document.getElementById('d-low-stock');
  if (lowTbl) {
    const low = Object.entries(S.products).filter(([,p])=>(+p.qty||0)<=(+p.min||0)).slice(0,5);
    lowTbl.innerHTML=low.length?low.map(([,p])=>`<tr><td>${p.name}</td><td style="color:${(+p.qty||0)===0?'var(--red)':'var(--yellow)'};font-weight:700;">${p.qty||0}</td><td>${p.min||5}</td><td>${S.warehouses[p.whId]?.name||'-'}</td></tr>`).join(''):'<tr><td colspan="4" style="text-align:center;color:var(--green);padding:12px;font-size:12px;"><i class="fas fa-check-circle"></i> كل المنتجات في مستواها الطبيعي</td></tr>';
  }
  // Cashboxes summary
  const cbSummary = document.getElementById('d-cashboxes');
  if (cbSummary) {
    const cbs = Object.values(S.cashboxes);
    const total = cbs.reduce((s,c)=>s+(+c.balance||0),0);
    cbSummary.textContent = N(total,0) + ' EGP';
  }
}

function setDashPeriod(period) {
  document.querySelectorAll('.dash-period-btn').forEach(btn => { btn.classList.toggle('active', btn.dataset.period===period); });
  updateDashboard();
}
