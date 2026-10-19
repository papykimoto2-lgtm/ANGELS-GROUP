/* Hub → Paramètres → Cloud : panneau « État de la synchronisation (envoi ↔ réception) » (vérifier l'état, file d'attente, tout envoyer / récupérer, écart, diagnostic, purge).
   Serveur simulé = vraie logique serveur (supabase/functions/_shared/sync.js).
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/sync-etat.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path"),mem=require("./sync-memoire.js");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 const SYNC=await import("../supabase/functions/_shared/sync.js");
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const db=mem(),cfg={syncKey:"SYNC-KEY-DE-TEST-0123456789abcdef"};
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});let ok=0,ko=0;const errs=[];
 const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
 const mk=async(demo)=>{const ctx=await b.newContext({viewport:{width:1300,height:1000}});
  await ctx.addInitScript(({demo,cle})=>{if(demo)localStorage.setItem("angels_demo","1");if(!localStorage.getItem("angels_sync"))localStorage.setItem("angels_sync",JSON.stringify({actif:true,cle}))},{demo,cle:cfg.syncKey});
  await ctx.route("**/functions/v1/sync",async rt=>{const rq=rt.request(),body=JSON.parse(rq.postData()||"{}");const r=await SYNC.traiterSync(db,cfg,body,rq.headers()["x-sync-key"],Date.now());rt.fulfill({status:r.status,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(r.body)})});return ctx};
 const att=async(p,f,ms=10000)=>{const t=Date.now();while(Date.now()-t<ms){if(await p.evaluate(f).catch(()=>false))return true;await p.waitForTimeout(150)}return false};
 const ctx=await mk(true),ctx2=await mk(false);
 const A=await ctx.newPage();A.on("pageerror",e=>errs.push("A: "+e.message));A.on("dialog",d=>d.accept());
 await A.goto(base+"/distribution.html");await att(A,()=>ANGELS_SYNC.etat().etat==="ok",15000);
 const T=await ctx.newPage();T.on("pageerror",e=>errs.push("T: "+e.message));T.on("dialog",d=>d.accept());await T.goto(base+"/transport.html");await att(T,()=>ANGELS_SYNC.etat().etat==="ok",15000);
 await A.close();await T.close();
 const H=await ctx.newPage();H.on("pageerror",e=>errs.push("Hub: "+e.message));H.on("dialog",d=>d.accept());
 await H.goto(base+"/parametres.html");await H.click('#ptabs [data-pt="cloud"]');
 const lire=async()=>H.evaluate(()=>({kpi:document.getElementById("ss-kpi").innerText,rows:[...document.querySelectorAll("#ss-tab tbody tr")].map(r=>[...r.children].map(c=>c.innerText.trim())),conn:document.getElementById("ss-conn").innerText,envoi:document.getElementById("ss-envoi").innerText,recep:document.getElementById("ss-recep").innerText,out:document.getElementById("ss-out").innerText}));
 await H.click('[data-ss="diag"]');await att(H,()=>document.querySelectorAll("#ss-tab tbody tr").length===3,10000);const e0=await lire();
 const nbSrv=n=>[...db.D.rows.values()].filter(r=>r.app===n&&!r.supprime).length;
 chk("SYE-1","« Vérifier l'état » : une ligne par application, tout à jour, nombre d'éléments = nombre sur le serveur, « Connecté au cloud », dates d'envoi et de réception renseignées",e0.rows.length===3&&e0.rows[0][2]===e0.rows[0][1]&&+e0.rows[0][5]===nbSrv("distribution")&&+e0.rows[1][5]===nbSrv("transport")&&/Connecté/.test(e0.conn)&&!/—$/.test(e0.envoi)&&/À jour/.test(e0.rows[0][6]),JSON.stringify(e0).slice(0,500));
 /* modification locale hors application (données de l'appareil) → à envoyer */
 await H.evaluate(()=>{const S=JSON.parse(localStorage.getItem("angels_erp_v1"));S.clients.push({id:"c_hub1",nom:"Client du test Hub",tel:"",adresses:[],cree_le:new Date().toISOString()});localStorage.setItem("angels_erp_v1",JSON.stringify(S))});
 await H.click('[data-ss="diag"]');await att(H,()=>/à envoyer/.test(document.getElementById("ss-kpi").innerText)&&/1<\/b> à envoyer/.test(document.getElementById("ss-kpi").innerHTML),8000);const e1=await lire();
 await H.selectOption("#ss-app","distribution");await H.click('[data-ss="file"]');await att(H,()=>/en attente/.test(document.getElementById("ss-out").innerText),8000);const f1=await lire();
 chk("SYE-2","un élément créé sur l'appareil apparaît « à envoyer » ; la file d'attente le liste (nature « nouveau », table, nom)",/1\s*à envoyer/.test(e1.kpi)&&/1 modification/.test(f1.out)&&/nouveau/.test(f1.out)&&/clients/.test(f1.out)&&/Client du test Hub/.test(f1.out),JSON.stringify([e1.kpi,f1.out]));
 /* écriture protégée */
 await H.click('[data-ss="send"]');await H.waitForTimeout(400);const v1=await lire();
 chk("SYE-3","« Tout envoyer » refusé tant qu'aucune application n'est déverrouillée par un administrateur",/Déverrouillez/.test(v1.out)&&!db.D.rows.has("distribution\u0000clients\u0000c_hub1"),JSON.stringify(v1.out));
 await H.evaluate(()=>{AUTH.test={exp:Date.now()+6e5}});await H.click('[data-ss="send"]');await att(H,()=>/terminé/.test(document.getElementById("ss-out").innerText),12000);const s1=await lire();
 chk("SYE-4","après déverrouillage, « Tout envoyer » (aucune application ouverte : exécuté sur les données de l'appareil) envoie l'élément au serveur ; plus rien à envoyer",db.D.rows.has("distribution\u0000clients\u0000c_hub1")&&/terminé/.test(s1.out)&&/0 à envoyer/.test(s1.out)&&/0\s*à envoyer/.test(s1.kpi),JSON.stringify([s1.out,s1.kpi]));
 /* un autre poste modifie : à récupérer puis tout récupérer */
 const P2=await ctx2.newPage();P2.on("pageerror",e=>errs.push("P2: "+e.message));P2.on("dialog",d=>d.accept());await P2.goto(base+"/distribution.html");await att(P2,()=>ANGELS_SYNC.etat().etat==="ok",15000);
 await P2.evaluate(()=>{S.clients.push({id:"c_p2",nom:"Client du poste 2",tel:"",adresses:[],cree_le:now()});save()});await P2.waitForTimeout(2300);await P2.evaluate(async()=>{await ANGELS_SYNC.cycle();await ANGELS_SYNC.cycle()});
 await H.click('[data-ss="diag"]');await att(H,()=>/1<\/b> à récupérer/.test(document.getElementById("ss-kpi").innerHTML),8000);const e2=await lire();
 await H.click('[data-ss="recv"]');await att(H,()=>/terminé/.test(document.getElementById("ss-out").innerText),12000);await H.waitForTimeout(600);
 const got=await H.evaluate(()=>JSON.parse(localStorage.getItem("angels_erp_v1")).clients.some(c=>c.id==="c_p2"));
 chk("SYE-5","une modification faite par un autre poste apparaît « à récupérer » ; « Tout récupérer » l'inscrit dans les données de l'appareil",/[1-9]\d*\s*à récupérer/.test(e2.kpi)&&got,JSON.stringify([e2.kpi,got]));
 /* écart */
 await H.evaluate(()=>{const S=JSON.parse(localStorage.getItem("angels_erp_v1"));S.clients.push({id:"c_seul",nom:"Seulement ici",tel:"",adresses:[],cree_le:new Date().toISOString()});S.clients.find(c=>c.id==="c_hub1").nom="Modifié localement";localStorage.setItem("angels_erp_v1",JSON.stringify(S))});
 await H.click('[data-ss="ecart"]');await att(H,()=>/écart/.test(document.getElementById("ss-out").innerText),10000);const ec=await lire();
 chk("SYE-6","« Écart cloud ↔ local » : par table, éléments seulement ici et éléments différents (2 écarts attendus sur les clients)",/2 écart/.test(ec.out)&&/clients/.test(ec.out),ec.out.slice(0,300));
 await H.click('[data-ss="cloud"]');await att(H,()=>/Réponse en/.test(document.getElementById("ss-out").innerText),8000);const cl=await lire();
 chk("SYE-7","« Diagnostic cloud » : adresse de la fonction, temps de réponse, nombre d'enregistrements par application",/functions\/v1\/sync/.test(cl.out)&&/Réponse en \d+ ms/.test(cl.out)&&/Distributions \d+/.test(cl.out),cl.out.slice(0,300));
 /* application ouverte : l'action est exécutée par l'application (état en mémoire) */
 const A2=await ctx.newPage();A2.on("pageerror",e=>errs.push("A2: "+e.message));A2.on("dialog",d=>d.accept());await A2.goto(base+"/distribution.html");await att(A2,()=>ANGELS_SYNC.etat().etat==="ok",15000);
 await A2.evaluate(()=>{S.clients.push({id:"c_memoire",nom:"En mémoire seulement",tel:"",adresses:[],cree_le:now()})});   // jamais enregistré dans le stockage
 await H.bringToFront();await H.click('[data-ss="send"]');await att(H,()=>/terminé/.test(document.getElementById("ss-out").innerText),15000);
 chk("SYE-8","application ouverte dans un autre onglet : « Tout envoyer » est exécuté PAR l'application (elle envoie même ce qui n'est qu'en mémoire)",db.D.rows.has("distribution\u0000clients\u0000c_memoire"),"");
 await A2.close();
 /* purge */
 await H.evaluate(()=>{window.__c=[];});await H.selectOption("#ss-app","distribution");await H.click('[data-ss="resync"]');await att(H,()=>/terminé/.test(document.getElementById("ss-out").innerText),15000);
 await H.click('[data-ss="purge"]');await H.waitForTimeout(1500);
 const pu=await H.evaluate(()=>({k:localStorage.getItem("angels_erp_v1"),b:localStorage.getItem("angels_sync_base_distribution"),out:document.getElementById("ss-out").innerText}));
 const A3=await ctx.newPage();A3.on("pageerror",e=>errs.push("A3: "+e.message));A3.on("dialog",d=>d.accept());await A3.goto(base+"/distribution.html");await att(A3,()=>ANGELS_SYNC.etat().etat==="ok",15000);
 const rest=await A3.evaluate(()=>({cl:S.clients.map(c=>c.id)}));
 chk("SYE-9","« Purger le cache local » (après resynchro) : données de l'appareil effacées, puis rechargées intégralement depuis le serveur à l'ouverture de l'application",pu.k===null&&pu.b===null&&/purgé/.test(pu.out)&&rest.cl.includes("c_hub1")&&rest.cl.includes("c_p2")&&rest.cl.includes("c_memoire"),JSON.stringify({pu:pu.out.slice(0,80),rest}));
 /* purge refusée si l'appareil n'est pas synchronisé */
 const ctx3=await b.newContext();await ctx3.addInitScript(({cle})=>{localStorage.setItem("angels_demo","1");localStorage.setItem("angels_sync",JSON.stringify({actif:true,cle}))},{cle:cfg.syncKey});await ctx3.route("**/functions/v1/sync",async rt=>{const rq=rt.request(),body=JSON.parse(rq.postData()||"{}");const r=await SYNC.traiterSync(db,cfg,body,rq.headers()["x-sync-key"],Date.now());rt.fulfill({status:r.status,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(r.body)})});
 const H3=await ctx3.newPage();H3.on("dialog",d=>d.accept());await H3.goto(base+"/parametres.html");await H3.click('#ptabs [data-pt="cloud"]');await H3.evaluate(()=>{AUTH.t={exp:Date.now()+6e5};localStorage.setItem("angels_erp_v1",JSON.stringify({v:1,users:[],clients:[{id:"x1"}]}))});await H3.click('[data-ss="purge"]');await H3.waitForTimeout(1500);
 const refus=await H3.evaluate(()=>({k:!!localStorage.getItem("angels_erp_v1"),out:document.getElementById("ss-out").innerText}));
 chk("SYE-10","purge refusée sur un appareil jamais synchronisé (les données ne pourraient pas être rechargées) : rien n'est effacé",refus.k&&/Purge impossible/.test(refus.out),JSON.stringify(refus));
 await b.close();srv.close();console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs"+(errs.length?" ; erreurs page : "+errs.slice(0,5).join(" | "):""));process.exit(ko||errs.length?1:0);
})();
