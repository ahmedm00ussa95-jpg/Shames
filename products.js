/* ============================================================
   products.js — إدارة المنتجات
   الشمس - Al Shams ERP | المرحلة الأولى
   ============================================================ */

let editingProd = null;

function openAddProduct() {
  editingProd = null;
  document.getElementById('prod-modal-title').textContent = 'منتج جديد';
  resetForm('pf');
  document.getElementById('pf-qty').value = '1';
  document.getElementById('pf-min').value = '5';
  fillCatSelects(); updateWhSelects();
  openModal('modal-product');
}

function editProduct(id) {
  editingProd = id;
  const p = S.products[id];
  document.getElementById('prod-modal-title').textContent = 'تعديل منتج';
  document.getElementById('pf-name').value   = p.name   || '';
  document.getElementById('pf-code').value   = p.code   || '';
  document.getElementById('pf-serial').value = p.serial || '';
  fillCatSelects();
  document.getElementById('pf-cat').value    = p.cat    || 'laptop';
  updateWhSelects();
  document.getElementById('pf-wh').value     = p.whId   || '';
  document.getElementById('pf-qty').value    = p.qty    || 0;
  document.getElementById('pf-min').value    = p.min    || 5;
  document.getElementById('pf-cost').value   = p.cost   || 0;
  document.getElementById('pf-price').value  = p.price  || 0;
  document.getElementById('pf-desc').value   = p.desc   || '';
  openModal('modal-product');
}

async function saveProduct() {
  const name  = (document.getElementById('pf-name').value||'').trim();
  if (!name) { toast('يرجى إدخال اسم المنتج','error'); return; }
  const whId  = document.getElementById('pf-wh').value;
  const newQty= parseInt(document.getElementById('pf-qty').value)||0;
  const data  = {
    name,
    code:   document.getElementById('pf-code').value.trim(),
    serial: document.getElementById('pf-serial').value.trim(),
    cat:    document.getElementById('pf-cat').value,
    whId, qty: newQty,
    min:    parseInt(document.getElementById('pf-min').value)||5,
    cost:   parseFloat(document.getElementById('pf-cost').value)||0,
    price:  parseFloat(document.getElementById('pf-price').value)||0,
    desc:   document.getElementById('pf-desc').value.trim(),
    updatedAt: new Date().toISOString(), updatedBy: getCU()
  };
  try {
    if (editingProd) {
      const oldQty = S.products[editingProd]?.qty || 0;
      await dbUpdate(`products/${editingProd}`, data);
      if (newQty !== oldQty) await dbPush('movements', {date:new Date().toISOString(), product:name, type:newQty>oldQty?'in':'out', qty:Math.abs(newQty-oldQty), whId, note:'تعديل يدوي'});
    } else {
      data.createdAt = new Date().toISOString();
      const key = uid();
      await dbUpdate(`products/${key}`, data);
      if (newQty > 0) await dbPush('movements', {date:new Date().toISOString(), product:name, type:'in', qty:newQty, whId, note:'مخزون أولي'});
    }
    closeModal('modal-product');
    toast('تم حفظ المنتج');
    editingProd = null;
  } catch(e) { toast(e.message,'error'); }
}

function renderProducts() {
  const tbody = document.getElementById('prod-tbl'); if (!tbody) return;
  const search = (document.getElementById('prod-search')?.value||'').toLowerCase();
  const cat    = document.getElementById('prod-cat')?.value   || '';
  const wh     = document.getElementById('prod-wh-filter')?.value || '';
  const prods  = Object.entries(S.products).filter(([,p]) =>
    (!search || p.name?.toLowerCase().includes(search) || p.code?.toLowerCase().includes(search)) &&
    (!cat    || p.cat  === cat) && (!wh || p.whId === wh)
  );
  tbody.innerHTML = prods.length
    ? prods.map(([id, p]) => {
        const whName = S.warehouses[p.whId]?.name || '<span style="color:var(--red)">بدون مخزن</span>';
        const qty = +p.qty||0; const min = +p.min||0;
        const st  = qty===0 ? 'badge-danger' : qty<=min ? 'badge-warning' : 'badge-success';
        const stT = qty===0 ? 'نفد'          : qty<=min ? 'منخفض'         : 'متاح';
        return `<tr>
          <td style="color:var(--text2);font-size:11px;">${p.code||'-'}</td>
          <td><strong>${p.name}</strong>${p.desc?`<br><span style="font-size:10px;color:var(--text2);">${p.desc.substring(0,50)}</span>`:''}</td>
          <td><span class="badge badge-info">${getCatName(p.cat)}</span></td>
          <td>${whName}</td>
          <td><strong>${qty}</strong></td>
          <td>${N(p.cost)} EGP</td>
          <td style="color:var(--accent);font-weight:700;">${N(p.price)} EGP</td>
          <td>${min}</td>
          <td><span class="badge ${st}">${stT}</span></td>
          <td>
            <button class="btn btn-ghost btn-xs" onclick="editProduct('${id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-xs" onclick="delProduct('${id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="10" style="text-align:center;color:var(--text2);padding:20px;">لا توجد منتجات</td></tr>';
}

async function delProduct(id) {
  if (!confirm('حذف هذا المنتج؟')) return;
  await dbRemove(`products/${id}`);
  toast('تم الحذف');
}

// Excel import
function downloadProductTemplate() {
  if (typeof XLSX==='undefined') { toast('مكتبة Excel غير محملة','error'); return; }
  const wb = XLSX.utils.book_new();
  const cats = getAllCats();
  const catNames = Object.values(cats).map(c => c.name).join(', ');
  const whNames  = Object.values(S.warehouses).map(w => w.name).join(', ');
  const headers  = [['اسم المنتج *','كود المنتج','الفئة *','المخزن *','الكمية','الحد الأدنى','سعر الشراء (EGP) *','سعر البيع (EGP) *','وصف','السيريال نمبر']];
  const examples = [
    ['Laptop Dell Inspiron 15','DELL-INS-001','لاب توب',Object.values(S.warehouses)[0]?.name||'المخزن الرئيسي',10,3,8500,12000,'معالج Core i5 - رام 8GB','SN-DELL001'],
    ['iPhone 15 Pro','IPH-15P-128','أخرى',Object.values(S.warehouses)[0]?.name||'المخزن الرئيسي',5,2,25000,32000,'128GB - أسود','SN-IPH001'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...headers, ...examples]);
  ws['!cols'] = [{wch:28},{wch:18},{wch:18},{wch:20},{wch:10},{wch:12},{wch:18},{wch:18},{wch:35},{wch:20}];
  const infoData = [
    ['تعليمات استيراد المنتجات'],[''],
    ['الحقل','إلزامي؟','الوصف'],
    ['اسم المنتج','✅ نعم','اسم المنتج كما سيظهر في النظام'],
    ['الفئة','✅ نعم','اسم الفئة - يجب أن تكون موجودة: '+catNames],
    ['المخزن','✅ مهم','اسم المخزن: '+whNames],
    ['سعر الشراء','✅ نعم','سعر شراء المنتج بالجنيه'],
    ['سعر البيع','✅ نعم','سعر بيع المنتج بالجنيه'],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
  wsInfo['!cols'] = [{wch:20},{wch:12},{wch:60}];
  XLSX.utils.book_append_sheet(wb, ws, 'المنتجات');
  XLSX.utils.book_append_sheet(wb, wsInfo, 'تعليمات');
  XLSX.writeFile(wb, 'نموذج-استيراد-المنتجات.xlsx');
  toast('✅ تم تنزيل نموذج المنتجات');
}

async function importProductsFromExcel(event) {
  const file = event.target.files[0]; if (!file) return;
  if (typeof XLSX==='undefined') { toast('مكتبة Excel غير محملة','error'); return; }
  try {
    toast('جارٍ قراءة الملف...','info');
    const data = await file.arrayBuffer();
    const wb   = XLSX.read(data, {type:'array'});
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
    if (rows.length < 2) { toast('الملف فارغ','error'); return; }
    const dataRows = rows.slice(1).filter(r => r[0] && String(r[0]).trim());
    if (!dataRows.length) { toast('لا توجد بيانات صالحة','error'); return; }
    const cats = getAllCats();
    const catMap = {};
    Object.entries(cats).forEach(([id,c]) => { catMap[(c.name||'').toLowerCase().trim()] = id; });
    const whMap = {};
    Object.entries(S.warehouses).forEach(([id,w]) => { whMap[(w.name||'').toLowerCase().trim()] = id; });
    let added=0, updated=0, errors=[];
    for (const row of dataRows) {
      const name  = String(row[0]||'').trim();
      const code  = String(row[1]||'').trim();
      const catN  = String(row[2]||'').trim().toLowerCase();
      const whN   = String(row[3]||'').trim().toLowerCase();
      const qty   = parseInt(row[4])||0;
      const min   = parseInt(row[5])||5;
      const cost  = parseFloat(row[6])||0;
      const price = parseFloat(row[7])||0;
      const desc  = String(row[8]||'').trim();
      const serial= String(row[9]||'').trim();
      if (!name) continue;
      const catId = catMap[catN] || Object.keys(cats)[0] || 'other';
      const whId  = whMap[whN]   || Object.keys(S.warehouses)[0] || '';
      const existing = Object.entries(S.products).find(([,p]) => p.name===name || (code && p.code===code));
      const prodData = {name, code, cat:catId, whId, qty, min, cost, price, desc, serial, updatedAt:new Date().toISOString()};
      try {
        if (existing) {
          await dbUpdate('products/'+existing[0], prodData); updated++;
        } else {
          prodData.createdAt = new Date().toISOString();
          await dbUpdate('products/'+uid(), prodData);
          if (qty>0) await dbPush('movements', {date:new Date().toISOString(), product:name, type:'in', qty, whId, note:'استيراد Excel'});
          added++;
        }
      } catch(e) { errors.push(name+': '+e.message); }
    }
    let msg = `✅ تم الاستيراد: ${added} جديد, ${updated} محدث`;
    if (errors.length) msg += ` | ⚠️ ${errors.length} أخطاء`;
    toast(msg, errors.length ? 'info' : 'success');
  } catch(e) { toast('خطأ: '+e.message,'error'); }
  finally { event.target.value = ''; }
}

// Quick add product (from purchase modal)
function openQuickAddProduct() {
  fillCatSelects(); updateWhSelects();
  const srcCat = document.getElementById('pf-cat');
  const srcWh  = document.getElementById('pf-wh');
  const destCat= document.getElementById('qpf-cat');
  const destWh = document.getElementById('qpf-wh');
  if (srcCat && destCat) destCat.innerHTML = srcCat.innerHTML;
  if (srcWh  && destWh)  destWh.innerHTML  = srcWh.innerHTML;
  ['qpf-name','qpf-code','qpf-desc','qpf-serial'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  const qQty = document.getElementById('qpf-qty');   if(qQty)  qQty.value  = '0';
  const qMin = document.getElementById('qpf-min');   if(qMin)  qMin.value  = '5';
  const qCost= document.getElementById('qpf-cost');  if(qCost) qCost.value = '';
  const qPri = document.getElementById('qpf-price'); if(qPri)  qPri.value  = '';
  openModal('modal-quick-product');
  setTimeout(() => document.getElementById('qpf-name')?.focus(), 200);
}

async function saveQuickProduct() {
  const name = (document.getElementById('qpf-name')?.value||'').trim();
  if (!name) { toast('اسم المنتج مطلوب','error'); return; }
  const whId = document.getElementById('qpf-wh')?.value;
  if (!whId) { toast('اختر المخزن','error'); return; }
  const data = {
    name, code:  document.getElementById('qpf-code')?.value.trim(),
    cat:   document.getElementById('qpf-cat')?.value,  whId,
    qty:   parseInt(document.getElementById('qpf-qty')?.value)||0,
    min:   parseInt(document.getElementById('qpf-min')?.value)||5,
    cost:  parseFloat(document.getElementById('qpf-cost')?.value)||0,
    price: parseFloat(document.getElementById('qpf-price')?.value)||0,
    desc:  document.getElementById('qpf-desc')?.value.trim(),
    serial:document.getElementById('qpf-serial')?.value.trim(),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  try {
    const newKey = uid();
    await dbUpdate('products/' + newKey, data);
    S.products[newKey] = data;
    if (typeof purItems !== 'undefined') {
      purItems.push({prodId: newKey, qty: 1, price: data.cost||0});
      renderPurItems();
    }
    closeModal('modal-quick-product');
    toast('تم إضافة المنتج وإضافته للفاتورة ✓','success');
  } catch(e) { toast('خطأ: ' + e.message,'error'); }
}

// ============================================================
// PHASE 3 — Enhanced product table with history + adjust buttons
// ============================================================
function renderProducts() {
  const tbody = document.getElementById('prod-tbl'); if (!tbody) return;
  const search = (document.getElementById('prod-search')?.value||'').toLowerCase();
  const cat    = document.getElementById('prod-cat')?.value   || '';
  const wh     = document.getElementById('prod-wh-filter')?.value || '';
  const prods  = Object.entries(S.products).filter(([,p]) =>
    (!search || p.name?.toLowerCase().includes(search) || p.code?.toLowerCase().includes(search)) &&
    (!cat    || p.cat  === cat) && (!wh || p.whId === wh)
  );
  tbody.innerHTML = prods.length
    ? prods.map(([id, p]) => {
        const whName = S.warehouses[p.whId]?.name || '<span style="color:var(--red)">بدون مخزن</span>';
        const qty = +p.qty||0; const min = +p.min||0;
        const st  = qty===0 ? 'badge-danger' : qty<=min ? 'badge-warning' : 'badge-success';
        const stT = qty===0 ? 'نفد'          : qty<=min ? 'منخفض'         : 'متاح';
        const profitPct = p.cost>0 ? (((p.price-p.cost)/p.cost)*100).toFixed(0)+'%' : '—';
        return `<tr>
          <td style="color:var(--text2);font-size:11px;">${p.code||'—'}</td>
          <td><strong>${p.name}</strong>${p.desc?`<br><span style="font-size:10px;color:var(--text2);">${p.desc.substring(0,40)}</span>`:''}</td>
          <td><span class="badge badge-info">${getCatName(p.cat)}</span></td>
          <td>${whName}</td>
          <td style="font-weight:700;font-size:14px;${qty===0?'color:var(--red)':qty<=min?'color:var(--yellow)':'color:var(--green);'}">${qty}</td>
          <td style="font-size:12px;">${N(p.cost)} EGP</td>
          <td style="color:var(--accent);font-weight:700;">${N(p.price)} EGP</td>
          <td style="font-size:11px;color:var(--green);">${profitPct}</td>
          <td>${min}</td>
          <td><span class="badge ${st}">${stT}</span></td>
          <td style="white-space:nowrap;">
            <button class="btn btn-ghost btn-xs" title="سجل الحركات" onclick="viewProductHistory('${id}')"><i class="fas fa-history"></i></button>
            <button class="btn btn-ghost btn-xs" title="تسوية مخزون"  onclick="openAdjustStock('${id}')"><i class="fas fa-sliders-h"></i></button>
            <button class="btn btn-ghost btn-xs" title="تعديل"         onclick="editProduct('${id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-xs admin-only" title="حذف" onclick="delProduct('${id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="11" style="text-align:center;color:var(--text2);padding:20px;">لا توجد منتجات</td></tr>';

  // Update inventory dashboard whenever products render
  if (typeof updateInventoryDashboard === 'function') {
    setTimeout(updateInventoryDashboard, 100);
  }
}
