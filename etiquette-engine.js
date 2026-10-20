/* ANGEL'S GROUP — moteur commun d'impression d'étiquettes à QR code pour imprimante thermique d'étiquettes (Xprinter XP-365B : 203 dpi, papier de 20 à 82 mm, USB).
   Impression par la boîte d'impression du navigateur avec le pilote de l'imprimante : la taille de l'étiquette est portée par la règle CSS @page, une étiquette par page.
   Aucune donnée n'est enregistrée sur le serveur ; seuls les réglages de l'étiquette (taille, copies) sont mémorisés sur le poste.

   ANGELS_ETIQ.ouvrir({ titre, items:[{ qr, titre, l1, l2, l3, code }], apres:fn })   ouvre l'aperçu et l'impression
   ANGELS_ETIQ.html(items, { w, h, copies, cadre })                                  document HTML complet (testable)
   Contenu d'un QR code : « AGE1<type>|<identifiant> » — P produit, M moto, L livreur, V véhicule, T lot ; les QR de colis gardent leur format propre (AGE1|commande|n/N|code). */
(function (G) {
  "use strict";
  var KEY = "angels_etiq", W_MIN = 20, W_MAX = 82, H_MIN = 15, H_MAX = 200, COPIES_MAX = 50;
  var PRE = [["50x30", "50 × 30 mm (par défaut)", 50, 30], ["40x30", "40 × 30 mm", 40, 30], ["60x40", "60 × 40 mm", 60, 40], ["80x50", "80 × 50 mm", 80, 50], ["perso", "Autre taille…", 0, 0]];
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var cut = function (s, n) { s = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

  /* ---------- Réglages du poste ---------- */
  function cfg() {
    var c = {}; try { c = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { c = {}; }
    var t = PRE.some(function (p) { return p[0] === c.t; }) ? c.t : "50x30", p = PRE.filter(function (x) { return x[0] === t; })[0];
    return { t: t, w: clamp(Math.round(+(t === "perso" ? c.w : p[2]) || 50), W_MIN, W_MAX), h: clamp(Math.round(+(t === "perso" ? c.h : p[3]) || 30), H_MIN, H_MAX), copies: clamp(Math.round(+c.copies || 1), 1, COPIES_MAX) };
  }
  function enregistrer(c) { try { localStorage.setItem(KEY, JSON.stringify({ t: c.t, w: c.w, h: c.h, copies: c.copies })); } catch (e) { } }

  /* ---------- QR code ---------- */
  function qrSvg(txt) {
    if (typeof G.qrcode !== "function") return "";
    var q = G.qrcode(0, "M"); q.addData(String(txt)); q.make();
    return q.createSvgTag({ scalable: true, margin: 0 }).replace("<svg ", '<svg shape-rendering="crispEdges" ');
  }

  /* ---------- Étiquette ---------- */
  function etiquette(it, w, h) {
    var k = clamp(Math.min(w / 50, h / 30), 0.8, 2.2), horiz = w / h >= 1.15, pad = 1.2;
    var qs = horiz ? Math.min(h - 2 * pad, w * 0.52) : Math.min(w - 2 * pad, h * 0.6);
    var qr = it.qr ? '<div class="q" style="width:' + qs.toFixed(1) + "mm;height:" + qs.toFixed(1) + 'mm">' + qrSvg(it.qr) + "</div>" : "";
    var t = it.titre ? '<div class="t" style="font-size:' + (9.5 * k).toFixed(1) + 'pt">' + esc(cut(it.titre, 22)) + "</div>" : "";
    var l = [it.l1, it.l2, it.l3].filter(Boolean).map(function (x, i) { return '<div class="l' + (i ? " s" : "") + '" style="font-size:' + ((i ? 6.5 : 7.5) * k).toFixed(1) + 'pt">' + esc(cut(x, 40)) + "</div>"; }).join("");
    var c = it.code ? '<div class="c" style="font-size:' + (8.5 * k).toFixed(1) + 'pt">' + esc(cut(it.code, 14)) + "</div>" : "";
    return '<div class="et ' + (horiz ? "h" : "v") + '" style="width:' + w + "mm;height:" + h + "mm;padding:" + pad + 'mm">' + qr + '<div class="tx">' + t + l + c + "</div></div>";
  }
  function html(items, o) {
    o = o || {}; var w = clamp(Math.round(+o.w || 50), W_MIN, W_MAX), h = clamp(Math.round(+o.h || 30), H_MIN, H_MAX), n = clamp(Math.round(+o.copies || 1), 1, COPIES_MAX), L = [];
    (items || []).slice(0, 500).forEach(function (it) { for (var i = 0; i < n; i++) L.push(etiquette(it, w, h)); });
    return "<!doctype html><html><head><meta charset=\"utf-8\"><title>Étiquettes</title><style>@page{size:" + w + "mm " + h + "mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#e8e8e8}" +
      ".et{background:#fff;overflow:hidden;display:flex;gap:1.2mm;page-break-after:always;break-after:page;margin:0 auto 3mm;" + (o.cadre === false ? "" : "outline:1px dashed #999;") + "}.et.v{flex-direction:column;align-items:center;text-align:center}.et.h{flex-direction:row;align-items:center}" +
      ".q{flex:none;background:#fff}.q svg{width:100%;height:100%;display:block}.tx{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:.3mm;overflow:hidden}.et.v .tx{align-items:center;width:100%}" +
      ".t{font-weight:800;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.l{line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.l.s{color:#222}.c{font-family:'Courier New',monospace;font-weight:700;letter-spacing:.4mm;white-space:nowrap}" +
      "@media print{body{background:#fff}.et{margin:0;outline:0}.et:last-child{page-break-after:auto;break-after:auto}}</style></head><body>" + L.join("") + "</body></html>";
  }

  /* ---------- Aperçu et impression ---------- */
  function ouvrir(o) {
    o = o || {}; var items = Array.isArray(o.items) ? o.items.filter(function (x) { return x && (x.qr || x.titre); }) : [];
    if (!items.length) { alert("Aucune étiquette à imprimer."); return null; }
    var c = cfg(), ov = document.getElementById("et-ov"); if (ov) ov.remove();
    ov = document.createElement("div"); ov.id = "et-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Impression d'étiquettes");
    ov.setAttribute("style", "position:fixed;inset:0;background:rgba(15,20,28,.65);z-index:9995;display:flex;align-items:center;justify-content:center;padding:10px");
    var fld = "font:inherit;padding:7px;border:1px solid #c9d1db;border-radius:8px;background:#fff;color:#1c2430";
    ov.innerHTML = '<div style="background:#fff;color:#1c2430;border-radius:14px;width:100%;max-width:640px;max-height:94vh;overflow:auto;padding:16px;font:14px system-ui,Arial,sans-serif">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="font-size:16px">' + esc(o.titre || "Étiquettes") + '</b><button type="button" data-et="x" aria-label="Fermer" style="border:0;background:none;font-size:22px;cursor:pointer;line-height:1">×</button></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin:10px 0"><label style="font-size:12px;color:#5b6572">Taille<br><select id="et-t" style="' + fld + '">' + PRE.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === c.t ? " selected" : "") + ">" + p[1] + "</option>"; }).join("") + "</select></label>" +
      '<span id="et-p" style="display:' + (c.t === "perso" ? "flex" : "none") + ';gap:6px;align-items:flex-end"><label style="font-size:12px;color:#5b6572">Largeur (mm)<br><input id="et-w" type="number" min="' + W_MIN + '" max="' + W_MAX + '" value="' + c.w + '" style="width:80px;' + fld + '"></label><label style="font-size:12px;color:#5b6572">Hauteur (mm)<br><input id="et-h" type="number" min="' + H_MIN + '" max="' + H_MAX + '" value="' + c.h + '" style="width:80px;' + fld + '"></label></span>' +
      '<label style="font-size:12px;color:#5b6572">Copies par étiquette<br><input id="et-c" type="number" min="1" max="' + COPIES_MAX + '" value="' + c.copies + '" style="width:80px;' + fld + '"></label><span id="et-n" style="font-size:13px;color:#5b6572"></span></div>' +
      '<iframe id="et-f" title="Aperçu des étiquettes" style="width:100%;height:300px;border:1px solid #c9d1db;border-radius:8px;background:#e8e8e8"></iframe>' +
      '<p style="font-size:12px;color:#5b6572;margin:8px 0">Dans la boîte d\'impression : choisissez l\'imprimante <b>Xprinter XP-365B</b>, marges <b>Aucune</b>, échelle <b>100 %</b>. L\'étiquette est dimensionnée par la taille ci-dessus.</p>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" data-et="x" style="font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #c9d1db;background:#fff;cursor:pointer">Fermer</button><button type="button" data-et="p" style="font:inherit;padding:8px 14px;border-radius:8px;border:0;background:#1f3a5f;color:#fff;cursor:pointer;font-weight:700">🖨 Imprimer</button></div></div>';
    document.body.appendChild(ov);
    var q = function (id) { return ov.querySelector("#" + id); };
    function lire() {
      var t = q("et-t").value, p = PRE.filter(function (x) { return x[0] === t; })[0], w = t === "perso" ? +q("et-w").value : p[2], h = t === "perso" ? +q("et-h").value : p[3];
      return { t: t, w: clamp(Math.round(w || 50), W_MIN, W_MAX), h: clamp(Math.round(h || 30), H_MIN, H_MAX), copies: clamp(Math.round(+q("et-c").value || 1), 1, COPIES_MAX) };
    }
    function maj() { var r = lire(); q("et-p").style.display = r.t === "perso" ? "flex" : "none"; q("et-f").srcdoc = html(items, r); q("et-n").textContent = items.length * r.copies + " étiquette(s) de " + r.w + " × " + r.h + " mm"; return r; }
    ["et-t", "et-w", "et-h", "et-c"].forEach(function (id) { var e = q(id); if (e) e.onchange = e.oninput = maj; });
    ov.addEventListener("click", function (e) {
      var b = e.target.closest("[data-et]"), fond = e.target === ov; if (!b && !fond) return;
      if (fond || b.dataset.et === "x") { ov.remove(); return; }
      if (b.dataset.et === "p") { var r = maj(); enregistrer(r); setTimeout(function () { var f = q("et-f"); try { f.contentWindow.focus(); f.contentWindow.print(); } catch (x) { alert("Impression impossible : " + x.message); } if (typeof o.apres === "function") try { o.apres(r, items.length * r.copies); } catch (x) { } }, 150); }
    });
    maj(); return ov;
  }

  G.ANGELS_ETIQ = { ouvrir: ouvrir, html: html, etiquette: etiquette, cfg: cfg, PRESETS: PRE, LIMITES: { wMin: W_MIN, wMax: W_MAX, hMin: H_MIN, hMax: H_MAX, copies: COPIES_MAX } };
})(window);
