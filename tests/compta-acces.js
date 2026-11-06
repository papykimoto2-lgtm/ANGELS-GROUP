/* Comptabilité du groupe : accès par utilisateur et mot de passe (administrateur, direction, comptable).
   Usage : NODE_OPTIONS="--require $PWD/tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/compta-acces.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json",".css":"text/css"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),errs=[];let ok=0,ko=0;
 const t=(id,l,r)=>{if(r===true){ok++;console.log("PASS",id,l)}else{ko++;console.log("FAIL",id,l,"→",r)}};
 const page=async u=>{const p=await ctx.newPage();p.on("pageerror",e=>errs.push(u+" : "+e.message));await p.goto(base+"/"+u);await p.waitForTimeout(600);return p};
 for(const u of ["distribution.html","transport.html","agro.html"]){const p=await page(u);await p.close()}
 const g=await page("compta-groupe.html"),txt=()=>g.evaluate(()=>document.getElementById("app").innerText);
 t("CA-1","sans connexion : écran d'accès, aucun chiffre affiché",(await g.$("#gate"))&&!/Contrôle par application/.test(await txt())?true:"données visibles");
 const opts=await g.$$eval("#gate select[name=u] option",o=>o.map(x=>x.textContent));
 t("CA-2","liste : seulement administrateur, direction, comptable",opts.length>0&&opts.every(o=>/\((admin|direction|directeur|comptable)\)$/.test(o))?true:opts.join(" | "));
 await g.fill("#gate [name=pwd]","MauvaisMotDePasse1!");await g.click("#gate button[type=submit]");await g.waitForTimeout(900);
 t("CA-3","mauvais mot de passe : refusé avec message",(await g.$("#gate"))&&/incorrect/.test(await txt())?true:"accepté");
 await g.fill("#gate [name=pwd]","Demo@Angels2026");await g.click("#gate button[type=submit]");await g.waitForTimeout(900);
 t("CA-4","bon mot de passe : comptabilité affichée",!(await g.$("#gate"))&&/Contrôle par application/.test(await txt())?true:"pas d'accès");
 t("CA-5","bandeau : utilisateur connecté et bouton Verrouiller",await g.evaluate(()=>!document.getElementById("who").hidden&&!!document.getElementById("lock"))?true:"absent");
 await g.reload();await g.waitForTimeout(600);
 t("CA-6","session conservée au rechargement de l'onglet",!(await g.$("#gate"))?true:"session perdue");
 await g.click("#lock");await g.waitForTimeout(300);
 t("CA-7","Verrouiller : retour à l'écran d'accès",(await g.$("#gate"))&&await g.evaluate(()=>document.getElementById("who").hidden)?true:"toujours ouvert");
 for(let i=0;i<5;i++){await g.fill("#gate [name=pwd]","Faux"+i+"Mot!xx");await g.click("#gate button[type=submit]");await g.waitForTimeout(700)}
 await g.fill("#gate [name=pwd]","Demo@Angels2026");await g.click("#gate button[type=submit]");await g.waitForTimeout(700);
 t("CA-8","5 échecs : blocage temporaire, même le bon mot de passe est refusé",(await g.$("#gate"))&&/patientez/.test(await txt())?true:"pas de blocage");
 await g.evaluate(()=>{sessionStorage.setItem("angels_compta_sess",JSON.stringify({nom:"x",appNom:"y",exp:Date.now()-1000}))});await g.reload();await g.waitForTimeout(500);
 t("CA-9","session expirée (30 min) : écran d'accès",(await g.$("#gate"))?true:"ouverte");
 const g2=await page("compta-groupe.html");await g2.evaluate(()=>{const s=JSON.parse(localStorage.getItem("angels_erp_v1"));s.users.forEach(u=>{if(u.role!=="livreur")u.actif=false});localStorage.setItem("angels_erp_v1",JSON.stringify(s));["angels_transport_v3","angels_agro_v1"].forEach(k=>localStorage.removeItem(k))});await g2.reload();await g2.waitForTimeout(500);
 t("CA-10","aucun compte autorisé sur l'appareil : comptabilité verrouillée, sans formulaire",!(await g2.$("#gate"))&&/verrouillée/.test(await g2.evaluate(()=>document.getElementById("app").innerText))?true:"formulaire ou données");
 t("CA-11","aucune erreur JavaScript",errs.length?errs.join(" | "):true);
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await b.close();srv.close();process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
