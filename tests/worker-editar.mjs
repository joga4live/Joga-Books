/* tests/worker-editar.mjs — pruebas de la ruta /editar de worker.js (ronda books-edit-21sep, +v2).
   fetch simulado: NUNCA llama a la API real de Anthropic. env falso: JOGA_BOOKS_KV en memoria.
   Ejecutar con: node tests/worker-editar.mjs
   tests/worker-editar.mjs — tests for worker.js's /editar route (books-edit-21sep round, +v2).
   Simulated fetch: NEVER calls the real Anthropic API. Fake env: JOGA_BOOKS_KV in memory.
   Run with: node tests/worker-editar.mjs */
"use strict";
import assert from "node:assert/strict";

// --- KV en memoria, mismo contrato get/put que el binding real (con expirationTtl ignorado, no hace falta aqui) ---
// v2: cada put() se registra en kvPuts (compartido entre pruebas) para poder espiar +1/dia +1/mes en una
// llamada cobrada y 0 en un rechazo (plan v2, item 15, "contador").
// --- In-memory KV, same get/put contract as the real binding (expirationTtl ignored, not needed here) ---
// v2: every put() is logged into kvPuts (shared across tests) so we can spy +1/day +1/month on a billed
// call and 0 on a rejection (plan v2, item 15, "contador").
var kvPuts = [];
function kvFalso() {
  var store = new Map();
  return {
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { kvPuts.push({ key: key, value: value }); store.set(key, value); return undefined; }
  };
}

// --- Respuesta de Anthropic simulada; cada prueba la fija antes de llamar. ---
// v2: tambien registra el CUERPO que worker.js manda a api.anthropic.com (ultimoCuerpoAnthropic), para
// poder espiar el prompt real en vez de solo mirar la respuesta final (plan v2, item 15, "espia del prompt").
// --- Simulated Anthropic reply; each test sets it before calling. ---
// v2: also records the BODY worker.js sends to api.anthropic.com (ultimoCuerpoAnthropic), so tests can spy
// on the real prompt instead of only looking at the final response (plan v2, item 15, "prompt spy").
var siguienteRespuesta = null; // { text } para 2xx, { status } para forzar un fallo de Anthropic
var ultimoCuerpoAnthropic = null;
globalThis.fetch = async function (url, opts) {
  if (String(url).indexOf("api.anthropic.com") === -1) throw new Error("fetch no simulado para: " + url);
  ultimoCuerpoAnthropic = opts && opts.body ? JSON.parse(opts.body) : null;
  if (siguienteRespuesta && siguienteRespuesta.status) {
    return new Response("error simulado / simulated error", { status: siguienteRespuesta.status });
  }
  var texto = (siguienteRespuesta && siguienteRespuesta.text) || "Texto por defecto.";
  return new Response(JSON.stringify({ content: [{ text: texto }], stop_reason: "end_turn" }), { status: 200 });
};

var worker = (await import("../worker.js")).default;

var env = { ANTHROPIC_API_KEY: "clave-falsa-de-prueba", JOGA_BOOKS_KV: kvFalso() };
var ORIGEN_OK = "https://joga4live.github.io"; // el unico en ORIGENES_PERMITIDOS de worker.js

async function llamar(pathname, body, ip) {
  var req = new Request("https://worker.test" + pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": ORIGEN_OK, "CF-Connecting-IP": ip || "1.2.3.4" },
    body: JSON.stringify(body)
  });
  var res = await worker.fetch(req, env);
  var data = await res.json().catch(function () { return null; });
  return { status: res.status, data: data };
}

var total = 0, fallos = 0;
async function prueba(nombre, fn) {
  total++;
  try { await fn(); console.log("OK   " + nombre); }
  catch (e) { fallos++; console.log("FAIL " + nombre + "\n     -> " + (e && e.message)); }
}

// v2: mismas llaves que arma worker.js (llaveDia = "d:"+hoy+":"+ip, llaveMes = "m:"+mes) para leer los
// contadores reales del KV falso antes/despues de una llamada, sin adivinar valores absolutos (el contador
// mensual es GLOBAL y ya trae acumulado de las pruebas anteriores de este mismo archivo).
// v2: same keys worker.js builds (llaveDia = "d:"+today+":"+ip, llaveMes = "m:"+month) to read the fake
// KV's real counters before/after a call, without guessing absolute values (the monthly counter is GLOBAL
// and already carries whatever the earlier tests in this file added).
function contadorDia(ip) {
  var hoy = new Date().toISOString().slice(0, 10);
  return env.JOGA_BOOKS_KV.get("d:" + hoy + ":" + ip).then(function (v) { return parseInt(v || "0", 10); });
}
function contadorMes() {
  var hoy = new Date().toISOString().slice(0, 10);
  var mes = hoy.slice(0, 7);
  return env.JOGA_BOOKS_KV.get("m:" + mes).then(function (v) { return parseInt(v || "0", 10); });
}

await prueba("POST /editar sin cuerpo -> 400 campos_faltantes", async function () {
  var r = await llamar("/editar", {}, "10.0.0.1");
  assert.equal(r.status, 400);
  assert.equal(r.data.error, "campos_faltantes");
});

await prueba("POST /editar con texto pero sin idioma -> 400 campos_faltantes", async function () {
  var r = await llamar("/editar", { texto: "hola" }, "10.0.0.2");
  assert.equal(r.status, 400);
  assert.equal(r.data.error, "campos_faltantes");
});

await prueba("POST /editar con texto de 20001 caracteres -> 400 texto_demasiado_largo (rechazo, no recorte)", async function () {
  var r = await llamar("/editar", { texto: "a".repeat(20001), idioma: "es" }, "10.0.0.3");
  assert.equal(r.status, 400);
  assert.equal(r.data.error, "texto_demasiado_largo");
});

await prueba("opciones basura (script, string larga, numero, objeto) -> se filtran contra la lista blanca, sigue funcionando", async function () {
  siguienteRespuesta = { text: "Texto editado limpio.\n\nSUGERENCIAS:\n1. Primera sugerencia.\n2. Segunda sugerencia." };
  var r = await llamar("/editar", {
    texto: "hola   mundo", idioma: "es",
    opciones: ["<script>alert(1)</script>", "x".repeat(500), 123, {}, "gramatica", "no_existe"]
  }, "10.0.0.4");
  assert.equal(r.status, 200);
  assert.equal(r.data.contenido, "Texto editado limpio.");
  assert.deepEqual(r.data.sugerencias, ["Primera sugerencia.", "Segunda sugerencia."]);
});

await prueba("opciones no-array (string suelta) -> limpiarCuerpo cae a ['gramatica'], no revienta", async function () {
  siguienteRespuesta = { text: "Editado.\n\nSUGERENCIAS:\n1. Una sola." };
  var r = await llamar("/editar", { texto: "hola", idioma: "en", opciones: "no-es-array" }, "10.0.0.5");
  assert.equal(r.status, 200);
  assert.equal(r.data.contenido, "Editado.");
  assert.deepEqual(r.data.sugerencias, ["Una sola."]);
});

await prueba("opciones ausente (undefined) -> tambien cae a ['gramatica']", async function () {
  siguienteRespuesta = { text: "Editado sin opciones.\n\nSUGERENCIAS:\n1. Sugerencia unica." };
  var r = await llamar("/editar", { texto: "hola", idioma: "es" }, "10.0.0.6");
  assert.equal(r.status, 200);
  assert.equal(r.data.contenido, "Editado sin opciones.");
});

await prueba("respuesta CON bloque SUGERENCIAS: en minusculas -> el split es insensible a mayusculas", async function () {
  siguienteRespuesta = { text: "Contenido en minusculas.\n\nsugerencias:\n1. Una.\n2. Dos.\n3. Tres." };
  var r = await llamar("/editar", { texto: "hola", idioma: "es" }, "10.0.0.7");
  assert.equal(r.status, 200);
  assert.equal(r.data.contenido, "Contenido en minusculas.");
  assert.deepEqual(r.data.sugerencias, ["Una.", "Dos.", "Tres."]);
});

await prueba("respuesta SIN bloque SUGERENCIAS: -> sugerencias:[] y no revienta", async function () {
  siguienteRespuesta = { text: "Solo el texto editado, sin sugerencias." };
  var r = await llamar("/editar", { texto: "hola", idioma: "es" }, "10.0.0.8");
  assert.equal(r.status, 200);
  assert.equal(r.data.contenido, "Solo el texto editado, sin sugerencias.");
  assert.deepEqual(r.data.sugerencias, []);
});

await prueba("mas de 5 sugerencias -> se recortan a 5", async function () {
  siguienteRespuesta = { text: "Contenido.\n\nSUGERENCIAS:\n1. Uno\n2. Dos\n3. Tres\n4. Cuatro\n5. Cinco\n6. Seis\n7. Siete" };
  var r = await llamar("/editar", { texto: "hola", idioma: "es" }, "10.0.0.9");
  assert.equal(r.status, 200);
  assert.equal(r.data.sugerencias.length, 5);
  assert.deepEqual(r.data.sugerencias, ["Uno", "Dos", "Tres", "Cuatro", "Cinco"]);
});

await prueba("contenido vacio (el modelo arranco con SUGERENCIAS:) -> 502 generation_failed / detail empty_response", async function () {
  siguienteRespuesta = { text: "SUGERENCIAS:\n1. Nada de texto antes." };
  var r = await llamar("/editar", { texto: "hola", idioma: "es" }, "10.0.0.10");
  assert.equal(r.status, 502);
  assert.equal(r.data.error, "generation_failed");
  assert.equal(r.data.detail, "empty_response");
});

await prueba("Anthropic responde 529 (saturado) -> 502 generation_failed / detail anthropic_529, sin cobrar ni contar", async function () {
  siguienteRespuesta = { status: 529 };
  var r = await llamar("/editar", { texto: "hola", idioma: "es" }, "10.0.0.11");
  assert.equal(r.status, 502);
  assert.equal(r.data.error, "generation_failed");
  assert.equal(r.data.detail, "anthropic_529");
});

await prueba("origen no permitido -> 403 origen_no_permitido, antes de tocar Anthropic", async function () {
  siguienteRespuesta = { text: "no deberia usarse" };
  var req = new Request("https://worker.test/editar", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "https://evil.example", "CF-Connecting-IP": "10.0.0.12" },
    body: JSON.stringify({ texto: "hola", idioma: "es" })
  });
  var res = await worker.fetch(req, env);
  var data = await res.json();
  assert.equal(res.status, 403);
  assert.equal(data.error, "origen_no_permitido");
});

// ============================================================================
// v2 (plan-books-edit-21sep-v2, item 15) — las pruebas que faltaban segun Nico,
// para matar los 4 mutantes que sus 34 casos mataban y los 12 de Tavo dejaban vivos.
// v2 (plan-books-edit-21sep-v2, item 15) — the tests Nico found missing, to kill
// the 4 mutants his 34 cases caught and Tavo's 12 let live.
// ============================================================================

// --- mutante "tope de 7 opciones -> 50" y "quitar la lista blanca entera": ---
// --- mutant "7-option cap -> 50" and "remove the whole whitelist": ---
await prueba("espia del prompt: opciones repetidas + basura -> UNA linea de 'expandir', ninguna otra (lista blanca real, no solo ausencia de <script>)", async function () {
  siguienteRespuesta = { text: "Contenido.\n\nSUGERENCIAS:\n1. Uno." };
  var r = await llamar("/editar", {
    texto: "hola", idioma: "es",
    opciones: ["expandir", "expandir", "<script>alert(1)</script>", "zzz"]
  }, "10.0.0.20");
  assert.equal(r.status, 200);
  var prompt = ultimoCuerpoAnthropic.messages[0].content;
  assert.equal(prompt.indexOf("<script>"), -1); // control barato, pero NO basta solo: el mapa PROMPTS.editar hace OPCIONES_EDITAR[o], asi que una llave basura da "- undefined", nunca el <script> literal / cheap control, but NOT enough alone: PROMPTS.editar does OPCIONES_EDITAR[o], so a garbage key yields "- undefined", never the literal <script>
  // Assercion real de la lista blanca: recorta al bloque de instrucciones (mismo delimitador que la prueba de
  // abajo) y compara contra la lista EXACTA esperada. Sin la lista blanca, "<script>alert(1)</s" y "zzz" no
  // son llaves de OPCIONES_EDITAR y el mapa produce "- undefined" por cada una -> el bloque tendria 3 lineas,
  // dos de ellas "- undefined", en vez de la unica linea real de "expandir".
  // The real whitelist assertion: slice to the instructions block (same delimiter as the test below) and
  // compare against the EXACT expected list. Without the whitelist, "<script>alert(1)</s" and "zzz" aren't
  // OPCIONES_EDITAR keys and the map yields "- undefined" for each -> the block would have 3 lines, two of
  // them "- undefined", instead of the single real "expandir" line.
  var bloque = prompt.split("aplicando estos cambios:\n")[1].split("\n\nIdioma de salida:")[0];
  var lineasInstruccion = bloque.split("\n").filter(Boolean);
  assert.deepEqual(lineasInstruccion, ["- Desarrolla las ideas con mas detalle."]);
});

await prueba("espia del prompt: 50 opciones validas repetidas (las 7 reales, cíclicas) -> maximo 7 lineas de instruccion", async function () {
  siguienteRespuesta = { text: "Contenido.\n\nSUGERENCIAS:\n1. Uno." };
  var validas = ["gramatica", "estilo", "claridad", "formal", "casual", "conciso", "expandir"];
  var cincuenta = [];
  for (var i = 0; i < 50; i++) cincuenta.push(validas[i % validas.length]);
  var r = await llamar("/editar", { texto: "hola", idioma: "es", opciones: cincuenta }, "10.0.0.21");
  assert.equal(r.status, 200);
  var prompt = ultimoCuerpoAnthropic.messages[0].content;
  // Recorta al bloque de instrucciones de opciones (worker.js lo pone entre "aplicando estos cambios:\n" y
  // "\n\nIdioma de salida:") — el prompt tiene OTRAS lineas "- ..." en "Reglas:" que no deben contarse aqui.
  // Slices down to the options-instruction block (worker.js places it between "aplicando estos cambios:\n"
  // and "\n\nIdioma de salida:") — the prompt has OTHER "- ..." lines under "Reglas:" that must not count here.
  var bloque = prompt.split("aplicando estos cambios:\n")[1].split("\n\nIdioma de salida:")[0];
  var lineasInstruccion = bloque.split("\n").filter(Boolean);
  assert.equal(lineasInstruccion.length, 7); // las 7 llaves de OPCIONES_EDITAR, ni una repetida / all 7 OPCIONES_EDITAR keys, none repeated
});

// --- mutante "frontera de MAX_TEXTO (`>` -> `>=`)": el 20001 ya estaba cubierto; falta el 20000 exacto. ---
// --- mutant "MAX_TEXTO boundary (`>` -> `>=`)": 20001 was already covered; the exact 20000 case was missing. ---
await prueba("texto de exactamente 20000 caracteres -> pasa (el rechazo es en 20001, no en 20000)", async function () {
  siguienteRespuesta = { text: "Contenido de 20000.\n\nSUGERENCIAS:\n1. Uno." };
  var r = await llamar("/editar", { texto: "a".repeat(20000), idioma: "es" }, "10.0.0.22");
  assert.equal(r.status, 200);
  assert.equal(r.data.contenido, "Contenido de 20000.");
});

// --- mutante "facturacion.ok = false (llamada cobrada que no se cuenta)": ---
// --- mutant "facturacion.ok = false (a billed call that doesn't get counted)": ---
await prueba("contador KV: llamada cobrada con exito -> +1 dia, +1 mes, exactamente 2 put", async function () {
  siguienteRespuesta = { text: "Contenido ok.\n\nSUGERENCIAS:\n1. Uno." };
  var ip = "10.0.0.30";
  var diaAntes = await contadorDia(ip), mesAntes = await contadorMes(), putsAntes = kvPuts.length;
  var r = await llamar("/editar", { texto: "hola", idioma: "es" }, ip);
  assert.equal(r.status, 200);
  assert.equal(await contadorDia(ip), diaAntes + 1);
  assert.equal(await contadorMes(), mesAntes + 1);
  assert.equal(kvPuts.length, putsAntes + 2); // un put por llave (dia y mes) / one put per key (day and month)
});

await prueba("contador KV: Anthropic ya respondio 2xx (cobrado) pero el handler falla despues -> igual +1 dia y +1 mes", async function () {
  // contenido vacio -> "/editar" lanza empty_response DESPUES de que askClaude ya puso facturacion.ok=true
  // empty content -> "/editar" throws empty_response AFTER askClaude already set facturacion.ok=true
  siguienteRespuesta = { text: "SUGERENCIAS:\n1. Nada de texto antes." };
  var ip = "10.0.0.31";
  var diaAntes = await contadorDia(ip), mesAntes = await contadorMes();
  var r = await llamar("/editar", { texto: "hola", idioma: "es" }, ip);
  assert.equal(r.status, 502);
  assert.equal(r.data.detail, "empty_response");
  assert.equal(await contadorDia(ip), diaAntes + 1); // ya se cobro, cuenta igual / already billed, still counts
  assert.equal(await contadorMes(), mesAntes + 1);
});

await prueba("contador KV: rechazo por campos_faltantes -> 0 put, contador sin cambio", async function () {
  var ip = "10.0.0.32";
  var diaAntes = await contadorDia(ip), mesAntes = await contadorMes(), putsAntes = kvPuts.length;
  var r = await llamar("/editar", {}, ip);
  assert.equal(r.status, 400);
  assert.equal(await contadorDia(ip), diaAntes);
  assert.equal(await contadorMes(), mesAntes);
  assert.equal(kvPuts.length, putsAntes);
});

await prueba("contador KV: rechazo por texto_demasiado_largo -> 0 put, contador sin cambio, 0 llamadas a Anthropic", async function () {
  var ip = "10.0.0.33";
  ultimoCuerpoAnthropic = null;
  var diaAntes = await contadorDia(ip), mesAntes = await contadorMes(), putsAntes = kvPuts.length;
  var r = await llamar("/editar", { texto: "a".repeat(20001), idioma: "es" }, ip);
  assert.equal(r.status, 400);
  assert.equal(await contadorDia(ip), diaAntes);
  assert.equal(await contadorMes(), mesAntes);
  assert.equal(kvPuts.length, putsAntes);
  assert.equal(ultimoCuerpoAnthropic, null); // nunca se llamo a Anthropic / Anthropic was never called
});

// --- CRITICO 3 + MEDIO 1: marcador por linea completa, ultima aparicion, ambos idiomas. ---
// --- CRITICAL 3 + MEDIUM 1: whole-line marker, last occurrence, both languages. ---
await prueba("CRITICO 3: 'SUGERENCIAS:' dentro del texto del autor Y al final -> el contenido conserva la del autor, solo se separa por la ULTIMA", async function () {
  siguienteRespuesta = { text:
    "Capitulo 3. La primera parte del capitulo.\n\n" +
    "SUGERENCIAS:\n" +
    "- toma agua\n" +
    "- camina 20 minutos\n\n" +
    "Y este es el cierre del capitulo, que el autor escribio.\n\n" +
    "SUGERENCIAS:\n" +
    "1. Acorta la introduccion."
  };
  var r = await llamar("/editar", { texto: "hola", idioma: "es" }, "10.0.0.40");
  assert.equal(r.status, 200);
  assert.ok(r.data.contenido.indexOf("toma agua") !== -1); // la SUGERENCIAS: de en medio no corta nada / the SUGERENCIAS: in the middle cuts nothing
  assert.ok(r.data.contenido.indexOf("Y este es el cierre del capitulo, que el autor escribio.") !== -1);
  assert.deepEqual(r.data.sugerencias, ["Acorta la introduccion."]); // solo la de la ULTIMA aparicion / only the LAST occurrence's
});

await prueba("MEDIO 1: respuesta en ingles con 'SUGGESTIONS:' al final -> tambien se separa, no solo 'SUGERENCIAS:'", async function () {
  siguienteRespuesta = { text: "The edited English text.\n\nSUGGESTIONS:\n1. Tighten the opening.\n2. Vary sentence length." };
  var r = await llamar("/editar", { texto: "hello", idioma: "en" }, "10.0.0.41");
  assert.equal(r.status, 200);
  assert.equal(r.data.contenido, "The edited English text.");
  assert.deepEqual(r.data.sugerencias, ["Tighten the opening.", "Vary sentence length."]);
});

await prueba("CRITICO 3, control de anclaje: 'SUGERENCIAS:' pegado en medio de una linea (no solo en su propia linea) NO cuenta como marcador", async function () {
  siguienteRespuesta = { text: "Este texto menciona micro-SUGERENCIAS:tecnicas pero no tiene el marcador en su propia linea." };
  var r = await llamar("/editar", { texto: "hola", idioma: "es" }, "10.0.0.42");
  assert.equal(r.status, 200);
  assert.equal(r.data.contenido, "Este texto menciona micro-SUGERENCIAS:tecnicas pero no tiene el marcador en su propia linea.");
  assert.deepEqual(r.data.sugerencias, []);
});

console.log("\n" + (total - fallos) + "/" + total + " pruebas OK");
if (fallos > 0) { console.log(fallos + " prueba(s) fallaron"); process.exit(1); }
process.exit(0);
