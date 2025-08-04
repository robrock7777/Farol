
// v5 - sin inline handlers (CSP friendly)
let DATA=[];let CHANNELS={1:50,2:55,3:65};let deferredPrompt=null;
const LS_KEY_CSV='farol_csv_text_v1';const LS_KEY_TAB='farol_tab_v1';const APP_VER='5';

function csvParse(t){
  const r=t.replace(/\r/g,'').split('\n').filter(l=>l.trim().length>0);
  const h=r[0].split(',').map(s=>s.trim());
  const idx=Object.fromEntries(h.map((x,i)=>[x,i]));
  const out=[];
  for(let i=1;i<r.length;i++){
    const c=r[i].split(',');
    const get=k=>(idx[k]!==undefined && idx[k]<c.length) ? c[idx[k]].trim() : '';
    const tk=parseInt(get('TK')||'0',10);
    if(!tk) continue;
    const plat=parseInt(get('Plataforma')||'0',10);
    const idLocal=parseInt(get('ID_local')||'0',10);
    const netid=parseInt(get('NETID')||'0',10);
    const chanRaw=get('Lora_Channel');
    const chan=chanRaw ? parseInt(chanRaw,10) : null;
    let s=get('Strings');
    let strings=[];
    if(s){
      s=s.replace(/^\[|\]$/g,'');
      if(s.includes(';')) strings=s.split(';').map(x=>x.replace(/['"]/g,'').trim()).filter(Boolean);
      else strings=s.split(',').map(x=>x.replace(/['"]/g,'').trim()).filter(Boolean);
    }
    out.push({tk,plat,idLocal,netid,chan,strings});
    if(chan && !CHANNELS[plat]) CHANNELS[plat]=chan;
  }
  return out;
}

async function loadCsvFromAssets(){
  const resp=await fetch('./assets/mapeo.csv');
  return await resp.text();
}

async function loadData(){
  try{
    let text=localStorage.getItem(LS_KEY_CSV);
    if(!text) text=await loadCsvFromAssets();
    DATA=csvParse(text);
  }catch(e){ console.error(e); DATA=[]; }
}

function byId(id){ return document.getElementById(id); }

function showTab(name){
  localStorage.setItem(LS_KEY_TAB,name);
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('[data-tab]').forEach(t=>t.style.display='none');
  const btn=document.getElementById('tabbtn-'+name);
  if(btn) btn.classList.add('active');
  const pane=document.getElementById('tab-'+name);
  if(pane) pane.style.display='block';
}

function searchTK(){
  const v=parseInt(byId('tkInput').value.trim(),10);
  const r=DATA.find(t=>t.tk===v);
  const box=byId('searchResult');
  box.innerHTML='';
  if(!r){ box.innerHTML='<div class="small">No encontrado.</div>'; return; }
  const chan=r.chan||CHANNELS[r.plat]||'—';
  const strings=r.strings&&r.strings.length ? r.strings.map(s=>`<span class="badge">${s}</span>`).join(' ') : '—';
  box.innerHTML=`<div class="card">
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
  const plat=parseInt(byId('platSel').value,10);
  const net=parseInt(byId('netInput').value.trim(),10);
  const chan=CHANNELS[plat]||'—';
  let tk=null;
  if(plat===1) tk=net;
  if(plat===2) tk=70+net;
  if(plat===3) tk=140+net;
  byId('simResult').innerHTML=`<div class="card"><b>TK global:</b> ${((tk!==null && tk!==undefined)?tk:'—')}<br>Plataforma ${plat} • NETID local ${net} • Canal ${chan}</div>`;
}

function renderList(filterPlat=null){
  const list=byId('list'); list.innerHTML='';
  const rows=filterPlat ? DATA.filter(t=>t.plat===filterPlat) : DATA;
  rows.forEach(t=>{
    const chan=t.chan||CHANNELS[t.plat]||'—';
    const strings=t.strings&&t.strings.length ? t.strings.join(', ') : '—';
    const div=document.createElement('div');
    div.className='card';
    div.innerHTML=`<b>TK ${t.tk} • P${t.plat} • NETID ${t.netid}</b><br>Canal ${chan} • Strings: ${strings}`;
    list.appendChild(div);
  });
  byId('countList').textContent=`${rows.length} registros`;
}

function handleCsvUpload(ev){
  const file=ev.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const text=e.target.result;
      DATA=csvParse(text);
      localStorage.setItem(LS_KEY_CSV,text);
      renderList();
      byId('toast').textContent='CSV cargado y guardado (offline)';
      setTimeout(()=>byId('toast').textContent='',3000);
    }catch(err){
      byId('toast').textContent='Error al leer CSV';
      setTimeout(()=>byId('toast').textContent='',3000);
    }
  };
  reader.readAsText(file);
}

function exportCsv(){
  try{
    const header='TK,Plataforma,ID_local,NETID,Lora_Channel,Strings';
    const rows=DATA.map(t=>{
      const strings=(t.strings||[]).join(';');
      return [t.tk,t.plat,t.idLocal,t.netid,(t.chan??''),strings].join(',');
    });
    const csv=[header,...rows].join('\n');
    const blob=new Blob([csv],{type:'text/csv'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='mapeo_export.csv';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }catch(e){ console.error(e); }
}

async function resetCsv(){
  localStorage.removeItem(LS_KEY_CSV);
  const text=await loadCsvFromAssets();
  DATA=csvParse(text);
  renderList();
  byId('toast').textContent='Restaurado CSV de fábrica';
  setTimeout(()=>byId('toast').textContent='',3000);
}

window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault(); deferredPrompt=e;
  const btn=document.getElementById('installBtn');
  if(btn) btn.style.display='inline-block';
});
async function doInstall(){
  if(!deferredPrompt) return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice;
  deferredPrompt=null;
  const btn=document.getElementById('installBtn'); if(btn) btn.style.display='none';
}

window.addEventListener('load',async()=>{
  // Registrar Service Worker con versión para romper caché
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./service-worker.js?v='+APP_VER); }

  await loadData();
  const savedTab=localStorage.getItem(LS_KEY_TAB)||'buscar';
  showTab(savedTab); renderList();

  // Listeners sin inline (CSP)
  const $ = (id) => document.getElementById(id);
  $('btnBuscar').addEventListener('click',searchTK);
  $('btnSimular').addEventListener('click',simular);
  $('platFilterAll').addEventListener('click',()=>renderList(null));
  $('platFilter1').addEventListener('click',()=>renderList(1));
  $('platFilter2').addEventListener('click',()=>renderList(2));
  $('platFilter3').addEventListener('click',()=>renderList(3));
  $('csvInput').addEventListener('change',handleCsvUpload);
  $('btnExport').addEventListener('click',exportCsv);
  $('btnReset').addEventListener('click',resetCsv);
  const ib=$('installBtn'); if(ib) ib.addEventListener('click',doInstall);
  $('tabbtn-buscar').addEventListener('click',()=>showTab('buscar'));
  $('tabbtn-sim').addEventListener('click',()=>showTab('sim'));
  $('tabbtn-listado').addEventListener('click',()=>showTab('listado'));
  $('tabbtn-acerca').addEventListener('click',()=>showTab('acerca'));
});
