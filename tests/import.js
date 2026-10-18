/* Importations de véhicules (Transport) : dossier d'achat international, devises, coûts, douane, transit, documents, alertes, transitaire.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/import.js */
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
  window.__mk=(o)=>creerImport(Object.assign({fournisseur:"Yokohama Motors",pays:"Japon",devise:"EUR",taux:655.957,date_taux:today(),cle:"valeur",transitaire:"Transit Plus"},o));
  window.__veh=(id,o)=>ajouterVehiculeImport(id,Object.assign({marque:"Toyota",modele:"Land Cruiser",annee:2021,vin:"JTM"+Math.random().toString(36).slice(2,9).toUpperCase(),prix_dev:10000,poids:2200,volume:18},o));
  window.__st=(id,k,o)=>faireEtape(id,k,Object.assign({date:today()},o||{}));
  __as("admin");S.attachments.push({id:"at_test",nom:"facture.pdf",type:"application/pdf",taille:10,t:now(),par:"t",data:"data:application/pdf;base64,AAAA"})});
 const t=async(id,label,fn,arg)=>{let r;try{r=await p.evaluate(fn,arg)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",typeof r==="string"?r:JSON.stringify(r))}};
 // 1. création
 await t("IMP-1","dossier d'achat international : contrôles (taux, clé, dates, pays, devise), référence IMP-AAAA-NNNNN, 16 étapes par défaut, historique ouvert",()=>{const b0={taux:655.957};const E=[__try(()=>__mk({taux:0})),__try(()=>__mk({cle:"x"})),__try(()=>__mk({etd:"2026-05-10",eta:"2026-05-01"})),__try(()=>__mk({pays:""})),__try(()=>__mk({devise:"ZZZ"}))];
  const d=__mk({port_depart:"Yokohama",port_arrivee:"Abidjan",conteneur:"MSCU1234567",connaissement:"BL-1",etd:addDays(today(),-10),eta:addDays(today(),20)});
  return /Taux/.test(E[0])&&/Clé/.test(E[1])&&/précède/.test(E[2])&&/Pays/.test(E[3])&&/Devise/.test(E[4])&&/^IMP-\d{4}-\d{5}$/.test(d.ref)&&d.etapes.length===16&&d.hist.length===1&&d.statut==="ouvert"||JSON.stringify(E)});
 // 2. véhicules
 await t("IMP-2","véhicules du dossier : VIN obligatoire, prix converti au taux, stock « en cours de route » (381), statut commercial « Commande en cours », vente impossible",()=>{const id0=S.imports[0].id;const E=[__try(()=>__veh(id0,{vin:""})),__try(()=>__veh(id0,{prix_dev:0,vin:"X1"}))];
  const v1=__veh(id0,{vin:"VIN-IMP-1",prix_dev:10000,poids:1000}),dup=__try(()=>__veh(id0,{vin:"VIN-IMP-1"}));const v2=__veh(id0,{vin:"VIN-IMP-2",prix_dev:5000,poids:3000});const d=S.imports[0];
  const vente=__try(()=>{__as("admin");vendreVehicule({vn_id:v1.id,date:today(),client:"X",prix:1,mode:"banque"})});
  return /VIN/.test(E[0])&&/Prix/.test(E[1])&&/existe/.test(dup)&&by(S.vn,v1.id).achat.prix===6559570&&v2.achat.prix===3279785&&impBooked(d)===9839355&&__sc(cdef("stock_route"))===9839355&&__sc(cdef("stock_veh"))===0&&statutCom(by(S.vn,v1.id))[0]==="Commande en cours"&&/non encore réceptionné/.test(vente)||JSON.stringify({E,dup,vente,r:__sc(cdef("stock_route"))})});
 // 3. règlement et change
 await t("IMP-3","règlement fournisseur en devise : perte de change (676) puis gain (776), solde exact du compte fournisseur malgré les arrondis, excédent refusé",()=>{const id=S.imports[0].id;const E=[__try(()=>reglerFournisseurImport(id,{date:today(),montant_dev:20000,taux:660,mode:"banque"})),__try(()=>reglerFournisseurImport(id,{date:today(),montant_dev:100,taux:0,mode:"banque"}))];
  reglerFournisseurImport(id,{date:today(),montant_dev:5000,taux:660,mode:"banque"});const d1=S.imports[0],r1=d1.reglements[0];reglerFournisseurImport(id,{date:today(),montant_dev:10000,taux:650,mode:"banque"});const d=S.imports[0],r2=d.reglements[1];
  const f4=__sc(cdef("fournisseur"),l=>l.tiers===d.fournisseur_id),extra=__try(()=>reglerFournisseurImport(id,{date:today(),montant_dev:1,taux:650,mode:"banque"}));
  return /supérieur/.test(E[0])&&/invalide/.test(E[1])&&r1.paye===3300000&&r1.compta===3279785&&r1.ecart===20215&&r2.paye===6500000&&r2.compta===6559570&&r2.ecart===-59570&&__sc(cdef("perte_change"))===20215&&__sc(cdef("gain_change"))===-59570&&f4===0&&impDuDev(d)===0&&impDu(d)===0&&/supérieur/.test(extra)||JSON.stringify({E,r1,r2,f4})});
 // 4. frais
 await t("IMP-4","coûts : estimations, frais facturés/payés en devise, facture unique par prestataire, véhicule du dossier, capitalisation en 381",()=>{const id=S.imports[0].id,v1=S.imports[0].vehicules[0];
  fraisImport(id,{statut:"estime",nature:"Transport maritime",estime:2500000,date:today()});fraisImport(id,{statut:"estime",nature:"Magasinage",estime:100000,date:today()});
  const E=[__try(()=>fraisImport(id,{statut:"facture",nature:"Magasinage",date:today(),prestataire:"Port",devise:"XOF",taux:1,montant_dev:5000})),__try(()=>fraisImport(id,{statut:"facture",nature:"Magasinage",date:today(),facture_no:"F1",devise:"XOF",taux:1,montant_dev:5000})),__try(()=>fraisImport(id,{statut:"facture",nature:"Magasinage",date:today(),prestataire:"Port",facture_no:"F1",devise:"XOF",taux:1,montant_dev:5000,vn_id:"inconnu"}))];
  fraisImport(id,{statut:"paye",nature:"Transport maritime",date:today(),prestataire:"Maersk",facture_no:"msk-001",devise:"USD",taux:600,montant_dev:4000,mode:"banque",pj:"at_test"});
  const dup=__try(()=>fraisImport(id,{statut:"facture",nature:"Transport maritime",date:today(),prestataire:"Maersk",facture_no:"MSK-001",devise:"USD",taux:600,montant_dev:1}));
  fraisImport(id,{statut:"facture",nature:"Manutention",date:today(),prestataire:"Transit Plus",facture_no:"TP-01",devise:"XOF",taux:1,montant_dev:300000});fraisImport(id,{statut:"facture",nature:"Transport port → parc",date:today(),prestataire:"Transit Plus",facture_no:"TP-02",devise:"XOF",taux:1,montant_dev:100000,vn_id:v1});
  const d=S.imports[0],tp=d.frais.find(f=>f.facture_no==="TP-01");payerFraisImport(id,tp.id,{date:today(),mode:"banque"});const again=__try(()=>payerFraisImport(id,tp.id,{date:today(),mode:"banque"}));
  const mk=d.frais.find(f=>f.facture_no==="MSK-001"),d2=S.imports[0];
  return /facture/i.test(E[0])&&/Prestataire/.test(E[1])&&/appartient/.test(E[2])&&/déjà enregistrée/.test(dup)&&mk.montant===2400000&&mk.statut==="paye"&&d2.frais.find(f=>f.facture_no==="TP-01").statut==="paye"&&/non payable/.test(again)&&__sc(cdef("stock_route"))===9839355+2400000+300000+100000&&cap381(d2)===12639355&&impCoutEst(d2)===2600000||JSON.stringify({E,dup,again,r:__sc(cdef("stock_route")),cap:cap381(d2)})});
 // 5. douane
 await t("IMP-5","douane : liquidation (référence obligatoire, TVA récupérable séparée), paiement avec quittance unique, excédent refusé, liquidation verrouillée après paiement",()=>{const id=S.imports[0].id;
  const E=[__try(()=>douanePayer(id,{date:today(),montant:1,mode:"banque",quittance:"Q0"})),__try(()=>douaneLiquider(id,{date:today(),liquide:1500000,tva:200000,ref_liquidation:""})),__try(()=>douaneLiquider(id,{date:today(),liquide:1000,tva:5000,ref_liquidation:"R"}))];
  douaneEstimer(id,{estime:1200000});douaneLiquider(id,{date:today(),liquide:1500000,tva:200000,conteste:100000,echeance:addDays(today(),-2),ref_liquidation:"DEC-2026-001"});
  const d=S.imports[0],al=alertesImport(d).some(a=>a.k==="er"&&/Liquidation non réglée/.test(a.m)),tva=__sc(cdef("tva_ded"),(l,e)=>e.source&&e.source.type==="imp_douane");
  const E2=[__try(()=>douanePayer(id,{date:today(),montant:1000000,mode:"banque",quittance:""})),__try(()=>douanePayer(id,{date:today(),montant:2000000,mode:"banque",quittance:"Q-1"}))];
  douanePayer(id,{date:today(),montant:1000000,mode:"banque",quittance:"Q-778",pj:"at_test"});const dup=__try(()=>douanePayer(id,{date:today(),montant:100,mode:"banque",quittance:"q-778"})),reliq=__try(()=>douaneLiquider(id,{date:today(),liquide:1600000,ref_liquidation:"X"}));
  douanePayer(id,{date:today(),montant:500000,mode:"banque",quittance:"Q-779"});const f=S.imports[0];
  return /Aucune liquidation/.test(E[0])&&/Référence/.test(E[1])&&/TVA/.test(E[2])&&al&&tva===200000&&/quittance/.test(E2[0])&&/supérieur/.test(E2[1])&&/déjà enregistrée/.test(dup)&&/déjà enregistrés/.test(reliq)&&dgRestant(f)===0&&dgCapital(f)===1300000&&f.douane.conteste===100000&&__sc(cdef("stock_route"))===12639355+1300000||JSON.stringify({E,E2,dup,reliq,r:__sc(cdef("stock_route"))})});
 // 6. étapes
 await t("IMP-6","transit : ordre chronologique, étapes non applicables motivées, références obligatoires (déclaration, mainlevée, réception), liquidation et paiement contrôlés, statut commercial suivant le dossier",()=>{const id=S.imports[0].id;const st=[];
  const E=[__try(()=>__st(id,"expedie"))];__st(id,"achat_docs");__st(id,"transport");__st(id,"expedie");st.push(statutCom(S.vn.find(v=>v.vin==="VIN-IMP-1"))[0]);__st(id,"navire_annonce");__st(id,"arrive_port");st.push(statutCom(S.vn.find(v=>v.vin==="VIN-IMP-1"))[0]);__st(id,"debarque");__st(id,"remis_transit");__st(id,"docs_douane");
  E.push(__try(()=>__st(id,"declaration",{preuve:""})));__st(id,"declaration",{preuve:"DEC-2026-001"});E.push(__try(()=>__st(id,"liquidation")));E.push(__try(()=>naEtape(id,"controle","")));naEtape(id,"controle","Pas de contrôle (voie verte)");
  __st(id,"liquidation");__st(id,"paiement");E.push(__try(()=>__st(id,"mainlevee")));__st(id,"mainlevee",{preuve:"ML-55"});st.push(statutCom(S.vn.find(v=>v.vin==="VIN-IMP-1"))[0]);__st(id,"enlevement");__st(id,"transport_parc");E.push(__try(()=>naEtape(id,"reception","x")));const d=S.imports[0];
  return /précédente/.test(E[0])&&/obligatoire/.test(E[1])&&/précédente/.test(E[2])&&/Motif/.test(E[3])&&/obligatoire/.test(E[4])&&/obligatoire/.test(E[5])&&st.join()==="En transit,En douane,Dédouané"&&d.ref_douane==="DEC-2026-001"&&d.arrivee_reelle===today()&&d.hist.length===16||JSON.stringify({E,st,h:d.hist.length})});
 // 7. réception
 await t("IMP-7","réception : coût capitalisé réparti entre les véhicules (valeur), 381 soldé, stock 3111 = coût total, dossier clos, véhicules vendables ; réception refusée sans pièce",()=>{const id=S.imports[0].id;const E=__try(()=>__st(id,"reception",{preuve:""}));__st(id,"reception",{preuve:"BR-001"});
  const d=S.imports[0],V=impVeh(d),c1=vnCout(V[0]),c2=vnCout(V[1]);
  return /obligatoire/.test(E)&&d.statut==="clos"&&V.every(v=>v.statut==="stock")&&c1===9326237&&c2===4613118&&c1+c2===13939355&&__sc(cdef("stock_route"),(l,e)=>e.source&&e.source.id===d.id)===0&&__sc(cdef("stock_veh"))===13939355&&statutCom(V[0])[0]==="Disponible à la vente"&&impStatut(d).includes("clos")||JSON.stringify({E,c1,c2,sr:__sc(cdef("stock_route"),(l,e)=>e.source&&e.source.id===d.id),sv:__sc(cdef("stock_veh"))})});
 await t("IMP-8","véhicule importé vendu après réception : coût de revient réparti, marge exacte, écriture de sortie de stock",()=>{const v=S.imports[0].vehicules[0];const x=vendreVehicule({vn_id:v,date:today(),client:"Kouassi",prix:11000000,mode:"banque",encaisse:11000000});const vv=by(S.ventes_veh,x.id);
  return vv.cout===9326237&&vv.ht===11000000&&vvMarge(vv)===1673763&&__sc(cdef("stock_veh"))===13939355-9326237||JSON.stringify({c:vv.cout,m:vvMarge(vv)})});
 // clé poids
 await t("IMP-9","clé de répartition « poids » : parts exactes au franc près (1 000 001 F), poids obligatoire",()=>{const d=__mk({cle:"poids"});const E=__try(()=>__veh(d.id,{vin:"P0",poids:0}));const a=__veh(d.id,{vin:"P1",prix_dev:1000,poids:1000}),c=__veh(d.id,{vin:"P2",prix_dev:1000,poids:3000});
  fraisImport(d.id,{statut:"facture",nature:"Assurance transport",date:today(),prestataire:"AXA",facture_no:"AX-1",devise:"XOF",taux:1,montant_dev:1000001});
  const D=S.imports.find(i=>i.id===d.id);receptionImport(D,today(),"R");const v1=vnCout(by(S.vn,a.id)),v2=vnCout(by(S.vn,c.id));
  return /Poids/.test(E)&&v1===905957&&v2===1405958&&v1+v2===cap381(D)&&__sc(cdef("stock_route"),(l,e)=>e.source&&e.source.id===d.id)===0||JSON.stringify({E,v1,v2,cap:cap381(D)})});
 // alertes
 await t("IMP-10","alertes : retard d'expédition et d'arrivée, franchise dépassée, liquidation échue, frais portuaires > prévu (+10 %), dossier bloqué, absence de mise à jour, arrivée imminente",()=>{
  const d=__mk({etd:addDays(today(),-10),eta:addDays(today(),-3),franchise_fin:addDays(today(),-1)});const id=d.id;
  fraisImport(id,{statut:"estime",nature:"Magasinage",estime:100000,date:today()});fraisImport(id,{statut:"facture",nature:"Manutention",date:today(),prestataire:"Port",facture_no:"PT-9",devise:"XOF",taux:1,montant_dev:150000});
  bloquerImport(id,{cause:"paiement",note:"Attente fonds"});const x=S.imports.find(i=>i.id===id);x.hist[x.hist.length-1].t=new Date(Date.now()-9*864e5).toISOString();
  const M=alertesImport(S.imports.find(i=>i.id===id)).map(a=>a.m).join(" | ");
  const e=__mk({eta:addDays(today(),3)});const M2=alertesImport(S.imports.find(i=>i.id===e.id)).map(a=>a.m).join(" | ");
  return /Retard d'expédition/.test(M)&&/Retard d'arrivée/.test(M)&&/Franchise dépassée/.test(M)&&/Frais portuaires/.test(M)&&/bloqué/.test(M)&&/Aucune mise à jour/.test(M)&&/Arrivée imminente/.test(M2)||M+" // "+M2});
 await t("IMP-11","alertes liées aux étapes : déclaration non déposée, mainlevée attendue, dédouané non enlevé, enlevé non réceptionné, contrôle en attente",()=>{
  const mk=(upto,pas)=>{const d=__mk({});let hit=false;const D=S.imports.find(i=>i.id===d.id);D.etapes.forEach(e=>{if(hit)return;e.fait={date:addDays(today(),-pas),t:now(),par:"t"};if(e.k===upto)hit=true});D.hist[D.hist.length-1].t=now();return D};
  const A=D=>alertesImport(D).map(a=>a.m).join(" | ");
  return /Déclaration non déposée/.test(A(mk("docs_douane",5)))&&/Contrôle en attente/.test(A(mk("declaration",1)))&&/Mainlevée non obtenue/.test(A(mk("paiement",5)))&&/non encore enlevé/.test(A(mk("mainlevee",4)))&&/non réceptionné/.test(A(mk("enlevement",4)))||"alertes d'étapes"});
 // documents
 await t("IMP-12","documents : manquants calculés selon l'avancement, ajout par fichier ou référence, pièce inconnue refusée, mention de liste indicative",()=>{const d=__mk({});const id=d.id;__st(id,"achat_docs");
  const m1=impDocsManquants(S.imports.find(i=>i.id===id));const E=[__try(()=>docImport(id,{type:"facture_com"})),__try(()=>docImport(id,{type:"facture_com",pj:"nope"})),__try(()=>docImport(id,{type:"zzz",ref:"x"}))];
  docImport(id,{type:"facture_com",pj:"at_test"});const m2=impDocsManquants(S.imports.find(i=>i.id===id));
  return m1.join()==="Facture commerciale"&&m2.length===0&&/Joindre/.test(E[0])&&/introuvable/.test(E[1])&&/invalide/.test(E[2])||JSON.stringify({m1,m2,E})});
 // transitaire
 await t("IMP-13","transitaire externe : ne voit que ses dossiers, actualise les étapes ouvertes à l'externe, propose des frais (non comptabilisés) validés ensuite par l'interne ; aucun accès à la comptabilité ni aux paiements",()=>{
  const u={id:uid("u"),nom:"Transit Plus Abidjan",role:"transitaire",actif:true};u.h=hashPin(u.id,"4242");S.users.push(u);
  const d=__mk({transitaire_user:u.id}),o=__mk({});const id=d.id;__st(id,"achat_docs");__st(id,"transport");__st(id,"expedie");const nE=S.entries.length;
  ME=by(S.users,u.id);const R={};R.vis=impVisibles().map(x=>x.id).join()===id;R.creer=__try(()=>__mk({}));R.autre=__try(()=>__st(o.id,"navire_annonce"));R.interne=__try(()=>__st(id,"paiement"));
  __st(id,"navire_annonce");__st(id,"arrive_port");R.paie=__try(()=>__st(id,"debarque",{}))===null;R.reserve=__try(()=>__st(id,"remis_transit",{}))===null;
  R.est=__try(()=>fraisImport(id,{statut:"estime",nature:"Magasinage",estime:10,date:today()}));fraisImport(id,{statut:"facture",nature:"Manutention",date:today(),prestataire:"Transit Plus",facture_no:"TPA-1",devise:"XOF",taux:1,montant_dev:80000});
  const fr=S.imports.find(x=>x.id===id).frais[0];R.prop=fr.statut==="propose"&&S.entries.length===nE;R.dg=__try(()=>douaneLiquider(id,{date:today(),liquide:10,ref_liquidation:"X"}));R.pay=__try(()=>reglerFournisseurImport(id,{date:today(),montant_dev:1,taux:650,mode:"banque"}));R.val=__try(()=>validerFraisPropose(id,fr.id,true));
  docImport(id,{type:"connaissement",ref:"BL-7"});bloquerImport(id,{cause:"transitaire",note:"Attente quai",sortie_prevue:addDays(today(),5)});R.nav=NAV.filter(showNav).map(n=>n.v).join();
  view="impexp";UI.imp=id;render();R.vue=document.getElementById("app").innerText;UI.imp=null;
  __as("admin");validerFraisPropose(id,fr.id,true);const f2=S.imports.find(x=>x.id===id).frais[0];
  return R.vis&&/Droits insuffisants/.test(R.creer)&&/non attribué/.test(R.autre)&&/réservée/.test(R.interne)&&R.paie&&/estimations/.test(R.est)&&R.prop&&/Accès refusé/.test(R.dg)&&/Accès refusé/.test(R.pay)&&/Accès refusé/.test(R.val)&&R.nav==="impexp"&&!/Règlements au fournisseur|Droits et taxes|Trésorerie/.test(R.vue)&&f2.statut==="facture"&&S.entries.length>nE&&S.imports.find(x=>x.id===id).blocage.cause==="transitaire"||JSON.stringify(R).slice(0,500)});
 await t("IMP-14","réception bloquée tant que des frais proposés par le transitaire attendent validation",()=>{const u=S.users.find(x=>x.role==="transitaire"),d=__mk({transitaire_user:u.id});__veh(d.id,{vin:"PRO-1"});__as("transitaire");fraisImport(d.id,{statut:"facture",nature:"Manutention",date:today(),prestataire:"Transit Plus",facture_no:"TPA-9",devise:"XOF",taux:1,montant_dev:1000});__as("admin");
  const D=S.imports.find(i=>i.id===d.id);return /à valider/.test(__try(()=>receptionImport(D,today(),"BR"))||"")||"réception possible"});
 // configuration
 await t("IMP-15","étapes configurables : la réception est obligatoire, les nouveaux dossiers suivent la configuration, les dossiers ouverts gardent la leur ; comptable sans droit",()=>{const tous=IMP_ETAPES_DEF.map(x=>x[0]);const n0=S.imports[0].etapes.length;const E=__try(()=>configurerEtapes(tous.filter(k=>k!=="reception")));configurerEtapes(tous.filter(k=>k!=="controle"&&k!=="transport_parc"));const d=__mk({});
  __as("comptable");const c=__try(()=>configurerEtapes(tous));__as("admin");configurerEtapes(tous);return /obligatoire/.test(E)&&d.etapes.length===14&&!d.etapes.some(e=>e.k==="controle")&&S.imports[0].etapes.length===n0&&/Droits insuffisants/.test(c)&&__mk({}).etapes.length===16||JSON.stringify({E,n:d.etapes.length,c})});
 // périmètre
 await t("IMP-16","revente à l'export d'un véhicule importé dans un autre pays de la sous-région : pays obligatoire, sans TVA, ventes 7012, suivi d'expédition avec documents et références, droits",()=>{
  const v=S.imports[0].vehicules[1];const e1=__try(()=>vendreVehicule({vn_id:v,date:today(),client:"Mensah Kofi",prix:6000000,export:"oui",mode:"banque"}));
  const x=vendreVehicule({vn_id:v,date:today(),client:"Mensah Kofi",prix:6000000,export:"oui",pays:"Ghana",mode:"banque",encaisse:2000000});const id=x.id;
  const E=[__try(()=>etapeExport(id,{statut:"expedie",ref_transport:"BL-X1"}))];docExport(id,0);docExport(id,1);E.push(__try(()=>etapeExport(id,{statut:"expedie",ref_transport:""})));etapeExport(id,{statut:"expedie",ref_transport:"BL-X1",transport:"Maritime"});
  const E2=[__try(()=>etapeExport(id,{statut:"livre"}))];docExport(id,3);etapeExport(id,{statut:"livre",note:"Remis à l'acheteur"});const back=__try(()=>etapeExport(id,{statut:"expedie",ref_transport:"Z"}));
  __as("caissier");const cais=__try(()=>docExport(id,2));__as("admin");const vv=S.ventes_veh.find(y=>y.id===id),e=by(S.entries,vv.entry_id);
  return /Pays/.test(e1)&&vv.export&&vv.pays==="Ghana"&&vv.tva===0&&vv.ht===6000000&&vv.cout===4613118&&vvMarge(vv)===1386882&&__sc(cdef("vente_veh_exp"))===-6000000&&cdef("vente_veh_exp")==="7012"&&sum(e.lines,l=>l.debit)===sum(e.lines,l=>l.credit)
   &&/Documents manquants/.test(E[0])&&/Référence de transport/.test(E[1])&&/Documents manquants/.test(E2[0])&&vv.exp.statut==="livre"&&vv.exp.ref_transport==="BL-X1"&&vv.exp.hist.length===3&&/avancer/.test(back)&&/Droits insuffisants/.test(cais)||JSON.stringify({e1,E,E2,back,cais,m:vvMarge(vv)})});
 // écrans
 const vw=await p.evaluate(()=>{__as("admin");const R={};UI.imp=null;view="impexp";render();R.liste=document.getElementById("app").innerText;const d=S.imports[0];UI.imp=d.id;R.tabs={};for(const k of["apercu","achat","couts","douane","transit","docs"]){UI.tab.impd=k;render();R.tabs[k]=document.getElementById("app").innerText}UI.imp=null;UI.tab.impd="apercu";
  R.csv=CSVS.impexp()[1].length;view="achats_veh";render();R.achats=document.getElementById("app").innerText;return R});
 const bad=/NaN|undefined/.test(JSON.stringify(vw));
 const T=vw.tabs;const okv=/Importations — transit et douane/.test(vw.liste)&&/IMP-/.test(vw.liste)&&/Alertes à traiter/.test(vw.liste)&&/Véhicules/.test(T.apercu)&&/Total à payer au fournisseur/.test(T.achat)&&/Estimé \/ réel/.test(T.couts)&&/Montant liquidé/.test(T.douane)&&/Historique/.test(T.transit)&&/Liste indicative/.test(T.docs)&&/Importés en cours d'acheminement/.test(vw.achats)&&vw.csv>0;
 console.log(okv&&!bad?"PASS IMP-17 écrans : liste, six onglets du dossier, achats, CSV ; sans NaN":"FAIL IMP-17 écrans "+bad+" "+JSON.stringify(vw).slice(0,300));okv&&!bad?ok++:ko++;
 await t("IMP-18","comptabilité : toutes les écritures équilibrées, balance générale équilibrée, 381 soldé pour le dossier réceptionné",()=>{const bad=S.entries.filter(e=>sum(e.lines,l=>l.debit)!==sum(e.lines,l=>l.credit));const D=sum(S.entries.flatMap(e=>e.lines),l=>l.debit),C=sum(S.entries.flatMap(e=>e.lines),l=>l.credit);return bad.length===0&&D===C&&__sc(cdef("stock_route"),(l,e)=>e.source&&e.source.id===S.imports[0].id)===0||bad.length});
 await p.evaluate(()=>{__as("admin");UI.imp=S.imports[0].id;UI.tab.impd="couts";view="impexp";render()});await p.screenshot({path:process.env.SHOT||"/tmp/import.png"});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
