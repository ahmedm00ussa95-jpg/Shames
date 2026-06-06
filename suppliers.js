/* ============================================================
   suppliers.js — إدارة الموردين
   الشمس - Al Shams ERP | المرحلة الأولى
   ============================================================ */

let editingSup = null;

function renderSuppliers() {
  const q = (document.getElementById('sup-search')?.value||'').toLowerCase();
  const rows = Object.entries(S.suppliers).filter(([,s]) => !q || s.name?.toLowerCase().includes(q));
  document.getElementById('sup-tbl').innerHTML = rows.length
    ? rows.map(([id,s]) => {
        const totalPur  = Object.values(S.purchases).filter(p => p.supplierId===id||p.supplier===s.name).reduce((ss,p) => ss+(p.total||0), 0);
        const totalDebt = Object.values(S.purchases).filter(p => p.supplierId===id||p.supplier===s.name).reduce((ss,p) => ss+(p.balance||0), 0);
        return `<tr>
          <td><strong>${s.name}</strong>${s.contact?`<br><span style="font-size:10px;color:var(--text2);">${s.contact}</span>`:''}</td>
          <td>${s.phone||'-'}</td>
          <td style="font-size:11px;">${s.email||'-'}</td>
          <td>${s.addr||'-'}</td>
          <td style="color:var(--accent);font-weight:700;">${N(totalPur)} EGP</td>
          <td style="color:${totalDebt>0?'var(--red)':'var(--text2)'};font-weight:${totalDebt>0?'700':'400'};">${totalDebt>0?N(totalDebt)+' EGP':'لا ديون'}</td>
          <td style="white-space:nowrap;">
            ${totalDebt>0?`<button class="btn btn-success btn-xs" onclick="openPayDebt('sup','${id}','${id}')"><i class="fas fa-hand-holding-usd"></i></button> `:''}
            <button class="btn btn-ghost btn-xs" onclick="editSup('${id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-xs" onclick="delSup('${id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:16px;">لا يوجد موردون</td></tr>';
}

function editSup(id) {
  editingSup = id;
  const s = S.suppliers[id];
  document.getElementById('sup-modal-title').textContent = 'تعديل مورد';
  document.getElementById('supf-name').value    = s.name    || '';
  document.getElementById('supf-phone').value   = s.phone   || '';
  document.getElementById('supf-email').value   = s.email   || '';
  document.getElementById('supf-addr').value    = s.addr    || '';
  document.getElementById('supf-contact').value = s.contact || '';
  document.getElementById('supf-notes').value   = s.notes   || '';
  openModal('modal-supplier');
}

async function saveSupplier() {
  const name  = (document.getElementById('supf-name').value||'').trim();
  if (!name) { toast('يرجى إدخال اسم المورد','error'); return; }
  const phone = (document.getElementById('supf-phone').value||'').trim();
  const allSups = Object.entries(S.suppliers);
  if (phone) {
    const dupPhone = allSups.find(([id,s]) => s.phone===phone && id!==editingSup);
    if (dupPhone) { toast('رقم الهاتف '+phone+' مستخدم بالفعل للمورد: '+dupPhone[1].name,'error'); return; }
  }
  const dupName = allSups.find(([id,s]) => s.name===name && id!==editingSup);
  if (dupName) toast('تنبيه: الاسم "'+name+'" موجود بالفعل','info');
  const data = {
    name, phone,
    email:   document.getElementById('supf-email').value.trim(),
    addr:    document.getElementById('supf-addr').value.trim(),
    contact: document.getElementById('supf-contact').value.trim(),
    notes:   document.getElementById('supf-notes').value.trim(),
    updatedAt: new Date().toISOString(), updatedBy: getCU()
  };
  try {
    if (editingSup) await dbUpdate('suppliers/'+editingSup, data);
    else { data.createdAt=new Date().toISOString(); await dbPush('suppliers', data); }
    closeModal('modal-supplier');
    toast('تم حفظ المورد');
    editingSup = null;
  } catch(e) { toast('خطأ: '+e.message,'error'); }
}

async function delSup(id) {
  if (!confirm('حذف؟')) return;
  await dbRemove('suppliers/'+id);
  toast('تم الحذف');
}

function checkSupNameDup(val) {
  const hint = document.getElementById('supf-name-hint'); if (!hint) return;
  const name = (val||'').trim(); if (!name) { hint.style.display='none'; return; }
  const dup = Object.entries(S.suppliers).find(([id,s]) => s.name===name && id!==editingSup);
  if (dup) { hint.textContent='⚠️ هذا الاسم موجود: '+dup[1].name+(dup[1].phone?' - '+dup[1].phone:''); hint.style.display='block'; }
  else hint.style.display='none';
}
function checkSupPhoneDup(val) {
  const hint = document.getElementById('supf-phone-hint'); if (!hint) return;
  const phone = (val||'').trim(); if (!phone) { hint.style.display='none'; return; }
  const dup = Object.entries(S.suppliers).find(([id,s]) => s.phone===phone && id!==editingSup);
  if (dup) { hint.textContent='❌ رقم الهاتف مستخدم: '+dup[1].name; hint.style.display='block'; }
  else hint.style.display='none';
}
