/* Système livreurs, lot 1 (argent et preuves) : un encaissement refusé n'est jamais perdu, le « direct » déclaré est à rapprocher, un événement en erreur ne bloque pas la relève,
   la file hors ligne garde les actions sur erreur serveur, les actions portent un identifiant (rejeu sans doublon) et gardent leur ordre.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/livreurs-lot1.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info===undefined?o:info));o===true?ok++:ko++};
(async()=>{
 await new Promise(o=>srv.listen(0,"127.0.0.1",o));const base="http://127.0.0.1:"+srv.address().port;
 const br=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const errs=[];
 const H={"access-control-allow-origin":"*","access-control-allow-headers":"*"};
 const J=(rt,b,st)=>rt.fulfill({status:st||200,contentType:"application/json",headers:H,body:JSON.stringify(b)});
 /* ===== bureau ===== */
 const ctx=await br.newContext({viewport:{width:1300,height:1000}});const acks=[];let evts=[],preuveKo=false;
 await ctx.route("**/functions/v1/mission-sync",async rt=>{const rq=rt.request();if(rq.method()==="OPTIONS")return rt.fulfill({status:204,headers:H});const b=JSON.parse(rq.postData()||"{}");
  if(b.action==="evenements")return J(rt,{ok:true,evenements:evts});if(b.action==="acquitter"){acks.push(...b.ids);return J(rt,{ok:true,acquittes:b.ids.length})}
  if(b.action==="preuve"){if(preuveKo)return J(rt,{ok:false,erreur:"Erreur serveur"},500);return J(rt,{ok:true,preuve:null})}
  return J(rt,{ok:true,ecrites:0,ignorees:0,retirees:0,ignores:0,livreurs_inconnus:[]})});
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/distribution.html");await p.waitForTimeout(600);
 await p.evaluate(()=>{window.__T=[];toast=m=>{__T.push(m)};ME=S.users.find(u=>u.role==="admin"&&u.actif);S.config.appel_pont={url:"https://x.supabase.co/functions/v1",cle_admin:"k"};S.config.passerelle_actif=true;S.config.signature_seuil=99999999;
  const lv=S.livreurs.find(l=>!l.archive);lv.user_id=lv.user_id||S.users.find(u=>u.role==="livreur")?.id||"u_test";window.__lv=lv});
 /* RL-1 encaissement refusé */
 evts=[{id:901,type:"confirmer",livraison_ref:"inconnue",livreur_ref:await p.evaluate(()=>__lv.id),cree_le:new Date().toISOString(),donnees:{montant:15000,mode:"Espèces",recu_par:"X"}}];
 await p.evaluate(()=>passSync(true));await p.waitForTimeout(500);
 let r=await p.evaluate(()=>({n:regulOuverts().length,m:(regulOuverts()[0]||{}).montant,t:(regulOuverts()[0]||{}).type,b:regulBandeau()}));
 chk("RL-1","encaissement de 15 000 F refusé par le bureau : il est acquitté MAIS enregistré « à régulariser » (jamais perdu), avec un bandeau visible",acks.includes(901)&&r.n===1&&r.m===15000&&r.t==="refuse"&&/à régulariser/.test(r.b)&&/15\s?000/.test(r.b),JSON.stringify([acks,r]));
 /* RL-2 traité */
 r=await p.evaluate(()=>{const id=regulOuverts()[0].id;regulTraite(id);return{n:regulOuverts().length,b:regulBandeau()}});
 chk("RL-2","« Traité » ferme l'entrée et le bandeau disparaît",r.n===0&&r.b==="",JSON.stringify(r));
 /* RL-3 un événement en erreur ne bloque pas les autres */
 acks.length=0;preuveKo=true;const lid=await p.evaluate(()=>__lv.id);
 evts=[{id:911,type:"confirmer",livraison_ref:"x1",livreur_ref:lid,cree_le:new Date().toISOString(),donnees:{montant:5000,preuve:true,mode:"Espèces",recu_par:"X"}},{id:912,type:"position",livraison_ref:"x2",livreur_ref:lid,cree_le:new Date().toISOString(),donnees:{lat:5.3,lng:-4}}];
 await p.evaluate(()=>passSync(true));await p.waitForTimeout(500);preuveKo=false;
 r=await p.evaluate(()=>({n:regulOuverts().length}));
 chk("RL-3","un événement qui plante (preuve introuvable) ne bloque plus la relève : les deux événements sont traités et acquittés, l'encaissement est signalé",acks.includes(911)&&acks.includes(912)&&r.n===1,JSON.stringify([acks,r]));
 /* RL-4 direct déclaré */
 r=await p.evaluate(()=>{S.regul_enc=[];const c0=S.commandes.find(c=>c.statut==="prete")||S.commandes[0],c=JSON.parse(JSON.stringify(c0));c.id="lv1c";c.numero="CMD-L1";c.statut="prete";c.colis=null;c.date=new Date(Date.now()-864e5).toISOString();c.hist=[{ts:new Date().toISOString(),de:"preparation",a:"prete",par:"t",note:""}];S.commandes.push(c);
  const lv=__lv;CEN_DIRECT=true;let l;try{l=affecter(c,lv.id,"");accepter(l);priseEnCharge(l,1);demarrer(l)}finally{CEN_DIRECT=false}
  const e=passAppliquer({id:921,type:"confirmer",livraison_ref:l.id,livreur_ref:lv.id,donnees:{montant:soldeCmd(c),mode:"Orange Money",ref_paiement:"MP20261026A1",direct:true,recu_par:"Mme X",code_etat:"absent",ecart_note:""}});
  return{e,n:regulOuverts().length,t:(regulOuverts()[0]||{}).type,ref:(regulOuverts()[0]||{}).ref,st:c.statut}});
 chk("RL-5","paiement Mobile Money « direct » déclaré par le livreur : accepté mais inscrit « à rapprocher du relevé » avec sa référence",r.e===""&&r.n===1&&r.t==="mm"&&r.ref==="MP20261026A1",JSON.stringify(r));
 /* ===== application livreur ===== */
 const ctx2=await br.newContext({viewport:{width:420,height:900}});const q=await ctx2.newPage();q.on("pageerror",e=>errs.push(e.message));const sent=[];let mode="ok";
 const MISSION={livraison_ref:"l1",livreur_ref:"lv1",commande_ref:"CMD-0001",statut:"en_cours",maj_le:new Date().toISOString(),position:null,payload:{numero:"CMD-0001",client_nom:"Mme Konan",adr:{zone:"Cocody",quartier:"Angré",repere:"",instructions:"",gps:null},lignes:[{desig:"Robe",qte:1,pu:8500}],obs:"",montant_attendu:8500,collecte_at:new Date().toISOString(),nb_colis:1}};
 await q.addInitScript(()=>{window.__missions=null;const sess=()=>({access_token:"JWT-TEST",user:{id:"u1",user_metadata:{chg:false}}});
  const sb={auth:{getSession:async()=>({data:{session:sess()}}),signOut:async()=>{}},from:()=>({select:()=>({order:async()=>({data:window.__missions,error:null}),maybeSingle:async()=>({data:{livreur_ref:"lv1",nom:"Koffi Yao"},error:null})})})};
  window.supabase={createClient:()=>sb}});
 await q.route("**/functions/v1/mission-action",async rt=>{if(rt.request().method()==="OPTIONS")return rt.fulfill({status:204,headers:H});const b=JSON.parse(rt.request().postData()||"{}");sent.push(b);
  if(mode==="503")return J(rt,{ok:false,erreur:"Erreur serveur"},503);if(mode==="400")return J(rt,{ok:false,erreur:"Photo obligatoire"},400);return J(rt,{ok:true,statut:"x"})});
 await q.goto(base+"/livreur.html");await q.waitForTimeout(500);
 await q.evaluate(m=>{window.__missions=[m]},MISSION);await q.evaluate(async()=>{await charger()});await q.waitForTimeout(200);
 /* RL-6 5xx : l'action reste dans la file */
 mode="503";let s=await q.evaluate(async()=>{mettreEnFile("l1","confirmer",{montant:8500,mode:"Espèces",recu_par:"Mme Konan"},"cid-A");await vider();return{f:file().map(x=>x.id),r:rejets().length}});
 chk("RL-6","erreur serveur 503 : la confirmation avec son encaissement RESTE dans la file (aucun rejet, rien de perdu)",JSON.stringify(s.f)==='["cid-A"]'&&s.r===0&&sent.length>=1&&sent[0].cid==="cid-A",JSON.stringify([s,sent[0]]));
 /* RL-7 retour du serveur : renvoi avec le même identifiant */
 mode="ok";sent.length=0;s=await q.evaluate(async()=>{await vider();return{f:file().length,r:rejets().length}});
 chk("RL-7","serveur de retour : l'action repart avec son identifiant unique et la file se vide",s.f===0&&s.r===0&&sent.length===1&&sent[0].cid==="cid-A"&&sent[0].type==="confirmer",JSON.stringify([s,sent]));
 /* RL-8 vrai refus 4xx : retiré, mais le message rappelle l'encaissement */
 mode="400";s=await q.evaluate(async()=>{mettreEnFile("l1","confirmer",{montant:8500,mode:"Espèces",recu_par:"Mme Konan"},"cid-B");await vider();return{f:file().length,r:rejets().map(x=>x.msg)}});
 chk("RL-8","refus définitif (400) : l'action est retirée et le message rappelle « ENCAISSEMENT DE 8 500 F À RESAISIR OU À SIGNALER »",s.f===0&&s.r.length===1&&/ENCAISSEMENT DE 8\s?500 F/.test(s.r[0]),JSON.stringify(s));
 /* RL-9 ordre : action envoyée pendant que la file n'est pas vide */
 mode="ok";sent.length=0;s=await q.evaluate(async()=>{lsSet(LS.r,[]);mettreEnFile("l1","accepter",{},"cid-C");const j=await envoyer("l1","demarrer",{},"ok");await new Promise(r=>setTimeout(r,800));return{j,f:file().length}});
 chk("RL-9","une action faite pendant qu'une autre attend est mise à la suite : envoi dans l'ordre (accepter puis démarrer), jamais en avance",sent.length===2&&sent[0].type==="accepter"&&sent[1].type==="demarrer"&&s.f===0,JSON.stringify([s,sent.map(x=>x.type)]));
 /* RL-10 identifiant sur envoi direct */
 sent.length=0;await q.evaluate(async()=>{await envoyer("l1","arrive",{},"ok")});
 chk("RL-10","un envoi direct porte aussi un identifiant unique (cid) : un renvoi après réponse perdue n'est pas refusé",sent.length===1&&/^a[0-9a-z]+$/.test(sent[0].cid||""),JSON.stringify(sent[0]));
 /* RL-11 mémoire pleine */
 s=await q.evaluate(async()=>{const sv=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error("QuotaExceededError")};const ok0=mettreEnFile("l1","incident",{nature:"Autre"},"cid-Q");Storage.prototype.setItem=sv;return{ok0}});
 chk("RL-11","mémoire du téléphone pleine : l'application le DIT (l'action n'est pas faussement « gardée »)",s.ok0===false,JSON.stringify(s));
 /* ===== serveur : rejeu ===== */
 const P=await import("file://"+path.resolve(__dirname,"../supabase/functions/_shared/passerelle.js"));
 const evs=[],mis={statut:"en_cours",livreur_ref:"lv1",commande_ref:"C",payload:{montant_attendu:5000}};
 const db={compteParUtilisateur:async()=>({livreur_ref:"lv1",actif:true}),mission:async()=>mis,code:async()=>null,preuve:async()=>({}),colis:async()=>[],ecrirePreuve:async()=>{},majMission:async(ref,pt)=>{mis.statut=pt.statut},majCode:async()=>{},
  evenementParCid:async(ref,cid)=>evs.some(e=>e.donnees.cid===cid),ajouterEvenement:async e=>{evs.push(e)}};
 const conf={livraison_ref:"l1",type:"confirmer",cid:"cid-X",donnees:{montant:5000,recu_par:"Mme X",mode:"Espèces"}};
 const a1=await P.traiterAction(db,{},conf,"u1"),a2=await P.traiterAction(db,{},conf,"u1");
 chk("RL-12","serveur : la même action reçue deux fois (réponse perdue, double appui) n'enregistre qu'UN événement et la seconde reçoit « OK, déjà reçu » (pas de faux refus 409)",a1.status===200&&a2.status===200&&a2.body.rejeu===true&&evs.length===1,JSON.stringify([a1.status,a2.body,evs.length]));
 chk("RL-13","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await br.close();srv.close();process.exit(ko?1:0);
})();
