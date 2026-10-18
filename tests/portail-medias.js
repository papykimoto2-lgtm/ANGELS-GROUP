/* Portail : médias publiables (photos, vidéos, documents), personnalisation (logo, couleurs, informations légales) et publication (portail-data.js, portail autonome).
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/portail-medias.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1200,height:1000}}),errs=[];let ok=0,ko=0;
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/transport.html");await p.waitForTimeout(500);
 await p.evaluate(()=>{window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};
  window.__try=fn=>{const snap=JSON.stringify(S),me=ME&&ME.id;try{fn();return null}catch(e){S=JSON.parse(snap);ME=me?by(S.users,me):null;return e.message}};
  window.__sc=(c,f)=>sum(S.entries.flatMap(e=>e.lines.filter(l=>l.compte===c&&(!f||f(l,e)))),l=>(l.debit||0)-(l.credit||0));
  window.__ach=o=>acheterVehicule(Object.assign({date:today(),fournisseur:"Auto Import SARL",marque:"Toyota",modele:"Corolla",annee:2020,vin:"VIN-"+Math.random().toString(36).slice(2,8).toUpperCase(),prix:1180000,paye:1180000,mode:"banque",km:30000},o));
  window.__vente=(vid,o)=>vendreVehicule(Object.assign({vn_id:vid,date:today(),client:"Kouassi Yao",prix:1534000,mode:"banque"},o));
  __as("admin");S.settings.tva_taux=18;S.attachments.push({id:"at_test",nom:"p.pdf",type:"application/pdf",taille:5,t:now(),par:"t",data:"data:application/pdf;base64,AAAA"})});
 const t=async(id,label,fn,arg)=>{let r;try{r=await p.evaluate(fn,arg)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",typeof r==="string"?r:JSON.stringify(r))}};

 const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
 const PNG=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAAEklEQVR4nGP4z8CAFTEMLQkAm4UP8cHGGxoAAAAASUVORK5CYII=","base64");
 let PVAL="";const ps=await ctx.newPage();ps.on("pageerror",e=>errs.push("parametres: "+e.message));ps.on("dialog",d=>d.accept(PVAL));
 await ps.goto(base+"/parametres.html");await ps.waitForTimeout(400);
 const ro=await ps.evaluate(()=>({btn:[...document.querySelectorAll("#pmed [data-m]")].every(b=>b.disabled),msg:document.getElementById("pmed").innerText}));
 chk("MED-1","Médias publiables : formulaire visible, lecture seule sans administrateur déverrouillé",ro.btn&&/Lecture seule/.test(ro.msg)&&/Ajouter des médias/.test(ro.msg),JSON.stringify(ro));
 await ps.evaluate(()=>{AUTH.dist={id:"x",nom:"t",exp:Date.now()+600000};uView()});await ps.waitForTimeout(200);
 // activité visible dans « Rattacher à »
 await ps.setInputFiles("#m_photos",[{name:"vue-lac.png",mimeType:"image/png",buffer:PNG}]);await ps.waitForTimeout(700);
 const ph=await ps.evaluate(async()=>{const L=await mAll();return{n:L.length,t:L[0]&&L[0].type,src:L[0]&&L[0].src.slice(0,22),titre:L[0]&&L[0].titre,cat:L[0]&&L[0].cat,msg:document.getElementById("pmed").innerText.slice(0,80)}});
 chk("MED-2","ajout d'une photo : compressée en JPEG, enregistrée sur l'appareil, titre par défaut = nom du fichier, listée",ph.n===1&&ph.t==="photo"&&ph.src==="data:image/jpeg;base64"&&ph.titre==="vue-lac"&&ph.cat==="galerie"&&/Média ajouté/.test(ph.msg),JSON.stringify(ph));
 const val=await ps.evaluate(async()=>{const out={},F=()=>document.getElementById("mform"),T=()=>document.getElementById("pmed").innerText;F().cat.value="activite";F().act.value="";
  await mAjout("photos",[new File([new Uint8Array(10)],"x.png",{type:"image/png"})]);out.act=/Catégorie « Activité »/.test(T());
  F().cat.value="galerie";await mAjout("photos",[new File(["abc"],"x.txt",{type:"text/plain"})]);out.img=/pas une image/.test(T());
  await mAjout("pdf",[new File(["abc"],"x.pdf",{type:"text/plain"})]);out.pdf=/Seuls les fichiers PDF/.test(T());
  await mAjout("pdf",[new File([new Uint8Array(1.6*1024*1024)],"gros.pdf",{type:"application/pdf"})]);out.gros=/1,5 Mo maximum/.test(T());
  out.n=(await mAll()).length;return out});
 chk("MED-3","contrôles : activité obligatoire, fichier non image, fichier non PDF, PDF > 1,5 Mo refusés ; rien d'enregistré",val.act&&val.img&&val.pdf&&val.gros&&val.n===1,JSON.stringify(val));
 PVAL="https://exemple.ci/film.mov";await ps.evaluate(()=>mAjout("video",[]));await ps.waitForTimeout(200);
 const badv=await ps.evaluate(async()=>({m:document.getElementById("pmed").innerText.includes("non reconnue"),n:(await mAll()).length}));
 PVAL="https://www.youtube.com/watch?v=dQw4w9WgXcQ";await ps.evaluate(()=>{document.getElementById("mform").cat.value="galerie";document.getElementById("mform").titre.value="Présentation";return mAjout("video",[])});await ps.waitForTimeout(250);
 PVAL="https://exemple.ci/brochure.pdf";await ps.evaluate(()=>{document.getElementById("mform").titre.value="Brochure";return mAjout("doclien",[])});await ps.waitForTimeout(250);
 await ps.setInputFiles("#m_pdf",[{name:"tarifs.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4 test")}]);await ps.waitForTimeout(400);
 // accueil + activité + société
 await ps.evaluate(()=>{const f=document.getElementById("mform");f.cat.value="accueil";f.titre.value="Notre flotte";f.act.value="";});
 await ps.setInputFiles("#m_photos",[{name:"a.png",mimeType:"image/png",buffer:PNG}]);await ps.waitForTimeout(500);
 await ps.evaluate(()=>{const f=document.getElementById("mform");f.cat.value="activite";f.act.value="act1";f.titre.value="Livraison à moto";});
 await ps.setInputFiles("#m_photos",[{name:"b.png",mimeType:"image/png",buffer:PNG}]);await ps.waitForTimeout(500);
 await ps.evaluate(()=>{const f=document.getElementById("mform");f.cat.value="societe";f.act.value="";f.titre.value="Notre équipe";});
 await ps.setInputFiles("#m_photos",[{name:"c.png",mimeType:"image/png",buffer:PNG}]);await ps.waitForTimeout(500);
 const tot=await ps.evaluate(async()=>{const L=await mAll();return{n:L.length,types:L.map(m=>m.type+":"+m.cat).join(",")}});
 chk("MED-4","vidéo (lien .mov refusé, lien YouTube accepté), document par lien, PDF téléversé, photos d'accueil / d'activité / société enregistrés",badv.m&&badv.n===1&&tot.n===7&&/video:galerie/.test(tot.types)&&/doc:document/.test(tot.types)&&/photo:accueil/.test(tot.types)&&/photo:activite/.test(tot.types)&&/photo:societe/.test(tot.types),JSON.stringify({badv,tot}));
 // portail (même appareil, même IndexedDB)
 const pp=await ctx.newPage();pp.on("pageerror",e=>errs.push("portail: "+e.message));
 await pp.goto(base+"/portail.html");await pp.waitForTimeout(700);
 const acc=await pp.evaluate(()=>({sl:!!document.getElementById("slides"),nav:document.getElementById("parcours").innerText}));
 chk("MED-5","accueil : diaporama des photos d'accueil dans le héros ; rubriques PHOTOS et DOCUMENTS apparaissent dans le parcours",acc.sl&&/PHOTOS/.test(acc.nav)&&/DOCUMENTS/.test(acc.nav),JSON.stringify(acc));
 const pg=await pp.evaluate(async()=>{const o={};const go=async p=>{document.querySelector('[data-go="'+p+'"]').click();await new Promise(r=>setTimeout(r,200));return document.getElementById("page")};
  let e=await go("photos");o.gal=e.querySelectorAll(".gal img").length;o.legende=/vue-lac/.test(e.innerText);o.yt=(e.querySelector("iframe")||{}).src||"";o.sb=(e.querySelector("iframe")||{}).getAttribute&&(e.querySelector("iframe").getAttribute("sandbox")||"");
  e.querySelector(".gal img").click();o.lb=document.getElementById("lb").classList.contains("on");document.getElementById("lbx").click();o.lbx=!document.getElementById("lb").classList.contains("on");
  e=await go("documents");o.docs=[...e.querySelectorAll(".docs a")].map(a=>a.querySelector("b").innerText+"|"+(a.getAttribute("href")||"").slice(0,12));
  e=await go("act1");o.act=e.querySelectorAll(".gal img").length&&/Livraison à moto/.test(e.innerText);e=await go("societe");o.soc=e.querySelectorAll(".gal img").length&&/Notre équipe/.test(e.innerText);return o});
 chk("MED-6","portail : galerie avec légendes et visionneuse, vidéo YouTube intégrée (nocookie, bac à sable), documents (lien et PDF), photos de l'activité et de la société",pg.gal>=1&&pg.legende&&/youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/.test(pg.yt)&&/allow-scripts/.test(pg.sb)&&pg.lb&&pg.lbx&&pg.docs.length===2&&pg.docs.some(d=>/Brochure\|https/.test(d))&&pg.docs.some(d=>/tarifs\|data:/.test(d))&&pg.act&&pg.soc,JSON.stringify(pg));
 // personnalisation
 const pers=await ps.evaluate(()=>{const f=document.getElementById("pform"),out={};
  f.logo.value="http://exemple.ci/logo.png";f.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));out.bad=/Logo : adresse https/.test(document.getElementById("ptl").innerText);
  const f2=document.getElementById("pform");f2.logo.value="https://exemple.ci/logo.png";f2.couleur2.value="#112233";f2.c2auto.checked=false;f2.couleur3.value="#445566";f2.c3auto.checked=false;
  f2.l_raison.value="ANGEL'S GROUP SARL";f2.l_rccm.value="CI-ABJ-2024-B-0001";f2.l_siege.value="Abidjan, Cocody";f2.mentions.value="Hébergeur : Vercel";
  f2.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));const c=JSON.parse(localStorage.getItem(PKEY));out.c=c.logo+"|"+c.couleur2+"|"+c.couleur3+"|"+c.legal.rccm;return out});
 chk("MED-7","personnalisation : logo (https obligatoire), couleurs secondaire et survol, informations légales enregistrés",pers.bad&&pers.c==="https://exemple.ci/logo.png|#112233|#445566|CI-ABJ-2024-B-0001",JSON.stringify(pers));
 await pp.waitForTimeout(500);
 const per2=await pp.evaluate(async()=>{const o={};o.logo=(document.querySelector(".logo-area img")||{}).src||"";o.c2=document.documentElement.style.getPropertyValue("--c2");o.c3=document.documentElement.style.getPropertyValue("--c3");
  document.querySelector('[data-go="societe"]').click();await new Promise(r=>setTimeout(r,200));o.legal=/RCCM : CI-ABJ-2024-B-0001/.test(document.getElementById("page").innerText);o.mentions=/ANGEL'S GROUP SARL/.test(document.getElementById("mentions").textContent)&&/Hébergeur : Vercel/.test(document.getElementById("mentions").textContent);return o});
 chk("MED-8","portail : logo dans l'en-tête, couleurs personnalisées, informations légales (page Société et mentions) — mise à jour en direct depuis les Paramètres",/exemple\.ci\/logo\.png/.test(per2.logo)&&per2.c2==="#112233"&&per2.c3==="#445566"&&per2.legal&&per2.mentions,JSON.stringify(per2));
 // publication
 await ps.evaluate(()=>pTab("publication"));
 const [dl]=await Promise.all([ps.waitForEvent("download"),ps.click('[data-p="data"]')]);
 const dataJs=fs.readFileSync(await dl.path(),"utf8");
 const [dl2]=await Promise.all([ps.waitForEvent("download"),ps.click('[data-p="auto"]')]);
 const auto=fs.readFileSync(await dl2.path(),"utf8");
 chk("MED-9","publication : portail-data.js (réglages + médias) et portail autonome (.html) générés ; aucun marqueur de script ne casse la page",/^window\.__PORTAIL_DATA=\{/.test(dataJs)&&dataJs.includes("youtube.com/watch")&&dataJs.includes("ANGEL'S GROUP SARL")&&!dataJs.includes("</")&&auto.includes("window.__PORTAIL_DATA=")&&!auto.includes('<script src="portail-data.js">')&&auto.includes("tarifs"),dataJs.slice(0,80));
 const visit=async(html,route)=>{const c=await b.newContext(),p=await c.newPage();p.on("pageerror",e=>errs.push("visiteur: "+e.message));
  await p.route("**/portail-data.js",r=>route?r.fulfill({status:200,contentType:"text/javascript",body:route}):r.fulfill({status:404,body:""}));
  if(html)await p.route("**/portail.html",r=>r.fulfill({status:200,contentType:"text/html; charset=utf-8",body:html}));
  await p.goto(base+"/portail.html");await p.waitForTimeout(700);
  const o=await p.evaluate(async()=>{const r={};r.logo=(document.querySelector(".logo-area img")||{}).src||"";r.nav=document.getElementById("parcours").innerText;r.sl=!!document.getElementById("slides");
   document.querySelector('[data-go="photos"]').click();await new Promise(x=>setTimeout(x,200));r.gal=document.querySelectorAll("#page .gal img").length;return r});await c.close();return o};
 const v1=await visit(null,dataJs),v2=await visit(auto,null);
 chk("MED-10","un visiteur sur un autre appareil (sans aucun réglage local) voit le portail publié : avec portail-data.js, et avec le portail autonome",[v1,v2].every(v=>/exemple\.ci\/logo\.png/.test(v.logo)&&v.sl&&/DOCUMENTS/.test(v.nav)&&v.gal>=1),JSON.stringify({v1,v2}));
 const evil={v:1,cfg:{nom:"X"},media:[{id:"1",type:"photo",cat:"galerie",titre:"<img src=x onerror=alert(1)>",src:"javascript:alert(1)",t:1},{id:"2",type:"photo",cat:"galerie",titre:"svg",src:"data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",t:2},{id:"3",type:"video",cat:"galerie",src:"https://evil.example/embed/x",t:3},{id:"4",type:"video",cat:"galerie",src:"javascript:alert(1)",t:4},{id:"5",type:"doc",cat:"document",titre:"d",src:"javascript:alert(1)",t:5},{id:"6",type:"photo",cat:"galerie",titre:"ok",src:"data:image/png;base64,"+PNG.toString("base64"),t:6}]};
 const v3=await (async()=>{const c=await b.newContext(),p=await c.newPage();p.on("pageerror",e=>errs.push("hostile: "+e.message));await p.route("**/portail-data.js",r=>r.fulfill({status:200,contentType:"text/javascript",body:"window.__PORTAIL_DATA="+JSON.stringify(evil)+";"}));
  await p.goto(base+"/portail.html");await p.waitForTimeout(600);const o=await p.evaluate(async()=>{document.querySelector('[data-go="photos"]').click();await new Promise(x=>setTimeout(x,200));return{imgs:[...document.querySelectorAll("#page .gal img")].map(i=>i.getAttribute("src").slice(0,22)),ifr:document.querySelectorAll("#page iframe").length,vid:document.querySelectorAll("#page video").length,doc:/DOCUMENTS/.test(document.getElementById("parcours").innerText),inj:document.querySelectorAll("#page [onerror]").length}});await c.close();return o})();
 chk("MED-11","sécurité : médias hostiles (javascript:, SVG, hôte vidéo inconnu, titre HTML) ignorés ou neutralisés ; seule la photo PNG valide s'affiche",v3.imgs.length===1&&/^data:image\/png;base64/.test(v3.imgs[0])&&v3.ifr===0&&v3.vid===0&&!v3.doc&&v3.inj===0,JSON.stringify(v3));
 const del=await ps.evaluate(async()=>{const L=await mAll();for(const m of L.filter(m=>m.type==="video"))await mDel(m.id);return(await mAll()).length});
 chk("MED-12","suppression d'un média",del===6,del);
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
