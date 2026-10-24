/* Vider le serveur depuis le logiciel (Distributions, Transport, Agro) : sauvegarde obligatoire, aperçu, code de sécurité, phrase, journal — de bout en bout avec la vraie logique serveur (reset.js) et une base simulée.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/vider-serveur.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const R=await import("../supabase/functions/_shared/reset.js");
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const SYNC="K".repeat(32);let cfg={syncKey:SYNC,resetCode:"CodeSecret2026"},donnees,journal,reqs;
 const neuf=()=>{donnees={pg_missions:7,sync_enreg:2443,pd_demandes:3};journal=[];reqs=[]};
 const db={reset:async(ex,par)=>{const c=Object.assign({},donnees);if(ex){Object.keys(donnees).forEach(k=>donnees[k]=0);journal.push({par,c})}return c}};
 const att=async()=>{};
 const monter=async ctx=>{await ctx.route("**/functions/v1/reset",async r=>{const body=JSON.parse(r.request().postData());reqs.push({body,cle:r.request().headers()["x-sync-key"]});const x=await R.traiterReset(db,cfg,body,r.request().headers()["x-sync-key"],att);r.fulfill({status:x.status,contentType:"application/json",body:JSON.stringify(x.body)})})};
 const ouvrir=async app=>{const ctx=await b.newContext({viewport:{width:1300,height:1000},acceptDownloads:true}),p=await ctx.newPage(),errs=[];await monter(ctx);p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/"+app+".html");await p.waitForTimeout(500);p.errs=errs;
  await p.evaluate(()=>{window.__D=[];window.alert=m=>__D.push(String(m));window.confirm=()=>true;if(typeof toast==="function")toast=(m,t)=>{__D.push((t||"")+":"+m)};ME=S.users.find(u=>u.role==="admin"&&u.actif);localStorage.setItem("angels_sync",JSON.stringify({actif:true,cle:"K".repeat(32)}));localStorage.setItem("angels_supabase",JSON.stringify({url:"https://projet.supabase.co"}))});return p};
 const att2=ms=>new Promise(r=>setTimeout(r,ms));

 /* ---- Distributions ---- */
 neuf();let p=await ouvrir("distribution");
 await p.evaluate(()=>{view="production";render()});
 chk("VS-1","Distributions : le bouton « Vider le serveur » est grisé tant que la sauvegarde n'est pas téléchargée ; l'action refuse aussi",await p.evaluate(async()=>{const h=document.body.innerHTML;__D.length=0;await ACT.prodSrvVider();return /data-act="prodSrvVider"[^>]*disabled/.test(h)&&__D.some(x=>/sauvegarde/.test(x))})&&reqs.length===0);
 await p.evaluate(()=>{ui.prodSauve=Date.now();render()});
 await p.evaluate(()=>ACT.prodSrvApercu());await att2(200);
 chk("VS-2","aperçu du serveur : nombres par table, rien n'est supprimé, la clé de synchronisation est envoyée (jamais d'autre secret)",await p.evaluate(()=>/sync_enreg : 2443/.test(document.getElementById("modal").innerHTML)&&/pg_missions : 7/.test(document.getElementById("modal").innerHTML))&&donnees.sync_enreg===2443&&reqs[0].cle===SYNC&&reqs[0].body.action==="apercu");
 cfg.resetCode="";await p.evaluate(()=>{ui.prodSauve=Date.now();__D.length=0;return ACT.prodSrvVider()});await att2(200);
 chk("VS-3","code de sécurité non configuré sur le serveur : message clair (créer le secret RESET_CODE), rien n'est supprimé",(await p.evaluate(()=>__D.some(x=>/RESET_CODE/.test(x))))&&donnees.sync_enreg===2443);
 cfg.resetCode="CodeSecret2026";
 const vider=(code,phrase)=>p.evaluate(async([c,ph])=>{await ACT.prodSrvVider();const f=document.getElementById("mf");f.code.value=c;f.phrase.value=ph;__D.length=0;f.requestSubmit();await new Promise(r=>setTimeout(r,500));return __D.join("|")},[code,phrase]);
 let m=await vider("mauvais","VIDER LE SERVEUR");
 chk("VS-4","mauvais code de sécurité : « Serveur NON vidé », données intactes",/NON vidé/.test(m)&&/incorrect/.test(m)&&donnees.sync_enreg===2443,m);
 m=await vider("CodeSecret2026","vider");
 chk("VS-5","mauvaise phrase de confirmation : « Serveur NON vidé », données intactes",/NON vidé/.test(m)&&donnees.sync_enreg===2443,m);
 m=await vider("CodeSecret2026","VIDER LE SERVEUR");
 chk("VS-6","bon code et bonne phrase : serveur vidé (2 453 enregistrements), journal côté serveur avec l'auteur, trace d'audit dans le logiciel",donnees.sync_enreg===0&&donnees.pg_missions===0&&journal.length===1&&!!journal[0].par&&reqs[reqs.length-1].body.sauvegarde===true&&await p.evaluate(()=>S.audit.some(a=>a.action==="Serveur vidé")),m);
 chk("VS-7","le code de sécurité n'est jamais conservé dans le logiciel (ni stockage local, ni état)",await p.evaluate(()=>!JSON.stringify(S).includes("CodeSecret2026")&&!JSON.stringify(Object.assign({},localStorage)).includes("CodeSecret2026")));

 /* ---- Transport et Agro (formulaire commun) ---- */
 for(const app of ["transport","agro"]){neuf();p=await ouvrir(app);const vue=app==="transport"?"audit":"params",tab=app==="transport"?"aud":"par";
  await p.evaluate(([v,t])=>{view=v;UI.tab[t]="prod";render()},[vue,tab]);
  chk("VS-8."+app,app+" : onglet « Passage en production » avec le bouton « Vider le serveur » grisé sans sauvegarde ; refus de l'action",await p.evaluate(async()=>{const h=document.body.innerHTML;__D.length=0;await A["prod.srvvider"]();return /data-a="prod.srvvider"[^>]*disabled/.test(h)&&__D.some(x=>/sauvegarde/.test(x))}));
  await p.evaluate(()=>{UI.prodSauve=Date.now()});
  await p.evaluate(()=>{__D.length=0;return A["prod.srvapercu"]()});await att2(200);
  chk("VS-9."+app,app+" : aperçu du serveur affiché",(await p.evaluate(()=>__D.join("|"))).includes("sync_enreg : 2443"));
  const v2=(code,phrase)=>p.evaluate(async([c,ph])=>{await A["prod.srvvider"]();await new Promise(r=>setTimeout(r,300));const f=document.querySelector(".md form");f.elements.code.value=c;f.elements.phrase.value=ph;__D.length=0;f.requestSubmit();await new Promise(r=>setTimeout(r,600));return __D.join("|")},[code,phrase]);
  m=await v2("mauvais","VIDER LE SERVEUR");
  chk("VS-10."+app,app+" : mauvais code → « Serveur NON vidé », données intactes",/NON vidé/.test(m)&&donnees.sync_enreg===2443,m);
  m=await v2("CodeSecret2026","VIDER LE SERVEUR");
  chk("VS-11."+app,app+" : bon code et bonne phrase → serveur vidé, journalisé, trace d'audit",donnees.sync_enreg===0&&journal.length===1&&/Serveur vidé/.test(m)&&await p.evaluate(()=>S.audit.some(a=>a.a==="Serveur vidé")),m)}
 for(const q of []);
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
