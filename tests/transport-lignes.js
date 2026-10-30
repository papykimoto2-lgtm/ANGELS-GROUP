/* Transport : lignes wôrô-wôrô — création, tarif par place, déclaration de course par ligne, circuits, rapport par ligne. */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":u.endsWith(".html")?"text/html; charset=utf-8":u.endsWith(".js")?"application/javascript":"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1200,height:900},serviceWorkers:"block"})).newPage(),E=[];
 p.on("pageerror",e=>E.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/transport.html");await p.waitForTimeout(400);
 let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const r=await p.evaluate(()=>{const o={};
  const login=(role,drv)=>{let u=S.users.find(x=>x.role===role&&x.actif&&(!drv||x.driver_id===drv));if(!u){u={id:"u_l_"+role,nom:role,role,actif:true,chg:false,driver_id:drv};S.users.push(u)}ME=u;view=NAV.find(showNav).v;render()};
  const err=fn=>{try{fn();return null}catch(e){return e.message}};
  S.drivers.push({id:"drv_l1",nom:"Kouassi",actif:true});S.vehicles.push({id:"veh_l1",immat:"1 AA 01",marque:"T",modele:"X",statut:"actif",places:5});S.assignments.push({id:"as_l1",driver_id:"drv_l1",vehicle_id:"veh_l1",debut:"2026-01-01"});
  login("admin");const zn=zonesCirc()[0].nom;
  o.eNom=err(()=>creerLigne({nom:"A",commune:"Adjamé",tarif:300}));o.eTarif=err(()=>creerLigne({nom:"Gare Adjamé — Siporex",commune:"Adjamé",tarif:10}));
  o.ePlaces=err(()=>creerLigne({nom:"Gare Adjamé — Siporex",commune:"Adjamé",tarif:300,places:40}));o.eCoord=err(()=>creerLigne({nom:"Gare Adjamé — Siporex",commune:"Adjamé",tarif:300,lat:5.3}));
  o.eZone=err(()=>creerLigne({nom:zn,commune:"Adjamé",tarif:300}));
  const l=creerLigne({nom:"Gare Adjamé — Siporex",commune:"Adjamé",depart:"Gare Adjamé",arrivee:"Siporex",tarif:300,places:4,lat:5.36,lng:-4.03});
  o.eDbl=err(()=>creerLigne({nom:"gare adjamé — siporex",commune:"Adjamé",tarif:300}));
  creerLigne({nom:"Ligne Cocody — Riviera",commune:"Cocody",tarif:250,places:4});
  view="lignes";render();o.vue=document.body.innerText.includes("Lignes & tarifs wôrô-wôrô")&&document.body.innerText.includes("Gare Adjamé — Siporex")&&!!document.querySelector('[data-a="lg.add"]');
  /* déclaration chauffeur */
  login("chauffeur","drv_l1");
  A["p.course"]();o.opts=[...document.querySelectorAll(".md select[name=zone] option")].map(x=>x.textContent);document.querySelectorAll(".md").forEach(m=>m.remove());
  const c1=declarerCourse({zone:l.nom,passagers:3,montant:"",t:""});o.c1=[c1.montant,c1.passagers,c1.ligne_id===l.id,c1.tarif];
  o.eMont=err(()=>declarerCourse({zone:l.nom,passagers:3,montant:1000}));o.ePax=err(()=>declarerCourse({zone:l.nom,passagers:5,montant:""}));o.ePax0=err(()=>declarerCourse({zone:l.nom,passagers:0,montant:""}));
  o.eZonSans=err(()=>declarerCourse({zone:zn,passagers:"",montant:""}));const cz=declarerCourse({zone:zn,montant:2500});o.zoneOk=cz.montant===2500&&!cz.ligne_id;
  /* modification : renommer interdit après courses ; tarif modifiable */
  login("admin");o.eRen=err(()=>modifierLigne(l.id,{nom:"Autre nom",commune:"Adjamé",tarif:300,places:4}));modifierLigne(l.id,{nom:l.nom,commune:"Adjamé",tarif:350,places:4});o.tarif=by(S.lignes,l.id).tarif;
  /* 40 courses sur la ligne à l'heure courante → suggestion avec libellé ligne */
  const H=new Date().getHours();for(let i=0;i<40;i++){const d=new Date();d.setDate(d.getDate()-(i%5));d.setHours(H,10+(i%40),0,0);S.courses.push({id:"crs_L"+i,driver_id:"drv_l"+(i%2),zone:l.nom,montant:350*(1+i%4),ligne_id:l.id,passagers:1+i%4,tarif:350,t:d.toISOString()})}
  login("chauffeur","drv_l1");view="p_circuit";render();const tx=document.body.innerText;o.carte=tx.includes("Ligne wôrô-wôrô")&&tx.includes("350")&&tx.includes("Gare Adjamé — Siporex");
  login("admin");view="circuits";UI.tab.circ="parligne";render();const t2=document.body.innerText;o.rapport=t2.includes("Remplissage")&&t2.includes("Gare Adjamé — Siporex")&&/\d+ %/.test(t2);
  /* désactivation : refus de déclaration, exclue des suggestions */
  basculerLigne(l.id);login("chauffeur","drv_l1");o.eOff=err(()=>declarerCourse({zone:l.nom,passagers:2,montant:""}));
  const m=ANGELS_CIRCUIT.meilleures(circTab(),H,{max:9,zones:zonesTout(),exclure:lignesOff()}).liste.map(x=>x.zone);o.exclue=!m.includes(l.nom);
  A["p.course"]();o.optsList=[...document.querySelectorAll(".md select[name=zone] option")].map(x=>x.textContent);o.optsOff=o.optsList.some(t=>t.includes("Ligne · Gare Adjamé"));document.querySelectorAll(".md").forEach(m=>m.remove());
  return o});
 chk("LG-1","création : nom, tarif, places, coordonnées, doublon et nom de zone validés",[r.eNom,r.eTarif,r.ePlaces,r.eCoord,r.eZone,r.eDbl].every(Boolean),JSON.stringify([r.eNom,r.eTarif,r.ePlaces,r.eCoord,r.eZone,r.eDbl]));
 chk("LG-2","écran « Lignes wôrô-wôrô » avec bouton + Ligne",r.vue===true,r.vue);
 chk("LG-3","formulaire chauffeur : lignes (avec tarif) listées avant les zones",r.opts[0]&&r.opts[0].includes("Ligne")&&r.opts[0].includes("300")&&r.opts.some(x=>x.startsWith("Zone")),JSON.stringify(r.opts));
 chk("LG-4","course de ligne : montant = passagers × tarif (3 × 300 = 900), ligne et passagers enregistrés",r.c1[0]===900&&r.c1[1]===3&&r.c1[2]===true&&r.c1[3]===300,JSON.stringify(r.c1));
 chk("LG-5","refus : montant incohérent, passagers > places, passagers 0, zone sans montant",[r.eMont,r.ePax,r.ePax0,r.eZonSans].every(Boolean)&&/passagers × tarif/.test(r.eMont),JSON.stringify([r.eMont,r.ePax,r.ePax0,r.eZonSans]));
 chk("LG-6","course de zone (VTC) inchangée : montant libre, sans ligne",r.zoneOk===true,r.zoneOk);
 chk("LG-7","modification : tarif modifiable ; renommage interdit après des courses",r.tarif===350&&/nom ne peut plus changer/.test(r.eRen||""),JSON.stringify([r.tarif,r.eRen]));
 chk("LG-8","suggestions : la ligne apparaît avec son tarif et son trajet",r.carte===true,r.carte);
 chk("LG-9","bureau : onglet « Par ligne » (remplissage, recette)",r.rapport===true,r.rapport);
 chk("LG-10","ligne désactivée : refus de déclaration, absente des suggestions et du formulaire",!!r.eOff&&r.exclue===true&&r.optsOff===false,JSON.stringify([r.eOff,r.exclue,r.optsOff,r.optsList]));
 chk("LG-11","aucune erreur de script",!E.length,E[0]);
 await p.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");view="lignes";render()});await p.screenshot({path:process.env.CAPT||"/tmp/transport-lignes.png"});
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await b.close();srv.close();process.exit(ko?1:0)})();
