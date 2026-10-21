/* Navigation du livreur : Waze et Google Maps, temps d'arrivée estimé (course et tournée).
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/navigation-eta.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":f.endsWith(".html")?"text/html; charset=utf-8":f.endsWith(".js")?"application/javascript":"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:420,height:900}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const L=await ctx.newPage();L.on("pageerror",e=>errs.push(e.message));await L.goto(base+"/livreur.html");await L.waitForTimeout(600);
 const v=await L.evaluate(()=>{const o={};user={id:"u"};moi={nom:"T",livreur_ref:"l1"};
  const mk=(st,gps)=>({livraison_ref:"a"+Math.random(),commande_ref:"CMD-1",statut:st,payload:{numero:"CMD-1",client_nom:"C",adr:{zone:"Cocody",quartier:"Angré",gps},lignes:[],montant_attendu:0}});
  o.wzone=/waze\.com\/ul\?q=Angr/.test(carte(mk("acceptee")));
  const m=mk("en_cours",{lat:5.3600,lng:-4.0000});o.wgps=/waze\.com\/ul\?ll=5\.36,-4&amp;navigate=yes|waze\.com\/ul\?ll=5\.36,-4&navigate=yes/.test(carte(m));
  o.sansEta=!/Arrivée estimée/.test(carte(m));
  /* 5 km à vol d'oiseau environ : 0,045° de latitude ≈ 5 km → ×1,4 à 25 km/h ≈ 17 min */
  DERPOS={lat:5.3150,lng:-4.0000,t:Date.now()};const h=carte(m);const mt=/≈ (\d+) min<\/b> \((\d+\.\d) km/.exec(h);o.eta=!!mt&&Math.abs(+mt[1]-17)<=1&&Math.abs(+mt[2]-5)<0.2;o.etaVal=mt&&mt[0];
  DERPOS={lat:5.3150,lng:-4.0000,t:Date.now()-20*60000};o.perime=!/Arrivée estimée/.test(carte(m));
  STATS={statut:"stats",payload:{regles:{vitesse_moy:50}}};DERPOS={lat:5.3150,lng:-4.0000,t:Date.now()};const h2=carte(m),m2=/≈ (\d+) min/.exec(h2);o.vmoy=!!m2&&Math.abs(+m2[1]-8)<=1;STATS=null;
  /* tournée */
  missions=[Object.assign(mk("en_cours",{lat:5.3300,lng:-4.0000}),{livraison_ref:"t1"}),Object.assign(mk("acceptee",{lat:5.3600,lng:-4.0000}),{livraison_ref:"t2"})];
  ITIN={sel:new Set(["t1","t2"]),res:{ordre:[{num:"CMD-1",lbl:"A",lat:5.33,lng:-4,km:1.7,txt:"A"},{num:"CMD-2",lbl:"B",lat:5.36,lng:-4,km:3.3,txt:"B"}],url:"https://www.google.com/maps/dir/",depart:true},busy:false};
  PAGE="cours";vueMissions();const t=document.body.innerText,hh=document.body.innerHTML;o.tour=/Tournée estimée/.test(t)&&/≈ 17 min/.test(t)&&/waze\.com\/ul\?ll=5\.33,-4/.test(hh);
  return o});
 chk("NV-1","boutons Waze : coordonnées du client ou zone",v.wzone&&v.wgps,JSON.stringify(v));
 chk("NV-2","temps d'arrivée : absent sans position récente, ≈ 17 min pour 5 km (×1,4 à 25 km/h), expiré après 10 min, vitesse moyenne publiée par le bureau",v.sansEta&&v.eta&&v.perime&&v.vmoy,JSON.stringify(v));
 chk("NV-3","tournée : Waze vers le premier arrêt et durée totale estimée",v.tour,JSON.stringify(v));
 chk("NV-4","aucune erreur JS",errs.length===0,errs.join("|"));
 console.log("RÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
