/* Comptes serveur des vendeurs partenaires : création, réinitialisation, blocage via mission-sync (base en mémoire).
   Usage : node tests/vendeur-comptes.js */
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
(async()=>{
 const P=await import("../supabase/functions/_shared/passerelle.js");
 const D={ven:[],users:[],n:0},db={
  vendeurDe:async r=>D.ven.find(x=>x.vendeur_ref===r)||null,ecrireVendeur:async r=>{D.ven.push(r)},majVendeur:async(r,p)=>{Object.assign(D.ven.find(x=>x.vendeur_ref===r),p)},
  creerUtilisateur:async(email,mdp,meta)=>{if(D.users.some(u=>u.email===email))throw new Error("exists");const id="u"+(++D.n);D.users.push({id,email,mdp,meta,banni:false});return id},
  changerMdp:async(uid,mdp,meta)=>{const u=D.users.find(x=>x.id===uid);u.mdp=mdp;u.meta=meta},
  bloquerUtilisateur:async(uid,b)=>{D.users.find(x=>x.id===uid).banni=b}};
 const cfg={adminKey:"ADMIN-SECRET-123"};
 const x0=await P.traiterSync(db,cfg,{action:"vendeur-compte-creer",vendeur_ref:"v1",nom:"Boutique Awa",ident:"awa.boutique"},"mauvaise");
 chk("VC-1","clé d'administration invalide : refusé, aucun compte créé",x0.status===401&&!D.users.length);
 const x1=await P.traiterSync(db,cfg,{action:"vendeur-compte-creer",vendeur_ref:"v1",nom:"Boutique Awa",ident:"Awa.Boutique"},cfg.adminKey);
 chk("VC-2","création : identifiant en minuscules, mot de passe temporaire fort montré une fois, compte marqué « à changer » et rôle vendeur",x1.status===200&&x1.body.ident==="awa.boutique"&&x1.body.mdp.length===14&&D.users[0].email==="awa.boutique@users.angels-erp.app"&&D.users[0].meta.chg===true&&D.users[0].meta.role==="vendeur"&&D.ven[0].actif===true,JSON.stringify(x1));
 const x2=await P.traiterSync(db,cfg,{action:"vendeur-compte-creer",vendeur_ref:"v1",nom:"Boutique Awa",ident:"autre.id"},cfg.adminKey);
 chk("VC-3","un vendeur ne peut avoir qu'un compte : 2e création refusée (409)",x2.status===409&&D.users.length===1);
 const x3=await P.traiterSync(db,cfg,{action:"vendeur-compte-creer",vendeur_ref:"v2",nom:"Autre",ident:"awa.boutique"},cfg.adminKey);
 chk("VC-4","identifiant déjà pris par un autre compte : refusé (409), pas de ligne vendeur orpheline",x3.status===409&&D.ven.length===1);
 const x4=await P.traiterSync(db,cfg,{action:"vendeur-compte-creer",vendeur_ref:"v3",nom:"X",ident:"ab"},cfg.adminKey);
 chk("VC-5","identifiant trop court : refusé (400)",x4.status===400);
 const ancien=D.users[0].mdp,x5=await P.traiterSync(db,cfg,{action:"vendeur-compte-reset",vendeur_ref:"v1"},cfg.adminKey);
 chk("VC-6","réinitialisation : nouveau mot de passe, à changer à la prochaine connexion",x5.status===200&&x5.body.mdp!==ancien&&D.users[0].mdp===x5.body.mdp&&D.users[0].meta.chg===true&&D.users[0].meta.role==="vendeur");
 const x6=await P.traiterSync(db,cfg,{action:"vendeur-compte-reset",vendeur_ref:"inconnu"},cfg.adminKey);
 chk("VC-7","réinitialisation d'un vendeur sans compte : 404",x6.status===404);
 const x7=await P.traiterSync(db,cfg,{action:"vendeur-compte-actif",vendeur_ref:"v1",actif:false},cfg.adminKey);
 chk("VC-8","blocage : compte banni côté serveur et marqué inactif",x7.status===200&&D.users[0].banni===true&&D.ven[0].actif===false);
 const x8=await P.traiterSync(db,cfg,{action:"vendeur-compte-actif",vendeur_ref:"v1",actif:true},cfg.adminKey);
 chk("VC-9","réactivation : compte débanni",x8.status===200&&D.users[0].banni===false&&D.ven[0].actif===true);
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");process.exit(ko?1:0);
})();
