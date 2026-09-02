/* assets/wizard-data.js — Joga Books
   Datos estaticos de wizard.html (20 nichos, 4 audiencias, diccionario i18n
   de los 5 pasos). Separado del HTML solo para que wizard.html se mantenga
   cerca del limite de 200 lineas de AGENTS.md — es un modulo privado del
   wizard, no compartido con otras pantallas.
   Static data for wizard.html (20 niches, 4 audiences, the 5-step i18n
   dictionary). Split out of the HTML only so wizard.html stays closer to
   AGENTS.md's 200-line cap — a private module for the wizard, not shared
   with other screens. Ver decision documentada en implementacion-mvp-25ago.md
   / See documented decision in the implementation handoff. */
"use strict";
var NICHES = [
  {es:"Dinero",en:"Money"},{es:"Salud",en:"Health"},
  {es:"Productividad",en:"Productivity"},{es:"Relaciones",en:"Relationships"},
  {es:"Fitness",en:"Fitness"},{es:"Emprendimiento",en:"Entrepreneurship"},
  {es:"Marketing",en:"Marketing"},{es:"Liderazgo",en:"Leadership"},
  {es:"Espiritualidad",en:"Spirituality"},{es:"Familia",en:"Family"},
  {es:"Nutrición",en:"Nutrition"},{es:"Desarrollo personal",en:"Personal development"},
  {es:"Bienes raíces",en:"Real estate"},{es:"Inversiones",en:"Investing"},
  {es:"Hábitos",en:"Habits"},{es:"Ventas",en:"Sales"},
  {es:"Mindset",en:"Mindset"},{es:"Redes sociales",en:"Social media"},
  {es:"Coaching",en:"Coaching"},{es:"Educación",en:"Education"}
];
var AUDIENCES = [
  {es:["Principiantes","Personas que empiezan desde cero"],en:["Beginners","People starting from scratch"]},
  {es:["Emprendedores","Dueños de negocio y fundadores"],en:["Entrepreneurs","Business owners and founders"]},
  {es:["Profesionales","Expertos que quieren compartir su método"],en:["Professionals","Experts who want to share their method"]},
  {es:["Público general","Cualquier persona interesada"],en:["General public","Anyone interested"]}
];
// v23 (plan-mvp-25ago-v23.md): 3 tamanos de libro que Jose aprobo (capitulo real
// medido en ~4 paginas). "id" es el identificador interno que viaja al Worker
// como num_capitulos (validado ahi contra esta misma lista, ver worker.js);
// "capitulos"/"paginas" son los numeros que se muestran en el paso de outline.
// v23: 3 book sizes José approved (a real chapter measured at ~4 pages). "id"
// is the internal identifier sent to the Worker as num_capitulos (validated
// there against this same list, see worker.js); "capitulos"/"paginas" are the
// numbers shown in the outline step.
var SIZES = [
  {id:"corto",capitulos:12,paginas:50},
  {id:"mediano",capitulos:20,paginas:80},
  {id:"largo",capitulos:29,paginas:120}
];
var WIZARD_I18N = {
  es: { title:"Joga Books — Nuevo libro", steps:["Nicho","Audiencia","Título","Outline","Listo"],
    s1:{ title:"¿Sobre qué eres experto?", own:"Mi nicho es:", ownPh:"Escribe tu nicho...", next:"Continuar →" },
    s2:{ title:"¿Para quién es tu libro?", back:"← Atrás", next:"Continuar →" },
    s3:{ title:"Generando opciones de título...", doneTitle:"Elige tu título", errTitle:"No se pudo generar", pick:"Elegir",
      own:"O escribe tu propio título", ownPh:"Escribe tu propio título", back:"← Atrás", next:"Continuar →",
      err:"No se pudo generar títulos. Intenta de nuevo.", retry:"Reintentar" },
    s4:{ title:"Generando tu libro...", doneTitle:"Revisa tu outline", errTitle:"No se pudo generar", back:"← Atrás", next:"Crear mi libro →",
      err:"No se pudo generar el outline. Intenta de nuevo.", retry:"Reintentar",
      sizeTitle:"¿De qué tamaño será tu libro?", pages:"páginas", sizeNext:"Continuar →" }, // v23: paso de tamano, dentro del paso 4 (ver wizard.html) / v23: size step, folded into step 4 (see wizard.html)
    s5:{ title:"¡Tu libro está listo para escribirse!", chaps:"capítulos", langLabel:"Idioma:",
      toggle:"Ver outline completo ▼", start:"Empezar a escribir" },
    sizes:{ corto:"Corto", mediano:"Mediano", largo:"Largo" }, // v23
    capituloLargo:"El capítulo salió más largo de lo que cabe y se cortó. Vuelve a intentarlo.", respuestaVacia:"La IA devolvió una respuesta vacía. Intenta de nuevo.", iaSaturada:"El servicio de IA está saturado ahora mismo. Espera un momento e intenta de nuevo.", 
    tiempoAgotado:"Tardó demasiado y se cortó. Vuelve a intentarlo.", sinConexion:"Se perdió la conexión con el servicio. Revisa tu internet e intenta de nuevo.", respuestaIncompleta:"La respuesta llegó incompleta. Intenta de nuevo.", 
    limiteDiario:"Llegaste a tu límite de hoy. Vuelve mañana.",
    limiteMensual:"El servicio alcanzó su límite del mes. Vuelve el día 1." },
  en: { title:"Joga Books — New Book", steps:["Niche","Audience","Title","Outline","Done"],
    s1:{ title:"What are you an expert in?", own:"My niche is:", ownPh:"Type your niche...", next:"Continue →" },
    s2:{ title:"Who is your book for?", back:"← Back", next:"Continue →" },
    s3:{ title:"Generating title options...", doneTitle:"Choose your title", errTitle:"Could not generate", pick:"Choose",
      own:"Or write your own title", ownPh:"Write your own title", back:"← Back", next:"Continue →",
      err:"Could not generate titles. Try again.", retry:"Retry" },
    s4:{ title:"Building your book...", doneTitle:"Review your outline", errTitle:"Could not generate", back:"← Back", next:"Create my book →",
      err:"Could not generate the outline. Try again.", retry:"Retry",
      sizeTitle:"How big should your book be?", pages:"pages", sizeNext:"Continue →" }, // v23
    s5:{ title:"Your book is ready to write!", chaps:"chapters", langLabel:"Language:",
      toggle:"See full outline ▼", start:"Start writing" },
    sizes:{ corto:"Short", mediano:"Medium", largo:"Long" }, // v23
    capituloLargo:"The chapter came out longer than fits and was cut off. Try again.", respuestaVacia:"The AI returned an empty response. Try again.", iaSaturada:"The AI service is overloaded right now. Wait a moment and try again.", 
    tiempoAgotado:"It took too long and was cut off. Try again.", sinConexion:"Lost connection to the service. Check your internet and try again.", respuestaIncompleta:"The response arrived incomplete. Try again.", 
    limiteDiario:"You've reached today's limit. Come back tomorrow.",
    limiteMensual:"The service reached its monthly limit. Come back on the 1st." }
};
// v2 (m9): el resumen del paso 5 antes mostraba un string fijo del idioma de
// la UI ("Idioma: Español"); ahora se arma con W.idioma (el idioma real que
// se congela y se guarda) + esta tabla, para que nunca mienta si el usuario
// cambia el toggle entre el paso 1 y el 5. / v2 (m9): the step-5 summary used
// to show a fixed UI-language string ("Idioma: Español"); now it's built from
// W.idioma (the real, frozen, saved language) + this table, so it never lies
// if the user flips the toggle between step 1 and step 5.
var LANG_NAMES = { es: { es: "Español", en: "Spanish" }, en: { es: "Inglés", en: "English" } };
