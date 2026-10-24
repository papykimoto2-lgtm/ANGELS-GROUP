/* Remise à zéro du serveur (supabase/functions/_shared/reset.js) avec une base simulée : triple verrou, aperçu sans effet, exécution journalisée, migration.
   Usage : node tests/reset-serveur.js */
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
(async()=>{
 const R=await import("../supabase/functions/_shared/reset.js");
 const base={pg_missions:7,sync_enreg:2443,pd_demandes:3};let appels=[];
 const db={reset:async(ex,par)=>{appels.push({ex,par});return Object.assign({},base)}};
 const cfg={syncKey:"K".repeat(32),resetCode:"CodeSecret2026"},K=cfg.syncKey,att=async()=>{att.n++};att.n=0;
 const ex=()=>appels.filter(a=>a.ex).length,T=(req,c=K,cf=cfg)=>R.traiterReset(db,cf,req,c,att);
 chk("RS-1","clé de synchronisation obligatoire (absente ou fausse) : refus 401, aucun appel à la base",(await T({action:"apercu"},"x")).status===401&&(await R.traiterReset(db,{},{action:"apercu"},"x",att)).status===401&&appels.length===0);
 const a=await T({action:"apercu"});
 chk("RS-2","aperçu : nombres par table, phrase attendue, code configuré ou non ; AUCUNE suppression (executer = faux)",a.status===200&&a.body.comptes.sync_enreg===2443&&a.body.phrase==="VIDER LE SERVEUR"&&a.body.configure===true&&appels.length===1&&appels[0].ex===false&&ex()===0);
 chk("RS-3","sans secret RESET_CODE (ou trop court) : impossible de vider (503) ; l'aperçu indique « non configuré »",(await T({action:"vider",code:"x",phrase:R.PHRASE,sauvegarde:true},K,{syncKey:K})).status===503&&(await T({action:"vider",code:"court",phrase:R.PHRASE,sauvegarde:true},K,{syncKey:K,resetCode:"court"})).status===503&&(await T({action:"apercu"},K,{syncKey:K})).body.configure===false&&ex()===0);
 const m=await T({action:"vider",code:"mauvais",phrase:R.PHRASE,sauvegarde:true});
 chk("RS-4","mauvais code de sécurité : refus 403, temporisation anti-force-brute, rien n'est supprimé",m.status===403&&att.n===1&&ex()===0);
 chk("RS-5","bon code mais mauvaise phrase, ou sauvegarde non confirmée : refus 400, rien n'est supprimé",(await T({action:"vider",code:cfg.resetCode,phrase:"vider",sauvegarde:true})).status===400&&(await T({action:"vider",code:cfg.resetCode,phrase:R.PHRASE})).status===400&&(await T({action:"vider",code:cfg.resetCode,phrase:R.PHRASE,sauvegarde:"oui"})).status===400&&ex()===0);
 const v=await T({action:"vider",code:cfg.resetCode,phrase:R.PHRASE,sauvegarde:true,par:"Administrateur KESSIE"});
 chk("RS-6","triple verrou satisfait : exécution (executer = vrai) avec l'auteur, total des enregistrements supprimés rendu",v.status===200&&v.body.total===7+2443+3&&ex()===1&&appels.filter(a=>a.ex)[0].par==="Administrateur KESSIE");
 chk("RS-7","action inconnue refusée",(await T({action:"detruire"})).status===400);
 const sql=require("fs").readFileSync(__dirname+"/../supabase/migrations/026_reset_production.sql","utf8");
 const gardes=["pg_livreurs","pg_vendeurs","pd_vendeurs","portail_catalogue","pg_push","auth\\."];
 chk("RS-8","migration : fonction réservée à la clé service, journal des exécutions, comptes livreurs/vendeurs/catalogue/notifications/authentification jamais supprimés, tables absentes ignorées",/revoke all on function public\.reset_production/.test(sql)&&/reset_journal/.test(sql)&&/to_regclass/.test(sql)&&gardes.every(t=>!new RegExp("array\\[[^\\]]*'"+t.replace("\\.","")+"'").test(sql))&&/'sync_enreg'/.test(sql)&&/'pg_missions'/.test(sql)&&/security definer/.test(sql));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");process.exit(ko?1:0)})();
