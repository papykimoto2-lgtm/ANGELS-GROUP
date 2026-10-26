/* Espace « Centre de livraison » installable (?app=centre) : manifeste et icônes, accès réservé au personnel, accueil par tâches, navigation dédiée, barre d'onglets mobile, affectation et collectes, application complète intacte.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/centre-app.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});let ok=0,ko=0;const errs=[];
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info===undefined?o:info));o===true?ok++:ko++};
 const ouvrir=async(url,w)=>{const ctx=await b.newContext({viewport:{width:w||400,height:850},isMobile:(w||400)<600,hasTouch:(w||400)<600});const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));await p.goto(base+url);await p.waitForTimeout(700);await p.evaluate(()=>{window.__T=[];toast=m=>{__T.push(m)}});return{ctx,p}};
 const entrer=(p,role)=>p.evaluate(r=>{ME=S.users.find(u=>u.role===r&&u.actif);view="dashboard";render();return ME&&ME.nom},role);
 // 1. en-tête : manifeste, titre, thème
 let {ctx,p}=await ouvrir("/distribution.html?app=centre");
 let r=await p.evaluate(()=>({m:document.querySelector("link[rel=manifest]").getAttribute("href"),t:document.title,tc:document.querySelector("meta[name=theme-color]").content,a:document.querySelector("meta[name=apple-mobile-web-app-title]").content,ic:document.querySelector("link[rel=apple-touch-icon]").getAttribute("href"),th:document.documentElement.dataset.theme}));
 chk("CE-1","?app=centre : manifeste, titre, couleur et icône dédiés, thème vert",r.m==="manifest-centre.webmanifest"&&/Centre de livraison/.test(r.t)&&r.tc==="#059669"&&r.a==="Centre livraison"&&r.ic==="icons/centre-apple-180.png"&&r.th==="emeraude",JSON.stringify(r));
 // 2. manifeste et icônes installables
 const man=JSON.parse(fs.readFileSync(path.join(root,"manifest-centre.webmanifest"),"utf8"));
 const ics=man.icons.map(i=>i.src),okIc=ics.every(s=>fs.existsSync(path.join(root,s)))&&ics.length===3&&man.icons.some(i=>i.purpose==="maskable"&&i.sizes==="512x512");
 chk("CE-2","manifeste installable : nom, start_url ?app=centre, scope, mode application, icônes 192/512/maskable présentes, raccourcis",/Centre de livraison/.test(man.name)&&/app=centre/.test(man.start_url)&&man.scope==="./"&&man.display==="standalone"&&okIc&&(man.shortcuts||[]).length===2&&!man.share_target,JSON.stringify(man.icons));
 const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8"),vc=JSON.parse(fs.readFileSync(path.join(root,"vercel.json"),"utf8"));
 chk("CE-3","hors ligne : manifeste et icônes dans le cache du service worker ; adresse courte /centre redirigée vers l'application",sw.includes("manifest-centre.webmanifest")&&sw.includes("icons/centre-512.png")&&sw.includes("icons/centre-maskable-512.png")&&vc.rewrites.some(x=>x.source==="/centre"&&x.destination==="/distribution.html"));
 // 3. écran de connexion
 r=await p.evaluate(()=>({hero:document.querySelector(".hero-l h1").textContent,cnx:document.querySelector(".hero-r").innerText,cartes:[...document.querySelectorAll(".pcard")].map(c=>c.innerText.split("\n")[0]).join("|"),inst:!!document.querySelector(".inst")}));
 chk("CE-4","connexion : titre « Centre de livraison », « Connexion du centre », cartes de démonstration réservées au personnel du centre, zone d'installation",r.hero==="Centre de livraison"&&/Connexion du centre/.test(r.cnx)&&r.cartes.split("|").length>=1&&!/Vendeur|Livreur/i.test(r.cartes)&&r.inst,JSON.stringify(r));
 // 4. refus des profils hors centre
 for(const [role,id] of [["vendeur","a"],["livreur","b"]]){
  await p.evaluate(rl=>{const u=S.users.find(x=>x.role===rl&&x.actif);if(!u)return;const f=document.getElementById("lf");const o=document.createElement("option");o.value=u.id;f.u.appendChild(o);f.u.value=u.id;(f.p||f.pin).value=ANGELS_AUTH.DEMO_MDP;f.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}))},role);await p.waitForTimeout(300);
  const m=await p.evaluate(()=>({t:__T.join("|"),me:!!ME}));
  chk("CE-5"+id,"profil « "+role+" » absent de la liste de connexion et refusé s'il force la saisie",/réservé au personnel du centre/.test(m.t)&&!m.me,JSON.stringify(m));await p.evaluate(()=>{__T.length=0})}
 // 5. superviseur : accueil, navigation dédiée
 await entrer(p,"superviseur");
 r=await p.evaluate(()=>{const mods=[...document.querySelectorAll(".navp a[data-mod]")].map(a=>a.textContent.replace(/\d+$/,"").trim());return{view,mods,h1:document.querySelector(".auj h1").textContent,barre:[...document.querySelectorAll(".btab button")].map(x=>x.innerText.replace(/\s+/g," ").trim()),burger:!!document.querySelector(".burger")}});
 chk("CE-6","superviseur : ouvre sur l'accueil du centre ; menu limité à Accueil, Affecter & suivre, Collectes, Pilotage, Commandes, Livreurs (Réglages réservés à l'administrateur ; ni Argent, ni RH, ni Stock)",r.view==="centre"&&r.mods.length===6&&/Accueil/.test(r.mods[0])&&!r.mods.some(m=>/Argent|Administration|Stock|Documents/.test(m)),JSON.stringify(r));
 chk("CE-7","mobile : barre d'onglets en bas (Accueil, Affecter, Tour, Collectes, Menu) visible",r.barre.length===5&&/Accueil/.test(r.barre[0])&&/Affecter/.test(r.barre[1])&&/Tour/.test(r.barre[2])&&/Collectes/.test(r.barre[3])&&/Menu/.test(r.barre[4]),JSON.stringify(r.barre));
 const vis=await p.evaluate(()=>{const e=document.querySelector(".btab"),c=getComputedStyle(e),b=e.getBoundingClientRect();return{d:c.display,pos:c.position,bas:Math.round(innerHeight-b.bottom)}});
 chk("CE-8","la barre d'onglets est collée en bas de l'écran du téléphone",vis.d==="flex"&&vis.pos==="fixed"&&vis.bas===0,JSON.stringify(vis));
 r=await p.evaluate(()=>{const b=document.createElement("button");b.id="aa-sync";b.textContent="☁ Synchronisé";b.style.cssText="position:fixed;left:10px;bottom:10px;z-index:9000;padding:5px 11px";document.body.appendChild(b);const x=b.getBoundingClientRect(),y=document.querySelector(".btab").getBoundingClientRect();b.remove();return{pill:x.bottom,bar:y.top}});
 chk("CE-8b","la pastille « Synchronisé » ne recouvre pas la barre d'onglets (elle passe au-dessus)",r.pill<=r.bar,JSON.stringify(r));
 // 6. accueil par tâches : chiffres cohérents avec les données
 r=await p.evaluate(()=>{const D=centreDonnees(),t=[...document.querySelectorAll(".cartes .carte")].map(c=>c.querySelector("b").textContent);return{t,att:[D.prete.length,D.act.length,D.aColl,D.aRecep.length,D.trt].map(String),aff:document.querySelectorAll('.cgrid [data-act="assign"]').length,nprete:Math.min(6,D.prete.length)}});
 chk("CE-9","accueil : 5 cartes (à affecter, en cours, collectes à planifier, à réceptionner, à traiter) avec les bons chiffres ; un bouton « Affecter » par commande prête (6 au plus)",JSON.stringify(r.t)===JSON.stringify(r.att)&&r.aff===r.nprete,JSON.stringify(r));
 await p.screenshot({path:(process.env.SHOT||"/tmp")+"/centre-accueil-mobile.png"});
 // 7. affecter depuis l'accueil
 const nb=await p.evaluate(()=>centreDonnees().prete.length);
 if(nb){await p.click('.cgrid [data-act="assign"]');await p.waitForTimeout(250);const m=await p.evaluate(()=>document.querySelector("#modal")?document.querySelector("#modal").innerText:document.body.innerText);chk("CE-10","« Affecter » depuis l'accueil ouvre le choix du livreur",/livreur/i.test(m),m.slice(0,120));await p.evaluate(()=>closeModal())}
 else chk("CE-10","« Affecter » depuis l'accueil (aucune commande prête dans les données de démonstration)",true);
 // 8. carte → répartition ; onglet Collectes
 await p.click('.btab [data-id="livraisons"]');await p.waitForTimeout(250);
 r=await p.evaluate(()=>({view,t:document.querySelector(".cdl h1").textContent,on:document.querySelector(".btab button.on").innerText.replace(/\s+/g," ").trim()}));
 chk("CE-11","onglet « Affecter » : Centre de livraison (répartition) ; l'onglet est mis en évidence",r.view==="livraisons"&&/Centre de livraison/.test(r.t)&&/Affecter/.test(r.on),JSON.stringify(r));
 await p.click('.btab [data-id="collectes"]');await p.waitForTimeout(250);
 r=await p.evaluate(()=>({view,h:document.querySelector(".cdl h1").textContent,txt:document.querySelector("main").innerText}));
 chk("CE-12","onglet « Collectes » : à planifier chez les vendeurs, collectes en cours, réception au dépôt",r.view==="collectes"&&/Collectes vendeurs/.test(r.h)&&/Collectes chez les vendeurs/.test(r.txt),r.txt.slice(0,160));
 await p.screenshot({path:(process.env.SHOT||"/tmp")+"/centre-collectes-mobile.png"});
 // 9. planifier une collecte depuis l'espace
 const vp=await p.evaluate(()=>{const v=S.vendeurs.find(v=>aCollecter(v.id).length);return v?v.id:null});
 if(vp){await p.evaluate(id=>ACT.colPlan(id),vp);await p.waitForTimeout(200);const m=await p.evaluate(()=>document.querySelector("#modal").innerText);chk("CE-13","planifier une collecte : fenêtre avec commandes, livreur, créneau et adresse",/Planifier la collecte/.test(m)&&/Livreur/.test(m),m.slice(0,120));await p.evaluate(()=>closeModal())}
 else chk("CE-13","planifier une collecte (aucun vendeur avec commande confirmée dans la démo)",true);
 // 10. préparateur : pas d'affectation, réception possible
 await entrer(p,"préparateur".replace("é","e").replace("é","e"));
 r=await p.evaluate(()=>({view,aff:document.querySelectorAll('[data-act="assign"]').length,mods:[...document.querySelectorAll(".navp a[data-mod]")].map(a=>a.textContent.replace(/\d+$/,"").trim())}));
 chk("CE-14","préparateur : accueil du centre sans bouton « Affecter » ; menu limité à ses écrans",r.view==="centre"&&r.aff===0&&!r.mods.some(m=>/Argent|Réglages|Livreurs/.test(m)),JSON.stringify(r));
 // 11. caissier : aucun accès au centre
 await entrer(p,"caissier");
 r=await p.evaluate(()=>document.querySelector("#app").innerText);
 chk("CE-15","caissier : aucun écran du centre → message d'accès",/n'a accès à aucun écran/.test(r),r.slice(0,100));
 // 12. lien direct ?go=affecter
 await ctx.close();
 ({ctx,p}=await ouvrir("/distribution.html?app=centre&go=collectes"));await p.evaluate(()=>{ME=S.users.find(u=>u.role==="superviseur"&&u.actif);render()});
 r=await p.evaluate(()=>view);chk("CE-16","raccourci d'icône ?go=collectes : ouvre directement les collectes",r==="collectes",r);await ctx.close();
 ({ctx,p}=await ouvrir("/distribution.html?app=centre&go=affecter"));await p.evaluate(()=>{ME=S.users.find(u=>u.role==="superviseur"&&u.actif);render()});
 r=await p.evaluate(()=>view+"|"+ui.cdt);chk("CE-17","raccourci d'icône ?go=affecter : ouvre la répartition",r==="livraisons|rep",r);await ctx.close();
 // 13. grand écran : menu latéral, pas de barre du bas
 ({ctx,p}=await ouvrir("/distribution.html?app=centre",1280));await p.evaluate(()=>{ME=S.users.find(u=>u.role==="admin"&&u.actif);render()});
 r=await p.evaluate(()=>({bar:getComputedStyle(document.querySelector(".btab")).display,aside:getComputedStyle(document.querySelector("aside")).position,h:document.querySelector(".auj h1").textContent}));
 chk("CE-18","ordinateur : menu latéral et accueil, la barre d'onglets du téléphone est masquée",r.bar==="none"&&r.aside!=="fixed"&&/Bon/.test(r.h),JSON.stringify(r));
 await p.screenshot({path:(process.env.SHOT||"/tmp")+"/centre-accueil-bureau.png"});await ctx.close();
 // 14. application complète inchangée
 ({ctx,p}=await ouvrir("/distribution.html"));await p.evaluate(()=>{ME=S.users.find(u=>u.role==="admin"&&u.actif);view="dashboard";render()});
 r=await p.evaluate(()=>({m:document.querySelector("link[rel=manifest]").getAttribute("href"),centre:NAV.filter(voirNav).some(n=>n.v==="centre"||n.v==="collectes"),barre:!!document.querySelector(".btab"),mods:[...document.querySelectorAll(".navp a[data-mod]")].length,t:document.title}));
 chk("CE-19","application complète : manifeste d'origine, aucun écran ni barre du centre, 8 modules",r.m!=="manifest-centre.webmanifest"&&!r.centre&&!r.barre&&r.mods===8&&!/Centre de livraison —/.test(r.t),JSON.stringify(r));await ctx.close();
 chk("CE-20","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
