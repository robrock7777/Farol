const CACHE='farol-cache-v5';
const ASSETS=['./','./index.html','./style.css','./app.js?v=5','./manifest.webmanifest',
'./assets/icon-192.png','./assets/icon-512.png','./assets/icon-1024.png','./assets/mapeo.csv'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE?caches.delete(k):null))))});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{const clone=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));return resp}).catch(()=>caches.match('./index.html'))))});
