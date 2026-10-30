/* Argent › Dépenses : l'administrateur d'une base existante peut ajouter, valider (caisse) une dépense. */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":u.endsWith(".html")?"text/html; charset=utf-8":u.endsWith(".js")?"application/javascript":"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1200,height:900},serviceWorkers:"block"})).newPage(),E=[];
 p.on("pageerror",e=>E.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/transport.html");await p.waitForTimeout(400);
 let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const r=await p.evaluate(()=>{const o={};
  ME=S.users.find(x=>x.role==="admin"&&x.actif)||(S.users.push({id:"u_ad",nom:"adm",role:"admin",actif:true}),S.users[S.users.length-1]);
  S.perms.admin.depenses=["v","p"];delete S.settings.mig_perm_depenses_admin;migrerNegoce();
  o.mig=["c","a"].every(l=>S.perms.admin.depenses.includes(l));
  view="depenses";render();o.btn=!!document.querySelector('[data-a="dp.add"]');
  const c=cxCaisse();if(!openSession(c.id))ouvrirCaisse(50000,c.id,{});
  const e=creerDepense({date:today(),categorie:Object.keys(CATS)[0],fournisseur:"Garage",montant:15000,justificatif:"F-1"});
  validerDepense(e.id,"caisse",true);o.val=by(S.expenses,e.id).statut==="validee"&&!!by(S.expenses,e.id).entry_id;
  try{creerDepense({date:today(),categorie:"Inconnue",montant:100});o.cat=null}catch(x){o.cat=x.message}
  return o});
 chk("DP-1","migration : l'admin d'une base existante reçoit créer/valider sur Dépenses",r.mig===true,r.mig);
 chk("DP-2","bouton « + Dépense » affiché",r.btn===true,r.btn);
 chk("DP-3","dépense créée puis validée en espèces avec écriture",r.val===true,r.val);
 chk("DP-4","catégorie invalide refusée",/Catégorie/.test(r.cat||""),r.cat);
 chk("DP-5","aucune erreur de script",!E.length,E[0]);
 await p.evaluate(()=>{view="depenses";render()});await p.screenshot({path:process.env.CAPT||"/tmp/transport-depenses.png"});
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await b.close();srv.close();process.exit(ko?1:0)})();
