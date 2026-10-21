/* Reversement livreur : ventilation montant collecté (produits) / frais de livraison.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/reversement-ventile.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":f.endsWith(".html")?"text/html; charset=utf-8":f.endsWith(".js")?"application/javascript":"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push(e.message));await D.goto(base+"/distribution.html");await D.waitForTimeout(700);
 const r=await D.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const lv=S.livreurs[0],c=S.commandes[0];
  S.fonds=S.fonds.filter(f=>f.livreur_id!==lv.id);S.livraisons=S.livraisons.filter(l=>l.livreur_id!==lv.id);
  c.lignes=[{desig:"X",qte:1,pu:9000}];c.frais=1000;c.remise=0;calcCmd(c);
  S.livraisons.push({id:"vx1",commande_id:c.id,livreur_id:lv.id,statut:"livree",fin_at:new Date().toISOString()});
  S.fonds.push({id:"fx1",type:"encaissement",livreur_id:lv.id,livraison_id:"vx1",commande_id:c.id,montant:10000,mode:"Espèces",ts:new Date().toISOString()});
  const v=ventLiv(lv.id);view="finance";ui={fin:"enc"};const html=VIEWS.finance();ACT.ventDetail(lv.id);const mo=document.getElementById("modal").innerHTML;ACT.reverser(lv.id);const m2=document.getElementById("modal").innerHTML;
  return{v,tab:/Dont produits/.test(html),det:/Détail des reversements/.test(mo)&&mo.includes(c.numero),rev:/Frais de livraison collectés/.test(m2)}});
 chk("RV-1","ventilation : 10 000 F collectés = 9 000 produits + 1 000 frais",r.v.tot===10000&&r.v.produits===9000&&r.v.frais===1000&&r.v.solde===10000,JSON.stringify(r.v));
 chk("RV-2","tableau, détail par course et fenêtre de reversement",r.tab&&r.det&&r.rev,JSON.stringify(r));
 chk("RV-3","aucune erreur JS",errs.length===0,errs.join("|"));
 console.log("RÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
