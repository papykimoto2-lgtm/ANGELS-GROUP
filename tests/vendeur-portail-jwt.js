/* Espace du vendeur identifié par sa CONNEXION (sans clé de relève) : QR signé, live, statistiques (base en mémoire).
   Usage : node tests/vendeur-portail-jwt.js */
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
(async()=>{
 const P=await import("../supabase/functions/_shared/portail-demandes.js");
 const D={live:{},rev:{},cles:{V9:"hash"},scans:[{qr:4,lien:7,live:2}]};
 const db={empreinteVendeur:async v=>D.cles[v]||null,lienRev:async v=>D.rev[v]||0,renouvelerLien:async v=>(D.rev[v]=(D.rev[v]||0)+1),
  ecrireLive:async l=>{D.live[l.vendeur]=l},lireLive:async v=>D.live[v]||null,statsScans:async()=>D.scans[0]};
 const cfg={sel:"SEL-SECRET"};
 const r0=await P.traiterVendeur(db,{action:"lien_signer",boutique:"Boutique Awa",tel:"0701020304"},cfg,null);
 chk("VJ-1","sans clé de relève ni connexion : refusé (401)",r0.status===401);
 const r1=await P.traiterVendeur(db,{action:"lien_signer",boutique:"Boutique Awa",tel:"0701020304"},cfg,{vendeur:"V1"});
 const att=await P.signerLien(cfg.sel,"V1","Boutique Awa","0701020304",0);
 chk("VJ-2","connecté (compte vendeur) : le QR est signé sans clé de relève, signature identique à celle que vérifie le portail",r1.status===200&&r1.body.sig===att&&r1.body.rev===0,JSON.stringify(r1.body));
 const r2=await P.traiterVendeur(db,{action:"lien_renouveler",boutique:"Boutique Awa",tel:"0701020304"},cfg,{vendeur:"V1"});
 chk("VJ-3","renouveler le lien : nouvelle révision, ancienne signature invalide",r2.status===200&&r2.body.rev===1&&r2.body.sig!==att&&r2.body.sig===await P.signerLien(cfg.sel,"V1","Boutique Awa","0701020304",1));
 const l1=await P.traiterVendeur(db,{vendeur:"V9",action:"live_publier",titre:"Live du soir",produits:[{n:"Robe wax",p:15000},{n:"Sac",p:12000,ok:false}]},cfg,{vendeur:"V1"});
 chk("VJ-4","le vendeur est celui du compte connecté, jamais celui écrit dans la requête (un autre identifiant ne détourne pas l'écriture)",l1.status===200&&!!D.live.V1&&!D.live.V9&&D.live.V1.produits.length===2,JSON.stringify(Object.keys(D.live)));
 const l2=await P.traiterVendeur(db,{action:"live_lire"},cfg,{vendeur:"V1"}),l3=await P.traiterVendeur(db,{action:"live_lire"},cfg,{vendeur:"V2"});
 chk("VJ-5","lecture de son live : titre, produits (épuisé conservé), état ; un vendeur sans live reçoit « aucun live »",l2.body.live.titre==="Live du soir"&&l2.body.live.actif===true&&l2.body.live.produits[1].ok===false&&l3.body.live===null,JSON.stringify([l2.body,l3.body]));
 await P.traiterVendeur(db,{action:"live_publier",titre:"Live du soir",produits:[{n:"Robe wax",p:15000}],actif:false},cfg,{vendeur:"V1"});
 const l4=await P.traiterVendeur(db,{action:"live_lire"},cfg,{vendeur:"V1"});
 chk("VJ-6","fin du live : il reste lisible par son vendeur, marqué terminé",l4.body.live.actif===false);
 const s1=await P.traiterVendeur(db,{action:"stats"},cfg,{vendeur:"V1"});
 chk("VJ-7","statistiques de visites (QR, lien, live) renvoyées au vendeur connecté",s1.status===200&&s1.body.scans.qr===4&&s1.body.scans.lien===7&&s1.body.scans.live===2);
 const b1=await P.traiterVendeur(db,{action:"stats"},cfg,{vendeur:"!!!"});
 chk("VJ-8","identifiant de compte invalide : refusé (401)",b1.status===401);
 const c1=await P.traiterVendeur(db,{vendeur:"V9",cle:"MAUVAISE",action:"stats"},cfg,null),c2=await P.traiterVendeur(db,{vendeur:"V9",cle:"x",action:"live_lire"},cfg,null);
 chk("VJ-9","l'ancienne identification par clé de relève reste contrôlée (mauvaise clé : 401)",c1.status===401&&c2.status===401);
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");process.exit(ko?1:0);
})();
