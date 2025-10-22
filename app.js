// BDI Professional v2 - app.js (multiple banks, improved functionality)
(function(){
  const BLOOD_GROUPS = ['A+','A-','B+','B-','O+','O-','AB+','AB-'];
  const STORAGE = { donors: 'bdi_donors_v3', requests: 'bdi_requests_v3', banks: 'bdi_banks_v3' };

  // storage helpers
  function load(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(e){ return fallback; } }
  function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

  // banks functions
  function getBanks(){ return load(STORAGE.banks, []); }
  function setBanks(arr){ save(STORAGE.banks, arr); }
  function addBank(bank){ if(!bank || !bank.name) return {ok:false,msg:'Please provide bank name.'}; const arr=getBanks(); bank.id = 'b'+Math.random().toString(36).slice(2,9); bank.inventory = bank.inventory || defaultInventory(); arr.push(bank); setBanks(arr); return {ok:true,msg:'Bank created.'}; }
  function removeBank(id){ let arr=getBanks().filter(b=>b.id!==id); setBanks(arr); }
  function updateBankInventory(id, inv){ const arr = getBanks().map(b=> b.id===id ? Object.assign({}, b, { inventory: inv }) : b ); setBanks(arr); }

  function defaultInventory(){ const o={}; BLOOD_GROUPS.forEach(g=>o[g]=0); return o; }

  // donors
  function getDonors(){ return load(STORAGE.donors, []); }
  function setDonors(arr){ save(STORAGE.donors, arr); }
  function addDonor(donor){ if(!donor || !donor.name || !donor.bloodGroup || !donor.phone) return {ok:false,msg:'Fill name, blood group and phone.'}; const arr=getDonors(); donor.id='d'+Math.random().toString(36).slice(2,9); arr.push(donor); setDonors(arr); return {ok:true,msg:'Donor added.'}; }
  function toggleDonorAvailability(id){ const arr=getDonors().map(d=> d.id===id ? Object.assign({},d,{availability: d.availability==='available'?'unavailable':'available'}) : d ); setDonors(arr); }

  // requests
  function getRequests(){ return load(STORAGE.requests, []); }
  function setRequests(arr){ save(STORAGE.requests, arr); }
  function addRequest(req){ if(!req || !req.name || !req.bloodGroup || !req.phone) return {ok:false,msg:'Fill name, blood group and phone.'}; req.id='r'+Math.random().toString(36).slice(2,9); req.created=Date.now(); req.status='open'; const arr=getRequests(); arr.push(req); setRequests(arr); return {ok:true,msg:'Request added.'}; }
  function fulfillRequest(id){ const arr = getRequests().map(r=> r.id===id ? Object.assign({},r,{status:'fulfilled'}) : r ); setRequests(arr); }

  // fulfill from bank (decrement)
  function fulfillRequestFromBank(bankId, bloodGroup, units){
    const banks = getBanks(); const bank = banks.find(b=>b.id===bankId); if(!bank) return {ok:false,msg:'Bank not found.'};
    const need = parseInt(units,10)||0; const available = parseInt(bank.inventory[bloodGroup]||0,10);
    if(available < need) return {ok:false,msg:'Not enough units in selected bank.'};
    bank.inventory[bloodGroup] = available - need;
    updateBankInventory(bankId, bank.inventory);
    return {ok:true,msg:'Fulfilled from bank: ' + bank.name};
  }

  // aggregate units across banks
  function aggregateUnits(){ const banks = getBanks(); const agg = {}; BLOOD_GROUPS.forEach(g=> agg[g]=0); banks.forEach(b=>{ BLOOD_GROUPS.forEach(g=> agg[g]+= parseInt(b.inventory[g]||0,10) ); }); return agg; }

  // renderers
  function renderDonors(filterBlood, filterCity){
    const container = document.getElementById('donorList'); if(!container) return;
    const donors = getDonors().filter(d=> (filterBlood?d.bloodGroup===filterBlood:true) && (filterCity? d.city && d.city.toLowerCase().includes(filterCity.toLowerCase()):true));
    if(donors.length===0){ container.innerHTML = '<div class="small-muted">No donors yet.</div>'; return; }
    container.innerHTML = donors.map(d=>`<div class="req"><div class="avatar">${d.bloodGroup}</div><div style="flex:1"><strong>${escapeHtml(d.name)}</strong><div class="small-muted">${escapeHtml(d.city||'')} • ${escapeHtml(d.phone)}</div><div class="small-muted">Availability: ${escapeHtml(d.availability)}</div></div><div style="margin-left:12px"><button class="btn" onclick="window.bdi.toggleDonor('${d.id}')">Toggle Availability</button></div></div>`).join('');
  }

  function renderRequests(q){
    const container = document.getElementById('requestList'); if(!container) return;
    const all = getRequests().filter(r=> r.status!=='fulfilled').sort((a,b)=>b.created-a.created);
    let items = all;
    if(q){ const qq=q.toLowerCase(); items = all.filter(r=> (r.bloodGroup||'').toLowerCase().includes(qq) || (r.city||'').toLowerCase().includes(qq) ); }
    if(items.length===0){ container.innerHTML = '<div class="small-muted">No matching requests.</div>'; return; }
    container.innerHTML = items.map(r=>`<div class="req"><div class="avatar">${r.bloodGroup}</div><div style="flex:1"><strong>${escapeHtml(r.name)}</strong><div class="small-muted">${escapeHtml(r.city||'')} • Units: ${r.units}</div><div class="small-muted">${escapeHtml(r.notes||'')}</div></div><div style="margin-left:auto"><a class="btn" href="tel:${encodeURIComponent(r.phone)}">Call</a><button class="btn ghost" onclick="window.bdi.fulfill('${r.id}')">Mark Fulfilled</button></div></div>`).join('');
  }

  function renderRecent(){
    const el = document.getElementById('recentList'); if(!el) return;
    const items = getRequests().filter(r=> r.status!=='fulfilled').sort((a,b)=>b.created-a.created).slice(0,6);
    if(items.length===0){ el.innerHTML = '<div class="small-muted">No requests yet.</div>'; return; }
    el.innerHTML = items.map(r=>`<div class="req"><div class="avatar">${r.bloodGroup}</div><div><strong>${escapeHtml(r.name)}</strong><div class="small-muted">${escapeHtml(r.city||'')} • Units: ${r.units}</div></div><div style="margin-left:auto"><a class="btn" href="tel:${encodeURIComponent(r.phone)}">Call</a></div></div>`).join('');
  }

  function renderBanks(){
    const container = document.getElementById('banksList'); if(!container) return;
    const banks = getBanks();
    if(banks.length===0){ container.innerHTML = '<div class="small-muted">No banks yet.</div>'; return; }
    container.innerHTML = banks.map(b=>`<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px"><div style="flex:1"><strong>${escapeHtml(b.name)}</strong><div class="small-muted">${escapeHtml(b.city||'')}</div></div><div><button class="btn" onclick="window.bdi.editBank('${b.id}')">Edit</button> <button class="btn ghost" onclick="window.bdi.deleteBank('${b.id}')">Delete</button></div></div>`).join('');
  }

  // charts
  let chartAgg=null, chartBank=null;
  function renderAggChart(){
    const canvas = document.getElementById('availabilityChart'); if(!canvas) return;
    const agg = aggregateUnits(); const data = BLOOD_GROUPS.map(g=>agg[g]||0);
    const colors = ['#ef4444','#f97316','#f59e0b','#10b981','#3b82f6','#6366f1','#8b5cf6','#ec4899'];
    const cfg = { type:'pie', data:{ labels:BLOOD_GROUPS, datasets:[{ data:data, backgroundColor:colors }] }, options:{ responsive:true, plugins:{ legend:{ position:'bottom' } } } };
    if(chartAgg) chartAgg.destroy();
    chartAgg = new Chart(canvas.getContext('2d'), cfg);
    const legend = document.getElementById('chartLegend'); if(legend) legend.innerHTML = BLOOD_GROUPS.map((g,i)=>`<div style="display:inline-flex;gap:8px;align-items:center;margin-right:8px"><span style="width:12px;height:12px;background:${colors[i]};display:inline-block;border-radius:3px"></span><small>${g}: ${data[i]}</small></div>`).join('');
  }

  function renderBankChart(bankId){
    const canvas = document.getElementById('bankChart'); if(!canvas) return;
    const bank = getBanks().find(b=>b.id===bankId); if(!bank){ canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height); return; }
    const data = BLOOD_GROUPS.map(g=> bank.inventory[g]||0 );
    const colors = ['#ef4444','#f97316','#f59e0b','#10b981','#3b82f6','#6366f1','#8b5cf6','#ec4899'];
    const cfg = { type:'pie', data:{ labels:BLOOD_GROUPS, datasets:[{ data:data, backgroundColor:colors }] }, options:{ responsive:true, plugins:{ legend:{ position:'bottom' } } } };
    if(chartBank) chartBank.destroy();
    chartBank = new Chart(canvas.getContext('2d'), cfg);
  }

  // utilities
  function escapeHtml(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // export/import/reset/sample
  function exportData(){ const data={ banks:getBanks(), donors:getDonors(), requests:getRequests() }; const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='bdi_export.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
  function importData(data){ if(!data) return; if(data.banks) setBanks(data.banks); if(data.donors) setDonors(data.donors); if(data.requests) setRequests(data.requests); }
  function resetData(){ localStorage.removeItem(STORAGE.banks); localStorage.removeItem(STORAGE.donors); localStorage.removeItem(STORAGE.requests); }

  // sample data
  function addSampleData(){
    if(localStorage.getItem('bdi_sample_v2')) return;
    const sampleBanks = [{ id:'b1', name:'City Blood Bank', city:'New Delhi', inventory:{'A+':5,'A-':2,'B+':4,'B-':1,'O+':8,'O-':1,'AB+':2,'AB-':0} },
                         { id:'b2', name:'Hope Blood Center', city:'Noida', inventory:{'A+':3,'A-':1,'B+':2,'B-':0,'O+':6,'O-':2,'AB+':1,'AB-':0} }];
    const sampleDonors = [{ id:'d1', name:'Asha Verma', bloodGroup:'A+', phone:'+919876543210', city:'New Delhi', availability:'available' }];
    const sampleRequests = [{ id:'r1', name:'Rahul Jain', bloodGroup:'A+', units:2, phone:'+919999999999', city:'New Delhi', notes:'ICU', status:'open', created:Date.now() }];
    setBanks(sampleBanks); setDonors(sampleDonors); setRequests(sampleRequests); localStorage.setItem('bdi_sample_v2','1');
  }

  // expose API
  window.bdi = {
    // banks
    getBanks: getBanks, addBank: addBank, removeBank: removeBank, updateBankInventory: updateBankInventory, editBank: function(id){ const bank = getBanks().find(b=>b.id===id); if(!bank) return; document.getElementById('selectBank') && (document.getElementById('selectBank').value = id); },
    deleteBank: function(id){ if(confirm('Delete bank?')){ removeBank(id); renderBanks(); renderAll(); } },

    // donors
    getDonors: getDonors, addDonor: addDonor, toggleDonorAvailability: toggleDonorAvailability,

    // requests
    getRequests: getRequests, addRequest: addRequest, fulfill: fulfillRequest,
    fulfillRequestFromBank: fulfillRequestFromBank,

    // utils and rendering
    getBankStock: aggregateUnits, setBankStock: function(){}, renderDonors: renderDonors, renderRequests: renderRequests, renderBanks: renderBanks, renderRecent: renderRecent,
    renderAll: function(){
      // update stats
      const donors = getDonors(); const requests = getRequests().filter(r=> r.status!=='fulfilled'); const banks = getBanks();
      document.getElementById('totalDonors') && (document.getElementById('totalDonors').textContent = donors.length);
      document.getElementById('totalRequests') && (document.getElementById('totalRequests').textContent = requests.length);
      document.getElementById('totalBanks') && (document.getElementById('totalBanks').textContent = banks.length);
      const totalUnits = Object.values(aggregateUnits()).reduce((a,b)=>a+(parseInt(b,10)||0),0);
      document.getElementById('totalUnits') && (document.getElementById('totalUnits').textContent = totalUnits);

      // render sections
      renderDonors(); renderRequests(); renderRecent(); renderBanks(); renderAggChart();
      // render bank chart if on bank page and selector has value
      const sel = document.getElementById('selectBank'); if(sel && sel.value) renderBankChart(sel.value);
      // populate bank selectors on other pages
      const fulfillSel = document.getElementById('fulfill_bank'); if(fulfillSel){ fulfillSel.innerHTML = '<option value="">Fulfill from bank (optional)</option>'; banks.forEach(b=>{ const opt=document.createElement('option'); opt.value=b.id; opt.textContent=b.name + ' — ' + (b.city||''); fulfillSel.appendChild(opt); }); }
      const selectBank = document.getElementById('selectBank'); if(selectBank){ selectBank.innerHTML = '<option value="">Select a bank to edit</option>'; banks.forEach(b=>{ const opt=document.createElement('option'); opt.value=b.id; opt.textContent=b.name + ' — ' + (b.city||''); selectBank.appendChild(opt); }); }
    },
    exportData: exportData, importData: importData, resetData: resetData, addSampleData: addSampleData,
    toggleDonor: function(id){ toggleDonorAvailability(id); renderDonors(); },
    updateBankInventory: updateBankInventory
  };

  // initial create bank inventory if none
  if(!localStorage.getItem(STORAGE.banks)){ setBanks([]); }
  if(!localStorage.getItem(STORAGE.donors)){ setDonors([]); }
  if(!localStorage.getItem(STORAGE.requests)){ setRequests([]); }
})();