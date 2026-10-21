/* Application livreur (livreur.html) : SOS, vérification d'inactivité, « Mes gains et ma prime » ; bureau : publication des chiffres et réception du SOS.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/livreur-securite.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":f.endsWith(".html")?"text/html; charset=utf-8":f.endsWith(".js")?"application/javascript":"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:420,height:900}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 /* bureau */
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push("D:"+e.message));D.on("dialog",d=>d.accept());await D.goto(base+"/distribution.html");await D.waitForTimeout(700);
 const pay=await D.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const lv=S.livreurs[0],o={};lv.ident_serveur="t.lv";S.sos=[];
  const M=passStatsMissions(),m=M.find(x=>x.livreur_ref===lv.id),p=m.payload;
  o.cles=!!p.prime&&!!p.argent&&!!p.regles&&Array.isArray(p.prime.comps)&&p.prime.comps.length===6&&p.regles.vitesse_max===60&&!!p.regles.perimetre;
  o.stable=JSON.stringify(passStatsMissions())===JSON.stringify(M);o.leger=JSON.stringify(p).length<9000;o.sansEv=!("ev" in (p.p.mois.vit||{}));
  const e1={livraison_ref:"stats:"+lv.id,livreur_ref:lv.id,type:"incident",donnees:{nature:"SOS",description:"SOS|agression|auto|5.31000,-4.02000|Plus de réponse"}};
  o.sosRet=passAppliquer(e1)==="";const a=sosDuLivreur(lv);o.sos=!!a&&a.type==="agression"&&a.lat===5.31&&/Automatique/.test(a.note);
  passAppliquer(e1);o.unique=S.sos.length===1;o.payload=p;return o});
 chk("LS-1","bureau : chiffres publiés (prime 6 critères, argent, règles), contenu stable et léger",pay.cles&&pay.stable&&pay.leger&&pay.sansEv,JSON.stringify(pay).slice(0,300));
 chk("LS-2","bureau : SOS reçu par la passerelle → alerte ouverte (automatique), sans doublon",pay.sosRet&&pay.sos&&pay.unique,JSON.stringify(pay).slice(0,200));
 /* livreur */
 const L=await ctx.newPage();L.on("pageerror",e=>errs.push("L:"+e.message));await L.goto(base+"/livreur.html");await L.waitForTimeout(600);
 const v=await L.evaluate(async(payload)=>{const o={};user={id:"u"};moi={nom:"Livreur Test",livreur_ref:"l1"};
  STATS={livraison_ref:"stats:l1",statut:"stats",maj_le:new Date().toISOString(),payload};missions=[];
  PAGE="gains";vueMissions();const h=document.body.innerText;o.gains=/Mes gains et ma prime/.test(h)&&/Argent à reverser/.test(h)&&/Ma prime/.test(h)&&/Conduite/.test(h)&&/Montant collecté/.test(h);
  PAGE="cours";MENU=true;vueMissions();o.menu=/Mes gains et ma prime/.test(document.body.innerText);MENU=false;vueMissions();o.btn=!!document.querySelector(".sosb");
  /* SOS : capture de l'appel d'envoi */
  let envoi=null;window.envoyer=async(r,t,d)=>{envoi={r,t,d};return{ok:true}};
  window.posActuelle=async()=>({lat:5.31,lng:-4.02});
  await sosEnvoyer("agression","test",false);o.sos=envoi&&envoi.r==="stats:l1"&&envoi.t==="incident"&&envoi.d.nature==="SOS"&&/^SOS\\|agression\\|manuel\\|5\\.31000,-4\\.02000\\|test$/.test(envoi.d.description);
  /* vigilance */
  ferme();ouvert=null;payload.regles.vigilance={actif:true,debut:"00:00",fin:"23:59",inactif_min:5,reponse_s:1,immobile_min:30};STATS.payload=payload;missions=[];payload.regles.dispo=true;
  VIG.act=Date.now()-6*60000;VIG.open=false;vigTick();o.prompt=!!document.getElementById("vig");
  envoi=null;await new Promise(r=>setTimeout(r,2600));o.auto=!document.getElementById("vig")&&envoi&&/\\|auto\\|/.test(envoi.d.description)&&/ALERTE AUTOMATIQUE/.test(envoi.d.description);
  ferme();ouvert=null;VIG.open=false;VIG.act=Date.now()-6*60000;vigTick();document.getElementById("vig_ok").click();o.ok=!document.getElementById("vig")&&Date.now()-VIG.act<1000;
  return o},pay.payload);
 chk("LS-3","livreur : page « Mes gains et ma prime », entrée de menu, bouton SOS",v.gains&&v.menu&&v.btn,JSON.stringify(v));
 chk("LS-4","livreur : SOS envoyé comme incident « SOS » rattaché au compte (position, type, mode)",v.sos,JSON.stringify(v));
 chk("LS-5","livreur : inactivité → vérification ; sans réponse SOS automatique ; « Je vais bien » ferme",v.prompt&&v.auto&&v.ok,JSON.stringify(v));
 chk("LS-6","aucune erreur JS",errs.length===0,errs.join("|"));
 console.log("RÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
