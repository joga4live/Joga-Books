# JOGA BOOKS — Brief Completo para Claude Code
## Proyecto nuevo desde cero

---

## QUE ES EL PROYECTO

Joga Books es una PWA (Progressive Web App) que ayuda a cualquier persona
a crear un libro de no ficcion completo usando IA.

El usuario elige un nicho, una audiencia y un titulo.
La IA genera el outline completo y escribe cada capitulo.
Un segundo paso "Humanizador" convierte el texto robotico en texto natural.

El resultado: un libro de no ficcion de 40-60 paginas listo para exportar
en 1-2 horas, sin experiencia previa de escritura.

---

## STACK TECNICO

- HTML + CSS + JS puro. SIN frameworks. SIN npm. SIN build step.
- GitHub Pages como hosting (push = deploy automatico)
- localStorage para guardar libros del usuario
- Cloudflare Worker para llamadas a IA (Claude via API)
- PWA con Service Worker para funcionar offline
- Licencias via gate.js con hashes SHA-256

REGLA DE ORO: Lo que hay en el repo es lo que se sirve.
Mantener todo en archivos planos. Maximo 200 lineas por archivo.

---

## ESTRUCTURA DE ARCHIVOS

```
joga-books/
├── index.html        landing page + acceso con codigo de licencia
├── app.html          dashboard — lista de libros del usuario
├── wizard.html       flujo de 5 pasos para crear un libro nuevo
├── editor.html       escritura y humanizacion capitulo x capitulo
├── export.html       ver libro completo + copiar + exportar
├── gate.js           validacion de licencias SHA-256
├── sw.js             service worker — cache offline
├── worker.js         Cloudflare Worker — prompts de IA
├── AGENTS.md         guia para futuros agentes IA
└── assets/
    ├── icon-192.png
    ├── icon-512.png
    └── manifest.json
```

---

## SISTEMA DE COLOR

FILOSOFIA: Oscuro + un solo acento fuerte = premium y profesional.
Referencia visual: Linear, GitHub, Notion. Serio, confiable, tech.

### Base compartida (todas las pantallas):
```css
--color-bg-deep:    #0D1117;   /* negro azulado — fondo principal */
--color-bg-card:    #161B22;   /* fondo de cards */
--color-border:     #21262D;   /* bordes sutiles */
--color-text:       #E6EDF3;   /* texto principal blanco frio */
--color-muted:      #7D8590;   /* texto secundario */
--color-success:    #22C55E;   /* estados positivos */
--color-error:      #EF4444;   /* estados de error */
```

### Color hero de Joga Books — "Tech Inteligente":
```css
--color-primary:      #4F8EF7;   /* azul electrico — hero principal */
--color-primary-dark: #2563EB;   /* hover y pressed */
--color-light:        #93C5FD;   /* highlights y badges */
--color-glow:         #4F8EF740; /* glow en botones y cards activas */
--color-bg-tint:      #0D1B2E;   /* cards con tono azul profundo */
--color-gold:         #F0C040;   /* dorado solo para highlights premium */
```

### Colores del humanizador (3 tonos):
```css
--color-profesional:    #60A5FA;  /* azul — formal */
--color-conversacional: #34D399;  /* verde — amigable */
--color-motivacional:   #F97316;  /* naranja — energico */
```

---

## TIPOGRAFIA

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Titulos hero */
font-size: 32px;
font-weight: 900;
letter-spacing: -0.5px;

/* Subtitulos de seccion */
font-size: 18px;
font-weight: 700;

/* Cuerpo normal */
font-size: 15px;
line-height: 1.7;

/* Labels y etiquetas */
font-size: 11px;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 1px;
color: var(--color-muted);
```

---

## PANTALLA 1 — INDEX.HTML (Landing + Acceso)

### Estructura:
1. Header: logo "Joga Books" + tagline
2. Hero: titulo grande + descripcion + CTA
3. Tres beneficios en cards (iconos emoji)
4. Input de codigo de licencia + boton Entrar
5. Footer minimo

### Textos (bilingue — toggle ES/EN):

**ES:**
- Titulo hero: "Tu libro de no ficcion, en horas. No en anos."
- Subtitulo: "Elige tu nicho, la IA crea el outline, escribe cada capitulo y humaniza el texto. Tu pones tu experiencia. Joga Books hace el resto."
- Beneficio 1: "Outline completo en segundos"
- Beneficio 2: "Cada capitulo escrito por IA"
- Beneficio 3: "Humanizador integrado — suena a ti"
- Placeholder input: "Ingresa tu codigo de acceso"
- Boton: "Comenzar mi libro"

**EN:**
- Hero title: "Your nonfiction book, in hours. Not years."
- Subtitle: "Pick your niche, AI builds the outline, writes every chapter, and humanizes the text. You bring the expertise. Joga Books does the rest."
- Benefit 1: "Full outline in seconds"
- Benefit 2: "Every chapter written by AI"
- Benefit 3: "Built-in humanizer — sounds like you"
- Input placeholder: "Enter your access code"
- Button: "Start my book"

### Validacion de licencia:
- Llama a gate.js → window.jogaBooksGate.validate(codigo)
- Si valida: redirige a app.html
- Si falla: muestra error "Codigo invalido. Verifica e intenta de nuevo."
- Guarda estado en localStorage: jogaBooks_licensed = true

---

## PANTALLA 2 — APP.HTML (Dashboard)

### Estructura:
1. Header: logo + boton "Nuevo libro" + toggle idioma
2. Si no hay libros: estado vacio con CTA grande
3. Si hay libros: grid de cards por libro
4. Cada card muestra: titulo, nicho, progreso %, fecha, botones

### Card de libro:
```
┌─────────────────────────────┐
│ 📚 Productividad al 100%    │
│ Nicho: Productividad        │
│ Audiencia: Emprendedores    │
│ ████████░░  8/12 caps       │
│ Ultima edicion: hoy         │
│ [Continuar]  [Exportar]     │
└─────────────────────────────┘
```

### localStorage schema:
```js
// Lista de libros
jogaBooks_library = [
  {
    id: "book_1234567890",
    titulo: "El Emprendedor Enfocado",
    subtitulo: "...",
    nicho: "Productividad",
    audiencia: "Emprendedores",
    idioma: "es",
    progreso: 8,           // capitulos completados
    total: 12,
    fechaCreacion: "2026-08-25",
    fechaEdicion: "2026-08-25",
    outline: [...],        // array de 12 capitulos
    capitulos: {...}       // objeto: { "1": {original:"", humanizado:""} }
  }
]
```

---

## PANTALLA 3 — WIZARD.HTML (Crear libro — 5 pasos)

### Barra de progreso en el top:
```
Paso 1 ──●── Paso 2 ──○── Paso 3 ──○── Paso 4 ──○── Paso 5
Nicho       Audiencia    Titulo       Outline     Listo
```

---

### PASO 1 — Nicho

Titulo: "¿Sobre qué eres experto?" / "What are you an expert in?"

Grid de 20 nichos (4 columnas x 5 filas):
Cada nicho tiene emoji + nombre. Al hacer click se selecciona (borde dorado).

```
💰 Dinero          🏥 Salud           ⏰ Productividad    ❤️ Relaciones
💪 Fitness         🚀 Emprendimiento  📱 Marketing         👑 Liderazgo
🙏 Espiritualidad  👨‍👩‍👧 Familia         🥗 Nutricion        🧠 Desarrollo personal
🏠 Bienes raices   📈 Inversiones     🎯 Habitos           💼 Ventas
💭 Mindset         📲 Redes sociales  🎓 Coaching          📚 Educacion
```

Abajo del grid: input "Mi nicho es: ___" para nicho personalizado.

Boton: "Continuar →"

---

### PASO 2 — Audiencia

Titulo: "¿Para quién es tu libro?" / "Who is your book for?"

4 opciones grandes con descripcion:
```
┌──────────────────────┐  ┌──────────────────────┐
│ 👶 Principiantes     │  │ 🚀 Emprendedores      │
│ Personas que         │  │ Duenos de negocio     │
│ empiezan desde cero  │  │ y fundadores          │
└──────────────────────┘  └──────────────────────┘
┌──────────────────────┐  ┌──────────────────────┐
│ 💼 Profesionales     │  │ 🌍 Publico general    │
│ Expertos que quieren │  │ Cualquier persona     │
│ compartir su metodo  │  │ interesada            │
└──────────────────────┘  └──────────────────────┘
```

Boton: "← Atras" y "Continuar →"

---

### PASO 3 — Titulo (llamada a IA)

Titulo: "Generando opciones de titulo..." / "Generating title options..."

1. Al llegar a este paso: automaticamente llama al Worker
2. Muestra skeleton loader (3 segundos aprox)
3. Muestra 5 cards de titulo generadas por IA

Cada card:
```
┌─────────────────────────────────────┐
│ El Emprendedor Enfocado             │
│ Cómo recuperar tu tiempo y triplicar│
│ tu productividad en 30 días         │
│                          [Elegir]   │
└─────────────────────────────────────┘
```

Abajo: input "O escribe tu propio titulo" para edicion manual.

Boton: "← Atras" y "Continuar →" (habilitado solo si hay titulo seleccionado)

---

### PASO 4 — Outline (llamada a IA)

Titulo: "Generando tu libro..." / "Building your book..."

1. Llama al Worker con nicho + audiencia + titulo
2. Muestra skeleton loader
3. Muestra lista de 12 capitulos generados

Cada capitulo en la lista:
```
  1  │ Introduccion: El problema real        [✎ Editar]
  2  │ Por que la mayoria falla en...        [✎ Editar]
  3  │ El sistema de las 3 prioridades       [✎ Editar]
  ...
```

Usuario puede editar el nombre de cada capitulo inline.
Puede reordenar arrastrando (drag simple con JS).

Boton: "← Atras" y "Crear mi libro →"

---

### PASO 5 — Confirmacion

Titulo: "¡Tu libro está listo para escribirse!" / "Your book is ready to write!"

Resumen:
```
📚 El Emprendedor Enfocado
   Nicho: Productividad · Audiencia: Emprendedores
   12 capitulos · Idioma: Español

   [Ver outline completo ▼]

   [🚀 Empezar a escribir]
```

Guarda el libro en localStorage y redirige a editor.html

---

## PANTALLA 4 — EDITOR.HTML (Escritura + Humanizador)

### Layout:
```
┌─────────────────────────────────────────────────┐
│ ← Mis libros    El Emprendedor Enfocado    8/12  │
├──────────────┬──────────────────────────────────┤
│              │                                  │
│  CAPITULOS   │   EDITOR PRINCIPAL               │
│  ─────────   │   ─────────────────              │
│  ✅ Cap 1    │   Capitulo 3: El sistema de...   │
│  ✅ Cap 2    │                                  │
│  ▶ Cap 3     │   [Generar con IA] ← boton hero  │
│  ○  Cap 4    │                                  │
│  ○  Cap 5    │   textarea con el contenido      │
│  ...         │                                  │
│              │   ┌──────────────────────────┐   │
│              │   │ HUMANIZADOR              │   │
│              │   │ [Profesional] [Convers.] │   │
│              │   │ [Motivacional]           │   │
│              │   │ [✨ Humanizar texto]     │   │
│              │   └──────────────────────────┘   │
│              │                                  │
│              │   [← Cap anterior] [Cap siguiente →] │
└──────────────┴──────────────────────────────────┘
```

### Flujo del editor:

1. Usuario hace click en un capitulo de la lista izquierda
2. Ve el nombre del capitulo en el header del editor
3. Si ya tiene contenido: lo muestra en el textarea
4. Si no tiene contenido: muestra boton grande "Generar con IA"

5. Al presionar "Generar con IA":
   - Muestra loader con mensaje: "Escribiendo capitulo..."
   - Llama al Worker con: titulo libro, nombre capitulo, nicho, audiencia
   - Recibe el texto (800-1200 palabras)
   - Lo muestra en el textarea (version original)
   - Guarda en localStorage como version "original"

6. HUMANIZADOR — 3 botones de tono:
   - [Profesional]: formal pero natural, sin jerga corporativa
   - [Conversacional]: como hablar con un amigo
   - [Motivacional]: energico, directo, como coach

7. Al elegir tono y presionar "Humanizar":
   - Loader: "Humanizando..."
   - Llama al Worker con texto + tono seleccionado
   - Muestra resultado en un segundo panel (lado a lado o tabs)
   - Guarda como version "humanizada"

8. Toggle "Ver: [Original] / [Humanizado]"
   El usuario decide cual version guardar como final.

9. Boton "Guardar capitulo" → localStorage
   Barra de progreso del libro se actualiza

### Estados de capitulo en sidebar:
```
✅  verde  — capitulo generado y guardado
✨  dorado — capitulo humanizado
▶   blanco — capitulo en progreso (abierto ahora)
○   gris   — capitulo pendiente
```

---

## PANTALLA 5 — EXPORT.HTML

### Estructura:
1. Header del libro (titulo, subtitulo, autor)
2. Tabla de contenido con los 12 capitulos
3. Contenido completo scrolleable
4. Botones de accion

### Botones:
```
[📋 Copiar todo el texto]
[📄 Descargar como .txt]
[🔗 Compartir outline]    ← solo el outline, no el contenido
```

### Para el PDF futuro (V2):
Usar jsPDF desde CDN:
https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
NO implementar en MVP, dejar comentario en el codigo.

---

## GATE.JS — LICENCIAS

Mismo patron exacto que Joga Intelligence.
Nombre del objeto: window.jogaBooksGate

```js
window.jogaBooksGate = {
  async validate(code) {
    // SHA-256 del codigo ingresado
    // Compara contra lista de hashes validos
    // Retorna true/false
  }
}
```

Codigos de prueba para desarrollo:
- JOGABOOKS-TEST01
- JOGABOOKS-TEST02
(Agregar sus hashes a la lista durante desarrollo)

---

## WORKER.JS — CLOUDFLARE WORKER

### Variables de entorno necesarias:
```
ANTHROPIC_API_KEY  — secreto en Cloudflare
```

### Endpoints del Worker:

**POST /titulos**
```json
Input:  { "nicho": "Productividad", "audiencia": "Emprendedores", "idioma": "es" }
Output: { "titulos": ["Titulo 1: Subtitulo", "Titulo 2: Subtitulo", ...] }
```

**POST /outline**
```json
Input:  { "titulo": "...", "nicho": "...", "audiencia": "...", "idioma": "es" }
Output: { "capitulos": [{ "num": 1, "nombre": "...", "descripcion": "..." }, ...] }
```

**POST /capitulo**
```json
Input:  { "titulo_libro": "...", "nombre_capitulo": "...", "num": 3, "nicho": "...", "audiencia": "...", "idioma": "es" }
Output: { "contenido": "texto del capitulo 800-1200 palabras" }
```

**POST /humanizar**
```json
Input:  { "texto": "...", "tono": "conversacional", "idioma": "es" }
Output: { "contenido": "texto humanizado" }
```

### Prompts del Worker:

**TITULOS:**
```
Eres experto en marketing editorial de libros de no ficcion.
Genera exactamente 5 titulos para un libro sobre [NICHO]
dirigido a [AUDIENCIA] en idioma [IDIOMA].
Formato de cada titulo: "Titulo Principal: Subtitulo especifico"
El titulo debe ser memorable, con promesa clara, especifico.
Cada opcion diferente en angulo y tono.
Responde SOLO con un JSON array de 5 strings.
```

**OUTLINE:**
```
Genera un indice profesional de exactamente 12 capitulos
para el libro "[TITULO]" sobre [NICHO] dirigido a [AUDIENCIA].
Idioma: [IDIOMA].
Progresion logica: del problema a la solucion, de basico a avanzado.
Cada capitulo: nombre corto (max 6 palabras) + descripcion 1 oracion.
Responde SOLO con JSON array: [{"num":1,"nombre":"...","descripcion":"..."}]
```

**CAPITULO:**
```
Escribe el capitulo [NUM]: "[NOMBRE_CAPITULO]"
del libro "[TITULO_LIBRO]" sobre [NICHO].
Audiencia: [AUDIENCIA]. Idioma: [IDIOMA].
Estilo: directo, practico, con ejemplos reales y especificos.
Longitud: 900-1200 palabras exactas.
Estructura: parrafo de apertura gancho + desarrollo + cierre con takeaway.
Sin frases corporativas. Sin relleno. Sin titulos internos con #.
Solo texto corrido listo para leer.
```

**HUMANIZAR:**
```
Reescribe el siguiente texto para que suene como una persona
real hablando directamente con el lector.

Tono requerido:
- conversacional: como hablar con un amigo inteligente, frases cortas, humor ligero ocasional
- profesional: claro y directo, sin jerga corporativa, sin "es importante destacar"
- motivacional: energico, imperativo, como un coach que cree en ti

Tono seleccionado: [TONO]
Idioma: [IDIOMA]

Reglas:
- Mantener EXACTAMENTE las mismas ideas y ejemplos
- No agregar ni quitar informacion
- Eliminar frases como: "en el ambito de", "cabe destacar", "es importante mencionar"
- Variar el ritmo: mezcla frases cortas y largas
- Maximo 2 lineas por parrafo

Texto a humanizar:
[TEXTO]

Responde SOLO con el texto humanizado, sin explicaciones.
```

---

## SERVICE WORKER — SW.JS

Nombre del cache: joga-books-v1

Archivos a cachear:
```js
const CACHE_FILES = [
  './',
  './index.html',
  './app.html',
  './wizard.html',
  './editor.html',
  './export.html',
  './gate.js',
  './assets/manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png'
]
```

Estrategia: Cache First para assets, Network First para Worker calls.
Cada cambio de archivos = subir version: joga-books-v2, v3, etc.

---

## MANIFEST.JSON

```json
{
  "name": "Joga Books",
  "short_name": "JogaBooks",
  "description": "Crea tu libro de no ficcion con IA",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#0C0A00",
  "theme_color": "#E8A020",
  "orientation": "portrait",
  "icons": [
    { "src": "assets/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## I18N — SISTEMA BILINGUE

Mismo patron que Joga Intelligence.
Toggle ES/EN en el header de cada pantalla.
localStorage key: jogaBooks_lang = "es" | "en"

Cada archivo HTML tiene:
```js
const i18n = {
  es: { ... },
  en: { ... }
}

function toggleLang() {
  const current = localStorage.getItem('jogaBooks_lang') || 'es'
  const next = current === 'es' ? 'en' : 'es'
  localStorage.setItem('jogaBooks_lang', next)
  applyLang(next)
}

function applyLang(lang) {
  // actualiza todos los textos del DOM
}
```

---

## AGENTS.MD — REGLAS PARA FUTUROS AGENTES

Crear este archivo en la raiz con las mismas 4 reglas de oro:
1. gate.js — nunca abrir el gate ni exponer codigos
2. Service Worker — siempre subir version al cambiar archivos
3. i18n — el toggle ES/EN debe funcionar siempre
4. Branding — colores y estilo no se alteran sin permiso

---

## ORDEN DE CONSTRUCCION — MVP

Construir en este orden exacto. No saltar pasos.

```
1. gate.js                    base de licencias
2. index.html                 landing + validacion de codigo
3. app.html                   dashboard vacio (sin libros aun)
4. wizard.html paso 1-2       nicho + audiencia (sin IA todavia)
5. wizard.html paso 3         titulos con llamada al Worker
6. wizard.html paso 4-5       outline + confirmacion
7. editor.html                generar capitulos
8. editor.html humanizador    los 3 tonos
9. export.html                ver y copiar libro completo
10. sw.js + manifest.json     PWA offline
11. AGENTS.md                 documentacion
```

---

## LO QUE NO VA EN EL MVP (para V2)

- Exportar a PDF (jsPDF — dejar comentario en export.html)
- Portada del libro con imagen generada
- Multiple usuarios / cuentas
- Compartir libro con link publico
- Editor de portada
- Publicar en Amazon KDP (guia paso a paso)

---

## DIFERENCIADORES CLAVE A MANTENER

1. HUMANIZADOR con 3 tonos — unico en el mercado
2. Bilingue ES+EN nativo desde el dia 1
3. Funciona offline como PWA
4. Sin creditos, sin limites, pago unico
5. Simple: 5 pasos, no 50 configuraciones
6. Guarda multiples libros en localStorage
7. Cada capitulo guarda version original Y humanizada

---

## NOTAS FINALES PARA CLAUDE CODE

- No usar fetch directamente al API de Anthropic desde el frontend
  (expone la API key). SIEMPRE via el Cloudflare Worker.
- El Worker URL se guarda como constante en cada archivo HTML:
  const WORKER_URL = 'https://joga-books.TU-SUBDOMINIO.workers.dev'
- Todos los errores del Worker deben mostrarse al usuario en un toast
  no en console.log.
- Mobile first — todo el diseno pensado para pantalla de telefono.
- No usar librerias externas salvo jsPDF en V2 (mencionado arriba).
- Commits bilingues: "feat: wizard paso 1 nicho / wizard step 1 niche"

---

*Brief generado por Martin para Joga Intelligence*
*Proyecto: joga-books | GitHub: joga4live/joga-books*
*Agosto 2026*
