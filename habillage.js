/* Habillage commun « style CRM » des écrans de Distributions, Transport et Agro : bandeau dégradé aux couleurs de l'application,
   onglets en pilules, cartes et tableaux arrondis. Aucune logique : après chaque affichage, le titre (h1) de l'écran et ses boutons
   sont regroupés dans un bandeau, et le contenu est enveloppé dans « .cdl ». Un écran qui construit déjà son propre « .cdl » n'est pas touché. */
(function (G) {
  "use strict";
  var D = G.document;
  var CSS = ".cdl{--a:var(--b3,#14b8a6);--sh:0 1px 2px rgba(15,40,60,.06),0 10px 28px rgba(15,40,60,.08)}\n.cdl .ban{position:relative;overflow:hidden;background:linear-gradient(135deg,var(--b2),var(--b) 60%,var(--a));color:#fff;border-radius:18px;padding:18px 20px 44px;margin-bottom:-30px}\n.cdl .ban:before,.cdl .ban:after{content:\"\";position:absolute;border-radius:50%;background:rgba(255,255,255,.08);pointer-events:none}\n.cdl .ban:before{width:220px;height:220px;right:-50px;top:-90px}.cdl .ban:after{width:140px;height:140px;left:35%;bottom:-80px}\n.cdl .ban h1{margin:0;font-size:22px;color:#fff;position:relative}.cdl .ban p{margin:2px 0 0;font-size:13px;opacity:.85;position:relative}\n.cdl .kp{position:relative;display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin:0 10px 14px}\n.cdl .kp button,.cdl .kp>div{font:inherit;text-align:left;cursor:pointer;background:var(--card);color:var(--tx);border:1px solid var(--bd);border-radius:16px;padding:12px 14px;box-shadow:var(--sh);transition:transform .15s}\n.cdl .kp button:hover{transform:translateY(-2px)}.cdl .kp>div{cursor:default}.cdl .kp .ic{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:#f1f6f8;font-size:16px;margin-bottom:6px}\n.cdl .kp b{display:block;font-size:24px;line-height:1.1}.cdl .kp span.l{font-size:12px;color:var(--mu)}.cdl .kp .w b{color:var(--wa)}.cdl .kp .e b{color:var(--er)}\n.cdl .kp button.sel{outline:2px solid var(--b);outline-offset:-2px}.cdl .kp .o b{color:var(--ok)}\n.cdl .ban .btn{position:relative}.cdl .ban .btn.ghost{background:rgba(255,255,255,.15);color:#fff;border-color:rgba(255,255,255,.45)}.cdl .ban .btn:not(.ghost){background:#fff;color:var(--b2)}\n.cdl .ban .between{position:relative;align-items:flex-start}\n.cdl .ban.s{margin-bottom:14px;padding-bottom:18px}.cdl .ban.s p{max-width:720px}\n.cdl .grid .kpi{border-radius:16px;box-shadow:var(--sh);padding:14px}.cdl .grid .kpi .v{font-size:24px;letter-spacing:-.4px}\n.cdl .pill{border-radius:99px}\n.cdl .tabs{flex-wrap:nowrap;overflow-x:auto;padding:6px;background:var(--card);border-radius:99px;box-shadow:var(--sh);border:1px solid var(--bd);position:sticky;top:6px;z-index:20;scrollbar-width:none}\n.cdl .tabs::-webkit-scrollbar{display:none}\n.cdl .tabs button{flex:0 0 auto;border:0;background:none;color:var(--mu);font-weight:700;padding:9px 14px;white-space:nowrap;transition:background .18s,color .18s,transform .12s}\n.cdl .tabs button:hover{background:#f1f6f8;color:var(--tx)}.cdl .tabs button:active{transform:scale(.96)}\n.cdl .tabs button.on{background:linear-gradient(135deg,var(--b),var(--a));color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.25)}\n.cdl .card{border-radius:16px;box-shadow:var(--sh)}\n.cdl table{border-radius:16px;overflow:hidden;box-shadow:var(--sh)}\n@media(max-width:700px){.cdl .ban{padding:14px 14px 40px}.cdl .kp{margin:0 4px 12px;grid-template-columns:repeat(3,1fr);gap:8px}.cdl .kp button{padding:8px 10px}.cdl .kp .ic{width:26px;height:26px;font-size:13px;margin-bottom:3px}.cdl .kp b{font-size:20px}.cdl .kp span.l{font-size:11px}}\n@media(prefers-color-scheme:dark){.cdl .kp .ic,.cdl .tabs button:hover{background:#0e2129}}\n.cdl .tabs button.on{border:0}.cdl .tabs button{border-bottom:0}\n.cdl .ban .flex .btn{min-height:38px}\n.cdl .ban select,.cdl .ban input{color:#14213d;background:#fff;border:0;border-radius:10px;min-height:38px;margin:0}\n.cdl .ban label{color:#fff}";
  function style() {
    if (D.getElementById("cdl-css")) return;
    var s = D.createElement("style"); s.id = "cdl-css"; s.textContent = CSS; D.head.appendChild(s);
  }
  /* main : conteneur de l'écran (« .shell > main ») ; renvoie vrai si le bandeau a été posé */
  function appliquer(main) {
    style();
    main = main || D.querySelector(".shell > main"); if (!main) return false;
    if (main.querySelector(":scope > .cdl")) return false;
    var kids = Array.prototype.filter.call(main.childNodes, function (n) { return !(n.nodeType === 1 && n.classList.contains("burger")); });
    if (!kids.length) return false;
    var w = D.createElement("div"); w.className = "cdl";
    kids.forEach(function (n) { w.appendChild(n); });
    main.appendChild(w);
    var h = null, i;
    for (i = 0; i < w.children.length; i++) { var c = w.children[i]; h = c.tagName === "H1" ? c : c.querySelector(":scope > h1"); if (h) break; }
    if (h) {
      var row = h.parentNode === w ? h : h.parentNode;
      if (row.parentNode === w && row.tagName !== "H1" && !/(^|\s)(between|flex)(\s|$)/.test(row.className)) row = h;
      var b = D.createElement("div"); b.className = "ban s";
      w.insertBefore(b, row); b.appendChild(row);
    }
    return true;
  }
  G.ANGELS_HABILLAGE = { appliquer: appliquer };
})(window);
