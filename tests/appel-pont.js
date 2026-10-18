/* Pont téléphonique (étape 2) : logique serveur testée avec une base en mémoire et un faux opérateur.
   Usage : node tests/appel-pont.js */
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
(async()=>{
 const P=await import("../supabase/functions/_shared/pont.js");
 const mem=()=>{const T=[],J=[];let n=0;return{T,J,
  upsertTicket:async t=>{const i=T.findIndex(x=>x.commande===t.commande&&x.livreur_id===t.livreur_id);if(i>=0)T[i]=Object.assign({},T[i],t);else T.push(Object.assign({id:"t"+(++n)},t))},
  getTicket:async(c,l)=>T.find(x=>x.commande===c&&x.livreur_id===l)||null,getTicketId:async id=>T.find(x=>x.id===id)||null,
  clore:async(c,l)=>{T.filter(x=>x.commande===c&&x.livreur_id===l).forEach(x=>x.clos=true)},
  journalDe:async id=>J.filter(x=>x.ticket_id===id),addJournal:async(tid,statut,erreur)=>{const a={id:"a"+(++n),ticket_id:tid,ts:new Date(NOW).toISOString(),statut,erreur};J.push(a);return a},
  getAppel:async id=>J.find(x=>x.id===id)||null,majJournal:async(id,statut,d,e)=>{const a=J.find(x=>x.id===id);if(a){a.statut=statut;a.duree_s=d;a.erreur=e}}}};
 let NOW=Date.parse("2026-10-18T10:00:00Z");const cfg={indicatif:"225",adminKey:"ADMIN-SECRET-123",voixSecret:"VOIX-SECRET",atUser:"angels",atKey:"AT-KEY",atNumero:"+2250100000000",delaiMini:20,dureeMax:300};
 const CLE="cle-livreur-0123456789abcdef";
 chk("AP-1","numéros normalisés (format local ivoirien, +225, 00225) ; invalides refusés",P.normTel("07 07 12 34 56")==="+2250707123456"&&P.normTel("+225 0707123456")==="+2250707123456"&&P.normTel("00225 0707123456")==="+2250707123456"&&P.normTel("2250707123456")==="+2250707123456"&&P.normTel("12")===""&&P.normTel("")==="",[P.normTel("07 07 12 34 56"),P.normTel("12")]);
 const db=mem();
 const t0=await P.traiterTicket(db,cfg,{commande:"CMD-1",livreur_id:"lv1",cle:CLE,livreur_tel:"0505050505",client_tel:"0707123456",client_nom:"Awa",expire_h:6},"mauvaise",NOW);
 const t1=await P.traiterTicket(db,cfg,{commande:"CMD-1",livreur_id:"lv1",cle:CLE,livreur_tel:"0505050505",client_tel:"0707123456",client_nom:"Awa",expire_h:6},cfg.adminKey,NOW);
 const e1=await P.traiterTicket(db,cfg,{commande:"CMD-2",livreur_id:"lv1",cle:"court",livreur_tel:"0505050505",client_tel:"0707123456"},cfg.adminKey,NOW),e2=await P.traiterTicket(db,cfg,{commande:"CMD-2",livreur_id:"lv1",cle:CLE,livreur_tel:"0505050505",client_tel:"12"},cfg.adminKey,NOW);
 chk("AP-2","ticket : refusé sans la clé d'administration, accepté avec ; clé courte et numéro invalide refusés ; la clé du livreur n'est stockée que hachée",t0.status===401&&t1.status===200&&e1.status===400&&e2.status===400&&db.T.length===1&&db.T[0].cle_hash!==CLE&&!JSON.stringify(db.T).includes(CLE)&&db.T[0].client_tel==="+2250707123456",[t0,t1,e1,e2]);
 let appels=[];const op=async(url,o)=>{appels.push({url,corps:String(o.body),h:o.headers});return{ok:true,status:201,json:async()=>({entries:[{status:"Queued",phoneNumber:"+2250505050505"}]})}};
 const a0=await P.traiterAppel(db,cfg,{commande:"CMD-1",livreur_id:"lv1",cle:"mauvaise-cle-0123456789"},op,NOW),a1=await P.traiterAppel(db,cfg,{commande:"CMD-INCONNUE",livreur_id:"lv1",cle:CLE},op,NOW);
 chk("AP-3","appel : mauvaise clé et commande inconnue donnent la même réponse (403) sans appeler l'opérateur",a0.status===403&&a1.status===403&&a0.body.erreur===a1.body.erreur&&appels.length===0,[a0,a1]);
 const a2=await P.traiterAppel(db,cfg,{commande:"CMD-1",livreur_id:"lv1",cle:CLE},op,NOW);
 const corps=new URLSearchParams(appels[0]&&appels[0].corps);
 chk("AP-4","appel autorisé : l'opérateur sonne d'abord chez le livreur ; le numéro du client n'est ni envoyé à l'opérateur à ce stade ni renvoyé au livreur",a2.status===200&&appels.length===1&&corps.get("to")==="+2250505050505"&&corps.get("from")===cfg.atNumero&&!appels[0].corps.includes("707123456")&&!JSON.stringify(a2.body).includes("0707")&&appels[0].h.apiKey==="AT-KEY"&&corps.get("clientRequestId")===db.J[0].id,[a2,appels]);
 const a3=await P.traiterAppel(db,cfg,{commande:"CMD-1",livreur_id:"lv1",cle:CLE},op,NOW+5000);
 NOW+=60000;const a4=await P.traiterAppel(db,cfg,{commande:"CMD-1",livreur_id:"lv1",cle:CLE},op,NOW);NOW+=60000;await P.traiterAppel(db,cfg,{commande:"CMD-1",livreur_id:"lv1",cle:CLE},op,NOW);NOW+=60000;await P.traiterAppel(db,cfg,{commande:"CMD-1",livreur_id:"lv1",cle:CLE},op,NOW);NOW+=60000;const a5=await P.traiterAppel(db,cfg,{commande:"CMD-1",livreur_id:"lv1",cle:CLE},op,NOW);
 chk("AP-5","limites : relance trop rapprochée refusée (429) ; 4 appels maximum par mission",a3.status===429&&a4.status===200&&a5.status===429&&appels.length===4,[a3.status,a4.status,a5.status,appels.length]);
 await P.traiterTicket(db,cfg,{commande:"CMD-3",livreur_id:"lv1",cle:CLE,livreur_tel:"0505050505",client_tel:"0707123456",expire_h:1},cfg.adminKey,NOW);
 const ex=await P.traiterAppel(db,cfg,{commande:"CMD-3",livreur_id:"lv1",cle:CLE},op,NOW+2*36e5);
 await P.traiterCloture(db,cfg,{commande:"CMD-3",livreur_id:"lv1"},cfg.adminKey);const cl=await P.traiterAppel(db,cfg,{commande:"CMD-3",livreur_id:"lv1",cle:CLE},op,NOW);const cl0=await P.traiterCloture(db,cfg,{commande:"CMD-3",livreur_id:"lv1"},"x");
 chk("AP-6","autorisation expirée ou mission clôturée : appel refusé (410) ; la clôture exige la clé d'administration",ex.status===410&&cl.status===410&&cl0.status===401,[ex.status,cl.status,cl0.status]);
 const ap=db.J[0];
 const v0=await P.traiterVoix(db,cfg,{clientRequestId:ap.id,isActive:"1"},"faux",NOW),v1=await P.traiterVoix(db,cfg,{clientRequestId:ap.id,isActive:"1"},cfg.voixSecret,NOW-3*60000);
 chk("AP-7","rappel vocal : secret obligatoire (403) ; avec secret, le client est composé depuis le numéro de l'entreprise, sans enregistrement",v0.status===403&&!v0.xml&&v1.status===200&&/<Dial phoneNumbers="\+2250707123456" callerId="\+2250100000000" record="false"/.test(v1.xml)&&db.J[0].statut==="relie",[v0,v1.xml]);
 const v2=await P.traiterVoix(db,cfg,{clientRequestId:"inconnu",isActive:"1"},cfg.voixSecret,NOW),vc=await P.traiterVoix(db,cfg,{clientRequestId:db.J[0].id,isActive:"0",durationInSeconds:"42"},cfg.voixSecret,NOW);
 db.T[0].clos=true;const v3=await P.traiterVoix(db,cfg,{clientRequestId:db.J[0].id,isActive:"1"},cfg.voixSecret,NOW);
 chk("AP-8","rappel vocal : appel inconnu ou ticket clos = refus sans composer ; fin d'appel enregistre la durée",/<Reject\/>/.test(v2.xml)&&!/Dial/.test(v2.xml)&&/<Reject\/>/.test(v3.xml)&&vc.status===200&&db.J[0].duree_s===42,[v2.xml,v3.xml,db.J[0]]);
 const op2=async()=>({ok:false,status:500,json:async()=>({})});const db2=mem();await P.traiterTicket(db2,cfg,{commande:"C",livreur_id:"l",cle:CLE,livreur_tel:"0505050505",client_tel:"0707123456"},cfg.adminKey,NOW);const f=await P.traiterAppel(db2,cfg,{commande:"C",livreur_id:"l",cle:CLE},op2,NOW);
 chk("AP-9","opérateur en panne : erreur claire (502), échec journalisé, aucun numéro dans la réponse",f.status===502&&db2.J[0].statut==="echec"&&!JSON.stringify(f).includes("0707"),[f,db2.J]);
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");process.exit(ko?1:0);
})();
