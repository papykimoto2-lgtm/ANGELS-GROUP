/* État des versements livreurs : filtres période / livreur / partenaire.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/versements-etat.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":f.endsWith(".html")?"text/html":f.endsWith(".js")?"text/javascript":"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push(e.message));await D.goto(base+"/distribution.html");await D.waitForTimeout(700);
 const r=await D.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const [l1,l2]=S.livreurs,v=S.vendeurs[0],iso=n=>new Date(Date.now()-n*864e5).toISOString();
  S.fonds=[];S.versements=[];S.commandes=[{id:"cA",numero:"CMD-A",client_id:"k1",colis:[{n:1},{n:2}],vendeur_id:v.id,total:6000,frais:1000},{id:"cB",vendeur_id:null}];
  S.fonds.push({id:"e1",type:"encaissement",livreur_id:l1.id,commande_id:"cA",montant:6000,mode:"Espèces",ts:iso(1)},{id:"e2",type:"encaissement",livreur_id:l1.id,commande_id:"cB",montant:4000,mode:"Espèces",ts:iso(1)},
   {id:"r1",type:"reversement",livreur_id:l1.id,montant:5000,mode:"Espèces",ts:iso(1)},{id:"r2",type:"reversement",livreur_id:l1.id,montant:1000,mode:"Wave",ref:"W1",ts:iso(40)},
   {id:"e3",type:"encaissement",livreur_id:l2.id,commande_id:"cB",montant:2000,mode:"Espèces",ts:iso(1)},{id:"r3",type:"reversement",livreur_id:l2.id,montant:2000,mode:"Espèces",ts:iso(1)});
  const du=ANGELS_VERS_ETAT.jour(iso(5)),au=ANGELS_VERS_ETAT.jour(iso(0)),C=ANGELS_VERS_ETAT.calculer;
  const all=C(S,{du,au}),liv1=C(S,{du,au,livreur:l1.id}),vend=C(S,{du,au,vendeur:v.id}),own=C(S,{du,au,vendeur:"own"});
  view="etatvers";const html=VIEWS.etatvers();const ca=all.colis.find(c=>c.numero==="CMD-A");return{colisA:ca,nbc:all.colis.length,ventil:all.total,all:all.total,liv1:liv1.total,vend:vend.total,own:own.total,parts:all.partenaires.map(p=>[p.cle,p.collecte,p.verse]),html:/États des versements/.test(html)}});
 chk("VE-1","période : 40 jours exclu, 7 000 versés, 12 000 collectés",r.all.verse===7000&&r.all.collecte===12000,JSON.stringify(r.all));
 chk("VE-2","filtre livreur",r.liv1.verse===5000&&r.liv1.collecte===10000,JSON.stringify(r.liv1));
 chk("VE-3","filtre partenaire : collecté exact, versé au prorata (60 % de 5 000)",r.vend.collecte===6000&&r.vend.verse===3000&&r.vend.reste===null,JSON.stringify(r.vend));
 chk("VE-4","partenaire direct ANGEL'S",r.own.collecte===6000&&r.own.verse===4000,JSON.stringify(r.own));
 chk("VE-5","écran rendu",r.html,JSON.stringify(r));
 const r2=await D.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const [l1]=S.livreurs,v=S.vendeurs[0],iso=n=>new Date(Date.now()-n*864e5).toISOString();
  S.fonds=[];S.versements=[];S.commandes=[{id:"cA",vendeur_id:v.id},{id:"cB",vendeur_id:null}];
  S.fonds.push({id:"e1",type:"encaissement",livreur_id:l1.id,commande_id:"cA",montant:6000,mode:"Espèces",ts:iso(1)},{id:"e2",type:"encaissement",livreur_id:l1.id,commande_id:"cB",montant:4000,mode:"Espèces",ts:iso(1)});
  reverserLivreur(l1,3000,"Espèces","","t",v.id);reverserLivreur(l1,1000,"Espèces","","t","");reverserLivreur(l1,500,"Espèces","","t","faux");
  const o={du:ANGELS_VERS_ETAT.jour(iso(2)),au:ANGELS_VERS_ETAT.jour(iso(0))},C=ANGELS_VERS_ETAT.calculer;
  return{pv:C(S,Object.assign({vendeur:v.id},o)).total.verse,po:C(S,Object.assign({vendeur:"own"},o)).total.verse,all:C(S,o).total.verse,tags:S.fonds.filter(f=>f.type==="reversement").map(f=>f.part_id||"-"),form:/name="part"/.test(partSel())}});
 chk("VE-7","partenaire choisi : 100 % au vendeur (3 000 + 60 % de 1 500), invalide ignoré",r2.pv===3900&&r2.po===600&&r2.all===4500&&r2.tags[2]==="-"&&r2.form,JSON.stringify(r2));
 chk("VE-8","ventilation : 6 000 collectés pour partenaire = 1 000 livraison + 5 000 produits ; 4 000 produits ANGEL'S",r.ventil&&r.ventil.frais===1000&&r.ventil.prodPart===5000&&r.ventil.prodOwn===6000&&r.ventil.collecte===12000,JSON.stringify(r.ventil));
 chk("VE-9","détail par colis : 1 ligne/commande, 2 colis, 6 000 = 1 000 livraison + 5 000 produits",r.colisA&&r.colisA.nb===2&&r.colisA.collecte===6000&&r.colisA.frais===1000&&r.colisA.produits===5000&&r.colisA.partenaire&&r.nbc===3,JSON.stringify(r.colisA)+r.nbc);
 chk("VE-6","aucune erreur JS",errs.length===0,errs.join("|"));
 console.log("RÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
