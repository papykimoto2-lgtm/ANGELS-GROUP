/* Interface livreur désencombrée : menu ☰ (commandes en cours + meilleur itinéraire, traitées récemment, GPS / mot de passe / alertes), meilleur itinéraire sur 1 ou plusieurs commandes, activation du GPS.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/livreur-menu.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:400,height:850},permissions:["geolocation"],geolocation:{latitude:5.30,longitude:-4.00}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));await p.goto(base+"/livreur.html");await p.waitForTimeout(600);
 const mk=(ref,num,st,q,gps)=>({livraison_ref:ref,commande_ref:num,statut:st,payload:{numero:num,client_nom:"Client "+num,adr:{zone:"Yopougon",quartier:q,gps:gps||null},lignes:[{desig:"Article",qte:1}],montant_attendu:5000}});
 const init=async()=>p.evaluate(({M})=>{user={id:"u"};moi={nom:"Livreur Test",livreur_ref:"l1"};missions=M;PAGE="cours";MENU=false;ITIN={sel:null,res:null,busy:false};vueMissions()},{M:[
  mk("a","CMD-A","en_cours","Loin",{lat:5.40,lng:-4.00}),mk("b","CMD-B","en_cours","Proche",{lat:5.31,lng:-4.00}),mk("c","CMD-C","en_cours","Moyen",{lat:5.35,lng:-4.00}),mk("d","CMD-D","acceptee","Sans position",null),
  mk("e","CMD-E","livree","Fini",null),mk("f","CMD-F","affectee","Nouveau",null)]});
 await init();
 const h=await p.evaluate(()=>({hd:!!document.querySelector(".hd [data-a=menu]"),voix:!!document.querySelector(".hd [data-a=voix]"),quit:!!document.querySelector(".hd [data-a=quitter]"),mdp:!!document.querySelector("[data-a=mdp]"),inc:!!document.querySelector("[data-a=incident]"),rec:/Terminées récemment/.test(document.body.innerText),it:!!document.querySelector("[data-a=itincalc]")}));
 chk("LM-1","écran principal désencombré : bouton ☰ ; plus de voix/déconnexion/mot de passe/incident/terminées sur la page ; « Meilleur itinéraire » et commandes en cours présents",h.hd&&!h.voix&&!h.quit&&!h.mdp&&!h.inc&&!h.rec&&h.it,JSON.stringify(h));
 await p.click('[data-a="menu"]');await p.waitForTimeout(100);
 const m=await p.evaluate(()=>({items:[...document.querySelectorAll(".dr nav .mi")].map(x=>x.innerText.replace(/\s+/g," ").trim())}));
 chk("LM-2","menu ☰ : commandes en cours et meilleur itinéraire, traitées récemment, messages du centre, planning et pauses, mes gains et ma prime, mes statistiques, GPS/mot de passe/alertes, incident, installer l'application, déconnexion",m.items.length===10&&/en cours et meilleur itinéraire\s*4?/.test(m.items[0])&&/Traitées récemment\s*1/.test(m.items[1])&&/Messages du centre/.test(m.items[2])&&/Planning et pauses/.test(m.items[3])&&/Mes gains et ma prime/.test(m.items[4])&&/Mes statistiques/.test(m.items[5])&&/GPS, mot de passe/.test(m.items[6])&&/incident/.test(m.items[7])&&/Installer l'application/.test(m.items[8])&&/Déconnexion/.test(m.items[9]),JSON.stringify(m));
 await p.click('[data-r="recent"]');await p.waitForTimeout(100);
 const r1=await p.evaluate(()=>({t:document.body.innerText,menu:!!document.querySelector(".dr")}));
 chk("LM-3","« Traitées récemment » : la commande livrée seulement ; le menu se ferme",/Traitées récemment/.test(r1.t)&&/CMD-E/.test(r1.t)&&!/CMD-A/.test(r1.t)&&!r1.menu,r1.t.slice(0,200));
 await p.click('[data-a="menu"]');await p.click('[data-r="reglages"]');await p.waitForTimeout(150);
 const g=await p.evaluate(()=>({gps:!!document.querySelector("[data-a=gpsact]"),part:!!document.querySelector("[data-gp]"),mdp:!!document.querySelector("[data-a=mdp]"),voix:!!document.querySelector("[data-a=voix]"),sons:!!document.querySelector("[data-a=sons]")}));
 chk("LM-4","« GPS, mot de passe et alertes » : activer le GPS, partage de la position, changer le mot de passe, son et voix",g.gps&&g.part&&g.mdp&&g.voix&&g.sons,JSON.stringify(g));
 await p.click('[data-a="gpsact"]');await p.waitForTimeout(500);
 const g2=await p.evaluate(()=>({pref:lsGet(LS.g,{}).on,txt:document.body.innerText}));
 await p.uncheck("[data-gp]");const off=await p.evaluate(()=>({pref:lsGet(LS.g,{}).on,go:gpsOn()}));
 chk("LM-5","activation du GPS (autorisation demandée) puis partage coupé/rétabli par le livreur (réglage mémorisé, respecté par le suivi)",g2.pref===true&&off.pref===false&&off.go===false,JSON.stringify([g2.pref,off]));
 await p.check("[data-gp]");
 /* meilleur itinéraire */
 await p.evaluate(()=>{PAGE="cours";vueMissions()});await p.waitForTimeout(100);
 const sel=await p.evaluate(()=>[...document.querySelectorAll("[data-it]")].map(x=>[x.dataset.it,x.checked]));
 chk("LM-6","meilleur itinéraire : les commandes à faire (acceptées et en cours) sont proposées, celles en cours cochées par défaut ; les commandes à accepter et terminées n'y figurent pas",sel.length===4&&sel.filter(x=>x[1]).map(x=>x[0]).sort().join()==="a,b,c"&&!sel.some(x=>x[0]==="e"||x[0]==="f"),JSON.stringify(sel));
 await p.click('[data-a="itincalc"]');await p.waitForTimeout(700);
 const res=await p.evaluate(()=>({ordre:ITIN.res&&ITIN.res.ordre.map(s=>s.ref),url:ITIN.res&&ITIN.res.url,dep:ITIN.res&&ITIN.res.depart,html:document.body.innerText}));
 chk("LM-7","3 commandes : ordre de passage le plus court depuis la position du livreur (proche → moyen → loin), lien Google Maps en mode moto avec étapes, distances affichées",JSON.stringify(res.ordre)==='["b","c","a"]'&&res.dep===true&&/travelmode=two-wheeler/.test(res.url)&&/destination=5\.4,-4/.test(res.url)&&/waypoints=5\.31,-4%7C5\.35,-4/.test(res.url)&&/Ordre conseillé/.test(res.html)&&/Ouvrir l'itinéraire/.test(res.html),JSON.stringify(res));
 /* une seule commande + adresse sans position */
 await p.evaluate(()=>{ITIN.sel=new Set(["d"]);ITIN.res=null;vueMissions()});await p.click('[data-a="itincalc"]');await p.waitForTimeout(600);
 const un=await p.evaluate(()=>({url:ITIN.res.url,ordre:ITIN.res.ordre.map(s=>s.ref)}));
 chk("LM-8","1 seule commande sans position exacte : itinéraire vers l'adresse (quartier, zone) ; mélange avec position connue : celles sans position passent en dernier",/destination=Sans%20position%2C%20Yopougon%2C%20Abidjan/.test(un.url)&&!/waypoints/.test(un.url),JSON.stringify(un));
 const mix=await p.evaluate(()=>{ITIN.sel=new Set(["d","a","b"]);ITIN.res=null;return ordreItineraire({lat:5.30,lng:-4.0},[{ref:"d",lat:null,lng:null,txt:"x"},{ref:"a",lat:5.40,lng:-4},{ref:"b",lat:5.31,lng:-4}]).map(s=>s.ref)});
 chk("LM-9","adresses sans position : placées en dernier ; sans position du téléphone, l'ordre part de la première commande",JSON.stringify(mix)==='["b","a","d"]'&&JSON.stringify(await p.evaluate(()=>ordreItineraire(null,[{ref:"a",lat:5.4,lng:-4},{ref:"b",lat:5.31,lng:-4},{ref:"c",lat:5.35,lng:-4}]).map(s=>s.ref)))==='["a","c","b"]',JSON.stringify(mix));
 await p.evaluate(()=>{PAGE="cours";MENU=true;vueMissions()});await p.keyboard.press("Escape");await p.waitForTimeout(100);
 chk("LM-10","la touche Échap ferme le menu ; la page courante est conservée au rafraîchissement automatique",!(await p.evaluate(()=>!!document.querySelector(".dr")))&&await p.evaluate(()=>{PAGE="recent";vueMissions();return PAGE==="recent"&&/Traitées récemment/.test(document.body.innerText)}));
 chk("LM-11","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
