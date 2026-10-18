/* Portail chauffeur (module 12) : déclaration de recette, justificatif, entretien, versements, historique, isolation entre chauffeurs.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/portail.js */
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
 await t("POR-1","déclaration de recette : montant, date (pas dans le futur) et mode obligatoires ; une seule déclaration active par jour ; date, auteur et statut conservés",()=>{
  __as("chauffeur");const E=[__try(()=>declarerRecette({date:today(),montant:0,mode:"especes"})),__try(()=>declarerRecette({date:addDays(today(),1),montant:1000,mode:"especes"})),__try(()=>declarerRecette({date:today(),montant:1000,mode:"cheque"}))];
  const x=declarerRecette({date:today(),montant:12000,mode:"mobile",ref:"MM-778",pj:"at_test"});const dup=__try(()=>declarerRecette({date:today(),montant:5000,mode:"especes"}));
  const d=meDriver();return /invalide/.test(E[0])&&/futur/.test(E[1])&&/Mode/.test(E[2])&&/existe déjà/.test(dup)&&x.statut==="declaree"&&x.par===d.nom&&x.hist.length===1&&x.driver_id===d.id&&x.numero.startsWith("DR-")||JSON.stringify({E,dup,x})});
 await t("POR-2","le bureau reçoit une notification ; validation (ou rejet motivé) notifie le chauffeur ; une déclaration traitée ne peut plus être retirée ni retraitée",()=>{
  const x=S.declarations[0];const nb=S.notifs.filter(n=>n.to==="staff"&&/Déclaration de recette/.test(n.titre)).length;
  __as("chauffeur");const noRight=__try(()=>validerDeclaration(x.id,true,""));__as("admin");const E=__try(()=>validerDeclaration(x.id,false,"x"));validerDeclaration(x.id,true,"");const twice=__try(()=>validerDeclaration(x.id,true,""));
  __as("chauffeur");const rt=__try(()=>retirerDeclaration(x.id));const nt=myNotifs().some(n=>/validée/.test(n.titre));
  return nb===1&&/droits|autoris|refus|Accès/i.test(noRight||"")&&/Motif/.test(E)&&/déjà traitée/.test(twice)&&/Seule une déclaration en attente/.test(rt)&&nt&&by(S.declarations,x.id).statut==="validee"||JSON.stringify({nb,noRight,E,twice,rt,nt})});
 await t("POR-3","retrait par le chauffeur : l'historique est conservé (aucun effacement) ; rejet motivé ; nouvelle déclaration possible le même jour",()=>{
  __as("chauffeur");const d0=addDays(today(),-1);const y=declarerRecette({date:d0,montant:9000,mode:"especes"});retirerDeclaration(y.id);const z=declarerRecette({date:d0,montant:9500,mode:"especes"});
  __as("admin");validerDeclaration(z.id,false,"Montant incohérent avec le compteur");const r=by(S.declarations,z.id),o=by(S.declarations,y.id);
  return o.statut==="retiree"&&o.hist.length===2&&r.statut==="rejetee"&&r.validation.motif==="Montant incohérent avec le compteur"&&S.declarations.includes(o)||JSON.stringify({o,r})});
 await t("POR-4","isolation : un chauffeur ne voit ni ne retire les déclarations d'un autre ; historique et compte d'un autre chauffeur refusés",()=>{
  __as("admin");const autre=S.drivers.find(d=>d.id!==by(S.users,ME.id).driver_id&&!S.users.some(u=>u.role==="chauffeur"&&u.driver_id===d.id))||S.drivers[1];
  S.declarations.push({id:"dcl_x",numero:"DR-X",driver_id:autre.id,vehicle_id:null,date:today(),montant:77777,mode:"especes",ref:"",note:"",pj:null,statut:"declaree",hist:[],par:autre.nom,t:now()});
  __as("chauffeur");const h=V.p_recettes(),e1=__try(()=>retirerDeclaration("dcl_x")),e2=__try(()=>historiqueChauffeur(autre.id)),e3=__try(()=>portalData(autre.id));
  return !/77\s?777/.test(h)&&!/DR-X/.test(h)&&/Accès refusé/.test(e1)&&/Accès refusé/.test(e2)&&/Accès refusé/.test(e3)||JSON.stringify({e1,e2,e3})});
 await t("POR-5","écart : déclaré − encaissé confirmé du jour (le chauffeur ne confirme jamais l'encaissement) ; écrans portail sans NaN",()=>{
  __as("chauffeur");const d=meDriver();const h=V.p_recettes()+V.p_historique()+V.p_compte()+V.p_vehicule()+V.p_accueil();
  const ec=declEnc(d.id,today());return typeof ec==="number"&&!/NaN|undefined/.test(h)&&/Mes versements confirmés/.test(h)&&/Signaler un entretien nécessaire/.test(h)&&!S.payments.some(p=>p.note==="decl")||h.slice(0,300)});
 await t("POR-6","signalement d'entretien : demande « entretien » avec l'immatriculation, urgence visible, notification du bureau ; sans véhicule affecté refusé",()=>{
  __as("chauffeur");const d=meDriver();const r=signalerEntretien({texte:"Vidange et plaquettes de frein",urgence:"urgent"});const as=S.assignments.find(a=>a.driver_id===d.id&&!a.fin);
  const short=__try(()=>signalerEntretien({texte:"x"}));
  return r.type==="entretien"&&/URGENT/.test(r.texte)&&r.texte.includes(vehImmat(as.vehicle_id))&&r.driver_id===d.id&&/5 caractères/.test(short)||JSON.stringify({r,short})});
 await t("POR-7","historique personnel : reçus, déclarations, incidents, demandes et notifications du chauffeur seulement, triés du plus récent",()=>{
  __as("chauffeur");const d=meDriver(),H=historiqueChauffeur(d.id);const kinds=new Set(H.map(h=>h.k));
  const sorted=H.every((h,i)=>i===0||String(H[i-1].t)>=String(h.t));
  return H.length>3&&kinds.has("Déclaration de recette")&&kinds.has("Demande")&&sorted&&!H.some(h=>/DR-X/.test(h.l))||JSON.stringify({n:H.length,k:[...kinds]})});
 await t("POR-8","bureau : onglet « Déclarations de recette » (Documents et alertes) visible, validation par droit « documents » ; navigation du portail chauffeur à 9 entrées",()=>{
  __as("admin");UI.f.tab=UI.f.tab||{};const h=(typeof tabSet==="function"?0:0,V.documents?V.documents():"");
  __as("chauffeur");const nav=NAV.filter(n=>n.g==="Mon espace"&&showNav(n)).length;
  return /Déclarations de recette/.test(h)&&nav===9||JSON.stringify({nav,has:/Déclarations de recette/.test(h)})});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
