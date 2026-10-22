/* Instances clientes : marque, modules choisis, administrateur propre, isolation du code commun.
   Usage : NODE_OPTIONS="--require $PWD/tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/instance.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..","dist","logistica");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 require("child_process").execSync("node tools/instance.js logistica",{cwd:path.resolve(__dirname,"..")});
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),errs=[];let ok=0,ko=0;
 const t=(id,l,r)=>{if(r===true){ok++;console.log("PASS",id,l)}else{ko++;console.log("FAIL",id,l,"→",r)}};
 const page=async u=>{const p=await ctx.newPage();p.on("pageerror",e=>errs.push(u+" : "+e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/"+u);await p.waitForTimeout(500);return p};
 const lire=f=>fs.readFileSync(path.join(root,f),"utf8");
 t("INS-1","modules non choisis absents (Transport, Agro, comptabilité du groupe)",["transport.html","agro.html","compta-groupe.html","manifest-agro.webmanifest"].every(f=>!fs.existsSync(path.join(root,f)))?true:"fichiers présents");
 t("INS-2","tests, outils, serveur et documentation non publiés",["tests","tools","supabase","clients","docs","README.md"].every(f=>!fs.existsSync(path.join(root,f)))?true:"fuite");
 t("INS-3","plus aucune mention d'ANGEL'S dans les écrans (hub, distribution, CRM)",["index.html","distribution.html","crm.html","manifest-hub.webmanifest"].every(f=>!/ANGEL'S|Angel's/.test(lire(f)))?true:"marque d'origine");
 t("INS-4","service worker : nom propre, coque sans fichier absent",/const V = "logistica-/.test(lire("sw.js"))&&!/transport\.html|agro\.html|compta-groupe\.html/.test(lire("sw.js").match(/const COQUE = \[[\s\S]*?\];/)[0])?true:"sw");
 t("INS-5","aucun secret ni mot de passe en clair dans l'instance",!/Lg-|Demo@Angels2026\b.*Logistica/.test(lire("marque.js"))&&/"h":"/.test(lire("marque.js"))?true:"secret");
 const h=await page("index.html");
 const cartes=await h.$$eval(".card[data-mod]",c=>c.map(x=>x.dataset.mod).sort().join());
 t("INS-5b","modules choisis publiés : Placement, Assurance, socle d'écran, feuille de style aux couleurs LOGISTICA",["placement.html","placement-engine.js","assurance.html","assurance-engine.js","shell-engine.js","modules.css"].every(f=>fs.existsSync(path.join(root,f)))&&/#c8352b/i.test(lire("modules.css"))&&!/#0e7490/i.test(lire("modules.css"))?true:"manquant");
 t("INS-5c","isolation : la passerelle pointe vers le projet Supabase de LOGISTICA, jamais celui d'ANGEL'S",/hggfwxkmdylrgikokbaw/.test(lire("passerelle-config.js"))&&!/gfzqxoolorbejxnxrlji/.test(Object.keys({a:1}).length?fs.readdirSync(root).filter(f=>/\.(html|js|json|webmanifest)$/.test(f)).map(lire).join(""):"")&&!/angelsgroups/.test(lire("portail.html"))?true:"fuite vers ANGEL'S");
 t("INS-6","hub : seules les cartes choisies (Distribution, Placement, Assurance, CRM, Paramètres)",cartes==="assurance,crm,distribution,parametres,placement"?true:cartes);
 t("INS-7","hub : titre LOGISTICA, onglets Distributions, Placement et Assurance",/LOGISTICA/.test(await h.title())&&(await h.$$eval("#tabs .tab",x=>x.length))===3?true:await h.title());
 const mq=await h.evaluate(()=>({id:ERP_MARQUE.id,adm:ERP_MARQUE.admin.nom,u:ANGELS_AUTH.adminProd("x")}));
 t("INS-8","administrateur propre à l'instance (pas KESSIE), changement de mot de passe imposé",mq.adm==="ADMIN"&&mq.u.nom==="ADMIN"&&mq.u.chg===true?true:JSON.stringify(mq));
 const mdp=process.env.LOGISTICA_MDP;
 if(mdp){const v=await h.evaluate(async m=>({bon:await ANGELS_AUTH.verifier(m,ANGELS_AUTH.adminProd("x").pwd),mauvais:await ANGELS_AUTH.verifier("Demo@Angels2026",ANGELS_AUTH.adminProd("x").pwd),kessie:await ANGELS_AUTH.verifier("Kessie",ANGELS_AUTH.adminProd("x").pwd)}),mdp);
  t("INS-9","mot de passe initial LOGISTICA valide ; mot de passe de démonstration refusé",v.bon&&!v.mauvais?true:JSON.stringify(v))}
 const d=await page("distribution.html");
 t("INS-10","Distribution : écran de connexion sans marque d'origine, sans erreur",!/ANGEL'S/.test(await d.evaluate(()=>document.body.innerText))?true:"marque d'origine");
 t("INS-11","aucune erreur JavaScript",errs.length===0?true:errs.join(" | "));
 // le code commun (ANGEL'S GROUP) reste intact
 const src=fs.readFileSync(path.resolve(__dirname,"..","index.html"),"utf8"),mS=fs.readFileSync(path.resolve(__dirname,"..","marque.js"),"utf8");
 t("INS-12","code commun inchangé : marque par défaut ANGEL'S GROUP avec 3 modules",/ANGEL'S GROUP/.test(mS)&&/transport/.test(mS)&&/data-mod="transport"/.test(src)?true:"défaut modifié");
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
