/* Bordereau de commandes : « À encaisser » ventilé (en livraison / à relivrer / pas encore affectées) et « encaissé par le livreur » distinct de « payé d'avance ».
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/bordereau-ventile.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":f.endsWith(".html")?"text/html":f.endsWith(".js")?"text/javascript":"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push(e.message));await D.goto(base+"/distribution.html");await D.waitForTimeout(700);
 const r=await D.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const mk=(id,statut,total,pay)=>({id,numero:id.toUpperCase(),statut,total,date:new Date().toISOString(),client_id:S.clients[0].id,adr:{zone:"Abobo"},lignes:[],frais:0,montant_produits:total,hist:[],type_colis:"",priorite:"normale"});
  const A=mk("ca","livree",6000),B=mk("cb","echouee",9000),C=mk("cc","affectee",12000),Dd=mk("cd","livree",5000);
  S.commandes=[A,B,C,Dd];S.fonds=[{id:"f1",type:"encaissement",commande_id:"ca",livreur_id:"x",montant:6000,ts:new Date().toISOString()},{id:"f2",type:"acompte",commande_id:"cd",montant:2000,ts:new Date().toISOString()},{id:"f3",type:"encaissement",commande_id:"cd",livreur_id:"x",montant:3000,ts:new Date().toISOString()}];
  const L=S.commandes.map(bordLigne);return{cat:L.map(x=>x.cat).join(),enc:L.map(x=>x.enc).join(),pre:L.map(x=>x.pre).join(),solde:L.map(x=>x.solde).join()}});
 chk("BV-1","situation : livrée / à relivrer / en livraison",r.cat==="ok,ech,liv,ok",JSON.stringify(r));
 chk("BV-2","encaissé par le livreur ≠ payé d'avance",r.enc==="6000,0,0,3000"&&r.pre==="0,0,0,2000",JSON.stringify(r));
 const h=await D.evaluate(()=>{ui.cp="0";ui.fs="";ui.q="";ui.cdu=ui.cau="";const H=bordHtml().html;return{liv:/en livraison/.test(H)&&H.includes("12 000"),ech:/relivrer/.test(H)&&H.includes("9 000"),lab:/encaissé par le livreur/.test(H),ancien:/déjà payé/.test(H)}});
 chk("BV-3","résumé : 12 000 F en livraison, 9 000 F à relivrer ; libellé « encaissé par le livreur », plus de « déjà payé »",h.liv&&h.ech&&h.lab&&!h.ancien,JSON.stringify(h));
 chk("BV-4","aucune erreur JS",errs.length===0,errs.join("|"));
 console.log("RÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
