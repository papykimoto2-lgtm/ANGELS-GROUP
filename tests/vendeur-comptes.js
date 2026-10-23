/* Comptes serveur des vendeurs partenaires : création, réinitialisation, blocage via mission-sync (base en mémoire).
   Usage : node tests/vendeur-comptes.js */
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
(async()=>{
 const P=await import("../supabase/functions/_shared/passerelle.js");
 const D={ven:[],users:[],n:0,etat:{}},db={
  vendeurParUtilisateur:async u=>D.ven.find(x=>x.user_id===u)||null,ecrireEtatVendeur:async(r,e,m)=>{D.etat[r]={etat:e,maj_le:m}},etatVendeur:async r=>D.etat[r]||null,
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
 /* espace vendeur : publication par le bureau, lecture par le vendeur connecté */
 const E={nom:"Boutique Awa",solde:2500,acquis:9000,regle:6500,attente:1200,lien:"https://exemple.test/portail#/commander/abc",commandes:[{numero:"CMD-1",date:"2026-10-22",statut:"Livrée",client:"Koné",montant:5000,net:4500,tel:"0700000000",code:"1234"}],reglements:[{date:"2026-10-20",montant:6500,libelle:"Virement",iban:"X"}]};
 const p0=await P.traiterSync(db,cfg,{action:"vendeur-publier",vendeurs:[{vendeur_ref:"v1",etat:E}]},"mauvaise");
 const p1=await P.traiterSync(db,cfg,{action:"vendeur-publier",vendeurs:[{vendeur_ref:"v1",etat:E},{vendeur_ref:"inconnu",etat:E},{vendeur_ref:"v1"}]},cfg.adminKey);
 chk("VC-10","publication : clé d'administration obligatoire ; vendeur sans compte signalé, entrée vide ignorée",p0.status===401&&p1.status===200&&p1.body.ecrits===1&&p1.body.ignores===1&&p1.body.vendeurs_inconnus[0]==="inconnu",JSON.stringify(p1));
 const st=D.etat.v1.etat;
 chk("VC-11","la projection publiée ne contient ni téléphone, ni code, ni champ inconnu (nettoyage serveur)",!/0700000000|1234|iban/i.test(JSON.stringify(st))&&st.commandes[0].numero==="CMD-1"&&st.reglements[0].montant===6500&&st.lien.startsWith("https://"),JSON.stringify(st));
 const uid1=D.users.find(u=>u.email==="awa.boutique@users.angels-erp.app").id;D.ven[0].user_id=uid1;
 const g0=await P.traiterVendeurEtat(db,{action:"etat"},null),g1=await P.traiterVendeurEtat(db,{action:"etat"},"autre-uid"),g2=await P.traiterVendeurEtat(db,{action:"etat"},uid1);
 chk("VC-12","lecture : sans jeton 401, utilisateur non vendeur 403, vendeur connecté : sa propre projection (commandes, solde, lien)",g0.status===401&&g1.status===403&&g2.status===200&&g2.body.solde===2500&&g2.body.commandes.length===1&&g2.body.lien===E.lien&&g2.body.nom==="Boutique Awa",JSON.stringify([g0.status,g1.status,g2]));
 D.ven[0].actif=false;const g3=await P.traiterVendeurEtat(db,{action:"etat"},uid1);
 chk("VC-13","compte vendeur bloqué : lecture refusée (403)",g3.status===403);
 D.ven[0].actif=true;D.ven.push({vendeur_ref:"v9",user_id:"u9",nom:"Sans état",actif:true});const g4=await P.traiterVendeurEtat(db,{action:"etat"},"u9");
 chk("VC-14","vendeur sans projection publiée : espace vide (pas d'erreur)",g4.status===200&&g4.body.commandes.length===0&&g4.body.solde===0);
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");process.exit(ko?1:0);
})();
