/* ANGEL'S GROUP — QR d'installation des applications (téléphone).
   ANGELS_QR.ouvrir({ titre, items:[{ nom, page, icone? }] }) : fenêtre autonome (aucune dépendance à la page hôte) avec, pour chaque application,
   le QR de son adresse sur l'instance en cours, l'adresse en clair et les consignes Android / iPhone. Utilise qrcode.js (chargé au besoin). */
(function (G) {
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function adresse(page) { var u = new URL(page, location.href); u.hash = ""; u.search = ""; return u.href; }
  function svgQr(texte) { var q = G.qrcode(0, "M"); q.addData(texte); q.make(); return q.createSvgTag({ scalable: true, margin: 0 }); }
  function charger() {
    if (G.qrcode) return Promise.resolve();
    return new Promise(function (ok, ko) { var s = document.createElement("script"); s.src = "qrcode.js"; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  }
  function fermer() { var m = document.getElementById("qri"); if (m) m.remove(); document.removeEventListener("keydown", onKey); }
  function onKey(e) { if (e.key === "Escape") fermer(); }
  function ouvrir(o) {
    o = o || {}; var items = (o.items || []).filter(function (x) { return x && x.page; });
    fermer();
    var web = /^https?:$/.test(location.protocol);
    var m = document.createElement("div"); m.id = "qri"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-label", "Installer sur un téléphone");
    m.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:16px;font:15px/1.45 system-ui,Arial,sans-serif";
    var grand = items.length === 1;
    var corps = !web ? '<p style="background:#fff3cd;padding:10px;border-radius:8px">Le QR n\'est disponible que sur la version en ligne (https).</p>'
      : '<div style="display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(' + (grand ? 240 : 190) + 'px,1fr));margin:12px 0">' + items.map(function (x) {
        var url = adresse(x.page);
        return '<div class="qri-c" style="text-align:center;border:1px solid #d5dde3;border-radius:12px;padding:12px"><div style="font-weight:800;margin-bottom:8px">' + esc((x.icone ? x.icone + " " : "") + x.nom) + '</div>'
          + '<div class="qri-q" style="display:inline-block;width:' + (grand ? 220 : 160) + 'px;height:' + (grand ? 220 : 160) + 'px;padding:10px;background:#fff;border:2px solid #0b3c4f;border-radius:12px">' + svgQr(url) + '</div>'
          + '<div style="font-size:12px;font-weight:700;word-break:break-all;margin-top:6px">' + esc(url) + '</div></div>';
      }).join("") + '</div><ol style="padding-left:20px;margin:8px 0"><li>Scannez le QR avec l\'appareil photo du téléphone, puis ouvrez le lien.</li><li><b>Android (Chrome)</b> : menu ⋮ → « Installer l\'application ».</li><li><b>iPhone (Safari)</b> : Partager → « Sur l\'écran d\'accueil ».</li></ol><div style="color:#5b6773;font-size:13px">Première ouverture avec du réseau ; ensuite l\'application fonctionne hors ligne.</div>';
    m.innerHTML = '<div style="background:#fff;color:#10222c;border-radius:16px;padding:18px;width:100%;max-width:' + (grand ? 520 : 860) + 'px;margin:auto"><h2 style="margin:0 0 4px;font-size:19px">' + esc(o.titre || "Installer sur un téléphone") + '</h2>' + corps
      + '<div style="text-align:right;margin-top:12px"><button type="button" id="qri-x" style="border:0;border-radius:10px;padding:9px 18px;font-weight:700;background:#0b3c4f;color:#fff;cursor:pointer">Fermer</button></div></div>';
    m.addEventListener("mousedown", function (e) { if (e.target === m) fermer(); });
    document.body.appendChild(m); document.getElementById("qri-x").onclick = fermer; document.addEventListener("keydown", onKey);
    return m;
  }
  G.ANGELS_QR = { ouvrir: function (o) { return charger().then(function () { return ouvrir(o); }); }, adresse: adresse };
})(window);
