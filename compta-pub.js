/* Publication des synthèses comptables vers le serveur (comptabilité du groupe protégée côté serveur).
   Les applications calculent leurs synthèses (comptabilité, états, trésorerie, paie, tiers, régularisations, inter-divisions) et les rangent dans le navigateur ;
   ce module les envoie au serveur quand elles changent, avec la clé de synchronisation (écriture seulement : elle ne permet pas de lire la comptabilité du groupe).
   Rien n'est envoyé sans serveur configuré ni en démonstration locale. */
(function (G) {
  "use strict";
  var FAM = ["compta", "etats", "prev", "rh", "tiers", "regul", "inter"], DIVS = ["distribution", "transport", "agro"], HK = "angels_comptapub_h";
  function lire(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function conf() {
    if (lire("angels_demo_local")) return null;
    var u = lire("angels_supabase"), s = lire("angels_sync"), def = G.ANGELS_PASSERELLE || {}, url = (u && u.off) ? "" : (u && u.url) || def.url || "";
    if (!s || !s.actif || !s.cle || !/^https:\/\//.test(url)) return null;
    return { fn: String(url).replace(/\/+$/, "") + "/functions/v1/compta-groupe", cle: s.cle };
  }
  function h(s) { var x = 5381, i = s.length; while (i) x = (x * 33) ^ s.charCodeAt(--i); return (x >>> 0).toString(36) + ":" + s.length; }
  var enCours = false;
  function cles() { var L = ["angels_inter"]; FAM.forEach(function (f) { DIVS.forEach(function (d) { L.push("angels_" + f + "_" + d); }); }); return L; }
  function pousser() {
    var c = conf(); if (!c || enCours) return Promise.resolve(0);
    var H = lire(HK) || {}, items = [];
    cles().forEach(function (k) { var raw = null; try { raw = localStorage.getItem(k); } catch (e) { } if (!raw) return; var x = h(raw); if (H[k] !== x) { var d = null; try { d = JSON.parse(raw); } catch (e) { } if (d && typeof d === "object") items.push({ cle: k, data: d, _h: x }); } });
    if (!items.length) return Promise.resolve(0);
    enCours = true;
    return fetch(c.fn, { method: "POST", headers: { "content-type": "application/json", "x-sync-key": c.cle }, body: JSON.stringify({ action: "publier", items: items.map(function (i) { return { cle: i.cle, data: i.data }; }) }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok) { items.forEach(function (i) { H[i.cle] = i._h; }); try { localStorage.setItem(HK, JSON.stringify(H)); } catch (e) { } } return j && j.ok ? items.length : 0; })
      .catch(function () { return 0; }).then(function (n) { enCours = false; return n; });
  }
  function demarrer() { setTimeout(pousser, 5000); setInterval(function () { if (!document.hidden) pousser(); }, 60000); document.addEventListener("visibilitychange", function () { if (!document.hidden) setTimeout(pousser, 1500); }); }
  G.ANGELS_COMPTA_PUB = { pousser: pousser, conf: conf, demarrer: demarrer };
  if (G.document && !/compta-groupe|parametres/.test(location.pathname)) demarrer();
})(typeof window !== "undefined" ? window : this);
