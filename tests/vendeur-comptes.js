/* Comptes serveur des vendeurs partenaires : création, réinitialisation, blocage via mission-sync (base en mémoire).
   Usage : node tests/vendeur-comptes.js */
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
(async()=>{
 const P=await import("../supabase/functions/_shared/passerelle.js");
 const D={ven:[],users:[],n:0,etat:{},cmds:[],cles:[]},db={
  retirerCleVendeur:async r=>{D.cles.push(r)},
  vendeursActifs:async()=>D.ven.filter(v=>v.actif).map(v=>({ident:v.ident,nom:v.nom,actif:v.actif})),
  ajouterCmdVendeur:async r=>{if(!D.cmds.some(c=>c.vendeur_ref===r.vendeur_ref&&c.ref===r.ref))D.cmds.push(Object.assign({id:D.cmds.length+1,traite:false},r))},nbCmdsVendeurEnAttente:async v=>D.cmds.filter(c=>c.vendeur_ref===v&&!c.traite).length,cmdsVendeurEnAttente:async n=>D.cmds.filter(c=>!c.traite).slice(0,n),acquitterCmdsVendeur:async ids=>{D.cmds.forEach(c=>{if(ids.includes(c.id))c.traite=true})},
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
 /* commande déposée par le vendeur depuis son application */
 const C={ref:"VD-20261023-AB12",nom:"Mme Konan",tel:"0505777777",zone:"Abobo",quartier:"Anonkoua",repere:"Face à l'église",ins:"",lignes:[{desig:"Robe wax",qte:1,pu:15000},{desig:"Foulard",qte:2,pu:3000}],pay:"partiel",paye_vendeur:5000,gps:{lat:5.4,lng:-4.0}};
 const o0=await P.traiterVendeurEtat(db,Object.assign({action:"commander"},C),null),o1=await P.traiterVendeurEtat(db,Object.assign({action:"commander"},C),uid1),o2=await P.traiterVendeurEtat(db,Object.assign({action:"commander"},C),uid1);
 chk("VC-15","commande : sans jeton 401 ; avec jeton acceptée ; renvoyée (réseau coupé puis repris) : aucun doublon",o0.status===401&&o1.status===200&&o2.status===200&&D.cmds.length===1&&D.cmds[0].donnees.paye_vendeur===5000&&D.cmds[0].donnees.gps.lat===5.4,JSON.stringify(D.cmds));
 const bad=async(patch)=>(await P.traiterVendeurEtat(db,Object.assign({action:"commander"},C,{ref:"VD-"+Math.random().toString(36).slice(2,10)},patch),uid1)).status;
 chk("VC-16","contrôles : référence invalide, aucun article, quantité 0, prix négatif, zone absente, téléphone invalide, acompte supérieur au total : tous refusés (400)",[await bad({ref:"x"}),await bad({lignes:[]}),await bad({lignes:[{desig:"A",qte:0,pu:10}]}),await bad({lignes:[{desig:"A",qte:1,pu:-5}]}),await bad({zone:""}),await bad({tel:"abc<script>"}),await bad({paye_vendeur:999999})].every(x=>x===400)&&D.cmds.length===1);
 for(let i=0;i<45;i++)D.cmds.push({id:100+i,vendeur_ref:"v1",ref:"ZZ-"+i+"-xxxx",donnees:{},traite:false});
 const o3=await P.traiterVendeurEtat(db,Object.assign({action:"commander"},C,{ref:"VD-limite-0001"}),uid1);
 chk("VC-17","trop de commandes déjà en attente chez le bureau : refus (429)",o3.status===429);
 D.cmds.length=1;
 const q0=await P.traiterSync(db,cfg,{action:"vendeur-commandes"},"mauvaise"),q1=await P.traiterSync(db,cfg,{action:"vendeur-commandes"},cfg.adminKey);
 const q2=await P.traiterSync(db,cfg,{action:"vendeur-acquitter",ids:[1]},cfg.adminKey),q3=await P.traiterSync(db,cfg,{action:"vendeur-commandes"},cfg.adminKey);
 chk("VC-18","le bureau relève les commandes en attente (clé obligatoire), les acquitte, et elles ne reviennent plus",q0.status===401&&q1.body.commandes.length===1&&q1.body.commandes[0].vendeur_ref==="v1"&&q2.body.acquittes===1&&q3.body.commandes.length===0);
 const z=P.nettoyerEtatVendeur({nom:"A",zones:[{nom:"Abobo",frais:1500,x:1},{nom:""}],commandes:[{numero:"C1",ref:"VD-20261023-AB12",suivi:"https://exemple.test/portail#/suivi/abc",client:"K"},{numero:"C2",suivi:"javascript:alert(1)"}]});
 chk("VC-19","projection : zones de livraison, référence de l'application et lien de suivi (https uniquement) conservés ; lien dangereux supprimé",z.zones.length===1&&z.zones[0].frais===1500&&z.commandes[0].ref==="VD-20261023-AB12"&&z.commandes[0].suivi.startsWith("https://")&&z.commandes[1].suivi==="");
 /* liste déroulante de l'écran de connexion */
 D.ven.length=0;D.ven.push({vendeur_ref:"a",ident:"Awa.Boutique",nom:"Boutique Awa",actif:true,user_id:"x1"},{vendeur_ref:"b",ident:"old.shop",nom:"Ancien",actif:false,user_id:"x2"},{vendeur_ref:"c",ident:"koffi.mode",nom:"Koffi Mode",actif:true,user_id:"x3",tel:"0700000000"});
 const l0=await P.listerVendeurs(db,{listeVendeursLogin:true}),l1=await P.listerVendeurs(db,{listeVendeursLogin:false});
 chk("VC-20","liste de connexion des vendeurs : seulement les comptes actifs, identifiant en minuscules + nom, rien d'autre (ni téléphone, ni référence) ; désactivable par réglage",l0.status===200&&l0.body.vendeurs.length===2&&l0.body.vendeurs[0].ident==="awa.boutique"&&Object.keys(l0.body.vendeurs[0]).sort().join()==="ident,nom"&&!JSON.stringify(l0.body).includes("0700000000")&&l1.body.vendeurs.length===0,JSON.stringify(l0.body));
 /* demandes des clients du vendeur : publication, commande liée, refus, clé de relève retirée */
 D.ven.length=0;D.cles.length=0;D.users.length=0;D.cmds.length=0;D.etat={};
 const m1=await P.traiterSync(db,cfg,{action:"vendeur-compte-creer",vendeur_ref:"vz",nom:"Zahara",ident:"zahara"},cfg.adminKey);
 const uz=D.users[0].id;D.ven[0].user_id=uz;
 chk("VC-21","création du compte vendeur : sa clé de relève est retirée (ses demandes ne lui sont plus réservées, elles arrivent dans son application)",m1.status===200&&D.cles.includes("vz"));
 D.cles.length=0;
 const DM={ref:"AB12CD",nom:"Mme Konan",tel:"0505777777",zone:"Abobo",quartier:"Anonkoua",repere:"Face à l'église",note:"Livrer avant 18h",cree_le:"2026-10-23T08:00:00Z",nb_photos:2,gps:{lat:5.4,lng:-4.0},acompte:{montant:5000,op:"Orange",ref:"MP123"},lignes:[{desig:"Robe wax",qte:1,pu:null},{desig:"Foulard",qte:2,pu:3000}],secret:"x"};
 await P.traiterSync(db,cfg,{action:"vendeur-publier",vendeurs:[{vendeur_ref:"vz",etat:{nom:"Zahara",demandes:[DM,{ref:""},{ref:"ZZ99YY",nom:"Autre",lignes:[]}]}}]},cfg.adminKey);
 const g=await P.traiterVendeurEtat(db,{action:"etat"},uz),dm=g.body.demandes;
 chk("VC-22","les demandes clients sont publiées au vendeur (client, téléphone, adresse, articles avec prix éventuellement inconnu, acompte, nombre de captures) ; champ inconnu supprimé ; entrée sans référence ignorée ; clé de relève retirée à chaque publication",dm.length===2&&dm[0].tel==="0505777777"&&dm[0].lignes[0].pu===null&&dm[0].lignes[1].pu===3000&&dm[0].acompte.montant===5000&&dm[0].nb_photos===2&&dm[0].gps.lat===5.4&&!JSON.stringify(dm).includes('"secret"')&&D.cles.includes("vz"),JSON.stringify(dm));
 const k1=await P.traiterVendeurEtat(db,Object.assign({action:"commander"},C,{ref:"VD-20261023-DM01",demande:"ab12cd"}),uz);
 chk("VC-23","commande préparée à partir d'une demande : la référence de la demande suit la commande jusqu'au bureau",k1.status===200&&D.cmds[0].donnees.demande==="AB12CD",JSON.stringify(D.cmds[0]));
 const r1=await P.traiterVendeurEtat(db,{action:"refuser",demande:"zz99yy",motif:"Rupture de stock"},uz),r2=await P.traiterVendeurEtat(db,{action:"refuser",demande:"zz99yy"},uz),r3=await P.traiterVendeurEtat(db,{action:"refuser",demande:"x"},uz),r4=await P.traiterVendeurEtat(db,{action:"refuser",demande:"zz99yy"},null);
 const rf=D.cmds.filter(c=>c.donnees.type==="refus");
 chk("VC-24","refus d'une demande : transmis au bureau (une seule fois même renvoyé), référence invalide refusée, jeton obligatoire",r1.status===200&&r2.status===200&&rf.length===1&&rf[0].donnees.demande==="ZZ99YY"&&rf[0].donnees.motif==="Rupture de stock"&&r3.status===400&&r4.status===401,JSON.stringify(rf));
 const nz=P.nettoyerEtatVendeur({nom:"A",ref:"V1 <x>",tel:"07 01 02 03 04",org:"ANGEL'S GROUP",stats30:{dem:6,qr:3,lien:2,live:1,ok:4,x:9}});
 chk("VC-25","projection : référence du vendeur (nettoyée), téléphone du vendeur, nom de l'entreprise et statistiques de 30 jours conservés ; champ inconnu supprimé",nz.ref==="V1x"&&nz.tel==="07 01 02 03 04"&&nz.org==="ANGEL'S GROUP"&&nz.stats30.dem===6&&nz.stats30.live===1&&nz.stats30.x===undefined,JSON.stringify(nz));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");process.exit(ko?1:0);
})();
