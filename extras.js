/* ============================================================
   extras.js — دوال مكملة مستخرجة من الملف الأصلي
   الشمس - Al Shams ERP | المرحلة الأولى
   ============================================================ */

function addReturnItem(){
  retItems.push({prodId:'',name:'',qty:1,price:0});
  renderReturnItems();
}

function applyPermissions(){
  if(!CURRENT_USER)return;
  const role=CURRENT_USER.role||'cashier';

  if(role==='cashier'){
    // الكاشير: يرى فقط نقطة البيع
    document.querySelectorAll('.sb-section').forEach(sec=>sec.remove());
    // أعد إنشاء القائمة بعنصر واحد فقط
    const nav=document.querySelector('.sb-nav');
    if(nav){
      nav.innerHTML=`
        <div class="sb-section">
          <div class="sb-label">المبيعات</div>
          <div class="sb-item active" data-page="pos"><i class="fas fa-cash-register"></i> نقطة البيع</div>
        </div>`;
      // إعادة ربط حدث النقر
      nav.querySelectorAll('.sb-item').forEach(el=>{
        el.addEventListener('click',()=>{
          nav.querySelectorAll('.sb-item').forEach(i=>i.classList.remove('active'));
          el.classList.add('active');
          nav_direct(el.dataset.page);
        });
      });
    }
    // توجيه مباشر لنقطة البيع
    setTimeout(()=>nav_direct('pos'),50);
    // إخفاء أزرار الفوتبار غير المحتاجة
    const custBtn=document.querySelector('[onclick*="openCustomerSearch"]');
    if(custBtn) custBtn.style.display='none';
  }

  if(role==='accountant'){
    // المحاسب: يرى كل شيء ما عدا إدارة المستخدمين والإعدادات وإدارة الفئات
    document.querySelector('.sb-item[data-page="users"]')?.remove();
    document.querySelector('.sb-item[data-page="settings"]')?.remove();
    document.querySelector('.sb-item[data-page="inv-settings"]')?.remove();
    document.querySelector('.sb-item[data-page="categories"]')?.remove();
    document.querySelector('.sb-item[data-page="barcode"]')?.remove();
    // إخفاء أزرار الإضافة والحذف في المنتجات
    document.querySelectorAll('.btn-danger').forEach(btn=>{if(!btn.classList.contains('no-perm-hide'))btn.style.display='none';});
  }

  // admin: كل الصلاحيات - لا قيود
}

function calcReturnTotal(){
  const total=retItems.reduce((s,i)=>s+(+i.qty||0)*(+i.price||0),0);
  const el=document.getElementById('retf-total-val');
  if(el)el.textContent=N(total)+' EGP';
  return total;
}

function clearReturnInvoice(){
  const invSel=document.getElementById('retf-invoice-id');
  if(invSel)invSel.value='';
  retItems=[{prodId:'',name:'',qty:1,price:0}];
  renderReturnItems();
}

function downloadBackupExcel(){
  if(typeof XLSX==='undefined'){toast('مكتبة Excel غير محملة','error');return;}
  const wb=XLSX.utils.book_new();
  // Sheet 1: Products
  const prodData=Object.entries(S.products).map(([,p])=>({
    'اسم المنتج':p.name||'',
    'الكود':p.code||'',
    'الفئة':getCatName(p.cat),
    'المخزن':S.warehouses[p.whId]?.name||'',
    'الكمية':+p.qty||0,
    'الحد الأدنى':+p.min||0,
    'سعر الشراء':+p.cost||0,
    'سعر البيع':+p.price||0,
  }));
  if(prodData.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(prodData),'المنتجات');
  // Sheet 2: Customers
  const custData=Object.entries(S.customers).map(([,c])=>({
    'الاسم':c.name||'','الهاتف':c.phone||'','البريد':c.email||'',
    'العنوان':c.addr||'','إجمالي المشتريات':+c.totalBuy||0,'الديون':+c.balance||0,
  }));
  if(custData.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(custData),'العملاء');
  // Sheet 3: Suppliers
  const supData=Object.entries(S.suppliers).map(([,s])=>({'الاسم':s.name||'','الهاتف':s.phone||'','البريد':s.email||'','العنوان':s.addr||''}));
  if(supData.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(supData),'الموردون');
  // Sheet 4: Sales
  const salesData=Object.entries(S.sales).map(([id,s])=>({
    'رقم الفاتورة':'#'+id.slice(-5).toUpperCase(),
    'التاريخ':s.date?(new Date(s.date)).toLocaleDateString('ar-EG'):'',
    'العميل':s.custName||s.customerName||'نقدي',
    'الإجمالي':+s.total||0,'المدفوع':+s.amountPaid||+s.amtPaid||0,'المتبقي':+s.balance||0,
    'الحالة':s.status==='paid'?'مدفوع':s.status==='partial'?'جزئي':'غير مدفوع',
  }));
  if(salesData.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(salesData),'المبيعات');
  // Sheet 5: Purchases
  const purData=Object.entries(S.purchases).map(([id,p])=>({
    'رقم':'#'+id.slice(-5).toUpperCase(),'التاريخ':p.date||'','المورد':p.supplier||'',
    'الإجمالي':+p.total||0,'المدفوع':+p.amountPaid||0,'المتبقي':+p.balance||0,
    'الحالة':p.status==='paid'?'مدفوع':p.status==='partial'?'جزئي':'غير مدفوع',
  }));
  if(purData.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(purData),'المشتريات');
  // Sheet 6: Categories
  const catData=Object.entries(getAllCats()).map(([id,c])=>({'الكود':id,'الاسم':c.name||'','الأيقونة':c.icon||'','الوصف':c.desc||''}));
  if(catData.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(catData),'الفئات');
  const fname='نسخة-احتياطية-'+new Date().toISOString().split('T')[0]+'.xlsx';
  XLSX.writeFile(wb,fname);
  const now=new Date().toLocaleString('ar-EG');
  localStorage.setItem('ctg-last-backup',now);
  const el=document.getElementById('last-backup-time');
  if(el)el.textContent=now;
  toast('✅ تم تنزيل النسخة الاحتياطية Excel');
}

function downloadBackupJSON(){
  exportData(); // Reuse existing function
  const now=new Date().toLocaleString('ar-EG');
  localStorage.setItem('ctg-last-backup',now);
  const el=document.getElementById('last-backup-time');
  if(el)el.textContent=now;
}

function downloadPurchaseTemplate(){
  if(typeof XLSX==='undefined'){toast('مكتبة Excel غير محملة','error');return;}
  const wb=XLSX.utils.book_new();
  const supNames=Object.values(S.suppliers).map(s=>s.name).join(', ');
  const whNames=Object.values(S.warehouses).map(w=>w.name).join(', ');
  const prodNames=Object.values(S.products).slice(0,5).map(p=>p.name).join(', ');
  const headers=[['اسم المورد *','المخزن','التاريخ (YYYY-MM-DD)','اسم المنتج *','الكمية *','سعر الشراء *','طريقة الدفع','المبلغ المدفوع','ملاحظات']];
  const examples=[
    ['شركة النيل للتوزيع',Object.values(S.warehouses)[0]?.name||'المخزن الرئيسي',new Date().toISOString().split('T')[0],Object.values(S.products)[0]?.name||'Laptop Dell',5,8500,'cash',42500,'فاتورة شراء دفعة أولى'],
    ['شركة النيل للتوزيع',Object.values(S.warehouses)[0]?.name||'المخزن الرئيسي',new Date().toISOString().split('T')[0],Object.values(S.products)[1]?.name||'iPhone 15',3,25000,'cash',75000,''],
    ['مورد الإلكترونيات',Object.values(S.warehouses)[0]?.name||'المخزن الرئيسي',new Date().toISOString().split('T')[0],Object.values(S.products)[2]?.name||'Samsung Galaxy',2,18000,'credit',0,'دفع آجل'],
  ];
  const ws=XLSX.utils.aoa_to_sheet([...headers,...examples]);
  ws['!cols']=[{wch:25},{wch:20},{wch:18},{wch:28},{wch:10},{wch:16},{wch:14},{wch:16},{wch:30}];
  XLSX.utils.book_append_sheet(wb,ws,'فواتير الشراء');
  // Info sheet
  const infoData=[
    ['تعليمات استيراد فواتير الشراء'],
    [''],
    ['الحقل','إلزامي؟','الوصف','القيم المسموحة'],
    ['اسم المورد','✅ نعم','اسم المورد - سيتم إنشاؤه تلقائياً إن لم يكن موجوداً',''],
    ['المخزن','اختياري','اسم المخزن المستلم',''+whNames],
    ['التاريخ','اختياري','تاريخ الفاتورة بصيغة YYYY-MM-DD','مثال: '+new Date().toISOString().split('T')[0]],
    ['اسم المنتج','✅ نعم','اسم المنتج المشترى - يجب أن يكون موجوداً في النظام',''],
    ['الكمية','✅ نعم','عدد الوحدات المشتراة (رقم صحيح)',''],
    ['سعر الشراء','✅ نعم','سعر الوحدة الواحدة بالجنيه المصري',''],
    ['طريقة الدفع','اختياري','طريقة السداد','cash / card / transfer / credit'],
    ['المبلغ المدفوع','اختياري','المبلغ المدفوع فعلياً (0 = آجل)','رقم'],
    ['ملاحظات','اختياري','أي ملاحظات إضافية',''],
    [''],
    ['ملاحظة: كل صف = بند واحد في الفاتورة. الصفوف المتتالية لنفس المورد في نفس اليوم ستُجمع في فاتورة واحدة تلقائياً.'],
    ['الموردون المتاحون:',supNames||'لا يوجد موردون - سيتم إنشاؤهم تلقائياً'],
  ];
  const wsInfo=XLSX.utils.aoa_to_sheet(infoData);
  wsInfo['!cols']=[{wch:20},{wch:12},{wch:55},{wch:30}];
  XLSX.utils.book_append_sheet(wb,wsInfo,'تعليمات');
  XLSX.writeFile(wb,'نموذج-استيراد-فواتير-الشراء.xlsx');
  toast('✅ تم تنزيل نموذج فواتير الشراء');
}

function exportDebtsExcel(){
  const custData=Object.entries(S.customers).filter(([,c])=>(+c.balance||0)>0)
    .sort(([,a],[,b])=>(+b.balance||0)-(+a.balance||0))
    .map(([,c])=>({
      'النوع':'ديون العملاء (لنا)',
      'الاسم':c.name,
      'الهاتف':c.phone||'-',
      'إجمالي المشتريات':+(c.totalBuy||0),
      'المبلغ المستحق':+(c.balance||0),
      'الملاحظات':c.notes||'-'
    }));
  const supDebtMap={};
  Object.values(S.purchases).filter(p=>(+p.balance||0)>0).forEach(p=>{
    const k=p.supplierId||p.supplier;
    if(!supDebtMap[k])supDebtMap[k]={name:p.supplier,phone:S.suppliers[p.supplierId]?.phone||'-',debt:0,count:0};
    supDebtMap[k].debt+=+p.balance||0;
    supDebtMap[k].count+=1;
  });
  const supData=Object.values(supDebtMap).sort((a,b)=>b.debt-a.debt).map(d=>({
    'النوع':'ديوننا للموردين',
    'الاسم':d.name,
    'الهاتف':d.phone,
    'إجمالي المشتريات':0,
    'المبلغ المستحق':+d.debt,
    'الملاحظات':'عدد الفواتير: '+d.count
  }));
  exportToExcel([...custData,...supData],'تقرير-الديون-'+today(),'تقرير الديون');
}

function exportProductsExcel(){
  const data=Object.entries(S.products).sort(([,a],[,b])=>a.name?.localeCompare(b.name,'ar')).map(([,p])=>({
    'كود المنتج':p.code||'-',
    'اسم المنتج':p.name,
    'الفئة':getCatName(p.cat),
    'المخزن':S.warehouses[p.whId]?.name||'-',
    'الكمية المتاحة':+(p.qty||0),
    'الحد الأدنى':+(p.min||0),
    'سعر الشراء':+(p.cost||0),
    'سعر البيع':+(p.price||0),
    'هامش الربح (%)':p.price&&p.cost?+(((p.price-p.cost)/p.price*100).toFixed(1)):0,
    'الحالة':(+p.qty||0)===0?'نفد المخزون':(+p.qty||0)<=(+p.min||0)?'مخزون منخفض':'متاح'
  }));
  exportToExcel(data,'تقرير-المنتجات-'+today(),'تقرير المنتجات');
}

function exportReturnsExcel(){
  if(!window.XLSX){toast('مكتبة Excel غير متاحة','error');return;}
  const rows=Object.entries(S.returns||{}).map(([id,r])=>({
    'رقم المرتجع':'#'+id.slice(-5).toUpperCase(),
    'التاريخ':r.date||'',
    'النوع':r.type==='sale'?'مرتجع مبيعات':'مرتجع مشتريات',
    'العميل / المورد':r.partyName||r.customerName||r.supplierName||'',
    'الفاتورة الأصلية':r.invoiceId?('#'+r.invoiceId.slice(-5).toUpperCase()):'',
    'المنتجات':(r.items||[]).map(i=>`${i.name}(${i.qty})`).join(', '),
    'قيمة المرتجع':r.total||0,
    'طريقة الاسترداد':REFUND_METHODS[r.refundMethod]||r.refundMethod||'',
    'سبب الإرجاع':RETURN_REASONS[r.reason]||r.reason||'',
    'بواسطة':r.createdBy||''
  }));
  if(!rows.length){toast('لا توجد مرتجعات للتصدير','info');return;}
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'المرتجعات');
  XLSX.writeFile(wb,'returns_'+today()+'.xlsx');
  toast('تم تصدير المرتجعات');
}

function exportSalesExcel(){
  const data=Object.entries(S.sales).sort(([,a],[,b])=>new Date(b.date)-new Date(a.date)).map(([id,s])=>({
    'رقم الفاتورة':'#'+id.slice(-5).toUpperCase(),
    'التاريخ':s.date?(new Date(s.date)).toLocaleDateString('ar-EG'):'',
    'العميل':s.custName||s.customerName||'عميل نقدي',
    'المخزن':S.warehouses[s.warehouseId||s.whId]?.name||'-',
    'طريقة الدفع':PAY_NAMES[s.paymentMethod]||s.paymentMethod||'-',
    'الإجمالي':+(s.total||0),
    'المدفوع':+(s.amountPaid||s.amtPaid||0),
    'المتبقي':+(s.balance||0),
    'الحالة':s.status==='paid'?'مدفوع':s.status==='partial'?'جزئي':'غير مدفوع'
  }));
  exportToExcel(data,'تقرير-المبيعات-'+today(),'تقرير المبيعات');
}

function exportToExcel(data, filename, sheetTitle='تقرير'){
  if(!data||!data.length){toast('لا توجد بيانات للتصدير','error');return;}
  const headers=Object.keys(data[0]);
  const company=S.settings.company||'الشمس - Al Shams';
  const exportDate=new Date().toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'});

  // Build header colors based on context
  const headerBg='#1a1a2e';
  const headerColor='#ffffff';

  let tableRows='';
  data.forEach((row,i)=>{
    const bg=i%2===0?'#ffffff':'#f0f4f8';
    const cells=headers.map(h=>{
      let v=row[h]??'';
      // Number formatting
      if(typeof v==='number'){
        if(h.includes('سعر')||h.includes('إجمالي')||h.includes('مبلغ')||h.includes('دين')||h.includes('مدفوع')||h.includes('متبقي')||h.includes('إيراد')||h.includes('ربح')){
          v=v.toLocaleString('ar-EG',{minimumFractionDigits:2,maximumFractionDigits:2})+' EGP';
        }
      }
      // Status color
      let cellStyle=`padding:7px 10px;border:1px solid #d0d7de;font-size:12px;font-family:Cairo,Arial,sans-serif;direction:rtl;text-align:right;`;
      if(v==='مدفوع')cellStyle+=`color:#1a7f37;font-weight:700;background:#d4edda;`;
      else if(v==='غير مدفوع')cellStyle+=`color:#c62828;font-weight:700;background:#ffebee;`;
      else if(v==='جزئي')cellStyle+=`color:#e65100;font-weight:700;background:#fff3e0;`;
      else if(h.includes('دين')||h.includes('متبقي'))cellStyle+=`color:#c62828;font-weight:700;`;
      else if(h.includes('مدفوع')||h.includes('ربح'))cellStyle+=`color:#1a7f37;font-weight:700;`;
      else if(h.includes('رقم')||h.includes('كود'))cellStyle+=`color:#0969da;font-weight:700;`;
      else{cellStyle+=`background:${bg};`;}
      return`<td style="${cellStyle}">${v}</td>`;
    }).join('');
    tableRows+=`<tr>${cells}</tr>`;
  });

  // Summary row
  const numericCols=headers.filter(h=>data.some(r=>typeof r[h]==='number'));
  let summaryRow='';
  if(numericCols.length>0){
    summaryRow='<tr style="background:#1a1a2e;">';
    headers.forEach(h=>{
      if(numericCols.includes(h)){
        const sum=data.reduce((s,r)=>s+(typeof r[h]==='number'?r[h]:0),0);
        summaryRow+=`<td style="padding:8px 10px;border:1px solid #30363d;font-weight:900;color:#00d4ff;font-size:12px;font-family:Cairo,Arial;direction:rtl;text-align:right;">${sum.toLocaleString('ar-EG',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>`;
      }else{
        const label=h===headers[0]?'الإجمالي':'';
        summaryRow+=`<td style="padding:8px 10px;border:1px solid #30363d;font-weight:900;color:#ffffff;font-size:12px;font-family:Cairo,Arial;direction:rtl;text-align:right;">${label}</td>`;
      }
    });
    summaryRow+='</tr>';
  }

  const html=`
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<style>
  body{font-family:Cairo,Arial,sans-serif;direction:rtl;}
  table{border-collapse:collapse;width:100%;}
</style>
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>${sheetTitle}</x:Name>
<x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body>
<table>
  <!-- Company header -->
  <tr>
    <td colspan="${headers.length}" style="background:${headerBg};color:#ffffff;padding:14px 16px;font-size:16px;font-weight:900;font-family:Cairo,Arial;direction:rtl;text-align:center;border:none;">
      ${company} — ${sheetTitle}
    </td>
  </tr>
  <tr>
    <td colspan="${headers.length}" style="background:#21262d;color:#8b949e;padding:6px 16px;font-size:11px;font-family:Cairo,Arial;direction:rtl;text-align:center;border:none;">
      تاريخ التصدير: ${exportDate} | إجمالي السجلات: ${data.length}
    </td>
  </tr>
  <tr><td colspan="${headers.length}" style="height:6px;border:none;background:#f6f8fa;"></td></tr>
  <!-- Column headers -->
  <tr>
    ${headers.map(h=>`<th style="background:${headerBg};color:${headerColor};padding:10px 12px;border:1px solid #30363d;font-weight:700;font-size:12px;font-family:Cairo,Arial;direction:rtl;text-align:right;white-space:nowrap;">${h}</th>`).join('')}
  </tr>
  <!-- Data rows -->
  ${tableRows}
  <!-- Summary row -->
  ${summaryRow}
  <!-- Footer -->
  <tr><td colspan="${headers.length}" style="height:6px;border:none;background:#f6f8fa;"></td></tr>
  <tr>
    <td colspan="${headers.length}" style="background:#f6f8fa;color:#656d76;padding:8px 16px;font-size:10px;font-family:Cairo,Arial;direction:rtl;text-align:center;border:1px solid #d0d7de;">
      ${company} | تم إنشاء هذا التقرير بواسطة نظام الشمس
    </td>
  </tr>
</table>
</body></html>`;

  const blob=new Blob(['\uFEFF'+html],{type:'application/vnd.ms-excel;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename+'.xls';
  a.click();
  toast('✅ تم التصدير بصيغة Excel الاحترافية');
}

function getDashDateRange(){
  const now=new Date();
  const toStr=d=>d.toISOString().split('T')[0];
  const today=toStr(now);
  if(_dashPeriod==='today') return {from:today,to:today,label:'اليوم'};
  if(_dashPeriod==='week'){
    const mon=new Date(now);mon.setDate(now.getDate()-now.getDay());
    return {from:toStr(mon),to:today,label:'هذا الأسبوع'};
  }
  if(_dashPeriod==='month'){
    return {from:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`,to:today,label:'هذا الشهر'};
  }
  if(_dashPeriod==='year'){
    return {from:`${now.getFullYear()}-01-01`,to:today,label:'هذه السنة'};
  }
  if(_dashPeriod==='custom'){
    const f=document.getElementById('dash-from')?.value||'';
    const t=document.getElementById('dash-to')?.value||today;
    return {from:f,to:t,label:f&&t?`${f} → ${t}`:'مخصص'};
  }
  return {from:null,to:null,label:'الكل'};
}

async function importPurchasesFromExcel(event){
  const file=event.target.files[0];
  if(!file)return;
  if(typeof XLSX==='undefined'){toast('مكتبة Excel غير محملة','error');return;}
  try{
    toast('جارٍ قراءة الملف...','info');
    const data=await file.arrayBuffer();
    const wb=XLSX.read(data,{type:'array'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
    if(rows.length<2){toast('الملف فارغ','error');return;}
    const dataRows=rows.slice(1).filter(r=>r[0]&&String(r[0]).trim()&&r[3]&&String(r[3]).trim());
    if(!dataRows.length){toast('لا توجد بيانات صالحة','error');return;}
    // Build warehouse map
    const whMap={};
    Object.entries(S.warehouses).forEach(([id,w])=>{whMap[w.name?.toLowerCase()]=id;});
    // Build product map
    const prodMap={};
    Object.entries(S.products).forEach(([id,p])=>{prodMap[p.name?.toLowerCase()]=id;});
    // Build supplier map
    const supMap={};
    Object.entries(S.suppliers).forEach(([id,s])=>{supMap[s.name?.toLowerCase()]=id;});
    // Group rows into invoices: group by supplier + date
    const invoiceGroups={};
    for(const row of dataRows){
      const supName=String(row[0]||'').trim();
      const whName=String(row[1]||'').trim();
      const dateVal=String(row[2]||'').trim()||new Date().toISOString().split('T')[0];
      const prodName=String(row[3]||'').trim();
      const qty=parseInt(row[4])||1;
      const price=parseFloat(row[5])||0;
      const payMethod=String(row[6]||'cash').trim().toLowerCase()||'cash';
      const paid=parseFloat(row[7])||0;
      const notes=String(row[8]||'').trim();
      if(!supName||!prodName||!price)continue;
      const groupKey=supName.toLowerCase()+'||'+dateVal;
      if(!invoiceGroups[groupKey]){
        invoiceGroups[groupKey]={supName,whName,date:dateVal,payMethod,paid:0,notes,items:[]};
      }
      invoiceGroups[groupKey].paid=Math.max(invoiceGroups[groupKey].paid,paid);
      invoiceGroups[groupKey].items.push({prodName,qty,price});
    }
    let added=0,errors=[];
    for(const [,inv] of Object.entries(invoiceGroups)){
      try{
        // Ensure supplier exists
        let supId=supMap[inv.supName.toLowerCase()];
        if(!supId){
          supId=uid();
          const supData={name:inv.supName,phone:'',email:'',addr:'',notes:'مستورد من Excel',createdAt:new Date().toISOString()};
          await dbUpdate('suppliers/'+supId,supData);
          supMap[inv.supName.toLowerCase()]=supId;
        }
        // Find warehouse
        const whId=whMap[inv.whName?.toLowerCase()]||Object.keys(S.warehouses)[0]||'';
        // Build items list
        const items=[];
        let totalCost=0;
        for(const it of inv.items){
          const prodId=prodMap[it.prodName.toLowerCase()];
          if(!prodId){errors.push('منتج غير موجود: '+it.prodName);continue;}
          items.push({prodId,name:it.prodName,qty:it.qty,price:it.price});
          totalCost+=it.qty*it.price;
          // Update stock
          const p=S.products[prodId];
          if(p){
            const newQty=(+p.qty||0)+it.qty;
            await dbUpdate('products/'+prodId,{qty:newQty,cost:it.price,updatedAt:new Date().toISOString()});
            await dbPush('movements',{date:new Date(inv.date).toISOString(),product:it.prodName,type:'in',qty:it.qty,whId,note:'استيراد مشتريات Excel'});
          }
        }
        if(!items.length)continue;
        const amtPaid=Math.min(inv.paid||0,totalCost);
        const balance=totalCost-amtPaid;
        const status=balance<=0?'paid':amtPaid>0?'partial':'unpaid';
        const purData={
          supplierId:supId,supplier:inv.supName,warehouseId:whId,
          date:inv.date,items,total:totalCost,
          amountPaid:amtPaid,balance,status,
          paymentMethod:inv.payMethod||'cash',
          notes:inv.notes,createdAt:new Date().toISOString()
        };
        await dbPush('purchases',purData);
        added++;
      }catch(e){errors.push(inv.supName+': '+e.message);}
    }
    let msg=`✅ تم استيراد ${added} فاتورة شراء`;
    if(errors.length)msg+=` | ⚠️ ${errors.length} أخطاء`;
    toast(msg,errors.length?'info':'');
    if(errors.length)console.warn('Import errors:',errors);
  }catch(e){toast('خطأ في قراءة الملف: '+e.message,'error');}
  finally{event.target.value='';}
}

function inRange(dateStr,from,to){
  if(!from&&!to)return true;
  const d=(dateStr||'').slice(0,10);
  if(from&&d<from)return false;
  if(to&&d>to)return false;
  return true;
}

function onReturnInvoiceSelect(){
  const type=document.getElementById('retf-type')?.value||'sale';
  const invId=document.getElementById('retf-invoice-id')?.value||'';
  if(!invId){retItems=[{prodId:'',name:'',qty:1,price:0}];renderReturnItems();return;}
  if(type==='sale'){
    const sale=S.sales[invId];if(!sale)return;
    // pre-fill customer
    const custWrap=document.getElementById('retf-cust-wrap');
    if(custWrap&&(sale.custId||sale.customerId)){
      const cid=sale.custId||sale.customerId;
      const h=custWrap.querySelector('input[type=hidden]');
      const l=custWrap.querySelector('.ss-label');
      if(h)h.value=cid;
      if(l){l.textContent=S.customers[cid]?.name||sale.custName||sale.customerName||'عميل';l.style.color='var(--text)';}
    }
    // pre-fill warehouse
    const whId=sale.warehouseId||sale.whId||'';
    if(whId){
      const whWrap=document.getElementById('retf-wh-wrap');
      if(whWrap){
        const h=whWrap.querySelector('input[type=hidden]');
        const l=whWrap.querySelector('.ss-label');
        if(h)h.value=whId;
        if(l){l.textContent=S.warehouses[whId]?.name||'-';l.style.color='var(--text)';}
      }
    }
    // pre-fill items
    retItems=(sale.items||[]).map(it=>({prodId:it.prodId||'',name:it.name||'',qty:it.qty||1,price:it.price||0}));
    if(!retItems.length)retItems=[{prodId:'',name:'',qty:1,price:0}];
    renderReturnItems();
  } else {
    const pur=S.purchases[invId];if(!pur)return;
    // pre-fill supplier
    const supWrap=document.getElementById('retf-sup-wrap');
    if(supWrap&&pur.supplierId){
      const h=supWrap.querySelector('input[type=hidden]');
      const l=supWrap.querySelector('.ss-label');
      if(h)h.value=pur.supplierId;
      if(l){l.textContent=S.suppliers[pur.supplierId]?.name||pur.supplier||'-';l.style.color='var(--text)';}
    }
    // pre-fill warehouse
    const whId=pur.warehouseId||'';
    if(whId){
      const whWrap=document.getElementById('retf-wh-wrap');
      if(whWrap){
        const h=whWrap.querySelector('input[type=hidden]');
        const l=whWrap.querySelector('.ss-label');
        if(h)h.value=whId;
        if(l){l.textContent=S.warehouses[whId]?.name||'-';l.style.color='var(--text)';}
      }
    }
    retItems=(pur.items||[]).map(it=>({prodId:it.prodId||'',name:S.products[it.prodId]?.name||'',qty:it.qty||1,price:it.price||0}));
    if(!retItems.length)retItems=[{prodId:'',name:'',qty:1,price:0}];
    renderReturnItems();
  }
}

function onReturnTypeChange(){
  const type=document.getElementById('retf-type')?.value||'sale';
  const custWrap=document.getElementById('retf-party-wrap');
  const supWrap=document.getElementById('retf-sup-party-wrap');
  const invLbl=document.getElementById('retf-invoice-label');
  const invSel=document.getElementById('retf-invoice-id');
  if(type==='sale'){
    if(custWrap)custWrap.style.display='';
    if(supWrap)supWrap.style.display='none';
    if(invLbl)invLbl.textContent='فاتورة البيع الأصلية (اختياري)';
    // populate with sales invoices
    if(invSel){
      const opts='<option value="">-- بدون فاتورة أصلية --</option>'+
        Object.entries(S.sales).sort(([,a],[,b])=>new Date(b.date)-new Date(a.date))
        .map(([id,s])=>`<option value="${id}">#${id.slice(-5).toUpperCase()} — ${s.custName||s.customerName||'نقدي'} — ${N(s.total)} EGP — ${fDate(s.date)}</option>`).join('');
      invSel.innerHTML=opts;
    }
  } else {
    if(custWrap)custWrap.style.display='none';
    if(supWrap)supWrap.style.display='';
    if(invLbl)invLbl.textContent='فاتورة الشراء الأصلية (اختياري)';
    if(invSel){
      const opts='<option value="">-- بدون فاتورة أصلية --</option>'+
        Object.entries(S.purchases).sort(([,a],[,b])=>new Date(b.date)-new Date(a.date))
        .map(([id,p])=>`<option value="${id}">#${id.slice(-5).toUpperCase()} — ${p.supplier||'-'} — ${N(p.total)} EGP — ${fDate(p.date)}</option>`).join('');
      invSel.innerHTML=opts;
    }
  }
}

function openAddReturn(){
  retItems=[{prodId:'',name:'',qty:1,price:0}];
  document.getElementById('retf-date').value=today();
  document.getElementById('retf-notes').value='';
  document.getElementById('retf-reason').value='defective';
  document.getElementById('retf-refund-method').value='cash';
  // reset smart selects
  ['retf-cust-wrap','retf-sup-wrap','retf-wh-wrap'].forEach(wid=>{
    const wrap=document.getElementById(wid);if(!wrap)return;
    const h=wrap.querySelector('input[type=hidden]');
    const l=wrap.querySelector('.ss-label');
    if(h)h.value='';
    if(l){
      if(wid==='retf-cust-wrap')l.textContent='-- اختر عميل --';
      else if(wid==='retf-sup-wrap')l.textContent='-- اختر مورد --';
      else l.textContent='-- اختر مخزن --';
      l.style.color='var(--text3)';
    }
  });
  // reset invoice dropdown
  const invSel=document.getElementById('retf-invoice-id');
  if(invSel){invSel.innerHTML='<option value="">-- بدون فاتورة أصلية --</option>';}
  fillCashboxSelects();
  onReturnTypeChange();
  renderReturnItems();
  openModal('modal-return');
}

function openTransfer(){
  const opts=Object.entries(S.warehouses).map(([id,w])=>`<option value="${id}">${w.name}</option>`).join('');
  ['tr-from','tr-to'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=opts;});
  updateTransferProds();
  openModal('modal-transfer');
}

function printBatch(){
  const checked=[...document.querySelectorAll('.bc-chk:checked')];
  if(!checked.length){toast('يرجى تحديد منتج واحد على الأقل','error');return;}
  const type=document.getElementById('bc-type')?.value||'CODE128';
  const w2=parseFloat(document.getElementById('bc-w')?.value)||2;
  const h=parseInt(document.getElementById('bc-h')?.value)||80;
  const perPage=parseInt(document.getElementById('bc-per-page')?.value)||24;
  const cols=parseInt(document.getElementById('bc-cols')?.value)||3;
  const topEnabled=document.getElementById('bc-top-enable')?.checked;
  const topText=(document.getElementById('bc-top-text')?.value||'').trim();
  const bottomEnabled=document.getElementById('bc-bottom-enable')?.checked;
  const bottomTextTpl=(document.getElementById('bc-bottom-text')?.value||'').trim();
  const items=checked.map(c=>({code:c.dataset.code,name:c.dataset.name,price:c.dataset.price}));
  const w=window.open('','_blank','width=900,height=700');
  const width=Math.floor(100/cols)-2;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>طباعة باركودات</title><script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js"><\/script><style>body{margin:8px;direction:rtl;font-family:Cairo,sans-serif;}.bc{display:inline-block;border:1px dashed #ccc;padding:8px;margin:3px;text-align:center;vertical-align:top;width:${width}%;}.bc-n{font-size:10px;font-weight:700;color:#111;}.bc-p{font-size:9px;color:#555;}.bc-top{font-size:9px;font-weight:700;color:#111;}@page{size:A4;margin:8mm;}</style></head><body>
    <div style="text-align:center;font-size:10px;color:#555;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:6px;">${S.settings.company} - طباعة الباركودات</div>
    ${items.map((_,i)=>`<div class="bc">${topEnabled&&topText?`<div class="bc-top">${topText}</div>`:''}<svg id="s${i}"></svg><div class="bc-n">${items[i].name}</div>${items[i].price>0?`<div class="bc-p">${N(+items[i].price)} EGP</div>`:''}</div>`).join('')}
    <script>window.onload=function(){${items.map((it,i)=>`try{JsBarcode('#s${i}','${it.code.replace(/'/g,"\\'")}',{format:'${type}',width:${w2},height:${h},displayValue:true,fontSize:11,margin:5});}catch(e){}`).join('\n')}setTimeout(()=>window.print(),600);};<\/script></body></html>`);
  w.document.close();
}

function removeReturnItem(i){
  retItems.splice(i,1);
  if(!retItems.length)retItems=[{prodId:'',name:'',qty:1,price:0}];
  renderReturnItems();
}

function renderDashDebts(){
  const cdEl=document.getElementById('dash-cust-debts');
  if(cdEl){
    const debtors=Object.entries(S.customers).filter(([,c])=>(+c.balance||0)>0).sort(([,a],[,b])=>(+b.balance||0)-(+a.balance||0)).slice(0,5);
    cdEl.innerHTML=debtors.length?debtors.map(([id,c])=>`<tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.phone||'-'}</td>
      <td style="color:var(--red);font-weight:700;">${N(c.balance)} EGP</td>
      <td><button class="btn btn-success btn-xs" onclick="openPayDebt('cust','${id}','${id}')"><i class="fas fa-hand-holding-usd"></i></button></td>
    </tr>`).join(''):'<tr><td colspan="4" style="text-align:center;color:var(--green);padding:12px;"><i class="fas fa-check-circle"></i> لا ديون</td></tr>';
  }
  const sdEl=document.getElementById('dash-sup-debts');
  if(sdEl){
    const supDebtMap={};
    Object.entries(S.purchases).filter(([,p])=>(+p.balance||0)>0).forEach(([id,p])=>{
      const k=p.supplierId||id;
      if(!supDebtMap[k])supDebtMap[k]={name:p.supplier,debt:0,supId:p.supplierId};
      supDebtMap[k].debt+=+p.balance||0;
    });
    const supDebtors=Object.entries(supDebtMap).sort(([,a],[,b])=>b.debt-a.debt).slice(0,5);
    sdEl.innerHTML=supDebtors.length?supDebtors.map(([k,d])=>`<tr>
      <td><strong>${d.name}</strong></td>
      <td style="color:var(--yellow);font-weight:700;">${N(d.debt)} EGP</td>
      <td><button class="btn btn-warning btn-xs" onclick="openPayDebt('sup','${d.supId||k}','${k}')"><i class="fas fa-hand-holding-usd"></i></button></td>
    </tr>`).join(''):'<tr><td colspan="3" style="text-align:center;color:var(--green);padding:12px;"><i class="fas fa-check-circle"></i> لا ديون</td></tr>';
  }
}

function renderDashSales(){
  const rows=Object.entries(S.sales).sort(([,a],[,b])=>new Date(b.date)-new Date(a.date)).slice(0,6);
  const sm={paid:'badge-success',partial:'badge-warning',unpaid:'badge-danger'};
  const st={paid:'مدفوع',partial:'جزئي',unpaid:'غير مدفوع'};
  document.getElementById('dash-sales').innerHTML=rows.length
    ?rows.map(([id,s])=>`<tr><td style="color:var(--accent);font-weight:700;">#${id.slice(-5).toUpperCase()}</td><td>${s.custName||s.customerName||'نقدي'}</td><td style="font-weight:700;">${N(s.total)} EGP</td><td><span class="badge ${sm[s.status]||'badge-info'}">${st[s.status]||''}</span></td></tr>`).join('')
    :'<tr><td colspan="4" style="text-align:center;color:var(--text2);padding:16px;">لا توجد فواتير</td></tr>';
}

function renderReturnItems(){
  const el=document.getElementById('retf-items-list');
  if(!el)return;
  el.innerHTML=retItems.map((item,i)=>`
    <div style="display:grid;grid-template-columns:1fr 80px 120px 32px;gap:7px;margin-bottom:8px;align-items:center;">
      <input class="fc" placeholder="اسم المنتج / الصنف *" value="${escHtml(item.name)}"
        oninput="retItems[${i}].name=this.value" style="font-size:12px;font-weight:600;">
      <input class="fc" type="number" placeholder="الكمية" value="${item.qty}" min="1"
        oninput="retItems[${i}].qty=Math.max(1,+this.value);calcReturnTotal()" style="font-size:12px;">
      <input class="fc" type="number" placeholder="سعر الوحدة" value="${item.price}" min="0" step="0.01"
        oninput="retItems[${i}].price=+this.value;calcReturnTotal()" style="font-size:12px;">
      <button class="btn btn-danger btn-xs" onclick="removeReturnItem(${i})" title="حذف الصنف"><i class="fas fa-times"></i></button>
    </div>`).join('');
  calcReturnTotal();
}

function renderStockAlerts(){
  const low=Object.values(S.products).filter(p=>(+p.qty||0)<=(+p.min||0)&&(+p.qty||0)>0);
  const out=Object.values(S.products).filter(p=>(+p.qty||0)===0);
  const el=document.getElementById('dash-alerts');
  if(!low.length&&!out.length){el.innerHTML='<div style="text-align:center;color:var(--green);padding:14px;font-size:12px;"><i class="fas fa-check-circle" style="font-size:20px;display:block;margin-bottom:5px;"></i>المخزن بخير!</div>';return;}
  el.innerHTML=[
    ...out.map(p=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border2);font-size:12px;"><span style="color:var(--red);"><i class="fas fa-times-circle"></i> ${p.name}</span><span class="badge badge-danger">نفد</span></div>`),
    ...low.map(p=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border2);font-size:12px;"><span style="color:var(--yellow);"><i class="fas fa-exclamation-triangle"></i> ${p.name}</span><span class="badge badge-warning">${p.qty} متبقي</span></div>`)
  ].join('');
}

function renderTopProducts(){
  const map={};
  Object.values(S.sales).forEach(s=>(s.items||[]).forEach(it=>{
    if(!map[it.name])map[it.name]={qty:0,rev:0,cat:S.products[it.prodId]?.cat||''};
    map[it.name].qty+=it.qty||0;map[it.name].rev+=(it.qty||0)*(it.price||0);
  }));
  const top=Object.entries(map).sort(([,a],[,b])=>b.qty-a.qty).slice(0,5);
  const tbody=document.getElementById('dash-top-products');
  if(!top.length){tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text2);padding:16px;">لا بيانات</td></tr>';return;}
  tbody.innerHTML=top.map(([name,d],i)=>`<tr>
    <td style="color:var(--accent);font-weight:900;">${i+1}</td>
    <td><strong>${name}</strong></td>
    <td><span class="badge badge-info">${getCatName(d.cat)}</span></td>
    <td>${d.qty} وحدة</td>
    <td style="color:var(--green);font-weight:700;">${N(d.rev)} EGP</td>
  </tr>`).join('');
}

function renderWeekChart(){
  const days=[0,1,2,3,4,5,6];
  const now=new Date();
  const vals=days.map(d=>{
    const dt=new Date(now);dt.setDate(now.getDate()-now.getDay()+d);
    const key=dt.toISOString().split('T')[0];
    return Object.values(S.sales).filter(s=>(s.date||'').startsWith(key)).reduce((s,v)=>s+(v.total||0),0);
  });
  const mx=Math.max(...vals,1);
  const colors=['#00d4ff','#a371f7','#3fb950','#d29922','#f85149','#06b6d4','#8b5cf6'];
  const el=document.getElementById('week-chart');
  if(el)el.innerHTML=vals.map((v,i)=>`<div class="bar-col"><div class="bar" style="height:${Math.max(v/mx*90,v>0?3:0)}px;background:${colors[i]};"></div></div>`).join('');
}

function scheduleAutoBackup(){
  // Check if already set
  const existing=localStorage.getItem('ctg-auto-backup');
  if(existing==='true'){
    if(!confirm('النسخ التلقائي اليومي مفعّل بالفعل. هل تريد إيقافه؟'))return;
    localStorage.removeItem('ctg-auto-backup');
    toast('تم إيقاف النسخ التلقائي اليومي','info');
    return;
  }
  localStorage.setItem('ctg-auto-backup','true');
  toast('✅ تم تفعيل النسخ التلقائي اليومي - سيتم التنزيل عند فتح البرنامج كل يوم');
}

function showApp(){
  document.getElementById('login-screen').style.display='none';
  document.querySelector('.layout').style.display='flex';
  const info=document.getElementById('topbar-user-info');
  if(info&&CURRENT_USER){
    const roleMap={admin:'مدير',cashier:'كاشير',accountant:'محاسب'};
    const roleClass={admin:'role-admin',cashier:'role-cashier',accountant:'role-accountant'};
    info.style.display='flex';
    info.innerHTML=`<i class="fas fa-user-circle" style="color:var(--accent);font-size:16px;"></i> <strong>${CURRENT_USER.name||CURRENT_USER.username}</strong> <span class="user-role-badge ${roleClass[CURRENT_USER.role]||'role-accountant'}">${roleMap[CURRENT_USER.role]||CURRENT_USER.role}</span>`;
  }
  applyPermissions();
}

function viewReturn(r){
  const st=S.settings||{};
  const typeLabel=r.type==='sale'?'مرتجع مبيعات':'مرتجع مشتريات';
  const partyLabel=r.type==='sale'?'العميل:':'المورد:';
  const partyName=r.partyName||r.customerName||r.supplierName||'—';
  const whName=S.warehouses[r.warehouseId]?.name||r.warehouseId||'—';
  const origInvStr=r.invoiceId?`#${r.invoiceId.slice(-5).toUpperCase()}`:'—';
  const itemsHtml=(r.items||[]).map((it,i)=>`
    <tr style="background:${i%2===0?'#fff':'#faf6f1'};border-bottom:1px solid #e0d5c8;">
      <td style="padding:8px 12px;">${i+1}</td>
      <td style="padding:8px 12px;font-weight:600;">${escHtml(it.name||'—')}</td>
      <td style="padding:8px 12px;">${it.qty||0}</td>
      <td style="padding:8px 12px;">${N(it.price||0)} ${st.curr||'EGP'}</td>
      <td style="padding:8px 12px;font-weight:700;color:#c00;">${N((it.qty||0)*(it.price||0))} ${st.curr||'EGP'}</td>
    </tr>`).join('');

  const html=`
  <div style="direction:rtl;font-family:'Cairo',Arial,sans-serif;background:#fff;color:#000;padding:0;font-size:13px;max-width:800px;margin:0 auto;border:1px solid #ddd;">
    <!-- Header -->
    <div style="background:#fff;border-bottom:3px solid #c00;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:16px;font-weight:900;color:#000;">${st.company||'الشمس - Al Shams'}</div>
        <div style="font-size:10px;color:#555;">${st.web||''} | 📞 ${st.phone||''}</div>
      </div>
      <div style="text-align:left;">
        <div style="font-size:22px;font-weight:900;color:#c00;letter-spacing:1px;">${typeLabel}</div>
        <div style="font-size:10px;color:#555;">#${(r.id||'').slice(-6).toUpperCase()}</div>
      </div>
    </div>
    <!-- Info Grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:2px solid #000;background:#fff;">
      <div style="padding:12px 20px;border-left:1px solid #ddd;">
        <table style="width:100%;font-size:11px;border-collapse:collapse;">
          <tr><td style="color:#555;padding:3px 0;width:130px;">اسم الشركة:</td><td style="font-weight:700;">${st.company||'الشمس - Al Shams'}</td></tr>
          <tr><td style="color:#555;padding:3px 0;">المخزن:</td><td>${whName}</td></tr>
          <tr><td style="color:#555;padding:3px 0;">طريقة الاسترداد:</td><td style="font-weight:700;">${REFUND_METHODS[r.refundMethod]||r.refundMethod||'—'}</td></tr>
          <tr><td style="color:#555;padding:3px 0;">بواسطة:</td><td>${r.createdBy||'—'}</td></tr>
        </table>
      </div>
      <div style="padding:12px 20px;">
        <table style="width:100%;font-size:11px;border-collapse:collapse;">
          <tr><td style="color:#555;padding:3px 0;width:130px;">${partyLabel}</td><td style="font-weight:700;">${partyName}</td></tr>
          <tr><td style="color:#555;padding:3px 0;">التاريخ:</td><td>${fDate(r.date)}</td></tr>
          <tr><td style="color:#555;padding:3px 0;">سبب الإرجاع:</td><td style="font-weight:700;">${RETURN_REASONS[r.reason]||r.reason||'—'}</td></tr>
          <tr><td style="color:#555;padding:3px 0;">الفاتورة الأصلية:</td><td>${origInvStr}</td></tr>
        </table>
      </div>
    </div>
    <!-- Items Table -->
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead>
        <tr style="background:#fff;border-bottom:2px solid #000;border-top:1px solid #000;">
          <th style="padding:9px 12px;text-align:right;font-weight:700;">#</th>
          <th style="padding:9px 12px;text-align:right;font-weight:700;">الصنف</th>
          <th style="padding:9px 12px;text-align:right;font-weight:700;">الكمية</th>
          <th style="padding:9px 12px;text-align:right;font-weight:700;">سعر الوحدة</th>
          <th style="padding:9px 12px;text-align:right;font-weight:700;">الإجمالي</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <!-- Total -->
    <div style="border-top:2px solid #000;padding:14px 20px;display:flex;justify-content:flex-end;background:#fff;">
      <div style="background:#fff0f0;border:2px solid #c00;border-radius:8px;padding:12px 24px;text-align:center;min-width:220px;">
        <div style="font-size:11px;color:#555;">إجمالي قيمة المرتجع</div>
        <div style="font-size:22px;font-weight:900;color:#c00;">${N(r.total)} ${st.curr||'EGP'}</div>
      </div>
    </div>
    <!-- Notes -->
    ${r.notes?`<div style="border-top:1px solid #ddd;padding:10px 20px;font-size:11px;color:#333;background:#fafafa;">ملاحظات: ${escHtml(r.notes)}</div>`:''}
    <!-- Footer -->
    <div style="border-top:2px solid #000;padding:10px 20px;text-align:center;font-size:10px;color:#555;">
      ${st.company||'الشمس - Al Shams'} | ${st.web||''} | 📞 ${st.phone||''}
    </div>
  </div>`;

  const body=document.getElementById('ret-view-body');
  if(body)body.innerHTML=html;
  const printArea=document.getElementById('inv-print-area');
  if(printArea)printArea.innerHTML=html;
  openModal('modal-ret-view');
}

function _ky(path){return(path||'').split('/')[1]||null;}

function _st(path){return(path||'').split('/')[0];}
// ============================================================
// Wrappers for OM methods exposed globally
// ============================================================
function flushQueue() { return OM.flushQueue(); }
function scheduleAutoBackup() {
  const last = localStorage.getItem('ctg-last-backup');
  const now  = Date.now();
  localStorage.setItem('ctg-last-backup', now.toString());
  updateBackupInfo && updateBackupInfo();
}

// ============================================================
// PHASE 2 — Activity Logging Hooks + User Activity View
// ============================================================
function viewUserActivity(userId) {
  const u = S.users[userId]; if (!u) return;
  toast(`جارٍ تحميل نشاط ${u.name}...`, 'info');
  AL.load(200).then(logs => {
    const userLogs = logs.filter(l => l.userId === u.username).slice(0, 50);
    nav('activity');
    setTimeout(() => {
      const tbody = document.getElementById('activity-tbl'); if (!tbody) return;
      const actionLabels = {
        'sale_created':'فاتورة بيع','purchase_created':'فاتورة شراء',
        'product_added':'إضافة منتج','product_edited':'تعديل منتج','product_deleted':'حذف منتج',
        'customer_added':'إضافة عميل','expense_added':'إضافة مصروف',
        'return_created':'مرتجع','cashbox_deposit':'إيداع خزينة','cashbox_withdraw':'صرف خزينة',
        'debt_collected':'تحصيل دين','login':'تسجيل دخول','logout':'تسجيل خروج'
      };
      tbody.innerHTML = userLogs.length
        ? userLogs.map(l => `<tr>
            <td style="font-size:11px;color:var(--text2);">${new Date(l.timestamp).toLocaleString('ar-EG')}</td>
            <td><strong>${l.userName}</strong><br><span style="font-size:10px;color:var(--text3);">@${l.userId}</span></td>
            <td>${l.branchName||'-'}</td>
            <td>${actionLabels[l.action]||l.action}</td>
            <td style="font-size:11px;color:var(--text2);">${l.details||'-'}</td>
          </tr>`).join('')
        : '<tr><td colspan="5" style="text-align:center;color:var(--text2);padding:20px;">لا يوجد نشاط لهذا المستخدم</td></tr>';
    }, 300);
  });
}

// ============================================================
// PHASE 2 — Global Report (All Branches) for superadmin
// ============================================================
async function loadGlobalReport() {
  if (CURRENT_USER?.role !== 'superadmin') return;
  const today    = new Date().toISOString().split('T')[0];
  const branches = Object.keys(BS.branches);
  let globalSales = 0, globalProfit = 0, globalDebts = 0;
  const branchStats = [];

  for (const bid of branches) {
    await new Promise(res => {
      FB.$onValue(FB.$ref(DB,`ctg/branches/${bid}/sales`), snap => {
        const sales = snap.val()||{};
        const total = Object.values(sales).reduce((s,v)=>s+(v.total||0),0);
        const paid  = Object.values(sales).reduce((s,v)=>s+(v.amountPaid||v.amtPaid||0),0);
        const cogs  = Object.values(sales).reduce((s,v)=>s+(v.items||[]).reduce((ss,i)=>ss+((i.cost||0)*(i.qty||0)),0),0);
        globalSales  += total;
        globalProfit += paid - cogs;
        branchStats.push({id:bid, name:BS.branches[bid]?.name||bid, total, paid, profit:paid-cogs});
        res();
      },{onlyOnce:true});
    });
    await new Promise(res => {
      FB.$onValue(FB.$ref(DB,`ctg/branches/${bid}/customers`), snap => {
        const custs = snap.val()||{};
        globalDebts += Object.values(custs).reduce((s,c)=>s+(+c.balance||0),0);
        res();
      },{onlyOnce:true});
    });
  }

  const el1 = document.getElementById('global-sales');  if(el1) el1.textContent = N(globalSales,0) + ' EGP';
  const el2 = document.getElementById('global-profit'); if(el2) el2.textContent = N(globalProfit,0) + ' EGP';
  const el3 = document.getElementById('global-debts');  if(el3) el3.textContent = N(globalDebts,0)  + ' EGP';

  const tbl = document.getElementById('global-branch-tbl');
  if (tbl) {
    tbl.innerHTML = branchStats.sort((a,b)=>b.total-a.total).map((b,i) => `<tr>
      <td style="color:var(--accent);font-weight:900;">${i+1}</td>
      <td><strong>${b.name}</strong></td>
      <td style="font-weight:700;">${N(b.total)} EGP</td>
      <td style="color:var(--green);">${N(b.paid)} EGP</td>
      <td style="color:${b.profit>=0?'var(--green)':'var(--red)'};font-weight:700;">${N(b.profit)} EGP</td>
      <td><button class="btn btn-ghost btn-xs" onclick="switchBranch('${b.id}');nav('reports');setPeriod('month')"><i class="fas fa-chart-bar"></i></button></td>
    </tr>`).join('');
  }
}
