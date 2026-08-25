# AGENTS.md — Joga Books

Guia para cualquier agente IA (Claude Code, etc.) que trabaje en este repo.
Guide for any AI agent working on this repo.

---

## 1. Que es el proyecto / What this is

Joga Books es una PWA (Progressive Web App) que ayuda a cualquier persona
a crear un libro de no ficcion completo usando IA.

Stack: HTML + CSS + JS puro. Sin frameworks, sin build step, sin bundler.
Lo que hay en el repo es lo que se sirve. Mantenerlo asi.

Hosting: GitHub Pages (push = deploy automatico)
IA: Cloudflare Worker con Claude API
Datos: localStorage del usuario
Licencias: gate.js con hashes SHA-256

Archivos principales:
- index.html     landing + acceso con codigo de licencia
- app.html       dashboard — lista de libros del usuario
- wizard.html    flujo 5 pasos para crear un libro nuevo
- editor.html    escritura y humanizacion capitulo x capitulo
- export.html    ver libro completo + copiar + exportar
- gate.js        validacion de licencias SHA-256
- sw.js          service worker offline
- worker.js      Cloudflare Worker (prompts de IA)

---

## 2. Reglas de oro / Golden rules

NUNCA romper estos cuatro sistemas:

1. Licencias (gate.js) — validacion SHA-256. Jamas dejar el gate abierto
   ni exponer codigos en texto plano en archivos publicos.

2. Service Worker / PWA offline — la app debe seguir cargando sin conexion.
   No romper el registro del SW ni la lista de archivos cacheados.

3. i18n (traducciones) — el toggle ES/EN y los diccionarios es:{}/en:{}
   deben funcionar siempre. Key en localStorage: jogaBooks_lang

4. Diseno / branding — colores y estilo no se alteran sin permiso del dueno.

---

## 3. Service Worker — regla de version

Cada cambio de archivos servidos → subir version del cache.
joga-books-v1 → joga-books-v2 → joga-books-v3 ...
Si no se sube la version, el fix no llega al usuario.

---

## 4. Sistema de color

Filosofia: Oscuro + un acento fuerte = premium y profesional.
Referencia: Linear, GitHub, Notion.

Base (todas las pantallas):
  --color-bg-deep:    #0D1117
  --color-bg-card:    #161B22
  --color-border:     #21262D
  --color-text:       #E6EDF3
  --color-muted:      #7D8590
  --color-success:    #22C55E
  --color-error:      #EF4444

Hero Joga Books — Tech Inteligente:
  --color-primary:      #4F8EF7
  --color-primary-dark: #2563EB
  --color-light:        #93C5FD
  --color-glow:         #4F8EF740
  --color-bg-tint:      #0D1B2E
  --color-gold:         #F0C040

Humanizador:
  --color-profesional:    #60A5FA
  --color-conversacional: #34D399
  --color-motivacional:   #F97316

---

## 5. Cloudflare Worker

URL del worker: (configurar en cada HTML como WORKER_URL constante)
Nunca llamar directo a la API de Anthropic desde el frontend.
Siempre via el Worker para no exponer la API key.

Endpoints disponibles:
  POST /titulos     — genera 5 opciones de titulo
  POST /outline     — genera 12 capitulos con nombres
  POST /capitulo    — escribe un capitulo completo
  POST /humanizar   — humaniza texto con tono elegido

---

## 6. localStorage schema

Clave principal: jogaBooks_library (array de libros)
Clave de idioma: jogaBooks_lang = "es" | "en"
Clave de licencia: jogaBooks_licensed = true

Estructura de cada libro:
{
  id, titulo, subtitulo, nicho, audiencia, idioma,
  progreso, total, fechaCreacion, fechaEdicion,
  outline: [{num, nombre, descripcion}],
  capitulos: { "1": {original:"", humanizado:"", tono:""} }
}

---

## 7. Convenciones

- Comentarios y commits bilingues (ES + EN)
- Maximo 200 lineas por archivo HTML/JS
- Mobile first — todo pensado para pantalla de telefono
- Sin librerias externas en MVP (jsPDF en V2 solamente)
- Todos los errores del Worker: mostrar toast al usuario, no console.log

---

## 8. Orden de construccion MVP

1. gate.js
2. index.html
3. app.html
4. wizard.html pasos 1-2 (nicho + audiencia)
5. wizard.html paso 3 (titulos con IA)
6. wizard.html pasos 4-5 (outline + confirmacion)
7. editor.html (generar capitulos)
8. editor.html (humanizador 3 tonos)
9. export.html
10. sw.js + manifest.json
11. AGENTS.md (este archivo — ya existe)

---

## 9. Lo que NO va en MVP (V2)

- Exportar a PDF (usar jsPDF desde CDN en V2)
- Portada con imagen generada
- Compartir libro con link publico
- Editor de portada
- Guia para publicar en Amazon KDP
