/* gate.js — Joga Books
   Validacion de licencia: SHA-256 local del codigo ingresado contra una lista
   de hashes validos. Offline, sin fetch, sin dependencias. NUNCA codigos en
   claro en este archivo — viven solo en .joga/handoff/implementacion-mvp-25ago.md
   para pruebas de desarrollo.
   License validation: local SHA-256 of the entered code against a list of
   valid hashes. Offline, no fetch, no dependencies. NEVER plaintext codes in
   this file — they live only in the implementation handoff for dev testing.

   Patron de referencia (solo forma, no contenido) / reference pattern (shape
   only, not content): gate.js de joga-intelligence-repo (repo hermano).

   Uso / usage: const ok = await window.jogaBooksGate.validate(code) -> true/false
*/
(function () {
  "use strict";

  // Hashes SHA-256 (hex, minusculas) de codigos validos. Normalizacion antes
  // de hashear: trim + uppercase. Agregar hashes nuevos aqui, nunca el texto
  // plano. / SHA-256 (hex, lowercase) hashes of valid codes. Normalization
  // before hashing: trim + uppercase. Add new hashes here, never plaintext.
  var HASHES = [
    "66ae3272c243d9b1189c7009f4ad60108794b4f4cff08c565aad5bf8e4244e49",
    "a571a3fc5ea93de4772cef50f030aa96fd9cc9d2d08acc9122d10e7f04ae53c4"
  ];

  function bufToHex(buf) { // bytes -> hex / bytes -> hex
    var bytes = new Uint8Array(buf), hex = "";
    for (var i = 0; i < bytes.length; i++) {
      var h = bytes[i].toString(16);
      hex += h.length === 1 ? "0" + h : h;
    }
    return hex;
  }

  async function sha256Hex(str) {
    var data = new TextEncoder().encode(str);
    var digest = await crypto.subtle.digest("SHA-256", data);
    return bufToHex(digest);
  }

  // Valida el codigo. Nunca lanza error, nunca abre el gate por defecto.
  // Validates the code. Never throws, never opens the gate by default.
  async function validate(code) {
    try {
      if (!(window.crypto && window.crypto.subtle && window.crypto.subtle.digest)) {
        return false;
      }
      var v = (code == null ? "" : String(code)).trim().toUpperCase();
      if (!v) return false;
      var hash = await sha256Hex(v);
      for (var i = 0; i < HASHES.length; i++) {
        if (HASHES[i] === hash) return true;
      }
      return false;
    } catch (e) {
      return false; // cualquier fallo = acceso negado, nunca abierto / any failure = access denied, never open
    }
  }

  window.jogaBooksGate = { validate: validate };
})();
