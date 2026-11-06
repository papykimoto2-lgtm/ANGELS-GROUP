/* Hub en mode serveur : connexion Supabase Auth + fonction hub_consolide_lire (simulées). Les chiffres ne viennent jamais du stockage local.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/hub-serveur.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext();let ok=0,ko=0;
 const t=(id,l,r)=>{if(r===true){ok++;console.log("PASS",id,l)}else{ko++;console.log("FAIL",id,l,"→",r)}};
 const donnees={distribution:[{coll:"commandes",id:"c1",data:{id:"c1",statut:"livree",date:new Date().toISOString().slice(0,10),total:77000}},{coll:"fonds",id:"f1",data:{id:"f1",commande_id:"c1",type:"encaissement",montant:77000,ts:new Date().toISOString()}}]};
 let rpc=0,jetonRpc=null;
 await ctx.route("**/auth/v1/token**",async r=>{const d=JSON.parse(r.request().postData()||"{}");if(d.email==="dg@x.ci"&&d.password==="Bon-Mdp-77!x")return r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({access_token:"JETON-DG"})});if(d.email==="cpt@x.ci"&&d.password==="Bon-Mdp-77!x")return r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({access_token:"JETON-CPT"})});r.fulfill({status:400,contentType:"application/json",body:"{}"})});
 await ctx.route("**/rest/v1/rpc/hub_consolide_lire",async r=>{rpc++;jetonRpc=r.request().headers().authorization;r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(jetonRpc==="Bearer JETON-DG"?donnees:{refuse:true})})});
 const h=await ctx.newPage();const errs=[];h.on("pageerror",e=>errs.push(e.message));await h.goto(base+"/index.html");await h.waitForTimeout(500);
 t("SRV-1","verrouillé au démarrage, aucune lecture serveur",(await h.$("#fgate"))&&rpc===0?true:"ouvert ou appel");
 t("SRV-2","champ « e-mail » proposé",(await h.$eval("#fgate [name=nom]",e=>e.type))==="email"?true:"champ nom");
 const essai=async(n,m)=>{await h.fill("#fgate [name=nom]",n);await h.fill("#fgate [name=pwd]",m);await h.click("#fgate button[type=submit]");await h.waitForTimeout(800)};
 await essai("dg@x.ci","faux");t("SRV-3","mot de passe faux : refusé",(await h.$("#fgate"))!==null&&/incorrect/.test(await h.$eval("#fmsg",e=>e.textContent))?true:"déverrouillé");
 await essai("cpt@x.ci","Bon-Mdp-77!x");t("SRV-4","compte sans droit (fonction serveur → refus) : refusé",(await h.$("#fgate"))!==null&&/réservé/.test(await h.$eval("#fmsg",e=>e.textContent))?true:"déverrouillé");
 await essai("dg@x.ci","Bon-Mdp-77!x");const tot=await h.$$eval("#big b",e=>e.map(x=>x.textContent));
 t("SRV-5","direction : chiffres du serveur affichés (CA 77 000 F)",(await h.$("#fgate"))===null&&tot.some(x=>/77\s?000/.test(x))?true:JSON.stringify(tot));
 t("SRV-6","jeton transmis à la fonction serveur",jetonRpc==="Bearer JETON-DG"?true:jetonRpc);
 const stock=await h.evaluate(()=>JSON.stringify([localStorage,sessionStorage]));
 t("SRV-7","ni jeton ni chiffres écrits sur l'appareil",!/JETON|77000/.test(stock)?true:"fuite");
 await h.reload();await h.waitForTimeout(500);t("SRV-8","rechargement : reverrouillé (rien en mémoire)",(await h.$("#fgate"))!==null?true:"ouvert");
 t("SRV-9","aucune erreur JavaScript",errs.length===0?true:errs.join("|"));
 console.log(`\n${ok} PASS / ${ko} FAIL`);await b.close();srv.close();process.exit(ko?1:0)})();
