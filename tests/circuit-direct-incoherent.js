/* Circuit direct : commande déjà « en cours » alors que sa livraison est restée « acceptée » (état incohérent vu en production) : la validation aboutit au lieu de « Transition interdite ». */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":u.endsWith(".html")?"text/html; charset=utf-8":"application/javascript"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1100,height:900}})).newPage(),E=[];
 p.on("pageerror",e=>E.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/distribution.html");await p.waitForTimeout(300);
 const r=await p.evaluate(()=>{ME=S.users.find(u=>u.actif&&u.role==="admin")||S.users.find(u=>u.actif);ME.role="admin";
  S.livreurs.push({id:"lvA",nom:"ANGE",statut:"disponible",zone:"Z"});S.clients.push({id:"clX",nom:"C"});
  const c={id:"cA",numero:"CMD-A",client_id:"clX",statut:"en_cours",adr:{zone:"Adjamé"},priorite:"normale",lignes:[],total:1000,frais:0,date:new Date(Date.now()-864e5).toISOString(),hist:[]};S.commandes.push(c);
  const l={id:"lA",commande_id:"cA",livreur_id:"lvA",statut:"acceptee",affectee_at:new Date(Date.now()-864e5).toISOString(),accept_at:new Date(Date.now()-864e5).toISOString(),montant_attendu:1000,hist:[]};S.livraisons.push(l);
  const e=cenDirectExec(c,{lid:"lvA",quand:new Date().toISOString(),resultat:"livree",montant:1000,mode:"Espèces",recu_par:"Client"});
  return {e,cs:c.statut,ls:l.statut}});
 const ok=r.e===""&&r.cs==="livree"&&r.ls==="livree"&&!E.length;console.log(ok?"PASS":"FAIL",JSON.stringify(r),E[0]||"");await b.close();srv.close();process.exit(ok?0:1)})();
