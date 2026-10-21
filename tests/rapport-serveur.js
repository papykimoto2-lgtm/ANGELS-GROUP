/* Rapport quotidien des connexions pour le DG : logique serveur (supabase/functions/_shared/rapport-connexions.js) testée avec une base en mémoire,
   et parité avec le moteur navigateur (rapport-engine.js) : mêmes chiffres, même message WhatsApp, même e-mail.
   Usage : node tests/rapport-serveur.js */
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
(async()=>{
 const R=await import("../supabase/functions/_shared/rapport-connexions.js");
 /* moteur navigateur chargé dans un faux window */
 const fs=require("fs"),store={};global.window=global;global.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}};
 global.document={addEventListener(){},getElementById:()=>null,body:{appendChild(){}}};
 (0,eval)(fs.readFileSync(__dirname+"/../rapport-engine.js","utf8"));const C=global.ANGELS_RAPPORT;
 const NOW=Date.parse("2026-03-10T11:05:00Z"),h=n=>new Date(NOW-n*36e5).toISOString();
 const users=[{id:"u1",nom:"Awa Koné",role:"admin",actif:true},{id:"u2",nom:"Yao <b>",role:"caissier",actif:true},{id:"u3",nom:"Zita",role:"livreur",actif:true},{id:"u4",nom:"Ancien",role:"vendeur",actif:false}];
 const cx=[{t:h(2),uid:"u1",nom:"Awa Koné",role:"admin",ev:"ok",app_:"Ordinateur · Windows · Chrome"},{t:h(5),uid:"u1",nom:"Awa Koné",role:"admin",ev:"ok",app_:"Téléphone · Android · Chrome"},
  {t:h(3),uid:"u2",nom:"Yao <b>",role:"caissier",ev:"ko",motif:"Mot de passe incorrect"},{t:h(3),uid:"u2",nom:"Yao <b>",role:"caissier",ev:"ko"},{t:h(2.5),uid:"u2",nom:"Yao <b>",role:"caissier",ev:"bloque"},{t:h(1),uid:"u2",nom:"Yao <b>",role:"caissier",ev:"out"},
  {t:h(60),uid:"u3",nom:"Zita",role:"livreur",ev:"ok"}];
 const src=[{app:"distribution",users,connexions:cx},{app:"transport",users:[{id:"t1",nom:"Issa",role:"chauffeur",actif:true}],connexions:[]}];
 const debut=new Date(NOW-864e5).toISOString(),fin=new Date(NOW).toISOString();
 const r=R.construire(src,debut,fin);
 chk("RS-1","le rapport compte les connexions réussies, échecs/blocages et personnes sur 24 h (une connexion trop ancienne est écartée)",r.ok===2&&r.ko===3&&r.personnes===1,JSON.stringify([r.ok,r.ko,r.personnes]));
 const d=r.apps[0];
 chk("RS-2","par utilisateur : appareils, dernière connexion, alerte à 3 échecs ; comptes actifs jamais connectés listés (inactifs exclus)",d.users[0].nom==="Awa Koné"&&d.users[0].ok===2&&d.users[0].appareils.length===2&&d.alertes.join()==="Yao <b>"&&d.jamais.map(j=>j.nom).join()==="Yao <b>"&&r.jamais===2,JSON.stringify(d));
 const t=R.texte(r),hm=R.html(r);
 chk("RS-3","texte WhatsApp et e-mail HTML : chiffres, alerte ; les noms sont échappés (pas de balise injectée) ; aucun mot de passe",t.includes("Connexions réussies : 2")&&t.includes("Échecs répétés")&&hm.includes("&lt;b&gt;")&&!/<b>[^<]*Yao <b>/.test(hm)&&!/mot de passe\s*:/i.test(t+hm),t);
 /* parité client / serveur */
 C.construire; const rc=C.construire(src,debut,fin);
 chk("RS-4","parité : le moteur navigateur calcule exactement le même rapport, le même texte et le même e-mail que le serveur",JSON.stringify(rc)===JSON.stringify(r)&&C.texte(rc)===t&&C.html(rc)===hm,"écart client/serveur");
 /* planification */
 const cfg={actif:true,heure:"11:00",emails:["dg@x.ci"],derniere_date:""};
 chk("RS-5","envoi dû seulement si actif, adresse présente, heure passée (Abidjan) et pas déjà envoyé aujourd'hui",R.doitEnvoyer(cfg,NOW)&&!R.doitEnvoyer(cfg,Date.parse("2026-03-10T10:59:00Z"))&&!R.doitEnvoyer({...cfg,derniere_date:"2026-03-10"},NOW)&&!R.doitEnvoyer({...cfg,actif:false},NOW)&&!R.doitEnvoyer({...cfg,emails:[]},NOW)&&R.doitEnvoyer({...cfg,derniere_date:"2026-03-09"},NOW));
 /* traiter */
 let cfgDb=null;const envois=[],db={lireCfg:async()=>cfgDb,ecrireCfg:async p=>{cfgDb={...(cfgDb||{actif:false,heure:"11:00",emails:[],derniere_date:""}),...p}},sources:async()=>src};
 const env=async m=>{envois.push(m)},SK="S".repeat(32),CK="C".repeat(32),srv={syncKey:SK,cronKey:CK};
 const T=(req,cles)=>R.traiter(db,srv,req,cles,env,NOW);
 const a=await T({action:"lire"},{sync:"x"}),b=await T({action:"cron"},{sync:SK}),c=await T({action:"cron"},{cron:"x"}),e0=await R.traiter(db,{},{action:"lire"},{sync:"x"},env,NOW);
 chk("RS-6","clé de synchronisation pour lire/régler/tester, clé de planification pour le cron ; clés absentes côté serveur = refus",a.status===401&&b.status===401&&c.status===401&&e0.status===401);
 const g1=await T({action:"regler",actif:true,heure:"11:00",emails:"dg@x.ci, pas-un-mail"},{sync:SK}),g2=await T({action:"regler",actif:true,emails:"nul"},{sync:SK}),g3=await T({action:"lire"},{sync:SK});
 chk("RS-7","réglage : adresses invalides écartées ; activer sans adresse valide refusé ; relecture fidèle",g1.status===200&&g1.body.emails.join()==="dg@x.ci"&&g2.status===400&&g3.body.cfg.actif&&g3.body.cfg.emails.join()==="dg@x.ci");
 const t1=await T({action:"tester"},{sync:SK});
 chk("RS-8","test : e-mail préfixé [TEST], n'altère pas la date du dernier envoi",t1.body.envoye&&envois[0].sujet.startsWith("[TEST]")&&!cfgDb.derniere_date);
 const av=await R.traiter(db,srv,{action:"cron"},{cron:CK},env,Date.parse("2026-03-10T10:00:00Z")),c1=await T({action:"cron"},{cron:CK}),c2=await T({action:"cron"},{cron:CK});
 chk("RS-9","cron : rien avant l'heure ; un seul envoi par jour (le second passage ne renvoie pas) ; date du jour mémorisée",av.body.envoye===false&&c1.body.envoye===true&&c2.body.envoye===false&&envois.length===2&&cfgDb.derniere_date==="2026-03-10"&&envois[1].a.join()==="dg@x.ci");
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");process.exit(ko?1:0);
})();
