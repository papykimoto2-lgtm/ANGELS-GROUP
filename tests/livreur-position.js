/* Position du client pour le livreur : demande facultative (jamais bloquante) au bureau ; position connue → itinéraire direct en mode moto depuis la position du livreur.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/livreur-position.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:420,height:900}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 /* application livreur */
 const L=await ctx.newPage();L.on("pageerror",e=>errs.push("L:"+e.message));await L.goto(base+"/livreur.html");await L.waitForTimeout(600);
 const r=await L.evaluate(async()=>{const mk=(st,gps)=>({livraison_ref:"liv1",commande_ref:"CMD-1",statut:st,payload:{numero:"CMD-1",client_nom:"Client",adr:{zone:"Yopougon",quartier:"Terminus 27",gps:gps||null},lignes:[{desig:"Chaussure",qte:1}],montant_attendu:7000}});
  const o={};localStorage.removeItem(LS.p);
  const sans=carte(mk("acceptee"));o.sansDemande=/Demander la position du client/.test(sans);o.sansItin=/Itinéraire vers la zone/.test(sans)&&/travelmode=two-wheeler/.test(sans);o.demarrer=/data-a="demarrer"/.test(sans)||/prise/.test(sans);
  const enc=carte(mk("en_cours"));o.encours=/Demander la position du client/.test(enc)&&/data-a="confirmer"/.test(enc);
  const avec=carte(mk("en_cours",{lat:5.3456,lng:-4.0234}));o.avec=/Itinéraire vers la position du client/.test(avec)&&/destination=5\.3456,-4\.0234&amp;?travelmode=two-wheeler|destination=5\.3456,-4\.0234&travelmode=two-wheeler/.test(avec)&&!/Demander la position/.test(avec)&&/dir_action=navigate/.test(avec);
  let appels=[];const oe=window.envoyer;window.envoyer=async(rf,t,d,m)=>{appels.push({rf,t,d});return{ok:true}};missions=[mk("acceptee")];ACT.posclient("liv1");await new Promise(r=>setTimeout(r,100));window.envoyer=oe;
  o.appel=appels.length===1&&appels[0].t==="incident"&&appels[0].d.nature==="Position du client";o.marque=posDem("liv1")>0;
  const apres=carte(mk("acceptee"));o.apres=/Position demandée au bureau/.test(apres)&&!/data-a="posclient"/.test(apres)&&/Vous pouvez partir sans attendre/.test(apres);
  const P=JSON.parse(localStorage.getItem(LS.p));P.liv1=Date.now()-20*60000;localStorage.setItem(LS.p,JSON.stringify(P));o.redem=/Redemander/.test(carte(mk("acceptee")));
  const refus=window.envoyer;window.envoyer=async()=>undefined;localStorage.removeItem(LS.p);await ACT.posclient("liv9");window.envoyer=refus;o.pasMarque=posDem("liv9")===0;
  return o});
 chk("LP-1","sans position connue : « Demander la position du client » + itinéraire vers la zone ; la course (accepter/démarrer/confirmer) n'est jamais bloquée",r.sansDemande&&r.sansItin&&r.encours,JSON.stringify(r));
 chk("LP-2","position connue : itinéraire direct vers les coordonnées du client, mode moto, navigation depuis la position du livreur (meilleur trajet choisi par l'application de cartes)",r.avec,JSON.stringify(r));
 chk("LP-3","la demande part au bureau (action « incident / Position du client »), est mémorisée, ne s'affiche plus en double (« Redemander » après 15 min) et n'est pas mémorisée si l'envoi échoue",r.appel&&r.marque&&r.apres&&r.redem&&r.pasMarque,JSON.stringify(r));
 /* bureau */
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push("D:"+e.message));D.on("dialog",d=>d.accept());await D.goto(base+"/distribution.html");await D.waitForTimeout(600);
 const d=await D.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const lv=S.livreurs.find(x=>x.user_id),cm=S.commandes.find(c=>c.client_id&&c.adr);const l={id:"lt1",commande_id:cm.id,livreur_id:lv.id,statut:"en_cours",affectee_at:new Date().toISOString(),montant_attendu:0};S.livraisons.push(l);
  S.rappels=[];const n0=S.incidents.length;const ev={type:"incident",livraison_ref:"lt1",livreur_ref:lv.id,donnees:{nature:"Position du client",description:"x"}};
  const r1=passAppliquer(ev),r2=passAppliquer(ev);const o={r1,r2,nb:S.rappels.length,typ:S.rappels[0]&&S.rappels[0].type,inc:S.incidents.length-n0};
  view="notifs";const h=VIEWS.notifs();o.btn=/data-act="posLien"/.test(h)&&/Demandes des livreurs/.test(h);
  ACT.posLien(S.rappels[0].id);o.modale=/Portail client/.test(document.getElementById("modal").innerHTML)&&/#\/(localisation|position|geo)|portail/.test(document.getElementById("modal").innerHTML);
  const ev2={type:"incident",livraison_ref:"lt1",livreur_ref:lv.id,donnees:{nature:"Accident",description:"pneu"}};const r3=passAppliquer(ev2);o.vrai=S.incidents.length-n0;o.r3=r3;
  return o});
 chk("LP-4","bureau : la demande du livreur devient une demande « position » dans Notifications (une seule, pas un incident) avec le bouton « Envoyer le lien de position » qui ouvre le lien de partage au client",d.r1===""&&d.r2===""&&d.nb===1&&d.typ==="position"&&d.inc===0&&d.btn&&d.modale,JSON.stringify(d));
 chk("LP-5","un vrai incident du livreur reste un incident",d.vrai===1&&d.r3==="",JSON.stringify(d));
 chk("LP-6","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
