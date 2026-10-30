/* Argent : recette déclarée → encaissement en un clic (préremplissage) ; caisse fermée bloque l'espèces. */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":u.endsWith(".html")?"text/html; charset=utf-8":u.endsWith(".js")?"application/javascript":"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1200,height:900},serviceWorkers:"block"})).newPage(),E=[];
 p.on("pageerror",e=>E.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/transport.html");await p.waitForTimeout(400);
 let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const r=await p.evaluate(()=>{const o={};ME=S.users.find(x=>x.role==="caissier"&&x.actif)||(S.users.push({id:"u_a",nom:"caiss",role:"caissier",actif:true}),S.users[S.users.length-1]);
  S.drivers.push({id:"drv_e1",nom:"Yao",actif:true});
  S.declarations.push({id:"dcl_e1",numero:"DR-E1",driver_id:"drv_e1",date:today(),montant:25000,mode:"mobile",ref:"MM123",statut:"declaree",hist:[],par:"Yao",t:now()});
  view="encaissements";render();o.section=document.body.innerText.includes("Recettes déclarées à encaisser");
  o.sec0=document.body.innerText.includes("Recettes déclarées");o.can=can("encaissements","c");A["enc.decl"]("dcl_e1");
  o.mt=document.querySelector("#mt").value;o.md=document.querySelector("#md").value;o.rf=document.querySelector("#rf").value;
  document.querySelector("[data-x]").click();
  /* espèces, caisse fermée */
  S.cash_sessions.forEach(s=>{if(s.statut==="ouverte"){s.statut="cloturee"}});
  A["enc.open"]("drv_e1",{mt:5000,mode:"especes"});o.goOff=document.querySelector("#go").disabled;o.msg=document.body.innerText.includes("Caisse fermée");
  document.querySelector("[data-x]").click();
  o.btn=!!document.querySelector('[data-a="enc.decl"]');return o});
 chk("ED-1","section « recettes déclarées à encaisser »",r.section===true,r.section);
 chk("ED-2","clic Encaisser : montant, mode, référence préremplis",r.mt==="25000"&&r.md==="mobile"&&r.rf==="MM123",JSON.stringify([r.mt,r.md,r.rf]));
 chk("ED-3","espèces avec caisse fermée : bouton bloqué + message",r.goOff===true&&r.msg===true,JSON.stringify([r.goOff,r.msg]));
 chk("ED-5","bouton Encaisser affiché (droit encaisser)",r.btn===true&&r.can===true,JSON.stringify([r.btn,r.can]));chk("ED-4","aucune erreur de script",!E.length,E[0]);
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await b.close();srv.close();process.exit(ko?1:0)})();
