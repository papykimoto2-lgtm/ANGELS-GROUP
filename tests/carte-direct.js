/* Carte en direct : repères mis à jour sans détruire les fenêtres ouvertes, trace, marge GPS, distance, positions anciennes, compteurs. Leaflet servi localement (tests/vendor).
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/carte-direct.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),p=await ctx.newPage(),errs=[];
 p.on("pageerror",e=>errs.push("PAGEERR "+e.message));p.on("dialog",d=>d.accept());
 await ctx.route(/unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.js/,r=>r.fulfill({contentType:"application/javascript",body:fs.readFileSync(path.join(root,"tests/vendor/leaflet.js"))}));await ctx.route(/unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.css/,r=>r.fulfill({contentType:"text/css",body:fs.readFileSync(path.join(root,"tests/vendor/leaflet.css"))}));await ctx.route(/tile\.openstreetmap\.org/,r=>r.abort());
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

 await p.evaluate(()=>{window.__wait=ms=>new Promise(r=>setTimeout(r,ms));
  /* un livreur en course (destination géolocalisée), un livreur libre */
  window.__setup=()=>{__as("admin");S.config.gps_stale_ok=2;S.config.gps_stale_warn=10;const lvs=S.livreurs.filter(l=>!l.archive);const A=lvs[0],B=lvs[1];S.livraisons=S.livraisons.filter(x=>!isActive(x));S.gps_hist=[];S.pos={};
   const c=S.commandes.find(x=>x.adr&&x.statut==="prete")||S.commandes[0];c.adr.gps={lat:5.34,lng:-4.02};c.statut="en_cours";const l={id:uid("l"),commande_id:c.id,livreur_id:A.id,statut:"en_cours",code:"1234",montant_attendu:0};S.livraisons.push(l);A.statut="disponible";B.statut="disponible";
   S.pos[A.id]={lat:5.30,lng:-4.00,acc:12,ts:new Date().toISOString(),livraison_id:l.id};return{A:A.id,B:B.id,l:l.id}};
  window.__ouvrir=async()=>{view="carte";render();for(let i=0;i<60&&!(CARTE.map&&window.L);i++)await __wait(100);await __wait(300);return !!CARTE.map}});
 await t("CD-1","repères mis à jour sans destruction : la fenêtre d'un livreur reste ouverte quand il avance (avant : fermée toutes les 3 s)",async()=>{const I=__setup();if(!await __ouvrir())return"carte non chargée";carteMarkers();const E=[],m1=CARTE.mk[I.A];if(!m1)return"repère absent";m1.openPopup();
  const avant=m1.getLatLng().lat;S.pos[I.A]=Object.assign({},S.pos[I.A],{lat:5.305,ts:new Date().toISOString()});carteMarkers();const m2=CARTE.mk[I.A];
  if(m2!==m1)E.push("repère recréé");if(!(m2.getLatLng().lat>avant))E.push("repère non déplacé");if(!m2.isPopupOpen())E.push("fenêtre fermée");return E.length?E.join(" ; "):true});
 await t("CD-2","trace des 30 dernières minutes, cercle de marge GPS (> 40 m), trait vers la destination et distance restante dans la fenêtre et la liste",async()=>{const I=__setup();const E=[];for(let i=0;i<6;i++)S.gps_hist.push({livreur_id:I.A,lat:5.29+i*.002,lng:-4.0,acc:10,ts:new Date(Date.now()-(10-i)*60000).toISOString()});S.gps_hist.push({livreur_id:I.A,lat:5.1,lng:-4.0,acc:10,ts:new Date(Date.now()-3*3600000).toISOString()});
  S.pos[I.A].acc=150;if(!await __ouvrir())return"carte";carteMarkers();const k=Object.keys(CARTE.reg);if(!k.some(x=>x[0]==="t"))E.push("trace absente");const tr=CARTE.reg["t:"+I.A];if(tr&&tr.layer.getLatLngs().length!==6)E.push("trace "+tr.layer.getLatLngs().length+" points (l'ancien point de 3 h doit être exclu)");
  if(!k.some(x=>x[0]==="a"))E.push("cercle de marge absent");if(!k.some(x=>x[0]==="r"))E.push("trait vers la destination absent");
  if(!/de la destination/.test(CARTE.mk[I.A].getPopup().getContent()))E.push("distance absente de la fenêtre");if(!/à .* de la destination/.test(document.getElementById("cm_list").innerText))E.push("distance absente de la liste");
  S.pos[I.A].acc=10;carteMarkers();if(Object.keys(CARTE.reg).some(x=>x[0]==="a"))E.push("cercle non retiré");return E.length?E.join(" ; "):true});
 await t("CD-3","position ancienne d'un livreur en mission : affichée « ancienne » ; d'un livreur libre : masquée (la position n'est partagée que pendant une course)",async()=>{const I=__setup(),E=[];S.pos[I.A].ts=new Date(Date.now()-5*60000).toISOString();S.pos[I.B]={lat:5.32,lng:-4.01,acc:10,ts:new Date(Date.now()-3*3600000).toISOString()};
  if(!await __ouvrir())return"carte";carteMarkers();if(!CARTE.mk[I.A])E.push("livreur en mission masqué");if(CARTE.mk[I.B])E.push("livreur libre ancien affiché");
  const old=document.querySelector(".mk.mission.old");if(!old)E.push("repère non marqué ancien");const lst=document.getElementById("cm_list").innerText;if(!/masquée/.test(lst))E.push("liste sans mention « masquée »");
  S.pos[I.B].ts=new Date(Date.now()-60000).toISOString();carteMarkers();if(!CARTE.mk[I.B])E.push("livreur libre récent masqué");return E.length?E.join(" ; "):true});
 await t("CD-4","compteur « Missions sans GPS récent » : ne compte que les livreurs en mission (un livreur libre sans position n'est plus une alerte)",async()=>{const I=__setup(),E=[];if(!await __ouvrir())return"carte";const kp=()=>(document.getElementById("cm_kpi").innerText.match(/(\d+)\s*Missions sans GPS récent/)||[])[1];
  if(kp()!=="0")E.push("faux positif avec livreurs libres sans position : "+kp());delete S.pos[I.A];carteTick();if(kp()!=="1")E.push("mission sans position non comptée : "+kp());S.pos[I.A]={lat:5.3,lng:-4,acc:9,ts:new Date().toISOString()};carteTick();if(kp()!=="0")E.push("après retour du GPS : "+kp());return E.length?E.join(" ; "):true});
 await t("CD-5","événement de position reçu par la passerelle : la carte n'est pas reconstruite (même instance), repère et compteurs mis à jour",async()=>{const I=__setup(),E=[];if(!await __ouvrir())return"carte";carteMarkers();const map=CARTE.map,m=CARTE.mk[I.A];m.openPopup();
  const lvA=S.livreurs.find(x=>x.id===I.A);lvA.user_id=lvA.user_id||S.users.find(u=>u.role==="livreur").id;const r=passAppliquer({type:"position",livraison_ref:I.l,livreur_ref:I.A,donnees:{lat:5.31,lng:-4.0,precision:8}});if(r)E.push("événement refusé : "+r);
  carteTick();if(CARTE.map!==map)E.push("carte reconstruite");if(!(CARTE.mk[I.A].getLatLng().lat>5.309))E.push("repère non déplacé");if(!CARTE.mk[I.A].isPopupOpen())E.push("fenêtre fermée");return E.length?E.join(" ; "):true});
 await t("CD-6","« Tout voir » cadre les livreurs, destinations et commandes à affecter ; filtres zone / statut : seuls les livreurs concernés restent",async()=>{const I=__setup(),E=[];if(!await __ouvrir())return"carte";carteMarkers();carteFit();const z=CARTE.map.getZoom();if(!(z>=1))E.push("zoom");
  ui.cs="libre";render();await __wait(500);carteMarkers();if(CARTE.mk[I.A])E.push("livreur en mission affiché sous le filtre « libres »");ui.cs="";ui.cz="";render();await __wait(300);return E.length?E.join(" ; "):true});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
