// v72 - robust showTab + assets incluidos + CSP friendly
let DATA=[];let CHANNELS={1:50,2:55,3:65};let deferredPrompt=null;
const LS_CSV='farol_csv_text_v1';const LS_TAB='farol_tab_v1';const APP_VER='72';
const $=(id)=>document.getElementById(id);
function notify(msg){ const t=$('toast'); if(t){t.textContent=msg; setTimeout(()=>t.textContent='',3000);} }

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
function csvString(){const header='TK,Plataforma,ID_local,NETID,Lora_Channel,Strings';return [header,...DATA.map(r=>[r.tk,r.plat,r.idLocal,r.netid,(r.chan??''),(r.strings||[]).join(';')].join(','))].join('\n');}
async function loadCsvFromAssets(){const resp=await fetch('./assets/mapeo.csv');return await resp.text();}
async function loadData(){let text=localStorage.getItem(LS_CSV);if(!text){text=await loadCsvFromAssets();}DATA=csvParse(text);}

function hideAllTabs(){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('[data-tab]').forEach(t=>t.style.display='none');}
function showTab(name){
  const btn=$('tabbtn-'+name); const pane=$('tab-'+name);
  if(!btn||!pane){ name='buscar'; }
  hideAllTabs();
  const btn2=$('tabbtn-'+name); if(btn2) btn2.classList.add('active');
  const pane2=$('tab-'+name); if(pane2) pane2.style.display='block';
  localStorage.setItem(LS_TAB,name);
}

function renderList(filterPlat=null){
  const list=$('list'); if(!list) return; list.innerHTML='';
  const rows = filterPlat? DATA.filter(t=>t.plat===filterPlat) : DATA;
  rows.forEach(t=>{
    const chan=t.chan||CHANNELS[t.plat]||'—';
    const strings=t.strings&&t.strings.length?t.strings.join(', '):'—';
    const div=document.createElement('div'); div.className='card';
    div.innerHTML = `<b>TK ${t.tk} • P${t.plat} • NETID ${t.netid}</b><br>Canal ${chan} • Strings: ${strings}`;
    list.appendChild(div);
  });
  const c=$('countList'); if(c) c.textContent = `${rows.length} registros`;
}

// buscar/simular
function searchTK(){
  const v=parseInt(($('tkInput')?.value||'').trim(),10);
  const r=DATA.find(t=>t.tk===v);
  const box=$('searchResult'); if(!box) return; box.innerHTML='';
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
  const plat=parseInt(($('platSel')?.value)||'0',10);
  const net=parseInt(($('netInput')?.value||'').trim(),10);
  const chan=CHANNELS[plat]||'—';
  let tk=null; if(plat===1) tk=net; if(plat===2) tk=70+net; if(plat===3) tk=140+net;
  const box=$('simResult'); if(box) box.innerHTML = `<div class="card"><b>TK global:</b> ${tk ?? '—'}<br>Plataforma ${plat} • NETID ${net} • Canal ${chan}</div>`;
}

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;});
async function doInstall(){if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; }

window.addEventListener('load', async()=>{
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./service-worker.js?v='+APP_VER); }
  await loadData();
  // wire
  const bindings=[
    ['btnBuscar','click',searchTK],
    ['btnSimular','click',simular],
    ['platFilterAll','click',()=>renderList(null)],
    ['platFilter1','click',()=>renderList(1)],
    ['platFilter2','click',()=>renderList(2)],
    ['platFilter3','click',()=>renderList(3)],
    ['tabbtn-buscar','click',()=>showTab('buscar')],
    ['tabbtn-sim','click',()=>showTab('sim')],
    ['tabbtn-listado','click',()=>showTab('listado')]
  ];
  bindings.forEach(([id,evt,fn])=>{const el=$(id); if(el) el.addEventListener(evt,fn);});
  const savedTab=localStorage.getItem(LS_TAB)||'buscar';
  showTab(savedTab);
  renderList();
});
