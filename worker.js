/* worker.js — Joga Books, Cloudflare Worker. 4 endpoints con los 4 prompts EXACTOS del brief (BRIEF.md); ANTHROPIC_API_KEY se lee como secreto de Cloudflare, nunca hardcodeada aqui.
   v16: lista blanca de CORS (antes "*", capa liviana, ver ORIGENES_PERMITIDOS) + limites diario/mensual por KV. v18 (plan-mvp-25ago-v18.md): 3 agujeros de gasto que Nico midio ejecutando el codigo (C1/C2/C3, ver esos comentarios) + guard de KV (I1) + effort de Opus explicito (I2). Detalle completo en implementacion-mvp-25ago-v18.md, no repetido aqui.
   4 endpoints with the 4 EXACT prompts from BRIEF.md; ANTHROPIC_API_KEY is read as a Cloudflare secret, never hardcoded here.
   v16: allowlisted CORS (was "*", light layer, see ORIGENES_PERMITIDOS) + KV-backed daily/monthly limits. v18 (plan-mvp-25ago-v18.md): 3 spend holes Nico measured by running the code (C1/C2/C3, see those comments) + a KV guard (I1) + explicit Opus effort (I2). Full detail in implementacion-mvp-25ago-v18.md, not repeated here. */
"use strict";

// Modelo: Opus, a proposito — Jose lo eligio sabiendo que cuesta mas (v16), no se cambia. / Model: Opus, on purpose — José chose it knowing it costs more (v16), unchanged.
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

// v16 limites de gasto, patron de joga-ia-worker.js. v18 (C2): KV no es atomico (Nico: 26 peticiones paralelas = 1 sola contada). Verifique contra la doc de Cloudflare que el binding de Rate Limiting y Durable Objects (atomicos) exigen wrangler, no el dashboard — Jose solo despliega por dashboard, ninguno es viable sin pedirle un paso nuevo y fragil. Se queda en KV con la carrera aceptada; LIMITE_MENSUAL bajado es el margen real, NO un tope firme de dinero.
// v16 spend limits, pattern from joga-ia-worker.js. v18 (C2): KV isn't atomic (Nico: 26 parallel requests = 1 counted). Verified against Cloudflare's docs that the Rate Limiting binding and Durable Objects (atomic) both require wrangler, not the dashboard — José only deploys via dashboard, neither is viable without asking him for a new, fragile step. Staying on KV with the race accepted; the lowered LIMITE_MENSUAL is the real margin, NOT a firm dollar cap.
var LIMITE_DIARIO = 70;   // llamadas/IP/dia. v23: 55->70, un libro largo (29 caps, 60 llamadas) ya cabe completo en un dia / calls/IP/day. v23: 55->70, a long book (29 chapters, 60 calls) now fits in one day
var LIMITE_MENSUAL = 900; // v18: bajado de 1000 a 400, margen para C2 e I2. v23: 400->900, aprobado por Jose — a 400 el tope mordia mucho antes que su presupuesto ($20 de $50/mes); 900 se acerca sin pasarse. Sigue siendo cuentakilometros, no freno de gasto (ese es el tope de la consola de Anthropic) / v18: lowered from 1000 to 400, margin for C2 and I2. v23: 400->900, José-approved — at 400 the call cap bit well before his budget ($20 of $50/mo); 900 gets close without going over. Still an odometer, not a spend cap (that's the Anthropic console's limit)

function json(data, status, origen) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, cors(origen))
  });
}

// Llama a la Messages API de Anthropic, devuelve el texto de la respuesta. / Calls the Anthropic Messages API, returns the response text.
// v18 (I2): verificado contra la skill claude-api, no memoria: en claude-opus-5 omitir "thinking" corre pensamiento adaptivo ENCENDIDO (a diferencia de Opus 4.8/4.7) con effort:"high" por defecto (el valor por defecto, no el mas caro — xhigh y max quedan por encima, correccion v19), y max_tokens es tope duro sobre pensamiento+respuesta. No se apaga el pensamiento (tiene sus propios efectos secundarios) — se acota con effort:"low" (el mas bajo de los 5), dejando mas margen para la respuesta real.
// v18 (I2): verified against the claude-api skill, not memory: on claude-opus-5 omitting "thinking" runs adaptive thinking ON (unlike Opus 4.8/4.7) at effort:"high" by default (the default value, not the priciest — xhigh and max sit above it, v19 correction), and max_tokens hard-caps thinking+response combined. Not disabling thinking (it has its own side effects) — scaling it down with effort:"low" (the lowest of the 5) instead, leaving more room for the real response.
async function askClaude(env, prompt, maxTokens, facturacion) {
  var res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL, max_tokens: maxTokens,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) throw new Error("anthropic_" + res.status); // v18 (C1): Anthropic rechazo, no cobro, no se cuenta / Anthropic rejected, not billed, don't count
  facturacion.ok = true; // v18 (C1): 2xx = ya se cobro, pase lo que pase despues / 2xx = already billed, whatever happens next
  var data = await res.json();
  // v2 (M4): un stop_reason de max_tokens es texto cortado a la mitad — mejor un error visible que entregarlo como capitulo completo. / v2 (M4): a max_tokens stop_reason means text cut mid-thought — a visible error beats handing it back as a finished chapter.
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

// v18 (C3): topes de entrada — el hermano tenia MAX_SITUACION=1200, perdido al adaptar (Nico: 960747 caracteres a /humanizar contaron como 1 sola llamada). 'texto' se RECHAZA (truncarlo daria una humanizacion a medias, infiel al original); el resto son frases cortas donde recortar no pierde sentido, asi que se RECORTAN sin bloquear el flujo.
// v18 (C3): input caps — the sibling had MAX_SITUACION=1200, lost in the adaptation (Nico: 960,747 characters to /humanizar counted as 1 call). 'texto' is REJECTED (truncating would give a half-done, unfaithful humanization); everything else is a short phrase where trimming loses no meaning, so those are CLAMPED instead of blocking the flow.
var MAX_CORTO = 200;   // nicho, audiencia, titulo, titulo_libro, nombre_capitulo, num: frases, no ensayos / short phrases, not essays
var MAX_TONO = 50;     // tono, idioma: valores fijos cortos / short fixed values
var MAX_TEXTO = 20000; // humanizar: un capitulo real ronda 7000 caracteres, da margen / a real chapter runs ~7000 chars, this gives headroom

function limpiarCuerpo(b) {
  if (!b || typeof b !== "object") return false; // v19 (CRITICO 3): cuerpo null/no-objeto no debe reventar leyendo b.texto — regresion, v16 respondia 502 con CORS
  if (b.texto != null) { b.texto = String(b.texto); if (b.texto.length > MAX_TEXTO) return false; } // v19 (CRITICO 1): normalizar ANTES de medir — "typeof === string" dejaba pasar un array (["x".repeat(3800000)]) entero, $4.75 en 1 llamada, contada como 1
  ["nicho", "audiencia", "titulo", "titulo_libro", "nombre_capitulo", "num"].forEach(function (k) { if (b[k] != null) b[k] = String(b[k]).slice(0, MAX_CORTO); });
  ["idioma", "tono"].forEach(function (k) { if (b[k] != null) b[k] = String(b[k]).slice(0, MAX_TONO); });
  return true;
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
    // v24 (Nico v23 CRITICO 1): se interpola Number(), no el crudo. La whitelist de abajo valida Number(b.num_capitulos), pero num_capitulos NO esta en limpiarCuerpo() y Number() ignora los espacios de los extremos: " ".repeat(500000)+"12" pasaba la whitelist y entraba ENTERO al prompt (500 031 caracteres, ~$5 en una sola llamada contada como una). Number() aqui lo deja en 31 caracteres. Cierra tambien "0x1D"->29 y "2.0e1"->20, que pasaban la whitelist y le pedian al modelo un numero ilegible. / v24 (Nico v23 CRITICAL 1): interpolate Number(), not the raw value. The whitelist below validates Number(b.num_capitulos), but num_capitulos is NOT in limpiarCuerpo() and Number() ignores surrounding whitespace: " ".repeat(500000)+"12" passed the whitelist and went WHOLE into the prompt (500,031 chars, ~$5 in a single call counted as one). Number() here cuts it to 31 chars. Also closes "0x1D"->29 and "2.0e1"->20, which passed the whitelist and asked the model for an unreadable number.
    return "Genera un indice profesional de exactamente " + Number(b.num_capitulos) + " capitulos\n" +
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
  "/titulos": async function (env, body, f) { return { titulos: parseJson(await askClaude(env, PROMPTS.titulos(body), 600, f)) }; },
  "/outline": async function (env, body, f) { return { capitulos: parseJson(await askClaude(env, PROMPTS.outline(body), 2000, f)) }; },
  "/capitulo": async function (env, body, f) { return { contenido: (await askClaude(env, PROMPTS.capitulo(body), 4500, f)).trim() }; }, // v2 (M4): 3000 -> 4500, sin holgura para espanol/humanizar
  "/humanizar": async function (env, body, f) { return { contenido: (await askClaude(env, PROMPTS.humanizar(body), 4500, f)).trim() }; } // v2 (M4): idem
};

var CAMPOS_REQUERIDOS = { "/titulos": ["nicho", "audiencia", "idioma"], "/outline": ["titulo", "nicho", "audiencia", "idioma", "num_capitulos"], "/capitulo": ["num", "nombre_capitulo", "titulo_libro", "nicho", "audiencia", "idioma"], "/humanizar": ["tono", "idioma", "texto"] }; // v20 (tarea 3): campos que arma el prompt de cada endpoint (ver PROMPTS) — sin ellos no hay nada que preguntarle a la IA, cortar antes de gastar / fields each endpoint's prompt needs (see PROMPTS) — without them there's nothing to ask the AI, cut before spending

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
    if (!env.JOGA_BOOKS_KV) return json({ error: "missing_kv" }, 500, origen); // v18 (I1): gemelo del guard de arriba — sin esto el TypeError revienta sin CORS y el navegador ni ve el error / v18 (I1): twin of the guard above — without it the TypeError crashes with no CORS and the browser can't even see the error

    var body;
    try { body = await request.json(); } catch (e) { return json({ error: "invalid_json" }, 400, origen); }
    try { if (!limpiarCuerpo(body)) return json({ error: "texto_demasiado_largo" }, 400, origen); } catch (e) { return json({ error: "texto_demasiado_largo" }, 400, origen); } // v18 (C3) + v20 (tarea 1, Nico v19 CRITICO1): String() dentro de limpiarCuerpo puede lanzar ({"toString":"x"}, array muy anidado) y corria ANTES del try/catch de abajo — sin este catch salia sin Response y sin CORS / String() inside limpiarCuerpo can throw and ran BEFORE the try/catch below — without this catch it exited with no Response and no CORS
    if ((CAMPOS_REQUERIDOS[url.pathname] || []).some(function (k) { return body[k] == null || body[k] === ""; })) return json({ error: "campos_faltantes" }, 400, origen); // v20 (tarea 3): cuerpo vacio/incompleto no debe llegar a Anthropic / empty/incomplete body shouldn't reach Anthropic
    if (url.pathname === "/outline" && [12, 20, 29].indexOf(Number(body.num_capitulos)) === -1) return json({ error: "num_capitulos_invalido" }, 400, origen); // v23 (tarea 2): num_capitulos es entrada del cliente y cada capitulo cuesta dinero — whitelist server-side, no un numero arbitrario / v23 (task 2): num_capitulos is client input and each chapter costs money — server-side whitelist, not an arbitrary number
    // Tarea 1 (v16): contador compartido por los 4 endpoints (un libro son ~26 llamadas repartidas entre ellos). / Task 1 (v16): one counter shared by all 4 endpoints (a book is ~26 calls spread across them).
    var ip = request.headers.get("CF-Connecting-IP") || "sin-ip"; // Cloudflare la pone siempre, no X-Forwarded-For / Cloudflare always sets this, not X-Forwarded-For
    var hoy = new Date().toISOString().slice(0, 10);
    var mes = hoy.slice(0, 7);
    var llaveDia = "d:" + hoy + ":" + ip;
    var llaveMes = "m:" + mes;

    var usadasHoy = 0, usadasMes = 0, leyoDia = false, leyoMes = false; // v21 (CRITICO1, Nico v20): fail-open si KV.get() lanza (v20) pero SOLO se reescribe la llave que SI se pudo leer — antes el "0" por defecto se escribia encima del contador real y lo rebobinaba a 1, apagando el tope para todos / fail-open if KV.get() throws (v20) but ONLY the key that COULD be read gets written back — before, the default "0" overwrote the real counter and rewound it to 1, disabling the cap for everyone
    try { usadasHoy = parseInt((await env.JOGA_BOOKS_KV.get(llaveDia)) || "0", 10); leyoDia = true; } catch (e) {}
    if (usadasHoy >= LIMITE_DIARIO) return json({ error: "limite_diario" }, 429, origen);

    try { usadasMes = parseInt((await env.JOGA_BOOKS_KV.get(llaveMes)) || "0", 10); leyoMes = true; } catch (e) {}
    if (usadasMes >= LIMITE_MENSUAL) return json({ error: "limite_mensual" }, 429, origen);

    // v18 (C1): "facturacion.ok" lo enciende askClaude en cuanto Anthropic responde 2xx — ya cobrado, pase lo que pase despues. El conteo depende de ESO, no de si el handler tuvo exito (v16: 200 truncados = $22.50 y contador en 0, medido). / v18 (C1): "facturacion.ok" flips on the moment Anthropic answers 2xx — already billed, whatever happens next. Counting depends on THAT, not on the whole handler succeeding (v16: 200 truncated calls = $22.50 with the counter at 0, measured).
    var facturacion = { ok: false };
    var contar = function () { return Promise.all([
      leyoDia ? env.JOGA_BOOKS_KV.put(llaveDia, String(usadasHoy + 1), { expirationTtl: 172800 }) : null, // v21: si no se pudo leer, no se escribe encima del valor real / v21: if it couldn't be read, don't overwrite the real value
      leyoMes ? env.JOGA_BOOKS_KV.put(llaveMes, String(usadasMes + 1), { expirationTtl: 3456000 }) : null
    ]).catch(function () {}); }; // v19 (CRITICO 2): KV documenta 1 escritura/seg/llave — si el put falla no debe tumbar la respuesta (regresion: mataba el Worker sin CORS). Ya se cobro; si se pierde el conteo, se pierde el conteo, pero el usuario recibe respuesta legible
    var resultado;
    try {
      resultado = await handler(env, body, facturacion);
    } catch (e) {
      if (facturacion.ok) await contar();
      return json({ error: "generation_failed", detail: String((e && e.message) || e) }, 502, origen);
    }

    await contar();
    return json(resultado, 200, origen);
  }
};
