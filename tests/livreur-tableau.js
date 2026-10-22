/* Appli livreur : tableau de bord (statut, à faire, livrées, à reverser), Ma tournée, itinéraire conseillé automatique avec heures estimées.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/livreur-tableau.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:400,height:850},permissions:["geolocation"],geolocation:{latitude:5.30,longitude:-4.00}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));await p.goto(base+"/livreur.html");await p.waitForTimeout(600);
 const today=new Date().toISOString(),old=new Date(Date.now()-3*864e5).toISOString();
 const mk=(ref,num,st,q,gps,maj)=>({livraison_ref:ref,commande_ref:num,statut:st,maj_le:maj||today,payload:{numero:num,client_nom:"Client "+num,adr:{zone:"Yopougon",quartier:q,gps:gps||null},lignes:[{desig:"Article",qte:1}],montant_attendu:5000}});
 await p.evaluate(({M})=>{user={id:"u"};moi={nom:"Livreur Test",livreur_ref:"l1"};missions=M;STATS={maj_le:new Date().toISOString(),payload:{argent:{solde:23500,produits:20000,frais:3500,gardes:0,rev:0,attente:2000,comptes:[]}}};PAGE="cours";MENU=false;ITIN={sel:null,res:null,busy:false};vueMissions()},{M:[
  mk("a","CMD-A","en_cours","Loin",{lat:5.40,lng:-4.00}),mk("b","CMD-B","en_cours","Proche",{lat:5.31,lng:-4.00}),mk("c","CMD-C","acceptee","Sans position",null),
  mk("d","CMD-D","livree","Fini",null),mk("e","CMD-E","livree","Fini2",null),mk("f","CMD-F","livree","Ancien",null,old)]});
 await p.waitForTimeout(900);
 const t=await p.evaluate(()=>document.body.innerText.replace(/\s+/g," "));
 chk("LT-1","tableau de bord : nom, statut disponible, 3 à faire, 2 livrées aujourd'hui (l'ancienne exclue), 23 500 F à reverser",/Disponible/.test(t)&&/3 à faire/.test(t.replace(/(\d+)\s*à faire/,"$1 à faire"))&&/2\s*livrées aujourd'hui/.test(t)&&/23\s500 F\s*à reverser/.test(t),t.slice(0,300));
 chk("LT-2","Ma tournée : livrées du jour, montants, argent à remettre au caissier, argent en validation, courses restantes",/Ma tournée/.test(t)&&/2 course\(s\) livrée\(s\) aujourd'hui/.test(t)&&/10\s000 F/.test(t)&&/À remettre au caissier : 23\s500 F/.test(t)&&/2\s000 F en validation/.test(t)&&/3 course\(s\) restante\(s\) dont 2 en cours/.test(t),t.slice(300,700));
 const it=await p.evaluate(()=>({res:ITIN.res&&ITIN.res.ordre.map(s=>[s.ref,!!s.eta]),fin:ITIN.res&&ITIN.res.fin,txt:document.body.innerText}));
 chk("LT-3","itinéraire conseillé calculé automatiquement (sans clic) : ordre proche → loin, heure estimée par arrêt, fin estimée",it.res&&it.res[0][0]==="b"&&it.res.every(x=>x[1])&&it.fin&&/fin vers \d\d:\d\d/.test(it.txt)&&/~\d\d:\d\d/.test(it.txt),JSON.stringify(it.res));
 const e=await p.evaluate(()=>{const r=ITIN.res.ordre.map(s=>s.eta);return r.every((x,i)=>!i||x-r[i-1]>=8*60000)});
 chk("LT-4","chaque arrêt ajoute au moins 8 minutes (temps passé chez le client) à l'heure estimée précédente",e===true,String(e));
 await p.evaluate(()=>{missions=missions.filter(m=>m.livraison_ref!=="b");vueMissions()});await p.waitForTimeout(700);
 const r2=await p.evaluate(()=>ITIN.res&&ITIN.res.ordre.map(s=>s.ref));
 chk("LT-5","la liste des courses change : l'itinéraire est recalculé tout seul",JSON.stringify(r2)==='["a"]',JSON.stringify(r2));
 await p.evaluate(()=>{STATS.payload.planning={pause:{fin:new Date(Date.now()+20*60000).toISOString()}};vueMissions()});
 const t2=await p.evaluate(()=>document.body.innerText);
 chk("LT-6","en pause : le statut l'indique avec l'heure de reprise",/En pause jusqu'à \d\d:\d\d/.test(t2),t2.slice(0,200));
 await p.evaluate(()=>{delete STATS.payload.planning;vueMissions()});await p.screenshot({path:process.env.SHOT||"/tmp/livreur-tableau.png"});
 await p.evaluate(()=>{missions=[];vueMissions()});await p.waitForTimeout(300);
 const t3=await p.evaluate(()=>document.body.innerText);
 chk("LT-7","aucune mission : pas d'erreur, tournée terminée avec rappel de remise d'argent",/Tournée terminée/.test(t3)&&!/undefined|NaN/.test(t3),t3.slice(0,300));
 console.log(errs.length?errs.join("\n"):"");console.log(`RÉSULTAT : ${ok} réussis, ${ko} échecs`);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
