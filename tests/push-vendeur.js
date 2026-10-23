/* Notifications push de l'application vendeur : abonnement (jeton du vendeur) et envoi par le bureau (base en mémoire).
   Usage : node tests/push-vendeur.js */
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
(async()=>{
 const P=await import("../supabase/functions/_shared/push.js");
 const D={liv:[{user_id:"ul",livreur_ref:"lv1",actif:true}],ven:[{user_id:"uv",vendeur_ref:"v1",actif:true},{user_id:"ub",vendeur_ref:"v2",actif:false}],abo:[]};
 const db={compteParUtilisateur:async u=>D.liv.find(x=>x.user_id===u)||null,vendeurParUtilisateur:async u=>D.ven.find(x=>x.user_id===u)||null,
  ecrireAbonnement:async r=>{const i=D.abo.findIndex(x=>x.endpoint===r.endpoint);if(i>=0)D.abo[i]=Object.assign({cree_le:1},r);else D.abo.push(Object.assign({cree_le:D.abo.length},r))},
  abonnementsDe:async(ref,vend)=>D.abo.filter(x=>(vend?x.vendeur_ref:x.livreur_ref)===ref),supprimerAbonnement:async e=>{D.abo=D.abo.filter(x=>x.endpoint!==e)},
  supprimerAbonnementDe:async(ref,e,vend)=>{D.abo=D.abo.filter(x=>!((vend?x.vendeur_ref:x.livreur_ref)===ref&&x.endpoint===e))},marquerOk:async()=>{},marquerEchec:async()=>{}};
 const sub=n=>({endpoint:"https://fcm.googleapis.com/fcm/send/abc"+n,keys:{p256dh:"B".repeat(87),auth:"a".repeat(22)}});
 const a0=await P.traiterAbonnement(db,{action:"abonner",subscription:sub(1)},null),a1=await P.traiterAbonnement(db,{action:"abonner",subscription:sub(1)},"uv"),a2=await P.traiterAbonnement(db,{action:"abonner",subscription:sub(2)},"ub"),a3=await P.traiterAbonnement(db,{action:"abonner",subscription:sub(3)},"inconnu");
 chk("PV-1","abonnement vendeur : jeton obligatoire (401), vendeur actif accepté, vendeur bloqué ou inconnu refusé (403)",a0.status===401&&a1.status===200&&a2.status===403&&a3.status===403&&D.abo.length===1&&D.abo[0].vendeur_ref==="v1"&&D.abo[0].livreur_ref===null,JSON.stringify(D.abo));
 const e1=await P.traiterAbonnement(db,{action:"abonner",subscription:{endpoint:"https://evil.example/x",keys:sub(1).keys}},"uv");
 chk("PV-2","service de notification inconnu refusé (anti-SSRF)",e1.status===400);
 await P.traiterAbonnement(db,{action:"abonner",subscription:sub(9)},"ul");
 chk("PV-3","un livreur garde son propre abonnement, séparé de celui des vendeurs",D.abo.filter(x=>x.livreur_ref==="lv1").length===1&&D.abo.filter(x=>x.vendeur_ref==="v1").length===1);
 const envoyes=[];const env=async(s,pl)=>{envoyes.push({s,pl:JSON.parse(pl)});return{status:201}};const cfg={adminKey:"K-ADMIN"};
 const s0=await P.traiterEnvoi(db,cfg,{vendeur_ref:"v1",titre:"📥 Nouvelle demande client",corps:"Mme Konan · 2 article(s)",tag:"dm-AB12CD",url:"vendeur.html#demandes"},"mauvaise",env);
 const s1=await P.traiterEnvoi(db,cfg,{vendeur_ref:"v1",titre:"📥 Nouvelle demande client",corps:"Mme Konan · 2 article(s)",tag:"dm-AB12CD",url:"vendeur.html#demandes"},"K-ADMIN",env);
 chk("PV-4","envoi vendeur : clé d'administration obligatoire ; la notification part vers les appareils du vendeur seulement, avec l'icône vendeur et le lien vers ses demandes",s0.status===401&&s1.status===200&&s1.body.envoyes===1&&envoyes.length===1&&envoyes[0].pl.i==="icons/vendeur-192.png"&&envoyes[0].pl.u==="vendeur.html#demandes"&&envoyes[0].s.endpoint.endsWith("abc1"),JSON.stringify([s1.body,envoyes]));
 const s2=await P.traiterEnvoi(db,cfg,{vendeur_ref:"v1",titre:"x",url:"https://evil.example/phish"},"K-ADMIN",env);
 chk("PV-5","lien d'ouverture externe refusé : retour à l'application vendeur",envoyes[1].pl.u==="vendeur.html");
 envoyes.length=0;await P.traiterEnvoi(db,cfg,{livreur_ref:"lv1",titre:"🛵 Mission"},"K-ADMIN",env);
 chk("PV-6","envoi livreur inchangé : icône et lien livreur, aucun envoi vers un vendeur",envoyes.length===1&&envoyes[0].pl.u==="livreur.html"&&envoyes[0].pl.i===undefined&&envoyes[0].s.endpoint.endsWith("abc9"));
 const d1=await P.traiterAbonnement(db,{action:"desabonner",endpoint:sub(1).endpoint},"uv"),st=await P.traiterAbonnement(db,{action:"etat"},"uv");
 chk("PV-7","désabonnement vendeur : son abonnement disparaît, pas celui du livreur",d1.status===200&&st.body.abonnements===0&&D.abo.length===1&&D.abo[0].livreur_ref==="lv1");
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");process.exit(ko?1:0);
})();
