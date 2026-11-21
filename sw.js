/* 財產盤點系統 Service Worker：離線可用、秒開 */
const SHELL = 'prop-shell-v1', ASSETS = 'prop-assets-v1';
const SHELL_KEY = new URL('./', self.location).href;
const STATIC = ['manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    try { const r = await fetch(SHELL_KEY, { cache: 'no-store' }); if (r.ok) await c.put(SHELL_KEY, r); } catch (err) {}
    const a = await caches.open(ASSETS);
    await Promise.all(STATIC.map(u => a.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (![SHELL, ASSETS].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/version.txt')) return; // 版本檢查一律走網路
  // 主程式：先用快取秒開，背景抓新版存起來
  if (req.mode === 'navigate' || url.href.split('?')[0] === SHELL_KEY || url.pathname.endsWith('/index.html')) {
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      const hit = await c.match(SHELL_KEY);
      const net = fetch(SHELL_KEY, { cache: 'no-store' }).then(r => { if (r.ok) c.put(SHELL_KEY, r.clone()); return r; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || new Response('離線中，且尚未下載過程式。請連上網路後再開一次。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })());
    return;
  }
  // 文字辨識元件、圖示：快取優先
  e.respondWith((async () => {
    const c = await caches.open(ASSETS);
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const r = await fetch(req);
    if (r.ok && (url.pathname.includes('/ocr/') || STATIC.some(s => url.pathname.endsWith(s)))) c.put(req, r.clone());
    return r;
  })());
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
