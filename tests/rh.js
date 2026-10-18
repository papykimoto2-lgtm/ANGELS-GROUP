/* Connexion Ressources humaines et paie dans les trois applications, connectées à chaque comptabilité.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/rh.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
 const pt=await ctx.newPage();pt.on("pageerror",e=>errs.push("transport: "+e.message));pt.on("dialog",d=>d.accept());await pt.goto(base+"/transport.html");await pt.waitForTimeout(500);

 const T=async(id,label,fn,arg)=>{let r;try{r=await pt.evaluate(fn,arg)}catch(e){r="EXC "+e.message}chk(id,label,r===true,typeof r==="string"?r:JSON.stringify(r))};
 await pt.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};window.__err=fn=>{try{fn();return null}catch(e){return e.message}};window.O=ANGELS_RH.ops;
  window.__sc=(c,f)=>S.entries.flatMap(e=>e.lines.filter(l=>l.compte===c&&(!f||f(l,e)))).reduce((a,l)=>a+(l.debit||0)-(l.credit||0),0)});
 await T("RH-1","Transport : fiche employé (matricule, SMIG, CDD sans fin, doublon refusés) ; historique de rémunération",()=>{
  const a=O.saveEmploye({nom:"Konan",prenoms:"Awa",embauche:"2026-01-05",contrat:"CDI",sal_base:300000,sursalaire:50000,transport:30000,parts:2,cmu_pers:1,cnps_no:"123456",poste:"Comptable",act:"admin"});
  const b=O.saveEmploye({nom:"Yao",prenoms:"Kouadio",embauche:"2025-03-01",contrat:"CDI",sal_base:120000,transport:20000,parts:1,cnps_no:"654321",poste:"Mécanicien",act:"flotte"});
  const e1=__err(()=>O.saveEmploye({nom:"Bas",embauche:"2026-01-01",contrat:"CDI",sal_base:50000}));const e2=__err(()=>O.saveEmploye({nom:"Cdd",embauche:"2026-01-01",contrat:"CDD",sal_base:100000}));
  const e3=__err(()=>O.saveEmploye({nom:"Konan",prenoms:"Awa",embauche:"2026-02-01",contrat:"CDI",sal_base:100000}));
  return a.mat==="TRA-0001"&&b.mat==="TRA-0002"&&/SMIG/.test(e1)&&/fin obligatoire/.test(e2)&&/existe déjà/.test(e3)&&a.historique.length===1||[a.mat,e1,e2,e3]});
 await T("RH-2","calcul de paie exact : ITS par tranches, RICF, CNPS plafonnée, CMU, charges patronales, FDFP (salariée A et salarié B)",()=>{
  const pa=O.calculerMois("2026-09"),A=pa.bulletins.find(x=>x.nom==="Konan Awa").calc,B=pa.bulletins.find(x=>x.nom==="Yao Kouadio").calc;
  const okA=A.brutImposable===350000&&A.brut===380000&&A.cnpsSal===22050&&A.itsBrut===49500&&A.ricf===11000&&A.its===38500&&A.cmuSal===500&&A.net===318950&&A.totalPatronal===45313&&A.cout===425313;
  const okB=B.brut===140000&&B.cnpsSal===7560&&B.its===7200&&B.net===124740&&B.totalPatronal===21163;return okA&&okB||[A,B]});
 await T("RH-3","cas particuliers : ancienneté automatique, embauche en cours de mois (prorata), non déclaré CNPS, transport excédentaire imposable, jours d'absence",()=>{
  const k=O.saveEmploye({nom:"Koffi",embauche:"2022-02-01",contrat:"CDI",sal_base:200000,cnps_no:"1",act:"admin"});
  const n=O.saveEmploye({nom:"Nouvel",embauche:"2026-09-16",contrat:"CDI",sal_base:150000,cnps_no:"2",act:"admin"});
  const j=O.saveEmploye({nom:"Journalier",embauche:"2026-01-01",contrat:"journalier",sal_base:100000,declare:"non",transport:50000,act:"admin"});
  O.variable("2026-09",{emp_id:k.id,abs:3,hs:10000,primes:5000});const pa=O.calculerMois("2026-09"),f=x=>pa.bulletins.find(b=>b.nom===x).calc;
  const K=f("Koffi"),N=f("Nouvel"),J=f("Journalier");
  return K.tauxAnc===4&&K.jours===27&&K.anciennete===Math.round(Math.round(200000*27/30)*4/100)&&K.hs===10000&&K.primes===5000&&N.jours===15&&N.categoriel===75000&&J.cnpsSal===0&&J.cmuSal===0&&J.cmuPat===0&&J.cnpsRetPat===0&&J.transportImp===0&&J.transport===50000||[K,N,J]});
 await T("RH-4","avances et retenues supérieures au brut refusées au calcul",()=>{const k=S.rh.employes.find(e=>e.nom==="Koffi");O.variable("2026-09",{emp_id:k.id,abs:0,hs:0,primes:0,retenues:900000});const e=__err(()=>O.calculerMois("2026-09"));O.variable("2026-09",{emp_id:k.id,abs:0,hs:0,primes:0,retenues:0});return /supérieures au brut/.test(e)||e});
 await T("RH-5","validation de la paie : écriture équilibrée, charges par activité, 422 = net, 4313 = CNPS+CMU, 447 = ITS, droits de validation",()=>{
  O.calculerMois("2026-09");__as("comptable");const d=__err(()=>O.validerMois("2026-09"));const f=__err(()=>(__as("admin"),O.validerMois("2026-10")));
  __as("admin");const pa=O.validerMois("2026-09"),e=S.entries.find(x=>x.source&&x.source.type==="rh_paie"&&x.source.id===pa.id);
  const T_=fn=>pa.bulletins.reduce((a,b)=>a+fn(b.calc),0),D=e.lines.reduce((a,l)=>a+(l.debit||0),0),C=e.lines.reduce((a,l)=>a+(l.credit||0),0);
  const cr=c=>e.lines.filter(l=>l.compte===c).reduce((a,l)=>a+(l.credit||0),0),db=c=>e.lines.filter(l=>l.compte===c).reduce((a,l)=>a+(l.debit||0),0);
  return /Droits insuffisants/.test(d)&&/Calculez/.test(f)&&D===C&&db("6611")===T_(c=>c.brut)&&db("6641")===T_(c=>c.totalPatronal)&&cr("422")===T_(c=>c.net)&&cr("4313")===T_(c=>c.cnpsSal+c.cnpsRetPat+c.cnpsAT+c.cnpsPF+c.cmuSal+c.cmuPat)&&cr("447")===T_(c=>c.its+c.itsPat+c.fdfpTA+c.fdfpFC+c.fdfpRegul)&&e.lines.some(l=>l.act==="flotte")&&pa.statut==="valide"||[d,f,D,C]});
 await T("RH-6","analytique : la paie est imputée à l'activité de l'employé (flotte / administration) ; la somme des activités égale le résultat",()=>{
  const R=resultatActivites("2026-01-01","2026-12-31"),fl=R.find(x=>x.k==="flotte"),ad=R.find(x=>x.k==="admin"),tot=resultat("2026-01-01","2026-12-31").r;return fl.c>0&&ad.c>0&&R.reduce((a,x)=>a+x.r,0)===tot||[fl,ad]});
 await T("RH-7","paiement des salaires : écriture 422 / banque, bulletins payés ; double paiement refusé ; paiement partiel par employé",()=>{
  const pa=O.paieDe("2026-09"),net=pa.bulletins.reduce((a,b)=>a+b.calc.net,0);const id1=pa.bulletins[0].emp_id,n1=pa.bulletins[0].calc.net;
  O.payerSalaires("2026-09","banque",[id1]);const reste=net-n1;const e=__err(()=>O.payerSalaires("2026-09","banque",[id1]));O.payerSalaires("2026-09","banque");const e2=__err(()=>O.payerSalaires("2026-09","banque"));
  return pa.bulletins.every(b=>b.paye)&&/Aucun salaire/.test(e)&&/Aucun salaire/.test(e2)&&__sc("422")===-(0)&&__sc("5211",(l,en)=>en.source&&en.source.type==="rh_salaires")===-net&&pa.paiements.length===2||[net,__sc("422")]});
 await T("RH-8","reversement CNPS / ITS / FDFP : écritures, reste à zéro, rien à reverser deux fois",()=>{
  const d=O.dus("2026-09");const a=O.reverser("2026-09","cnps","banque"),b=O.reverser("2026-09","its","banque"),c=O.reverser("2026-09","fdfp","banque");const e=__err(()=>O.reverser("2026-09","cnps","banque"));
  return a===d.cnps&&b===d.its&&c===d.fdfp&&/Rien à reverser/.test(e)&&__sc("4313")===0&&__sc("447")===0||[d,a,b,c,__sc("4313"),__sc("447")]});
 await T("RH-9","avance sur salaire : versement 4211, retenue automatique à la paie suivante (net réduit, 4211 soldé)",()=>{
  const k=S.rh.employes.find(e=>e.nom==="Koffi");O.avance({emp_id:k.id,montant:60000,retenue:20000,date:"2026-10-01",mode:"banque",motif:"Rentrée scolaire"});
  const av=S.rh.avances[0],a1=__sc("4211");const pa=O.calculerMois("2026-10"),b=pa.bulletins.find(x=>x.emp_id===k.id).calc;O.validerMois("2026-10");
  return a1===60000&&b.avance===20000&&av.reste===40000&&__sc("4211")===40000||[a1,b.avance,av.reste,__sc("4211")]});
 await T("RH-10","annulation : refusée si payée ; sinon extourne, retour en brouillon et revalidation ; contrôle des écritures sans anomalie",()=>{
  const e1=__err(()=>O.annulerValidation("2026-09","Erreur de saisie"));O.annulerValidation("2026-10","Erreur de variables");const pa=O.paieDe("2026-10"),brouillon=pa.statut==="brouillon",avRestaure=S.rh.avances[0].reste===60000;
  O.calculerMois("2026-10");O.validerMois("2026-10");const k=ctrlAuto();const rp=k.par.filter(x=>/^rh_/.test(x.type));
  return /déjà payés/.test(e1)&&brouillon&&avRestaure&&k.nonCompt===0&&k.anom.length===0&&rp.length>=3||[e1,brouillon,avRestaure,k.nonCompt,k.anom.slice(0,3)]});
 await T("RH-11","congés : solde acquis (2,2 j/mois), demande, chevauchement et solde insuffisant refusés, validation ; congé sans solde = jours non payés",()=>{
  const a=S.rh.employes.find(e=>e.nom==="Konan"),s=O.soldeConges(a,"2026-09-30");const c=O.conge({emp_id:a.id,type:"annuel",debut:"2026-11-02",fin:"2026-11-06"});const e1=__err(()=>O.conge({emp_id:a.id,type:"annuel",debut:"2026-11-04",fin:"2026-11-10"}));
  const e2=__err(()=>O.conge({emp_id:a.id,type:"annuel",debut:"2027-01-04",fin:"2027-03-30"}));O.decideConge(c.id,true);const s2=O.soldeConges(a,"2026-09-30");
  const y=S.rh.employes.find(e=>e.nom==="Yao");const ss=O.conge({emp_id:y.id,type:"sans_solde",debut:"2026-11-09",fin:"2026-11-13"});O.decideConge(ss.id,true);const pa=O.calculerMois("2026-11");const jy=pa.bulletins.find(b=>b.emp_id===y.id).calc.jours;
  return s.acquis===19.4&&/déjà/.test(e1)&&/insuffisant/.test(e2)&&s2.pris===5&&jy===25||[s,e1,e2,s2,jy]});
 await T("RH-12","sortie d'un employé : dernier prorata, certificat de travail, réintégration ; paie postérieure déjà validée refusée",()=>{
  const n=S.rh.employes.find(e=>e.nom==="Nouvel");const e1=__err(()=>O.sortie(n.id,"2026-09-20","Démission"));O.sortie(n.id,"2026-11-20","Démission");const pa=O.calculerMois("2026-11"),j=pa.bulletins.find(b=>b.emp_id===n.id).calc.jours;
  O.reintegrer(n.id);return /postérieure/.test(e1)&&j===20&&!n.sortie||[e1,j]});
 await T("RH-13","droits : le caissier n'accède pas aux RH ; le comptable saisit sans valider ; la direction valide",()=>{
  __as("caissier");const v=can("rh","v");__as("comptable");const c=can("rh","c"),a=can("rh","a");__as("directeur");const d=can("rh","a");__as("admin");return !v&&c&&!a&&d||[v,c,a,d]});
 await T("RH-14","synthèse publiée pour le consolidé du groupe (effectif, masse salariale, cotisations dues)",()=>{ANGELS_RH.publier(RH_HOST);const r=JSON.parse(localStorage.getItem("angels_rh_transport"));return r.division==="transport"&&r.effectif>=4&&r.brut_mois>0&&r.cout_annee>0&&r.charges_dues>=0||r});
 const ui=await pt.evaluate(async()=>{__as("admin");view="rh";const out={};for(const t of ["tableau","employes","conges","paie","charges","livre","params"]){ANGELS_RH.UI.tab=t;ANGELS_RH.UI.fiche=null;ANGELS_RH.UI.mois="2026-09";try{render();out[t]=document.getElementById("app").innerText.length}catch(e){out[t]="ERR "+e.message}}
  ANGELS_RH.UI.fiche=S.rh.employes[0].id;render();out.fiche=document.getElementById("app").innerText.includes(S.rh.employes[0].mat);ANGELS_RH.UI.fiche=null;ANGELS_RH.UI.tab="paie";render();out.menu=NAV.filter(showNav).some(n=>n.v==="rh");return out});
 chk("RH-15","Transport : menu « Ressources humaines et paie » et les 7 onglets + fiche employé s'affichent sans erreur",ui.menu&&ui.fiche===true&&["tableau","employes","conges","paie","charges","livre","params"].every(t=>typeof ui[t]==="number"&&ui[t]>50),JSON.stringify(ui));
 await pt.evaluate(()=>{const c=ANGELS_PRINT.cfg();c.div.transport.raison="ANGEL'S TRANSPORT";c.div.transport.rccm="CI-ABJ-2024-B-TRA";ANGELS_PRINT.sauver(c);ANGELS_RH.UI.tab="paie";render()});
 const wait=async(pg)=>pg.evaluate(async()=>{for(let i=0;i<80&&(!document.getElementById("ap-ov")||document.getElementById("ap-ov").hidden);i++)await new Promise(r=>setTimeout(r,50));await new Promise(r=>setTimeout(r,500));return document.getElementById("ap-f").srcdoc});
 await pt.evaluate(()=>{document.getElementById("ap-ov")&&(document.getElementById("ap-ov").hidden=true);document.querySelector('[data-rh="bul"]').click()});
 const hb=await wait(pt);const tb=hb.replace(/<style[\s\S]*?<\/style>/g,"").replace(/<svg[\s\S]*?<\/svg>/g,"[QR]").replace(/<[^>]+>/g," ").replace(/&#39;/g,"'").replace(/\s+/g," ");
 chk("RH-16","bulletin de paie imprimé avec le moteur : en-tête Transport, salarié, gains, retenues, NET À PAYER, charges patronales et QR signé",/ANGEL'S TRANSPORT/.test(tb)&&/NET À PAYER/.test(tb)&&/Gains/.test(tb)&&/Retenues salariales/.test(tb)&&/Charges patronales/.test(tb)&&/\[QR\]/.test(tb)&&/BUL-202609/.test(tb),tb.slice(0,300));
 const hl=await pt.evaluate(async()=>{document.getElementById("ap-ov").hidden=true;ACT_LIVRE=0;document.querySelector('[data-rh="p.livre"]').click();for(let i=0;i<60&&document.getElementById("ap-ov").hidden;i++)await new Promise(r=>setTimeout(r,50));await new Promise(r=>setTimeout(r,500));return document.getElementById("ap-f").srcdoc});
 chk("RH-17","livre de paie : tableau récapitulatif en paysage avec totaux",/A4 landscape/.test(hl)&&/TOTAUX/.test(hl)&&/Livre de paie/.test(hl));
 const hd=await pt.evaluate(async()=>{document.getElementById("ap-ov").hidden=true;const e=S.rh.employes[0];ANGELS_RH.UI.fiche=e.id;render();document.querySelector('[data-rh="doc.contrat"]').click();for(let i=0;i<60&&document.getElementById("ap-ov").hidden;i++)await new Promise(r=>setTimeout(r,50));await new Promise(r=>setTimeout(r,500));return document.getElementById("ap-f").srcdoc});
 chk("RH-18","contrat de travail imprimé : engagement, rémunération, signatures, référence CT-matricule",/Contrat de travail/.test(hd)&&/Article 2 — Rémunération/.test(hd)&&/CT-TRA-0001/.test(hd)&&/Lu et approuvé/.test(hd));
 await pt.evaluate(()=>{document.getElementById("ap-ov").hidden=true});
 /* Agro */
 const pa_=await ctx.newPage();pa_.on("pageerror",e=>errs.push("agro: "+e.message));pa_.on("dialog",d=>d.accept());await pa_.goto(base+"/agro.html");await pa_.waitForTimeout(500);
 const AG=async(id,label,fn)=>{let r;try{r=await pa_.evaluate(fn)}catch(e){r="EXC "+e.message}chk(id,label,r===true,typeof r==="string"?r:JSON.stringify(r))};
 await pa_.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");window.O=ANGELS_RH.ops;window.__err=fn=>{try{fn();return null}catch(e){return e.message}};window.__sc=(c)=>S.entries.flatMap(e=>e.lignes.filter(l=>l.compte===c)).reduce((a,l)=>a+(l.debit||0)-(l.credit||0),0)});
 await AG("RH-20","Agro : le personnel existant est repris comme employés ; le menu RH est réservé à l'administrateur, la direction et le comptable",()=>{ANGELS_RH.use(RH_HOST);RH_HOST.migrer(ANGELS_RH.ops.state());const n=S.rh.employes.length;const vis=r=>NAV.some(x=>x.v==="rh"&&x.r.includes(r));return n===S.staff.filter(s=>s.actif).length&&n>=2&&vis("admin")&&vis("comptable")&&vis("direction")&&!vis("soigneur")&&!vis("commercial")||[n]});
 await AG("RH-21","Agro : paie validée → écriture PAIE équilibrée sur 6611 / 6641 / 422 / 4313 / 447 ; paiement par banque ; reversement CNPS",()=>{
  O.saveEmploye({nom:"Brou",prenoms:"Paul",embauche:"2025-06-01",contrat:"CDI",sal_base:150000,cnps_no:"9",parts:1,poste:"Chef de ferme"});
  const pa=O.calculerMois("2026-09");O.validerMois("2026-09");const en=S.entries.find(x=>x.source&&x.source.type==="rh_paie");const D=en.lignes.reduce((a,l)=>a+(l.debit||0),0),C=en.lignes.reduce((a,l)=>a+(l.credit||0),0);
  const dl=c=>en.lignes.filter(l=>l.compte===c).reduce((a,l)=>a+(l.debit||0),0);O.payerSalaires("2026-09","banque");O.reverser("2026-09","cnps","banque");
  return en.journal==="PAIE"&&D===C&&dl("6611")===pa.bulletins.reduce((a,b)=>a+b.calc.brut,0)&&dl("6641")===pa.bulletins.reduce((a,b)=>a+b.calc.totalPatronal,0)&&__sc("4313")===0&&S.entries.some(e=>e.source&&e.source.type==="rh_salaires")||[en.journal,D,C,dl("6611")]});
 await AG("RH-22","Agro : annulation d'une paie non payée = extourne (soldes inchangés) ; paiement en espèces enregistré dans la caisse ouverte ; annulation refusée une fois payée",()=>{
  const b0={a:__sc("6611"),b:__sc("422")};O.calculerMois("2026-10");O.validerMois("2026-10");O.annulerValidation("2026-10","Variables à corriger");const b1={a:__sc("6611"),b:__sc("422")};
  O.calculerMois("2026-10");O.validerMois("2026-10");const nb=S.cash_mv.length;O.payerSalaires("2026-10","caisse");const mv=S.cash_mv.length>nb&&S.cash_mv.some(m=>m.source&&m.source.type==="rh_salaires");const e=__err(()=>O.annulerValidation("2026-10","Trop tard"));
  return b0.a===b1.a&&b0.b===b1.b&&mv&&/déjà payés/.test(e)||[b0,b1,mv,e]});
 await AG("RH-23","Agro : l'ancienne page Personnel renvoie vers les RH ; affichage de tous les onglets",()=>{view="perso";render();const a=document.getElementById("app").innerText;const t={};for(const x of ["tableau","employes","conges","paie","charges","livre","params"]){ANGELS_RH.UI.tab=x;view="rh";render();t[x]=document.getElementById("app").innerText.length>50}return /Ressources humaines/.test(a)&&Object.values(t).every(Boolean)||[a.slice(0,100),t]});
 /* Distribution */
 const pd=await ctx.newPage();pd.on("pageerror",e=>errs.push("distribution: "+e.message));pd.on("dialog",d=>d.accept());await pd.goto(base+"/distribution.html");await pd.waitForTimeout(500);
 const DI=async(id,label,fn)=>{let r;try{r=await pd.evaluate(fn)}catch(e){r="EXC "+e.message}chk(id,label,r===true,typeof r==="string"?r:JSON.stringify(r))};
 await pd.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");window.O=ANGELS_RH.ops;window.__err=fn=>{try{fn();return null}catch(e){return e.message}};window.__bal=()=>cptBal(cptDef(cptEcr()))});
 await DI("RH-30","Distribution : paie validée → pièce validée dans la comptabilité (6611 / 6641 / 422 / 4313 / 447), balance équilibrée",()=>{
  O.saveEmploye({nom:"Diallo",prenoms:"Ibrahim",embauche:"2025-01-10",contrat:"CDI",sal_base:200000,transport:25000,cnps_no:"77",parts:1.5,poste:"Préparateur"});
  const pa=O.calculerMois("2026-09");O.validerMois("2026-09");const B=__bal(),b=pa.bulletins[0].calc;const d=Object.values(B).reduce((a,x)=>a+x.d,0),c=Object.values(B).reduce((a,x)=>a+x.c,0);
  return B["6611"].d===b.brut&&B["6641"].d===b.totalPatronal&&B["422"].c===b.net&&d===c||[B["6611"],b.brut,B["422"],d,c]});
 await DI("RH-31","Distribution : paiement des salaires par Mobile Money, reversement ITS ; période clôturée = écriture refusée",()=>{
  const net=O.paieDe("2026-09").bulletins[0].calc.net;O.payerSalaires("2026-09","mobile");O.reverser("2026-09","its","banque");const B=__bal();
  const C=cpt();const old=C.clos;C.clos="2026-12-31";const e=__err(()=>{O.calculerMois("2026-10");O.validerMois("2026-10")});C.clos=old;
  return B["422"].d===net&&B["422"].c===net&&B["538"].c===net&&/clôturée/.test(e)||[B["422"],B["538"],e]});
 await DI("RH-32","Distribution : annulation d'une paie = écriture d'extourne validée ; accès réservé à l'administrateur et à la direction ; onglets affichés",()=>{
  C=cpt();C.clos=C.clos||"";const pa=O.calculerMois("2026-10");O.validerMois("2026-10");const before=C.manuelles.length;O.annulerValidation("2026-10","Contrôle");const ext=C.manuelles.filter(m=>m.extourne_de).length;
  const vis=r=>NAV.some(x=>x.v==="rh"&&x.r.includes(r));let ok=true;for(const x of ["tableau","employes","conges","paie","charges","livre","params"]){ANGELS_RH.UI.tab=x;view="rh";render();ok=ok&&document.getElementById("app").innerText.length>50}
  return ext===1&&C.manuelles.length===before+1&&vis("admin")&&vis("direction")&&!vis("caissier")&&!vis("commercial")&&ok||[ext,vis("admin")]});
 /* Hub et impressions des autres divisions */
 const pg=await ctx.newPage();pg.on("pageerror",e=>errs.push("compta-groupe: "+e.message));await pg.goto(base+"/compta-groupe.html");await pg.waitForTimeout(500);
 const hub=await pg.evaluate(()=>document.body.innerText);
 chk("RH-40","consolidé du groupe : carte Ressources humaines avec l'effectif et la masse salariale de chaque division",/Ressources humaines/.test(hub)&&/Transport/.test(hub)&&/Distribution/.test(hub)&&/Agro/.test(hub)&&/Effectif/.test(hub),hub.slice(0,300));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
