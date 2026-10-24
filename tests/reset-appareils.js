/* Serveur remis à zéro pendant que d'autres appareils sont hors ligne : à leur prochaine synchronisation, ils proposent de se vider (copie de sécurité conservée) ou renvoient leurs données.
   Deux postes + un serveur simulé qui exécute la VRAIE logique serveur (sync.js). Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/reset-appareils.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path"),mem=require("./sync-memoire.js");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 const SYNC=await import("../supabase/functions/_shared/sync.js");
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const db=mem(),cfg={syncKey:"SYNC-KEY-DE-TEST-0123456789abcdef"};
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});let ok=0,ko=0;const errs=[];
 const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
 let reponse="ok";const dialogues=[];
 const poste=async nom=>{const ctx=await b.newContext({viewport:{width:1200,height:900}});
  await ctx.addInitScript(cle=>{localStorage.setItem("angels_demo","1");localStorage.setItem("angels_sync",JSON.stringify({actif:true,cle}))},cfg.syncKey);
  await ctx.route("**/functions/v1/sync",async rt=>{const rq=rt.request(),body=JSON.parse(rq.postData()||"{}");const r=await SYNC.traiterSync(db,cfg,body,rq.headers()["x-sync-key"],Date.now());rt.fulfill({status:r.status,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(r.body)})});
  const p=await ctx.newPage();p.on("pageerror",e=>errs.push(nom+": "+e.message));p.on("dialog",d=>{dialogues.push(nom+"|"+d.message().slice(0,60));if(/SERVEUR REMIS/.test(d.message())&&reponse==="annuler")d.dismiss();else d.accept()});return{ctx,p}};
 const cyc=async p=>{await p.evaluate(async()=>{await ANGELS_SYNC.cycle();await ANGELS_SYNC.cycle()})};
 const etat=p=>p.evaluate(()=>({cmd:S.commandes.length,liv:S.livraisons.length,cl:S.clients.length,pr:S.produits.length,users:S.users.length,gen:ANGELS_SYNC.etat().base.gen,prod:!!(S.config.production),snap:!!localStorage.getItem("angels_avant_reset_distribution"),audit:S.audit.length}));
 /* serveur remis à zéro (même effet que la fonction « reset » : toutes les lignes supprimées, numéro de génération +1) */
 const razServeur=()=>{db.D.rows.clear();db.D.gen=(db.D.gen||0)+1};

 const A=await poste("A");await A.p.goto(base+"/distribution.html");await A.p.waitForTimeout(1500);await cyc(A.p);
 const B=await poste("B");await B.p.goto(base+"/distribution.html");await B.p.waitForTimeout(1500);await cyc(B.p);
 const a0=await etat(A.p),b0=await etat(B.p);
 chk("RA-1","deux postes synchronisés sur un serveur peuplé (génération 0) : activité (commandes) partagée",a0.cmd>0&&b0.cmd>=a0.cmd&&a0.gen===0&&b0.gen===0&&db.D.rows.size>100,JSON.stringify([a0,b0,db.D.rows.size]));
 chk("RA-2","le serveur annonce son numéro de génération à chaque tirage",(await SYNC.traiterSync(db,cfg,{action:"tirer",app:"distribution",depuis:0},cfg.syncKey)).body.generation===0&&(await SYNC.traiterSync(db,cfg,{action:"etat"},cfg.syncKey)).body.generation===0&&(razServeur(),(await SYNC.traiterSync(db,cfg,{action:"etat"},cfg.syncKey)).body.generation===1));
 /* A : l'administrateur a vidé son poste PUIS le serveur : il adopte la génération sans se reproposer de se vider */
 await A.p.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");ui.prodSauve=1;ui.prodc=ANGELS_PROD.choixDefaut("distribution",false);prodExecuter()});
 await A.p.evaluate(async()=>{await ANGELS_SYNC.adopterReset()});dialogues.length=0;await cyc(A.p);
 const a1=await etat(A.p);
 chk("RA-3","l'appareil de l'administrateur (déjà vidé) adopte la nouvelle génération : aucune question, aucune suppression massive à confirmer, base conservée renvoyée au serveur",a1.gen===1&&a1.cmd===0&&!dialogues.some(d=>/SERVEUR REMIS|SUPPRESSION MASSIVE/.test(d))&&db.D.rows.size>20,JSON.stringify([a1,dialogues,db.D.rows.size]));
 /* B : hors ligne pendant la remise à zéro ; à sa prochaine synchronisation il propose de se vider */
 dialogues.length=0;reponse="ok";await cyc(B.p);const b1=await etat(B.p);
 chk("RA-4","l'autre appareil (resté chargé) détecte la remise à zéro du serveur : question posée, OK → activité vidée, fichiers de base et comptes conservés, copie de sécurité conservée, trace dans l'audit",dialogues.some(d=>/B\|SERVEUR REMIS/.test(d))&&b1.cmd===0&&b1.liv===0&&b1.cl>0&&b1.pr>0&&b1.users===b0.users&&b1.snap&&b1.gen===1&&b1.prod,JSON.stringify([b1,b0,dialogues]));
 const snap=await B.p.evaluate(()=>{const s=JSON.parse(localStorage.getItem("angels_avant_reset_distribution"));return {n:s.donnees.commandes.length,gen:s.generation}});
 chk("RA-5","la copie de sécurité contient toutes les données d'avant (commandes comprises)",snap.n===b0.cmd&&snap.gen===1,JSON.stringify(snap));
 dialogues.length=0;await cyc(B.p);
 chk("RA-6","la question n'est posée qu'une seule fois par remise à zéro",!dialogues.some(d=>/SERVEUR REMIS/.test(d)));
 /* C : refuse → garde ses données et les renvoie */
 const C=await poste("C");await C.p.goto(base+"/distribution.html");await C.p.waitForTimeout(1200);await cyc(C.p);
 chk("RA-7","un appareil qui rejoint après la remise à zéro n'a aucune question (il récupère l'état du serveur)",!dialogues.some(d=>/C\|SERVEUR REMIS/.test(d))&&(await etat(C.p)).gen===1);
 const D=await poste("D");await D.p.goto(base+"/distribution.html");await D.p.waitForTimeout(1500);
 await D.p.evaluate(async()=>{await ANGELS_SYNC.cycle()});const d0=await etat(D.p);
 razServeur();reponse="annuler";dialogues.length=0;await cyc(D.p);const d1=await etat(D.p);
 chk("RA-8","refus (Annuler) : le poste garde ses données telles quelles, sans copie de sécurité inutile, et les renvoie au serveur ; aucune perte",dialogues.some(d=>/D\|SERVEUR REMIS/.test(d))&&d1.cmd===d0.cmd&&!d1.snap&&d1.gen===2&&db.D.rows.size>50,JSON.stringify([d0,d1,db.D.rows.size]));
 const e=errs.filter(x=>!/ResizeObserver/.test(x));chk("RA-9","aucune erreur de script",e.length===0,e.slice(0,2).join("|"));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
