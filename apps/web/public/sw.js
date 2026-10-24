const CACHE='febro-one-shell-v12';
const SHELL=['/','/icon.svg','/icon-192.png','/icon-512.png','/manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('febro-one-shell-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;
 if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/')));return;}
 if(u.pathname.startsWith('/assets/')||SHELL.includes(u.pathname)){e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{if(r.ok&&r.type==='basic'&&!r.headers.get('Cache-Control')?.includes('no-store'))caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r;})));}});
self.addEventListener('push',e=>{let data={};try{data=e.data?.json()||{};}catch{}e.waitUntil(self.registration.showNotification('Febro One',{body:data.body||'Anda memiliki pengingat baru.',icon:'/icon-192.png',badge:'/icon-192.png',tag:data.tag||'febro-reminder',data:{url:safeNotificationUrl(data.url)}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async list=>{const client=list.find(c=>new URL(c.url).origin===location.origin);if(client){await client.navigate(safeNotificationUrl(e.notification.data?.url));return client.focus();}return clients.openWindow(safeNotificationUrl(e.notification.data?.url));}));});

function safeNotificationUrl(value){try{const u=new URL(value||'/',location.origin);return u.origin===location.origin?u.pathname+u.search+u.hash:'/';}catch{return '/';}}
