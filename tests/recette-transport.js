/* Recette automatisée — ANGEL'S & CO Transport (cahier des charges §7).
   Usage : PLAYWRIGHT=/chemin/vers/playwright node tests/recette-transport.js */
const path=require("path");
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
(async()=>{
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
 const p=await b.newPage(),errs=[];
 p.on("pageerror",e=>errs.push("PAGEERR "+e.message));
 p.on("dialog",d=>d.accept());
 await p.goto("file://"+path.resolve(__dirname,"../transport.html"));
 await p.evaluate(()=>{window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};
  window.__try=fn=>{const snap=JSON.stringify(S),me=ME&&ME.id;try{fn();recomputeLettrage();return null}catch(e){S=JSON.parse(snap);ME=me?by(S.users,me):null;return e.message}}});
 let ok=0,ko=0;const t=async(id,label,fn)=>{let r;try{r=await p.evaluate(fn)}catch(e){r="EXC "+e.message}
  if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",r)}};

 // Jeu de données propre : véhicule + chauffeur de test, contrat de recette 15 000
 await p.evaluate(()=>{
  __as("flotte");
  const mkD=(nom,n)=>{const id=uid("d"),t={id:uid("t"),type:"chauffeur",nom,aux:"4119"+n,ref:id};S.tiers.push(t);const u={id:uid("u"),nom,role:"chauffeur",actif:true,driver_id:id};u.h=hashPin(u.id,"9"+n+"99");S.users.push(u);const d={id,user_id:u.id,nom,tel:"07",tiers_id:t.id,permis_fin:addDays(today(),400)};S.drivers.push(d);return d};
  window.DA=mkD("Test A",1);window.DB=mkD("Test B",2);
  const mkV=im=>{const v={id:uid("v"),immat:im,marque:"T",modele:"X",statut:"actif",km:1000,prochain_km:9000,assurance_fin:addDays(today(),300),visite_fin:addDays(today(),300),carte_fin:addDays(today(),300)};S.vehicles.push(v);return v};
  window.VA=mkV("TEST-A");window.VB=mkV("TEST-B");window.VL=mkV("TEST-L");
  save();
 });
 await t("REC-01","contrat recette 15 000 F/j → échéance au montant contractuel",()=>{__as("flotte");let e=__try(()=>{window.CA=creerContrat({mode:"recette",vehicle_id:VA.id,driver_id:DA.id,montant:15000,debut:addDays(today(),-2),repos:"aucun"})});if(e)return e;
  e=__try(()=>generer(today(),true));if(e)return e;const o=S.obligations.filter(x=>x.contract_id===CA.id);return o.length===3&&o.every(x=>x.montant===15000)||("échéances: "+o.length)});
 await t("REC-02","12 000 sur 15 000 → solde 3 000",()=>{__as("caissier");const o=S.obligations.filter(x=>x.contract_id===CA.id).sort((a,b)=>a.date_ech.localeCompare(b.date_ech));window.O1=o[0];
  const e=__try(()=>{window.P1=enregistrerPaiement({driver_id:DA.id,montant:12000,mode:"especes",date_valeur:today(),obs:[O1.id],idem:"t1"})});if(e)return e;return soldeOb(O1)===3000||("solde "+soldeOb(O1))});
 await t("REC-03","3 000 ultérieurs → soldée, 2 paiements conservés",()=>{__as("caissier");const e=__try(()=>{enregistrerPaiement({driver_id:DA.id,montant:3000,mode:"especes",date_valeur:today(),obs:[O1.id],idem:"t2"})});if(e)return e;
  return soldeOb(O1)===0&&S.allocs.filter(a=>a.obligation_id===O1.id&&a.actif).length===2||"état incorrect"});
 await t("REC-04","double confirmation / même clé bloquées",()=>{__as("caissier");const a=__try(()=>enregistrerPaiement({driver_id:DA.id,montant:3000,mode:"especes",date_valeur:today(),obs:[S.obligations.filter(x=>x.contract_id===CA.id)[1].id],idem:"t1"}));
  const b=__try(()=>confirmerPaiement(P1));return(a&&/doublon/i.test(a)&&b&&/déjà confirmé/.test(b))||("a="+a+" b="+b)});
 await t("REC-05","paiement en retard : date de valeur et échéance conservées",()=>{__as("caissier");const o=S.obligations.filter(x=>x.contract_id===CA.id).sort((a,b)=>a.date_ech.localeCompare(b.date_ech))[1];const dv=addDays(today(),-1);
  const e=__try(()=>{window.P5=enregistrerPaiement({driver_id:DA.id,montant:5000,mode:"especes",date_valeur:dv,obs:[o.id],idem:"t5"})});if(e)return e;const p=by(S.payments,P5);return p.date_valeur===dv&&p.plan[0].ob===o.id&&!!p.date_reelle||"champs"});
 await t("REC-06","tarif modifié par profil non autorisé → refusé",()=>{__as("caissier");const a=__try(()=>avenant(CA.id,16000,addDays(today(),1),"x"));__as("flotte");const b=__try(()=>avenant(CA.id,16000,addDays(today(),-1),"rétro"));
  return(a&&/Droits/.test(a)&&b&&/validation requise/.test(b))||("a="+a+" b="+b)});
 await t("REC-07","résiliation location : pas d'échéance après la date d'effet",()=>{__as("flotte");let c;let e=__try(()=>{c=creerContrat({mode:"location",vehicle_id:VL.id,driver_id:DB.id,montant:70000,periodicite:"semaine",debut:addDays(today(),-20),depot:0})});if(e)return e;
  e=__try(()=>generer(today(),true));if(e)return e;e=__try(()=>resilier(c.id,today(),"Fin de location"));if(e)return e;
  const n=S.obligations.filter(o=>o.contract_id===c.id).length;e=__try(()=>generer(addDays(today(),90),true));if(e)return e;
  const o=S.obligations.filter(o=>o.contract_id===c.id);return(o.length===n&&o.every(x=>x.date_ech<=today()))||("avant "+n+" après "+o.length)});
 await t("REC-08","changement de mode : historique conservé, pas de double obligation",()=>{__as("flotte");let c;let e=__try(()=>{c=creerContrat({mode:"recette",vehicle_id:VB.id,driver_id:DB.id,montant:10000,debut:addDays(today(),-5),repos:"aucun"})});
  if(e)return e;e=__try(()=>generer(today(),true));if(e)return e;e=__try(()=>changerMode(c.id,today(),"location",50000,"semaine"));if(e)return e;
  e=__try(()=>generer(today(),true));if(e)return e;const os=S.obligations.filter(o=>o.vehicle_id===VB.id&&!o.exo),dates=os.map(o=>o.date_ech);
  const dbl=new Set(dates).size!==dates.length;return(!dbl&&S.contracts.filter(x=>x.vehicle_id===VB.id).length===2)||("doublons "+dbl)});
 await t("REC-09","annulation reçu : droits, motif, trace, soldes restaurés",()=>{__as("caissier");const rid=by(S.payments,P5).receipt_id;const a=__try(()=>annulerRecu(rid,"erreur"));
  __as("directeur");const b=__try(()=>annulerRecu(rid,""));const before=S.entries.length;const c=__try(()=>annulerRecu(rid,"Erreur de saisie"));
  const r=by(S.receipts,rid),p=by(S.payments,P5),o=by(S.obligations,p.plan[0].ob);return(a&&/Droits/.test(a)&&b&&/Motif/.test(b)&&!c&&r.statut==="annule"&&S.entries.length===before+1&&soldeOb(o)===o.montant&&integrite().length===0)||("a="+a+" b="+b+" c="+c+" "+integrite())});
 await t("REC-10","portail : compte d'un autre chauffeur refusé",()=>{ME=by(S.users,DA.user_id);const a=__try(()=>portalData(DB.id));const o=S.obligations.find(x=>x.driver_id===DB.id);const b=__try(()=>creerDemande({type:"contestation",ob:o.id,texte:"x"}));return(a&&/Accès refusé/.test(a)&&b&&/Accès refusé/.test(b))||("a="+a+" b="+b)});

 await t("COM-01","encaissement espèces → reçu + mouvement de caisse",()=>{__as("caissier");const o=S.obligations.filter(x=>x.contract_id===CA.id).sort((a,b)=>a.date_ech.localeCompare(b.date_ech))[2];const nr=S.receipts.length,nm=S.cash_mv.length;
  const e=__try(()=>{window.P7=enregistrerPaiement({driver_id:DA.id,montant:15000,mode:"especes",date_valeur:today(),obs:[o.id],idem:"t7"})});if(e)return e;return(S.receipts.length===nr+1&&S.cash_mv.length===nm+1&&by(S.payments,P7).statut==="confirme")||"incomplet"});
 await t("COM-02","écriture équilibrée D=C, 571 / 411",()=>{const e=by(S.entries,by(S.payments,P7).entry_id);const d=sum(e.lines,l=>l.debit),c=sum(e.lines,l=>l.credit);return(d===c&&d===15000&&e.lines.some(l=>l.compte==="571"&&l.debit)&&e.lines.some(l=>l.compte==="411"&&l.credit))||"écriture"});
 await t("COM-03","dépense approuvée → trésorerie + comptabilité",()=>{__as("comptable");let ex;let e=__try(()=>{ex=creerDepense({date:today(),vehicle_id:VA.id,categorie:"Carburant",fournisseur:"Station",montant:8000,justificatif:""})});if(e)return e;
  const nm=S.cash_mv.length;e=__try(()=>validerDepense(ex.id,"caisse",true));if(e)return e;const en=by(S.entries,by(S.expenses,ex.id).entry_id);return(S.cash_mv.length===nm+1&&en.lines.some(l=>l.compte==="604"&&l.debit===8000)&&en.lines.some(l=>l.compte==="571"&&l.credit===8000))||"écriture"});
 await t("COM-04","clôture avec écart → explication obligatoire",()=>{__as("caissier");const th=soldeTheo(openSession());const a=__try(()=>cloturerCaisse(th-1000,""));const b=__try(()=>cloturerCaisse(th-1000,"Billet manquant"));const cs=S.cash_sessions[S.cash_sessions.length-1];return(a&&/explication obligatoire/.test(a)&&!b&&cs.ecart===-1000)||("a="+a+" b="+b)});
 await t("COM-05","période clôturée : écriture refusée ; plan comptable refusé au caissier",()=>{__as("comptable");let e=__try(()=>periodeAction(today().slice(0,7),"close"));if(e)return e;
  const a=__try(()=>saisirOD({date:today(),libelle:"test",lines:[{compte:"571",debit:100},{compte:"121",credit:100}]}));__as("caissier");const b=__try(()=>creerCompte("999","X","Autre"));
  __as("directeur");e=__try(()=>periodeAction(today().slice(0,7),"open"));return(a&&/clôturée/.test(a)&&b&&/Droits/.test(b)&&!e)||("a="+a+" b="+b+" e="+e)});
 await t("COM-06","grand livre 571 cohérent avec la caisse",()=>{const gl=sum(S.entries.flatMap(e=>e.lines.filter(l=>l.compte==="571")),l=>(l.debit||0)-(l.credit||0)),mv=sum(S.cash_mv.filter(m=>m.statut==="validee"),m=>m.sens==="entree"?m.montant:-m.montant);return gl===mv||(gl+" ≠ "+mv)});
 await t("COM-07","lettrage paiement ↔ créance",()=>{const o=by(S.obligations,S.allocs.find(a=>a.payment_id===P7).obligation_id);const ls=S.entries.flatMap(e=>e.lines.filter(l=>l.ob===o.id&&l.compte==="411"&&!l.ext));return(ls.length>=2&&ls.every(l=>l.lettre))||("lignes "+ls.length)});
 await t("COM-08","total débit = total crédit par journal",()=>JOURNAUX.every(([c])=>{const es=S.entries.filter(e=>e.journal===c);return sum(es,e=>sum(e.lines,l=>l.debit))===sum(es,e=>sum(e.lines,l=>l.credit))}));
 await t("COM-09","annulation écriture : extourne tracée, original conservé",()=>{__as("comptable");let en;let e=__try(()=>{en=saisirOD({date:today(),libelle:"OD test",lines:[{compte:"638",debit:500},{compte:"571",credit:500}]})});if(e)return e;
  const n=S.entries.length;e=__try(()=>extourner(en,"erreur"));return(!e&&S.entries.length===n+1&&!!by(S.entries,en.id)&&!!en.extournee_par)||e});
 await t("COM-10","encaissements ↔ comptabilité réconciliables",()=>integrite().length===0||integrite().join(";"));

 await t("GPS-01","position valide enregistrée avec horodatage",()=>{const r=ingestPos("GPS-0001",5.34,-4.08,now(),20);const l=lastPos(S.gps_dev.find(g=>g.ident==="GPS-0001").id);return(r.ok&&!!l.t)||JSON.stringify(r)});
 await t("GPS-02","signal perdu → données anciennes / hors ligne",()=>{const g=S.gps_dev.find(g=>g.ident==="GPS-0002");return(gpsEtat(g)[0]==="Données anciennes")||gpsEtat(g)[0]});
 await t("GPS-03","coordonnées invalides → quarantaine",()=>{const n=S.gps_quar.length,r=ingestPos("GPS-0001",95,-4,now(),0);const r2=ingestPos("GPS-0001","x",-4,now(),0);return(!r.ok&&!r2.ok&&S.gps_quar.length===n+2)||"non rejeté"});
 await t("GPS-04","historique par période",()=>{const v=S.gps_dev.find(g=>g.ident==="GPS-0001").vehicle_id;const n=S.gps_pos.filter(p=>p.vehicle_id===v&&p.t.slice(0,10)>=today()&&p.t.slice(0,10)<=today()).length;const m=S.gps_pos.filter(p=>p.vehicle_id===v&&p.t.slice(0,10)>=addDays(today(),1)).length;return(n>=2&&m===0)||(n+"/"+m)});
 await t("GPS-05","carte GPS sans autorisation → refusée",()=>{__as("caissier");const a=can("gps","v");ME=by(S.users,DA.user_id);return(!a&&!can("gps","v")&&!NAV.filter(showNav).some(n=>n.m==="gps"))||"accès"});
 await t("POR-01","chauffeur : données de son dossier uniquement",()=>{ME=by(S.users,DA.user_id);const P=portalData(DA.id);return(P.obs.every(o=>o.driver_id===DA.id)&&NAV.filter(showNav).every(n=>n.m==="portail"))||"fuite"});
 await t("POR-02","paiement mobile : visible au portail seulement après confirmation",()=>{__as("caissier");const o=S.obligations.filter(x=>x.driver_id===DA.id&&soldeOb(x)>0)[0];let pid;let e=__try(()=>{pid=enregistrerPaiement({driver_id:DA.id,montant:o.montant,mode:"mobile",ref:"MM123",date_valeur:today(),obs:[o.id],idem:"tm1"})});if(e)return e;
  ME=by(S.users,DA.user_id);const av=portalData(DA.id).recus.length;__as("caissier");e=__try(()=>confirmerPaiement(pid));if(e)return e;ME=by(S.users,DA.user_id);return(portalData(DA.id).recus.length===av+1)||"affichage"});
 await t("POR-03","signalement de panne → demande + maintenance",()=>{ME=by(S.users,DA.user_id);const n=S.incidents.length,m=S.maintenance.length;const e=__try(()=>signalerIncident({type:"panne",date:today(),description:"Moteur chauffe"}));return(!e&&S.incidents.length===n+1&&S.maintenance.length===m+1)||e});
 await t("POR-04","chauffeur ne peut pas modifier un tarif",()=>{ME=by(S.users,DA.user_id);const e=__try(()=>avenant(CA.id,1,addDays(today(),1),"x"));return(e&&/Droits/.test(e))||e});
 await t("MAI-01","ordre de réparation historisé, véhicule immobilisé",()=>{__as("flotte");let m;let e=__try(()=>{m=creerMaintenance({vehicle_id:VA.id,motif:"Freins"})});if(e)return e;
  e=__try(()=>avancerMaintenance(m.id,{fournisseur:"Garage",cout:40000}));if(e)return e;__as("directeur");e=__try(()=>avancerMaintenance(m.id));if(e)return e;__as("flotte");e=__try(()=>avancerMaintenance(m.id,{cout:40000}));if(e)return e;
  window.MM=m;return(by(S.vehicles,VA.id).statut==="immobilise"&&m.hist.length===4)||("statut "+by(S.vehicles,VA.id).statut+" hist "+m.hist.length)});
 await t("MAI-02","clôture : remise en service, coût vers dépense",()=>{__as("flotte");let e=__try(()=>avancerMaintenance(MM.id,{travaux:"Plaquettes",pieces:"Plaquettes"}));if(e)return e;e=__try(()=>avancerMaintenance(MM.id,{cout:42000}));if(e)return e;
  const ex=by(S.expenses,MM.expense_id);return(by(S.vehicles,VA.id).statut==="actif"&&MM.statut==="close"&&ex&&ex.montant===42000&&ex.categorie==="Entretien et réparations")||"état"});
 await t("SEC-01","sauvegarde → restauration : intégrité conservée",()=>{__as("admin");const data=JSON.parse(JSON.stringify(S));delete data.tries;const txt=JSON.stringify({app:"angels-transport",v:3,sum:hashPin("bk",JSON.stringify(data)),data});let pb;const e=__try(()=>{pb=restaurer(txt)});const bad=__try(()=>restaurer(txt.replace('"montant":15000','"montant":15001')));return(!e&&pb.length===0&&bad&&/contrôle/.test(bad))||("e="+e+" pb="+pb+" bad="+bad)});
 await t("SEC-02","affichage de toutes les vues par rôle sans erreur",()=>{const bad=[];for(const r of Object.keys(ROLES)){__as(r);if(r==="chauffeur")ME=by(S.users,DA.user_id);for(const n of NAV.filter(showNav)){view=n.v;try{V[n.v]()}catch(e){bad.push(r+"/"+n.v+": "+e.message)}}}return bad.length===0||bad.join(" | ")});
 await t("SEC-03","saisie hostile échappée (XSS)",()=>{__as("flotte");S.vehicles.push({id:uid("v"),immat:"<img src=x onerror=window.__x=1>",marque:"",statut:"actif",km:0});view="vehicules";__as("flotte");const h=V.vehicules();return(!h.includes("<img src=x")&&h.includes("&lt;img"))||"non échappé"});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);
 await b.close();process.exit(ko||errs.length?1:0);
})();
