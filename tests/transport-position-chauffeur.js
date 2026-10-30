/* Application chauffeur : partage de position du téléphone, vue bureau, barre mobile. */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":u.endsWith(".html")?"text/html; charset=utf-8":u.endsWith(".js")?"application/javascript":"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
 const ctx=await b.newContext({viewport:{width:390,height:800},serviceWorkers:"block",permissions:["geolocation"],geolocation:{latitude:5.3364,longitude:-4.0267,accuracy:20}});
 const p=await ctx.newPage(),E=[];p.on("pageerror",e=>E.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/transport.html");await p.waitForTimeout(400);
 let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 await p.evaluate(()=>{S.drivers.push({id:"drv_p1",nom:"Kouassi Yao",actif:true},{id:"drv_p2",nom:"Traoré",actif:true});S.vehicles.push({id:"veh_p1",immat:"1234 AB 01",marque:"T",modele:"X",statut:"actif"});S.assignments.push({id:"as_p1",driver_id:"drv_p1",vehicle_id:"veh_p1",debut:"2026-01-01"});
  S.users.push({id:"u_p1",nom:"Kouassi",role:"chauffeur",actif:true,driver_id:"drv_p1"});ME=S.users.find(u=>u.id==="u_p1");view="p_accueil";render()});
 const o1=await p.evaluate(()=>({carte:document.body.innerText.includes("Partage de ma position"),btm:!!document.querySelector(".btm"),btmVisible:getComputedStyle(document.querySelector(".btm")).display!=="none",off:document.getElementById("posinfo").innerText.includes("désactivé")}));
 chk("PC-1","accueil chauffeur : carte de partage (désactivé) + barre mobile",o1.carte&&o1.btm&&o1.btmVisible&&o1.off,JSON.stringify(o1));
 await p.evaluate(()=>A["pos.tg"]());await p.waitForTimeout(800);
 const o2=await p.evaluate(()=>{const q=(S.pos_chauf||[])[0];return{n:(S.pos_chauf||[]).length,q:q&&[q.driver_id,q.vehicle_id,q.lat,q.lng,q.prec],on:posOn(meDriver()),txt:document.getElementById("posinfo").innerText,aud:S.audit.some(a=>/Partage de position activé/.test(a.action||a.a||JSON.stringify(a)))}});
 chk("PC-2","activation : position enregistrée (chauffeur, véhicule, lat/lng, précision) + audit",o2.n===1&&o2.q[0]==="drv_p1"&&o2.q[1]==="veh_p1"&&Math.abs(o2.q[2]-5.3364)<1e-4&&o2.on&&/Actif/.test(o2.txt)&&o2.aud,JSON.stringify(o2));
 /* déplacement > 30 m après 45 s : on force le délai */
 await p.evaluate(()=>{POS_ST.der=Date.now()-60000});await ctx.setGeolocation({latitude:5.3500,longitude:-4.0300,accuracy:15});await p.waitForTimeout(1500);
 const o3=await p.evaluate(()=>({lat:S.pos_chauf[0].lat,n:S.pos_chauf.length}));
 chk("PC-3","déplacement : position mise à jour (un seul enregistrement par chauffeur)",Math.abs(o3.lat-5.3500)<1e-4&&o3.n===1,JSON.stringify(o3));
 const o4=await p.evaluate(()=>{const e=n=>{try{enregistrerPosChauf(...n);return null}catch(x){return x.message}};return{a:e([95,0,0,0]),b:e([5,200,0,0]),c:e(["x",1,0,0])}});
 chk("PC-4","coordonnées invalides refusées",!!o4.a&&!!o4.b&&!!o4.c,JSON.stringify(o4));
 /* bureau */
 const o5=await p.evaluate(()=>{S.pos_chauf.push({id:"pc_drv_p2",driver_id:"drv_p2",vehicle_id:null,lat:5.31,lng:-4.01,vit:30,prec:10,t:new Date(Date.now()-40*6e4).toISOString()},{id:"pc_vieux",driver_id:"drv_p2",vehicle_id:null,lat:5.3,lng:-4,vit:0,prec:10,t:new Date(Date.now()-3*864e5).toISOString()});
  ME=S.users.find(u=>u.role==="admin"&&u.actif)||(S.users.push({id:"u_ad",nom:"adm",role:"admin",actif:true}),S.users[S.users.length-1]);view="gps";render();
  const L=posChaufListe();const t=document.body.innerText;return{n:L.length,etats:L.map(x=>x.e[0]).join(","),txt:t.includes("Chauffeurs (position du téléphone)")&&t.includes("Kouassi Yao")&&t.includes("Hors ligne")}});
 chk("PC-5","bureau : liste des chauffeurs (en ligne / hors ligne), positions de plus de 24 h exclues",o5.n===2&&o5.etats==="En ligne,Hors ligne"&&o5.txt,JSON.stringify(o5));
 /* circuits : la position du téléphone sert de position du chauffeur */
 const o6=await p.evaluate(()=>{const d=by(S.drivers,"drv_p1"),q=posChauffeur(d);return q&&Math.abs(q.lat-5.35)<1e-4});
 chk("PC-6","suggestions de circuit : position du téléphone utilisée",o6===true,o6);
 /* arrêt */
 await p.evaluate(()=>{ME=S.users.find(u=>u.id==="u_p1");view="p_accueil";render();A["pos.tg"]()});
 const o7=await p.evaluate(()=>({on:posOn(meDriver()),reste:(S.pos_chauf||[]).some(x=>x.driver_id==="drv_p1"),autre:(S.pos_chauf||[]).some(x=>x.driver_id==="drv_p2")}));
 chk("PC-7","arrêt : position du chauffeur supprimée, celles des autres conservées",!o7.on&&!o7.reste&&o7.autre,JSON.stringify(o7));
 chk("PC-8","aucune erreur de script",!E.length,E[0]);
 await p.evaluate(()=>{A["pos.tg"]();view="p_accueil";render()});await p.waitForTimeout(500);await p.screenshot({path:process.env.CAPT||"/tmp/transport-position.png"});
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await b.close();srv.close();process.exit(ko?1:0)})();
