/* Planning (créneaux réservables) et pauses : règles de réservation, annulation, pause limitée, affectation bloquée, passerelle, app livreur.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/planning-pauses.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":f.endsWith(".html")?"text/html; charset=utf-8":f.endsWith(".js")?"application/javascript":"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push("D:"+e.message));D.on("dialog",d=>d.accept());await D.goto(base+"/distribution.html");await D.waitForTimeout(700);
 const r=await D.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const A=S.livreurs[0],B=S.livreurs[1],o={},err=f=>{try{f();return null}catch(e){return e.message}};
  const dem=ymd(new Date(Date.now()+864e5)),jr=plJour(dem),tous=[0,1,2,3,4,5,6];
  S.config.planning={actif:true,annulation_h:2,ouverture_j:7,pause_max_min:60,exiger:false,creneaux:[{id:"m",nom:"Matin",jours:tous,debut:"07:00",fin:"13:00",capacite:1},{id:"mm",nom:"Mi-matinée",jours:tous,debut:"10:00",fin:"15:00",capacite:5},{id:"s",nom:"Soir",jours:tous,debut:"14:00",fin:"20:00",capacite:5},{id:"nuit",nom:"Nuit",jours:[jr],debut:"21:00",fin:"06:00",capacite:5}]};
  S.reservations=[];S.pauses=[];S.livraisons=S.livraisons.filter(l=>l.livreur_id!==A.id&&l.livreur_id!==B.id);A.pause=null;B.pause=null;
  o.res=err(()=>plReserver(A.id,"m",dem))===null&&plPlaces(plCren("m"),dem)===0;
  o.complet=/complet/.test(err(()=>plReserver(B.id,"m",dem))||"");
  o.doublon=/déjà/.test(err(()=>plReserver(A.id,"m",dem))||"");
  o.chevauche=/chevauche/.test(err(()=>plReserver(A.id,"mm",dem))||"");
  o.ok2=err(()=>plReserver(A.id,"s",dem))===null;                          /* 14h–20h ne chevauche pas 07h–13h */
  o.loin=/jusqu'à/.test(err(()=>plReserver(A.id,"s",ymd(new Date(Date.now()+20*864e5))))||"");
  o.passe=/terminé|jusqu'à/.test(err(()=>plReserver(B.id,"m",ymd(new Date(Date.now()-864e5))))||"");
  o.tard=/Annulation impossible/.test(err(()=>plAnnuler(A.id,"m",dem,false))||"")===(plDeb(plCren("m"),dem)-Date.now()<2*36e5);
  o.annul=err(()=>plAnnuler(A.id,"s",dem,false))===null&&plResas("s",dem).length===0;
  /* présence dans un créneau (nuit : 21h→6h, créneau d'hier encore actif à 3h) */
  const hier=ymd(Date.now()-864e5);S.reservations.push({id:"rn",livreur_id:B.id,creneau_id:"nuit",date:hier,statut:"reservee"});S.config.planning.creneaux.find(c=>c.id==="nuit").jours=tous;
  o.nuit=plTravail(B,new Date(hier+"T23:00:00").getTime())===true&&plTravail(B,new Date(ymd(Date.now())+"T03:00:00").getTime())===true&&plTravail(B,new Date(ymd(Date.now())+"T08:00:00").getTime())===false;
  /* pauses */
  o.pause=err(()=>pauseDemarrer(A,30))===null&&!!lvPause(A)&&pauseJour(A.id)===30;
  o.deja=/déjà/.test(err(()=>pauseDemarrer(A,10))||"");pauseReprendre(A);o.reprise=!lvPause(A);
  S.pauses.push({id:"h1",livreur_id:A.id,debut:new Date(Date.now()-50*60000).toISOString(),fin:new Date(Date.now()-10*60000).toISOString(),fin_reelle:null,min:40});o.max=/limitée/.test(err(()=>pauseDemarrer(A,30))||"")&&err(()=>pauseDemarrer(A,15))===null;pauseReprendre(A);
  /* affectation bloquée en pause */
  const c=S.commandes.find(x=>x.statut==="prete")||(()=>{const p=S.produits[0];const k=creerCmd({client_id:S.clients[0].id,adr:Object.assign({},S.clients[0].adresses[0]),lignes:[{produit_id:p.id,qte:1,pu:p.prix}],frais:2000,remise:0,paiement:"livraison",mode:"Espèces",priorite:"normale",canal:"Téléphone",confirmer:true});setStatut(k,"preparation");marquerPrete(k);return k})();
  B.pause={id:"x",debut:now(),fin:new Date(Date.now()+30*60000).toISOString()};let t="";toast=(m)=>{t=m};o.affPause=affecter(c,B.id,"")===false&&/en pause/.test(t);B.pause=null;
  S.config.planning.exiger=true;S.reservations=S.reservations.filter(x=>x.livreur_id!==B.id);o.affExiger=affecter(c,B.id,"")===false&&/créneau réservé/.test(t);S.config.planning.exiger=false;
  /* passerelle */
  const ev=(d)=>({livraison_ref:"stats:"+B.id,livreur_ref:B.id,type:"incident",donnees:{nature:"PLANNING",description:d}});
  S.reservations=[];o.pgRes=passAppliquer(ev("RES|s|"+dem))===""&&plResas("s",dem).length===1;o.pgRef=passAppliquer(ev("RES|s|"+dem))!=="";
  o.pgPause=passAppliquer(ev("PAUSE|20"))===""&&!!lvPause(B);passAppliquer(ev("REPRISE"));o.pgRep=!lvPause(B);
  /* publication + onglet */
  B.ident_serveur="t.b";const M=passStatsMissions().find(x=>x.livreur_ref===B.id).payload.planning;o.pub=M.actif&&M.jours.length>=1&&M.pause_max_min===60&&JSON.stringify(passStatsMissions())===JSON.stringify(passStatsMissions());o.M=M.jours.length;
  view="livraisons";ui={cdt:"pla"};const h=VIEWS.livraisons();o.tab=/Planning des livreurs/.test(h)&&/Assiduité du mois/.test(h)&&/Créneaux/.test(h);
  return o});
 const clesX=["res","complet","doublon","chevauche","ok2","loin","passe","tard","annul","nuit","pause","deja","reprise","max","affPause","affExiger","pgRes","pgRef","pgPause","pgRep","pub","tab"];
 chk("PL-1","réservation : places, complet, doublon, chevauchement, trop loin, passé",["res","complet","doublon","chevauche","ok2","loin","passe"].every(k=>r[k]),JSON.stringify(r));
 chk("PL-2","annulation (délai) et créneau de nuit à cheval sur deux jours",r.tard&&r.annul&&r.nuit,JSON.stringify(r));
 chk("PL-3","pause : démarrage, double pause refusée, reprise, plafond journalier",r.pause&&r.deja&&r.reprise&&r.max,JSON.stringify(r));
 chk("PL-4","affectation bloquée pendant la pause et hors créneau (si exigé)",r.affPause&&r.affExiger,JSON.stringify(r));
 chk("PL-5","passerelle : réservation, doublon refusé, pause et reprise du livreur",r.pgRes&&r.pgRef&&r.pgPause&&r.pgRep,JSON.stringify(r));
 chk("PL-6","chiffres publiés au livreur (stables) et onglet « Planning » du Centre",r.pub&&r.tab,JSON.stringify(r.M));
 /* livreur */
 const L=await ctx.newPage();L.on("pageerror",e=>errs.push("L:"+e.message));await L.goto(base+"/livreur.html");await L.waitForTimeout(600);
 const v=await L.evaluate(async ()=>{const o={};user={id:"u"};moi={nom:"T",livreur_ref:"l1"};const ymdl=ymdL;
  const dem=ymdl(Date.now()+864e5);
  const P={actif:true,annulation_h:2,pause_max_min:60,pause_jour:0,pause:null,jours:[{date:dem,creneaux:[{cid:"s",nom:"Soir",debut:"14:00",fin:"20:00",places:3,reserve:false,statut:null},{cid:"m",nom:"Matin",debut:"07:00",fin:"13:00",places:0,reserve:true,statut:"reservee"}]}]};
  STATS={livraison_ref:"stats:l1",statut:"stats",maj_le:new Date(Date.now()-60000).toISOString(),payload:{p:{j:{},s7:{},m30:{},mois:{}},jours7:[],planning:P,regles:{vigilance:{actif:true,debut:"00:00",fin:"23:59",inactif_min:5,reponse_s:1},dispo:true}}};missions=[];
  PAGE="plan";vueMissions();const h=document.body.innerText;o.page=/Planning et pauses/.test(h)&&/Réserver ce créneau/.test(h)&&/Annuler ma réservation/.test(h)&&/Il vous reste 60 min/.test(h);
  let envoi=[];window.envoyer=async(r,t,d)=>{envoi.push(d);return{ok:true}};
  await plReserverApp("RES","s",dem);o.env=envoi.length===1&&envoi[0].nature==="PLANNING"&&envoi[0].description==="RES|s|"+dem;o.att=/En attente de confirmation/.test(document.body.innerText);
  await plReserverApp("RES","s",dem);o.unique=envoi.length===1;
  /* pause */
  envoi=[];const okp=await pauseApp(30);o.pause=okp===true&&!!pauseActive()&&envoi[0].description==="PAUSE|30"&&/En pause/.test(document.body.innerText);
  VIG.act=Date.now()-60*60000;VIG.open=false;vigTick();o.vigPause=!document.getElementById("vig");
  envoi=[];await reprendreApp();o.rep=!pauseActive()&&envoi[0].description==="REPRISE";
  /* limite + course en cours */
  STATS.payload.planning.pause_jour=50;o.lim=(await pauseApp(30))===false&&!pauseActive();STATS.payload.planning.pause_jour=0;missions=[{livraison_ref:"a",commande_ref:"C",statut:"en_cours",payload:{adr:{}}}];o.cours=(await pauseApp(15))===false;
  /* vigilance seulement dans un créneau réservé */
  missions=[];ferme();ouvert=null;VIG.open=false;VIG.act=Date.now()-60*60000;vigTick();o.horsCreneau=!document.getElementById("vig");
  const now=new Date(),hh=n=>String(n).padStart(2,"0");P.jours=[{date:ymdl(now),creneaux:[{cid:"x",nom:"Maintenant",debut:hh(Math.max(0,now.getHours()-1))+":00",fin:hh(Math.min(23,now.getHours()+1))+":59",places:0,reserve:true,statut:"reservee"}]}];
  VIG.open=false;VIG.act=Date.now()-60*60000;vigTick();o.dansCreneau=!!document.getElementById("vig");vigFerme();
  return o});
 chk("PL-7","app livreur : page planning, demande de réservation (en attente, sans doublon)",v.page&&v.env&&v.att&&v.unique,JSON.stringify(v));
 chk("PL-8","app livreur : pause (limite, course en cours, vigilance suspendue), reprise",v.pause&&v.vigPause&&v.rep&&v.lim&&v.cours,JSON.stringify(v));
 chk("PL-9","app livreur : vigilance seulement pendant un créneau réservé",v.horsCreneau&&v.dansCreneau,JSON.stringify(v));
 chk("PL-10","aucune erreur JS",errs.length===0,errs.join("|"));
 console.log("RÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
