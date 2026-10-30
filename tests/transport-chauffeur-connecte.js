/* Application chauffeur connectée au serveur « chauffeur » (simulé avec la vraie logique serveur et une base en mémoire) :
   connexion, isolation des données, file d'envoi hors ligne, revalidation serveur, aucun accès à la synchronisation partagée. */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":u.endsWith(".html")?"text/html; charset=utf-8":u.endsWith(".js")?"application/javascript":u.endsWith(".webmanifest")?"application/manifest+json":"application/octet-stream"});fs.createReadStream(f).pipe(r)});
const pwd=m=>{const s=crypto.randomBytes(16),h=crypto.pbkdf2Sync(m,s,150000,32,"sha256");return{v:2,it:150000,s:s.toString("base64"),h:h.toString("base64")}};
(async()=>{
 const C=await import("../supabase/functions/_shared/chauffeur.js"),mem=require("./chauffeur-memoire.js"),db=mem(),cfg={cle:"K".repeat(32)};
 const put=(coll,o,id)=>db.ecrire([{app:"transport",coll,id:id||o.id,data:o,rev:1,supprime:false,par:"poste"}]);
 await put("users",{id:"u1",nom:"Kouassi",role:"chauffeur",actif:true,driver_id:"d1",pwd:pwd("Chauffeur@Test2026")});await put("users",{id:"u2",nom:"Traoré",role:"chauffeur",actif:true,driver_id:"d2",pwd:pwd("Autre@Mdp2026x")});await put("users",{id:"ua",nom:"KESSIE",role:"admin",actif:true,pwd:pwd("Admin@Secret2026")});
 await put("drivers",{id:"d1",nom:"Kouassi Yao",actif:true,tiers_id:"t1"});await put("drivers",{id:"d2",nom:"Traoré Ali",actif:true});await put("tiers",{id:"t1",type:"chauffeur",nom:"Kouassi",aux:"41110001"});
 await put("vehicles",{id:"v1",immat:"1 AA 01",statut:"actif",marque:"Toyota",modele:"Corolla"});await put("assignments",{id:"a1",driver_id:"d1",vehicle_id:"v1",debut:"2026-01-01",fin:null});await put("assignments",{id:"a2",driver_id:"d2",vehicle_id:"v9",debut:"2026-01-01",fin:null});
 await put("contracts",{id:"c1",driver_id:"d1",vehicle_id:"v1",mode:"recette",montant:15000,periodicite:"jour",debut:"2026-10-30",fin:null,statut:"actif",versions:[{from:"2026-10-30",montant:15000}]});
 await put("obligations",{id:"o1",driver_id:"d1",contract_id:"c1",vehicle_id:"v1",date_ech:"2026-10-30",montant:15000,num:1,jour:"prevue"});await put("obligations",{id:"o9",driver_id:"d2",date_ech:"2026-10-30",montant:77777,num:2});
 await put("lignes",{id:"lg1",nom:"Gare Adjamé — Siporex",commune:"Adjamé",commune_arrivee:"Yopougon",tarif:400,places:4,actif:true});
 await put("_doc",{v:{org_nom:"ANGEL'S",mdp_min:10}},"settings");
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const ctx=await b.newContext({viewport:{width:390,height:800},serviceWorkers:"block",permissions:["geolocation"],geolocation:{latitude:5.3364,longitude:-4.0267,accuracy:20}});
 const appels=[],autres=[];let hors=false;
 await ctx.route(u=>/\/functions\/v1\//.test(u.pathname),async route=>{const rq=route.request(),u=new URL(rq.url()),CORS={"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"POST, OPTIONS"};
  if(!/\/functions\/v1\/chauffeur$/.test(u.pathname)){autres.push(u.pathname);return route.fulfill({status:403,headers:CORS,body:"{}"})}
  if(rq.method()==="OPTIONS")return route.fulfill({status:204,headers:CORS});
  if(hors)return route.abort("internetdisconnected");
  const body=JSON.parse(rq.postData()||"{}");appels.push(body.action);const r=await C.traiterChauffeur(db,cfg,body);route.fulfill({status:r.status,headers:{...CORS,"content-type":"application/json"},body:JSON.stringify(r.body)})});
 const p=await ctx.newPage(),E=[];p.on("pageerror",e=>E.push(e.message));p.on("dialog",d=>d.accept());
 await p.addInitScript(()=>{try{if(!localStorage.getItem("angels_transport_v3"))localStorage.setItem("angels_transport_v3",JSON.stringify({sentinelle:"ADMIN-INTACT"}))}catch(e){}});
 let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 await p.goto(base+"/transport.html?app=chauffeur");await p.waitForTimeout(1200);
 const l0=await p.evaluate(()=>({opts:[...document.querySelectorAll("#lf select[name=u] option")].map(o=>o.textContent),hero:document.body.innerText.includes("Votre espace chauffeur")}));
 chk("CC-1","écran de connexion : la liste vient du serveur (chauffeurs uniquement)",l0.hero&&l0.opts.length===2&&l0.opts.every(x=>/Chauffeur/.test(x))&&!l0.opts.some(x=>/KESSIE/.test(x)),JSON.stringify(l0));
 await p.fill('#lf input[name=p]',"mauvais");await p.press("#lf input[name=p]","Enter");await p.waitForTimeout(700);
 chk("CC-2","mauvais mot de passe : message du serveur, pas de session",await p.evaluate(()=>!ME&&document.getElementById("le").textContent.includes("incorrect")));
 await p.selectOption("#lf select[name=u]","u1");await p.fill('#lf input[name=p]',"Chauffeur@Test2026");await p.press("#lf input[name=p]","Enter");await p.waitForTimeout(1200);
 const a1=await p.evaluate(()=>({me:ME&&ME.role,txt:document.body.innerText,nd:S.drivers.length,nu:S.users.length,solde:S.__solde,pwd:JSON.stringify(S).includes("pwd"),ob:S.obligations.map(o=>o.id),jeton:!!localStorage.getItem("tr_ch_jeton")}));
 chk("CC-3","connexion : accueil chauffeur avec solde (15 000 F), véhicule, partage de position",a1.me==="chauffeur"&&a1.solde===15000&&a1.txt.includes("1 AA 01")&&a1.txt.includes("Partage de ma position")&&a1.jeton,JSON.stringify(a1).slice(0,300));
 chk("CC-4","isolation : l'appareil ne contient que ce chauffeur (1 fiche, 1 compte, ses échéances, aucune empreinte)",a1.nd===1&&a1.nu===1&&a1.ob.join()==="o1"&&a1.pwd===false,JSON.stringify([a1.nd,a1.nu,a1.ob,a1.pwd]));
 const adm=await p.evaluate(()=>localStorage.getItem("angels_transport_v3"));
 chk("CC-5","la base du bureau dans le même navigateur est intacte ; aucune synchronisation partagée appelée",adm.includes("ADMIN-INTACT")&&autres.length===0&&!appels.includes("sync"),JSON.stringify([adm.slice(0,60),autres]));
 /* course en ligne puis hors ligne */
 await p.evaluate(()=>{declarerCourse({zone:"Gare Adjamé — Siporex",passagers:3,montant:"",t:""})});await p.waitForTimeout(1000);
 const c1=await db.liste("transport","courses",{contient:{driver_id:"d1"}});
 chk("CC-6","course de ligne : calculée sur l'appareil (3 × 400) et enregistrée par le serveur",c1.length===1&&c1[0].montant===1200&&c1[0].mode==="ligne"&&c1[0].passagers===3,JSON.stringify(c1));
 hors=true;await p.evaluate(()=>{declarerCourse({zone:"Plateau",passagers:"",montant:2500,t:""})});await p.waitForTimeout(800);
 const f1=await p.evaluate(()=>({file:CH.file.length,loc:S.courses.some(c=>c.zone==="Plateau"&&c.montant===2500)}));const s1=(await db.liste("transport","courses",{contient:{driver_id:"d1"}})).length;
 chk("CC-7","hors ligne : la course reste à l'écran et dans la file d'envoi, pas encore sur le serveur",f1.file===1&&f1.loc&&s1===1,JSON.stringify([f1,s1]));
 hors=false;await p.evaluate(()=>window.dispatchEvent(new Event("online")));await p.waitForTimeout(1500);
 const s2=await db.liste("transport","courses",{contient:{driver_id:"d1"}}),f2=await p.evaluate(()=>CH.file.length);
 chk("CC-8","retour du réseau : la file est envoyée (2 courses sur le serveur, file vide), sans doublon",s2.length===2&&f2===0&&new Set(s2.map(c=>c.id)).size===2,JSON.stringify([s2.length,f2]));
 /* refus serveur */
 await p.evaluate(()=>chPousser("course",{zone:"Mars",montant:5000}));await p.waitForTimeout(1000);
 const f3=await p.evaluate(()=>({file:CH.file.length,t:[...document.querySelectorAll("[role=status]")].map(x=>x.textContent).join("|")}));
 chk("CC-9","saisie refusée par le serveur : retirée de la file et signalée au chauffeur",f3.file===0&&/Refusé par le serveur/.test(f3.t),JSON.stringify(f3));
 /* déclaration de recette + demande */
 await p.evaluate(()=>{declarerRecette({date:today(),montant:15000,mode:"especes",ref:"",note:"RAS"});creerDemande({type:"autre",texte:"Bonjour"})});await p.waitForTimeout(1200);
 const dcl=await db.liste("transport","declarations",{contient:{driver_id:"d1"}}),rq=await db.liste("transport","requests",{contient:{driver_id:"d1"}});
 chk("CC-10","déclaration de recette et demande : enregistrées par le serveur pour ce chauffeur, numéro attribué",dcl.length===1&&/^DR-/.test(dcl[0].numero)&&rq.length===1&&rq[0].driver_id==="d1",JSON.stringify([dcl.length,dcl[0]&&dcl[0].numero,rq.length]));
 /* position */
 await p.evaluate(()=>A["pos.tg"]());await p.waitForTimeout(1500);
 const pos=(await db.lire("transport",[{coll:"pos_chauf",id:"pc_d1"}]))[0];
 chk("CC-11","partage de position : écrite côté serveur pour ce chauffeur (véhicule inclus) ; arrêt = suppression",!!pos&&pos.data.driver_id==="d1"&&pos.data.vehicle_id==="v1"&&Math.abs(pos.data.lat-5.3364)<1e-3);
 await p.evaluate(()=>A["pos.tg"]());await p.waitForTimeout(1000);chk("CC-11b","arrêt du partage : position supprimée du serveur",(await db.lire("transport",[{coll:"pos_chauf",id:"pc_d1"}]))[0].supprime===true);
 /* redémarrage : session restaurée sans reconnexion ni aucun appel de synchronisation */
 await p.reload();await p.waitForTimeout(1500);
 const r1=await p.evaluate(()=>({me:ME&&ME.role,txt:document.body.innerText.includes("Partage de ma position")}));
 chk("CC-12","redémarrage : session restaurée (jeton) sans ressaisir le mot de passe",r1.me==="chauffeur"&&r1.txt,JSON.stringify(r1));
 /* jeton révoqué par le bureau */
 const u1=(await db.lire("transport",[{coll:"users",id:"u1"}]))[0];await db.ecrire([{app:"transport",coll:"users",id:"u1",data:Object.assign({},u1.data,{actif:false}),rev:u1.rev+1,supprime:false,par:"bureau"}]);
 await p.evaluate(()=>chRafraichir());await p.waitForTimeout(2200);
 const r2=await p.evaluate(()=>({jeton:localStorage.getItem("tr_ch_jeton"),stock:localStorage.getItem("angels_transport_chauffeur")}));
 chk("CC-13","compte désactivé par le bureau : l'appareil est déconnecté et ses données locales effacées",r2.jeton===null,JSON.stringify(r2).slice(0,200));
 const adm2=await p.evaluate(()=>localStorage.getItem("angels_transport_v3"));
 chk("CC-14","jamais de contact avec la base du bureau ; aucune erreur de script",adm2.includes("ADMIN-INTACT")&&autres.length===0&&!E.length,JSON.stringify([autres,E[0]]));
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await b.close();srv.close();process.exit(ko?1:0)})();
