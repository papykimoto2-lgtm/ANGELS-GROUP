/* Application livreur : version affichée (écran de connexion et réglages) et mise à jour automatique quand une nouvelle version prend la main (sans recharger pendant une saisie).
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/livreur-version.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:400,height:800}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const swV=(fs.readFileSync(path.join(root,"sw.js"),"utf8").match(/const V = "angels-v(\d+)"/)||[])[1];
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));await p.goto(base+"/livreur.html");await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForTimeout(1200);
 const t1=await p.evaluate(()=>(document.querySelector(".appv")||{}).textContent);
 chk("LVS-1","écran de connexion : « Version N » = version du cache du service worker actif (permet de vérifier ce que le téléphone a chargé)",t1==="Version "+swV,t1+" / "+swV);
 /* 2e chargement (page contrôlée) : un changement de service worker recharge la page */
 await p.reload();await p.waitForTimeout(1200);await p.evaluate(()=>{window.__marque=1;navigator.serviceWorker.dispatchEvent(new Event("controllerchange"))});await p.waitForTimeout(1500);
 const rech=await p.evaluate(()=>window.__marque===undefined);
 chk("LVS-2","nouvelle version qui prend la main : la page se recharge toute seule",rech===true);
 /* pas de rechargement pendant une saisie */
 await p.waitForTimeout(500);await p.fill("#li","livreur.test");await p.evaluate(()=>{window.__marque=1;navigator.serviceWorker.dispatchEvent(new Event("controllerchange"))});await p.waitForTimeout(1500);
 const gardee=await p.evaluate(()=>window.__marque===1&&document.getElementById("li").value==="livreur.test");
 chk("LVS-3","pendant une saisie en cours : pas de rechargement (la saisie est conservée)",gardee===true);
 const r=await p.evaluate(()=>{user={id:"u"};moi={nom:"L"};missions=[];PAGE="reglages";vueMissions();return(document.querySelector(".appv")||{}).textContent});
 chk("LVS-4","la version apparaît aussi dans « GPS, mot de passe et alertes »",r==="Version "+swV,r);
 chk("LVS-5","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
