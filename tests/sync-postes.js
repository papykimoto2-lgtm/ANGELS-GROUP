/* Synchronisation entre postes : deux postes (deux navigateurs indépendants) partagent un serveur simulé qui exécute la VRAIE logique serveur (supabase/functions/_shared/sync.js).
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/sync-postes.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path"),mem=require("./sync-memoire.js");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 const SYNC=await import("../supabase/functions/_shared/sync.js");
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const db=mem(),cfg={syncKey:"SYNC-KEY-DE-TEST-0123456789abcdef"};let appels=0,hors=false;const vus=[];
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});let ok=0,ko=0;const errs=[];
 const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
 const poste=async(nom,demo,cle)=>{const ctx=await b.newContext({viewport:{width:1200,height:900}});
  await ctx.addInitScript(({demo,cle})=>{if(demo)localStorage.setItem("angels_demo","1");else localStorage.removeItem("angels_demo");if(cle)localStorage.setItem("angels_sync",JSON.stringify({actif:true,cle}))},{demo,cle});
  await ctx.route("**/functions/v1/sync",async rt=>{appels++;if(hors)return rt.abort();const rq=rt.request(),body=JSON.parse(rq.postData()||"{}");vus.push(body);
   const r=await SYNC.traiterSync(db,cfg,body,rq.headers()["x-sync-key"],Date.now());rt.fulfill({status:r.status,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(r.body)})});
  const p=await ctx.newPage();p.on("pageerror",e=>errs.push(nom+": "+e.message));p.on("dialog",d=>d.accept());return{ctx,p}};
 const att=async(p,f,ms=8000)=>{const t=Date.now();while(Date.now()-t<ms){if(await p.evaluate(f).catch(()=>false))return true;await p.waitForTimeout(150)}return false};
 const cyc=async p=>{await p.evaluate(async()=>{await ANGELS_SYNC.cycle();await ANGELS_SYNC.cycle()})};

 /* 0. désactivée par défaut : aucun appel réseau */
 const A0=await poste("A0",true,null);await A0.p.goto(base+"/distribution.html");await A0.p.waitForTimeout(1800);
 chk("SYP-0","par défaut (aucune clé) : synchronisation inactive, aucun appel réseau, pas d'indicateur",appels===0&&!(await A0.p.evaluate(()=>!!document.getElementById("aa-sync")))&&!(await A0.p.evaluate(()=>ANGELS_SYNC.actif())));
 await A0.ctx.close();

 /* 1. poste A (données de démonstration) envoie tout ; poste B vide récupère */
 const A=await poste("A",true,cfg.syncKey);await A.p.goto(base+"/distribution.html");
 const premier=await att(A.p,()=>ANGELS_SYNC.etat().etat==="ok",12000);
 const nbA=await A.p.evaluate(()=>({cmd:S.commandes.length,cli:S.clients.length,users:S.users.length}));
 const nbS=[...db.D.rows.values()].filter(r=>r.app==="distribution"&&r.coll==="commandes"&&!r.supprime).length;
 chk("SYP-1","poste A : première synchronisation, toutes les commandes sont envoyées au serveur ; l'indicateur « Synchronisé » s'affiche",premier&&nbA.cmd>0&&nbS===nbA.cmd&&/Synchronisé/.test(await A.p.innerText("#aa-sync")),JSON.stringify({premier,nbA,nbS}));
 const B=await poste("B",false,cfg.syncKey);await B.p.goto(base+"/distribution.html");
 await att(B.p,()=>ANGELS_SYNC.etat().etat==="ok",12000);
 const nbB=await B.p.evaluate(()=>({cmd:S.commandes.length,cli:S.clients.length,users:S.users.map(u=>u.nom)}));
 chk("SYP-2","poste B (neuf, base vide) : récupère toutes les données du poste A (commandes, clients, comptes) sans rien perdre ; son compte KESSIE est ajouté à la base commune",nbB.cmd===nbA.cmd&&nbB.cli===nbA.cli&&nbB.users.length===nbA.users+1&&nbB.users.includes("KESSIE")&&nbB.users.includes("Administrateur"),JSON.stringify({nbA,nbB}));
 /* 2. saisie sur A visible sur B */
 const idC=await A.p.evaluate(()=>{const c={id:uid("c"),nom:"Cliente Synchro",tel:"",adresses:[],cree_le:now()};S.clients.push(c);save();return c.id});
 await att(A.p,()=>!ANGELS_SYNC.etat().base||Object.keys(ANGELS_SYNC.etat().base.map).length>0,4000);await A.p.waitForTimeout(2200);await cyc(B.p);
 const vuB=await att(B.p,id=>S.clients.some(c=>c.nom==="Cliente Synchro"),6000).catch(()=>false)||await B.p.evaluate(()=>S.clients.some(c=>c.nom==="Cliente Synchro"));
 chk("SYP-3","un client créé sur le poste A apparaît sur le poste B après synchronisation",vuB,"");
 /* 3. modification sur B, retour sur A ; suppression */
 await B.p.evaluate(id=>{S.clients.find(c=>c.nom==="Cliente Synchro").nom="Cliente Synchro (modifiée par B)";save()},idC);await B.p.waitForTimeout(2200);await cyc(A.p);
 const modA=await A.p.evaluate(()=>S.clients.some(c=>c.nom==="Cliente Synchro (modifiée par B)"));
 await A.p.evaluate(()=>{S.clients.splice(S.clients.findIndex(c=>c.nom.startsWith("Cliente Synchro")),1);save()});await A.p.waitForTimeout(2200);await cyc(B.p);
 const supB=await B.p.evaluate(()=>!S.clients.some(c=>c.nom.startsWith("Cliente Synchro")));
 chk("SYP-4","modification faite sur B visible sur A ; suppression faite sur A répercutée sur B",modA&&supB,JSON.stringify({modA,supB}));
 /* 4. modification simultanée : la première enregistrée gagne, l'autre est prévenue */
 const cid=await A.p.evaluate(()=>S.clients[0].id);
 await A.p.evaluate(id=>{S.clients.find(c=>c.id===id).nom="Version de A";save()},cid);await B.p.evaluate(id=>{S.clients.find(c=>c.id===id).nom="Version de B";save()},cid);
 await A.p.waitForTimeout(1900);await cyc(A.p);await cyc(B.p);await cyc(A.p);
 const fin=await Promise.all([A.p,B.p].map(p=>p.evaluate(id=>S.clients.find(c=>c.id===id).nom,cid)));
 const avert=await B.p.evaluate(()=>[...document.querySelectorAll("#toast .t,.t")].map(e=>e.textContent).join("|")+document.body.innerText.slice(0,0));
 chk("SYP-5","modification simultanée du même client : la première enregistrée est conservée sur les DEUX postes (aucun écrasement silencieux)",fin[0]===fin[1]&&/Version de [AB]/.test(fin[0]),JSON.stringify(fin));
 chk("SYP-6","le poste dont la modification est refusée est prévenu (message « Modification simultanée »)",/Modification simultanée/.test(avert)||/Modification simultanée/.test(await A.p.evaluate(()=>document.body.innerText))||/Modification simultanée/.test(await B.p.evaluate(()=>document.body.innerText)),avert);
 /* 5. numérotation : compteurs fusionnés par le plus grand */
 await A.p.evaluate(()=>{S.seq.cmd=900;save()});await B.p.evaluate(()=>{S.seq.cmd=950;save()});await A.p.waitForTimeout(1900);await cyc(A.p);await cyc(B.p);await cyc(A.p);
 const sq=await Promise.all([A.p,B.p].map(p=>p.evaluate(()=>S.seq.cmd)));
 chk("SYP-7","compteurs de numérotation : les deux postes gardent le plus grand (950), jamais de retour en arrière",sq[0]===950&&sq[1]===950,JSON.stringify(sq));
 /* 6. secrets et données locales non envoyées */
 await A.p.evaluate(()=>{S.config.appel_pont={actif:true,url:"https://x.supabase.co/functions/v1",cle_admin:"CLE-ADMIN-SECRETE-123"};S.pos={lvx:{lat:1,lng:2}};S.tries={u1:{n:3}};save()});await A.p.waitForTimeout(1900);await cyc(A.p);await cyc(B.p);
 const brut=JSON.stringify([...db.D.rows.values()]);
 const cleB=await B.p.evaluate(()=>(S.config.appel_pont||{}).cle_admin);
 chk("SYP-8","la clé d'administration n'est JAMAIS envoyée au serveur ; positions GPS et compteurs de tentatives restent locaux ; le reste du réglage est partagé",!brut.includes("CLE-ADMIN-SECRETE")&&!brut.includes('"lvx"')&&!brut.includes('"u1"')&&cleB===undefined&&await B.p.evaluate(()=>S.config.appel_pont&&S.config.appel_pont.url==="https://x.supabase.co/functions/v1"),JSON.stringify({cleB}));
 /* 7. hors ligne puis retour */
 hors=true;await A.p.evaluate(()=>{S.clients.push({id:"c_hors",nom:"Saisie hors ligne",tel:"",adresses:[],cree_le:now()});save()});await A.p.waitForTimeout(2300);
 const etatH=await A.p.evaluate(()=>({e:ANGELS_SYNC.etat().etat,t:document.getElementById("aa-sync").textContent,local:S.clients.some(c=>c.id==="c_hors")}));
 hors=false;await cyc(A.p);await cyc(B.p);
 const retour=await B.p.evaluate(()=>S.clients.some(c=>c.id==="c_hors"));
 chk("SYP-9","réseau coupé : la saisie reste enregistrée localement, l'indicateur le dit ; au retour du réseau elle part et arrive sur l'autre poste",etatH.local&&/erreur|hors ligne/.test(etatH.e)&&/Non synchronisé|Hors ligne/.test(etatH.t)&&retour,JSON.stringify({etatH,retour}));
 /* 8. suppression massive : confirmation, refus = restauration */
 await B.p.evaluate(()=>{window.__dlg=[];});await B.p.close();const B2=await B.ctx.newPage();B2.on("pageerror",e=>errs.push("B2: "+e.message));let dlgMsg="";B2.on("dialog",d=>{if(/SUPPRESSION|MISE EN PROD/.test(d.message())||true){if(/SUPPRESSION/.test(d.message()))dlgMsg=d.message();d.dismiss()}});
 await B2.goto(base+"/distribution.html");await att(B2,()=>ANGELS_SYNC.etat().etat==="ok",12000);
 const avant=await B2.evaluate(()=>S.commandes.length);await B2.evaluate(()=>{Object.keys(S).forEach(k=>{if(k!=="users"&&Array.isArray(S[k])&&S[k].length&&S[k].every(e=>e&&typeof e.id==="string"))S[k].splice(0,S[k].length)});save()});
 await B2.waitForTimeout(2300);await cyc(B2).catch(()=>{});await B2.waitForTimeout(800);
 const apres=await B2.evaluate(()=>S.commandes.length),srvCmd=[...db.D.rows.values()].filter(r=>r.app==="distribution"&&r.coll==="commandes"&&!r.supprime).length;
 chk("SYP-10","suppression massive sur un poste : confirmation demandée ; en cas de refus, rien n'est supprimé sur le serveur et le poste retrouve ses données",/SUPPRESSION MASSIVE/.test(dlgMsg)&&srvCmd===avant&&apres===avant,JSON.stringify({dlgMsg:dlgMsg.slice(0,40),avant,apres,srvCmd}));
 await A.ctx.close();await B.ctx.close();

 /* 9. mêmes comptes sur plusieurs postes : KESSIE créé séparément sur deux postes de production = un seul compte */
 const db2=db;[...db2.D.rows.keys()].forEach(k=>db2.D.rows.delete(k));
 const P1=await poste("P1",false,cfg.syncKey);await P1.p.goto(base+"/transport.html");await att(P1.p,()=>ANGELS_SYNC.etat().etat==="ok",12000);
 await P1.p.evaluate(()=>{S.vehicles.push({id:"v_prod1",immat:"1234 AB 01",marque:"Toyota"});save()});await P1.p.waitForTimeout(2300);await cyc(P1.p);
 const P2=await poste("P2",false,cfg.syncKey);
 await P2.ctx.addInitScript(()=>{});await P2.p.goto(base+"/transport.html");await att(P2.p,()=>ANGELS_SYNC.etat().etat==="ok",12000);await P2.p.waitForTimeout(800);
 const u2=await P2.p.evaluate(()=>({users:S.users.map(u=>[u.id,u.nom]),veh:S.vehicles.map(v=>v.immat)}));
 const u1=await P1.p.evaluate(()=>S.users.map(u=>[u.id,u.nom]));
 chk("SYP-11","production (Transport) : deux postes neufs, un seul compte KESSIE partagé (même identifiant), les véhicules du premier poste arrivent sur le second",u2.users.length===1&&u2.users[0][1]==="KESSIE"&&u1.length===1&&u1[0][0]===u2.users[0][0]&&u2.veh.includes("1234 AB 01"),JSON.stringify({u1,u2}));
 /* 10. Agro : même mécanique */
 const G1=await poste("G1",true,cfg.syncKey);await G1.p.goto(base+"/agro.html");await att(G1.p,()=>ANGELS_SYNC.etat().etat==="ok",15000);
 const G2=await poste("G2",false,cfg.syncKey);await G2.p.goto(base+"/agro.html");await att(G2.p,()=>ANGELS_SYNC.etat().etat==="ok",15000);
 const ag=await Promise.all([G1.p,G2.p].map(p=>p.evaluate(()=>({lots:S.lots.length,mv:S.mvts.length,cl:S.clients.length,acc:S.accounts.length}))));
 chk("SYP-12","Agro : un second poste récupère lots, mouvements de stock, clients et plan comptable du premier",ag[0].lots>0&&JSON.stringify(ag[0])===JSON.stringify(ag[1]),JSON.stringify(ag));
 await P1.ctx.close();await P2.ctx.close();await G1.ctx.close();await G2.ctx.close();
 await b.close();srv.close();console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs"+(errs.length?" ; erreurs page : "+errs.slice(0,5).join(" | "):""));process.exit(ko||errs.length?1:0);
})();
