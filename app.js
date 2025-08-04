// Farol v73 - Completa (CSP safe)
let DATA=[];let CHANNELS={1:50,2:55,3:65};let deferredPrompt=null;let QR_TIMER=null;let STREAM=null;
const LS_CSV='farol_csv_text_v1';const LS_TAB='farol_tab_v1';const LS_DARK='farol_dark_v1';const LS_TOKEN='farol_ghtoken_v1';const LS_GIST='farol_gistid_v1';
const APP_VER='73';
const $=(id)=>document.getElementById(id);
function toast(m){const t=$('toast');if(t){t.textContent=m;setTimeout(()=>t.textContent='',3500);}}

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
    const idLocal=parseInt(get('ID_local')||get('ID')||'0',10);
    const netid=parseInt(get('NETID')||idLocal||'0',10);
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
  if(!btn||!pane){name='buscar';}
  hideAllTabs();
  const b=$('tabbtn-'+name); if(b) b.classList.add('active');
  const p=$('tab-'+name); if(p) p.style.display='block';
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

// --- Buscar ---
function searchTK(){
  const v=parseInt(($('tkInput')?.value||'').trim(),10);
  const r=DATA.find(t=>t.tk===v);
  const box=$('searchResult'); if(!box) return; box.innerHTML='';
  if(!r){ box.innerHTML='<div class="small">No encontrado.</div>'; return; }
  const chan=r.chan||CHANNELS[r.plat]||'—';
  const strings=r.strings?.length ? r.strings.map(s=>`<span class="badge">${s}</span>`).join(' ') : '—';
  box.innerHTML = `<div class="card">
    <div class="grid">
      <div><label>TK</label><div>${r.tk}</div></div>
      <div><label>Plataforma</label><div>${r.plat}</div></div>
      <div><label>ID local / NETID</label><div>${r.idLocal}</div></div>
      <div><label>Canal LoRa</label><div>${chan}</div></div>
    </div>
    <div style="margin-top:10px"><label>Strings</label><div>${strings}</div></div>
  </div>`;
}

// --- Avanzada ---
function advBuscar(){
  const p = parseInt(($('advPlat')?.value)||'0',10) || null;
  const ch = parseInt(($('advChan')?.value)||'0',10) || null;
  const tmin = parseInt(($('advTkMin')?.value)||'0',10) || null;
  const tmax = parseInt(($('advTkMax')?.value)||'0',10) || null;
  const txt = (($('advText')?.value)||'').trim().toLowerCase();
  const res = DATA.filter(r=>{
    if(p && r.plat!==p) return false;
    if(ch && (r.chan||CHANNELS[r.plat])!==ch) return false;
    if(tmin && r.tk < tmin) return false;
    if(tmax && r.tk > tmax) return false;
    if(txt){
      const s=(r.strings||[]).join(' ').toLowerCase();
      if(!s.includes(txt)) return false;
    }
    return true;
  });
  const box=$('advResult'); box.innerHTML='';
  if(res.length===0){box.innerHTML='<div class="small">Sin resultados.</div>';return;}
  res.slice(0,500).forEach(t=>{
    const chan=t.chan||CHANNELS[t.plat]||'—';
    const strings=t.strings&&t.strings.length?t.strings.join(', '):'—';
    const div=document.createElement('div'); div.className='card';
    div.innerHTML = `<b>TK ${t.tk} • P${t.plat} • NETID ${t.netid}</b><br>Canal ${chan} • Strings: ${strings}`;
    box.appendChild(div);
  });
}

// --- Simulador (en Buscar rápido) ---
function simular(plat, net){
  const chan=CHANNELS[plat]||'—';
  let tk=null; if(plat===1) tk=net; if(plat===2) tk=70+net; if(plat===3) tk=140+net;
  return {tk,chan};
}

// --- QR ---
async function qrStart(){
  const out=$('qrOutput'); const video=$('video');
  if(!('BarcodeDetector' in window)){ out.textContent='BarcodeDetector no soportado en este navegador.'; return; }
  const detector=new window.BarcodeDetector({formats:['qr_code','code_128','code_39','ean_13','ean_8']});
  try{
    STREAM = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    video.srcObject=STREAM; await video.play();
    out.textContent='Cámara iniciada. Apunta al código.';
    QR_TIMER = setInterval(async()=>{
      try{
        const barcodes=await detector.detect(video);
        if(barcodes && barcodes.length){
          const raw = (barcodes[0].rawValue||'').toString();
          let m = raw.match(/(\d{1,3})$/) || raw.match(/TK\s*=\s*(\d{1,3})/i);
          if(m){
            const v=parseInt(m[1],10);
            $('tkInput').value = v;
            searchTK();
            out.textContent = `Leído: ${raw}`;
          }else{
            out.textContent = `Leído (sin TK): ${raw}`;
          }
        }
      }catch(e){/* ignore frame errors */}
    }, 500);
  }catch(err){
    out.textContent='No se pudo acceder a la cámara.';
  }
}
function qrStop(){
  if(QR_TIMER){clearInterval(QR_TIMER); QR_TIMER=null;}
  if(STREAM){STREAM.getTracks().forEach(t=>t.stop()); STREAM=null;}
  const out=$('qrOutput'); if(out) out.textContent='Cámara detenida.';
}

// --- Editor CRUD ---
function edGetVals(){
  const tk=parseInt(($('edTk')?.value)||'0',10);
  const plat=parseInt(($('edPlat')?.value)||'0',10);
  const idLocal=parseInt(($('edIdLocal')?.value)||'0',10);
  const chan=parseInt(($('edChan')?.value)||'0',10) || null;
  const strings=(($('edStrings')?.value)||'').split(';').map(s=>s.trim()).filter(Boolean);
  return {tk,plat,idLocal,netid:idLocal,chan,strings};
}
function edAdd(){
  const r=edGetVals();
  if(!r.tk||!r.plat||!r.idLocal){toast('TK, Plataforma e ID_local son obligatorios');return;}
  // reemplazar si existe
  const i=DATA.findIndex(x=>x.tk===r.tk);
  if(i>=0){DATA[i]=r;}else{DATA.push(r);}
  localStorage.setItem(LS_CSV, csvString());
  toast('Guardado'); renderList();
}
function edDel(){
  const tk=parseInt(($('edTk')?.value)||'0',10);
  if(!tk){toast('Ingresa TK a eliminar');return;}
  const len=DATA.length;
  DATA = DATA.filter(x=>x.tk!==tk);
  if(DATA.length<len){ localStorage.setItem(LS_CSV, csvString()); toast('Eliminado'); renderList(); }
  else toast('TK no encontrado');
}
function edExport(){
  const blob=new Blob([csvString()],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='mapeo.csv'; a.click();
  URL.revokeObjectURL(url);
}
function edImport(ev){
  const f=ev.target.files?.[0]; if(!f) return;
  const fr=new FileReader();
  fr.onload=()=>{
    try{ DATA = csvParse(String(fr.result)); localStorage.setItem(LS_CSV, String(fr.result)); toast('Importado'); renderList(); }
    catch(e){ toast('Error al importar CSV'); }
  };
  fr.readAsText(f);
}

// --- Backup a Gist ---
async function gistSave(){
  const token=($('ghToken')?.value||'').trim(); const gistId=($('ghGistId')?.value||'').trim();
  if(!token){$('ghMsg').textContent='Falta token.'; return;}
  const body={
    public:false,
    description:'Farol mapeo.csv',
    files:{'mapeo.csv':{'content':csvString()}}
  };
  const hdr={"Authorization":"Bearer "+token,"Accept":"application/vnd.github+json"};
  let url='https://api.github.com/gists'; let method='POST';
  if(gistId){ url+='/' + gistId; method='PATCH'; }
  const resp=await fetch(url,{method,headers:hdr,body:JSON.stringify(body)});
  const js=await resp.json();
  if(resp.ok){
    $('ghMsg').textContent='Gist guardado: '+(js.id||'(sin id)');
    if(js.id){$('ghGistId').value=js.id; localStorage.setItem(LS_GIST, js.id);}
    localStorage.setItem(LS_TOKEN, token);
  }else{
    $('ghMsg').textContent='Error Gist: '+(js.message||resp.status);
  }
}
async function gistLoad(){
  const token=($('ghToken')?.value||'').trim(); const gistId=($('ghGistId')?.value||localStorage.getItem(LS_GIST)||'').trim();
  if(!gistId){$('ghMsg').textContent='Ingresa Gist ID.'; return;}
  const hdr={"Accept":"application/vnd.github+json"}; if(token) hdr["Authorization"]="Bearer "+token;
  const resp=await fetch('https://api.github.com/gists/'+gistId,{headers:hdr});
  const js=await resp.json();
  if(resp.ok && js.files && js.files['mapeo.csv'] && js.files['mapeo.csv'].content){
    const text = js.files['mapeo.csv'].content;
    DATA = csvParse(text); localStorage.setItem(LS_CSV, text); renderList(); $('ghMsg').textContent='Cargado desde Gist.';
  }else{$('ghMsg').textContent='No se pudo cargar Gist.';}
}

// --- Modo oscuro ---
function applyDarkUI(){const d = localStorage.getItem(LS_DARK)==='1'; document.body.classList.toggle('dark', d); $('darkToggle').textContent=d?'Modo claro':'Modo oscuro';}
function toggleDark(){const d=localStorage.getItem(LS_DARK)==='1'; localStorage.setItem(LS_DARK, d?'0':'1'); applyDarkUI();}

// --- Wiring ---
window.addEventListener('load', async()=>{
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./service-worker.js?v='+APP_VER); }
  applyDarkUI();
  $('darkToggle')?.addEventListener('click', toggleDark);

  await loadData();
  // Buscar
  $('btnBuscar')?.addEventListener('click', searchTK);
  // Avanzada
  $('btnAdvBuscar')?.addEventListener('click', advBuscar);
  // QR
  $('qrStart')?.addEventListener('click', qrStart);
  $('qrStop')?.addEventListener('click', qrStop);
  // Editor
  $('edAdd')?.addEventListener('click', edAdd);
  $('edDel')?.addEventListener('click', edDel);
  $('edExport')?.addEventListener('click', edExport);
  $('edImport')?.addEventListener('change', edImport);
  // Ajustes
  $('gistSave')?.addEventListener('click', gistSave);
  $('gistLoad')?.addEventListener('click', gistLoad);

  // Tabs
  [['buscar'],['adv'],['qr'],['editor'],['ajustes'],['listado']].forEach(([n])=>{
    $('tabbtn-'+n)?.addEventListener('click',()=>showTab(n));
  });
  showTab(localStorage.getItem(LS_TAB)||'buscar');
  renderList();
});
