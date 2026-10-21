/* Alerte moto hors zone : périmètre (centre + rayon), délai, vol possible sans course, historique, acquittement.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/hors-zone.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":f.endsWith(".html")?"text/html; charset=utf-8":f.endsWith(".js")?"application/javascript":"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push(e.message));D.on("dialog",d=>d.accept());await D.goto(base+"/distribution.html");await D.waitForTimeout(700);
 const r=await D.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const lv=S.livreurs[0],o={};
  S.config.perimetre={actif:true,lat:5.3453,lng:-4.0244,rayon_km:40,delai_min:5};S.hz_events=[];S.livraisons=S.livraisons.filter(l=>l.livreur_id!==lv.id);ui.hzSince={};
  const set=(la,ln)=>S.pos[lv.id]={lat:la,lng:ln,acc:10,ts:new Date().toISOString()};
  set(5.35,-4.02);o.dedans=hzTick().length===0&&S.hz_events.length===0;
  set(6.2,-5.5);o.attente=hzTick().length===0;           /* hors zone mais délai pas écoulé */
  ui.hzSince[lv.id]=Date.now()-6*60000;const n=hzTick();o.ouvre=n.length===1&&n[0].mission===false&&/vol de la moto possible/.test(hzMsg(n[0]));
  o.pasdbl=hzTick().length===0&&S.hz_events.length===1;
  o.alerte=alertes().some(a=>/hors de la zone/.test(a.m));
  view="livraisons";ui.cdt="liv";o.sect=/Périmètre de service/.test(VIEWS.livraisons())&&/À vérifier/.test(VIEWS.livraisons());
  ACT.hzAck(S.hz_events[0].id);const ta=document.querySelector("#modal textarea");ta.value="Livreur joint, course autorisée";document.getElementById("mf").dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));
  o.ack=S.hz_events[0].statut==="acquittee"&&!hzOuvertes().length;
  set(5.35,-4.02);hzTick();o.retour=!!S.hz_events[0].fin;
  S.config.perimetre.actif=false;set(7,-6);ui.hzSince[lv.id]=Date.now()-9*60000;o.off=hzTick().length===0;
  return o});
 chk("HZ-1","dans le périmètre : rien ; hors zone : attente du délai",r.dedans&&r.attente,JSON.stringify(r));
 chk("HZ-2","après le délai : alerte unique « vol possible » (sans course), pas de doublon",r.ouvre&&r.pasdbl,JSON.stringify(r));
 chk("HZ-3","liste d'alertes et section du Centre de livraison",r.alerte&&r.sect,JSON.stringify(r));
 chk("HZ-4","vérification avec note, retour en zone clôture l'événement, désactivable",r.ack&&r.retour&&r.off,JSON.stringify(r));
 chk("HZ-5","aucune erreur JS",errs.length===0,errs.join("|"));
 console.log("RÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
