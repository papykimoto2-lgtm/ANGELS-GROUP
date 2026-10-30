/* Wôrô-wôrô communal (circulation libre dans une commune) et intercommunal (lignes) : exploitation du taxi, tarif communal, déclaration, circuits, rapports. */
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
  const login=(role,drv)=>{let u=S.users.find(x=>x.role===role&&x.actif&&(!drv||x.driver_id===drv));if(!u){u={id:"u_w_"+role+(drv||""),nom:role,role,actif:true,chg:false,driver_id:drv};S.users.push(u)}ME=u;view=NAV.find(showNav).v;render()};
  const err=fn=>{try{fn();return null}catch(e){return e.message}};
  /* 3 taxis : communal Cocody, intercommunal, libre */
  for(const [d,v,ex,com] of [["dc","vc","intra","Cocody"],["di","vi","inter",""],["dl","vl","",""]]){S.drivers.push({id:d,nom:"Chauffeur "+d,actif:true});S.vehicles.push({id:v,immat:v.toUpperCase(),marque:"T",modele:"X",statut:"actif",exploit:ex,commune:com});S.assignments.push({id:"as_"+d,driver_id:d,vehicle_id:v,debut:"2026-01-01"})}
  login("admin");const zc=zonesCirc().filter(z=>z.commune==="Cocody").map(z=>z.nom),zp=zonesCirc().find(z=>z.commune==="Plateau").nom;
  o.eVeh1=err(()=>vehExploitCtl({exploit:"intra",commune:""}));o.eVeh2=err(()=>vehExploitCtl({exploit:"intra",commune:"Cocody"}));o.eVeh3=err(()=>vehExploitCtl({exploit:"xx"}));
  o.eTar1=err(()=>definirTarifCommune({commune:"Cocody",tarif:10}));definirTarifCommune({commune:"Cocody",tarif:200});definirTarifCommune({commune:"Cocody",tarif:250});o.tc=tarifsCommunes().filter(t=>t.commune==="Cocody").map(t=>t.tarif);
  o.eVeh2b=err(()=>vehExploitCtl({exploit:"intra",commune:"Cocody"}));
  const lg=creerLigne({nom:"Gare Adjamé — Yopougon Siporex",commune:"Adjamé",commune_arrivee:"Yopougon",tarif:400,places:4});o.arr=lg.commune_arrivee;const lg2=creerLigne({nom:"Navette Plateau",commune:"Plateau",tarif:150});o.arr2=lg2.commune_arrivee;
  view="lignes";render();const tx=document.body.innerText;o.vue=tx.includes("Intercommunale")&&tx.includes("Intra-communale")&&tx.includes("Circulation libre dans une commune")&&tx.includes("Cocody");
  /* communal */
  login("chauffeur","dc");A["p.course"]();o.optsC=[...document.querySelectorAll(".md select[name=zone] option")].map(x=>x.textContent);document.querySelectorAll(".md").forEach(m=>m.remove());
  const c1=declarerCourse({zone:zc[0],passagers:3,montant:""});o.c1=[c1.montant,c1.mode,c1.commune,c1.passagers,c1.cap];
  o.eAutreCom=err(()=>declarerCourse({zone:zp,passagers:2,montant:""}));o.eLigne=err(()=>declarerCourse({zone:lg.nom,passagers:2,montant:""}));o.eMontC=err(()=>declarerCourse({zone:zc[0],passagers:2,montant:999}));o.ePaxC=err(()=>declarerCourse({zone:zc[0],passagers:6,montant:""}));
  /* intercommunal */
  login("chauffeur","di");A["p.course"]();o.optsI=[...document.querySelectorAll(".md select[name=zone] option")].map(x=>x.textContent);document.querySelectorAll(".md").forEach(m=>m.remove());
  const c2=declarerCourse({zone:lg.nom,passagers:4,montant:""});o.c2=[c2.montant,c2.mode,c2.ligne_id===lg.id];o.eZoneI=err(()=>declarerCourse({zone:zc[0],montant:2000}));
  /* libre */
  login("chauffeur","dl");A["p.course"]();o.optsL=[...document.querySelectorAll(".md select[name=zone] option")].map(x=>x.textContent);document.querySelectorAll(".md").forEach(m=>m.remove());
  const c3=declarerCourse({zone:zp,montant:3000});o.c3=[c3.mode,c3.montant,c3.passagers];const c4=declarerCourse({zone:lg.nom,passagers:2,montant:""});o.c4=c4.montant;
  /* circuits : 40 courses communales Cocody + 40 sur la ligne */
  const H=new Date().getHours();for(let i=0;i<40;i++){const d=new Date();d.setDate(d.getDate()-(i%5));d.setHours(H,10+(i%40),0,0);const pax=1+i%4;S.courses.push({id:"crs_c"+i,driver_id:"dc",zone:zc[i%zc.length],commune:"Cocody",mode:"intra",passagers:pax,tarif:250,cap:4,montant:250*pax,t:d.toISOString()});S.courses.push({id:"crs_l"+i,driver_id:"di",zone:lg.nom,ligne_id:lg.id,mode:"ligne",passagers:pax,tarif:400,cap:4,montant:400*pax,t:d.toISOString()});S.courses.push({id:"crs_p"+i,driver_id:"dl",zone:zp,mode:"libre",montant:5000,t:d.toISOString()})}
  login("chauffeur","dc");view="p_circuit";render();let t1=document.body.innerText;o.pcC=t1.includes("Taxi communal")&&t1.includes("Cocody")&&!document.querySelector('[data-a="circ.com"]');const m1=ANGELS_CIRCUIT.meilleures(circTab(),H,{max:9,commune:"Cocody",zones:zonesTout(),exclure:lignesOff()}).liste;o.mC=m1.every(x=>x.commune==="Cocody")&&m1.length>0;
  login("chauffeur","di");view="p_circuit";render();t1=document.body.innerText;o.pcI=t1.includes("Taxi de ligne")&&!document.querySelector('[data-a="circ.com"]');const m2=ANGELS_CIRCUIT.meilleures(circTab(),H,{max:9,zones:zonesTout(),exclure:lignesOff(),parmi:lignesAct().map(l=>l.nom)}).liste;o.mI=m2.length===1&&m2[0].zone===lg.nom;
  login("chauffeur","dl");view="p_circuit";render();o.pcL=!!document.querySelector('[data-a="circ.com"]');
  /* rapports */
  const rc=ANGELS_CIRCUIT.rapportCommunes(S.courses);o.rcd=rc;o.rc=rc.length===1&&rc[0].commune==="Cocody"&&rc[0].trajets>=30&&rc[0].remplissage>0;
  login("admin");view="circuits";UI.tab.circ="parligne";render();const t2=document.body.innerText;o.rap=t2.includes("Circulation libre par commune")&&t2.includes("Cocody");
  /* suppression de tarif : refusée tant que des taxis communaux y circulent */
  o.eDel=err(()=>supprimerTarifCommune("Cocody"));S.vehicles.find(v=>v.id==="vc").exploit="";supprimerTarifCommune("Cocody");o.del=!tarifCommune("Cocody");
  return o});
 chk("WW-1","exploitation du taxi : commune obligatoire pour un taxi communal, tarif communal exigé, valeur invalide refusée",!!r.eVeh1&&!!r.eVeh3&&/Aucun tarif défini/.test(r.eVeh2||"")&&r.eVeh2b===null,JSON.stringify([r.eVeh1,r.eVeh2,r.eVeh3,r.eVeh2b]));
 chk("WW-2","tarif communal : bornes, une seule valeur par commune (la dernière)",!!r.eTar1&&r.tc.length===1&&r.tc[0]===250,JSON.stringify([r.eTar1,r.tc]));
 chk("WW-3","ligne : commune d'arrivée (intercommunale) ou commune de départ par défaut (intra-communale)",r.arr==="Yopougon"&&r.arr2==="Plateau",JSON.stringify([r.arr,r.arr2]));
 chk("WW-4","écran Lignes & tarifs : lignes typées et tarifs communaux",r.vue===true,r.vue);
 chk("WW-5","taxi communal : seuls les quartiers de sa commune sont proposés, avec le tarif",r.optsC.length>0&&r.optsC.every(x=>x.startsWith("Quartier")&&x.includes("250")),JSON.stringify(r.optsC));
 chk("WW-6","taxi communal : course = passagers × tarif communal (3 × 250 = 750), mode « intra », commune enregistrée",r.c1[0]===750&&r.c1[1]==="intra"&&r.c1[2]==="Cocody"&&r.c1[3]===3&&r.c1[4]===4,JSON.stringify(r.c1));
 chk("WW-7","taxi communal : refus hors de sa commune, sur une ligne intercommunale, montant incohérent, passagers > 4",/limitée à sa commune/.test(r.eAutreCom||"")&&/réservé|limitée|ouvertes/.test(r.eLigne||"")&&/passagers × tarif/.test(r.eMontC||"")&&!!r.ePaxC,JSON.stringify([r.eAutreCom,r.eLigne,r.eMontC,r.ePaxC]));
 chk("WW-8","taxi intercommunal : seules les lignes sont proposées ; course = passagers × tarif de la ligne (4 × 400 = 1 600) ; zone refusée",r.optsI.length===2&&r.optsI.every(x=>x.startsWith("🚖 Ligne"))&&r.c2[0]===1600&&r.c2[1]==="ligne"&&r.c2[2]===true&&/ligne/i.test(r.eZoneI||""),JSON.stringify([r.optsI,r.c2,r.eZoneI]));
 chk("WW-9","taxi libre (VTC) inchangé : lignes et zones, montant libre",r.optsL.some(x=>x.startsWith("🚖"))&&r.optsL.some(x=>x.startsWith("Zone"))&&r.c3[0]==="libre"&&r.c3[1]===3000&&r.c4===800,JSON.stringify([r.c3,r.c4]));
 chk("WW-10","circuits chauffeur : communal = sa commune seulement (sans choix de périmètre) ; intercommunal = ses lignes ; libre = choix du périmètre",r.pcC&&r.mC&&r.pcI&&r.mI&&r.pcL,JSON.stringify([r.pcC,r.mC,r.pcI,r.mI,r.pcL]));
 chk("WW-11","rapport par commune (circulation libre) et onglet bureau",r.rc===true&&r.rap===true,JSON.stringify([r.rcd,r.rap]));
 chk("WW-12","suppression d'un tarif refusée tant que des taxis communaux y circulent",/taxis communaux/.test(r.eDel||"")&&r.del===true,JSON.stringify([r.eDel,r.del]));
 chk("WW-13","aucune erreur de script",!E.length,E[0]);
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await b.close();srv.close();process.exit(ko?1:0)})();
