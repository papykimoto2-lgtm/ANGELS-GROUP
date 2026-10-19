/* Carte en direct : la simulation des livreurs et le bandeau « Démo » n'existent qu'en mode démonstration (jamais en production ni en mode serveur).
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/carte-prod.js */
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

 await t("CP-1","mode démo : bandeau « Démo » visible et positions simulées qui avancent",()=>{localStorage.setItem("angels_demo","1");__as("admin");const E=[];if(!SIM_POS())E.push("SIM_POS faux en démo");
  if(!/Démo : les livreurs en course avancent/.test(VIEWS.carte()))E.push("bandeau absent");
  const l=S.livreurs[0];S.pos[l.id]={lat:5.30,lng:-4.00,ts:new Date().toISOString()};const c=S.commandes[0];c.adr=Object.assign({},c.adr,{gps:{lat:5.31,lng:-4.00}});S.livraisons.push({id:uid("l"),commande_id:c.id,livreur_id:l.id,statut:"en_cours"});
  const avant=S.pos[l.id].lat;simulerPos();if(!(S.pos[l.id].lat>avant))E.push("position non avancée");return E.length?E.join(" ; "):true});
 await t("CP-2","production (hors démo) : aucun bandeau « Démo » et aucune simulation de position",()=>{localStorage.removeItem("angels_demo");__as("admin");const E=[];if(SIM_POS())E.push("SIM_POS vrai en production");
  if(/Démo : les livreurs/.test(VIEWS.carte()))E.push("bandeau affiché en production");return E.length?E.join(" ; "):true});
 await t("CP-3","mode serveur : ni bandeau ni simulation même en démo",()=>{localStorage.setItem("angels_demo","1");__as("admin");const E=[],c0=CL.on;CL.on=true;try{if(SIM_POS())E.push("SIM_POS vrai en mode serveur");if(/Démo : les livreurs/.test(VIEWS.carte()))E.push("bandeau en mode serveur")}finally{CL.on=c0}return E.length?E.join(" ; "):true});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
