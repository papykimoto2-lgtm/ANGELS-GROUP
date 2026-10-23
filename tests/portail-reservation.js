/* Réservations de chauffeur envoyées par le portail : logique serveur (base en mémoire) — nouveau type RESERVATION, relevé séparé de Distributions, migration.
   Usage : node tests/portail-reservation.js */
const fs=require("fs"),path=require("path");const M=require("../mad-engine.js");
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
(async()=>{
 const P=await import("../supabase/functions/_shared/portail-demandes.js");
 const D={rows:[],n:0},NOW=Date.parse("2026-10-20T10:00:00Z");
 const db={compterRecentes:async(h,d)=>D.rows.filter(r=>r.ip_hash===h&&r.cree_le>=d).length,enAttente:async()=>D.rows.filter(r=>!r.traite).length,existe:async ref=>D.rows.some(r=>r.ref===ref),
  inserer:async row=>{D.rows.push(Object.assign({id:++D.n,traite:false,cree_le:new Date(NOW).toISOString()},row))},enAttenteListe:async(n,types)=>D.rows.filter(r=>!r.traite&&(!types||types.includes(r.type))).slice(0,n).map(({id,ref,type,message})=>({id,ref,type,message})),
  acquitter:async ids=>{D.rows.forEach(r=>{if(ids.includes(r.id))r.traite=true})}};
 const cfg={adminKey:"K",sel:"s",limiteHeure:50,fileMax:100};
 const dem=(o)=>M.construireMessage(Object.assign({ref:"RS-AB12CD",nom:"Awa",tel:"0701020304",type_vehicule:"berline",date_debut:"2026-11-02",h_debut:"08:00",h_fin:"18:00",depart:"Cocody"},o||{}),"X");
 let r=await P.recevoir(db,cfg,{message:dem()},"1.1.1.1",NOW);
 chk("PR-1","une réservation du portail est reçue : type RESERVATION, référence nettoyée, mise en file",r.status===200&&r.body.ok&&r.body.refs[0]==="RSAB12CD"&&D.rows[0].type==="RESERVATION"&&D.rows[0].ref==="RSAB12CD",JSON.stringify([r,D.rows[0]]));
 r=await P.recevoir(db,cfg,{message:dem()},"1.1.1.1",NOW);chk("PR-2","la même réservation envoyée deux fois n'est mise qu'une fois en file",r.status===200&&r.body.doublons===1&&D.rows.length===1);
 const legacy="Demande\n[LIVRAISON:"+Buffer.from(JSON.stringify({f:"LV1234",n:"Koffi"})).toString("base64").replace(/=+$/,"")+"]";await P.recevoir(db,cfg,{message:legacy},"2.2.2.2",NOW);
 let L=await P.traiterBureau(db,cfg,{action:"lister"},"K");
 chk("PR-3","Distributions (sans filtre) ne voit que les trois types historiques : il n'acquitte donc jamais une réservation",L.body.demandes.length===1&&L.body.demandes[0].type==="LIVRAISON",JSON.stringify(L.body.demandes.map(x=>x.type)));
 L=await P.traiterBureau(db,cfg,{action:"lister",types:["RESERVATION"]},"K");chk("PR-4","Transport demande explicitement les réservations et ne reçoit que celles-ci",L.body.demandes.length===1&&L.body.demandes[0].type==="RESERVATION"&&M.lireMessages(L.body.demandes[0].message)[0].ok.ref==="RS-AB12CD");
 L=await P.traiterBureau(db,cfg,{action:"lister",types:["N_IMPORTE_QUOI",12,null]},"K");chk("PR-5","des types inconnus sont ignorés : retour au comportement historique",L.body.demandes.length===1&&L.body.demandes[0].type==="LIVRAISON");
 L=await P.traiterBureau(db,cfg,{action:"lister",types:["RESERVATION"]},"MAUVAISE");chk("PR-6","sans la clé d'administration : refusé (401), rien n'est lu",L.status===401&&!L.body.demandes);
 const idR=D.rows.find(x=>x.type==="RESERVATION").id;await P.traiterBureau(db,cfg,{action:"acquitter",ids:[idR]},"K");L=await P.traiterBureau(db,cfg,{action:"lister",types:["RESERVATION"]},"K");chk("PR-7","une réservation acquittée ne revient plus ; la livraison en attente reste intacte",L.body.demandes.length===0&&D.rows.find(x=>x.type==="LIVRAISON").traite===false);
 const bad=await P.recevoir(db,cfg,{message:"[RESERVATION:"+Buffer.from(JSON.stringify({nom:"sans ref"})).toString("base64")+"]"},"3.3.3.3",NOW);chk("PR-8","une réservation sans référence ou illisible est refusée (400)",bad.status===400&&(await P.recevoir(db,cfg,{message:"[RESERVATION:@@@@@@@@@@]"},"3.3.3.3",NOW)).status===400);
 const mig=fs.readFileSync(path.join(__dirname,"..","supabase/migrations/024_portail_reservations.sql"),"utf8"),fn=fs.readFileSync(path.join(__dirname,"..","supabase/functions/_shared/serveur-portail.js"),"utf8");
 chk("PR-9","migration : la contrainte de type accepte RESERVATION sans toucher aux lignes existantes ; l'adaptateur filtre sur les types demandés",/drop constraint if exists pd_demandes_type_check/.test(mig)&&/'ABONNEMENT','RESERVATION'/.test(mig)&&!/delete|update/i.test(mig)&&/q\.in\("type", types\)/.test(fn));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");process.exit(ko?1:0);
})();
