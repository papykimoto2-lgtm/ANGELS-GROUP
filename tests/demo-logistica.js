/* Démonstration LOGISTICA : données fictives cohérentes, locales à l'appareil, jamais envoyées au serveur, effaçables.
   Usage : NODE_OPTIONS="--require $PWD/tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/demo-logistica.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..","dist","logistica");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 require("child_process").execSync("node tools/instance.js logistica",{cwd:path.resolve(__dirname,"..")});
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1200,height:1000},serviceWorkers:"block"}),errs=[];let ok=0,ko=0;
 const t=(id,l,r)=>{if(r===true){ok++;console.log("PASS",id,l)}else{ko++;console.log("FAIL",id,l,"→",r)}};
 let syncReq=0;await ctx.route("**/functions/v1/**",r=>{syncReq++;r.fulfill({status:200,contentType:"application/json",body:'{"ok":true}'})});
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());
 // synchronisation activée AVANT la démo : elle doit être coupée par la démo
 await p.goto(base+"/demo.html");
 await p.evaluate(()=>{localStorage.setItem("logistica_supabase",JSON.stringify({url:"https://example.supabase.co"}));localStorage.setItem("logistica_sync",JSON.stringify({actif:true,cle:"x".repeat(20)}))});
 t("DEM-1","page de démonstration : modules et identifiants annoncés",/Placement/.test(await p.evaluate(()=>document.body.innerText))&&/Demo@Logistica2026/.test(await p.evaluate(()=>document.body.innerText))?true:"texte");
 await p.click("#go");await p.waitForURL(/distribution/,{timeout:20000});await p.waitForTimeout(1500);
 const h=await ctx.newPage();h.on("pageerror",e=>errs.push("hub : "+e.message));await h.goto(base+"/index.html");await h.waitForTimeout(1200);
 const d=await h.evaluate(()=>{const P=JSON.parse(localStorage.getItem("logistica_placement_v1")),A=JSON.parse(localStorage.getItem("logistica_assurance_v1")),D=JSON.parse(localStorage.getItem("logistica_erp_v1"));return{pl:[P.travailleurs.length,P.clients.length,P.besoins.length,P.factures.length],as:[A.assures.length,A.compagnies.length,A.polices.length,A.sinistres.length,A.devis.length],dist:!!D&&D.commandes.length>0,sync:localStorage.getItem("logistica_demo_local")}});
 t("DEM-2","données Placement : 12 travailleurs, 6 entreprises, 6 besoins, 2 factures",d.pl.join()==="12,6,6,2"?true:d.pl.join());
 t("DEM-3","données Assurance : 7 assurés, 4 compagnies, 7 polices, 3 sinistres, 2 devis",d.as.join()==="7,4,7,3,2"?true:d.as.join());
 t("DEM-4","données Distribution chargées (commandes de démonstration)",d.dist?true:"vide");
 const pl=await ctx.newPage();await pl.goto(base+"/placement.html");await pl.waitForTimeout(400);
 const eq=await pl.evaluate(()=>({p:LOGISTICA_PLACEMENT.equilibre(LOGISTICA_PLACEMENT.ecritures()),n:LOGISTICA_PLACEMENT.ecritures().length,r:LOGISTICA_PLACEMENT.resume()}));
 t("DEM-5","Placement : écritures équilibrées, marge positive, journées à pointer, besoin ouvert",eq.p&&eq.n>5&&eq.r.marge_mois>0&&eq.r.non_pointes>0&&eq.r.besoins_ouverts===1?true:JSON.stringify(eq));
 const as=await ctx.newPage();await as.goto(base+"/assurance.html");await as.waitForTimeout(400);
 const ea=await as.evaluate(()=>({p:LOGISTICA_ASSURANCE.equilibre(LOGISTICA_ASSURANCE.ecritures()),r:LOGISTICA_ASSURANCE.resume()}));
 t("DEM-6","Assurance : écritures équilibrées, renouvellements, impayés, sinistres ouverts, commissions à recevoir",ea.p&&ea.r.a_renouveler>=1&&ea.r.impayes>=1&&ea.r.sinistres_ouverts===2&&ea.r.commissions_a_recevoir>0?true:JSON.stringify(ea));
 const cr=await ctx.newPage();await cr.goto(base+"/crm.html");await cr.waitForTimeout(400);
 const fu=await cr.evaluate(()=>{const L=LOGISTICA_CRM.contacts(),f=L.find(x=>x.cle===LOGISTICA_CRM.cleTel("0700000101")),g=L.find(x=>x.cle===LOGISTICA_CRM.cleTel("0700000103"));return{ph:f&&Object.keys(f.apps).sort().join(),eb:g&&Object.keys(g.apps).sort().join(),opps:LOGISTICA_CRM.etat().opps.length}});
 t("DEM-7","CRM : une seule fiche pour la pharmacie et le groupe Ébène (Placement + Assurance), 3 opportunités",fu.ph==="assurance,placement"&&fu.eb==="assurance,placement"&&fu.opps===3?true:JSON.stringify(fu));
 t("DEM-8","démonstration locale : aucune requête vers le serveur malgré la synchronisation activée",await (async()=>{await h.waitForTimeout(3000);return syncReq===0?true:syncReq+" requête(s)"})());
 await p.goto(base+"/demo.html");await p.click("#out");await p.waitForTimeout(500);
 const vide=await p.evaluate(()=>["logistica_placement_v1","logistica_assurance_v1","logistica_erp_v1","logistica_demo","logistica_demo_local"].every(k=>localStorage.getItem(k)===null));
 t("DEM-9","effacer la démonstration : appareil remis à vide",vide?true:"restes");
 t("DEM-10","aucune erreur JavaScript",errs.length===0?true:errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
