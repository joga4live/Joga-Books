/* sw.js — Joga Books Service Worker
   Cache First para assets propios (misma origin). Network First para
   llamadas al Worker (otra origin: WORKER_URL). Cada cambio de archivos
   servidos sube la version del cache abajo.
   Cache First for our own assets (same origin). Network First for Worker
   calls (different origin: WORKER_URL). Every change to served files bumps
   the cache version below.

   Regla de version / version rule: joga-books-v1 -> v2 -> v3 ... (AGENTS.md #3)
*/
"use strict";
var CACHE_NAME = "joga-books-v16"; // v16: jbCallWorker distingue limite_diario/limite_mensual del Worker (common.js, wizard.html, editor.html) — worker.js no se sirve, no cuenta aqui / v16: jbCallWorker now tells limite_diario/limite_mensual apart from the Worker (common.js, wizard.html, editor.html) — worker.js is never served, doesn't belong here

// Archivos core: si alguno falta, el install debe fallar (bug real).
// Core files: if any is missing, install should fail (a real bug).
var CORE_FILES = [
  "./", "./index.html", "./app.html", "./wizard.html", "./editor.html", "./export.html",
  "./gate.js", "./assets/styles.css", "./assets/i18n.js", "./assets/common.js", "./assets/manifest.json",
  "./assets/wizard.css", "./assets/wizard-data.js",
  "./assets/logo-hero.jpg",
  "./assets/icon-outline.mp4", "./assets/icon-outline-poster.jpg",
  "./assets/icon-chapters.mp4", "./assets/icon-chapters-poster.jpg",
  "./assets/icon-humanizer.mp4", "./assets/icon-humanizer-poster.jpg",
  "./assets/fonts/playfair.woff2", "./assets/fonts/inter.woff2"
];

// icon-192.png/icon-512.png TODAVIA NO EXISTEN en assets/ (gap conocido, ver
// implementacion-mvp-25ago.md). Se cachean aparte y por separado, con su
// propio try/catch, para que su ausencia NUNCA tumbe el install completo.
// icon-192.png/icon-512.png DO NOT EXIST YET in assets/ (known gap, see the
// implementation handoff). Cached separately, each with its own try/catch,
// so their absence never breaks the whole install.
var OPTIONAL_FILES = ["./assets/icon-192.png", "./assets/icon-512.png"];

self.addEventListener("install", function (event) {
  event.waitUntil((async function () {
    var cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_FILES);
    await Promise.all(OPTIONAL_FILES.map(async function (url) {
      try {
        var res = await fetch(url);
        if (res && res.ok) await cache.put(url, res);
      } catch (e) { /* icono ausente: se ignora, no tumba el install / missing icon: ignored, doesn't break install */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return; // POST al Worker: no interceptar / POST to the Worker: don't intercept
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  event.respondWith(sameOrigin ? cacheFirst(req) : networkFirst(req));
});

async function cacheFirst(req) {
  var cached = await caches.match(req);
  if (cached) return cached;
  try {
    var res = await fetch(req);
    if (res && res.ok) { var cache = await caches.open(CACHE_NAME); cache.put(req, res.clone()); }
    return res;
  } catch (e) {
    return cached || new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function networkFirst(req) {
  try {
    return await fetch(req);
  } catch (e) {
    var cached = await caches.match(req);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "offline" }), { status: 503, headers: { "Content-Type": "application/json" } });
  }
}
