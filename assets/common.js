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
var WORKER_URL = "https://joga-books.omhotien90.workers.dev";

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
// v26 (Nico v25 MEDIO 1): un capitulo tarda ~45 s medidos (44,0 / 44,9 / 46,0 / 46,5 en cuatro pruebas contra el Worker real). Antes no habia NI tiempo limite NI reintento: cualquier hipo de red en esos 45 s dejaba la promesa colgada o la tumbaba, y el cliente solo veia "No se pudo generar", sin saber si fue la red, el tiempo o el servicio. / v26 (Nico v25 MEDIUM 1): a chapter takes ~45 s measured (44.0 / 44.9 / 46.0 / 46.5 across four runs against the real Worker). There was NEITHER a timeout NOR a retry: any network hiccup in those 45 s left the promise hanging or killed it, and the customer only saw "Could not generate", with no way to tell network from timeout from service.
var JB_ESPERA_MAX = 100000; // 100 s: mas del doble de los ~45 s medidos, para no cortar una llamada que iba a llegar / 100 s: over twice the ~45 s measured, so a call that was going to land is not cut short

async function jbCallWorker(path, body, esReintento) {
  var t0 = Date.now(); // v26.1: para saber si el fallo fue rapido o tardio / v26.1: to tell a fast failure from a late one
  var ctrl = typeof AbortController === "function" ? new AbortController() : null;
  var reloj = ctrl ? setTimeout(function () { ctrl.abort(); }, JB_ESPERA_MAX) : null;
  var res;
  try {
    res = await fetch(WORKER_URL + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined
    });
  } catch (e) {
    if (reloj) clearTimeout(reloj);
    // Se agoto el tiempo: NO se reintenta. Reintentar sumaria otros 100 s de espera y el modelo probablemente ya cobro. / Timed out: NO retry. Retrying would add another 100 s and the model has probably already been billed.
    if (e && e.name === "AbortError") throw new Error("tiempo_agotado");
    // v26.1 (Nico v26 MEDIO 1): el reintento SOLO si el fallo fue RAPIDO. Nico midio que un fallo TARDIO ya pago: worker.js enciende la facturacion en cuanto Anthropic responde 2xx y cuenta el uso incluso por el catch, asi que reintentar cobra dos veces Y sube dos el contador diario. Con 70 llamadas al dia y ~60 por libro largo, 11 reintentos dejan al cliente sin poder terminar el libro que ya pago. Umbral 3 s: la llamada mas rapida medida es /titulos a 5,6 s y un capitulo tarda ~45 s, asi que por debajo de 3 s no se genero nada. Decision de Jose: que avise, no que cobre dos veces. / v26.1 (Nico v26 MEDIUM 1): retry ONLY if the failure was FAST. Nico measured that a LATE failure has already been billed: worker.js turns billing on as soon as Anthropic answers 2xx and counts usage even through the catch, so retrying pays twice AND bumps the daily counter twice. At 70 calls a day and ~60 per long book, 11 retries leave the customer unable to finish the book they already paid for. 3 s threshold: the fastest measured call is /titulos at 5.6 s and a chapter takes ~45 s, so under 3 s nothing was generated. José's call: warn rather than double-charge.
    if (!esReintento && Date.now() - t0 < 3000) return jbCallWorker(path, body, true);
    throw new Error("sin_conexion");
  }
  if (reloj) clearTimeout(reloj);
  if (!res.ok) {
    var codigo = "worker_" + res.status;
    // v26.2: el Worker manda DOS datos: "error" (etiqueta, casi siempre "generation_failed") y "detail", que dice QUE fallo de verdad (truncated_max_tokens, anthropic_529, empty_response...). Hasta ahora solo se leia el primero, asi que TODO acababa en el mensaje generico y ni el cliente ni nosotros sabiamos nada. El detalle existia y se tiraba a la basura. / v26.2: the Worker sends TWO fields: "error" (a label, almost always "generation_failed") and "detail", which says what actually failed (truncated_max_tokens, anthropic_529, empty_response...). Only the first was read, so EVERYTHING ended up as the generic message and neither the customer nor we knew anything. The detail existed and was thrown away.
    try {
      var datos = await res.json();
      if (datos && datos.error) codigo = datos.error;
      if (datos && datos.detail && codigo === "generation_failed") codigo = String(datos.detail);
    } catch (e2) {}
    throw new Error(codigo);
  }
  // v26: el parseo tambien puede fallar (respuesta cortada a medias). Sin esto salia el mensaje generico y parecia culpa del modelo. / v26: parsing can fail too (a response cut in half). Without this it surfaced as the generic message and looked like the model's fault.
  try { return await res.json(); }
  catch (e3) { throw new Error("respuesta_incompleta"); }
}

// v16 (tarea 3): traduce el codigo de error del Worker a un mensaje que el
// usuario entienda como "no es un error de la app" en vez del toast
// generico de siempre. Devuelve null para cualquier otro fallo, y quien
// llama sigue usando su mensaje generico de siempre.
// v18 (C3): +texto_demasiado_largo — sin esto, alguien que pega un texto
// gigante en /humanizar se queda pegado en el mismo error generico para
// siempre, sin enterarse de que el problema es el largo del texto.
// v16 (task 3): translates the Worker's error code into a message the
// user reads as "not an app error" instead of the usual generic toast.
// Returns null for any other failure, and the caller keeps using its
// usual generic message.
// v18 (C3): +texto_demasiado_largo — without this, someone who pastes a
// giant text into /humanizar stays stuck on the same generic error
// forever, with no clue the problem is text length.
function jbLimitMessage(e, table) {
  var codigo = e && e.message;
  if (codigo === "limite_diario") return table.limiteDiario;
  if (codigo === "limite_mensual") return table.limiteMensual;
  if (codigo === "texto_demasiado_largo") return table.textoLargo;
  if (codigo === "tiempo_agotado") return table.tiempoAgotado; // v26
  if (codigo === "sin_conexion") return table.sinConexion; // v26
  if (codigo === "respuesta_incompleta") return table.respuestaIncompleta; // v26
  // v26.2: los detalles reales del Worker, traducidos / v26.2: the Worker's real details, translated
  if (codigo === "truncated_max_tokens") return table.capituloLargo;
  if (codigo === "empty_response") return table.respuestaVacia;
  if (codigo.indexOf("anthropic_5") === 0 || codigo === "anthropic_429") return table.iaSaturada;
  return null;
}

// v26.2: para lo que NO sabemos traducir, se ensena el codigo tecnico entre parentesis. Feo, pero es la unica forma de que Jose pueda decirnos que paso de verdad en vez de "no se pudo generar". Se quita cuando sepamos que errores salen. / v26.2: for what we cannot translate, the technical code is shown in brackets. Ugly, but the only way for José to tell us what actually happened instead of "could not generate". To be removed once we know which errors show up.
function jbCodigoTecnico(e) {
  var codigo = e && e.message;
  return codigo ? " (" + codigo + ")" : "";
}
