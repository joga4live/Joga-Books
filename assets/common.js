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
// v3 (N2): innerHTML escapa <, > y & pero NO comillas — wizard.html mete este
// resultado dentro de un atributo value="...", asi que una comilla sin
// escapar truncaba el valor y, peor, permitia inyectar un atributo/evento
// ejecutable (ej. " onfocus="..."). &quot;/&#39; se ven igual como texto.
// Escapes text (titles, chapter names) before innerHTML — some of it comes
// from the AI via the Worker, never trust it blindly.
// v3 (N2): innerHTML escapes <, > and & but NOT quotes — wizard.html puts
// this result inside a value="..." attribute, so an unescaped quote both
// truncated the value and allowed injecting a live attribute/event handler
// (e.g. " onfocus="..."). &quot;/&#39; render identically as plain text.
function jbEsc(s) {
  var d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
// v16: si el Worker corta por limite de gasto (tarea 1 del plan v16),
// devuelve {error:"limite_diario"|"limite_mensual"} — antes ese cuerpo se
// descartaba y todo caia en el mismo "worker_429" generico. Ahora se lee
// el JSON del error y se usa como mensaje del Error lanzado, para que
// quien llama pueda distinguir un limite de un fallo real (ver
// jbLimitMessage). Si el cuerpo no trae "error" (u otro codigo HTTP sin
// cuerpo legible), se cae al "worker_<status>" de siempre.
// Calls a Worker endpoint. Never fails silently: the caller must wrap in
// try/catch and show jbToast on error.
// v16: if the Worker cuts off for a spend limit (task 1 of plan v16), it
// returns {error:"limite_diario"|"limite_mensual"} — that body used to be
// discarded and everything fell into the same generic "worker_429". Now
// the error JSON is read and used as the thrown Error's message, so
// callers can tell a limit apart from a real failure (see
// jbLimitMessage). If the body carries no "error" (or another HTTP code
// with no readable body), it falls back to the usual "worker_<status>".
async function jbCallWorker(path, body) {
  var res = await fetch(WORKER_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    var codigo = "worker_" + res.status;
    try { var datos = await res.json(); if (datos && datos.error) codigo = datos.error; } catch (e) {}
    throw new Error(codigo);
  }
  return res.json();
}

// v16 (tarea 3): traduce el codigo de error del Worker a un mensaje que el
// usuario entienda como "no es un error de la app, se resuelve esperando"
// — en vez del toast generico de siempre. Devuelve null para cualquier
// otro fallo, y quien llama sigue usando su mensaje generico de siempre.
// v16 (task 3): translates the Worker's error code into a message the
// user reads as "not an app error, it resolves by waiting" — instead of
// the usual generic toast. Returns null for any other failure, and the
// caller keeps using its usual generic message.
function jbLimitMessage(e, table) {
  var codigo = e && e.message;
  if (codigo === "limite_diario") return table.limiteDiario;
  if (codigo === "limite_mensual") return table.limiteMensual;
  return null;
}
