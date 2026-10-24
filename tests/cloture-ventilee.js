/* Clôture de tournée : distinction marchandise / frais de livraison dans le bureau, la fiche et l'appli livreur.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/cloture-ventilee.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),p=await ctx.newPage(),errs=[];
 p.on("pageerror",e=>errs.push("PAGEERR "+e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/distribution.html");await p.waitForTimeout(300);
 await p.evaluate(()=>{window.__T=[];toast=m=>{__T.push(m)};window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};
  const l=S.livreurs.find(x=>S.livraisons.some(y=>y.livreur_id===x.id&&y.statut==="livree"&&S.fonds.some(f=>f.livraison_id===y.id&&f.type==="encaissement")))||S.livreurs[0];window.__L=l.id;
  S.livraisons.filter(y=>y.livreur_id===l.id&&isActive(y)).forEach(y=>y.statut="livree");S.clotures=[];S.versements=[];S.caisses=[];S.fonds=S.fonds.filter(f=>!(f.type==="reversement"&&f.livreur_id===l.id));window.__P=[];ANGELS_PRINT.ouvrir=x=>{__P.push(x);return Promise.resolve({})};
  window.__txt=h=>{const d=document.createElement("div");d.innerHTML=h;return d.textContent}});
 let ok=0,ko=0;const t=async(id,label,fn)=>{let r;try{r=await p.evaluate(fn)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",r)}};
 await t("CV-1","récapitulatif : marchandise + frais = collecté, frais > 0",()=>{const r=clotRecap(__L);return r.frais>0&&r.produits>0&&r.produits+r.frais===r.collecte?true:JSON.stringify({p:r.produits,f:r.frais,c:r.collecte})});
 await t("CV-2","panneau « Ma tournée » du livreur : marchandise et frais séparés",()=>{const r=clotRecap(__L),h=__txt(clotPanel(liv(__L)));return h.includes("Marchandise")&&h.includes("Frais de livraison")&&h.includes(fcfa(r.produits))&&h.includes(fcfa(r.frais))?true:h});
 await t("CV-3","onglet Clôtures : colonnes Marchandise et Frais de livraison",()=>{__as("caissier");view="finance";ui.fin="clot";render();const tx=document.querySelector("main").innerText,r=clotRecap(__L);return /Marchandise/.test(tx)&&/Frais de livraison/.test(tx)&&tx.includes(fcfa(r.produits))&&tx.includes(fcfa(r.frais))?true:tx.slice(0,400)});
 await t("CV-4","formulaire du caissier : détail marchandise + frais",()=>{__as("caissier");clotFormUI(__L);const tx=document.getElementById("mf").innerText,r=clotRecap(__L);return tx.includes("marchandise "+fcfa(r.produits))&&tx.includes("frais "+fcfa(r.frais))?true:tx.slice(0,300)});
 await t("CV-5","passerelle : le payload de clôture publie produits et frais",()=>{const c=passPayloadLivreur(liv(__L),Date.now(),0).argent.cloture,r=clotRecap(__L);return c.produits===r.produits&&c.frais===r.frais&&c.produits+c.frais===c.collecte?true:JSON.stringify(c)});
 await t("CV-6","fiche signée : lignes marchandise et frais, enregistrées dans la clôture",async()=>{__as("caissier");clotFormUI(__L);const f=document.getElementById("mf"),r=clotRecap(__L);f.m.value=r.du;f.ok.checked=true;f.mode.value="Espèces";f.requestSubmit();await new Promise(x=>setTimeout(x,250));const c=clotDerniere(__L);if(!c)return"pas de clôture";if(c.produits!==r.produits||c.frais!==r.frais)return JSON.stringify({p:c.produits,f:c.frais});__P.length=0;clotFiche(c.id);const x=__P[0];return x&&/Marchandise collectée/.test(x.corps)&&/Frais de livraison collectés/.test(x.corps)?true:"fiche"});
 await t("CV-8","clôtures antérieures sans montants enregistrés : détail reconstitué dans l'onglet et sur la fiche",()=>{const c=clotDerniere(__L),r0={p:c.produits,f:c.frais};delete c.produits;delete c.frais;const v=clotVent(c);__as("caissier");view="finance";ui.fin="clot";render();const tx=document.querySelector("main").innerText;__P.length=0;clotFiche(c.id);const x=__P[0];c.produits=r0.p;c.frais=r0.f;return v.produits===r0.p&&v.frais===r0.f&&tx.includes(fcfa(r0.p))&&tx.includes(fcfa(r0.f))&&x&&x.corps.includes(fcfa(r0.f))?true:JSON.stringify([v,r0])});
 await t("CV-9","onglet « Clôtures effectuées » : colonnes Marchandise et Frais de livraison",()=>{const h=[...document.querySelectorAll("main h2")].find(e=>/effectuées/.test(e.textContent));const th=h&&h.nextElementSibling&&h.nextElementSibling.innerText;return /Marchandise/.test(th||"")&&/Frais de livraison/.test(th||"")?true:th});
 const pl=await p.evaluate(()=>passPayloadLivreur(liv(__L),Date.now(),0).argent);
 const q=await ctx.newPage();q.on("pageerror",e=>errs.push("LIV "+e.message));await q.goto(base+"/livreur.html");await q.waitForTimeout(500);
 const arg=Object.assign({},pl,{cloture:{nb:2,collecte:60000,produits:56500,frais:3500,gardes:0,direct:0,du:60000,attente:0,actives:0,demande:null,derniere:null}});
 const h=await q.evaluate(a=>{user={id:"u"};moi={nom:"L",livreur_ref:"l1"};STATS={maj_le:new Date().toISOString(),payload:{argent:a}};const d=document.createElement("div");d.innerHTML=cloturePanel();return d.textContent},arg);
 const e=(id,label,v,i)=>{if(v){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",i)}};
 e("CV-7","appli livreur : carte de clôture avec marchandise 56 500 F et frais 3 500 F",/Marchandise[^0-9]*56[\s  ]500/.test(h)&&/Frais de livraison[^0-9]*3[\s  ]500/.test(h),h);
 console.log(errs.length?errs.join("\n"):"");console.log(`RÉSULTAT : ${ok} réussis, ${ko} échecs`);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
