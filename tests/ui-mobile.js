/* Interface mobile commune (ui-mobile.js) : barre du bas, icônes, parcours d'une commande, états vides, raccourcis, dans les applications Livreur et Vendeur.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/ui-mobile.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:400,height:800}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 // ---- vendeur
 const pv=await ctx.newPage();pv.on("pageerror",e=>errs.push("V "+e.message));await pv.goto(base+"/vendeur.html");await pv.waitForTimeout(1000);
 const V=await pv.evaluate(()=>{user={id:"u"};moi={nom:"Boutique Awa"};D={commandes:[{numero:"C1",statut:"En préparation",client:"A",montant:1000},{numero:"C2",statut:"Prête à être livrée",client:"B",montant:1000},{numero:"C3",statut:"En cours de livraison",client:"C",montant:1000},{numero:"C4",statut:"Livrée",client:"D",montant:1000},{numero:"C5",statut:"Livraison échouée",client:"E",montant:1000}],demandes:[{ref:"D1",nom:"Koné",tel:"0102",zone:"Cocody",quartier:"",repere:"",note:"",cree_le:new Date().toISOString(),lignes:[{desig:"Riz",qte:1,pu:null}]}],reglements:[],solde:0,lien:"https://exemple.test/p"};PAGE="accueil";MENU=false;vue();
  const tb=[...document.querySelectorAll(".tb button")].map(x=>({l:x.getAttribute("aria-label"),on:x.classList.contains("on"),c:x.classList.contains("tc"),n:(x.querySelector(".tn")||{}).textContent||"",svg:!!x.querySelector("svg")}));
  const etapes=[...document.querySelectorAll(".pcs")].map(o=>({cur:(o.querySelector("li.cur .pl")||{}).textContent||"",ko:o.classList.contains("ko")}));
  return{tb,etapes,cls:document.body.classList.contains("has-tb"),rac:[...document.querySelectorAll(".rac button")].map(x=>x.innerText.trim()),emoji:/[\u{1F300}-\u{1FAFF}]/u.test(document.querySelector(".tb").innerText)}});
 chk("UI-1","vendeur : barre du bas à 5 entrées avec icônes SVG (Accueil, Demandes, Nouvelle au centre, Commandes, Moi), accueil actif, pastille des demandes",eq(V.tb.map(x=>x.l),["Accueil","Demandes","Nouvelle","Commandes","Moi"])&&V.tb[0].on&&V.tb[2].c&&V.tb.every(x=>x.svg)&&V.tb[1].n==="1"&&V.cls&&!V.emoji,JSON.stringify(V.tb));
 chk("UI-2","vendeur : le parcours de chaque commande indique la bonne étape (préparation → Commande, prête → Collecte, en cours → En route, livrée → Livré, échec → hors parcours)",eq(V.etapes.map(x=>x.cur),["Commande","Collecte","En route","Livré",""])&&V.etapes[4].ko,JSON.stringify(V.etapes));
 chk("UI-3","vendeur : raccourcis de l'accueil (Règlements, Mon lien client, Live)",eq(V.rac,["Règlements","Mon lien client","Live"]),JSON.stringify(V.rac));
 const V2=await pv.evaluate(()=>{const o={};document.querySelector('.tb [data-p="demandes"]').click();o.d=PAGE;document.querySelector('.tb [data-p="nouvelle"]').click();o.n=PAGE;o.f=!!document.getElementById("fcmd");document.querySelector('.tb [data-p="compte"]').click();o.c=PAGE;o.on=(document.querySelector(".tb button.on")||{}).getAttribute&&document.querySelector(".tb button.on").getAttribute("aria-label");
  D.commandes=[];D.demandes=[];PAGE="commandes";vue();o.vide=!!document.querySelector(".vd svg")&&/Aucune commande/.test(document.querySelector(".vd").innerText);return o});
 chk("UI-4","vendeur : la barre navigue (demandes, formulaire de commande, compte), marque l'onglet actif et montre un état vide illustré",V2.d==="demandes"&&V2.n==="nouvelle"&&V2.f&&V2.c==="compte"&&V2.on==="Moi"&&V2.vide,JSON.stringify(V2));
 const V3=await pv.evaluate(()=>{user=null;vueLogin();return{cls:document.body.classList.contains("has-tb"),tb:!!document.querySelector(".tb")}});
 chk("UI-5","vendeur : pas de barre du bas sur l'écran de connexion",!V3.cls&&!V3.tb,JSON.stringify(V3));
 // ---- livreur
 const pl=await ctx.newPage();pl.on("pageerror",e=>errs.push("L "+e.message));await pl.goto(base+"/livreur.html");await pl.waitForTimeout(800);
 const mk=(ref,num,st,col)=>({livraison_ref:ref,commande_ref:num,statut:st,payload:{numero:num,client_nom:"Client "+num,adr:{zone:"Yopougon",quartier:"Q"},lignes:[{desig:"Article",qte:1}],montant_attendu:5000,collecte_at:col||null}});
 const Lv=await pl.evaluate(({M})=>{user={id:"u"};moi={nom:"Livreur Test",livreur_ref:"l1"};missions=M;PAGE="cours";MENU=false;ITIN={sel:null,res:null,busy:false};vueMissions();
  const tb=[...document.querySelectorAll(".tb button")].map(x=>({l:x.getAttribute("aria-label"),on:x.classList.contains("on"),n:(x.querySelector(".tn")||{}).textContent||"",svg:!!x.querySelector("svg")}));
  const et=[...document.querySelectorAll(".mc .pcs")].map(o=>(o.querySelector("li.cur .pl")||{}).textContent||"");
  const sos=document.querySelector(".sosb").getBoundingClientRect(),bar=document.querySelector(".tb").getBoundingClientRect();
  return{tb,et,sosAuDessus:sos.bottom<=bar.top+1,cls:document.body.classList.contains("has-tb")}},{M:[mk("a","CMD-A","affectee"),mk("b","CMD-B","acceptee",null),mk("c","CMD-C","acceptee","2026-10-20T10:00:00Z"),mk("d","CMD-D","en_cours")]});
 chk("UI-6","livreur : barre du bas à 5 entrées avec icônes (Missions, Messages, Planning, Gains, Moi), missions actives comptées, bouton SOS au-dessus de la barre",eq(Lv.tb.map(x=>x.l),["Missions","Messages","Planning","Gains","Moi"])&&Lv.tb[0].on&&Lv.tb[0].n==="4"&&Lv.tb.every(x=>x.svg)&&Lv.sosAuDessus&&Lv.cls,JSON.stringify(Lv));
 chk("UI-7","livreur : parcours par mission (affectée et acceptée → Collecte, colis pris → Collecte, en cours → En route)",eq(Lv.et,["Collecte","Collecte","Collecte","En route"]),JSON.stringify(Lv.et));
 const L2=await pl.evaluate(()=>{const o={};for(const [k,l] of [["chat","Messages"],["plan","Planning"],["gains","Gains"],["reglages","Moi"]]){document.querySelector('.tb [data-r="'+k+'"]').click();o[k]=PAGE+"/"+(document.querySelector(".tb button.on")||{getAttribute:()=>""}).getAttribute("aria-label")}
  missions=[];PAGE="cours";vueMissions();o.vide=!!document.querySelector(".vd svg")&&/Aucune mission/.test(document.querySelector(".vd").innerText);document.querySelector('[data-a="menu"]').click();o.menu=document.querySelectorAll(".dr nav .mi").length;return o});
 chk("UI-8","livreur : la barre navigue vers les 4 autres pages, marque l'onglet actif, état vide illustré, menu ☰ conservé pour les pages secondaires",L2.chat==="chat/Messages"&&L2.plan==="plan/Planning"&&L2.gains==="gains/Gains"&&L2.reglages==="reglages/Moi"&&L2.vide&&L2.menu>=5,JSON.stringify(L2));
 // ---- module partagé
 const U=await pl.evaluate(()=>{const u=ANGELS_UI,E=[];for(const k of u.ICONES){if(!/<svg/.test(u.ic(k)))E.push(k)}
  const t=u.tabbar([{k:"a",l:"<b>x</b>",i:"accueil",n:150}],"a","p");if(/<b>x/.test(t))E.push("échappement");if(!/99\+/.test(t))E.push("pastille 99+");
  if(!eq1(u.etapeCmd("Annulée"),{i:0,ko:true}))E.push("annulée");function eq1(a,b){return JSON.stringify(a)===JSON.stringify(b)}
  return{E,n:u.ICONES.length}});
 chk("UI-9","module commun : toutes les icônes se dessinent, les libellés sont échappés, pastille plafonnée à 99+",U.E.length===0&&U.n>=20,JSON.stringify(U));
 const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
 chk("UI-10","hors ligne : ui-mobile.js est dans la coque du service worker et chargé par les deux applications",sw.includes('"ui-mobile.js"')&&/ui-mobile\.js/.test(fs.readFileSync(path.join(root,"livreur.html"),"utf8"))&&/ui-mobile\.js/.test(fs.readFileSync(path.join(root,"vendeur.html"),"utf8")));
 console.log(errs.length?errs.join("\n"):"");console.log(`RÉSULTAT : ${ok} réussis, ${ko} échecs`);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
