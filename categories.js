/* ============================================================
   categories.js — إدارة الفئات
   الشمس - Al Shams ERP | المرحلة الأولى
   ============================================================ */

const DEFAULT_CATS = {
  laptop:    {name:'لاب توب',  icon:'💻'},
  desktop:   {name:'ديسك توب', icon:'🖥️'},
  monitor:   {name:'شاشات',   icon:'🖥'},
  printer:   {name:'طابعات',  icon:'🖨️'},
  accessory: {name:'إكسسوار', icon:'🖱️'},
  other:     {name:'أخرى',    icon:'📦'}
};
// alias used in import functions
const BUILTIN_CATS = DEFAULT_CATS;

function getAllCats()       { return {...DEFAULT_CATS, ...S.categories}; }
function getCatName(key)   { return getAllCats()[key]?.name || key; }
function getCatIcon(key)   { return getAllCats()[key]?.icon || '📦'; }

let editingCat = null;

function renderCategories() {
  const cats = getAllCats();
  const grid = document.getElementById('cat-grid'); if (!grid) return;
  grid.innerHTML = Object.entries(cats).map(([id, c]) => {
    const count     = Object.values(S.products).filter(p => p.cat === id).length;
    const isDefault = !!DEFAULT_CATS[id];
    return `<div class="cat-card">
      <div class="cat-card-actions">
        ${!isDefault ? `<button class="btn btn-danger btn-xs" onclick="delCategory('${id}')"><i class="fas fa-trash"></i></button>` : ''}
        <button class="btn btn-ghost btn-xs" onclick="editCategory('${id}')"><i class="fas fa-edit"></i></button>
      </div>
      <div class="cat-card-icon">${c.icon||'📦'}</div>
      <div class="cat-card-name">${c.name}</div>
      <div class="cat-card-count">${count} منتج</div>
    </div>`;
  }).join('');
  renderCatStats();
}

function renderCatStats() {
  const tbody = document.getElementById('cat-stats-tbl'); if (!tbody) return;
  const cats  = getAllCats();
  const rows  = Object.entries(cats).map(([id, c]) => {
    const prods = Object.values(S.products).filter(p => p.cat === id);
    const val   = prods.reduce((s, p) => s + (+p.qty||0) * (+p.price||0), 0);
    const sold  = Object.values(S.sales).flatMap(s => s.items||[]).filter(i => {
      const p = S.products[i.prodId]; return p?.cat === id;
    }).reduce((s, i) => s + (i.qty||0) * (i.price||0), 0);
    return `<tr>
      <td>${c.icon||''} ${c.name}</td>
      <td style="font-weight:700;">${prods.length}</td>
      <td style="color:var(--yellow);font-weight:700;">${N(val)} EGP</td>
      <td style="color:var(--green);font-weight:700;">${N(sold)} EGP</td>
    </tr>`;
  });
  tbody.innerHTML = rows.join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text2);padding:14px;">لا توجد بيانات</td></tr>';
}

async function saveCategory() {
  const name = (document.getElementById('catf-name').value||'').trim();
  if (!name) { toast('يرجى إدخال اسم الفئة','error'); return; }
  const icon = document.getElementById('catf-icon').value.trim() || '📦';
  const desc = document.getElementById('catf-desc').value.trim();
  const data = {name, icon, desc, updatedAt:new Date().toISOString(), updatedBy:getCU()};
  try {
    const id = editingCat || (name.toLowerCase().replace(/\s+/g,'-') + '-' + uid().slice(0,4));
    await dbUpdate('categories/' + id, data);
    closeModal('modal-category');
    toast('تم حفظ الفئة');
    editingCat = null;
  } catch(e) { toast('خطأ: ' + e.message,'error'); }
}

function editCategory(id) {
  editingCat = id;
  const c = getAllCats()[id] || {};
  document.getElementById('cat-modal-title').textContent = 'تعديل فئة';
  document.getElementById('catf-name').value = c.name || '';
  document.getElementById('catf-icon').value = c.icon || '';
  document.getElementById('catf-desc').value = c.desc || '';
  openModal('modal-category');
}

async function delCategory(id) {
  const count = Object.values(S.products).filter(p => p.cat === id).length;
  if (count > 0) { toast(`لا يمكن حذف الفئة - تحتوي على ${count} منتج`,'error'); return; }
  if (!confirm('حذف هذه الفئة؟')) return;
  await dbRemove('categories/' + id);
  toast('تم الحذف');
}

// Excel import (categories)
function downloadCatTemplate() {
  if (typeof XLSX==='undefined') { toast('مكتبة Excel غير محملة','error'); return; }
  const wb = XLSX.utils.book_new();
  const headers = [['اسم الفئة *','أيقونة (Emoji)','وصف الفئة']];
  const examples = [
    ['لابتوب','💻','أجهزة الكمبيوتر المحمولة'],
    ['موبايل','📱','الهواتف الذكية'],
    ['طابعات','🖨️','طابعات وأجهزة الطباعة'],
    ['إكسسوارات','🎧','ملحقات وإكسسوارات'],
    ['شاشات','🖥️','شاشات وأجهزة العرض'],
    ['قطع غيار','🔧','قطع الغيار والتوصيلات'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...headers,...examples]);
  ws['!cols'] = [{wch:25},{wch:12},{wch:35}];
  XLSX.utils.book_append_sheet(wb, ws, 'الفئات');
  XLSX.writeFile(wb, 'نموذج-استيراد-الفئات.xlsx');
  toast('✅ تم تنزيل نموذج الفئات');
}

async function importCatsFromExcel(event) {
  const file = event.target.files[0]; if (!file) return;
  if (typeof XLSX==='undefined') { toast('مكتبة Excel غير محملة','error'); return; }
  try {
    toast('جارٍ قراءة الملف...','info');
    const data = await file.arrayBuffer();
    const wb   = XLSX.read(data, {type:'array'});
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
    if (rows.length<2) { toast('الملف فارغ','error'); return; }
    const dataRows = rows.slice(1).filter(r => r[0] && String(r[0]).trim());
    if (!dataRows.length) { toast('لا توجد بيانات صالحة','error'); return; }
    let added=0, updated=0;
    for (const row of dataRows) {
      const name = String(row[0]||'').trim();
      const icon = String(row[1]||'').trim() || '📦';
      const desc = String(row[2]||'').trim();
      if (!name) continue;
      const existingEntry = Object.entries({...BUILTIN_CATS,...(S.categories||{})}).find(([,c]) => c.name?.toLowerCase()===name.toLowerCase());
      const catData = {name, icon, desc, updatedAt:new Date().toISOString()};
      if (existingEntry) {
        if (!BUILTIN_CATS[existingEntry[0]]) { await dbUpdate('categories/'+existingEntry[0], catData); updated++; }
      } else {
        const id = name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'') + '-' + uid().slice(0,4);
        await dbUpdate('categories/'+id, catData); added++;
      }
    }
    toast(`✅ تم استيراد الفئات: ${added} جديدة, ${updated} محدثة`);
  } catch(e) { toast('خطأ: ' + e.message,'error'); }
  finally { event.target.value=''; }
}
