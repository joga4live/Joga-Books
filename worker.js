/* worker.js — Joga Books, Cloudflare Worker
   4 endpoints con los 4 prompts EXACTOS del brief (BRIEF.md). ANTHROPIC_API_KEY
   se lee como secreto de Cloudflare, nunca hardcodeada aqui.
   v16 (plan-mvp-25ago-v16.md): lista blanca de CORS (antes "*") + limites
   diario/mensual por KV (antes ninguno). La lista blanca es una capa
   liviana: Origin se falsifica con un curl, medido en el hermano
   (../joga-intelligence-repo/.joga/handoff/plan-worker-21ago.md) — la
   defensa real de gasto son los contadores de abajo, no esto.
   4 endpoints with the 4 EXACT prompts from BRIEF.md. ANTHROPIC_API_KEY is
   read as a Cloudflare secret, never hardcoded here.
   v16 (plan-mvp-25ago-v16.md): allowlisted CORS (was "*") + KV-backed
   daily/monthly limits (was none). The allowlist is a light layer: Origin
   is spoofed with one curl, measured on the sibling
   (../joga-intelligence-repo/.joga/handoff/plan-worker-21ago.md) — the
   real spend defense is the counters below, not this. */
"use strict";

// Modelo: Opus, a proposito — Jose lo eligio sabiendo que cuesta mas (v16), no se cambia.
// Model: Opus, on purpose — José chose it knowing it costs more (v16), unchanged.
var ANTHROPIC_MODEL = "claude-opus-5";
var ANTHROPIC_VERSION = "2023-06-01";

// v16 candado de dominio (tarea 2) — solo detiene uso casual, ver header. / v16 domain lock (task 2) — stops casual use only, see header.
var ORIGENES_PERMITIDOS = [
  "https://joga4live.github.io" // GitHub Pages real, confirmado con curl -I / real GitHub Pages, confirmed with curl -I
];

function esOrigenPermitido(origen) {
  if (ORIGENES_PERMITIDOS.indexOf(origen) !== -1) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origen); // solo pruebas locales / local testing only
}

function cors(origen) {
  var permitido = esOrigenPermitido(origen) ? origen : ORIGENES_PERMITIDOS[0];
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

// v16 limites de gasto (tarea 1) — mismo patron probado en produccion en
// joga-ia-worker.js (Joga Intelligence), lineas ~111-135 y ~177-178.
// v16 spend limits (task 1) — same pattern proven in production in
// joga-ia-worker.js (Joga Intelligence), lines ~111-135 and ~177-178.
var LIMITE_DIARIO = 55;    // llamadas/IP/dia, ~2 libros/persona/dia / calls/IP/day, ~2 books/person/day
var LIMITE_MENSUAL = 1000; // llamadas/mes, ~38 libros ~$46, techo ~$50 de Jose / calls/month, ~38 books ~$46, José's ~$50 ceiling

function json(data, status, origen) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, cors(origen))
  });
}

// Llama a la Messages API de Anthropic, devuelve el texto de la respuesta.
// Calls the Anthropic Messages API, returns the response text.
async function askClaude(env, prompt, maxTokens) {
  var res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION
    },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] })
  });
  if (!res.ok) throw new Error("anthropic_" + res.status);
  var data = await res.json();
  // v2 (M4): un stop_reason de max_tokens es texto cortado a la mitad — mejor
  // un error visible (el frontend ya muestra el toast) que entregarlo como
  // capitulo completo. / v2 (M4): a max_tokens stop_reason means text cut
  // mid-thought — a visible error (the frontend already toasts it) beats
  // handing it back as a finished chapter.
  if (data.stop_reason === "max_tokens") throw new Error("truncated_max_tokens");
  var text = data.content && data.content[0] && data.content[0].text;
  if (!text) throw new Error("empty_response");
  return text;
}

// Los prompts piden "SOLO JSON" pero Claude a veces envuelve en ```json.
// The prompts ask for "JSON only" but Claude sometimes wraps it in ```json.
function parseJson(text) {
  var cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

// Prompts EXACTOS de BRIEF.md, con [PLACEHOLDERS] sustituidos por el input.
// EXACT prompts from BRIEF.md, with [PLACEHOLDERS] filled from the input.
var PROMPTS = {
  titulos: function (b) {
    return "Eres experto en marketing editorial de libros de no ficcion.\n" +
      "Genera exactamente 5 titulos para un libro sobre " + b.nicho + "\n" +
      "dirigido a " + b.audiencia + " en idioma " + b.idioma + ".\n" +
      'Formato de cada titulo: "Titulo Principal: Subtitulo especifico"\n' +
      "El titulo debe ser memorable, con promesa clara, especifico.\n" +
      "Cada opcion diferente en angulo y tono.\n" +
      "Responde SOLO con un JSON array de 5 strings.";
  },
  outline: function (b) {
    return "Genera un indice profesional de exactamente 12 capitulos\n" +
      'para el libro "' + b.titulo + '" sobre ' + b.nicho + " dirigido a " + b.audiencia + ".\n" +
      "Idioma: " + b.idioma + ".\n" +
      "Progresion logica: del problema a la solucion, de basico a avanzado.\n" +
      "Cada capitulo: nombre corto (max 6 palabras) + descripcion 1 oracion.\n" +
      'Responde SOLO con JSON array: [{"num":1,"nombre":"...","descripcion":"..."}]';
  },
  capitulo: function (b) {
    return "Escribe el capitulo " + b.num + ': "' + b.nombre_capitulo + '"\n' +
      'del libro "' + b.titulo_libro + '" sobre ' + b.nicho + ".\n" +
      "Audiencia: " + b.audiencia + ". Idioma: " + b.idioma + ".\n" +
      "Estilo: directo, practico, con ejemplos reales y especificos.\n" +
      "Longitud: 900-1200 palabras exactas.\n" +
      "Estructura: parrafo de apertura gancho + desarrollo + cierre con takeaway.\n" +
      "Sin frases corporativas. Sin relleno. Sin titulos internos con #.\n" +
      "Solo texto corrido listo para leer.";
  },
  humanizar: function (b) {
    return "Reescribe el siguiente texto para que suene como una persona\n" +
      "real hablando directamente con el lector.\n\n" +
      "Tono requerido:\n" +
      "- conversacional: como hablar con un amigo inteligente, frases cortas, humor ligero ocasional\n" +
      '- profesional: claro y directo, sin jerga corporativa, sin "es importante destacar"\n' +
      "- motivacional: energico, imperativo, como un coach que cree en ti\n\n" +
      "Tono seleccionado: " + b.tono + "\n" +
      "Idioma: " + b.idioma + "\n\n" +
      "Reglas:\n" +
      "- Mantener EXACTAMENTE las mismas ideas y ejemplos\n" +
      "- No agregar ni quitar informacion\n" +
      '- Eliminar frases como: "en el ambito de", "cabe destacar", "es importante mencionar"\n' +
      "- Variar el ritmo: mezcla frases cortas y largas\n" +
      "- Maximo 2 lineas por parrafo\n\n" +
      "Texto a humanizar:\n" + b.texto + "\n\n" +
      "Responde SOLO con el texto humanizado, sin explicaciones.";
  }
};

var HANDLERS = {
  "/titulos": async function (env, body) { return { titulos: parseJson(await askClaude(env, PROMPTS.titulos(body), 600)) }; },
  "/outline": async function (env, body) { return { capitulos: parseJson(await askClaude(env, PROMPTS.outline(body), 2000)) }; },
  "/capitulo": async function (env, body) { return { contenido: (await askClaude(env, PROMPTS.capitulo(body), 4500)).trim() }; }, // v2 (M4): 3000 -> 4500, sin holgura para espanol/humanizar
  "/humanizar": async function (env, body) { return { contenido: (await askClaude(env, PROMPTS.humanizar(body), 4500)).trim() }; } // v2 (M4): idem
};

export default {
  async fetch(request, env) {
    var origen = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") return new Response(null, { headers: cors(origen) });
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, origen);

    if (!esOrigenPermitido(origen)) return json({ error: "origen_no_permitido" }, 403, origen); // tarea 2, antes de tocar Anthropic / task 2, before touching Anthropic

    var url = new URL(request.url);
    var handler = HANDLERS[url.pathname];
    if (!handler) return json({ error: "not_found" }, 404, origen);
    if (!env.ANTHROPIC_API_KEY) return json({ error: "missing_api_key" }, 500, origen); // nunca hardcodear / never hardcode

    var body;
    try { body = await request.json(); } catch (e) { return json({ error: "invalid_json" }, 400, origen); }

    // Tarea 1: contador compartido por los 4 endpoints (un libro son ~26
    // llamadas repartidas entre ellos, todas cuentan igual).
    // Task 1: one counter shared by all 4 endpoints (a book is ~26 calls
    // spread across them, all counted the same).
    var ip = request.headers.get("CF-Connecting-IP") || "sin-ip"; // Cloudflare la pone siempre, no X-Forwarded-For / Cloudflare always sets this, not X-Forwarded-For
    var hoy = new Date().toISOString().slice(0, 10);
    var mes = hoy.slice(0, 7);
    var llaveDia = "d:" + hoy + ":" + ip;
    var llaveMes = "m:" + mes;

    var usadasHoy = parseInt((await env.JOGA_BOOKS_KV.get(llaveDia)) || "0", 10);
    if (usadasHoy >= LIMITE_DIARIO) return json({ error: "limite_diario" }, 429, origen);

    var usadasMes = parseInt((await env.JOGA_BOOKS_KV.get(llaveMes)) || "0", 10);
    if (usadasMes >= LIMITE_MENSUAL) return json({ error: "limite_mensual" }, 429, origen);

    var resultado;
    try {
      resultado = await handler(env, body);
    } catch (e) {
      return json({ error: "generation_failed", detail: String((e && e.message) || e) }, 502, origen);
    }

    // Solo se cuenta si Anthropic respondio bien de verdad / only counted on a real success from Anthropic
    await env.JOGA_BOOKS_KV.put(llaveDia, String(usadasHoy + 1), { expirationTtl: 172800 });
    await env.JOGA_BOOKS_KV.put(llaveMes, String(usadasMes + 1), { expirationTtl: 3456000 });

    return json(resultado, 200, origen);
  }
};
