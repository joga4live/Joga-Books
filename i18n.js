/* assets/i18n.js — Joga Books
   Motor generico de traduccion, compartido por las 5 pantallas. Cada HTML
   define su propio diccionario const i18n = { es:{...}, en:{...} } (con los
   textos EXACTOS del brief) y llama a jogaI18n(i18n) una vez cargado el DOM.
   Este archivo solo mueve texto -> DOM via atributos data-i18n, no conoce los
   textos en si. Key en localStorage: jogaBooks_lang.
   Generic translation engine shared by all 5 screens. Each HTML defines its
   own dictionary and calls jogaI18n(dict) once the DOM is ready. This file
   only moves text -> DOM via data-i18n attributes; it doesn't know the copy.
   localStorage key: jogaBooks_lang. */
function jogaI18n(dict) {
  "use strict";

  function currentLang() {
    try { return localStorage.getItem("jogaBooks_lang") || "es"; }
    catch (e) { return "es"; }
  }

  function lookup(obj, path) {
    return path.split(".").reduce(function (o, k) { return o && o[k] !== undefined ? o[k] : null; }, obj);
  }

  function apply(lang) {
    var table = dict[lang] || dict.es;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var val = lookup(table, el.getAttribute("data-i18n"));
      if (val != null) el.textContent = val;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var val = lookup(table, el.getAttribute("data-i18n-placeholder"));
      if (val != null) el.placeholder = val;
    });
    document.documentElement.lang = lang;
    if (table.title) document.title = table.title; // v2: pestana traducida / v2: translated tab title
    // v14: dos controles (ES/EN) en vez de un boton que alterna — el botón
    // decía el idioma al que cambiarias, no en el que estabas (confuso).
    // Ahora los dos se ven siempre, el activo se marca con .active +
    // aria-pressed. / v14: two controls (ES/EN) instead of one toggling
    // button — the button used to show the language you'd switch TO, not
    // the one you were in (confusing). Now both are always visible, the
    // active one marked with .active + aria-pressed.
    var langEs = document.getElementById("langEs"), langEn = document.getElementById("langEn");
    if (langEs && langEn) {
      langEs.classList.toggle("active", lang === "es");
      langEs.setAttribute("aria-pressed", lang === "es" ? "true" : "false");
      langEn.classList.toggle("active", lang === "en");
      langEn.setAttribute("aria-pressed", lang === "en" ? "true" : "false");
    }
    document.dispatchEvent(new CustomEvent("jogaLangChange", { detail: { lang: lang, table: table } }));
  }

  function setLang(lang) {
    if (lang !== "es" && lang !== "en") return;
    try { localStorage.setItem("jogaBooks_lang", lang); } catch (e) {}
    apply(lang);
  }

  var langEs = document.getElementById("langEs"), langEn = document.getElementById("langEn");
  if (langEs) langEs.addEventListener("click", function () { setLang("es"); });
  if (langEn) langEn.addEventListener("click", function () { setLang("en"); });
  apply(currentLang());

  return { apply: apply, toggle: setLang, lang: currentLang, table: function () { return dict[currentLang()] || dict.es; } };
}
