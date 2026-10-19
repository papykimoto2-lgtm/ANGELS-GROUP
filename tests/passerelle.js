/* Passerelle livreur : logique serveur testée avec une base en mémoire (voir supabase/functions/_shared/passerelle.js).
   Usage : node tests/passerelle.js */
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
(async()=>{
 const P=await import("../supabase/functions/_shared/passerelle.js");
 const mem=()=>{const D={liv:[],mis:[],codes:{},ev:[],users:[],n:0};
  return{D,
  livreursConnus:async()=>D.liv.filter(x=>x.actif).map(x=>x.livreur_ref),
  refsAvecEvenementsEnAttente:async()=>D.ev.filter(e=>!e.traite).map(e=>e.livraison_ref),
  ecrireMission:async m=>{const i=D.mis.findIndex(x=>x.livraison_ref===m.livraison_ref);if(i>=0)D.mis[i]=Object.assign({},D.mis[i],m);else D.mis.push(Object.assign({},m))},
  ecrireCode:async(r,h)=>{D.codes[r]=Object.assign({essais:0,verrou_jusqua:null},D.codes[r],{code_hash:h})},
  retirerMissions:async refs=>{D.mis=D.mis.filter(m=>!refs.includes(m.livraison_ref));refs.forEach(r=>delete D.codes[r])},
  evenementsEnAttente:async n=>D.ev.filter(e=>!e.traite).slice(0,n),
  acquitter:async ids=>{D.ev.forEach(e=>{if(ids.includes(e.id))e.traite=true})},
  compteDe:async r=>D.liv.find(x=>x.livreur_ref===r)||null,compteParUtilisateur:async u=>D.liv.find(x=>x.user_id===u)||null,
  creerUtilisateur:async(email,mdp,meta)=>{if(D.users.some(u=>u.email===email))throw new Error("exists");const id="u"+(++D.n);D.users.push({id,email,mdp,meta,banni:false});return id},
  ecrireCompte:async r=>{D.liv.push(r)},
  changerMdp:async(uid,mdp,meta)=>{const u=D.users.find(x=>x.id===uid);u.mdp=mdp;u.meta=meta},
  bloquerUtilisateur:async(uid,b)=>{D.users.find(x=>x.id===uid).banni=b},
  majCompte:async(r,p)=>{Object.assign(D.liv.find(x=>x.livreur_ref===r),p)},
  mission:async r=>D.mis.find(m=>m.livraison_ref===r)||null,code:async r=>D.codes[r]||null,majCode:async(r,p)=>{Object.assign(D.codes[r],p)},
  majMission:async(r,p)=>{Object.assign(D.mis.find(m=>m.livraison_ref===r),p)},
  majPosition:async(r,pos)=>{const m=D.mis.find(x=>x.livraison_ref===r);m.position=pos;m.position_le=pos.ts},
  ajouterEvenement:async e=>{D.ev.push(Object.assign({id:++D.n,traite:false,cree_le:new Date().toISOString()},e))}}};
 const cfg={adminKey:"ADMIN-SECRET-123",essaisCodeMax:3};const db=mem();let NOW=Date.parse("2026-10-19T10:00:00Z");
 /* comptes */
 const c0=await P.traiterSync(db,cfg,{action:"compte-creer",livreur_ref:"lv1",nom:"Issa Traoré",ident:"Issa.T"},"mauvaise",NOW);
 const c1=await P.traiterSync(db,cfg,{action:"compte-creer",livreur_ref:"lv1",nom:"Issa Traoré",ident:"Issa.T"},cfg.adminKey,NOW);
 const c2=await P.traiterSync(db,cfg,{action:"compte-creer",livreur_ref:"lv1",nom:"Issa",ident:"autre"},cfg.adminKey,NOW);
 const c3=await P.traiterSync(db,cfg,{action:"compte-creer",livreur_ref:"lv2",nom:"X",ident:"a b"},cfg.adminKey,NOW);
 chk("PG-1","comptes : clé d'administration obligatoire ; création = mot de passe temporaire (14 car.) montré une fois, compte marqué à changer ; doublon et identifiant invalide refusés",c0.status===401&&c1.status===200&&c1.body.mdp.length===14&&c1.body.ident==="issa.t"&&db.D.users[0].meta.chg===true&&db.D.users[0].email==="issa.t@users.angels-erp.app"&&c2.status===409&&c3.status===400,JSON.stringify([c0.status,c1.body,c2.status,c3.status]));
 const r1=await P.traiterSync(db,cfg,{action:"compte-reset",livreur_ref:"lv1"},cfg.adminKey,NOW),r2=await P.traiterSync(db,cfg,{action:"compte-actif",livreur_ref:"lv1",actif:false},cfg.adminKey,NOW),r3=await P.traiterSync(db,cfg,{action:"compte-reset",livreur_ref:"nul"},cfg.adminKey,NOW);
 chk("PG-2","comptes : réinitialisation (nouveau mot de passe temporaire), blocage du compte, livreur inconnu = 404",r1.status===200&&r1.body.mdp!==c1.body.mdp&&db.D.users[0].mdp===r1.body.mdp&&r2.body.actif===false&&db.D.users[0].banni===true&&db.D.liv[0].actif===false&&r3.status===404,JSON.stringify([r1.status,r2.body,r3.status]));
 await P.traiterSync(db,cfg,{action:"compte-actif",livreur_ref:"lv1",actif:true},cfg.adminKey,NOW);
 /* publication */
 const mission=(ref,extra)=>({livraison_ref:ref,livreur_ref:"lv1",commande_ref:"CMD-1",statut:"affectee",code:"4821",payload:Object.assign({client_nom:"Awa",adr:{zone:"Cocody",quartier:"Angré"},montant_attendu:15000,tel:"0707123456",code:"4821",lignes:[{desig:"Robe",qte:1,pu:15000}]},extra||{})});
 const pu=await P.traiterSync(db,cfg,{action:"publier",missions:[mission("L1"),Object.assign(mission("L2"),{livreur_ref:"inconnu"})]},cfg.adminKey,NOW);
 const m1=db.D.mis.find(m=>m.livraison_ref==="L1");
 chk("PG-3","publication : le téléphone et le code sont supprimés de la projection ; seule l'empreinte du code est conservée ; livreur inconnu signalé",pu.body.ecrites===1&&!JSON.stringify(m1).includes("0707123456")&&!JSON.stringify(m1).includes("4821")&&!JSON.stringify(db.D.codes).includes("4821")&&db.D.codes.L1.code_hash.length===64&&pu.body.livreurs_inconnus[0]==="inconnu",JSON.stringify(pu.body));
 /* actions livreur */
 const U="u1",act=(ref,type,donnees,u,t)=>P.traiterAction(db,cfg,{livraison_ref:ref,type,donnees},u===undefined?U:u,t||NOW);
 const a0=await act("L1","accepter",{},null),a1=await act("L1","accepter",{},"u99"),a2=await act("L2","accepter",{}),a3=await act("L1","accepter",{});
 db.D.liv.push({livreur_ref:"lv9",user_id:"u9",nom:"Autre",ident:"autre",actif:true});const a4=await act("L1","accepter",{},"u9");
 chk("PG-4","actions : sans connexion 401, compte inconnu 403, mission d'un autre ou inexistante = même 403, accepter fait passer à « acceptée »",a0.status===401&&a1.status===403&&a2.status===403&&a4.status===403&&a4.body.erreur===a2.body.erreur&&a3.status===200&&a3.body.statut==="acceptee"&&m1.statut==="acceptee",JSON.stringify([a0.status,a1.status,a2.status,a4.status,a3.body]));
 const d1=await act("L1","demarrer",{}),pc0=await act("L1","prise_en_charge",{nb_colis:0}),pc1=await act("L1","prise_en_charge",{nb_colis:2,etat:"Bon état"}),pc2=await act("L1","prise_en_charge",{nb_colis:2}),d2=await act("L1","demarrer",{});
 chk("PG-5","transitions : démarrer exige la prise en charge ; nombre de colis borné ; prise en charge unique ; démarrer → « en cours »",d1.status===409&&pc0.status===400&&pc1.status===200&&pc2.status===409&&d2.body.statut==="en_cours"&&m1.payload.collecte_at&&m1.payload.nb_colis===2,JSON.stringify([d1.status,pc0.status,pc1.status,pc2.status,d2.body]));
 const f0=await act("L1","confirmer",{code:"0000",montant:15000,recu_par:"Awa"}),f1=await act("L1","confirmer",{code:"0001",montant:15000,recu_par:"Awa"}),f2=await act("L1","confirmer",{code:"0002",montant:15000,recu_par:"Awa"});
 const f3=await act("L1","confirmer",{code:"4821",montant:15000,recu_par:"Awa"});
 chk("PG-6","code de livraison : faux refusé, verrouillé après 3 essais (même avec le bon code), jamais renvoyé",f0.status===403&&f1.status===403&&f2.status===403&&/verrouillé/.test(f2.body.erreur)&&f3.status===429&&!JSON.stringify([f0,f1,f2,f3]).includes("4821"),JSON.stringify([f0,f1,f2,f3]));
 NOW+=16*60000;
 const g0=await act("L1","confirmer",{code:"4821",montant:-5,recu_par:"Awa"},U,NOW),g1=await act("L1","confirmer",{code:"4821",montant:15000,recu_par:""},U,NOW),g2=await act("L1","confirmer",{code:"4821",montant:14000,recu_par:"Awa"},U,NOW),g3=await act("L1","confirmer",{code:"4821",montant:14000,recu_par:"Awa",ecart_note:"Remise client"},U,NOW);
 const ev=db.D.ev.filter(e=>e.type==="confirmer")[0];
 chk("PG-7","confirmation : montant invalide, destinataire absent, écart sans explication refusés ; avec le bon code → « livrée » et événement pour le bureau",g0.status===400&&g1.status===400&&g2.status===400&&g3.status===200&&m1.statut==="livree"&&ev&&ev.donnees.montant===14000&&ev.donnees.ecart_note==="Remise client",JSON.stringify([g0.status,g1.status,g2.status,g3.body]));
 const h0=await act("L1","accepter",{},U,NOW),h1=await act("L1","echec",{motif:"Absent"},U,NOW);
 chk("PG-8","mission terminée : plus aucune action possible",h0.status===409&&h1.status===409,JSON.stringify([h0.status,h1.status]));
 await P.traiterSync(db,cfg,{action:"publier",missions:[mission("L3",{})]},cfg.adminKey,NOW);await act("L3","accepter",{},U,NOW);
 const pb=await P.traiterSync(db,cfg,{action:"publier",missions:[mission("L3",{})]},cfg.adminKey,NOW);const m3=db.D.mis.find(m=>m.livraison_ref==="L3");
 chk("PG-9","publication : une mission dont un événement n'est pas encore appliqué par le bureau n'est pas écrasée",pb.body.ignorees===1&&m3.statut==="acceptee",JSON.stringify([pb.body,m3.statut]));
 const e0=await P.traiterSync(db,cfg,{action:"evenements"},"x"),e1=await P.traiterSync(db,cfg,{action:"evenements"},cfg.adminKey);const ids=e1.body.evenements.map(e=>e.id);
 const ac=await P.traiterSync(db,cfg,{action:"acquitter",ids},cfg.adminKey),e2=await P.traiterSync(db,cfg,{action:"evenements"},cfg.adminKey);
 chk("PG-10","événements : relevés par le bureau seul (clé), acquittés, plus renvoyés",e0.status===401&&e1.body.evenements.length>=4&&ac.body.acquittes===ids.length&&e2.body.evenements.length===0,JSON.stringify([e0.status,e1.body.evenements.length,ac.body,e2.body.evenements.length]));
 /* position, échec, refus */
 await P.traiterSync(db,cfg,{action:"publier",missions:[Object.assign(mission("L4"),{statut:"en_cours"})]},cfg.adminKey,NOW);
 const p0=await act("L4","position",{lat:200,lng:0},U,NOW),p1=await act("L4","position",{lat:5.34,lng:-4.02,precision:12},U,NOW),n1=db.D.ev.filter(e=>e.type==="position"&&!e.traite).length,p2=await act("L4","position",{lat:5.35,lng:-4.02},U,NOW+5000),n2=db.D.ev.filter(e=>e.type==="position"&&!e.traite).length,p3=await act("L4","position",{lat:5.36,lng:-4.02},U,NOW+30000),n3=db.D.ev.filter(e=>e.type==="position"&&!e.traite).length;
 chk("PG-11","position : coordonnées invalides refusées ; la dernière position est conservée sur la mission ; le bureau est informé au plus toutes les 20 s",p0.status===400&&p1.status===200&&n1===1&&n2===1&&n3===2&&db.D.mis.find(m=>m.livraison_ref==="L4").position.lat===5.36,JSON.stringify([p0.status,n1,n2,n3]));
 const x0=await act("L4","echec",{motif:"x"},U,NOW),x1=await act("L4","echec",{motif:"Client injoignable",obs:"3 appels"},U,NOW),i0=await act("L3","incident",{},U,NOW),i1=await act("L3","incident",{nature:"panne",description:"Crevaison"},U,NOW),rf=await act("L3","refuser",{motif:"ab"},U,NOW),rf2=await act("L3","refuser",{motif:"Moto en panne"},U,NOW);
 chk("PG-12","échec et refus exigent un motif ; incident exige une description ; échec → « échouée », refus → « refusée »",x0.status===400&&x1.body.statut==="echouee"&&i0.status===400&&i1.status===200&&rf.status===400&&rf2.body.statut==="refusee",JSON.stringify([x0.status,x1.body,i0.status,i1.status,rf.status,rf2.body]));
 const rt=await P.traiterSync(db,cfg,{action:"publier",missions:[],retirer:["L1","L4"]},cfg.adminKey,NOW);
 chk("PG-13","retrait des missions : projection et empreinte de code supprimées",rt.body.retirees===2&&!db.D.mis.some(m=>m.livraison_ref==="L1")&&!db.D.codes.L1,JSON.stringify(rt.body));
 chk("PG-14","identifiant → e-mail technique, mots de passe générés conformes",P.emailDe("Awa Test")==="awatest@users.angels-erp.app"&&P.emailDe("A@B.com")==="a@b.com"&&/^[A-Za-z0-9@_%+-]{14}$/.test(P.genererMdp())&&P.genererMdp()!==P.genererMdp(),"");
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");process.exit(ko?1:0);
})();
