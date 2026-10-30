/* Argent › Dépenses : l'administrateur d'une base existante peut ajouter, valider (caisse) une dépense. */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":u.endsWith(".html")?"text/html; charset=utf-8":u.endsWith(".js")?"application/javascript":"application/octet-stream"});fs.createReadStream(f).pipe(r)});
const o2=x=>x||"";
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
  /* doublons */
  const err=f=>{try{creerDepense(f);return null}catch(x){return x.message}};
  const cat=Object.keys(CATS)[0];
  o.dJust=err({date:today(),categorie:cat,fournisseur:"Autre",montant:15000,justificatif:"F-1"});
  o.dMeme=err({date:today(),categorie:cat,fournisseur:"garage",montant:15000,justificatif:"F-2"});
  o.dOk=err({date:today(),categorie:cat,fournisseur:"Garage",montant:16000,justificatif:"F-3"});
  o.dConf=err({date:today(),categorie:cat,fournisseur:"Garage",montant:15000,justificatif:"F-4",confirme_doublon:true});
  o.dAuto=err({date:today(),categorie:cat,fournisseur:"Garage",montant:15000,justificatif:"F-5",source:{type:"maintenance",id:"x"}});
  S.cash_mv.push({id:"cm_old",session_id:"x",date:now(),sens:"sortie",montant:7777,categorie:"Frais divers",motif:"Taxi",statut:"validee",par:"x"});
  o.dBon=err({date:today(),categorie:cat,fournisseur:"Taxi",montant:7777,justificatif:"F-6"});
  /* dépense validée en banque -> mouvement bancaire négatif, visible et à pointer */
  const e2=creerDepense({date:today(),categorie:cat,fournisseur:"Pneus",montant:42000,justificatif:"F-7"});validerDepense(e2.id,"banque",true);
  const bt=S.bank_tx.find(b=>b.expense_id===e2.id);o.bt=bt&&bt.montant===-42000&&bt.pointe===false;
  const e3=creerDepense({date:today(),categorie:cat,fournisseur:"Huile",montant:9000,justificatif:"F-8"});validerDepense(e3.id,"caisse",true);o.btEsp=!S.bank_tx.some(b=>b.expense_id===e3.id);
  view="caisse";UI.tab.caisse="banque";render();const tx=document.body.innerText;o.vue=tx.includes("Dépense")&&tx.includes("Mouvements à pointer")&&tx.includes("42");
  return o});
 chk("DP-1","migration : l'admin d'une base existante reçoit créer/valider sur Dépenses",r.mig===true,r.mig);
 chk("DP-2","bouton « + Dépense » affiché",r.btn===true,r.btn);
 chk("DP-3","dépense créée puis validée en espèces avec écriture",r.val===true,r.val);
 chk("DP-4","catégorie invalide refusée",/Catégorie/.test(r.cat||""),r.cat);
 chk("DP-6","doublon : justificatif identique, ou même fournisseur+montant+catégorie sous 7 j, ou bon de caisse équivalent",/Doublon/.test(o2(r.dJust))&&/Doublon/.test(o2(r.dMeme))&&/Doublon/.test(o2(r.dBon)),JSON.stringify([r.dJust,r.dMeme,r.dBon]));
 chk("DP-7","pas de faux positif (montant différent), confirmation et saisies automatiques passent",r.dOk===null&&r.dConf===null&&r.dAuto===null,JSON.stringify([r.dOk,r.dConf,r.dAuto]));
 chk("DP-8","dépense banque : mouvement bancaire négatif à pointer ; dépense espèces : aucun",r.bt===true&&r.btEsp===true,JSON.stringify([r.bt,r.btEsp]));
 chk("DP-9","Caisse › Banque : dépenses visibles avec sens et compteur à pointer",r.vue===true,r.vue);
 chk("DP-5","aucune erreur de script",!E.length,E[0]);
 await p.evaluate(()=>{view="depenses";render()});await p.screenshot({path:process.env.CAPT||"/tmp/transport-depenses.png"});
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await b.close();srv.close();process.exit(ko?1:0)})();
