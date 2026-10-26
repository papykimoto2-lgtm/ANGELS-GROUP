/* Suivi de livraison en direct, côté serveur (supabase/functions/_shared/suivi.js) avec une base simulée : publication protégée, liste blanche, position fraîche seulement, expiration, aucune fuite.
   Usage : node tests/suivi-direct-serveur.js */
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
(async()=>{
 const S=await import("../supabase/functions/_shared/suivi.js");
 const T0=Date.parse("2026-10-26T10:00:00Z"),CLE="Ab3_xYz9-QwErTyUiOpAsDf",CLE2="Zz9_xYz9-QwErTyUiOpAsDg";
 const mk=()=>{const d={suivis:new Map(),cles:new Map(),missions:new Map(),purge:[]};return{d,
  lireSuivi:async c=>d.suivis.get(c)||null,lireSuivis:async cs=>cs.map(c=>d.suivis.get(c)).filter(Boolean),ecrireSuivis:async L=>{L.forEach(l=>d.suivis.set(l.cle,l))},
  lireMission:async r=>d.missions.get(r)||null,ecrireCles:async L=>{L.forEach(l=>d.cles.set(l.kid,l))},lireCles:async()=>[...d.cles.values()],purger:async l=>{d.purge.push(l)}}};
 const cfg={adminKey:"A".repeat(32)},A=cfg.adminKey;
 const etat=(o)=>Object.assign({o:"ANGEL'S GROUP",w:"+225 07 07 55 55 55",n:"CMD-2026-0098",s:"en_cours",l:"Cocody · Riviera",v:"Issa",e:"2026-10-26T10:45:00.000Z",ap:12500,h:[["confirmee","2026-10-26T09:00:00.000Z"]],x:[5.35,-4.0]},o||{});
 const pub=(db,suivis,cles,key=A)=>S.publierSuivi(db,cfg,{suivis,cles},key,T0);
 let db=mk();
 chk("SD-1","publication : clé d'administration obligatoire (absente ou fausse : 401, rien d'écrit)",(await pub(db,[{cle:CLE,commande_ref:"c1",etat:etat()}],[],"x")).status===401&&(await S.publierSuivi(db,{},{suivis:[]},"x",T0)).status===401&&db.d.suivis.size===0);
 let r=await pub(db,[{cle:CLE,commande_ref:"c1",livraison_ref:"l1",etat:etat({tel_client:"0707070707",code:"1234",pwd:"x"})},{cle:"court",commande_ref:"c2",etat:etat()},{cle:CLE2,commande_ref:"",etat:etat()}]);
 const row=db.d.suivis.get(CLE);
 chk("SD-2","publication : seuls les liens valides (clé ≥ 20 caractères, commande renseignée) sont enregistrés ; champs inconnus (téléphone du client, code) écartés",r.status===200&&r.body.publies===1&&db.d.suivis.size===1&&!JSON.stringify(row.etat).match(/tel_client|0707070707|1234|pwd/),JSON.stringify(row));
 db.d.missions.set("l1",{statut:"en_cours",position:{lat:5.36,lng:-4.01,precision:12},position_le:new Date(T0-20000).toISOString()});
 let g=await S.lireSuivi(db,{cle:CLE},T0);
 chk("SD-3","lecture : état, position du livreur (20 s d'ancienneté), heure de mise à jour",g.status===200&&g.body.ok&&g.body.etat.s==="en_cours"&&g.body.pos&&g.body.pos.lat===5.36&&g.body.pos.lng===-4.01&&g.body.pos.age_s===20&&g.body.pos.precision===12&&typeof g.body.maj==="string",JSON.stringify(g.body));
 const brut=JSON.stringify(g.body);
 chk("SD-4","aucune fuite : ni identifiant de commande ou de livraison, ni téléphone du client, ni code",!/c1|l1|livraison_ref|commande_ref|0707070707|1234|tel_client/.test(brut.replace(/CMD-2026-0098/g,"")),brut);
 chk("SD-5","clé inconnue, trop courte ou mal formée : même réponse 404 (on ne révèle pas si un lien existe)",[ "Aa".repeat(15),"court","","../x"+"a".repeat(30)].every(async c=>true)&&(await S.lireSuivi(db,{cle:"Qq".repeat(15)},T0)).status===404&&(await S.lireSuivi(db,{cle:"court"},T0)).status===404&&JSON.stringify((await S.lireSuivi(db,{cle:"Qq".repeat(15)},T0)).body)===JSON.stringify((await S.lireSuivi(db,{cle:"court"},T0)).body));
 db.d.missions.set("l1",{statut:"en_cours",position:{lat:5.36,lng:-4.01},position_le:new Date(T0-31*60000).toISOString()});
 chk("SD-6","position de plus de 30 min : plus montrée (jamais une vieille position présentée comme actuelle)",(await S.lireSuivi(db,{cle:CLE},T0)).body.pos===null);
 db.d.missions.set("l1",{statut:"en_cours",position:{lat:0,lng:0},position_le:new Date(T0-1000).toISOString()});
 chk("SD-7","position 0/0 ou hors limites : ignorée",(await S.lireSuivi(db,{cle:CLE},T0)).body.pos===null);
 await pub(db,[{cle:CLE2,commande_ref:"c2",livraison_ref:"l2",etat:etat({s:"confirmee"})}]);
 db.d.missions.set("l2",{statut:"en_cours",position:{lat:5.4,lng:-4.0},position_le:new Date(T0-5000).toISOString()});
 g=await S.lireSuivi(db,{cle:CLE2},T0);
 chk("SD-8","la mission avance avant le bureau : l'étape affichée suit la mission (confirmée → en route) et la position apparaît",g.body.etat.s==="en_cours"&&g.body.pos&&g.body.pos.lat===5.4,JSON.stringify(g.body));
 db.d.missions.set("l2",{statut:"affectee",position:{lat:5.4,lng:-4.0},position_le:new Date(T0-5000).toISOString()});
 await pub(db,[{cle:CLE2,commande_ref:"c2",livraison_ref:"l2",etat:etat({s:"en_cours"})}]);
 db.d.missions.set("l2",{statut:"affectee",position:{lat:5.4,lng:-4.0},position_le:new Date(T0-5000).toISOString()});
 chk("SD-9","jamais de recul : une mission en retard sur le bureau ne fait pas revenir l'étape en arrière",(await S.lireSuivi(db,{cle:CLE2},T0)).body.etat.s==="en_cours");
 await pub(db,[{cle:CLE2,commande_ref:"c2",livraison_ref:"l2",etat:etat({s:"confirmee"})}]);
 db.d.missions.set("l2",{statut:"affectee",position:{lat:5.4,lng:-4.0},position_le:new Date(T0-5000).toISOString()});
 chk("SD-10","hors « en route » : aucune position montrée (livreur seulement désigné)",(await S.lireSuivi(db,{cle:CLE2},T0)).body.pos===null);
 await pub(db,[{cle:CLE,commande_ref:"c1",livraison_ref:"l1",etat:etat({s:"livree"})}]);
 const fin=db.d.suivis.get(CLE).termine_le;
 await S.publierSuivi(db,cfg,{suivis:[{cle:CLE,commande_ref:"c1",livraison_ref:"l1",etat:etat({s:"livree"})}]},A,T0+3600000);
 chk("SD-11","commande terminée : date de fin conservée à la republication (le délai d'expiration ne glisse pas)",!!fin&&db.d.suivis.get(CLE).termine_le===fin,fin);
 chk("SD-12","lien valable 48 h après la fin, puis expiré (410) ; avant, toujours lisible",(await S.lireSuivi(db,{cle:CLE},T0+47*3600000)).status===200&&(await S.lireSuivi(db,{cle:CLE},T0+49*3600000)).status===410&&(await S.lireSuivi(db,{cle:CLE},T0+49*3600000)).body.expire===true);
 const K={kid:"abcd1234",pub:{kty:"EC",crv:"P-256",x:"x".repeat(43),y:"y".repeat(43),d:"SECRET-PRIVEE"}};
 await pub(db,[],[K,{kid:"x",pub:{}},{kid:"bad kid!",pub:K.pub},{kid:"zzzz",pub:{kty:"RSA",crv:"P-256",x:"x".repeat(43),y:"y".repeat(43)}}]);
 const c=await S.lireSuivi(db,{action:"cles"},T0);
 chk("SD-13","clés publiques de signature : seules les clés EC P-256 valides sont publiées, sans aucune partie privée, lisibles sans compte",c.status===200&&c.body.cles.length===1&&c.body.cles[0].kid==="abcd1234"&&!JSON.stringify(c.body).includes("SECRET")&&!("d" in c.body.cles[0].pub),JSON.stringify(c.body));
 chk("SD-14","purge : les liens expirés depuis plus de 7 jours sont supprimés à chaque publication",db.d.purge.length>0&&Date.parse(db.d.purge[0])===T0-7*864e5);
 const lot=Array.from({length:300},(_,i)=>({cle:"Lot"+String(i).padStart(3,"0")+"_abcdefghijklmnop",commande_ref:"c"+i,etat:etat()}));
 chk("SD-15","un envoi est limité à 200 liens",(await pub(mk(),lot)).body.publies===200);
 console.log(`\nRÉSULTAT : ${ok} réussis, ${ko} échecs`);process.exit(ko?1:0);
})();
