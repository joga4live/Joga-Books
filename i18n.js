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
    var btn = document.getElementById("langToggle");
    if (btn) btn.textContent = lang === "es" ? "EN" : "ES";
    document.dispatchEvent(new CustomEvent("jogaLangChange", { detail: { lang: lang, table: table } }));
  }

  function toggle() {
    var next = currentLang() === "es" ? "en" : "es";
    try { localStorage.setItem("jogaBooks_lang", next); } catch (e) {}
    apply(next);
  }

  var btn = document.getElementById("langToggle");
  if (btn) btn.addEventListener("click", toggle);
  apply(currentLang());

  return { apply: apply, toggle: toggle, lang: currentLang, table: function () { return dict[currentLang()] || dict.es; } };
}
