/* Notifications push livreur : abonnement (anti-SSRF, limites) et envoi (clé admin, nettoyage des abonnements morts) avec base et émetteur en mémoire.
   Usage : node tests/push.js */
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
(async()=>{
 const P=await import("../supabase/functions/_shared/push.js");
 const mem=()=>{const D={cpt:{u1:{livreur_ref:"lv1",actif:true},u2:{livreur_ref:"lv2",actif:false}},subs:[]};
  return{D,compteParUtilisateur:async u=>D.cpt[u]||null,
   ecrireAbonnement:async r=>{const i=D.subs.findIndex(x=>x.endpoint===r.endpoint);if(i>=0)D.subs[i]=Object.assign({},D.subs[i],r);else D.subs.push(Object.assign({cree_le:new Date(D.subs.length+1000).toISOString(),echecs:0},r))},
   abonnementsDe:async ref=>D.subs.filter(x=>x.livreur_ref===ref).sort((a,b)=>a.cree_le<b.cree_le?-1:1),
   supprimerAbonnement:async e=>{D.subs=D.subs.filter(x=>x.endpoint!==e)},supprimerAbonnementDe:async(ref,e)=>{D.subs=D.subs.filter(x=>!(x.livreur_ref===ref&&x.endpoint===e))},
   marquerOk:async(e,t)=>{const s=D.subs.find(x=>x.endpoint===e);if(s){s.derniere_ok=t;s.echecs=0}},marquerEchec:async e=>{const s=D.subs.find(x=>x.endpoint===e);if(s)s.echecs=(s.echecs||0)+1}}};
 const K="B".repeat(87),A="a".repeat(22),sub=(n,h="fcm.googleapis.com")=>({endpoint:"https://"+h+"/fcm/send/"+n,keys:{p256dh:K,auth:A}});
 const db=mem();
 /* endpoints */
 chk("PU-1","endpoint : service push connu en HTTPS uniquement (anti-SSRF)",P.endpointValide("https://fcm.googleapis.com/fcm/send/x")&&P.endpointValide("https://updates.push.services.mozilla.com/wpush/v2/x")&&P.endpointValide("https://web.push.apple.com/x")&&!P.endpointValide("http://fcm.googleapis.com/x")&&!P.endpointValide("https://evil.com/x")&&!P.endpointValide("https://fcm.googleapis.com.evil.com/x")&&!P.endpointValide("https://169.254.169.254/latest")&&!P.endpointValide("https://user:pw@fcm.googleapis.com/x")&&!P.endpointValide("https://fcm.googleapis.com:8443/x")&&!P.endpointValide("javascript:alert(1)")&&!P.endpointValide(""));
 /* abonnement */
 let r=await P.traiterAbonnement(db,{action:"abonner",subscription:sub("1")},null);const a1=r.status===401;
 r=await P.traiterAbonnement(db,{action:"abonner",subscription:sub("1")},"u2");const a2=r.status===403;
 r=await P.traiterAbonnement(db,{action:"abonner",subscription:sub("1")},"inconnu");const a3=r.status===403;
 r=await P.traiterAbonnement(db,{action:"abonner",subscription:sub("1","evil.com")},"u1");const a4=r.status===400&&db.D.subs.length===0;
 r=await P.traiterAbonnement(db,{action:"abonner",subscription:{endpoint:sub("1").endpoint,keys:{p256dh:"<script>",auth:A}}},"u1");const a5=r.status===400;
 r=await P.traiterAbonnement(db,{action:"abonner",subscription:sub("1")},"u1","Chrome Android");const a6=r.status===200&&db.D.subs.length===1&&db.D.subs[0].livreur_ref==="lv1"&&db.D.subs[0].agent==="Chrome Android";
 await P.traiterAbonnement(db,{action:"abonner",subscription:sub("1")},"u1");const a7=db.D.subs.length===1;
 chk("PU-2","abonnement : connexion et compte actif exigés, hôte et clés validés, ré-abonnement sans doublon",a1&&a2&&a3&&a4&&a5&&a6&&a7,JSON.stringify([a1,a2,a3,a4,a5,a6,a7]));
 for(let i=2;i<=8;i++)await P.traiterAbonnement(db,{action:"abonner",subscription:sub(String(i))},"u1");
 const eps=db.D.subs.map(x=>x.endpoint.split("/").pop());
 chk("PU-3","maximum 5 abonnements par livreur (les plus anciens supprimés)",db.D.subs.length===5&&!eps.includes("1")&&eps.includes("8"),JSON.stringify(eps));
 r=await P.traiterAbonnement(db,{action:"etat"},"u1");const e1=r.body.abonnements===5;
 r=await P.traiterAbonnement(db,{action:"desabonner",endpoint:sub("8").endpoint},"u1");const e2=r.status===200&&db.D.subs.length===4;
 r=await P.traiterAbonnement(db,{action:"zzz"},"u1");
 chk("PU-4","état, désabonnement, action inconnue refusée",e1&&e2&&r.status===400);
 /* envoi */
 const cfg={adminKey:"cle-admin-secrete"},envs=[];let reponses={};
 const envoyer=async(s,payload)=>{envs.push({s,payload});return{status:reponses[s.endpoint.split("/").pop()]||201}};
 r=await P.traiterEnvoi(db,cfg,{livreur_ref:"lv1",titre:"T"},"mauvaise",envoyer);const s1=r.status===401&&envs.length===0;
 r=await P.traiterEnvoi(db,{adminKey:""},{livreur_ref:"lv1",titre:"T"},"",envoyer);const s2=r.status===401;
 r=await P.traiterEnvoi(db,cfg,{livreur_ref:"lv1"},"cle-admin-secrete",envoyer);const s3=r.status===400;
 chk("PU-5","envoi : clé d'administration exigée (jamais de clé vide), livreur et titre obligatoires",s1&&s2&&s3);
 r=await P.traiterEnvoi(db,cfg,{livreur_ref:"lv1",titre:"🛵 Nouvelle mission",corps:"CMD-0001 · Cocody",tag:"mission-1",url:"https://evil.com/phish"},"cle-admin-secrete",envoyer);
 const pl=JSON.parse(envs[0].payload);
 chk("PU-6","envoi à tous les téléphones du livreur ; charge utile minimale ; lien externe neutralisé",r.body.envoyes===4&&envs.length===4&&pl.t==="🛵 Nouvelle mission"&&pl.b==="CMD-0001 · Cocody"&&pl.tag==="mission-1"&&pl.u==="livreur.html",JSON.stringify([r.body,pl]));
 envs.length=0;reponses={"4":410,"5":404,"6":500};
 r=await P.traiterEnvoi(db,cfg,{livreur_ref:"lv1",titre:"T"},"cle-admin-secrete",envoyer);
 const restes=db.D.subs.map(x=>x.endpoint.split("/").pop()).sort().join(),s4=db.D.subs.find(x=>x.endpoint.endsWith("/6"));
 chk("PU-7","abonnements morts (404 / 410) supprimés ; échec temporaire compté, abonnement gardé",r.body.supprimes===2&&r.body.echecs===1&&r.body.envoyes===1&&restes==="6,7"&&s4.echecs===1,JSON.stringify([r.body,restes,s4&&s4.echecs]));
 reponses={"6":500};for(let i=0;i<5;i++)await P.traiterEnvoi(db,cfg,{livreur_ref:"lv1",titre:"T"},"cle-admin-secrete",envoyer);
 chk("PU-8","un abonnement qui échoue 5 fois de suite est supprimé",!db.D.subs.some(x=>x.endpoint.endsWith("/6"))&&db.D.subs.some(x=>x.endpoint.endsWith("/7")));
 r=await P.traiterEnvoi(db,cfg,{livreur_ref:"inconnu",titre:"T"},"cle-admin-secrete",envoyer);
 const thr=async()=>{const e=async()=>{throw new Error("réseau")};return P.traiterEnvoi(db,cfg,{livreur_ref:"lv1",titre:"T"},"cle-admin-secrete",e)};const rt=await thr();
 chk("PU-9","livreur sans abonnement : succès à zéro envoi ; erreur réseau de l'émetteur absorbée",r.status===200&&r.body.envoyes===0&&rt.status===200&&rt.body.echecs>=1);
 console.log("RÉSULTAT :",ok,"réussis,",ko,"échecs");process.exit(ko?1:0)})();
