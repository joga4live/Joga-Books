/* assets/common.js — Joga Books
   Helpers compartidos por app/wizard/editor/export: acceso a jogaBooks_library,
   llamadas al Worker y el toast de errores. NUNCA fetch directo a
   api.anthropic.com — todo pasa por WORKER_URL.
   Shared helpers for app/wizard/editor/export: jogaBooks_library access,
   Worker calls and the error toast. NEVER fetch api.anthropic.com directly —
   everything goes through WORKER_URL. */
"use strict";

// Placeholder: reemplazar por el subdominio real de Cloudflare al desplegar.
// Placeholder: replace with the real Cloudflare subdomain on deploy.
var WORKER_URL = "https://joga-books.TU-SUBDOMINIO.workers.dev";

function jbLibrary() {
  try { return JSON.parse(localStorage.getItem("jogaBooks_library") || "[]"); }
  catch (e) { return []; }
}

function jbSaveLibrary(lib) {
  try { localStorage.setItem("jogaBooks_library", JSON.stringify(lib)); return true; }
  catch (e) { jbToast("No se pudo guardar. / Could not save.", "error"); return false; }
}

function jbGetBook(id) { return jbLibrary().find(function (b) { return b.id === id; }); }

function jbUpsertBook(book) {
  var lib = jbLibrary();
  var i = lib.findIndex(function (b) { return b.id === book.id; });
  if (i >= 0) lib[i] = book; else lib.push(book);
  return jbSaveLibrary(lib);
}

function jbToday() { return new Date().toISOString().slice(0, 10); }

// Escapa texto (titulos, nombres de capitulo) antes de meterlo en innerHTML —
// parte viene de la IA via el Worker, no confiar en el contenido a ciegas.
// Escapes text (titles, chapter names) before innerHTML — some of it comes
// from the AI via the Worker, never trust it blindly.
function jbEsc(s) {
  var d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

function jbToast(msg, type) {
  var el = document.getElementById("toast");
  if (!el) { return; }
  el.textContent = msg;
  el.className = "show" + (type === "success" ? " success" : "");
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.className = ""; }, 4000);
}

// Llama a un endpoint del Worker. Nunca lanza silenciosamente: quien llama
// debe envolver en try/catch y mostrar jbToast en el error.
// Calls a Worker endpoint. Never fails silently: the caller must wrap in
// try/catch and show jbToast on error.
async function jbCallWorker(path, body) {
  var res = await fetch(WORKER_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("worker_" + res.status);
  return res.json();
}
