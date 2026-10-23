/* Application livreur — contrôle avant départ et signalement de panne (logique serveur, base en mémoire).
   Usage : node tests/livreur-engin-serveur.js */
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
(async()=>{
 const P=await import("../supabase/functions/_shared/passerelle.js");
 const D={mis:{},ev:[]};
 const db={compteParUtilisateur:async u=>u==="u1"?{livreur_ref:"L1",actif:true}:u==="u2"?{livreur_ref:"L2",actif:true}:null,mission:async r=>D.mis[r]||null,majMission:async(r,p)=>{Object.assign(D.mis[r],p)},ajouterEvenement:async e=>{D.ev.push(e)}};
 const cfg={adminKey:"K"},NOW=Date.parse("2026-10-23T10:00:00Z");
 D.mis["stats:L1"]={livraison_ref:"stats:L1",livreur_ref:"L1",statut:"stats",payload:{}};D.mis["liv1"]={livraison_ref:"liv1",livreur_ref:"L1",statut:"en_cours",payload:{}};
 const A=(u,ref,d)=>P.traiterAction(db,cfg,{livraison_ref:ref,type:"incident",donnees:d},u,NOW),Cn=(d,ref="stats:L1",u="u1")=>A(u,ref,Object.assign({nature:"ENGIN_CONTROLE"},d)),Pn=(d,ref="stats:L1",u="u1")=>A(u,ref,Object.assign({nature:"ENGIN_PANNE"},d));
 const a=await Cn({ko:[]},"stats:L1",null),b=await Cn({ko:[]},"stats:L1","u2"),c=await Cn({ko:[]},"liv1");
 chk("LP-1","contrôle : sans connexion (401), sur la pseudo-mission d'un autre livreur (403) ou sur une vraie livraison (409) : refusé, rien en file",a.status===401&&b.status===403&&c.status===409&&!D.ev.length,JSON.stringify([a.status,b.status,c.status]));
 const d=await Cn({ko:["Freins","Freins","  Pneus (pression, usure) ","",...Array(30).fill("x").map((_,i)=>"p"+i)],km:"12345.4",note:"x".repeat(500)});const e=D.ev[0].donnees;
 chk("LP-2","contrôle valide : anomalies nettoyées et dédoublonnées (20 lignes au plus lues), kilométrage arrondi, remarque limitée à 200 caractères, mis en file pour le bureau",d.status===200&&e.nature==="ENGIN_CONTROLE"&&e.ko.length===18&&e.ko[0]==="Freins"&&e.ko[1]==="Pneus (pression, usure)"&&e.km===12345&&e.note.length===200&&D.ev[0].type==="incident"&&D.ev[0].livreur_ref==="L1",JSON.stringify(e).slice(0,200));
 const f=await Cn({ko:[]});chk("LP-3","contrôle conforme (aucune anomalie) accepté ; kilométrage absent = null ; kilométrage négatif ou absurde refusé (400)",f.status===200&&D.ev[1].donnees.km===null&&(await Cn({km:-5})).status===400&&(await Cn({km:1e9})).status===400);
 const g=await Pn({sujet:"ab"}),h=await Pn({sujet:"Pneu crevé",gravite:"arret",note:"route de Bingerville"}),i=await Pn({sujet:"Chaîne qui saute",gravite:"nimporte"}),j=await Pn({sujet:"Pneu crevé"},"liv1");
 chk("LP-4","panne : description trop courte refusée (400) ; gravité « arret » conservée, toute autre valeur devient « roule » ; refusée sur une vraie livraison (409)",g.status===400&&h.status===200&&D.ev[2].donnees.gravite==="arret"&&D.ev[2].donnees.sujet==="Pneu crevé"&&D.ev[2].donnees.note==="route de Bingerville"&&D.ev[2].donnees.description==="PANNE|arret|Pneu crevé"&&i.status===200&&D.ev[3].donnees.gravite==="roule"&&j.status===409);
 chk("LP-5","les autres natures de la pseudo-mission (versement, clôture) ne sont pas affectées ; le statut de la mission « stats » ne change pas",(await A("u1","stats:L1",{nature:"CLOTURE"})).status===200&&D.mis["stats:L1"].statut==="stats");
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");process.exit(ko?1:0);
})();
