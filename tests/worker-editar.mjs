/* tests/worker-editar.mjs — pruebas de la ruta /editar de worker.js (ronda books-edit-21sep).
   fetch simulado: NUNCA llama a la API real de Anthropic. env falso: JOGA_BOOKS_KV en memoria.
   Ejecutar con: node tests/worker-editar.mjs
   tests/worker-editar.mjs — tests for worker.js's /editar route (books-edit-21sep round).
   Simulated fetch: NEVER calls the real Anthropic API. Fake env: JOGA_BOOKS_KV in memory.
   Run with: node tests/worker-editar.mjs */
"use strict";
import assert from "node:assert/strict";

// --- KV en memoria, mismo contrato get/put que el binding real (con expirationTtl ignorado, no hace falta aqui) ---
// --- In-memory KV, same get/put contract as the real binding (expirationTtl ignored, not needed here) ---
function kvFalso() {
  var store = new Map();
  return {
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); return undefined; }
  };
}

// --- Respuesta de Anthropic simulada; cada prueba la fija antes de llamar. ---
// --- Simulated Anthropic reply; each test sets it before calling. ---
var siguienteRespuesta = null; // { text } para 2xx, { status } para forzar un fallo de Anthropic
globalThis.fetch = async function (url) {
  if (String(url).indexOf("api.anthropic.com") === -1) throw new Error("fetch no simulado para: " + url);
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

console.log("\n" + (total - fallos) + "/" + total + " pruebas OK");
if (fallos > 0) { console.log(fallos + " prueba(s) fallaron"); process.exit(1); }
process.exit(0);
