/* Stock commercial, ventes (devis → facture → échéancier → livraison), clients, alertes, tableau commercial, nouveaux profils (Transport).
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/stock.js */
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
 // 1. transit et disponibilité
 await t("STK-1","véhicule en transit ou en douane : jamais « disponible » ; vente refusée ; précommande uniquement avec confirmation explicite et statut explicite",()=>{
  const d=creerImport({fournisseur:"Yokohama",pays:"Japon",devise:"EUR",taux:655.957,date_taux:today(),cle:"valeur"});const v=ajouterVehiculeImport(d.id,{marque:"Nissan",modele:"Patrol",vin:"IMP-STK-1",prix_dev:10000,poids:2000,volume:15});
  faireEtape(d.id,"achat_docs",{date:today()});faireEtape(d.id,"transport",{date:today()});faireEtape(d.id,"expedie",{date:today()});const vid=v.id;
  const s1=statutCom(by(S.vn,vid))[0],e1=__try(()=>__vente(vid,{})),e2=__try(()=>reserverVN({vn_id:vid,client:"Mensah",date:today()}));
  const r=reserverVN({vn_id:vid,client:"Mensah",date:today(),precommande:"oui"});const s2=statutCom(by(S.vn,vid))[0];
  const dispo=S.vn.filter(x=>x.statut==="stock"&&!resActive(x)).some(x=>x.id===vid);
  return s1==="En transit"&&/non encore réceptionné/.test(e1)&&/précommande/i.test(e2)&&r.type==="precommande"&&/Précommandé — En transit \(non disponible physiquement\)/.test(s2)&&!dispo||JSON.stringify({s1,e1,e2,s2})});
 // 2. contrôle de réception, localisation
 await t("STK-2","contrôle de réception et dommages ; localisation et historique des transferts (motif obligatoire, pas de doublon d'emplacement)",()=>{
  const v=__ach({vin:"VIN-A1"});const id=v.id;const E=[__try(()=>ctrlReception(id,{date:today(),etat:"dommages"})),__try(()=>ctrlReception(S.vn.find(x=>x.vin==="IMP-STK-1").id,{date:today(),etat:"conforme"}))];
  ctrlReception(id,{date:today(),etat:"dommages",dommages:"Pare-chocs avant enfoncé",cout_est:150000});const c=ctrlDe(by(S.vn,id));
  const T=[__try(()=>transfererVN(id,{loc:"",motif:"x"})),__try(()=>transfererVN(id,{loc:"Zone A",motif:""}))];transfererVN(id,{loc:"Zone A — emplacement 3",motif:"Arrivée au parc"});const same=__try(()=>transfererVN(id,{loc:"Zone A — emplacement 3",motif:"test"}));transfererVN(id,{loc:"Atelier",motif:"Réparation pare-chocs"});
  __as("comptable");const dr=__try(()=>ctrlReception(id,{date:today(),etat:"conforme"}));__as("admin");const v2=by(S.vn,id);
  return /dommages/i.test(E[0])&&/entré en stock/.test(E[1])&&c.etat==="dommages"&&c.cout_est===150000&&/Nouvelle localisation/.test(T[0])&&/Motif/.test(T[1])&&/déjà à cet emplacement/.test(same)&&v2.loc==="Atelier"&&v2.transferts.length===2&&v2.transferts[0].de==="—"&&/Droits insuffisants/.test(dr)||JSON.stringify({E,T,same,dr})});
 // 3. réservations
 await t("STK-3","réservation : un seul client, vente à un autre client refusée, conversion en vente, annulation motivée par un responsable habilité, retour en stock disponible, historique conservé",()=>{
  const v=__ach({vin:"VIN-R1"});const id=v.id;const r=reserverVN({vn_id:id,client:"Awa Traoré",tel:"0707000001",date:today()});const dup=__try(()=>reserverVN({vn_id:id,client:"Autre",date:today()}));
  const s=statutCom(by(S.vn,id))[0],autre=__try(()=>__vente(id,{client:"Un autre client"}));
  __as("commercial_auto");const nm=__try(()=>annulerReservation(r.id,"Le client a changé d'avis"));__as("admin");const court=__try(()=>annulerReservation(r.id,"non"));annulerReservation(r.id,"Le client a changé d'avis");const rr=by(S.reservations,r.id);
  const apres=statutCom(by(S.vn,id))[0];const r2=reserverVN({vn_id:id,client:"Awa Traoré",date:today()});const x=__vente(id,{client:"Awa Traoré"});const r2b=by(S.reservations,r2.id);
  return /déjà réservé/.test(dup)&&/Réservé — Awa Traoré/.test(s)&&/réservé pour Awa/.test(autre)&&/Droits insuffisants/.test(nm)&&/Motif/.test(court)&&rr.statut==="annulee"&&rr.annulation.motif.includes("changé d'avis")&&rr.hist.length===2&&apres==="Disponible à la vente"&&r2b.statut==="convertie"&&r2b.vente_id===x.id||JSON.stringify({dup,s,autre,nm,court,apres,st:r2b.statut})});
 // 4. inventaire
 await t("STK-4","inventaire par châssis : comptage, excédent, véhicule non attendu refusé, motif obligatoire par écart, manquant déclaré disparu (écriture au coût), retrouvé (extourne) ; validation réservée",()=>{
  const a=__ach({vin:"INV-1"}),b2=__ach({vin:"INV-2"}),c=__ach({vin:"INV-3"});const inv=ouvrirInventaireVN(),id=inv.id;
  const E=[__try(()=>ouvrirInventaireVN()),__try(()=>compterVN(id,"IMP-STK-1")),null];
  const r1=compterVN(id,"inv-1"),r2=compterVN(id,"INV-2"),dup=__try(()=>compterVN(id,"INV-2")),ex=compterVN(id,"CHASSIS-INCONNU","Trouvé sur le parking");
  __as("stock_auto");const sv=__try(()=>validerInventaireVN(id,{}));__as("admin");
  const nomot=__try(()=>validerInventaireVN(id,{}));const manq=S.inventaires_vn.find(i=>i.id===id).lignes.filter(l=>!l.compte).length;const motifs={};S.inventaires_vn.find(i=>i.id===id).lignes.filter(l=>!l.compte).forEach(l=>motifs[l.vn_id]="Introuvable au parc après recherche");motifs.h0="Véhicule d'un client en dépôt";
  const s0=__sc(cdef("stock_veh"));validerInventaireVN(id,motifs);const I=S.inventaires_vn.find(i=>i.id===id);const dis=S.vn.filter(v=>v.statut==="disparu");
  const nv=by(S.vn,c.id);const retro=dis.length?dis[0]:null;const s1=__sc(cdef("stock_veh"));
  const id0=retro.id;retrouverVN(id0,"Retrouvé chez le carrossier");const s2=__sc(cdef("stock_veh")),v0=by(S.vn,id0);
  return /déjà ouvert/.test(E[0])&&/non attendu|connu/.test(E[1])&&r1==="présent"&&ex==="excédent"&&/déjà compté/.test(dup)&&/Droits insuffisants/.test(sv)&&/Motif obligatoire/.test(nomot)&&I.statut==="valide"&&I.ecarts.some(e=>e.type==="excedent")&&dis.length===manq&&manq>=1&&s1<s0&&s2===s1+vnCout(v0)&&v0.statut==="stock"||JSON.stringify({E,dup,sv,nomot,manq,dis:dis.length,s0,s1,s2})});
 // 5. devis
 await t("STK-5","devis : contrôles (prix, acompte, vente à perte motivée, export avec pays), validation par un responsable habilité, facture impossible avant validation, devis expiré refusé",()=>{
  const v=__ach({vin:"DEV-1"}),vid=v.id;const base={vn_id:vid,date:today(),client:"Koné Ibrahim",tel:"0505000002",prix:1534000,acompte:500000,nb_ech:3,date_ech1:addDays(today(),30),pas:30};
  const E=[__try(()=>creerDevis({...base,prix:0})),__try(()=>creerDevis({...base,acompte:2000000})),__try(()=>creerDevis({...base,prix:900000})),__try(()=>creerDevis({...base,export:"oui"}))];
  const d=creerDevis(base),id=d.id;const e5=__try(()=>facturerDevis(id,{mode:"banque"}));__as("commercial_auto");const e6=__try(()=>validerDevis(id));__as("directeur");validerDevis(id);__as("admin");
  const dv=by(S.devis,id),perte=creerDevis({...base,prix:900000,motif_perte:"Liquidation de stock ancien"});
  const old=creerDevis({...base,date:addDays(today(),-40),validite:addDays(today(),-10)});validerDevis(old.id);const e7=__try(()=>facturerDevis(old.id,{mode:"banque"}));
  return /invalide/.test(E[0])&&/Acompte/.test(E[1])&&/inférieur au coût/.test(E[2])&&/Pays/.test(E[3])&&dv.statut==="valide"&&dv.valide_par&&/validé/.test(e5)&&/Droits insuffisants/.test(e6)&&perte.perte&&/expiré/.test(e7)&&dv.echeancier.length===3&&sum(dv.echeancier,e=>e.montant)===1034000||JSON.stringify({E,e5,e6,e7})});
 // 6. facture, acompte, échéancier
 await t("STK-6","facture depuis le devis : acompte réellement encaissé, solde dû = total − paiements, échéancier cohérent, paiements imputés dans l'ordre (partiel, anticipé), retards, reçus numérotés correspondant aux montants encaissés",()=>{
  const d=S.devis.find(x=>x.statut==="valide"&&x.acompte===500000),x=facturerDevis(d.id,{mode:"banque",acompte:500000});const id=x.id;let X=by(S.ventes_veh,id);
  const n1=X.facture_no,e0=echeancierEtat(X),encA=vvEnc(X);const rec1=X.encaissements[0].recu;
  encaisserVente(id,{montant:200000,mode:"banque",date:today()});X=by(S.ventes_veh,id);const e1=echeancierEtat(X);
  encaisserVente(id,{montant:600000,mode:"mobile",date:today()});X=by(S.ventes_veh,id);const e2=echeancierEtat(X);
  X.echeancier.forEach((e,i)=>{e.date=addDays(today(),-30+10*i)});const e3=echeancierEtat(X),al=alertesCentre().A.some(a=>a.key==="ech:"+id);
  const rec=X.encaissements.map(e=>e.recu);const total=sum(X.encaissements,e=>e.montant);
  return /^FAC-\d{4}-\d{5}$/.test(n1)&&encA===500000&&vvReste(X)===1534000-500000-200000-600000&&e0.length===3&&e0.every(e=>e.paye===0)&&e1[0].paye===200000&&e1[0].reste===e1[0].montant-200000&&e2[0].reste===0&&e2.filter(e=>e.paye>0).length>=2&&e3.some(e=>e.retard>0)&&e3[2].reste>0&&al&&rec.every(r=>/^REC-VV-/.test(r))&&new Set(rec).size===rec.length&&total===X.acompte+800000&&X.statut==="facturee"&&by(S.devis,d.id).statut==="converti"||JSON.stringify({e0:e0.map(e=>e.paye),e1:e1.map(e=>e.paye),e2:e2.map(e=>[e.paye,e.reste]),reste:vvReste(X),rec})});
 await t("STK-7","échéancier : total différent du solde refusé, modification tracée dans l'historique",()=>{const X=S.ventes_veh.find(x=>x.echeancier.length===3),id=X.id,reste0=X.prix-X.acompte;
  const e1=__try(()=>definirEcheancier(id,[{date:addDays(today(),10),montant:100000}])),e2=__try(()=>definirEcheancier(id,[{date:"2020-01-01",montant:reste0}]));
  definirEcheancier(id,[{date:addDays(today(),15),montant:Math.floor(reste0/2)},{date:addDays(today(),45),montant:reste0-Math.floor(reste0/2)}]);const Y=by(S.ventes_veh,id);
  return /doit égaler/.test(e1)&&/valide/.test(e2)&&Y.echeancier.length===2&&Y.hist.some(h=>/Échéancier modifié/.test(h.note))||JSON.stringify({e1,e2})});
 // 7. livraison
 await t("STK-8","livraison : autorisation d'un responsable habilité, dérogation motivée si solde dû, statut physique, documents requis, kilométrage ; clôture quand le solde est réglé",()=>{
  const X0=S.ventes_veh.find(x=>x.echeancier.length===2),id=X0.id,full={date:today(),statut_physique:"present",etat:"conforme",km:31000,doc0:"oui",doc1:"oui",doc2:"oui",doc3:"oui",doc4:"oui",responsable:"Chef de parc",preuve_ref:"BR-001"};
  const E=[__try(()=>livrerVente(id,full))];__as("commercial_auto");E.push(__try(()=>autoriserLivraison(id,{derogation:"Client connu"})));__as("directeur");E.push(__try(()=>autoriserLivraison(id,{derogation:""})));autoriserLivraison(id,{derogation:"Client fidèle, solde réglé sous 45 jours"});__as("commercial_auto");
  E.push(__try(()=>livrerVente(id,{...full,statut_physique:"absent"})));E.push(__try(()=>livrerVente(id,{...full,doc2:"non"})));E.push(__try(()=>livrerVente(id,{...full,km:100})));
  livrerVente(id,full);let X=by(S.ventes_veh,id);const v=vnById(X.vn_id),s1=statutCom(v)[0],e1=etatVente(X)[0],liv=X.livraison;
  const mv=__try(()=>{__as("admin");transfererVN(v.id,{loc:"Zone B",motif:"test"})});
  __as("admin");encaisserVente(id,{montant:vvReste(X),mode:"banque",date:today()});X=by(S.ventes_veh,id);
  return /non autorisée/.test(E[0])&&/Droits insuffisants/.test(E[1])&&/dérogation/.test(E[2])&&/physique/.test(E[3])&&/Documents requis non remis/.test(E[4])&&/Kilométrage/.test(E[5])&&liv.statut==="livree"&&liv.docs.length===5&&liv.solde>0&&liv.autorise.derogation&&s1==="Livré"&&/solde dû/.test(e1)&&/présent au parc/.test(mv)&&X.statut==="cloturee"&&vvReste(X)===0||JSON.stringify({E,s1,e1,mv,st:X.statut})});
 await t("STK-9","livraison d'un véhicule importé non réceptionné impossible",()=>{const d=S.imports[0],vid=d.vehicules[0];
  // un véhicule importé réceptionné par erreur en base de test : forcer le cas pour vérifier la règle
  const v=__ach({vin:"IMP-FAKE"});by(S.vn,v.id).import_id=d.id;const x=__vente(v.id,{client:"Client Import"});autoriserLivraison(x.id,{derogation:"Test de règle sur solde"});
  const e=__try(()=>livrerVente(x.id,{date:today(),statut_physique:"present",etat:"conforme",km:40000,doc0:"oui",doc1:"oui",doc2:"oui",doc3:"oui",doc4:"oui"}));return/non réceptionné/.test(e)||e});
 // 8. annulation de vente
 await t("STK-10","annulation de vente : motif, refusée si livrée ou encaissée, sinon écritures extournées (historique conservé), véhicule de nouveau en stock, exclue des chiffres",()=>{
  const v=__ach({vin:"ANN-1"}),x=__vente(v.id,{client:"Client Annulation",encaisse:0}),id=x.id;const e1=__try(()=>annulerVente(id,"x"));
  __as("commercial_auto");const e2=__try(()=>annulerVente(id,"Le client se rétracte"));__as("admin");
  const y=__vente(__ach({vin:"ANN-2"}).id,{client:"Client Payé",encaisse:100000}),e3=__try(()=>annulerVente(y.id,"Annulation test"));const ca0=sum(ventesActives(),w=>w.ht);
  const nb0=S.entries.length;annulerVente(id,"Le client se rétracte avant livraison");const X=by(S.ventes_veh,id),vv=by(S.vn,v.id);const ext=S.entries.filter(e=>e.source&&e.source.type==="extourne"&&S.entries.some(o=>o.id===e.source.id&&o.source&&o.source.id===id));
  const ca1=sum(ventesActives(),z=>z.ht);const soldeCli=__sc(cdef("client_veh"),l=>l.tiers===x.client_id);
  return /Motif/.test(e1)&&/Droits insuffisants/.test(e2)&&/encaissements/.test(e3)&&X.statut==="annulee"&&X.annulation.motif.includes("rétracte")&&vv.statut==="stock"&&ext.length===2&&ca1===ca0-X.ht&&soldeCli===0&&X.hist.length===2&&S.entries.length>nb0||JSON.stringify({e1,e2,e3,ext:ext.length,soldeCli,ca0,ca1})});
 // 9. clients
 await t("STK-11","clients : fiche (coordonnées, pièce, documents), doublon refusé, historique (devis, réservations, factures, paiements) et solde dû",()=>{
  const c=clientVN({nom:"Société Alpha",tel:"0707111111",email:"alpha@ex.ci",adresse:"Cocody",piece_type:"rccm",piece_no:"CI-ABJ-2020-B-1234"});const dup=__try(()=>clientVN({nom:"société alpha"})),dup2=__try(()=>clientVN({id:S.tiers_vn.find(t=>t.type==="client_veh"&&t.nom==="Koné Ibrahim").id,nom:"Société Alpha"}));
  docClientVN(c.id,{type:"identite",ref:"CNI-778"});const e=__try(()=>docClientVN(c.id,{type:"identite"}));
  __vente(__ach({vin:"CLI-1"}).id,{client:"Client Solde",encaisse:100000});const k=S.tiers_vn.find(t=>t.nom==="Client Solde");const solde=clientSolde(k.id),h=S.ventes_veh.filter(x=>x.client_id===k.id).length;
  A["cl.det"](k.id);const txt=document.querySelector(".md").innerText;document.querySelector(".md").remove();
  const c2=by(S.tiers_vn,c.id);return c2.piece_no&&c2.docs.length===1&&/déjà ce nom/.test(dup)&&/déjà ce nom/.test(dup2)&&/Joindre/.test(e)&&solde>0&&h===1&&/Solde restant dû/.test(txt)&&/Factures/.test(txt)&&/Paiements/.test(txt)&&/REC-VV-/.test(txt)&&!/NaN|undefined/.test(txt)||JSON.stringify({dup,dup2,e,solde,h,k:/Factures/.test(txt),p:/Paiements/.test(txt),r:/REC-VV-/.test(txt),nan:(txt.match(/.{20}(NaN|undefined).{10}/)||[])[0],d:c2&&c2.docs&&c2.docs.length})});
 // 10. alertes
 await t("STK-12","centre d'alertes : domaines couverts, priorité, responsable, date de création stable, cycle de traitement (note obligatoire), disparition quand la situation est résolue",()=>{
  const v=__ach({vin:"ALR-1"});const r1=reserverVN({vn_id:v.id,client:"Client Alerte",date:addDays(today(),-20),expire:addDays(today(),-10)});
  const d=creerImport({fournisseur:"Fournisseur X",pays:"Chine",devise:"USD",taux:600,date_taux:today(),cle:"valeur",etd:addDays(today(),-10),eta:addDays(today(),-2)});
  const A=alertesCentre().A,types=new Set(A.map(a=>a.type)),k=A.find(a=>/Réservation .* expirée/.test(a.msg)),i=A.find(a=>/Retard d'expédition/.test(a.msg)),dis=A.find(a=>/Contrôle de réception à faire/.test(a.msg));
  const c0=k.cree;majAlerte(k.key,"en_cours","");const e1=__try(()=>majAlerte(k.key,"traitee","ok"));majAlerte(k.key,"traitee","Client rappelé : réservation prolongée");let st=alertesCentre().A.find(a=>a.key===k.key);const trait=st.statut==="traitee"&&st.note.includes("rappelé")&&st.par;
  annulerReservation(r1.id,"Réservation expirée, véhicule remis en vente");const gone=!alertesCentre().A.some(a=>a.key===k.key)&&!S.alertes_etat[k.key];
  return types.has("import")&&types.has("stock")&&types.has("vente")&&k.type==="vente"&&k.niveau==="moyenne"&&i.niveau==="haute"&&/Responsable importation|—/.test(i.responsable||"—")&&dis.responsable==="Gestionnaire de stock"&&i.responsable==="Responsable importation"&&c0===today()&&/Décrire/.test(e1)&&trait&&gone||JSON.stringify({types:[...types],k:k&&k.niveau,i:i&&i.responsable,dis:dis&&dis.responsable,e1,trait,gone})});
 // 11. profils
 await t("STK-13","nouveaux profils : comptes de démonstration, périmètres (stock : contrôle sans vente ; commercial : devis sans validation ; importateur : dossiers sans vente), hub à jour",()=>{
  const R=["importateur","stock_auto","commercial_auto"];const has=R.every(r=>S.users.some(u=>u.role===r&&u.actif));const c=(r,m)=>(S.perms[r][m]||[]).join("");
  __as("stock_auto");const v=S.vn.find(x=>x.statut==="stock"),a=__try(()=>vendreVehicule({vn_id:v.id,date:today(),client:"X",prix:1000000,mode:"banque"})),b=__try(()=>ctrlReception(v.id,{date:today(),etat:"conforme"}));
  __as("commercial_auto");const d=__try(()=>creerDevis({vn_id:v.id,date:today(),client:"Test Comm",prix:1600000})),e=__try(()=>validerDevis(S.devis[S.devis.length-1].id)),f=__try(()=>ctrlReception(v.id,{date:today(),etat:"conforme"}));
  __as("importateur");const g=__try(()=>creerImport({fournisseur:"F",pays:"Japon",devise:"EUR",taux:655.957,date_taux:today(),cle:"valeur"})),h=__try(()=>vendreVehicule({vn_id:v.id,date:today(),client:"X",prix:1000000,mode:"banque"}));__as("admin");
  return has&&/Droits insuffisants/.test(a)&&(b===null||/Droits|entré/.test(b))&&d===null&&/Droits insuffisants/.test(e)&&/Droits insuffisants/.test(f)&&g===null&&/Droits insuffisants/.test(h)&&c("stock_auto","stock_veh")==="vcexp"&&c("commercial_auto","ventes_veh")==="vcep"||JSON.stringify({has,a,b,d,e,f,g,h})});
 await t("STK-14","migration : ancien état sans réservations, devis, inventaires ni livraison de vente : tableaux recréés, ventes complétées (livraison, historique, acompte), droits admin/directeur enrichis",()=>{
  const x=S.ventes_veh[0];delete x.livraison;delete x.hist;delete x.acompte;delete x.echeancier;["reservations","devis","inventaires_vn"].forEach(k=>delete S[k]);delete S.settings.mig_perm_stock;S.perms.admin.ventes_veh=["v","c","e","p"];S.perms.stock_auto&&delete S.perms.stock_auto.stock_veh;
  migrerNegoce();return Array.isArray(S.devis)&&Array.isArray(S.reservations)&&x.livraison.statut&&x.hist.length===1&&typeof x.acompte==="number"&&Array.isArray(x.echeancier)&&S.perms.admin.ventes_veh.includes("x")&&S.perms.admin.ventes_veh.includes("a")&&S.perms.stock_auto.stock_veh.join("")==="vcexp"||"migration"});
 // 12. écrans
 const vw=await p.evaluate(()=>{__as("admin");const R={};const go=(v,tabk,tab)=>{if(tabk)UI.tab[tabk]=tab;view=v;render();return document.getElementById("app").innerText};
  R.stock=go("stock_veh","stk","stock");R.inv=go("stock_veh","stk","inv");R.devis=go("devis_veh","dvr","devis");R.res=go("devis_veh","dvr","res");R.cli=go("clients_veh");R.alr=go("alertes");R.bc=go("bord_com");R.ventes=go("ventes_veh");
  A["vv.det"](S.ventes_veh.find(x=>x.livraison&&x.livraison.statut==="livree").id);R.det=document.querySelector(".md").innerText;document.querySelector(".md").remove();const sr=S.ventes_veh.find(x=>x.encaissements.length);A["vv.recu"](sr.id+":"+sr.encaissements[0].id);R.recu=document.querySelector(".md").innerText;document.querySelector(".md").remove();
  R.csv=["stock_veh","clients_veh","alertes","bord_com","ventes_veh"].map(k=>CSVS[k]()[1].length);return R});
 const bad=/NaN|undefined/.test(JSON.stringify(vw));
 const okv=/Disponibles physiquement/.test(vw.stock)&&/Inventaires clos/.test(vw.inv)&&/Prix net/.test(vw.devis)&&/Expire le/.test(vw.res)&&/Solde dû/.test(vw.cli)&&/Priorité haute/.test(vw.alr)&&/Résultat par activité/.test(vw.bc)&&/Trop coûteux|Normal|Aucune donnée/.test(vw.bc)&&/Dossier/.test(vw.ventes)&&/Livraison/.test(vw.det)&&/solde dû =/.test(vw.det)&&/REÇU REC-VV-/.test(vw.recu)&&vw.csv.every(n=>n>=1);
 console.log(okv&&!bad?"PASS STK-15 écrans : stock, inventaires, devis, réservations, clients, alertes, tableau commercial, détail de vente, reçu, CSV ; sans NaN":"FAIL STK-15 écrans "+bad+" "+JSON.stringify(Object.fromEntries(Object.entries(vw).map(([k,v])=>[k,typeof v==="string"?v.slice(0,80):v]))).slice(0,600));okv&&!bad?ok++:ko++;
 await t("STK-16","comptabilité : toutes les écritures équilibrées ; balance générale équilibrée ; stock commercial = somme des coûts des véhicules en stock",()=>{const bad=S.entries.filter(e=>sum(e.lines,l=>l.debit)!==sum(e.lines,l=>l.credit));const D=sum(S.entries.flatMap(e=>e.lines),l=>l.debit),C=sum(S.entries.flatMap(e=>e.lines),l=>l.credit);
  const stk=sum(S.vn.filter(v=>v.statut==="stock"),vnCout);const diff=S.vn.filter(v=>v.statut==="stock").map(v=>[v.ref,v.vin,vnCout(v),sum(S.entries.flatMap(e=>e.lines.filter(l=>l.compte===cdef("stock_veh"))),l=>0)]).slice(0,0);return bad.length===0&&D===C&&__sc(cdef("stock_veh"))===stk||JSON.stringify({bad:bad.length,D,C,stk,sv:__sc(cdef("stock_veh")),vs:S.vn.map(v=>[v.ref,v.statut,vnCout(v)]),led:S.entries.filter(e=>e.lines.some(l=>l.compte===cdef("stock_veh"))).map(e=>[e.numero,e.source&&e.source.type,e.lines.filter(l=>l.compte===cdef("stock_veh")).map(l=>(l.debit||0)-(l.credit||0)).join("/")].join(":"))})});
 await p.evaluate(()=>{__as("admin");UI.f.bc={from:today().slice(0,4)+"-01-01",to:today(),four:"",cli:""};view="bord_com";render()});await p.screenshot({path:process.env.SHOT||"/tmp/stock.png",fullPage:false});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
