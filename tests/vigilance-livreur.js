/* Vigilance livreur : inactivité en heures de travail -> « Êtes-vous en sécurité ? » -> SOS automatique ; alerte bureau « immobile ».
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/vigilance-livreur.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":f.endsWith(".html")?"text/html; charset=utf-8":f.endsWith(".js")?"application/javascript":"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1000,height:900}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push(e.message));D.on("dialog",d=>d.accept());await D.goto(base+"/distribution.html");await D.waitForTimeout(700);
 const r=await D.evaluate(async()=>{const lv=S.livreurs[0];S.config.vigilance={actif:true,debut:"00:00",fin:"23:59",inactif_min:5,reponse_s:2,immobile_min:5};lv.statut="disponible";S.sos=[];
  ME=S.users.find(u=>u.id===lv.user_id);const o={};
  vigAct=Date.now()-6*60000;vigOpen=false;vigTick();o.prompt=!!document.getElementById("vig");
  document.getElementById("vig_ok").click();o.ferme=!document.getElementById("vig")&&Date.now()-vigAct<1000;
  vigAct=Date.now()-6*60000;vigTick();await new Promise(r=>setTimeout(r,3500));
  const a=sosDuLivreur(lv);o.sos=!!a&&a.type==="autre"&&/ALERTE AUTOMATIQUE/.test(a.note);
  S.config.vigilance.actif=false;S.sos=[];vigAct=Date.now()-60*60000;vigOpen=false;vigTick();o.off=!document.getElementById("vig");
  S.config.vigilance.actif=true;S.config.vigilance.debut="00:00";S.config.vigilance.fin="00:01";const h=new Date();o.hors=vigHeures(new Date(2026,0,1,12,0))===false;
  S.config.vigilance.fin="23:59";ME=S.users.find(u=>u.role==="admin");
  const c=S.commandes[0];S.livraisons=S.livraisons.filter(l=>l.livreur_id!==lv.id);S.livraisons.push({id:"vg1",commande_id:c.id,livreur_id:lv.id,statut:"en_cours"});
  S.pos[lv.id]={lat:5.3,lng:-4,acc:10,ts:new Date().toISOString()};vigImmobiles();ui.immo[lv.id].since=Date.now()-6*60000;
  const im=vigImmobiles();o.immo=im.length===1&&im[0].min>=5;return o});
 chk("VG-1","inactivité : invite « Êtes-vous en sécurité ? », fermée par « Je vais bien »",r.prompt&&r.ferme,JSON.stringify(r));
 chk("VG-2","sans réponse : SOS automatique avec note explicite",r.sos,JSON.stringify(r));
 chk("VG-3","désactivable et limitée aux heures de travail",r.off&&r.hors,JSON.stringify(r));
 chk("VG-4","bureau : livreur immobile en course détecté",r.immo,JSON.stringify(r));
 chk("VG-5","aucune erreur JS",errs.length===0,errs.join("|"));
 console.log("RÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
