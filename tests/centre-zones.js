/* Centre de livraison : filtre par zone (commandes à affecter, courses actives, tournées) et création d'une tournée par zone.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/centre-zones.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:1000}}),p=await ctx.newPage(),errs=[];
 p.on("pageerror",e=>errs.push("PAGEERR "+e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/distribution.html");await p.waitForTimeout(300);
 await p.evaluate(()=>{window.__T=[];toast=(m,k)=>{__T.push(m)};window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};window.__last=()=>__T[__T.length-1]||"";
  window.__Z=i=>S.config.zones[i].nom;
  /* commande prête dans la zone donnée */
  window.__pr=zn=>{__as("admin");const cl=S.clients.find(c=>!c.vendeur_id&&!c.divers&&c.adresses.length),pr=S.produits.find(x=>x.actif&&x.stock>=50),ad=Object.assign({},cl.adresses[0],{zone:zn,quartier:"Q-"+zn});
   const c=creerCmd({client_id:cl.id,adr:ad,lignes:[{produit_id:pr.id,qte:1,pu:pr.prix}],frais:1000,remise:0,paiement:"livraison",mode:"Espèces",priorite:"normale",canal:"T",obs:"",confirmer:true});setStatut(c,"preparation");setStatut(c,"prete");return c};
  window.__ch=(el,v)=>{el.value=v;el.dispatchEvent(new Event("change",{bubbles:true}))}});
 let ok=0,ko=0;const t=async(id,label,fn)=>{let r;try{r=await p.evaluate(fn)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",r)}};

 await t("CZ-1","barre de zones : « Toutes » et une pastille par zone avec les effectifs ; choisir une zone filtre les commandes à affecter, les courses actives et les tournées ; « Toutes » rétablit",()=>{__as("admin");ui.fz="";const A=__Z(0),B=__Z(1);const a1=__pr(A),a2=__pr(A),b1=__pr(B);
  let h=VIEWS.livraisons();const E=[];if(!/fzSet/.test(h)||!/Toutes \(/.test(h)||!h.includes(">"+A+" (")||!h.includes(">"+B+" ("))E.push("pastilles");
  ACT.fzSet(A);h=VIEWS.livraisons();const rows=n=>(h.match(new RegExp(n,"g"))||[]).length;if(!h.includes(a1.numero)||!h.includes(a2.numero)||h.includes(b1.numero))E.push("à affecter filtré");if(!/À affecter \(\d+ · zone/.test(h))E.push("titre zone");
  ACT.fzSet(B);h=VIEWS.livraisons();if(h.includes(a1.numero)||!h.includes(b1.numero))E.push("zone B");ACT.fzSet("");h=VIEWS.livraisons();if(!h.includes(a1.numero)||!h.includes(b1.numero))E.push("toutes zones");
  if(/data-f="fz"/.test(h))E.push("ancien filtre en double");if(!/data-f="fl"/.test(h))E.push("filtre livreur perdu");return E.length?E.join(" ; "):true});
 await t("CZ-2","courses actives : seules celles de la zone ; tournées : seules celles qui ont un arrêt dans la zone, colonne « Zones »",()=>{__as("admin");ui.fz="";const A=__Z(0),B=__Z(1),E=[];const lv=S.livreurs[0];
  const x=__pr(A),y=__pr(A),z=__pr(B),w=__pr(B);const t1=creerTournee(lv.id,[x.id,y.id]);const lv2=S.livreurs[1];const t2=creerTournee(lv2.id,[z.id,w.id]);if(!t1||!t2)return"tournées non créées "+__last();
  ACT.fzSet(A);let h=VIEWS.livraisons();if(!h.includes(t1.numero)||h.includes(t2.numero))E.push("tournées zone A");if(!h.includes(x.numero)||h.includes(z.numero))E.push("courses zone A");
  ACT.fzSet(B);h=VIEWS.livraisons();if(h.includes(t1.numero)||!h.includes(t2.numero))E.push("tournées zone B");if(!/<th>Zones<\/th>/.test(h)||!new RegExp(">"+B+"<").test(h)&&!h.includes(B))E.push("colonne zones");
  ACT.fzSet("");h=VIEWS.livraisons();if(!h.includes(t1.numero)||!h.includes(t2.numero))E.push("toutes");return E.length?E.join(" ; "):true});
 await t("CZ-3","créer une tournée : filtre de zone dans la fenêtre (défaut = zone filtrée), les commandes hors zone sont masquées et décochées, livreurs de la zone en tête",()=>{__as("admin");ui.fz=__Z(0);const A=__Z(0),B=__Z(1),E=[];const a=__pr(A),b2=__pr(B);
  ACT.newTour();const sel=document.getElementById("tm_z");if(!sel||sel.value!==A)return"filtre absent ou zone par défaut "+(sel&&sel.value);
  const rows=[...document.querySelectorAll("#mf .tmrow")],vis=rows.filter(r=>r.style.display!=="none");if(!vis.length||vis.some(r=>r.dataset.z!==A))E.push("lignes visibles hors zone");if(!rows.some(r=>r.dataset.z===B&&r.style.display==="none"))E.push("zone B non masquée");
  document.querySelectorAll('#mf input[type=checkbox]').forEach(k=>k.checked=true);__ch(sel,B);const still=[...document.querySelectorAll("#mf .tmrow")].filter(r=>r.dataset.z===A&&r.querySelector("input").checked).length;if(still)E.push("décochage des lignes masquées "+still);
  __ch(sel,"");if([...document.querySelectorAll("#mf .tmrow")].some(r=>r.style.display==="none"))E.push("toutes les zones");closeModal&&0;return E.length?E.join(" ; "):true});
 await t("CZ-4","« Tout cocher dans cette zone » ne coche que les commandes visibles ; la tournée créée ne contient que celles-ci",()=>{__as("admin");ui.fz="";const A=__Z(0),B=__Z(1),E=[];const a1=__pr(A),a2=__pr(A),b1=__pr(B);
  ACT.newTour();const sel=document.getElementById("tm_z");__ch(sel,A);ACT.tmAll();const chk=[...document.querySelectorAll("#mf .tmrow")].filter(r=>r.querySelector("input").checked);if(!chk.length||chk.some(r=>r.dataset.z!==A))E.push("cases cochées hors zone");
  const lv=S.livreurs.find(l=>l.statut==="disponible")||S.livreurs[0];document.querySelector('#mf [name="lid"]').value=lv.id;const n0=S.tournees.length;[...document.querySelectorAll("button")].find(x=>/Créer et affecter/.test(x.textContent)).click();
  const tt=S.tournees[S.tournees.length-1];if(S.tournees.length!==n0+1)return"tournée non créée "+__last();const zs=[...new Set(stopsOf(tt).map(l=>cmd(l.commande_id).adr.zone))];if(zs.length!==1||zs[0]!==A)E.push("zones de la tournée "+zs);if(b1.statut!=="prete")E.push("commande de l'autre zone touchée");return E.length?E.join(" ; "):true});
 await t("CZ-5","la zone choisie est conservée entre les écrans et un filtre sans résultat l'indique",()=>{__as("admin");ui.fz="Zone inexistante";const h=VIEWS.livraisons(),E=[];if(!/Aucune commande en attente d'affectation/.test(h)||!/Aucune course active/.test(h)||!/Aucune tournée dans cette zone/.test(h))E.push("messages");ui.fz="";return E.length?E.join(" ; "):true});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
