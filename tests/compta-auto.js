/* Mise à niveau de la comptabilité automatique : comptabilité analytique par activité, contrôle des écritures automatiques (négoce / import), prestations et ventes en ligne, consolidation au Hub.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/compta-auto.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1200,height:1000}}),errs=[];let ok=0,ko=0;
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/transport.html");await p.waitForTimeout(500);
 await p.evaluate(()=>{window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};
  window.__try=fn=>{const snap=JSON.stringify(S),me=ME&&ME.id;try{fn();return null}catch(e){S=JSON.parse(snap);ME=me?by(S.users,me):null;return e.message}};
  window.__sc=(c,f)=>sum(S.entries.flatMap(e=>e.lines.filter(l=>l.compte===c&&(!f||f(l,e)))),l=>(l.debit||0)-(l.credit||0));
  window.__ach=o=>acheterVehicule(Object.assign({date:today(),fournisseur:"Auto Import SARL",marque:"Toyota",modele:"Corolla",annee:2020,vin:"VIN-"+Math.random().toString(36).slice(2,8).toUpperCase(),prix:1180000,paye:1180000,mode:"banque",km:30000},o));
  window.__vente=(vid,o)=>vendreVehicule(Object.assign({vn_id:vid,date:today(),client:"Kouassi Yao",prix:1534000,mode:"banque"},o));
  __as("admin");S.settings.tva_taux=18;S.attachments.push({id:"at_test",nom:"p.pdf",type:"application/pdf",taille:5,t:now(),par:"t",data:"data:application/pdf;base64,AAAA"})});
 const t=async(id,label,fn,arg)=>{let r;try{r=await p.evaluate(fn,arg)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",typeof r==="string"?r:JSON.stringify(r))}};
 // 1. résultat par activité
 await t("CPA-1","analytique : la somme des activités égale le résultat comptable ; la part transit / douane du coût d'un véhicule vendu est imputée à « Frais de transit et douane »",()=>{
  const d=creerImport({fournisseur:"Yokohama",pays:"Japon",devise:"XOF",taux:1,date_taux:today(),cle:"valeur"});const v=ajouterVehiculeImport(d.id,{marque:"Nissan",modele:"Patrol",vin:"CPA-IMP-1",prix_dev:5000000,poids:2000,volume:15});
  fraisImport(d.id,{statut:"facture",nature:"Manutention",date:today(),prestataire:"Transit Plus",facture_no:"TP-9",devise:"XOF",taux:1,montant_dev:400000});
  receptionImport(S.imports.find(i=>i.id===d.id),today(),"BR-9");
  const loc=__ach({vin:"CPA-LOC-1"});
  __vente(v.id,{prix:7000000,encaisse:7000000});__vente(loc.id,{prix:1534000,encaisse:1534000});
  const from=today().slice(0,4)+"-01-01",to=today(),R=resultatActivites(from,to),tot=resultat(from,to,""),by_=k=>R.find(r=>r.k===k);
  const somme=R.reduce((t,r)=>t+r.r,0);
  const ht=sum(S.ventes_veh,x=>x.ht),achats=sum(S.vn,v=>v.achat.ht);
  return somme===tot.r&&by_("transit").c===400000&&by_("transit").p===0&&by_("ventes").p===ht&&by_("ventes").c===achats&&by_("ventes").r+by_("transit").r===sum(S.ventes_veh,vvMarge)&&R.length===8||JSON.stringify({somme,tot:tot.r,R})});

 // 2. contrôle des écritures automatiques
 await t("CPA-2","contrôle : opérations de négoce / import toutes rapprochées de leurs écritures ; rien à signaler sur des données saines",()=>{
  const k=ctrlAuto();return k.nonCompt===0&&k.anom.length===0&&k.att>=8&&k.par.some(x=>x.type==="imp_reception")&&k.par.some(x=>x.type==="vv_cout")&&!integrite().some(m=>/négoce/.test(m))||JSON.stringify({n:k.nonCompt,a:k.anom,att:k.att})});
 await t("CPA-3","contrôle : une écriture supprimée est détectée (non comptabilisée), signalée à l'intégrité et dans les opérations à traiter ; une écriture en double est détectée",()=>{
  const snap=JSON.stringify(S);let E=[];
  const i=S.entries.findIndex(e=>e.source&&e.source.type==="vv_enc");const sv=S.entries.splice(i,1)[0];
  const k=ctrlAuto();if(k.nonCompt!==1||!k.anom.some(a=>/non comptabilisée/.test(a.msg)))E.push("manquant non détecté "+k.nonCompt);
  if(!integrite().some(m=>/1 opération\(s\) de négoce \/ import sans écriture/.test(m)))E.push("intégrité");
  const o=opsEtat();if(!o.man.some(x=>/Encaissement vente de véhicule/.test(x.ref)))E.push("opérations à traiter");
  S.entries.push(sv,Object.assign({},sv,{id:"dup1"}));const k2=ctrlAuto();if(!k2.anom.some(a=>a.niveau==="wa"&&/en trop/.test(a.msg)))E.push("doublon non détecté");
  S.entries.pop();const orph=S.entries.filter(e=>e.source&&e.source.type==="vv_vente")[0];S.vn.length&&(orph.source={type:"vv_vente",id:"inconnu"});const k3=ctrlAuto();if(!k3.anom.some(a=>/sans opération source/.test(a.msg)))E.push("orphelin non détecté");
  S=JSON.parse(snap);return E.length?E.join(" ; "):true});
 await t("CPA-4","règles de comptabilisation : les opérations de négoce / import figurent au tableau avec comptes lus des comptes par défaut ; onglets « Compta automatique » et « Analytique » s'affichent sans NaN",()=>{
  const ids=rgRules().map(r=>r[0]);const need=["neg:vn_achat","neg:imp_achat","neg:imp_douane","neg:imp_reception","neg:vv_vente","neg:vv_cout","neg:vv_enc","neg:inv_manquant"];
  const miss=need.filter(x=>!ids.includes(x));UI.f.tab=UI.f.tab||{};
  const out=[];["regles","ana"].forEach(tab=>{UI.tab=UI.tab||{};try{UI.f.compta_tab=tab;(window.setTab||(()=>{}))("compta",tab)}catch(e){}const h=tab==="regles"?reglesUI():anaUI();out.push(h.length>200&&!/NaN|undefined/.test(h)&&(tab==="ana"?/Frais de transit et douane/.test(h)&&/= résultat comptable/.test(h):/Rapprochement négoce/.test(h)&&/Achat international/.test(h)))});
  return !miss.length&&out.every(Boolean)||JSON.stringify({miss,out})});
 // 3. synthèse publiée pour le Hub
 await t("CPA-5","synthèse publiée au Hub à chaque enregistrement : écritures, équilibre, opérations attendues / comptabilisées, résultat par activité",()=>{
  save();const r=JSON.parse(localStorage.getItem("angels_compta_transport"));
  return r.module==="transport"&&r.nb_ecritures===S.entries.length&&r.debit===r.credit&&r.desequilibres===0&&r.non_comptabilisees===0&&r.ops_attendues>=8&&r.ops_comptabilisees===r.ops_attendues&&r.par_activite.length===8&&r.par_activite.reduce((t,a)=>t+a.r,0)===r.resultat||JSON.stringify(r)});
 await t("CPA-6","comptabilité générale : toutes les écritures équilibrées, balance générale équilibrée",()=>{
  const bad=S.entries.filter(e=>sum(e.lines,l=>l.debit)!==sum(e.lines,l=>l.credit)).length;return bad===0&&sum(S.entries,e=>sum(e.lines,l=>l.debit))===sum(S.entries,e=>sum(e.lines,l=>l.credit))||"déséquilibre"});
 // 4. Distributions et Agro puis page du Hub (même origine : stockage partagé)
 const pd=await ctx.newPage();pd.on("pageerror",e=>errs.push("distribution: "+e.message));pd.on("dialog",d=>d.accept());await pd.goto(base+"/distribution.html");await pd.waitForTimeout(500);
 const r7=await pd.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const w=S.commandes.find(c=>c.web&&c.web.pay==="a_verifier")||null;save();const e=etatCompta(),st=JSON.parse(localStorage.getItem("angels_compta_distribution"));
  return{e:e.module,nb:e.nb_ecritures,eq:e.debit===e.credit,nc:e.non_comptabilisees,dq:e.desequilibres,ligne:!!e.en_ligne,pr:typeof e.prestations_ht,st:st&&st.module}});
 {const o=r7.e==="distribution"&&r7.eq&&r7.dq===0&&r7.nc===0&&r7.ligne&&r7.pr==="number"&&r7.st==="distribution";console.log(o?"PASS":"FAIL","CPA-7 Distributions : synthèse comptable (équilibre, opérations non comptabilisées, ventes en ligne, prestations) publiée à l'enregistrement",o?"":JSON.stringify(r7));o?ok++:ko++}
 const r8=await pd.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const c=cpt();const h=(ui.cpt="reg",VIEWS.compta());return{web:/Ventes en ligne, prestations et règlements vendeurs/.test(h),nan:/NaN|undefined/.test(h),def:!!c.cd.vente_prest,cp:cdd("vente_prest")}});
 {const o=r8.web&&!r8.nan&&r8.def&&r8.cp==="7062";console.log(o?"PASS":"FAIL","CPA-8 Distributions : compte dédié aux prestations (7062) et bloc « ventes en ligne, prestations et règlements vendeurs » dans les règles",o?"":JSON.stringify(r8));o?ok++:ko++}
 const pa=await ctx.newPage();pa.on("pageerror",e=>errs.push("agro: "+e.message));await pa.goto(base+"/agro.html");await pa.waitForTimeout(500);
 const r9=await pa.evaluate(()=>{ME=S.users.find(u=>u.actif);save();const r=JSON.parse(localStorage.getItem("angels_compta_agro"));return r});
 {const o=r9&&r9.module==="agro"&&r9.debit===r9.credit&&r9.desequilibres===0&&typeof r9.nb_ecritures==="number";console.log(o?"PASS":"FAIL","CPA-9 Agro : synthèse comptable publiée à l'enregistrement",o?"":JSON.stringify(r9));o?ok++:ko++}
 const ph=await ctx.newPage();ph.on("pageerror",e=>errs.push("hub: "+e.message));await ph.goto(base+"/compta-groupe.html");await ph.waitForTimeout(400);
 const tx=await ph.evaluate(()=>document.body.innerText);
 {const o=/3 \/ 3/.test(tx)&&(tx.match(/Conforme/g)||[]).length>=3&&/Résultat par activité/.test(tx)&&/Frais de transit et douane/.test(tx)&&!/NaN|undefined/.test(tx);console.log(o?"PASS":"FAIL","CPA-10 Hub : page « Comptabilité du groupe » — trois applications conformes, totaux consolidés, résultat par activité",o?"":tx.slice(0,900));o?ok++:ko++}
 // une anomalie remontée au Hub
 await p.evaluate(()=>{const e=S.entries.find(e=>e.source&&e.source.type==="vv_enc");S.entries.splice(S.entries.indexOf(e),1);save()});
 await ph.reload();await ph.waitForTimeout(300);const tx2=await ph.evaluate(()=>document.body.innerText);
 {const o=/À corriger/.test(tx2)&&/non comptabilisée/.test(tx2);console.log(o?"PASS":"FAIL","CPA-11 Hub : une opération non comptabilisée dans Transport est signalée « À corriger »",o?"":tx2.slice(0,600));o?ok++:ko++}
 const pi=await ctx.newPage();await pi.goto(base+"/index.html");await pi.waitForTimeout(300);
 {const o=await pi.evaluate(()=>!!document.getElementById("c-compta")&&document.getElementById("c-compta").getAttribute("href")==="compta-groupe.html");console.log(o?"PASS":"FAIL","CPA-12 Hub : carte « Comptabilité du groupe » dans l'administration du groupe");o?ok++:ko++}
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
