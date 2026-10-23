/* Moteur de suppression en cascade et de correction des données de test (cascade-engine.js) — logique pure. Usage : node tests/cascade-engine.js */
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
const {moteur}=require("../cascade-engine.js");
const mk=()=>({test:{},clients:[{id:"c1",nom:"A"},{id:"c2",nom:"B"}],cmds:[{id:"o1",client_id:"c1",num:"N1",lignes:[{p:"p1"}]},{id:"o2",client_id:"c1",num:"N2",lignes:[]},{id:"o3",client_id:"c2",num:"N3",lignes:[{p:"p1"}]}],
 pay:[{id:"y1",cmd:"o1",m:100},{id:"y2",cmd:"o2",m:50}],prods:[{id:"p1",nom:"Produit",stock:5}],cash:[{id:"k1",source_id:"y1"}],deep:{liste:[{id:"d1",client_id:"c1"}]},motos:[{id:"m1",ids:null}],ctr:[{id:"t1",moto_ids:["m1","m2"]}]});
const M=()=>moteur({types:{client:{col:"clients",nom:c=>c.nom},cmd:{col:"cmds",nom:o=>o.num},pay:{col:"pay",nom:y=>"P"+y.m},prod:{col:"prods",nom:p=>p.nom},cash:{col:"cash"},deep:{col:"deep.liste"},moto:{col:"motos"},ctr:{col:"ctr"}},
 relations:[{parent:"client",child:"cmd",fk:"client_id"},{parent:"cmd",child:"pay",fk:"cmd"},{parent:"client",child:"deep",fk:"client_id"},{parent:"prod",child:"cmd",bloque:true,raison:"commande citant le produit",match:(o,p)=>o.lignes.some(l=>l.p===p.id)},
  {parent:"*",child:"cash",match:(k,p,n)=>k.source_id===n.id},{parent:"moto",child:"ctr",fkTab:true,fk:"moto_ids",bloque:true,raison:"contrat"}],
 estTest:(S,t,o)=>!!S.test[o.id],marquer:(S,t,o)=>{S.test[o.id]=1},demarquer:(S,t,o)=>{delete S.test[o.id]}});
const all=S=>["c1","c2","o1","o2","o3","y1","y2","p1","k1","d1","m1","t1"].forEach(i=>S.test[i]=1);
(()=>{const S=mk(),m=M();const d=m.dependances(S,"client","c1");
 chk("CE-1","dépendances d'un client : commandes, paiements des commandes, caisse (relation joker) et collection imbriquée ; sans doublon, parents d'abord",d.enfants.map(n=>n.id).sort().join()==="d1,k1,o1,o2,y1,y2"&&d.racine.id==="c1",JSON.stringify(d.enfants.map(n=>n.id)))})();
(()=>{const S=mk(),m=M();let a=m.analyser(S,"client","c1");const e1=a.ok===false&&a.reels.length===7;all(S);S.test.o2=0;delete S.test.o2;a=m.analyser(S,"client","c1");
 chk("CE-2","un enfant RÉEL (non marqué) bloque la suppression : il n'est jamais supprimé par ricochet ; tout marqué = supprimable",e1&&a.ok===false&&a.reels.length===1&&a.reels[0].id==="o2");S.test.o2=1;a=m.analyser(S,"client","c1");
 chk("CE-3","tout marqué Test et aucune référence : analyse OK avec décompte par type",a.ok&&a.par.cmd===2&&a.par.pay===2&&a.par.cash===1&&a.par.deep===1&&a.tous.length===7,JSON.stringify(a.par))})();
(()=>{const S=mk(),m=M();all(S);const a=m.analyser(S,"prod","p1");
 chk("CE-4","une simple référence (article cité dans des commandes) bloque sans rien supprimer ; supprimer d'abord les commandes la lève",!a.ok&&a.bloquants.map(n=>n.id).sort().join()==="o1,o3"&&a.enfants.length===0&&(()=>{const s=m.analyser(S,"client","c1"),n=m.retirer(S,s.tous);return m.analyser(S,"prod","p1").bloquants.map(x=>x.id).join()==="o3"})())})();
(()=>{const S=mk(),m=M();all(S);const a=m.analyser(S,"moto","m1");const b=m.analyser(S,"ctr","t1");
 chk("CE-5","relation sur tableau (contrat couvrant plusieurs engins) : bloque la suppression d'un engin ; le contrat seul se supprime",!a.ok&&a.bloquants[0].id==="t1"&&b.ok)})();
(()=>{const S=mk(),m=M();all(S);const avant=JSON.stringify(S),a=m.analyser(S,"client","c1"),snap=m.retirer(S,a.tous);
 const gone=S.clients.length===1&&S.cmds.length===1&&S.pay.length===0&&S.cash.length===0&&S.deep.liste.length===0&&!S.test.c1&&!S.test.y1&&S.test.c2===1;
 chk("CE-6","retrait : tout disparaît des collections (y compris imbriquées) et perd son marquage ; instantané complet",gone&&snap.items.length===7,JSON.stringify([S.clients.length,S.cmds.length,snap.items.length]));
 const n=m.restaurer(S,JSON.parse(JSON.stringify(snap)));const ids=a=>a.map(x=>x.id).sort().join();
 chk("CE-7","restauration : tout revient (positions et marquage Test), rien n'est dupliqué si on restaure deux fois",n===7&&ids(S.clients)==="c1,c2"&&ids(S.cmds)==="o1,o2,o3"&&S.cmds[0].id==="o1"&&S.test.c1===1&&S.test.y1===1&&m.restaurer(S,snap)===0&&JSON.stringify(Object.keys(S).sort())===JSON.stringify(Object.keys(JSON.parse(avant)).sort()))})();
(()=>{const S=mk(),m=M();const n=m.marquer(S,"client","c1");const e=Object.keys(S.test).sort().join()==="c1,d1,k1,o1,o2,y1,y2"&&n===7;const n2=m.marquer(S,"client","c1");
 chk("CE-8","marquer : la racine et toutes ses dépendances (réelles comprises) deviennent Test ; idempotent ; démarquer rétablit",e&&n2===0&&m.demarquer(S,"client","c1")&&!S.test.c1)})();
(()=>{const S=mk(),m=M();all(S);const F=m.champs(S,"cmd",S.cmds[0]);
 chk("CE-9","champs modifiables : simples uniquement (texte, nombre, booléen) ; id et objets exclus ; clé étrangère reconnue",F.map(f=>f.k).join()==="client_id,num"&&F.find(f=>f.k==="client_id").fk==="client");
 const ch=m.modifier(S,"cmd","o1",{num:"N1-bis",client_id:"c2"});let e1="";try{m.modifier(S,"cmd","o1",{client_id:"inconnu"})}catch(x){e1=x.message}
 delete S.test.o3;let e2="";try{m.modifier(S,"cmd","o3",{num:"x"})}catch(x){e2=x.message}
 chk("CE-10","correction : valeurs appliquées avec avant/après ; clé étrangère inexistante refusée ; donnée réelle refusée",ch.length===2&&S.cmds[0].num==="N1-bis"&&S.cmds[0].client_id==="c2"&&/n'existe pas/.test(e1)&&/réelle/.test(e2)&&S.cmds[0].client_id==="c2")})();
(()=>{const S=mk(),m=M();all(S);S.nb={a:1};const T=moteur({types:{client:{col:"clients"},z:{col:"a.b.c"}},relations:[],estTest:()=>true,marquer(){},demarquer(){}});
 chk("CE-11","collection absente ou chemin inexistant : ignoré sans erreur ; restauration recrée le chemin imbriqué",T.col({},"z").length===0&&(()=>{const o={};T.restaurer(o,{v:1,items:[{t:"z",i:0,o:{id:"q"},test:false}]});return o.a.b.c[0].id==="q"})())})();
console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");process.exit(ko?1:0);
