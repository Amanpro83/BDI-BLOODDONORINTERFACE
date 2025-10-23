// BDI Secure Pro - app.js (backups, responsive, no reset)
(function(){
  const BLOOD_GROUPS = ['A+','A-','B+','B-','O+','O-','AB+','AB-'];
  const STORAGE = { donors: 'bdi_secure_donors', requests: 'bdi_secure_requests', banks: 'bdi_secure_banks', audits: 'bdi_secure_audits', backups: 'bdi_secure_backups', meta: 'bdi_secure_meta' };

  function load(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(e){ console.error('load error',e); return fallback; } }
  function save(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){ console.error('save error',e); } }
  function uid(prefix){ return prefix + Math.random().toString(36).slice(2,9); }
  function now(){ return Date.now(); }
  function toast(msg, isErr){ const t = document.getElementById('toast'); if(!t) return; t.textContent = msg; t.classList.add('show'); t.style.background = isErr? 'rgba(200,30,30,0.95)':'rgba(15,23,36,0.92)'; setTimeout(()=>t.classList.remove('show'),3000); }

  // backups: maintain up to 5 backups in localStorage
  function getBackups(){ return load(STORAGE.backups, []); }
  function saveBackup(data){ const backups = getBackups(); const entry = { ts: now(), data }; backups.unshift(entry); if(backups.length>5) backups.pop(); save(STORAGE.backups, backups); }
  function createBackup(){ const snapshot = { banks: getBanks(), donors: getDonors(), requests: getRequests(), audits: load(STORAGE.audits,{}) }; saveBackup(snapshot); }

  // merge import: merge arrays by id, avoid duplicates, keep existing if id collision
  function mergeImport(data){
    if(!data) return;
    createBackup();
    const banks = getBanks(); const incomingBanks = data.banks||[];
    incomingBanks.forEach(b=>{ if(!b.id) b.id = uid('b'); const exists = banks.find(x=> x.id===b.id || (x.name===b.name && x.city===b.city)); if(!exists) banks.push(b); });
    save(STORAGE.banks, banks);
    const donors = getDonors(); const incomingDonors = data.donors||[];
    incomingDonors.forEach(d=>{ if(!d.id) d.id = uid('d'); const exists = donors.find(x=> x.id===d.id || (x.name===d.name && x.phone===d.phone)); if(!exists) donors.push(d); });
    save(STORAGE.donors, donors);
    const requests = getRequests(); const incomingReq = data.requests||[];
    incomingReq.forEach(r=>{ if(!r.id) r.id = uid('r'); const exists = requests.find(x=> x.id===r.id); if(!exists) requests.push(r); });
    save(STORAGE.requests, requests);
    const audits = load(STORAGE.audits, {}); const incAudits = data.audits || {};
    Object.keys(incAudits).forEach(bankId=>{ audits[bankId] = (audits[bankId]||[]).concat(incAudits[bankId]); });
    save(STORAGE.audits, audits);
  }

  // banks
  function defaultInventory(){ const o={}; BLOOD_GROUPS.forEach(g=>o[g]=0); return o; }
  function getBanks(){ return load(STORAGE.banks, []); }
  function setBanks(arr){ save(STORAGE.banks, arr); }
  function addBank(bank){ if(!bank || !bank.name) return {ok:false,msg:'Please provide bank name.'}; const arr=getBanks(); bank.id = uid('b'); bank.inventory = bank.inventory || defaultInventory(); arr.push(bank); setBanks(arr); addAudit(bank.id,'created','Bank created'); return {ok:true,msg:'Bank created.'}; }
  function updateBankInventory(id, inv){ const arr = getBanks().map(b=> b.id===id ? Object.assign({}, b, { inventory: inv }) : b ); setBanks(arr); addAudit(id,'inventory_updated', JSON.stringify(inv)); createMetaUpdate(); }

  // donors
  function getDonors(){ return load(STORAGE.donors, []); }
  function setDonors(arr){ save(STORAGE.donors, arr); }
  function addDonor(d){ if(!d || !d.name || !d.bloodGroup || !d.phone) return {ok:false,msg:'Fill name, blood group and phone.'}; const arr=getDonors(); d.id = uid('d'); d.created = now(); arr.push(d); setDonors(arr); createMetaUpdate(); return {ok:true,msg:'Donor added.'}; }
  function toggleDonorAvailability(id){ const arr=getDonors().map(x=> x.id===id ? Object.assign({},x,{availability: x.availability==='available'?'unavailable':'available'}) : x ); setDonors(arr); createMetaUpdate(); }

  // requests
  function getRequests(){ return load(STORAGE.requests, []); }
  function setRequests(arr){ save(STORAGE.requests, arr); }
  function addRequest(r){ if(!r || !r.name || !r.bloodGroup || !r.phone) return {ok:false,msg:'Fill name, blood group and phone.'}; r.id = uid('r'); r.created = now(); r.status='open'; const arr=getRequests(); arr.push(r); setRequests(arr); createMetaUpdate(); return {ok:true,msg:'Request added.'}; }
  function fulfillRequest(id){ const arr = getRequests().map(x=> x.id===id ? Object.assign({},x,{status:'fulfilled'}) : x ); setRequests(arr); createMetaUpdate(); }

  function fulfillRequestFromBank(bankId, bloodGroup, units){
    const banks = getBanks(); const bank = banks.find(b=>b.id===bankId); if(!bank) return {ok:false,msg:'Bank not found.'};
    const need = parseInt(units,10)||0; const available = parseInt(bank.inventory[bloodGroup]||0,10);
    if(available < need) return {ok:false,msg:'Insufficient units in selected bank.'};
    bank.inventory[bloodGroup] = Math.max(0, available - need);
    updateBankInventory(bankId, bank.inventory);
    addAudit(bankId,'fulfilled_request', JSON.stringify({bloodGroup,units,ts:now()}));
    createMetaUpdate();
    return {ok:true,msg:`Fulfilled ${units} unit(s) of ${bloodGroup} from ${bank.name}`};
  }

  function addAudit(bankId, action, details){ const audits = load(STORAGE.audits,{}); audits[bankId] = audits[bankId]||[]; audits[bankId].push({ts:now(), action, details}); save(STORAGE.audits,audits); }
  function getAudit(bankId){ const audits = load(STORAGE.audits,{}); return audits[bankId] || []; }
  function createMetaUpdate(){ const meta = { lastUpdate: now() }; save(STORAGE.meta, meta); }

  function aggregateUnits(){ const banks = getBanks(); const agg = {}; BLOOD_GROUPS.forEach(g=> agg[g]=0); banks.forEach(b=> BLOOD_GROUPS.forEach(g=> agg[g]+= parseInt(b.inventory[g]||0,10) )); return agg; }
  function topNeeded(){ const requests = getRequests().filter(r=> r.status!=='fulfilled'); const counts = {}; BLOOD_GROUPS.forEach(g=> counts[g]=0); requests.forEach(r=>{ counts[r.bloodGroup] = (counts[r.bloodGroup]||0) + (parseInt(r.units,10)||1); }); return counts; }

  function escapeHtml(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function el(id){ return document.getElementById(id); }

  function renderDonors(filterBlood, filterCity){ const container = el('donorList'); if(!container) return; const donors = getDonors().filter(d=> (filterBlood?d.bloodGroup===filterBlood:true) && (filterCity? d.city && d.city.toLowerCase().includes(filterCity.toLowerCase()):true)); if(donors.length===0){ container.innerHTML = '<div class="small-muted">No donors yet.</div>'; return; } container.innerHTML = donors.map(d=>`<div class="req"><div class="avatar">${d.bloodGroup}</div><div style="flex:1"><strong>${escapeHtml(d.name)}</strong><div class="small-muted">${escapeHtml(d.city||'')} • ${escapeHtml(d.phone)}</div><div class="small-muted">Availability: ${escapeHtml(d.availability)}</div></div><div style="margin-left:12px"><button class="btn" onclick="window.bdi.toggleDonor('${d.id}')">Toggle</button></div></div>`).join(''); }

  function renderRequests(q){ const container = el('requestList'); if(!container) return; const all = getRequests().filter(r=> r.status!=='fulfilled').sort((a,b)=>b.created-a.created); let items = all; if(q){ const qq=q.toLowerCase(); items = all.filter(r=> (r.bloodGroup||'').toLowerCase().includes(qq) || (r.city||'').toLowerCase().includes(qq) ); } if(items.length===0){ container.innerHTML = '<div class="small-muted">No matching requests.</div>'; return; } container.innerHTML = items.map(r=>`<div class="req"><div class="avatar">${r.bloodGroup}</div><div style="flex:1"><strong>${escapeHtml(r.name)}</strong><div class="small-muted">${escapeHtml(r.city||'')} • Units: ${r.units}</div><div class="small-muted">${escapeHtml(r.notes||'')}</div></div><div style="margin-left:auto"><a class="btn" href="tel:${encodeURIComponent(r.phone)}">Call</a><button class="btn ghost" onclick="window.bdi.fulfill('${r.id}')">Mark Fulfilled</button></div></div>`).join(''); }

  function renderRecent(){ const elr = el('recentList'); if(!elr) return; const items = getRequests().filter(r=> r.status!=='fulfilled').sort((a,b)=>b.created-a.created).slice(0,6); if(items.length===0){ elr.innerHTML = '<div class="small-muted">No requests yet.</div>'; return; } elr.innerHTML = items.map(r=>`<div class="req"><div class="avatar">${r.bloodGroup}</div><div><strong>${escapeHtml(r.name)}</strong><div class="small-muted">${escapeHtml(r.city||'')} • Units: ${r.units}</div></div><div style="margin-left:auto"><a class="btn" href="tel:${encodeURIComponent(r.phone)}">Call</a></div></div>`).join(''); }

  function renderBanks(){ const container = el('banksList'); if(!container) return; const banks = getBanks(); if(banks.length===0){ container.innerHTML = '<div class="small-muted">No banks yet.</div>'; return; } container.innerHTML = banks.map(b=>`<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px"><div style="flex:1"><strong>${escapeHtml(b.name)}</strong><div class="small-muted">${escapeHtml(b.city||'')}</div></div><div><button class="btn" onclick="window.bdi.editBank('${b.id}')">Edit</button> <button class="btn ghost" onclick="window.bdi.deleteBank('${b.id}')">Archive</button></div></div>`).join(''); }

  let chartAgg=null, chartNeeded=null, chartBank=null;
  function renderAggChart(){ const canvas = el('availabilityChart'); if(!canvas) return; const agg = aggregateUnits(); const data = BLOOD_GROUPS.map(g=>agg[g]||0); const colors = ['#ef4444','#f97316','#f59e0b','#10b981','#3b82f6','#6366f1','#8b5cf6','#ec4899']; const cfg = { type:'pie', data:{ labels:BLOOD_GROUPS, datasets:[{ data:data, backgroundColor:colors }] }, options:{ responsive:true, plugins:{ legend:{ position:'bottom' } } } }; try{ if(chartAgg) chartAgg.destroy(); chartAgg = new Chart(canvas.getContext('2d'), cfg); }catch(e){ console.error('chart error',e); } const legend = el('chartLegend'); if(legend) legend.innerHTML = BLOOD_GROUPS.map((g,i)=>`<div style="display:inline-flex;gap:8px;align-items:center;margin-right:8px"><span style="width:12px;height:12px;background:${colors[i]};display:inline-block;border-radius:3px"></span><small>${g}: ${data[i]}</small></div>`).join(''); }

  function renderNeededChart(){ const canvas = el('neededChart'); if(!canvas) return; const counts = topNeeded(); const data = BLOOD_GROUPS.map(g=>counts[g]||0); const colors = ['#ef4444','#f97316','#f59e0b','#10b981','#3b82f6','#6366f1','#8b5cf6','#ec4899']; const cfg = { type:'bar', data:{ labels:BLOOD_GROUPS, datasets:[{ label:'Units needed', data:data, backgroundColor:colors }] }, options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } } }; try{ if(chartNeeded) chartNeeded.destroy(); chartNeeded = new Chart(canvas.getContext('2d'), cfg); }catch(e){ console.error('needed chart error',e); } }

  function renderBankChart(bankId){ const canvas = el('bankChart'); if(!canvas) return; const bank = getBanks().find(b=>b.id===bankId); if(!bank){ try{ if(chartBank) chartBank.destroy(); }catch(e){} return; } const data = BLOOD_GROUPS.map(g=> bank.inventory[g]||0 ); const colors = ['#ef4444','#f97316','#f59e0b','#10b981','#3b82f6','#6366f1','#8b5cf6','#ec4899']; const cfg = { type:'pie', data:{ labels:BLOOD_GROUPS, datasets:[{ data:data, backgroundColor:colors }] }, options:{ responsive:true, plugins:{ legend:{ position:'bottom' } } } }; try{ if(chartBank) chartBank.destroy(); chartBank = new Chart(canvas.getContext('2d'), cfg); }catch(e){ console.error('bank chart error',e); } }

  function showBackups(){ const backups = getBackups(); if(!backups || backups.length===0){ alert('No backups available'); return; } let list = 'Choose backup to restore:\n'; backups.forEach((b,i)=>{ list += `${i+1}. ${new Date(b.ts).toLocaleString()}\n`; }); const sel = prompt(list + '\nEnter number to restore or Cancel'); const idx = parseInt(sel,10)-1; if(isNaN(idx) || idx<0 || idx>=backups.length) return; if(confirm('Restore will MERGE this backup into current data (no deletions). Continue?')){ mergeImport(backups[idx].data); createMetaUpdate(); renderAll(); toast('Backup restored'); } }

  function exportData(){ const data={ banks:getBanks(), donors:getDonors(), requests:getRequests(), audits: load(STORAGE.audits,{}) }; const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='bdi_secure_export.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
  function importData(data){ mergeImport(data); createMetaUpdate(); }

  function renderAll(){ const donors = getDonors(); const requests = getRequests().filter(r=> r.status!=='fulfilled'); const banks = getBanks(); const totalUnits = Object.values(aggregateUnits()).reduce((a,b)=>a+(parseInt(b,10)||0),0); if(el('totalDonors')) el('totalDonors').textContent = donors.length; if(el('totalRequests')) el('totalRequests').textContent = requests.length; if(el('totalBanks')) el('totalBanks').textContent = banks.length; if(el('totalUnits')) el('totalUnits').textContent = totalUnits; const meta = load(STORAGE.meta,{}); if(el('lastUpdate')) el('lastUpdate').textContent = meta.lastUpdate ? new Date(meta.lastUpdate).toLocaleString() : '—'; renderDonors(); renderRequests(); renderRecent(); renderBanks(); renderAggChart(); renderNeededChart(); const sel = el('selectBank'); if(sel && sel.value) renderBankChart(sel.value); const fulfillSel = el('fulfill_bank'); if(fulfillSel){ fulfillSel.innerHTML = '<option value="">Fulfill from bank (optional)</option>'; banks.forEach(b=>{ const opt=document.createElement('option'); opt.value=b.id; opt.textContent=b.name + ' — ' + (b.city||''); fulfillSel.appendChild(opt); }); } const selectBank = el('selectBank'); if(selectBank){ selectBank.innerHTML = '<option value="">Select a bank to edit</option>'; banks.forEach(b=>{ const opt=document.createElement('option'); opt.value=b.id; opt.textContent=b.name + ' — ' + (b.city||''); selectBank.appendChild(opt); }); } }

  window.bdi = { getBanks:getBanks, addBank:addBank, updateBankInventory:updateBankInventory, getDonors:getDonors, addDonor:addDonor, toggleDonorAvailability:toggleDonorAvailability, getRequests:getRequests, addRequest:addRequest, fulfill:fulfillRequest, fulfillRequestFromBank:fulfillRequestFromBank, getAuditLog:getAudit, createBackup:createBackup, getBackups:getBackups, showBackups:showBackups, exportData:exportData, importData:importData, mergeImport:mergeImport, renderAll:renderAll, toast:toast };

  if(!localStorage.getItem(STORAGE.banks)) setBanks([]);
  if(!localStorage.getItem(STORAGE.donors)) setDonors([]);
  if(!localStorage.getItem(STORAGE.requests)) setRequests([]);
  if(!localStorage.getItem(STORAGE.backups)) save(STORAGE.backups, []);
})();