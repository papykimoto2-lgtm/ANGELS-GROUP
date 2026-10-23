/* Application livreur — collectes chez le vendeur, déclaration de versement, demande de clôture (logique serveur, base en mémoire).
   Usage : node tests/livreur-serveur-extras.js */
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
(async()=>{
 const P=await import("../supabase/functions/_shared/passerelle.js");
 const D={mis:{},codes:{},ev:[]};
 const db={compteParUtilisateur:async u=>u==="u1"?{livreur_ref:"L1",actif:true}:u==="u2"?{livreur_ref:"L2",actif:true}:null,mission:async r=>D.mis[r]||null,code:async r=>D.codes[r]||null,
  majCode:async(r,p)=>{Object.assign(D.codes[r],p)},majMission:async(r,p)=>{Object.assign(D.mis[r],p)},ajouterEvenement:async e=>{D.ev.push(e)}};
 const cfg={adminKey:"K",essaisCodeMax:3};let NOW=Date.parse("2026-10-23T10:00:00Z");
 D.mis["col:C1"]={livraison_ref:"col:C1",livreur_ref:"L1",statut:"col_planifiee",payload:{type:"collecte",lignes:[{commande_id:"c1",numero:"CMD-1"},{commande_id:"c2",numero:"CMD-2"}]}};
 D.codes["col:C1"]={code_hash:await P.empreinteCode("col:C1","4821"),essais:0,verrou_jusqua:null};
 D.mis["stats:L1"]={livraison_ref:"stats:L1",livreur_ref:"L1",statut:"stats",payload:{}};
 D.mis["liv1"]={livraison_ref:"liv1",livreur_ref:"L1",statut:"en_cours",payload:{}};
 const A=(u,ref,d)=>P.traiterAction(db,cfg,{livraison_ref:ref,type:"incident",donnees:d},u,NOW);
 const C=(u,act,x={})=>A(u,"col:C1",Object.assign({nature:"COLLECTE",action:act},x));
 const r0=await C("u2","accepter"),r1=await C(null,"accepter");
 chk("LX-1","collecte : un autre livreur est refusé (403), sans connexion refusé (401)",r0.status===403&&r1.status===401);
 const r2=await C("u1","partir");
 chk("LX-2","on ne part pas avant d'avoir accepté (409)",r2.status===409&&D.mis["col:C1"].statut==="col_planifiee");
 const r3=await C("u1","accepter"),r4=await C("u1","partir");
 chk("LX-3","accepter puis partir : la mission passe « acceptée » puis « en route », chaque action est mise en file pour le bureau",r3.status===200&&r4.status===200&&D.mis["col:C1"].statut==="col_en_route"&&D.ev.length===2&&D.ev[0].donnees.nature==="COLLECTE"&&D.ev[0].donnees.action==="accepter"&&D.ev[1].donnees.action==="partir",JSON.stringify(D.ev));
 const m1=await C("u1","collecter",{code:"0000",colis:{c1:1}}),m2=await C("u1","collecter",{code:"0000",colis:{c1:1}});
 chk("LX-4","code du vendeur faux : refusé (403) et compté ; au 3e essai la collecte est verrouillée 15 minutes (429 ensuite, même avec le bon code)",m1.status===403&&m2.status===403&&(await C("u1","collecter",{code:"0000",colis:{c1:1}})).status===403&&(await C("u1","collecter",{code:"4821",colis:{c1:1}})).status===429,JSON.stringify(D.codes["col:C1"]));
 D.codes["col:C1"]={code_hash:await P.empreinteCode("col:C1","4821"),essais:0,verrou_jusqua:null};
 const v1=await C("u1","collecter",{code:"4821",colis:{c9:2}}),v2=await C("u1","collecter",{code:"4821",colis:{c1:0,c2:0}}),v3=await C("u1","collecter",{code:"4821",colis:{c1:500}});
 chk("LX-5","colis : commande étrangère, aucun colis pris, nombre hors limite : tous refusés (400), la mission reste « en route »",v1.status===400&&v2.status===400&&v3.status===400&&D.mis["col:C1"].statut==="col_en_route");
 const g=await C("u1","collecter",{code:"4821",colis:{c1:2,c2:0}});
 const evc=D.ev[D.ev.length-1];
 chk("LX-6","collecte réussie (bon code, colis par commande) : mission « collectée », événement avec le détail des colis, compteur d'essais remis à zéro",g.status===200&&D.mis["col:C1"].statut==="col_collectee"&&evc.donnees.colis.c1===2&&evc.donnees.colis.c2===0&&D.codes["col:C1"].essais===0);
 const g2=await C("u1","collecter",{code:"4821",colis:{c1:2}});
 chk("LX-7","collecte déjà terminée : plus d'action possible (409)",g2.status===409);
 D.mis["col:C2"]={livraison_ref:"col:C2",livreur_ref:"L1",statut:"col_planifiee",payload:{lignes:[]}};
 const f1=await A("u1","col:C2",{nature:"COLLECTE",action:"refuser"}),f2=await A("u1","col:C2",{nature:"COLLECTE",action:"refuser",motif:"Vendeur absent"});
 chk("LX-8","« impossible » : motif obligatoire ; avec motif la collecte est marquée non réalisée et le motif transmis",f1.status===400&&f2.status===200&&D.mis["col:C2"].statut==="col_echouee"&&D.ev[D.ev.length-1].donnees.motif==="Vendeur absent");
 const w=await A("u1","liv1",{nature:"COLLECTE",action:"accepter"}),w2=await A("u1","col:C1",{nature:"COLLECTE",action:"voler"});
 chk("LX-9","l'action de collecte est refusée sur une livraison ordinaire (409) ; action inconnue refusée (400)",w.status===409&&w2.status!==200);
 const V=(d,ref="stats:L1")=>A("u1",ref,Object.assign({nature:"VERSEMENT"},d));
 const n0=D.ev.length,b1=await V({montant:0,mode:"Wave",ref:"MP12345"}),b2=await V({montant:5000,mode:"",ref:"MP12345"}),b3=await V({montant:5000,mode:"Wave",ref:"ab"}),b4=await V({montant:5000,mode:"Wave",ref:"MP12345"},"liv1");
 chk("LX-10","versement : montant nul, opérateur absent, référence trop courte, ou envoi depuis une livraison : tous refusés, rien n'est mis en file",b1.status===400&&b2.status===400&&b3.status===400&&b4.status===409&&D.ev.length===n0);
 const b5=await V({montant:12500,mode:"Orange Money",ref:"mp261023.1234.a56789",note:"Reste de la journée"}),ev5=D.ev[D.ev.length-1];
 chk("LX-11","versement valide : référence mise en majuscules et nettoyée, montant, opérateur et note transmis au bureau (qui vérifie les doublons et la caisse qui valide)",b5.status===200&&ev5.donnees.nature==="VERSEMENT"&&ev5.donnees.montant===12500&&ev5.donnees.mode==="Orange Money"&&ev5.donnees.ref_paiement==="MP261023.1234.A56789"&&ev5.donnees.note==="Reste de la journée",JSON.stringify(ev5));
 const k1=await A("u1","stats:L1",{nature:"CLOTURE"}),k2=await A("u1","liv1",{nature:"CLOTURE"});
 chk("LX-12","clôture de tournée : la demande est mise en file (depuis la mission de statistiques seulement)",k1.status===200&&D.ev[D.ev.length-1].donnees.nature==="CLOTURE"&&D.ev[D.ev.length-1].donnees.description==="CLOTURE"&&k2.status===409);
 const i1=await A("u1","liv1",{nature:"Colis abîmé",description:"Carton écrasé"}),i2=await A("u1","liv1",{nature:"Autre"});
 chk("LX-13","incident ordinaire inchangé : description obligatoire (400), sinon transmis",i1.status===200&&i2.status===400);
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");process.exit(ko?1:0);
})();
