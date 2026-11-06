/* Une expédition se fait hors d'Abidjan : Abidjan et ses communes relèvent de la livraison.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/expedition-hors-abidjan.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext()).newPage();let ok=0,ko=0;
 const t=(id,l,r)=>{if(r===true){ok++;console.log("PASS",id,l)}else{ko++;console.log("FAIL",id,l,"→",r)}};
 await p.goto(base+"/distribution.html");await p.waitForTimeout(600);
 const essai=v=>p.evaluate(v=>{try{ME=ME||S.users.find(u=>u.role==="admin");expCreer({type:"client",dest:{nom:"Test",ville:v}});return"ok"}catch(e){return e.message}},v);
 t("EHA-1","ville vide : refusée",/obligatoire/.test(await essai(""))?true:await essai(""));
 t("EHA-2","Abidjan : refusée",/hors d'Abidjan/.test(await essai("Abidjan"))?true:"acceptée");
 const zone=await p.evaluate(()=>S.config.zones[0].nom);
 t("EHA-3","commune d'Abidjan ("+zone+") : refusée",/hors d'Abidjan/.test(await essai(zone))?true:"acceptée");
 t("EHA-4","« ABIDJAN » avec accents/majuscules : refusée",/hors d'Abidjan/.test(await essai(" ÀBIDJAN "))?true:"acceptée");
 t("EHA-5","Bouaké : acceptée",(await essai("Bouaké"))==="ok"?true:await essai("Bouaké"));
 t("EHA-6","Accra (sous-régional) : acceptée",(await essai("Accra"))==="ok"?true:await essai("Accra"));
 console.log(`\n${ok} PASS / ${ko} FAIL`);await b.close();srv.close();process.exit(ko?1:0)})();
