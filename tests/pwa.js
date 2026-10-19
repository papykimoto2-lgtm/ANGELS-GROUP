/* Contrôle PWA : manifestes, icônes, service worker, installabilité, usage hors ligne.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/pwa.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json",".json":"application/json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
 const ctx=await b.newContext({viewport:{width:420,height:800}}),p=await ctx.newPage();let ok=0,ko=0;const errs=[];
 p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());
 const t=(id,label,r)=>{if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",r)}};
 const APPS=[["hub","index.html","manifest-hub.webmanifest"],["transport","transport.html","manifest-transport.webmanifest"],["agro","agro.html","manifest-agro.webmanifest"],["livraison","distribution.html","manifest.webmanifest"]];
 for(const[app,page,man] of APPS){
  const m=await (await p.request.get(base+"/"+man)).json();const bad=[];
  ["name","short_name","start_url","scope","display","icons","theme_color","background_color"].forEach(k=>{if(!m[k])bad.push("manque "+k)});
  if(m.display!=="standalone")bad.push("display");const sizes=(m.icons||[]).map(i=>i.sizes);if(!sizes.includes("192x192")||!sizes.includes("512x512"))bad.push("tailles");if(!(m.icons||[]).some(i=>i.purpose==="maskable"))bad.push("maskable");
  for(const i of m.icons||[]){const r=await p.request.get(base+"/"+i.src);if(r.status()!==200)bad.push("icône "+i.src+" "+r.status())}
  const r2=await p.request.get(base+"/"+m.start_url.replace("./",""));if(r2.status()!==200)bad.push("start_url "+r2.status());
  t("PWA-"+app+"-1","manifeste complet, icônes présentes, start_url valide",bad.length?bad.join(", "):true);
 }
 // installabilité (CDP) et service worker
 for(const[app,page] of APPS){
  const pg=await ctx.newPage();await pg.goto(base+"/"+page);await pg.evaluate(()=>navigator.serviceWorker.ready);await pg.waitForTimeout(400);
  const cdp=await ctx.newCDPSession(pg);const r=await cdp.send("Page.getInstallabilityErrors");const er=r.installabilityErrors.map(e=>e.errorId).filter(x=>x!=="in-incognito"); // le contexte de test est « incognito » : seule erreur attendue
  t("PWA-"+app+"-2","aucune erreur d'installabilité (Chromium)",er.length===0?true:JSON.stringify(er));
  const mf=await pg.evaluate(()=>document.querySelector('link[rel=manifest]')?.getAttribute("href"));t("PWA-"+app+"-3","lien vers le manifeste de l'application",mf?true:"absent");
  await pg.close();
 }
 const keys=await p.goto(base+"/index.html").then(()=>p.evaluate(async()=>{await navigator.serviceWorker.ready;const ks=await caches.keys(),c=await caches.open(ks.find(k=>k.startsWith("angels-v"))),r=await c.keys();return r.map(x=>new URL(x.url).pathname)}));
 const need=["/index.html","/parametres.html","/transport.html","/agro.html","/distribution.html","/icons/agro-512.png","/icons/transport-512.png","/manifest-agro.webmanifest"];
 t("PWA-4","coque mise en cache à l'installation du service worker",need.every(x=>keys.includes(x))?true:"manquants : "+need.filter(x=>!keys.includes(x)));
 // hors ligne : chaque page se recharge, la navigation du hub vers les apps fonctionne
 const off=[];
 for(const[app,page] of APPS){const pg=await ctx.newPage();await pg.goto(base+"/"+page);await pg.evaluate(()=>navigator.serviceWorker.ready);await pg.waitForTimeout(300);await ctx.setOffline(true);
  try{await pg.reload();const h=await pg.evaluate(()=>document.body.innerText.length);if(h<50)off.push(app+" vide")}catch(e){off.push(app+" : "+e.message.slice(0,60))}await ctx.setOffline(false);await pg.close()}
 t("PWA-5","les quatre pages s'ouvrent hors ligne",off.length?off.join(" | "):true);
 await p.goto(base+"/index.html");await p.evaluate(()=>navigator.serviceWorker.ready);await ctx.setOffline(true);
 let nav=true;try{await p.click('a[href="transport.html"]');await p.waitForLoadState("domcontentloaded");nav=(await p.title()).includes("Transport")||("titre: "+await p.title())}catch(e){nav=e.message.slice(0,80)}
 t("PWA-6","navigation hub → Transport hors ligne",nav);
 // fonctionnement de l'app hors ligne : connexion + saisie
 let fonc=true;try{await p.waitForSelector("#lf",{state:"attached"});await p.evaluate(()=>{const d=document.querySelector("#lf").closest("details");if(d)d.open=true});const o=await p.$$eval('select[name=u] option',a=>a.map(x=>[x.value,x.textContent]));await p.selectOption('select[name=u]',o.find(x=>x[1].startsWith("Caissier"))[0]);await p.fill('input[name=p]',"Demo@Angels2026");await p.click("#lf button:not(.aa-e)");await p.waitForSelector("main h1");
  const bar=await p.$eval("#pwaBar",e=>e.textContent).catch(()=>"");if(!/hors ligne/i.test(bar))fonc="bandeau hors ligne absent"}catch(e){fonc=e.message.slice(0,80)}
 t("PWA-7","Transport utilisable hors ligne avec bandeau « Mode hors ligne »",fonc);await ctx.setOffline(false);
 // bouton d'installation
 const pg=await ctx.newPage();await pg.goto(base+"/agro.html");await pg.waitForSelector("#lf",{state:"attached"});
 await pg.evaluate(()=>{const e=new Event("beforeinstallprompt");e.prompt=()=>{window.__prompted=true};e.userChoice=Promise.resolve({outcome:"accepted"});window.dispatchEvent(e)});await pg.waitForTimeout(150);
 const btn=await pg.$('[data-a="pwa.inst"]');let ins=btn?true:"bouton absent";if(btn){await btn.click();await pg.waitForTimeout(150);if(!(await pg.evaluate(()=>window.__prompted)))ins="prompt() non appelé"}
 t("PWA-8","bouton « Installer l'application » (Agro) déclenche l'invite d'installation",ins);
 // l'ancien défaut : une navigation ne doit pas écraser la page d'accueil en cache
 const idx=await p.evaluate(async()=>{const ks=await caches.keys(),c=await caches.open(ks.find(k=>k.startsWith("angels-v")));const a=await c.match("distribution.html"),h=await c.match("agro.html");return[(await a.text()).includes("ANGEL'S GROUP ERP"),(await h.text()).includes("ANGEL'S AGRO")]});
 t("PWA-9","chaque page garde sa propre entrée de cache",idx[0]&&idx[1]?true:JSON.stringify(idx));
 // Espace vendeur installable (Livraison ?app=vendeur)
 {const m=await (await p.request.get(base+"/manifest-vendeur.webmanifest")).json(),bad=[];
  ["name","short_name","start_url","scope","display","icons","theme_color","background_color","id"].forEach(k=>{if(!m[k])bad.push("manque "+k)});
  if(m.display!=="standalone")bad.push("display");if(!/app=vendeur/.test(m.start_url))bad.push("start_url");if(!(m.icons||[]).some(i=>i.purpose==="maskable"))bad.push("maskable");
  for(const i of m.icons||[]){const r=await p.request.get(base+"/"+i.src);if(r.status()!==200)bad.push("icône "+i.src)}
  t("PWA-V1","manifeste de l'espace vendeur complet (id propre, start_url ?app=vendeur, icônes)",bad.length?bad.join(", "):true);
  const vj=JSON.parse(fs.readFileSync(path.join(root,"vercel.json"),"utf8"));t("PWA-V2","adresse courte /vendeur → Livraison",(vj.rewrites||[]).some(r=>r.source==="/vendeur"&&/distribution/.test(r.destination))?true:"rewrite absent");
  const vp=await ctx.newPage();await vp.goto(base+"/distribution.html?app=vendeur");await vp.evaluate(()=>navigator.serviceWorker.ready);await vp.waitForTimeout(500);
  const info=await vp.evaluate(()=>({man:document.querySelector("link[rel=manifest]").getAttribute("href"),titre:document.title,cartes:[...document.querySelectorAll(".pcard")].map(x=>x.innerText),opts:[...document.querySelectorAll("#lf [name=u] option")].map(o=>o.textContent)}));
  t("PWA-V3","?app=vendeur : manifeste, titre dédiés",info.man==="manifest-vendeur.webmanifest"&&/vendeur/i.test(info.titre)?true:JSON.stringify(info));
  t("PWA-V4","connexion limitée aux vendeurs (aucun profil admin/livreur proposé)",info.cartes.length===1&&info.opts.length>=1&&info.opts.every(o=>/vendeur/i.test(o))?true:JSON.stringify(info));
  const cdp=await ctx.newCDPSession(vp);const er=(await cdp.send("Page.getInstallabilityErrors")).installabilityErrors.map(e=>e.errorId).filter(x=>x!=="in-incognito");
  t("PWA-V5","l'espace vendeur est installable (Chromium)",er.length===0?true:JSON.stringify(er));
  const refus=await vp.evaluate(()=>{const u=S.users.find(x=>x.role==="admin"),f=document.getElementById("lf");f.u.innerHTML='<option value="'+u.id+'">a</option>';f.u.value=u.id;(f.pin||f.p).value="Demo@Angels2026";f.requestSubmit();return new Promise(r=>setTimeout(()=>r({me:typeof ME!=="undefined"&&ME?ME.role:null}),300))});
  t("PWA-V6","un compte non vendeur est refusé dans l'espace vendeur",refus.me===null?true:JSON.stringify(refus));
  await vp.reload();await vp.waitForSelector("#lf",{state:"attached"});
 await vp.evaluate(()=>{const u=S.users.find(x=>x.role==="vendeur"),f=document.getElementById("lf");f.u.value=u.id;(f.pin||f.p).value="Demo@Angels2026";f.requestSubmit()});await vp.waitForTimeout(1500);
  const ok2=await vp.evaluate(()=>({role:ME&&ME.role,txt:document.body.innerText.includes("Mes commandes")}));
  t("PWA-V7","le vendeur se connecte et arrive sur ses commandes",ok2.role==="vendeur"&&ok2.txt?true:JSON.stringify(ok2));
  const lien=await vp.evaluate(()=>document.body.innerText.includes("Accueil groupe"));
  t("PWA-V8","espace vendeur : pas de lien vers l'accueil du groupe",lien===false?true:"lien présent");
  await vp.close()}
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);
 await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
