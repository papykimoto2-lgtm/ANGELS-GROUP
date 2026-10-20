/* Comptes de tiers, points 2 et 3 : délai moyen de règlement, synthèse âgée, provision pour créances douteuses (écriture en brouillard), vue groupe.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/tiers-provision.js */
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

 await p.evaluate(()=>{
  window.__fk=(rows,o)=>{o=o||{};let cfg=o.cfg||{},cons=o.cons||0;const drafts=[],h={division:"fake",can:()=>true,user:()=>"T",render:()=>{},util:{fcfa:n=>Math.round(n)+" F"},audit:a=>{(window.__aud=window.__aud||[]).push(a)},run:fn=>{try{fn();return true}catch(e){window.__err=e.message;return false}},
   comptes:()=>[{compte:"4111",lib:"Clients",nature:"D"}],lignes:()=>rows,prov:{get:()=>cfg,set:c=>{cfg=c}},soldeCompte:()=>cons,brouillard:x=>drafts.push(x),brouillardEnAttente:()=>drafts.length>0,drafts,setCons:v=>{cons=v},raz:()=>{drafts.length=0}};return h};
  window.__j=n=>new Date(Date.now()-n*864e5).toISOString().slice(0,10);
  window.__l=(k,d,deb,cre,t,e)=>({k,date:__j(d),piece:"P"+k,libelle:"x",journal:"VE",debit:deb,credit:cre,tiers:t,tn:"Client "+t,lettre:"",echeance:e==null?"":__j(e)})});
 await t("TP-1","délai moyen de règlement : moyenne pondérée des jours entre la pièce et le règlement qui la solde ; part réglée dans les délais (échéance connue)",()=>{const E=[];
  const L=[{date:__j(100),debit:100,credit:0,echeance:__j(90)},{date:__j(60),debit:200,credit:0,echeance:__j(20)},{date:__j(80),debit:0,credit:100,echeance:""},{date:__j(30),debit:0,credit:200,echeance:""}];
  const r=ANGELS_TIERS.delai(L,"D");if(r.m!==300||r.s!==8000)E.push("somme "+JSON.stringify(r));if(Math.round(r.s/r.m)!==27)E.push("moyenne");if(r.ech!==300||r.ret!==100)E.push("dans les délais "+r.ret+"/"+r.ech);
  const r2=ANGELS_TIERS.delai([{date:__j(10),debit:0,credit:50,echeance:""},{date:__j(5),debit:80,credit:0,echeance:""}],"D");if(r2.m!==0&&r2.m!==50)E.push("avance "+JSON.stringify(r2));
  const r3=ANGELS_TIERS.delai([{date:__j(50),debit:0,credit:400,echeance:""},{date:__j(20),debit:400,credit:0,echeance:""}],"C");if(r3.m!==0&&r3.s<0)E.push("dette "+JSON.stringify(r3));return E.length?E.join(" ; "):true});
 await t("TP-2","synthèse âgée : totaux, part échue, > 90 j, concentration (5 premiers), DSO ; concorde avec la balance âgée de Distributions",()=>{const E=[];
  const h=__fk([__l(1,120,1000,0,"A"),__l(2,70,2000,0,"B"),__l(3,10,5000,0,"C"),__l(4,50,3000,0,"D"),__l(5,40,0,3000,"D")]);const x=ANGELS_TIERS.synthese("4111",h);
  if(x.tot!==8000)E.push("total "+x.tot);if(x.tr.join()!=="0,5000,0,2000,1000")E.push("tranches "+x.tr);if(x.p90!==1000||x.tiers90!==1)E.push("p90");if(x.echu!==8000)E.push("échu "+x.echu);if(Math.abs(x.top5-1)>1e-9)E.push("top5 "+x.top5);if(x.top10[0].nom!=="Client C")E.push("tri");
  if(x.flux!==11000||x.dso!==Math.round(8000/11000*365))E.push("DSO "+x.dso+" flux "+x.flux);
  __as("admin");const lc=ANGELS_TIERS.synthese(cdd("fournisseur"),TIERS_HOST),ag=cptAgee(cdd("fournisseur")),tot=ag.reduce((s,r)=>s+r.tot,0);if(lc.tot!==tot)E.push("Distributions : synthèse "+lc.tot+" ≠ balance âgée "+tot);
  ANGELS_TIERS.UI.mode="synthese";ANGELS_TIERS.UI.tiers="";ANGELS_TIERS.UI.compte=cdd("fournisseur");const v=ANGELS_TIERS.view(TIERS_HOST);if(!/Ancienneté globale/.test(v)||!/Les 10 premiers tiers/.test(v)||!/Délai moyen/.test(v))E.push("vue");ANGELS_TIERS.UI.mode="tiers";return E.length?E.join(" ; "):true});
 await t("TP-3","provision : désactivée par défaut ; taux par tranche ; client en litige à taux forcé (motif obligatoire) ; provision requise = somme des clients",()=>{const E=[],rows=[__l(1,120,1000,0,"A"),__l(2,70,2000,0,"B"),__l(3,10,5000,0,"C")],h=__fk(rows);
  let P=ANGELS_TIERS.provision(h);if(P.cfg.actif)E.push("active par défaut");let e="";try{ANGELS_TIERS.ecritureProvision(__j(0),h)}catch(x){e=x.message}if(!/pas activée/.test(e))E.push("écriture sans activation : "+e);
  ANGELS_TIERS.enregistrerProv({actif:true,taux:[0,0,0,25,50]},"",h);P=ANGELS_TIERS.provision(h);if(P.requise!==1000)E.push("requise "+P.requise);if(P.lignes.map(l=>l.nom+":"+l.prov).sort().join()!=="Client A:500,Client B:500")E.push("détail "+P.lignes.map(l=>l.nom+":"+l.prov));
  e="";try{ANGELS_TIERS.forcerTaux("4111|C",100,"abc",h)}catch(x){e=x.message}if(!/Motif/.test(e))E.push("motif court accepté");try{ANGELS_TIERS.forcerTaux("4111|C",120,"litige en cours",h);E.push("taux > 100 accepté")}catch(x){}
  ANGELS_TIERS.forcerTaux("4111|C",100,"Client en liquidation judiciaire",h);P=ANGELS_TIERS.provision(h);if(P.requise!==6000||!P.lignes.some(l=>l.nom==="Client C"&&l.prov===5000&&l.force))E.push("taux forcé "+P.requise);
  ANGELS_TIERS.retirerForce("4111|C",h);if(ANGELS_TIERS.provision(h).requise!==1000)E.push("retrait du taux forcé");
  e="";try{ANGELS_TIERS.enregistrerProv({actif:true,taux:[0,0,0,25,150]},"",h)}catch(x){e=x.message}if(!/Taux invalides/.test(e))E.push("taux invalide accepté");e="";try{ANGELS_TIERS.enregistrerProv({actif:true,taux:[0,0,0,25,50],compte_dot:"ab"},"",h)}catch(x){e=x.message}if(!/compte invalide/.test(e))E.push("compte invalide accepté");
  if(!window.__aud.includes("Provision créances douteuses : paramètres"))E.push("audit paramètres");return E.length?E.join(" ; "):true});
 await t("TP-4","écriture de provision en brouillard : dotation (requise > constatée), reprise (requise < constatée), rien si égal ; une seule écriture en attente ; date non future",()=>{const E=[],h=__fk([__l(1,120,1000,0,"A"),__l(2,70,2000,0,"B")],{cons:200});
  ANGELS_TIERS.enregistrerProv({actif:true,taux:[0,0,0,25,50]},"",h);let e="";try{ANGELS_TIERS.ecritureProvision("2099-01-01",h)}catch(x){e=x.message}if(!/futur/.test(e))E.push("date future : "+e);
  const o=ANGELS_TIERS.ecritureProvision(__j(0),h);if(h.drafts.length!==1)E.push("brouillon non créé");const L=o.lignes;if(L.length!==2||L[0].compte!=="659"||L[0].debit!==800||L[1].compte!=="491"||L[1].credit!==800)E.push("dotation "+JSON.stringify(L));if(!/^PROV-\d{8}$/.test(o.piece))E.push("pièce "+o.piece);
  e="";try{ANGELS_TIERS.ecritureProvision(__j(0),h)}catch(x){e=x.message}if(!/déjà en attente/.test(e))E.push("doublon en attente : "+e);
  h.raz();h.setCons(1000);e="";try{ANGELS_TIERS.ecritureProvision(__j(0),h)}catch(x){e=x.message}if(!/Aucun ajustement/.test(e))E.push("ajustement nul : "+e);
  h.setCons(1500);const r=ANGELS_TIERS.ecritureProvision(__j(0),h).lignes;if(r[0].compte!=="491"||r[0].debit!==500||r[1].compte!=="759"||r[1].credit!==500)E.push("reprise "+JSON.stringify(r));
  const h2=__fk([__l(1,120,1000,0,"A")]);h2.can=a=>a==="v";let e2="";try{ANGELS_TIERS.enregistrerProv({actif:true,taux:[0,0,0,25,50]},"",h2)}catch(x){e2=x.message}if(!/Droits/.test(e2))E.push("droits de paramétrage");return E.length?E.join(" ; "):true});
 await t("TP-5","Distributions : paramètres enregistrés (audit), refus annulé proprement, brouillard créé puis visé → la dépréciation constatée suit, plus d'ajustement ; droits",()=>{__as("admin");const E=[],H=TIERS_HOST;
  if(ANGELS_TIERS.provision(H).cfg.actif)E.push("active par défaut");
  ANGELS_TIERS.enregistrerProv({actif:true,taux:[0,0,0,25,50]},"test",H);if(!S.config.tiers_prov||!S.config.tiers_prov.actif)E.push("paramètres non enregistrés");if(!S.audit.some(a=>a.action==="Provision créances douteuses : paramètres"))E.push("audit");
  const av=JSON.stringify(S.config.tiers_prov);const ok=H.run(()=>{ANGELS_TIERS.enregistrerProv({actif:true,taux:[0,0,0,25,500]},"",H)});if(ok!==false||JSON.stringify(S.config.tiers_prov)!==av)E.push("erreur non annulée");
  const n0=cpt().manuelles.length;H.brouillard({date:__j(0),journal:"OD",piece:"PROV-TEST",libelle:"Dotation test",lignes:[{compte:"659",debit:700,credit:0},{compte:"491",debit:0,credit:700}]});
  const b=cpt().manuelles[cpt().manuelles.length-1];if(cpt().manuelles.length!==n0+1||b.statut!=="brouillard")E.push("brouillard absent");if(!H.brouillardEnAttente("PROV-"))E.push("en attente non détecté");if(H.soldeCompte("491")!==0)E.push("solde 491 avant visa "+H.soldeCompte("491"));
  cptViser(b.id);if(H.soldeCompte("491")!==700)E.push("solde 491 après visa "+H.soldeCompte("491"));if(H.brouillardEnAttente("PROV-"))E.push("encore en attente après visa");
  __as("commercial");if(H.can("a")||H.can("c"))E.push("droits : le commercial ne doit pas paramétrer");__as("admin");return E.length?E.join(" ; "):true});
 await t("TP-6","écran : barre de modes (Tiers et relevés / Synthèse âgée / Provision), aucune provision proposée tant que la fonction n'est pas activée",()=>{__as("admin");const E=[];S.config.tiers_prov=undefined;ANGELS_TIERS.UI.tiers="";ANGELS_TIERS.UI.mode="tiers";let v=ANGELS_TIERS.view(TIERS_HOST);if(!/Synthèse âgée/.test(v)||!/Provision créances douteuses/.test(v))E.push("barre de modes");
  ANGELS_TIERS.UI.mode="prov";v=ANGELS_TIERS.view(TIERS_HOST);if(!/désactivée/.test(v)||!/Activez la fonction/.test(v))E.push("état désactivé");if(/Générer l'écriture/.test(v))E.push("écriture proposée sans activation");
  ANGELS_TIERS.enregistrerProv({actif:true,taux:[0,0,0,25,50]},"",TIERS_HOST);v=ANGELS_TIERS.view(TIERS_HOST);if(!/Dépréciation requise/.test(v)||!/validez|valider/.test(v))E.push("vue activée");ANGELS_TIERS.UI.mode="tiers";return E.length?E.join(" ; "):true});
 const ctx2=await b.newContext({viewport:{width:1200,height:900}});await ctx2.addInitScript(()=>{try{localStorage.setItem("angels_demo","1")}catch(e){}});
 const pubs={};
 for(const [app,id,lib] of [["distribution","TP-7","Distributions"],["transport","TP-8","Transport"],["agro","TP-9","Agro"]]){const q=await ctx2.newPage();q.on("pageerror",e=>errs.push(app+": "+e.message));q.on("dialog",d=>d.accept());await q.goto(base+"/"+app+".html");await q.waitForTimeout(700);
  let r;try{r=await q.evaluate(()=>{ME=S.users.find(u=>u.role==="comptable")||S.users.find(u=>u.role==="admin")||S.users[0];const E=[],H=TIERS_HOST,C=H.comptes();ANGELS_TIERS.UI.mode="synthese";ANGELS_TIERS.UI.tiers="";ANGELS_TIERS.UI.compte="";if(!/Ancienneté globale/.test(ANGELS_TIERS.view(H)))E.push("synthèse");
   ANGELS_TIERS.UI.mode="prov";if(!/Provision pour créances douteuses/.test(ANGELS_TIERS.view(H)))E.push("vue provision");ANGELS_TIERS.UI.mode="tiers";
   /* brouillard réel : comptes 659 / 491 acceptés par la comptabilité de la division, en attente de visa */
   const L=[{compte:"659",debit:300,credit:0},{compte:"491",debit:0,credit:300}];const ok=H.run(()=>H.brouillard({date:new Date().toISOString().slice(0,10),journal:"OD",piece:"PROV-"+Date.now(),libelle:"Dotation test",lignes:L}));if(ok===false)E.push("brouillard refusé");if(!H.brouillardEnAttente("PROV-"))E.push("brouillard non détecté");
   const r=ANGELS_TIERS.publier(H);if(!r||!r.creances||!r.dettes||!r.prov)E.push("publication");const raw=localStorage.getItem("angels_tiers_"+H.division)||"";if(!raw)E.push("clé de publication absente");
   const noms=[];C.forEach(c=>ANGELS_TIERS.liste(c.compte,H).forEach(t=>noms.push(t.nom)));if(noms.some(n=>n.length>3&&raw.includes(n)))E.push("noms de tiers publiés");
   return E.length?E.join(" ; "):true})}catch(e){r="EXC "+e.message}
  if(r===true){ok++;console.log("PASS "+id+" "+lib+" : synthèse, provision (brouillard réel), publication sans noms de tiers")}else{ko++;console.log("FAIL "+id,lib,"→",r)}}
 {const q=await ctx2.newPage();q.on("pageerror",e=>errs.push("groupe: "+e.message));await q.goto(base+"/compta-groupe.html");await q.waitForTimeout(600);
  const r=await q.evaluate(()=>{const t=document.body.innerText,E=[];if(!/Créances et dettes — consolidé du groupe/.test(t))E.push("section absente");["Distributions","Transport","Agro"].forEach(n=>{const m=t.split("Créances et dettes — consolidé du groupe")[1]||"";if(!m.includes(n))E.push(n+" absent")});if(/Pas de données : ouvrez/.test((t.split("Créances et dettes — consolidé du groupe")[1]||"").split("Plan comptable commun")[0]))E.push("une division sans synthèse");if(!/Ancienneté des créances du groupe/.test(t))E.push("graphique");return E.length?E.join(" ; "):true});
  if(r===true){ok++;console.log("PASS TP-10 groupe : section « Créances et dettes — consolidé » alimentée par les trois divisions (tableau, total groupe, ancienneté)")}else{ko++;console.log("FAIL TP-10 groupe →",r)}}
 {const q=await ctx2.newPage();q.on("pageerror",e=>errs.push("transport: "+e.message));q.on("dialog",d=>d.accept());await q.goto(base+"/transport.html");await q.waitForTimeout(600);
  const r=await q.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const E=[];UI.tab.etats="age";const h=V.etats();if(!/data-a="tr.rel"/.test(h)&&!/Aucun impayé/.test(h))E.push("bouton Relevé absent de la balance âgée");return E.length?E.join(" ; "):true});
  if(r===true){ok++;console.log("PASS TP-11 Transport : balance âgée avec bouton « Relevé » (ou aucun impayé)")}else{ko++;console.log("FAIL TP-11 →",r)}}
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
