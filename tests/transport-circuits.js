/* Transport : circuits rentables — déclaration de course, suggestions chauffeur, carte de chaleur / plan / rapport bureau. */
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
  const login=(role,extra)=>{let u=S.users.find(x=>x.role===role&&x.actif&&(!extra||x.driver_id===extra));if(!u){u={id:"u_c_"+role+(extra||""),nom:role,role,actif:true,chg:false,driver_id:extra};S.users.push(u)}ME=u;view=NAV.find(showNav).v;render()};
  S.drivers.push({id:"drv_c1",nom:"Kouassi",actif:true},{id:"drv_c2",nom:"Traoré",actif:true});
  S.assignments.push({id:"as_c1",driver_id:"drv_c1",vehicle_id:null,debut:"2026-01-01"});
  const zs=zonesCirc();o.nz=zs.length;const z0=zs[0].nom,z1=zs[1].nom;
  /* données insuffisantes */
  login("chauffeur","drv_c1");view="p_circuit";render();o.vide=document.body.innerText.includes("Pas encore assez de courses");
  /* validations */
  const err=f=>{try{declarerCourse(f);return null}catch(e){return e.message}};
  o.eZone=err({zone:"Inconnue",montant:2000});o.eMont=err({zone:z0,montant:50});o.eFut=err({zone:z0,montant:2000,t:new Date(Date.now()+36e5).toISOString()});o.eVieux=err({zone:z0,montant:2000,t:new Date(Date.now()-72*36e5).toISOString()});
  const c1=declarerCourse({zone:z0,montant:2500});o.cree=!!c1&&S.courses.some(c=>c.id===c1.id);
  /* retrait : seulement les siennes */
  S.courses.push({id:"crs_autre",driver_id:"drv_c2",zone:z0,montant:1000,t:new Date().toISOString()});
  try{retirerCourse("crs_autre");o.autre=null}catch(e){o.autre=e.message}
  retirerCourse(c1.id);o.retire=!S.courses.some(c=>c.id===c1.id);
  /* ≥30 courses sur 5 jours à l'heure courante → cartes */
  const h=new Date().getHours();S.courses=S.courses.filter(c=>c.id!=="crs_autre");
  for(let i=0;i<40;i++){const d=new Date();d.setDate(d.getDate()-(i%5));d.setHours(h,10+(i%40),0,0);S.courses.push({id:"crs_s"+i,driver_id:i%2?"drv_c1":"drv_c2",zone:i%4?z0:z1,montant:2000+i*10,t:d.toISOString()})}
  render();const txt=document.body.innerText;o.cartes=document.querySelectorAll("#app .card, main .card").length;o.top=txt.includes("1. "+z0)||txt.includes("1. "+z1);o.btn=!!document.querySelector('[data-a="p.course"]');
  /* bureau */
  login("admin");view="circuits";render();o.bureau=document.body.innerText.length>200;
  const tabs=[...document.querySelectorAll(".mtabs a")].map(a=>a.dataset.id);o.tabsMod=tabs.includes("circuits");o.hm=document.querySelectorAll(".hm").length;
  o.rapport=typeof ANGELS_CIRCUIT.rapport==="function";
  /* rôle sans droit */
  login("comptable");o.navCompta=NAV.filter(showNav).some(n=>n.v==="circuits");
  return o});
 chk("CI-1","données insuffisantes : message clair",r.vide===true,r.vide);
 chk("CI-2","validations zone/montant/futur/>48h",!!r.eZone&&!!r.eMont&&!!r.eFut&&!!r.eVieux,JSON.stringify([r.eZone,r.eMont,r.eFut,r.eVieux]));
 chk("CI-3","déclaration créée puis retirée par son auteur",r.cree===true&&r.retire===true,JSON.stringify([r.cree,r.retire]));
 chk("CI-4","retrait d'une course d'un autre chauffeur refusé",/refus/i.test(r.autre||""),r.autre);
 chk("CI-5","40 courses : suggestion classée + bouton déclarer",r.top===true&&r.btn===true,JSON.stringify([r.top,r.btn]));
 chk("CI-6","bureau : écran Circuits rendu",r.bureau===true,r.bureau);
 chk("CI-7","aucune erreur de script",!E.length,E[0]);
 await p.evaluate(()=>{ME=S.users.find(x=>x.role==="admin");view="circuits";render()});await p.screenshot({path:process.env.CAPT||"/tmp/transport-circuits.png"});
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await b.close();srv.close();process.exit(ko?1:0)})();
