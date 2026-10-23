/* Interface mobile commune aux applications Livreur et Vendeur (livreur.html, vendeur.html) :
   jeu d'icônes dessinées (SVG, identiques sur tous les téléphones), barre de navigation en bas, bandeau « parcours d'une commande » et état vide illustré.
   Les couleurs viennent des variables CSS de chaque application (--b, --b2, --bd, --mu, --card, --ok, --er) : bleu pour le livreur, vert pour le vendeur. */
(function(){
 var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
 var P={
  accueil:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  missions:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  messages:'<path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z"/>',
  planning:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
  gains:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14.5h2"/>',
  moi:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  demandes:'<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
  nouvelle:'<path d="M12 5v14M5 12h14"/>',
  commandes:'<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  reglements:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14.5h2"/>',
  lien:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  live:'<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>',
  commande:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  collecte:'<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  route:'<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M9 17h6l-2.5-7H9l-1.5 3M13 10l2-3h3"/>',
  livre:'<path d="M5 13l4 4L19 7"/>',
  alerte:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  historique:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  stats:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  vide:'<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/>'
 };
 function ic(n,s){s=s||22;return'<svg class="ic" viewBox="0 0 24 24" width="'+s+'" height="'+s+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(P[n]||P.vide)+'</svg>'}
 /* Barre du bas : items = [{k:page, l:libellé, i:icône, n:pastille, c:true pour le bouton central}], attr = "p" ou "r" (attribut data-… porté par chaque bouton) */
 function tabbar(items,actif,attr){
  return'<nav class="tb" aria-label="Navigation principale">'+items.map(function(o){
   return'<button type="button" class="'+(o.c?"tc ":"")+(o.k===actif?"on":"")+'" data-a="page" data-'+attr+'="'+esc(o.k)+'" aria-label="'+esc(o.l)+'"'+(o.k===actif?' aria-current="page"':"")+'><span class="ti">'+ic(o.i,o.c?26:22)+(o.n?'<em class="tn">'+esc(o.n>99?"99+":o.n)+'</em>':"")+'</span><span class="tl">'+esc(o.l)+'</span></button>'}).join("")+'</nav>'}
 /* Parcours d'une commande, identique côté livreur et côté vendeur */
 var ETAPES=[["commande","Commande"],["collecte","Collecte"],["route","En route"],["livre","Livré"]];
 function parcours(i,ko){
  return'<ol class="pcs'+(ko?" ko":"")+'" aria-label="Parcours de la commande">'+ETAPES.map(function(e,k){
   var c=ko?"":(k<i?"ok":k===i?"cur":"");
   return'<li class="'+c+'"'+(k===i&&!ko?' aria-current="step"':"")+'><span class="pi">'+ic(k<i&&!ko?"livre":e[0],16)+'</span><span class="pl">'+e[1]+'</span></li>'}).join("")+'</ol>'}
 /* Étape d'une commande d'après le libellé de son statut (espace vendeur) */
 function etapeCmd(statut){
  var s=String(statut||"").toLowerCase();
  if(/échou|retour|annul/.test(s))return{i:0,ko:true};
  if(/^livrée/.test(s))return{i:3};   // « Prête à être livrée » est une étape de collecte, pas une livraison faite
  if(/en cours/.test(s))return{i:2};
  if(/prête|affect/.test(s))return{i:1};
  return{i:0}}
 /* Étape d'une mission d'après son statut (application livreur) */
 function etapeMission(statut,collecteFaite){
  var s=String(statut||"");
  if(/^col_/.test(s))return{i:1};
  if(s==="livree")return{i:3};
  if(s==="en_cours")return{i:2};
  if(s==="acceptee"&&collecteFaite)return{i:1,pret:true};
  if(/echou|annul|refus/.test(s))return{i:0,ko:true};
  return{i:1}}
 function vide(icone,titre,texte,action){
  return'<div class="vd"><span class="vi">'+ic(icone,34)+'</span><b>'+esc(titre)+'</b>'+(texte?'<span class="sm mu">'+esc(texte)+'</span>':"")+(action||"")+'</div>'}
 var css=
  '.ic{display:inline-block;vertical-align:middle;flex:none}'+
  'body.has-tb .wrap{padding-bottom:96px}'+
  '.tb{position:fixed;left:0;right:0;bottom:0;z-index:30;display:flex;align-items:flex-end;justify-content:center;background:var(--card,#fff);border-top:1px solid var(--bd,#d6e4ea);box-shadow:0 -4px 14px rgba(0,0,0,.08);padding:4px 4px calc(6px + env(safe-area-inset-bottom,0px))}'+
  '.tb button{flex:1;max-width:112px;min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:0;background:transparent;color:var(--mu,#6b7390);font:inherit;font-size:11px;font-weight:600;cursor:pointer;border-radius:12px;margin:0;padding:4px 2px;width:auto}'+
  '.tb button .ti{position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:28px;border-radius:99px;transition:background .15s}'+
  '.tb button.on{color:var(--b,#0e7490)}.tb button.on .ti{background:rgba(127,127,127,.16)}'+
  '.tb button.tc{margin-top:-18px}.tb button.tc .ti{width:56px;height:56px;border-radius:50%;background:var(--b,#0e7490);color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.28)}'+
  '.tb button.tc.on .ti{background:var(--b2,#0b3b4c)}.tb button.tc .tl{color:var(--b,#0e7490)}'+
  '.tn{position:absolute;top:-5px;right:2px;min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:var(--er,#c62828);color:#fff;font-style:normal;font-size:11px;font-weight:800;line-height:18px;text-align:center}'+
  'body.has-tb .sosb{bottom:92px}body.has-tb #toast{bottom:92px}'+
  '.btn,.mi{min-height:48px}'+
  '.pcs{list-style:none;margin:10px 0 6px;padding:0;display:flex;align-items:flex-start;gap:0}'+
  '.pcs li{flex:1;position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;color:var(--mu,#6b7390);font-size:11px;font-weight:600;text-align:center}'+
  '.pcs li+li::before{content:"";position:absolute;top:13px;right:50%;width:100%;height:3px;background:var(--bd,#d6e4ea);z-index:0}'+
  '.pcs li.ok+li::before,.pcs li.cur::before{background:var(--ok,#118a4b)}'+
  '.pcs .pi{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--bd,#d6e4ea);color:var(--mu,#6b7390)}'+
  '.pcs li.ok .pi{background:var(--ok,#118a4b);color:#fff}.pcs li.cur .pi{background:var(--b,#0e7490);color:#fff;box-shadow:0 0 0 4px rgba(14,116,144,.2)}'+
  '.pcs li.cur{color:var(--tx,#1b2240);font-weight:800}.pcs.ko li{opacity:.55}'+
  '.vd{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:22px 16px;border:1px dashed var(--bd,#d6e4ea);border-radius:14px;background:var(--card,#fff);margin:10px 0}'+
  '.vd .vi{display:flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:rgba(127,127,127,.12);color:var(--b,#0e7490)}'+
  '.rac{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}'+
  '.rac button{display:flex;flex-direction:column;align-items:center;gap:6px;min-height:76px;padding:10px 4px;border:1px solid var(--bd,#d6e4ea);border-radius:14px;background:var(--card,#fff);color:var(--tx,#1b2240);font:inherit;font-size:12px;font-weight:700;cursor:pointer;margin:0;width:auto}'+
  '.rac button .ic{color:var(--b,#0e7490)}';
 function monter(actif){
  if(!document.getElementById("ui-mobile")){var st=document.createElement("style");st.id="ui-mobile";st.textContent=css;(document.head||document.documentElement).appendChild(st)}
  if(document.body)document.body.classList.toggle("has-tb",!!actif)}
 monter(false);
 window.ANGELS_UI={ic:ic,tabbar:tabbar,parcours:parcours,etapeCmd:etapeCmd,etapeMission:etapeMission,vide:vide,monter:monter,ICONES:Object.keys(P)};
})();
