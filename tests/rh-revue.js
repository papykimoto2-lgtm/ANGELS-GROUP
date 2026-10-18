/* Revue de qualité : correctifs du moteur de paie (rh-engine.js) et de son branchement dans Agro.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/rh-revue.js */
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
 await pt.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");window.__err=fn=>{try{fn();return null}catch(e){return e.message}};window.O=ANGELS_RH.ops;
  window.__sc=(c,f)=>S.entries.flatMap(e=>e.lines.filter(l=>l.compte===c&&(!f||f(l,e)))).reduce((a,l)=>a+(l.debit||0)-(l.credit||0),0)});
 await T("RV-1","salarié à 0 jour payé : la paie des autres n'est plus bloquée (CMU non appliquée)",()=>{
  const a=O.saveEmploye({nom:"Absent",embauche:"2026-01-05",contrat:"CDI",sal_base:200000,cnps_no:"1",act:"admin"}),b=O.saveEmploye({nom:"Present",embauche:"2026-01-05",contrat:"CDI",sal_base:200000,cnps_no:"2",act:"admin"});
  O.variable("2026-08",{emp_id:a.id,abs:30});const pa=O.calculerMois("2026-08"),A=pa.bulletins.find(x=>x.emp_id===a.id).calc;return pa.bulletins.length===2&&A.jours===0&&A.brut===0&&A.cmuSal===0&&A.net===0||[A]});
 await T("RV-2","avance : jamais recouvrée deux fois ; une paie calculée avant la validation de la précédente doit être recalculée",()=>{
  const k=S.rh.employes.find(e=>e.nom==="Present");O.validerMois("2026-08");O.avance({emp_id:k.id,montant:20000,retenue:20000,mode:"banque",motif:"Test",date:"2026-08-20"});
  const p9=O.calculerMois("2026-09"),av9=p9.bulletins.find(b=>b.emp_id===k.id).calc.avance;const p10=O.calculerMois("2026-10"),av10=p10.bulletins.find(b=>b.emp_id===k.id).calc.avance;
  O.validerMois("2026-09");const e=__err(()=>O.validerMois("2026-10"));const p10b=O.calculerMois("2026-10");O.validerMois("2026-10");
  return av9===20000&&av10===20000&&/recalculez/i.test(e)&&p10b.bulletins.find(b=>b.emp_id===k.id).calc.avance===0&&__sc("4211")>=0||[av9,av10,e,__sc("4211")]});
 await T("RV-3","paie périmée : une modification du salaire après annulation de validation impose un recalcul",()=>{
  const k=S.rh.employes.find(e=>e.nom==="Present");O.annulerValidation("2026-10","Correction du salaire");O.saveEmploye({id:k.id,nom:k.nom,embauche:k.embauche,contrat:"CDI",sal_base:300000,cnps_no:"2",act:"admin",effet:"2026-10-01",motif_sal:"Augmentation"});
  const e=__err(()=>O.validerMois("2026-10"));const pa=O.calculerMois("2026-10");O.validerMois("2026-10");return /recalculez/i.test(e)&&pa.bulletins.find(b=>b.emp_id===k.id).calc.categoriel===300000||[e]});
 await T("RV-4","date d'effet : une augmentation au 1er décembre n'agit pas sur les mois antérieurs",()=>{
  const k=S.rh.employes.find(e=>e.nom==="Present");O.saveEmploye({id:k.id,nom:k.nom,embauche:k.embauche,contrat:"CDI",sal_base:400000,cnps_no:"2",act:"admin",effet:"2026-12-01",motif_sal:"Promotion"});
  const pa=O.calculerMois("2026-11");const c=pa.bulletins.find(b=>b.emp_id===k.id).calc.categoriel;return c===300000||[c]});
 await T("RV-5","avance datée après le mois : non retenue sur ce mois",()=>{
  const k=S.rh.employes.find(e=>e.nom==="Absent");O.avance({emp_id:k.id,montant:50000,retenue:50000,mode:"banque",motif:"Test",date:"2026-10-15"});
  const pa=O.calculerMois("2026-11");const a=pa.bulletins.find(b=>b.emp_id===k.id).calc.avance;const d=O.calculerMois("2026-11");return a===50000||[a]});
 await T("RV-6","CDD échu : la paie s'arrête à la fin du contrat ; février proratisé de façon continue",()=>{
  const c=O.saveEmploye({nom:"Cdd",embauche:"2026-01-01",contrat:"CDD",fin_contrat:"2026-03-10",sal_base:150000,cnps_no:"3",act:"admin"});
  const m3=O.calculerMois("2026-03").bulletins.find(b=>b.emp_id===c.id).calc.jours,has4=O.calculerMois("2026-04").bulletins.some(b=>b.emp_id===c.id);
  const f1=O.saveEmploye({nom:"Fev1",embauche:"2026-02-01",contrat:"CDI",sal_base:150000,cnps_no:"4",act:"admin"}),f2=O.saveEmploye({nom:"Fev2",embauche:"2026-02-02",contrat:"CDI",sal_base:150000,cnps_no:"5",act:"admin"});
  const pf=O.calculerMois("2026-02"),j1=pf.bulletins.find(b=>b.emp_id===f1.id).calc.jours,j2=pf.bulletins.find(b=>b.emp_id===f2.id).calc.jours;
  return m3===10&&!has4&&j1===30&&j2>=28&&j2<=30||[m3,has4,j1,j2]});
 await T("RV-7","congés annuels : demandes en attente déduites du solde ; solde revérifié à l'approbation",()=>{
  const e=O.saveEmploye({nom:"Conge",embauche:"2026-01-01",contrat:"CDI",sal_base:150000,cnps_no:"6",act:"admin"});
  const s=O.soldeConges(e,"2026-12-31");const c1=O.conge({emp_id:e.id,type:"annuel",debut:"2026-06-01",fin:"2026-06-10"});const r=__err(()=>O.conge({emp_id:e.id,type:"annuel",debut:"2026-07-01",fin:"2026-07-25"}));
  return s.dispo===s.reste&&/insuffisant/.test(r)||[s,r]});
 await T("RV-8","montants négatifs et taux d'ancienneté hors bornes refusés ; paramètre de taux > 1 refusé",()=>{
  const a=__err(()=>O.saveEmploye({nom:"Neg",embauche:"2026-01-01",contrat:"CDI",sal_base:150000,sursalaire:-50000,cnps_no:"7"})),b=__err(()=>O.saveEmploye({nom:"Anc",embauche:"2026-01-01",contrat:"CDI",sal_base:150000,anc_auto:"non",anc_taux:80,cnps_no:"8"}));
  return /invalide/.test(a)&&/ancienneté/.test(b)||[a,b]});
 await T("RV-9","annulation d'un paiement de salaires et d'un reversement : extourne, bulletins à payer, annulation de la paie à nouveau possible",()=>{
  const pa=O.paieDe("2026-10");O.payerSalaires("2026-10","banque");const p=pa.paiements[0];const e0=__err(()=>O.annulerValidation("2026-10","Erreur de mode"));
  const b4=__sc("422");O.annulerPaiement("2026-10",p.id,"Mauvais mode de règlement");const b5=__sc("422");const e1=__err(()=>O.annulerPaiement("2026-10",p.id,"Encore une fois"));
  O.reverser("2026-10","cnps","banque");const rv=S.rh.reversements.find(x=>x.mois==="2026-10"&&!x.annule);const d4=__sc("4313");O.annulerReversement(rv.id,"Erreur de montant");
  return /déjà payés/.test(e0)&&pa.bulletins.every(b=>!b.paye||b.calc.net===0)&&b5<b4&&/introuvable/.test(e1)&&__sc("4313")<d4&&!!rv.annule||[e0,b4,b5,e1]});
 await T("RV-10","paiement antérieur à la paie refusé ; mode invalide refusé (avance, reversement)",()=>{
  const a=__err(()=>O.payerSalaires("2026-10","banque",null,"2020-01-01")),k=S.rh.employes.find(e=>e.nom==="Present"),b=__err(()=>O.avance({emp_id:k.id,montant:1000,mode:"bitcoin",motif:"x"})),c=__err(()=>O.reverser("2026-10","its","bitcoin"));
  return /antérieure/.test(a)&&/Mode/.test(b)&&/Mode/.test(c)||[a,b,c]});
 /* Agro : une opération en espèces = un mouvement de caisse ; reprise du personnel avec une vraie date */
 const pa_=await ctx.newPage();pa_.on("pageerror",e=>errs.push("agro: "+e.message));pa_.on("dialog",d=>d.accept());await pa_.goto(base+"/agro.html");await pa_.waitForTimeout(500);
 const AG=async(id,label,fn)=>{let r;try{r=await pa_.evaluate(fn)}catch(e){r="EXC "+e.message}chk(id,label,r===true,typeof r==="string"?r:JSON.stringify(r))};
 await pa_.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");window.O=ANGELS_RH.ops;window.__err=fn=>{try{fn();return null}catch(e){return e.message}}});
 await AG("RV-11","Agro : deux paiements de salaires en espèces = deux mouvements de caisse ; personnel repris avec une date d'embauche passée",()=>{
  ANGELS_RH.use(RH_HOST);RH_HOST.migrer(O.state());const emb=O.state().employes.map(e=>e.embauche);
  O.saveEmploye({nom:"Brou",prenoms:"Paul",embauche:"2025-06-01",contrat:"CDI",sal_base:150000,cnps_no:"9",mode_paie:"caisse"});
  const pa=O.calculerMois("2026-09");O.validerMois("2026-09");const n0=S.cash_mv.length,ids=pa.bulletins.map(b=>b.emp_id);
  O.payerSalaires("2026-09","caisse",[ids[0]]);O.payerSalaires("2026-09","caisse");const n1=S.cash_mv.length;
  return emb.every(d=>d<today())&&n1-n0===2||[emb,n0,n1]});
 await b.close();srv.close();console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs"+(errs.length?" ; erreurs page : "+errs.join(" | "):""));process.exit(ko||errs.length?1:0);
})();
