/* CRM central synchronisé : deux postes (deux navigateurs) partagent un serveur simulé qui exécute la VRAIE logique serveur (supabase/functions/_shared/sync.js).
   Usage : NODE_OPTIONS="--require $PWD/tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/crm-sync.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path"),mem=require("./sync-memoire.js");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 const SYNC=await import("../supabase/functions/_shared/sync.js");
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const db=mem(),cfg={syncKey:"SYNC-KEY-DE-TEST-0123456789abcdef"};let appels=0;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});let ok=0,ko=0;const errs=[];
 const chk=(id,l,o,info)=>{console.log(o?"PASS":"FAIL",id,l,o?"":info||"");o?ok++:ko++};
 const DEMO="Demo@Angels2026";
 const poste=async(nom,cle)=>{const ctx=await b.newContext({viewport:{width:1200,height:900}});
  await ctx.addInitScript(({cle})=>{localStorage.setItem("angels_demo","1");if(cle)localStorage.setItem("angels_sync",JSON.stringify({actif:true,cle}))},{cle});
  await ctx.route("**/functions/v1/sync",async rt=>{appels++;const rq=rt.request(),body=JSON.parse(rq.postData()||"{}");const r=await SYNC.traiterSync(db,cfg,body,rq.headers()["x-sync-key"],Date.now());rt.fulfill({status:r.status,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(r.body)})});
  const p=await ctx.newPage();p.on("pageerror",e=>errs.push(nom+": "+e.message));p.on("dialog",d=>d.accept());return{ctx,p}};
 const att=async(p,f,ms=9000)=>{const t=Date.now();while(Date.now()-t<ms){if(await p.evaluate(f).catch(()=>false))return true;await p.waitForTimeout(150)}return false};
 const cyc=async p=>{await p.evaluate(async()=>{await ANGELS_SYNC.cycle();await ANGELS_SYNC.cycle()})};
 // initialisation des applications (comptes de démonstration) : une première fois sur le poste A seulement
 const A=await poste("A",null);for(const u of["distribution.html","agro.html"]){await A.p.goto(base+"/"+u);await A.p.waitForTimeout(700)}
 await A.p.goto(base+"/crm.html");await A.p.waitForTimeout(500);
 chk("CRS-0","sans clé de synchronisation : aucun appel réseau du CRM",appels===0&&!(await A.p.evaluate(()=>ANGELS_SYNC.actif())));
 await A.ctx.close();
 // poste A avec la clé : crée des données CRM
 const A1=await poste("A",cfg.syncKey);await A1.p.goto(base+"/distribution.html");await A1.p.waitForTimeout(500);await A1.p.goto(base+"/crm.html");await A1.p.waitForTimeout(600);
 const ids=await A1.p.evaluate(()=>{const L=ANGELS_CRM.contacts();return L.filter(f=>f.achats.length).slice(0,2).map(f=>f.cle)});
 await A1.p.evaluate(([a,b])=>{ANGELS_CRM.ajouterInteraction("A",a,"appel","Appel du poste A : veut 3 cartons");ANGELS_CRM.ajouterTache("A",a,"Livrer 3 cartons","2026-12-01");ANGELS_CRM.etiqueter("A",a,"grossiste, Yopougon");ANGELS_CRM.opposer("A",b,true);ANGELS_CRM.creerOpp("A",{nom:"Supérette Test",valeur:90000})},ids);
 await A1.p.waitForTimeout(2200);await cyc(A1.p);
 const srvN=n=>[...db.D.rows.values()].filter(r=>r.app==="crm"&&r.coll===n&&!r.supprime).length;
 chk("CRS-1","poste A : échange, tâche, opportunité et marques arrivent sur le serveur, sous l'application « crm » seulement",srvN("inter")===1&&srvN("taches")===1&&srvN("opps")===1&&srvN("marques")===2&&[...db.D.rows.values()].every(r=>["crm"].includes(r.app)),JSON.stringify([srvN("inter"),srvN("taches"),srvN("opps"),srvN("marques")]));
 // poste B (autre navigateur, mêmes applications locales)
 const B=await poste("B",cfg.syncKey);await B.p.goto(base+"/distribution.html");await B.p.waitForTimeout(500);await B.p.goto(base+"/crm.html");
 await att(B.p,()=>ANGELS_SYNC.etat().etat==="ok",12000);
 const vuB=await B.p.evaluate(a=>{const E=ANGELS_CRM.etat();return{inter:E.inter.length,taches:E.taches.length,opps:E.opps.length,tags:(E.marques.find(m=>m.id===a)||{}).tags}},ids[0]);
 chk("CRS-2","poste B neuf : récupère les échanges, tâches, opportunités et étiquettes du poste A",vuB.inter===1&&vuB.taches===1&&vuB.opps===1&&(vuB.tags||[]).join()==="grossiste,Yopougon",JSON.stringify(vuB));
 const oppB=await B.p.evaluate(b=>ANGELS_CRM.contacts().find(f=>f.cle===b).stop,ids[1]);
 chk("CRS-3","l'opposition à la prospection enregistrée sur A s'applique aussitôt sur B (exclusion des relances et de l'export marketing)",oppB===true,String(oppB));
 // deux postes modifient deux contacts DIFFÉRENTS : aucune perte
 await B.p.evaluate(b=>{ANGELS_CRM.etiqueter("B",b,"vip")},ids[1]);await A1.p.evaluate(a=>{ANGELS_CRM.ajouterTache("A",a,"Rappeler lundi","2026-12-07")},ids[0]);
 await A1.p.waitForTimeout(2200);await B.p.waitForTimeout(2200);await cyc(A1.p);await cyc(B.p);await cyc(A1.p);
 const fin=await Promise.all([A1.p,B.p].map(p=>p.evaluate(([a,b])=>{const E=ANGELS_CRM.etat();return{taches:E.taches.length,ta:(E.marques.find(m=>m.id===a)||{}).tags||[],tb:(E.marques.find(m=>m.id===b)||{}).tags||[],stop:!!(E.marques.find(m=>m.id===b)||{}).stop}},ids)));
 chk("CRS-4","deux postes modifient deux contacts différents : rien n'est perdu, les deux postes convergent",JSON.stringify(fin[0])===JSON.stringify(fin[1])&&fin[0].taches===2&&fin[0].tb.join()==="vip"&&fin[0].ta.join()==="grossiste,Yopougon"&&fin[0].stop,JSON.stringify(fin));
 // le journal d'audit se cumule
 const au=await B.p.evaluate(()=>ANGELS_CRM.etat().audit.map(a=>a.par));
 chk("CRS-5","journal d'audit : les actions des deux postes se cumulent",au.includes("A")&&au.includes("B"),au.join());
 // interface : un changement distant s'affiche sans rechargement
 await B.p.fill("#gate [name=pwd]",DEMO);await B.p.click("#gate button[type=submit]");await B.p.waitForTimeout(800);
 chk("CRS-6","poste B connecté : le CRM s'affiche avec les données synchronisées, sans erreur",/Contacts uniques/.test(await B.p.innerText("#app")),"");
 // pipeline : une opportunité déplacée sur A change d'étape sur B ; deux déplacements simultanés convergent sans doublon
 const oid=await A1.p.evaluate(()=>ANGELS_CRM.etat().opps[0].id);
 await A1.p.evaluate(i=>{ANGELS_CRM.deplacerOpp("A",i,"contact")},oid);await A1.p.waitForTimeout(2200);await cyc(A1.p);await cyc(B.p);
 const etB=await B.p.evaluate(i=>(ANGELS_CRM.etat().opps.find(o=>o.id===i)||{}).etape,oid);
 chk("CRS-8","pipeline : opportunité avancée sur A → même étape sur B",etB==="contact",String(etB));
 await A1.p.evaluate(i=>{ANGELS_CRM.deplacerOpp("A",i,"devis")},oid);await B.p.evaluate(i=>{ANGELS_CRM.deplacerOpp("B",i,"negoc")},oid);
 await A1.p.waitForTimeout(2200);await B.p.waitForTimeout(2200);await cyc(A1.p);await cyc(B.p);await cyc(A1.p);await cyc(B.p);
 const cv=await Promise.all([A1.p,B.p].map(p=>p.evaluate(i=>{const O=ANGELS_CRM.etat().opps;return{e:(O.find(o=>o.id===i)||{}).etape,n:O.filter(o=>o.id===i).length,prio:ANGELS_CRM.prioritesOpps(Date.now()).length}},oid)));
 chk("CRS-9","pipeline : déplacements simultanés sur A et B → même étape finale, aucun doublon, priorités calculées",cv[0].e===cv[1].e&&["devis","negoc"].includes(cv[0].e)&&cv[0].n===1&&cv[1].n===1&&cv[0].prio===1&&cv[1].prio===1,JSON.stringify(cv));
 // migration de l'ancien format local
 const mig=await B.ctx.newPage();await mig.goto(base+"/crm.html");const m=await mig.evaluate(()=>{localStorage.setItem("angels_crm_v1",JSON.stringify({v:1,inter:[],taches:[],opps:[],audit:[],cfg:{},tags:{t0505111111:["ancien"]},stop:{t0505111111:"2026-01-01T00:00:00Z"},relances:{}}));return null});
 await mig.reload();const mg=await mig.evaluate(()=>{const E=ANGELS_CRM.etat();return{m:E.marques,vieux:!!(E.tags||E.stop||E.relances)}});
 chk("CRS-7","ancien format (tags / opposition par contact) converti en enregistrements « marques »",mg.m.length===1&&mg.m[0].tags[0]==="ancien"&&!!mg.m[0].stop&&!mg.vieux,JSON.stringify(mg));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
