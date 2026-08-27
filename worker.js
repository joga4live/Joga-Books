/* worker.js — Joga Books, Cloudflare Worker
   4 endpoints con los 4 prompts EXACTOS del brief (BRIEF.md). ANTHROPIC_API_KEY
   se lee como secreto de Cloudflare (wrangler secret put ANTHROPIC_API_KEY),
   nunca hardcodeada aqui. CORS abierto para que GitHub Pages pueda llamarlo.
   Este archivo se escribe pero NO se despliega en esta tarea (ver
   plan-mvp-25ago.md, tarea 8).
   4 endpoints with the 4 EXACT prompts from BRIEF.md. ANTHROPIC_API_KEY is
   read as a Cloudflare secret (wrangler secret put ANTHROPIC_API_KEY), never
   hardcoded here. Open CORS so GitHub Pages can call it. This file is
   written but NOT deployed in this task (see the plan, task 8). */
"use strict";

// Sin modelo pedido por José/Kimo MD para este archivo: se usa el modelo
// Claude actual recomendado por defecto. Cambiar solo aqui si hace falta.
// No model was requested by José/Kimo MD for this file: defaults to the
// current recommended Claude model. Change only here if needed.
var ANTHROPIC_MODEL = "claude-opus-5";
var ANTHROPIC_VERSION = "2023-06-01";

var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, CORS_HEADERS)
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
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    var url = new URL(request.url);
    var handler = HANDLERS[url.pathname];
    if (!handler) return json({ error: "not_found" }, 404);
    if (!env.ANTHROPIC_API_KEY) return json({ error: "missing_api_key" }, 500); // nunca hardcodear / never hardcode

    var body;
    try { body = await request.json(); } catch (e) { return json({ error: "invalid_json" }, 400); }

    try {
      return json(await handler(env, body));
    } catch (e) {
      return json({ error: "generation_failed", detail: String((e && e.message) || e) }, 502);
    }
  }
};
