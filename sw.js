// ===========================================================
// ConduDrive - SERVICE WORKER
// Guarda el juego en el teléfono/computador para que funcione
// sin internet y se pueda instalar como aplicación.
//  - Archivos del juego: primero la red (siempre la última versión);
//    si no hay internet, la copia guardada.
//  - Three.js (CDN, versión fija): primero la copia guardada.
// Al publicar cambios, sube VERSION para renovar la copia.
// ===========================================================
const VERSION = 'condudrive-v1';
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';

const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/estilos.css',
  'js/main.js', 'js/config.js', 'js/auto.js', 'js/controles.js', 'js/camara.js', 'js/ciudad.js',
  'js/colisiones.js', 'js/trafico.js', 'js/peatones.js', 'js/personajes.js', 'js/senales.js',
  'js/vehiculos.js', 'js/barreras.js', 'js/interior.js', 'js/util.js', 'js/sonido.js',
  'js/marcas.js', 'js/lluvia.js', 'js/minimapa.js', 'js/examen.js', 'js/pwa.js',
  'icons/icono-192.png', 'icons/icono-512.png', 'icons/icono-maskable-192.png', 'icons/icono-maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon-32.png',
  THREE_CDN + 'build/three.module.js',
  THREE_CDN + 'examples/jsm/utils/BufferGeometryUtils.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // De a uno: si falla un archivo opcional, el resto igual se guarda
    await Promise.all(ARCHIVOS.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch((err) => console.warn('No se guardó', url, err))
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const nombre of await caches.keys()) if (nombre !== VERSION) await caches.delete(nombre);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Three.js: versión fija, se usa la copia guardada
  if (req.url.startsWith(THREE_CDN)) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const guardado = await cache.match(req);
      if (guardado) return guardado;
      const resp = await fetch(req);
      if (resp.ok) cache.put(req, resp.clone());
      return resp;
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Archivos del juego: red primero, copia guardada si no hay conexión
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const resp = await fetch(req);
      if (resp.ok) cache.put(req, resp.clone());
      return resp;
    } catch (err) {
      const guardado = await cache.match(req, { ignoreSearch: true });
      if (guardado) return guardado;
      if (req.mode === 'navigate') return (await cache.match('index.html')) || (await cache.match('./'));
      throw err;
    }
  })());
});
