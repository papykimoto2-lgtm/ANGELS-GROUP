/* Synchronisation entre postes : logique serveur testée avec une base en mémoire (voir supabase/functions/_shared/sync.js).
   Usage : node tests/sync-serveur.js */
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
(async()=>{
 const S=await import("../supabase/functions/_shared/sync.js"),mem=require("./sync-memoire.js");
 const db=mem(),cfg={syncKey:"K".repeat(32)},K=cfg.syncKey,NOW=Date.now();
 const T=(req,k=K)=>S.traiterSync(db,cfg,req,k,NOW),pousser=(ops,app="distribution",par="Awa")=>T({action:"pousser",app,ops,par});
 const r0=await T({action:"etat"},"mauvaise"),r00=await S.traiterSync(db,{},{action:"etat"},"x",NOW),r000=await T({action:"tirer",app:"inconnue"});
 chk("SYN-1","clé de synchronisation obligatoire (absente, fausse) ; application inconnue refusée",r0.status===401&&r00.status===401&&r000.status===400,JSON.stringify([r0.status,r00.status,r000.status]));
 const p1=await pousser([{coll:"clients",id:"c1",kind:"enreg",base:0,data:{id:"c1",nom:"Mariam"}},{coll:"clients",id:"c2",kind:"enreg",base:0,data:{id:"c2",nom:"Yao"}},{coll:"config",id:"config",kind:"doc",base:0,data:{v:{org:"X"}}}]);
 chk("SYN-2","création de nouveaux enregistrements et d'un réglage : révision 1 pour chacun",p1.body.appliques.length===3&&p1.body.appliques.every(a=>a.rev===1)&&!p1.body.rejets.length,JSON.stringify(p1.body));
 const t1=await T({action:"tirer",app:"distribution",depuis:0});
 chk("SYN-3","un autre poste tire tout depuis le curseur 0, puis plus rien depuis le nouveau curseur ; les applications sont cloisonnées",t1.body.lignes.length===3&&t1.body.curseur===3&&(await T({action:"tirer",app:"distribution",depuis:t1.body.curseur})).body.lignes.length===0&&(await T({action:"tirer",app:"transport",depuis:0})).body.lignes.length===0,JSON.stringify(t1.body).slice(0,200));
 const p2=await pousser([{coll:"clients",id:"c1",kind:"enreg",base:1,data:{id:"c1",nom:"Mariam K."}}]);
 chk("SYN-4","modification avec la bonne révision acceptée (révision 2)",p2.body.appliques[0].rev===2&&!p2.body.rejets.length,JSON.stringify(p2.body));
 const p3=await pousser([{coll:"clients",id:"c1",kind:"enreg",base:1,data:{id:"c1",nom:"Mariam Z."}}],"distribution","Koffi");
 const lu=(await db.lire("distribution",[{coll:"clients",id:"c1"}]))[0];
 chk("SYN-5","modification simultanée : la deuxième est REFUSÉE, la version du serveur (et son auteur) est renvoyée, rien n'est écrasé",p3.body.rejets.length===1&&p3.body.rejets[0].serveur.data.nom==="Mariam K."&&p3.body.rejets[0].serveur.par==="Awa"&&lu.data.nom==="Mariam K."&&lu.rev===2,JSON.stringify(p3.body));
 const p4=await pousser([{coll:"clients",id:"c2",kind:"enreg",base:1,del:true}]),p5=await pousser([{coll:"clients",id:"c2",kind:"enreg",base:1,data:{id:"c2",nom:"Yao 2"}}]),t2=await T({action:"tirer",app:"distribution",depuis:3});
 chk("SYN-6","suppression = marqueur transmis aux autres postes ; modifier un enregistrement supprimé ailleurs est refusé",p4.body.appliques[0].rev===2&&p5.body.rejets.length===1&&p5.body.rejets[0].serveur.supprime&&t2.body.lignes.some(l=>l.id==="c2"&&l.supprime&&l.data===null),JSON.stringify([p4.body,p5.body]));
 const s1=await pousser([{coll:"seq",id:"seq",kind:"seq",base:0,data:{cmd:5,doc:{fac:2}}}]),s2=await pousser([{coll:"seq",id:"seq",kind:"seq",base:0,data:{cmd:3,inc:4,doc:{fac:7,rec:1}}}],"distribution","Koffi");
 const sq=(await db.lire("distribution",[{coll:"seq",id:"seq"}]))[0].data;
 chk("SYN-7","compteurs : jamais refusés, le plus grand de chaque numéro est conservé (même imbriqué)",!s2.body.rejets.length&&sq.cmd===5&&sq.inc===4&&sq.doc.fac===7&&sq.doc.rec===1,JSON.stringify(sq));
 const a1=await pousser([{coll:"audit",id:"h1",kind:"ajout",base:0,data:{ts:1,action:"x"}}]),a2=await pousser([{coll:"audit",id:"h1",kind:"ajout",base:0,data:{ts:1,action:"x"}},{coll:"audit",id:"h1",kind:"ajout",base:0,del:true}],"distribution","Koffi");
 chk("SYN-8","journal d'audit : ajout unique, doublon ignoré, suppression impossible",a1.body.appliques.length===1&&a2.body.appliques.length===1&&(await db.lire("distribution",[{coll:"audit",id:"h1"}]))[0].supprime===false,JSON.stringify(a2.body));
 const gros=await pousser([{coll:"clients",id:"gros",kind:"enreg",base:0,data:{id:"gros",photo:"x".repeat(S.TAILLE_MAX+10)}}]);
 chk("SYN-9","enregistrement trop volumineux : refusé et signalé, sans bloquer les autres",gros.body.trop.length===1&&!gros.body.appliques.length,JSON.stringify(gros.body).slice(0,200));
 const idem=await pousser([{coll:"clients",id:"c1",kind:"enreg",base:2,data:{id:"c1",nom:"Mariam K."}}]);
 chk("SYN-10","renvoi d'une modification déjà enregistrée : accepté sans nouvelle révision (pas de boucle)",idem.body.appliques[0].rev===2&&(await db.lire("distribution",[{coll:"clients",id:"c1"}]))[0].rev===2,JSON.stringify(idem.body));
 for(let i=0;i<7;i++)await pousser([{coll:"produits",id:"p"+i,kind:"enreg",base:0,data:{id:"p"+i}}]);
 const pg=await T({action:"tirer",app:"distribution",depuis:0,limite:5});
 chk("SYN-11","lecture par pages : « suite » indique qu'il en reste, le curseur permet de continuer",pg.body.lignes.length===5&&pg.body.suite===true&&(await T({action:"tirer",app:"distribution",depuis:pg.body.curseur,limite:500})).body.suite===false,JSON.stringify([pg.body.lignes.length,pg.body.suite]));
 const et=await T({action:"etat"});
 chk("SYN-12","état : nombre d'enregistrements vivants par application (suppressions exclues)",et.body.enregistrements.distribution>=8&&et.body.enregistrements.transport===0&&et.body.enregistrements.agro===0,JSON.stringify(et.body));
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");process.exit(ko?1:0);
})();
