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
  {emoji:"💰",es:"Dinero",en:"Money"},{emoji:"🏥",es:"Salud",en:"Health"},
  {emoji:"⏰",es:"Productividad",en:"Productivity"},{emoji:"❤️",es:"Relaciones",en:"Relationships"},
  {emoji:"💪",es:"Fitness",en:"Fitness"},{emoji:"🚀",es:"Emprendimiento",en:"Entrepreneurship"},
  {emoji:"📱",es:"Marketing",en:"Marketing"},{emoji:"👑",es:"Liderazgo",en:"Leadership"},
  {emoji:"🙏",es:"Espiritualidad",en:"Spirituality"},{emoji:"👨‍👩‍👧",es:"Familia",en:"Family"},
  {emoji:"🥗",es:"Nutrición",en:"Nutrition"},{emoji:"🧠",es:"Desarrollo personal",en:"Personal development"},
  {emoji:"🏠",es:"Bienes raíces",en:"Real estate"},{emoji:"📈",es:"Inversiones",en:"Investing"},
  {emoji:"🎯",es:"Hábitos",en:"Habits"},{emoji:"💼",es:"Ventas",en:"Sales"},
  {emoji:"💭",es:"Mindset",en:"Mindset"},{emoji:"📲",es:"Redes sociales",en:"Social media"},
  {emoji:"🎓",es:"Coaching",en:"Coaching"},{emoji:"📚",es:"Educación",en:"Education"}
];
var AUDIENCES = [
  {emoji:"👶",es:["Principiantes","Personas que empiezan desde cero"],en:["Beginners","People starting from scratch"]},
  {emoji:"🚀",es:["Emprendedores","Dueños de negocio y fundadores"],en:["Entrepreneurs","Business owners and founders"]},
  {emoji:"💼",es:["Profesionales","Expertos que quieren compartir su método"],en:["Professionals","Experts who want to share their method"]},
  {emoji:"🌍",es:["Público general","Cualquier persona interesada"],en:["General public","Anyone interested"]}
];
var WIZARD_I18N = {
  es: { title:"Joga Books — Nuevo libro", steps:["Nicho","Audiencia","Título","Outline","Listo"],
    s1:{ title:"¿Sobre qué eres experto?", own:"Mi nicho es:", ownPh:"Escribe tu nicho...", next:"Continuar →" },
    s2:{ title:"¿Para quién es tu libro?", back:"← Atrás", next:"Continuar →" },
    s3:{ title:"Generando opciones de título...", doneTitle:"Elige tu título", errTitle:"No se pudo generar", pick:"Elegir",
      own:"O escribe tu propio título", ownPh:"Escribe tu propio título", back:"← Atrás", next:"Continuar →",
      err:"No se pudo generar títulos. Intenta de nuevo.", retry:"Reintentar" },
    s4:{ title:"Generando tu libro...", doneTitle:"Revisa tu outline", errTitle:"No se pudo generar", back:"← Atrás", next:"Crear mi libro →",
      err:"No se pudo generar el outline. Intenta de nuevo.", retry:"Reintentar" },
    s5:{ title:"¡Tu libro está listo para escribirse!", chaps:"capítulos", langLabel:"Idioma:",
      toggle:"Ver outline completo ▼", start:"🚀 Empezar a escribir" },
    limiteDiario:"Llegaste a tu límite de hoy. Vuelve mañana.",
    limiteMensual:"El servicio alcanzó su límite del mes. Vuelve el día 1." },
  en: { title:"Joga Books — New Book", steps:["Niche","Audience","Title","Outline","Done"],
    s1:{ title:"What are you an expert in?", own:"My niche is:", ownPh:"Type your niche...", next:"Continue →" },
    s2:{ title:"Who is your book for?", back:"← Back", next:"Continue →" },
    s3:{ title:"Generating title options...", doneTitle:"Choose your title", errTitle:"Could not generate", pick:"Choose",
      own:"Or write your own title", ownPh:"Write your own title", back:"← Back", next:"Continue →",
      err:"Could not generate titles. Try again.", retry:"Retry" },
    s4:{ title:"Building your book...", doneTitle:"Review your outline", errTitle:"Could not generate", back:"← Back", next:"Create my book →",
      err:"Could not generate the outline. Try again.", retry:"Retry" },
    s5:{ title:"Your book is ready to write!", chaps:"chapters", langLabel:"Language:",
      toggle:"See full outline ▼", start:"🚀 Start writing" },
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
