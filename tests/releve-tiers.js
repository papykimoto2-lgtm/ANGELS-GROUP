/* Comptes de tiers : relevé de compte individuel et ancienneté par pièce (moteur tiers-engine.js) dans Distributions, Transport et Agro.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/releve-tiers.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),p=await ctx.newPage(),errs=[];
 p.on("pageerror",e=>errs.push("PAGEERR "+e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/distribution.html");await p.waitForTimeout(300);
 await p.evaluate(()=>{window.__T=[];toast=(m,k)=>{__T.push(m)};window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};window.__last=()=>__T[__T.length-1]||"";
  window.__ch=(el,v)=>{el.value=v;el.dispatchEvent(new Event("change",{bubbles:true}))};window.__in=(el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}))};
  window.__clic=re=>[...document.querySelectorAll("button")].find(x=>re.test(x.textContent)).click();
  window.__V=()=>S.vendeurs[0];window.__Z=()=>S.config.zones[0].nom;
  window.__prod=()=>S.produits.find(x=>x.actif&&x.stock>=50);
  /* commande d'ANGEL'S pour un client divers, créée à la main */
  window.__div=(o)=>{o=o||{};const ad={id:uid("a"),libelle:"Livraison",zone:__Z(),quartier:o.q||"Cocody",repere:"Pharmacie",gps:null,instructions:"",defaut:true};
   const cl={id:uid("cl"),nom:"Client divers",tel:"",tel2:"",adresses:[ad],note:"",divers:true};if(o.vendeur)cl.vendeur_id=o.vendeur;S.clients.push(cl);
   __as("admin");return creerCmd({client_id:cl.id,adr:Object.assign({},ad),lignes:o.lignes||[{produit_id:__prod().id,qte:2,pu:__prod().prix}],frais:1000,remise:0,paiement:"livraison",mode:"Espèces",priorite:"normale",canal:"Téléphone",obs:"",confirmer:o.confirmer!==false,vendeur_id:o.vendeur||null,paye_vendeur:0})}});
 let ok=0,ko=0;const t=async(id,label,fn)=>{let r;try{r=await p.evaluate(fn)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",r)}};

 await t("RT-1","ancienneté par pièce (FIFO) : les règlements s'imputent sur les plus anciennes ; avance si excédent ; échéance future = non échu ; dettes (nature C)",()=>{const E=[],j=n=>new Date(Date.now()-n*864e5).toISOString().slice(0,10);
  const L=[{date:j(120),debit:100,credit:0,echeance:""},{date:j(70),debit:200,credit:0,echeance:""},{date:j(20),debit:300,credit:0,echeance:""},{date:j(10),debit:0,credit:150,echeance:""}];
  let a=ANGELS_TIERS.age(L,"D");if(JSON.stringify(a.tr)!=="[0,300,0,150,0]"||a.tot!==450||a.avance!==0)E.push("FIFO "+JSON.stringify(a.tr)+" tot "+a.tot);
  a=ANGELS_TIERS.age(L.concat([{date:j(5),debit:0,credit:1000,echeance:""}]),"D");if(a.tot!==0||a.avance!==550)E.push("avance "+a.tot+"/"+a.avance);
  a=ANGELS_TIERS.age([{date:j(5),debit:500,credit:0,echeance:new Date(Date.now()+20*864e5).toISOString().slice(0,10)},{date:j(60),debit:100,credit:0,echeance:""}],"D");if(a.tr[0]!==500||a.tr[2]!==100)E.push("non échu "+JSON.stringify(a.tr));
  a=ANGELS_TIERS.age([{date:j(40),debit:0,credit:800,echeance:""},{date:j(10),debit:300,credit:0,echeance:""}],"C");if(a.tr[2]!==500||a.tot!==500)E.push("dette "+JSON.stringify(a.tr));return E.length?E.join(" ; "):true});
 await t("RT-2","Distributions : l'ancienneté du relevé concorde avec la balance âgée existante, pour chaque tiers (clients, fournisseurs, vendeurs)",()=>{__as("admin");const E=[];let n=0;
  [[cdd("client"),"D"],[cdd("fournisseur"),"C"],[cdd("vendeurs"),"C"]].forEach(([c])=>{const ag=cptAgee(c),L=ANGELS_TIERS.liste(c,TIERS_HOST);ag.forEach(r=>{const t=L.find(x=>x.nom===r.nom);n++;if(!t){E.push("tiers absent "+r.nom);return}
   if(t.age.tr.slice(1).join()!==r.tr.join()||t.age.tr[0]!==0)E.push(r.nom+" tranches "+t.age.tr+" ≠ "+r.tr);if(t.age.tot!==r.tot)E.push(r.nom+" total "+t.age.tot+" ≠ "+r.tot);if(t.age.avance!==r.avance)E.push(r.nom+" avance")})});
  return n>0&&!E.length||(n?E.join(" ; "):"aucun tiers à comparer")});
 await t("RT-3","relevé : solde cumulé ligne par ligne, totaux, report à une date, filtre « non lettrées », erreurs (période inversée, tiers inconnu)",()=>{__as("admin");const E=[];const c=cdd("fournisseur"),t=ANGELS_TIERS.liste(c,TIERS_HOST).sort((a,b)=>b.nb-a.nb)[0];if(!t)return"aucun fournisseur";
  const r=ANGELS_TIERS.releve(c,t.id,{},TIERS_HOST);let cum=0;r.lignes.forEach(x=>{cum+=x.credit-x.debit;if(x.cumul!==cum)E.push("cumul faux "+x.cumul+" ≠ "+cum)});if(r.solde!==t.solde)E.push("solde "+r.solde+" ≠ liste "+t.solde);if(r.debit!==t.debit||r.credit!==t.credit)E.push("totaux");
  if(r.lignes.length>=3){const d=r.lignes[2].date,r2=ANGELS_TIERS.releve(c,t.id,{du:d},TIERS_HOST);const avant=r.lignes.filter(x=>x.date<d).reduce((s,x)=>s+x.credit-x.debit,0);if(r2.report!==avant)E.push("report "+r2.report+" ≠ "+avant);if(r2.solde!==r.solde)E.push("solde avec report");if(r2.lignes.some(x=>x.date<d))E.push("lignes avant le début")}
  let e="";try{ANGELS_TIERS.releve(c,t.id,{du:"2026-05-01",au:"2026-01-01"},TIERS_HOST)}catch(x){e=x.message}if(!/antérieure/.test(e))E.push("période inversée : "+e);e="";try{ANGELS_TIERS.releve(c,"inconnu",{},TIERS_HOST)}catch(x){e=x.message}if(!/Aucun mouvement/.test(e))E.push("tiers inconnu : "+e);
  const nl=ANGELS_TIERS.releve(c,t.id,{nl:true},TIERS_HOST);if(nl.lignes.some(x=>x.lettre))E.push("pièces lettrées présentes avec le filtre");return E.length?E.join(" ; "):true});
 await t("RT-4","écran : onglet « Relevé de compte » (liste → relevé → retour), bouton « Relevé » depuis la balance âgée, recherche, droits",()=>{__as("admin");const E=[];view="compta";ui.cpt="rel";ANGELS_TIERS.UI.tiers="";ANGELS_TIERS.UI.compte=cdd("fournisseur");let h=VIEWS.compta();if(!/Compte de tiers/.test(h)||!/Grossiste Abidjan/.test(h))E.push("liste absente");
  const t=ANGELS_TIERS.liste(cdd("fournisseur"),TIERS_HOST).find(x=>x.nom==="Grossiste Abidjan");ANGELS_TIERS.ouvrir(TIERS_HOST,cdd("fournisseur"),t.id);h=VIEWS.compta();if(!/Ancienneté des pièces ouvertes/.test(h)||!/Solde dû/.test(h))E.push("relevé absent");if(!/Imprimer/.test(h))E.push("impression absente pour l'admin");
  ANGELS_TIERS.UI.tiers="";ui.cpt="age";h=VIEWS.compta();if(!/data-act="tiersRel"/.test(h))E.push("bouton Relevé absent de la balance âgée");tiersRelDepuis("f|Grossiste Abidjan");if(ANGELS_TIERS.UI.tiers!==t.id||ui.cpt!=="rel")E.push("ouverture depuis la balance âgée");
  ANGELS_TIERS.UI.tiers="";ANGELS_TIERS.UI.q="aya";ANGELS_TIERS.UI.compte=cdd("vendeurs");h=VIEWS.compta();if(!/Aya Boutique/.test(h))E.push("recherche");ANGELS_TIERS.UI.q="";
  __as("commercial");if(TIERS_HOST.can())E.push("droits : le commercial ne doit pas voir la comptabilité");const v=ANGELS_TIERS.view(TIERS_HOST);if(!/non autorisé/.test(v))E.push("accès non refusé");__as("admin");return E.length?E.join(" ; "):true});
 await t("RT-5","impression : moteur d'impression appelé avec le titre, le tiers, le solde et l'ancienneté ; tracé dans l'audit ; droits requis",()=>{__as("admin");const E=[];let cap=null;const o0=ANGELS_PRINT.ouvrir;ANGELS_PRINT.ouvrir=x=>{cap=x;return Promise.resolve()};
  try{const t=ANGELS_TIERS.liste(cdd("fournisseur"),TIERS_HOST)[0];ANGELS_TIERS.ouvrir(TIERS_HOST,cdd("fournisseur"),t.id);document.body.insertAdjacentHTML("beforeend",'<button id="tp" data-tr="imprimer"></button>');document.getElementById("tp").click();document.getElementById("tp").remove();
   if(!cap)return"impression non appelée";if(!/Relevé de compte fournisseur/.test(cap.titre))E.push("titre "+cap.titre);if(!cap.corps.includes(t.nom))E.push("tiers absent du document");if(!/Ancienneté des pièces ouvertes/.test(cap.corps))E.push("ancienneté absente");if(!/^RC-/.test(cap.ref))E.push("réf "+cap.ref);
   if(/\d{2}[ .]\d{2}[ .]\d{2}[ .]\d{2}[ .]\d{2}/.test(cap.corps))E.push("numéro de téléphone dans le document");if(!S.audit.some(a=>a.action==="Relevé de compte imprimé"))E.push("audit")}finally{ANGELS_PRINT.ouvrir=o0}return E.length?E.join(" ; "):true});
 {const dl=await (async()=>{await p.evaluate(()=>{__as("admin");const t=ANGELS_TIERS.liste(cdd("fournisseur"),TIERS_HOST).sort((a,b)=>b.nb-a.nb)[0];ANGELS_TIERS.ouvrir(TIERS_HOST,cdd("fournisseur"),t.id);document.body.insertAdjacentHTML("beforeend",'<button id="tc" data-tr="csv"></button>')});
   const [d]=await Promise.all([p.waitForEvent("download",{timeout:8000}),p.evaluate(()=>document.getElementById("tc").click())]);return d})().catch(e=>null);
  if(!dl){ko++;console.log("FAIL RT-6 export CSV : aucun téléchargement")}else{const txt=fs.readFileSync(await dl.path(),"utf8");const L=txt.replace(/^﻿/,"").split("\n");
   if(/^releve-/.test(dl.suggestedFilename())&&L[0]==='"Date";"Pièce";"Libellé";"Lettre";"Débit";"Crédit";"Solde"'&&L.length>2){ok++;console.log("PASS RT-6 export CSV : en-têtes, une ligne par mouvement, nom de fichier du tiers ("+(L.length-1)+" lignes)")}else{ko++;console.log("FAIL RT-6 export CSV",dl.suggestedFilename(),L[0])}}}
 const ctx2=await b.newContext({viewport:{width:1200,height:900}});
 for(const [app,id,lib] of [["transport","RT-7","Transport"],["agro","RT-8","Agro"]]){const q=await ctx2.newPage();q.on("pageerror",e=>errs.push(app+": "+e.message));q.on("dialog",d=>d.accept());await q.goto(base+"/"+app+".html");await q.waitForTimeout(700);
  let r;try{r=await q.evaluate(()=>{ME=S.users.find(u=>u.role==="admin")||S.users[0];const E=[],H=TIERS_HOST,C=H.comptes();if(!C.length)return"aucun compte de tiers";
   const avecTiers=C.filter(c=>ANGELS_TIERS.liste(c.compte,H).length);if(!avecTiers.length)return"aucun tiers avec mouvements";if(C.some(c=>/^(40|41)$/.test(c.compte)))E.push("compte parent vide proposé : "+C.map(c=>c.compte));
   const c=avecTiers[0],t=ANGELS_TIERS.liste(c.compte,H)[0],r=ANGELS_TIERS.releve(c.compte,t.id,{},H);let cum=0;r.lignes.forEach(x=>{cum+=(c.nature==="C"?x.credit-x.debit:x.debit-x.credit);if(x.cumul!==cum)E.push("cumul")});if(r.solde!==t.solde)E.push("solde");
   const ag=ANGELS_TIERS.age(H.lignes(c.compte).filter(x=>x.tiers===t.id).map(x=>x),c.nature);if(ag.tot!==t.age.tot)E.push("âge");
   ANGELS_TIERS.UI.tiers="";ANGELS_TIERS.UI.compte="";const vue=ANGELS_TIERS.view(H);if(ANGELS_TIERS.UI.compte!==avecTiers[0].compte&&!ANGELS_TIERS.liste(ANGELS_TIERS.UI.compte,H).length)E.push("compte par défaut vide : "+ANGELS_TIERS.UI.compte);if(!/Compte de tiers/.test(vue)||!vue.includes(t.nom))E.push("liste");ANGELS_TIERS.ouvrir(H,c.compte,t.id);if(!/Ancienneté des pièces ouvertes/.test(ANGELS_TIERS.view(H)))E.push("relevé");
   if(typeof tabOf==="function"){UI.tab.compta="rel";const h=V.compta();if(!/Compte de tiers/.test(h))E.push("onglet compta absent")}
   return E.length?E.join(" ; "):true})}catch(e){r="EXC "+e.message}
  if(r===true){ok++;console.log("PASS "+id+" "+lib+" : relevé de compte (liste, solde cumulé, ancienneté, onglet de la comptabilité)")}else{ko++;console.log("FAIL "+id,lib,"→",r)}}
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
