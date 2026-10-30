/* Accès chauffeur (serveur) : authentification, isolation des données, revalidation des saisies. Base en mémoire. Usage : node tests/chauffeur-serveur.js */
const crypto=require("crypto");let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
const pwd=(m,it=150000)=>{const s=crypto.randomBytes(16),h=crypto.pbkdf2Sync(m,s,it,32,"sha256");return{v:2,it,s:s.toString("base64"),h:h.toString("base64")}};
(async()=>{
 const C=await import("../supabase/functions/_shared/chauffeur.js"),mem=require("./chauffeur-memoire.js"),E=require("../circuit-engine.js");
 const db=mem(),cfg={cle:"K".repeat(32)},NOW=Date.now(),iso=t=>new Date(t).toISOString(),T=(req,n=NOW)=>C.traiterChauffeur(db,cfg,req,n);
 const put=(coll,o,id)=>db.ecrire([{app:"transport",coll,id:id||o.id,data:o,rev:1,supprime:false,par:"poste"}]);
 const MDP="Chauffeur@Test2026";
 /* jeu de données : 2 chauffeurs, 1 admin, véhicules (communal / libre), contrat, échéances, paiements, courses de la flotte */
 await put("users",{id:"u1",nom:"Kouassi",role:"chauffeur",actif:true,driver_id:"d1",pwd:pwd(MDP)});
 await put("users",{id:"u2",nom:"Traoré",role:"chauffeur",actif:true,driver_id:"d2",pwd:pwd("Autre@Mdp2026x")});
 await put("users",{id:"u3",nom:"Temp",role:"chauffeur",actif:true,driver_id:"d3",pwd:pwd("Temporaire@2026"),chg:true});
 await put("users",{id:"ua",nom:"KESSIE",role:"admin",actif:true,pwd:pwd("Admin@Secret2026")});
 await put("users",{id:"ui",nom:"Inactif",role:"chauffeur",actif:false,driver_id:"d9",pwd:pwd(MDP)});
 for(const [id,nom] of [["d1","Kouassi Yao"],["d2","Traoré Ali"],["d3","Temp"]])await put("drivers",{id,nom,actif:true,tiers_id:"t_"+id});
 await put("tiers",{id:"t_d1",type:"chauffeur",nom:"Kouassi",aux:"41110001"});
 await put("vehicles",{id:"v1",immat:"1 AA 01",statut:"actif",exploit:"intra",commune:"Cocody"});await put("vehicles",{id:"v2",immat:"2 BB 02",statut:"actif"});await put("vehicles",{id:"v3",immat:"3 CC 03",statut:"actif",exploit:"inter"});
 await put("assignments",{id:"a1",driver_id:"d1",vehicle_id:"v1",debut:"2026-01-01",fin:null});await put("assignments",{id:"a2",driver_id:"d2",vehicle_id:"v2",debut:"2026-01-01",fin:null});await put("assignments",{id:"a3",driver_id:"d3",vehicle_id:"v3",debut:"2026-01-01",fin:null});
 await put("contracts",{id:"c1",driver_id:"d1",vehicle_id:"v1",mode:"recette",montant:15000,statut:"actif",debut:"2026-10-30"});await put("contracts",{id:"c2",driver_id:"d2",vehicle_id:"v2",mode:"recette",montant:99999,statut:"actif",debut:"2026-10-30"});
 await put("obligations",{id:"o1",driver_id:"d1",date_ech:"2026-10-29",montant:15000,num:1});await put("obligations",{id:"o2",driver_id:"d1",date_ech:"2026-10-30",montant:15000,num:2});await put("obligations",{id:"o3",driver_id:"d2",date_ech:"2026-10-30",montant:99999,num:3});
 await put("allocs",{id:"al1",payment_id:"p1",obligation_id:"o1",montant:15000,actif:true});await put("allocs",{id:"al3",payment_id:"p3",obligation_id:"o3",montant:99999,actif:true});
 await put("payments",{id:"p1",driver_id:"d1",montant:15000,statut:"confirme"});await put("payments",{id:"p3",driver_id:"d2",montant:99999,statut:"confirme"});
 await put("receipts",{id:"r1",driver_id:"d1",montant:15000,numero:"REC-1"});await put("receipts",{id:"r3",driver_id:"d2",montant:99999,numero:"REC-3"});
 await put("lignes",{id:"lg1",nom:"Gare Adjamé — Siporex",commune:"Adjamé",commune_arrivee:"Yopougon",tarif:400,places:4,actif:true});await put("lignes",{id:"lg2",nom:"Ligne off",commune:"Adjamé",tarif:100,places:4,actif:false});
 await put("pos_chauf",{id:"pc_d2",driver_id:"d2",lat:5.3,lng:-4,t:iso(NOW)});
 await put("_doc",{v:{tarifs_communes:[{commune:"Cocody",tarif:250}],fne:{secret:"NE-PAS-DIVULGUER"},comptes:{x:1},mdp_min:10,org_nom:"ANGEL'S"}},"settings");
 for(let i=0;i<30;i++)await put("courses",{id:"crs_f"+i,driver_id:i%2?"d1":"d2",zone:"Plateau",montant:2000,t:iso(NOW-i*H())});function H(){return 36e5}
 /* --- CS : authentification */
 const L=await T({action:"liste"});
 chk("CS-1","liste : chauffeurs actifs seulement (id + nom), ni admin, ni inactif, ni empreinte",L.status===200&&L.body.chauffeurs.length===3&&L.body.chauffeurs.every(x=>Object.keys(x).sort().join()==="id,nom")&&!JSON.stringify(L.body).match(/pwd|"h"|KESSIE/),JSON.stringify(L.body));
 const l1=await T({action:"login",uid:"u1",mdp:MDP});
 chk("CS-2","connexion : bon mot de passe → jeton signé et utilisateur",l1.status===200&&l1.body.ok&&l1.body.jeton.includes(".")&&l1.body.utilisateur.driver_id==="d1",JSON.stringify(l1.body));
 const bad=await T({action:"login",uid:"u1",mdp:"mauvais"}),adm=await T({action:"login",uid:"ua",mdp:"Admin@Secret2026"}),ina=await T({action:"login",uid:"ui",mdp:MDP}),inc=await T({action:"login",uid:"nouser",mdp:MDP});
 chk("CS-3","refus uniforme : mauvais mot de passe, compte admin, compte inactif, compte inconnu (même message)",[bad,adm,ina,inc].every(r=>r.status===401&&r.body.erreur==="Utilisateur ou mot de passe incorrect."),JSON.stringify([bad.body,adm.body,ina.body,inc.body]));
 for(let i=0;i<5;i++)await T({action:"login",uid:"u2",mdp:"x"+i});const blk=await T({action:"login",uid:"u2",mdp:"Autre@Mdp2026x"}),apres=await T({action:"login",uid:"u2",mdp:"Autre@Mdp2026x"},NOW+16*6e4);
 chk("CS-4","blocage après 5 échecs : même le bon mot de passe est refusé (429)",blk.status===429,JSON.stringify(blk.body));
 chk("CS-4b","message « compte bloqué » ; débloqué 15 min plus tard avec le bon mot de passe",/bloqué/.test(blk.body.erreur)&&apres.status===200&&apres.body.jeton,JSON.stringify([blk.body,apres.body]));
 const tmp=await T({action:"login",uid:"u3",mdp:"Temporaire@2026"});
 chk("CS-5","mot de passe temporaire : pas de jeton, changement exigé",tmp.body.ok&&tmp.body.changer===true&&!tmp.body.jeton,JSON.stringify(tmp.body));
 const w1=await T({action:"changer_mdp",uid:"u3",mdp:"Temporaire@2026",nouveau:"court"}),w2=await T({action:"changer_mdp",uid:"u3",mdp:"Temporaire@2026",nouveau:"motdepasse"}),w3=await T({action:"changer_mdp",uid:"u3",mdp:"Temporaire@2026",nouveau:"Temporaire@2026"}),w4=await T({action:"changer_mdp",uid:"u3",mdp:"faux",nouveau:"Nouveau@Mdp2026"});
 chk("CS-6","changement de mot de passe : trop court, trop courant, identique, ancien faux → refusés",w1.status===400&&w2.status===400&&w3.status===400&&w4.status===401,JSON.stringify([w1.body,w2.body,w3.body,w4.body]));
 const ch=await T({action:"changer_mdp",uid:"u3",mdp:"Temporaire@2026",nouveau:"Nouveau@Mdp2026"}),ancien=await T({action:"login",uid:"u3",mdp:"Temporaire@2026"}),nouveau=await T({action:"login",uid:"u3",mdp:"Nouveau@Mdp2026"}),row=(await db.lire("transport",[{coll:"users",id:"u3"}]))[0];
 chk("CS-7","changement réussi : jeton, ancien mot de passe invalide, nouveau valide, drapeau « temporaire » retiré, révision incrémentée",ch.body.ok&&ch.body.jeton&&ancien.status===401&&nouveau.body.jeton&&!row.data.chg&&row.rev===2,JSON.stringify([ch.body,ancien.status,nouveau.body.ok,row.rev]));
 /* --- jeton */
 const J=l1.body.jeton,jt=await T({action:"moi",jeton:J}),forge=J.slice(0,-3)+"abc",exp=await T({action:"moi",jeton:J},NOW+15*864e5);
 chk("CS-8","jeton : falsifié, expiré (> 14 j), absent → 401 « reconnectez-vous »",(await T({action:"moi",jeton:forge})).status===401&&exp.status===401&&exp.body.reconnecter===true&&(await T({action:"moi"})).status===401);
 /* --- isolation */
 const M=jt.body,s=JSON.stringify(M);
 chk("CS-9","moi : mes échéances, paiements, reçus, contrat, véhicule — jamais ceux d'un autre chauffeur",jt.status===200&&M.obligations.every(o=>o.driver_id==="d1")&&M.obligations.length===2&&M.paiements.every(p=>p.driver_id==="d1")&&M.recus.every(r=>r.driver_id==="d1")&&M.contrats.length===1&&M.contrats[0].id==="c1"&&M.vehicules.length===1&&M.vehicules[0].id==="v1"&&M.allocations.every(a=>a.obligation_id!=="o3"),s.slice(0,400));
 chk("CS-10","moi : aucun compte, empreinte, secret de réglage, ni position d'un autre chauffeur",!/pwd|Admin@|KESSIE|NE-PAS-DIVULGUER|\"comptes\"|fne|pc_d2|Traor/.test(s)&&!("users" in M)&&Object.keys(M.reglages).every(k=>["tarifs_communes","circuit_zones","seuil_justificatif","mdp_min","defaut_places","org_nom","org_activite","ville","adresse","tel","gps_retention_jours"].includes(k)),Object.keys(M.reglages));
 chk("CS-11","courses de la flotte anonymisées (aucun chauffeur) pour les suggestions de circuits",M.courses_flotte.length>=30&&M.courses_flotte.every(c=>!("driver_id" in c)&&!("par" in c)&&c.zone&&c.t),JSON.stringify(M.courses_flotte[0]));
 chk("CS-12","solde calculé côté serveur (30 000 − 15 000 encaissés = 15 000)",M.solde===15000,M.solde);
 /* --- jeton révoqué */
 const u=(await db.lire("transport",[{coll:"users",id:"u1"}]))[0];await db.ecrire([{app:"transport",coll:"users",id:"u1",data:Object.assign({},u.data,{pwd:pwd("Autre@Nouveau2026")}),rev:u.rev+1,supprime:false,par:"bureau"}]);
 chk("CS-13","jeton invalidé quand le mot de passe change (réinitialisation par le bureau)",(await T({action:"moi",jeton:J})).status===401);
 await db.ecrire([{app:"transport",coll:"users",id:"u1",data:u.data,rev:u.rev+2,supprime:false,par:"bureau"}]);const J1=(await T({action:"login",uid:"u1",mdp:MDP})).body.jeton;
 await db.ecrire([{app:"transport",coll:"users",id:"u1",data:Object.assign({},u.data,{actif:false}),rev:u.rev+3,supprime:false,par:"bureau"}]);
 chk("CS-14","jeton invalidé quand le compte est désactivé",(await T({action:"moi",jeton:J1})).status===401);
 await db.ecrire([{app:"transport",coll:"users",id:"u1",data:u.data,rev:u.rev+4,supprime:false,par:"bureau"}]);const K1=(await T({action:"login",uid:"u1",mdp:MDP})).body.jeton;
 const K2=(await T({action:"login",uid:"u2",mdp:"Autre@Mdp2026x"},NOW+16*6e4)).body.jeton;
 /* --- position */
 const p1=await T({action:"position",jeton:K1,lat:5.36,lng:-4.0,vit:30,prec:12}),r1=(await db.lire("transport",[{coll:"pos_chauf",id:"pc_d1"}]))[0],p2=await T({action:"position",jeton:K1,lat:5.37,lng:-4.0,vit:0,prec:8}),r2=(await db.lire("transport",[{coll:"pos_chauf",id:"pc_d1"}]))[0];
 chk("CS-15","position : écrite pour le chauffeur du jeton (véhicule inclus), mise à jour = révision suivante",p1.body.ok&&r1.data.driver_id==="d1"&&r1.data.vehicle_id==="v1"&&r1.rev===1&&r2.rev===2&&r2.data.lat===5.37);
 const bp=[await T({action:"position",jeton:K1,lat:95,lng:0}),await T({action:"position",jeton:K1,lat:"x",lng:0}),await T({action:"position",jeton:K1,lat:5,lng:200})];
 chk("CS-16","position invalide refusée",bp.every(r=>r.status===400));
 const pd2=(await db.lire("transport",[{coll:"pos_chauf",id:"pc_d2"}]))[0];chk("CS-17","la position d'un autre chauffeur n'est jamais modifiée",pd2.rev===1&&pd2.data.lat===5.3);
 await T({action:"arret_position",jeton:K1});chk("CS-18","arrêt : position supprimée (suppression synchronisable)",(await db.lire("transport",[{coll:"pos_chauf",id:"pc_d1"}]))[0].supprime===true);
 /* --- courses : taxi communal (d1/v1 Cocody), libre (d2/v2), de ligne (d3/v3) */
 const cz=C.ZONES_DEF.filter(z=>z.commune==="Cocody")[0].nom;
 const c1=await T({action:"course",jeton:K1,zone:cz,passagers:3,montant:""}),idem=await T({action:"course",jeton:K1,id:c1.body.id,zone:cz,passagers:3,montant:""});
 chk("CS-19","taxi communal : 3 × 250 = 750 F, mode intra, commune ; renvoi avec le même identifiant = idempotent",c1.body.ok&&c1.body.course.montant===750&&c1.body.course.mode==="intra"&&c1.body.course.commune==="Cocody"&&idem.body.deja===true&&(await db.liste("transport","courses",{contient:{driver_id:"d1"}})).filter(c=>c.id===c1.body.id).length===1,JSON.stringify(c1.body));
 const rf=[await T({action:"course",jeton:K1,zone:"Plateau",passagers:2,montant:""}),await T({action:"course",jeton:K1,zone:"Gare Adjamé — Siporex",passagers:2,montant:""}),await T({action:"course",jeton:K1,zone:cz,passagers:2,montant:999}),await T({action:"course",jeton:K1,zone:cz,passagers:6,montant:""})];
 chk("CS-20","taxi communal : refus hors commune, sur une ligne, montant incohérent, > 4 passagers",rf.every(r=>r.status===400),JSON.stringify(rf.map(r=>r.body.erreur)));
 const lib=await T({action:"course",jeton:K2,zone:"Plateau",montant:3000}),lg=await T({action:"course",jeton:K2,zone:"Gare Adjamé — Siporex",passagers:3,montant:""}),off=await T({action:"course",jeton:K2,zone:"Ligne off",passagers:1,montant:""}),inconnue=await T({action:"course",jeton:K2,zone:"Mars",montant:3000}),bas=await T({action:"course",jeton:K2,zone:"Plateau",montant:50});
 chk("CS-21","taxi libre : montant libre ; ligne = passagers × tarif (3 × 400) ; ligne désactivée, zone inconnue, montant trop bas refusés",lib.body.ok&&lg.body.course.montant===1200&&lg.body.course.mode==="ligne"&&!off.body.ok&&!inconnue.body.ok&&!bas.body.ok,JSON.stringify([lib.body.ok,lg.body,off.body,inconnue.body,bas.body]));
 const K3=(await T({action:"login",uid:"u3",mdp:"Nouveau@Mdp2026"},NOW+17*6e4)).body.jeton,i1=await T({action:"course",jeton:K3,zone:"Plateau",montant:2000}),i2=await T({action:"course",jeton:K3,zone:"Gare Adjamé — Siporex",passagers:4,montant:""});
 chk("CS-22","taxi de ligne : zone refusée, ligne acceptée (4 × 400 = 1 600)",i1.status===400&&i2.body.course.montant===1600);
 const fut=await T({action:"course",jeton:K2,zone:"Plateau",montant:3000,t:iso(NOW+3600e3)}),vieux=await T({action:"course",jeton:K2,zone:"Plateau",montant:3000,t:iso(NOW-72*36e5)});
 chk("CS-23","heure : future et > 48 h refusées",fut.status===400&&vieux.status===400);
 const ret=await T({action:"retirer_course",jeton:K2,id:lib.body.id}),autre=await T({action:"retirer_course",jeton:K2,id:"crs_f1"}),mien=await T({action:"retirer_course",jeton:K1,id:lib.body.id});
 chk("CS-24","retrait : ma course oui ; celle d'un autre chauffeur non (403) ; course ancienne (> 24 h) non",ret.body.ok&&autre.status===403&&mien.status===403&&(await T({action:"retirer_course",jeton:K2,id:"crs_f"+25})).status===403);
 /* --- déclaration de recette */
 const dr=await T({action:"declarer_recette",jeton:K1,date:iso(NOW).slice(0,10),montant:15000,mode:"especes",ref:"",note:"RAS"}),sq=(await db.lire("transport",[{coll:"_doc",id:"seq"}]))[0],nt=await db.liste("transport","notifs",{contient:{to:"staff"}});
 chk("CS-25","déclaration de recette : numéro DR-AAAA-00001, compteur mis à jour, notification au bureau",dr.body.ok&&/^DR-\d{4}-00001$/.test(dr.body.declaration.numero)&&sq.data.v.dcl===1&&nt.length>=1&&dr.body.declaration.statut==="declaree");
 const dbl=await T({action:"declarer_recette",jeton:K1,date:iso(NOW).slice(0,10),montant:1,mode:"especes"}),dfut=await T({action:"declarer_recette",jeton:K1,date:"2999-01-01",montant:1000,mode:"especes"}),dmode=await T({action:"declarer_recette",jeton:K1,date:"2026-01-01",montant:1000,mode:"cheque"});
 chk("CS-26","déclaration : doublon de date, date future, mode invalide refusés",dbl.status===400&&dfut.status===400&&dmode.status===400);
 const rd=await T({action:"retirer_declaration",jeton:K2,id:dr.body.id}),rd1=await T({action:"retirer_declaration",jeton:K1,id:dr.body.id}),rd2=await T({action:"retirer_declaration",jeton:K1,id:dr.body.id});
 chk("CS-27","retrait d'une déclaration : celle d'un autre refusée ; la mienne retirée avec historique ; déjà retirée refusée",rd.status===403&&rd1.body.declaration.statut==="retiree"&&rd1.body.declaration.hist.length===2&&rd2.status===400);
 /* --- demandes */
 const dm=await T({action:"demande",jeton:K1,type:"profil",texte:"Nouveau numéro",payload:{tel:"0700000000",adresse:"Yopougon <script>"}}),dmo=await T({action:"demande",jeton:K1,type:"contestation",texte:"Erreur",ob:"o3"}),dmt=await T({action:"demande",jeton:K1,type:"hack",texte:"x"}),dmv=await T({action:"demande",jeton:K1,type:"autre",texte:"  "});
 chk("CS-28","demandes : profil enregistré (charge utile limitée) ; échéance d'un autre refusée ; type invalide et message vide refusés",dm.body.ok&&dm.body.demande.payload.tel==="0700000000"&&dmo.status===403&&dmt.status===400&&dmv.status===400);
 /* --- divers */
 chk("CS-29","service non configuré (clé absente) et action inconnue",(await C.traiterChauffeur(db,{},{action:"liste"},NOW)).status===500&&(await T({action:"x",jeton:K1})).status===400&&(await T({action:"moi"})).status===401);
 chk("CS-30","ZONES_DEF du serveur identiques à celles du moteur de circuits (noms et communes)",JSON.stringify(C.ZONES_DEF)===JSON.stringify(E.ZONES_DEF.map(z=>({nom:z.nom,commune:z.commune}))),"");
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");process.exit(ko?1:0)})();
