// v6 - avanzado + CSP-friendly + QR + editor + backup gist + dark mode
let DATA=[];let CHANNELS={1:50,2:55,3:65};let deferredPrompt=null;
const LS_CSV='farol_csv_text_v1';const LS_TAB='farol_tab_v1';const LS_DARK='farol_dark_v1';const LS_TOKEN='farol_ghtoken_v1';
const APP_VER='7';

// -------- utils --------
const $ = (id)=>document.getElementById(id);
function notify(msg){ const t=$('toast'); t.textContent=msg; setTimeout(()=>t.textContent='',3000); }
function csvParse(text){
  const rows=text.replace(/\r/g,'').split('\n').filter(l=>l.trim().length>0);
  const header=rows[0].split(',').map(s=>s.trim());
  const idx=Object.fromEntries(header.map((h,i)=>[h,i]));
  const out=[];
  for(let i=1;i<rows.length;i++){
    const c=rows[i].split(',');
    const get=(k)=> (idx[k]!==undefined && idx[k]<c.length) ? c[idx[k]].trim() : '';
    const tk=parseInt(get('TK')||'0',10); if(!tk) continue;
    const plat=parseInt(get('Plataforma')||'0',10);
    const idLocal=parseInt(get('ID_local')||'0',10);
    const netid=parseInt(get('NETID')||'0',10);
    const chanRaw=get('Lora_Channel'); const chan=chanRaw?parseInt(chanRaw,10):null;
    let s=get('Strings'); let strings=[];
    if(s){ s=s.replace(/^\[|\]$/g,''); strings = s.split(/;|,/).map(x=>x.replace(/['"]/g,'').trim()).filter(Boolean); }
    out.push({tk,plat,idLocal,netid,chan,strings});
    if(chan && !CHANNELS[plat]) CHANNELS[plat]=chan;
  }
  return out;
}
function csvString(){
  const header='TK,Plataforma,ID_local,NETID,Lora_Channel,Strings';
  const rows=DATA.map(r=>[r.tk,r.plat,r.idLocal,r.netid,(r.chan??''),(r.strings||[]).join(';')].join(','));
  return [header,...rows].join('\n');
}
async function loadCsvFromAssets(){ const resp=await fetch('./assets/mapeo.csv'); return await resp.text(); }
async function loadData(){
  let text = localStorage.getItem(LS_CSV);
  if(!text){ text = await loadCsvFromAssets(); }
  DATA = csvParse(text);
}
function byTab(name){ return document.querySelector('#tab-'+name); }
function showTab(name){
  localStorage.setItem(LS_TAB,name);
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('[data-tab]').forEach(t=>t.style.display='none');
  $('tabbtn-'+name).classList.add('active');
  byTab(name).style.display='block';
}
function renderList(filterPlat=null){
  const list=$('list'); list.innerHTML='';
  const rows = filterPlat? DATA.filter(t=>t.plat===filterPlat) : DATA;
  rows.forEach(t=>{
    const chan=t.chan||CHANNELS[t.plat]||'—';
    const strings=t.strings&&t.strings.length?t.strings.join(', '):'—';
    const div=document.createElement('div'); div.className='card';
    div.innerHTML = `<b>TK ${t.tk} • P${t.plat} • NETID ${t.netid}</b><br>Canal ${chan} • Strings: ${strings}`;
    list.appendChild(div);
  });
  $('countList').textContent = `${rows.length} registros`;
}

// -------- buscar/simular --------
function searchTK(){
  const v=parseInt($('tkInput').value.trim(),10);
  const r=DATA.find(t=>t.tk===v);
  const box=$('searchResult'); box.innerHTML='';
  if(!r){ box.innerHTML='<div class="small">No encontrado.</div>'; return; }
  const chan=r.chan||CHANNELS[r.plat]||'—';
  const strings=r.strings?.length ? r.strings.map(s=>`<span class="badge">${s}</span>`).join(' ') : '—';
  box.innerHTML = `<div class="card">
    <div class="grid">
      <div><b>TK</b><br>${r.tk}</div>
      <div><b>Plataforma</b><br>${r.plat}</div>
      <div><b>ID local / NETID</b><br>${r.idLocal}</div>
      <div><b>Canal LoRa</b><br>${chan}</div>
    </div>
    <div style="margin-top:10px"><b>Strings</b><br>${strings}</div>
  </div>`;
}
function simular(){
  const plat=parseInt($('platSel').value,10);
  const net=parseInt($('netInput').value.trim(),10);
  const chan=CHANNELS[plat]||'—';
  let tk=null; if(plat===1) tk=net; if(plat===2) tk=70+net; if(plat===3) tk=140+net;
  $('simResult').innerHTML = `<div class="card"><b>TK global:</b> ${tk ?? '—'}<br>Plataforma ${plat} • NETID ${net} • Canal ${chan}</div>`;
}

// -------- búsqueda avanzada --------
function advFilter(){
  const p = $('advPlat').value.trim();
  const c = $('advChan').value.trim();
  const rng = $('advRange').value.trim();
  const s = $('advStr').value.trim().toLowerCase();
  let rows = DATA.slice();
  if(p) rows = rows.filter(r=>String(r.plat)===p);
  if(c) rows = rows.filter(r=>(r.chan||CHANNELS[r.plat])==parseInt(c,10));
  if(rng && rng.includes('-')){
    const [a,b] = rng.split('-').map(x=>parseInt(x.trim(),10));
    rows = rows.filter(r=>r.tk>=a && r.tk<=b);
  }
  if(s) rows = rows.filter(r=>(r.strings||[]).join(' ').toLowerCase().includes(s));
  const out = rows.slice(0,500).map(r=>`TK ${r.tk} • P${r.plat} • NET ${r.netid} • CH ${(r.chan||CHANNELS[r.plat]||'—')} • ${ (r.strings||[]).join(', ') }`);
  $('advResult').innerHTML = `<div class="card">${out.join('<br>') || 'Sin resultados'}</div>`;
}

// -------- CSV I/O --------
function handleCsvUpload(ev){
  const file=ev.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const text=e.target.result; DATA=csvParse(text); localStorage.setItem(LS_CSV,text);
      renderList(); notify('CSV cargado y guardado (offline)');
    }catch(err){ notify('Error al leer CSV'); }
  };
  reader.readAsText(file);
}
function exportCsv(){
  const blob=new Blob([csvString()],{type:'text/csv'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='mapeo_export.csv';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
async function resetCsv(){
  localStorage.removeItem(LS_CSV);
  const text=await loadCsvFromAssets(); DATA=csvParse(text); renderList(); notify('CSV de fábrica restaurado');
}

// -------- Editor --------
function edRefreshTable(){
  const tb = $('edTable').querySelector('tbody'); tb.innerHTML='';
  const rows = DATA.slice().sort((a,b)=>a.tk-b.tk).slice(0,1000);
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${r.tk}</td><td>${r.plat}</td><td>${r.idLocal}</td><td>${r.netid}</td><td>${r.chan??''}</td><td>${(r.strings||[]).join(';')}</td>`;
    tr.addEventListener('click',()=>{
      $('edTk').value=r.tk; $('edPlat').value=r.plat; $('edIdLocal').value=r.idLocal; $('edNet').value=r.netid;
      $('edChan').value=r.chan??''; $('edStr').value=(r.strings||[]).join(';');
    });
    tb.appendChild(tr);
  });
}
function edUpsert(){
  const tk=parseInt($('edTk').value,10); if(!tk){ notify('TK requerido'); return; }
  const plat=parseInt($('edPlat').value||'0',10);
  const idl=parseInt($('edIdLocal').value||'0',10);
  const net=parseInt($('edNet').value||'0',10);
  const chanRaw=$('edChan').value.trim(); const chan = chanRaw? parseInt(chanRaw,10) : null;
  const strs= $('edStr').value.trim()? $('edStr').value.split(';').map(s=>s.trim()).filter(Boolean) : [];
  const i = DATA.findIndex(r=>r.tk===tk);
  const row = {tk,plat,idLocal:idl,netid:net,chan,strings:strs};
  if(i>=0) DATA[i]=row; else DATA.push(row);
  localStorage.setItem(LS_CSV, csvString()); edRefreshTable(); renderList();
  notify(i>=0? 'Fila actualizada':'Fila creada');
}
function edDelete(){
  const tk=parseInt($('edTk').value,10); if(!tk) return;
  DATA = DATA.filter(r=>r.tk!==tk);
  localStorage.setItem(LS_CSV, csvString()); edRefreshTable(); renderList(); notify('Eliminado');
}

// -------- QR (BarcodeDetector) --------
let qrStream=null, qrDetector=null, qrTimer=null;
async function qrStart(){
  try{
    if(!('BarcodeDetector' in window)){ $('qrOutput').textContent='BarcodeDetector no soportado en este navegador'; return; }
    qrDetector = new BarcodeDetector({formats:['qr_code']});
    qrStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    const v=$('qrVideo'); v.srcObject=qrStream; await v.play();
    qrTimer = setInterval(async()=>{
      try{
        const codes = await qrDetector.detect(v);
        if(codes && codes.length){
          const raw = codes[0].rawValue || '';
          $('qrOutput').textContent = 'Leído: ' + raw;
          let m = raw.match(/(\d+)/); // busca un número
          if(m){
            $('tkInput').value = m[1];
            showTab('buscar'); searchTK();
          }
        }
      }catch(e){/*noop*/}
    }, 400);
  }catch(err){ $('qrOutput').textContent='Error abriendo cámara: '+err; }
}
function qrStop(){
  if(qrTimer){ clearInterval(qrTimer); qrTimer=null; }
  const v=$('qrVideo'); if(v) v.pause();
  if(qrStream){ qrStream.getTracks().forEach(t=>t.stop()); qrStream=null; }
}

// -------- Backup Gist --------
async function gistBackup(){
  const token = $('ghToken').value.trim() || localStorage.getItem(LS_TOKEN) || '';
  if(!token){ notify('Ingresa tu token de GitHub'); return; }
  const filename = $('gistFilename').value.trim() || 'mapeo.csv';
  try{
    const res = await fetch('https://api.github.com/gists', {
      method:'POST',
      headers:{
        'Authorization':'token '+token,
        'Accept':'application/vnd.github+json'
      },
      body: JSON.stringify({
        public: false,
        files: { [filename]: { content: csvString() } }
      })
    });
    const j = await res.json();
    if(res.ok){
      localStorage.setItem(LS_TOKEN, token);
      $('gistMsg').textContent = 'Backup subido. Gist id: '+j.id;
    }else{
      $('gistMsg').textContent = 'Error: '+(j.message||res.status);
    }
  }catch(e){ $('gistMsg').textContent='Error de red: '+e; }
}
async function gistLoad(){
  const token = $('ghToken').value.trim() || localStorage.getItem(LS_TOKEN) || '';
  if(!token){ notify('Ingresa tu token de GitHub'); return; }
  const id = prompt('ID de tu Gist:');
  const filename = $('gistFilename').value.trim() || 'mapeo.csv';
  if(!id) return;
  try{
    const res = await fetch('https://api.github.com/gists/'+id, { headers:{'Authorization':'token '+token} });
    const j = await res.json();
    if(res.ok && j.files && j.files[filename] && j.files[filename].content){
      const text = j.files[filename].content;
      DATA = csvParse(text);
      localStorage.setItem(LS_CSV, text);
      renderList(); edRefreshTable();
      $('gistMsg').textContent = 'CSV cargado desde Gist.';
    }else{
      $('gistMsg').textContent = 'No se encontró '+filename+' en ese Gist.';
    }
  }catch(e){ $('gistMsg').textContent='Error: '+e; }
}

// -------- dark mode --------
function applyDark(d){ document.documentElement.classList.toggle('dark', d); $('darkToggle').checked = d; }

// -------- init --------
window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferredPrompt=e; const b=$('installBtn'); if(b) b.style.display='inline-block'; });
async function doInstall(){ if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; $('installBtn').style.display='none'; }

window.addEventListener('load', async()=>{
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./service-worker.js?v='+APP_VER); }
  // dark mode persisted
  applyDark(localStorage.getItem(LS_DARK)==='1');
  $('darkToggle').addEventListener('change', (ev)=>{ const d=ev.target.checked; applyDark(d); localStorage.setItem(LS_DARK, d?'1':'0'); });

  await loadData();
  const savedTab=localStorage.getItem(LS_TAB)||'buscar';
  showTab(savedTab); renderList(); edRefreshTable();

  // tabs
  $('tabbtn-buscar').addEventListener('click',()=>showTab('buscar'));
  $('tabbtn-sim').addEventListener('click',()=>showTab('sim'));
  $('tabbtn-adv').addEventListener('click',()=>showTab('adv'));
  $('tabbtn-qr').addEventListener('click',()=>showTab('qr'));
  $('tabbtn-listado').addEventListener('click',()=>showTab('listado'));
  $('tabbtn-editor').addEventListener('click',()=>{showTab('editor'); edRefreshTable();});
  $('tabbtn-ajustes').addEventListener('click',()=>showTab('ajustes'));

  // actions
  $('btnBuscar').addEventListener('click',searchTK);
  $('btnSimular').addEventListener('click',simular);
  $('btnAdv').addEventListener('click',advFilter);

  $('platFilterAll').addEventListener('click',()=>renderList(null));
  $('platFilter1').addEventListener('click',()=>renderList(1));
  $('platFilter2').addEventListener('click',()=>renderList(2));
  $('platFilter3').addEventListener('click',()=>renderList(3));

  $('csvInput').addEventListener('change',handleCsvUpload);
  $('btnExport').addEventListener('click',exportCsv);
  $('btnReset').addEventListener('click',resetCsv);

  $('btnEdUpsert').addEventListener('click',edUpsert);
  $('btnEdDelete').addEventListener('click',edDelete);

  $('btnQrStart').addEventListener('click',qrStart);
  $('btnQrStop').addEventListener('click',qrStop);

  const ib=$('installBtn'); if(ib) ib.addEventListener('click',doInstall);

  $('btnGistBackup').addEventListener('click',gistBackup);
  $('btnGistLoad').addEventListener('click',gistLoad);
});
