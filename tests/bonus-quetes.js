/* Bonus de zones chaudes et quêtes : règles horaires, figé à la livraison, quête acquise une fois par période, paiement caisse, publication au livreur.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/bonus-quetes.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":f.endsWith(".html")?"text/html; charset=utf-8":f.endsWith(".js")?"application/javascript":"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push("D:"+e.message));D.on("dialog",d=>d.accept());await D.goto(base+"/distribution.html");await D.waitForTimeout(700);
 await D.evaluate(()=>{window.__as_=(r,f)=>{const m=ME;ME=S.users.find(u=>u.role===r&&u.actif);try{return f()}finally{ME=m}};window.__P=c=>S.produits.find(p=>p.code===c);
  window.__mk=L=>__as_("admin",()=>creerCmd({client_id:S.clients[0].id,adr:Object.assign({},S.clients[0].adresses[0]),lignes:L,frais:2000,remise:0,paiement:"livraison",mode:"Espèces",priorite:"normale",canal:"Téléphone",confirmer:true}));
  window.__prete=c=>__as_("admin",()=>{setStatut(c,"preparation");return marquerPrete(c)});window.__run=(c,lv)=>__as_("admin",()=>{const l=affecter(c,lv.id,"");accepter(l);priseEnCharge(l,1);demarrer(l);return l})});
 const r=await D.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const lv=S.livreurs[0],o={};const z=S.config.zones[0].nom;
  const lundi18=new Date(2026,9,19,18,0),samedi18=new Date(2026,9,24,18,0),lundi21=new Date(2026,9,19,21,0);
  S.config.bonus_zones=[{id:"b1",zone:z,jours:[1,2,3,4,5],debut:"17:00",fin:"20:00",montant:500,actif:true},{id:"b2",zone:"*",jours:[1,2,3,4,5,6,0],debut:"17:00",fin:"19:00",montant:300,actif:true},{id:"b3",zone:"*",jours:[1],debut:"22:00",fin:"02:00",montant:200,actif:true}];
  o.regles=bonusMontant(z,lundi18)===500&&bonusMontant(z,samedi18)===300&&bonusMontant(z,lundi21)===0&&bonusMontant("Autre",lundi18)===300&&bonusMontant(z,new Date(2026,9,19,23,30))===200&&bonusMontant(z,new Date(2026,9,19,1,0))===0;
  /* livraison réelle : le bonus est figé à la confirmation */
  S.config.bonus_zones=[{id:"b1",zone:z,jours:[0,1,2,3,4,5,6],debut:"00:00",fin:"23:59",montant:500,actif:true}];S.config.quetes=[{id:"q1",nom:"2 livraisons dans la journée",periode:"jour",cible:2,zone:"*",montant:1000,actif:true},{id:"q2",nom:"Inactive",periode:"jour",cible:1,zone:"*",montant:9999,actif:false}];S.quetes_gains=[];S.paie=S.paie.filter(p=>p.livreur_id!==lv.id);S.livraisons=S.livraisons.filter(l=>l.livreur_id!==lv.id);
  const liv1=(code)=>{const c=__mk([{produit_id:__P(code).id,qte:1,pu:__P(code).prix}]);c.adr.zone=z;__prete(c);const l=__run(c,lv);ME=S.users.find(u=>u.id===lv.user_id);const r=confirmer(l,{code:l.code,montant:l.montant_attendu,mode:"Espèces",recu_par:"Client"});ME=S.users.find(u=>u.role==="admin");return{r,l}};
  const a=liv1("P-EAU");o.fige=a.r===true&&a.l.bonus_zone===500;
  S.config.bonus_zones[0].montant=900;o.immuable=a.l.bonus_zone===500;
  o.q1=S.quetes_gains.length===0;const b2=liv1("P-HUI");o.q2=S.quetes_gains.length===1&&S.quetes_gains[0].montant===1000&&S.quetes_gains[0].quete_id==="q1";
  queteTick();queteTick();o.unique=S.quetes_gains.length===1;
  o.total=bonusZoneAcquis(lv.id)===500+900&&quetesAcquises(lv.id)===1000&&bonusReste(lv.id)===2400;
  /* paiement */
  const av=commPayee(lv.id);view="finance";ui={fin:"bonus"};const h=VIEWS.finance();o.tab=/🔥 Bonus &amp; quêtes|🔥 Bonus & quêtes/.test(h)&&/Zones chaudes/.test(h)&&/Progression en cours/.test(h);
  ACT.bonusPayer(lv.id);const f=document.getElementById("mf");f.querySelector("[name=m]").value="1400";f.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));
  o.pay=bonusPaye(lv.id)===1400&&bonusReste(lv.id)===1000&&commPayee(lv.id)===av;
  /* publication */
  lv.ident_serveur="t.lv";const M=passStatsMissions().find(x=>x.livreur_ref===lv.id).payload;o.pub=M.bonus&&M.bonus.boosts.length===1&&M.bonus.quetes.length===1&&M.bonus.quetes[0].fait===true&&M.bonus.reste===1000&&JSON.stringify(passStatsMissions())===JSON.stringify(passStatsMissions());o.M=M.bonus;
  return o});
 chk("BQ-1","règles : jour/heure, zone ou toutes zones, le plus élevé gagne, fenêtre de nuit",r.regles,JSON.stringify(r));
 chk("BQ-2","bonus figé sur la livraison (500 F) et inchangé si la règle change",r.fige&&r.immuable,JSON.stringify(r));
 chk("BQ-3","quête : acquise à la 2e livraison, une seule fois par période, quête inactive ignorée",r.q1&&r.q2&&r.unique,JSON.stringify(r));
 chk("BQ-4","totaux et onglet « Bonus & quêtes »",r.total&&r.tab,JSON.stringify(r));
 chk("BQ-5","paiement caisse (type bonus) hors commissions",r.pay,JSON.stringify(r));
 chk("BQ-6","publication au livreur (zones chaudes, quêtes, reste), contenu stable",r.pub,JSON.stringify(r.M));
 /* livreur */
 const L=await ctx.newPage();L.on("pageerror",e=>errs.push("L:"+e.message));await L.goto(base+"/livreur.html");await L.waitForTimeout(600);
 const v=await L.evaluate(async bonus=>{const o={};user={id:"u"};moi={nom:"T",livreur_ref:"l1"};const pad=n=>String(n).padStart(2,"0"),d=new Date();
  bonus.boosts=[{zone:"Cocody",jours:[0,1,2,3,4,5,6],debut:"00:00",fin:"23:59",montant:500}];
  STATS={livraison_ref:"stats:l1",statut:"stats",maj_le:new Date().toISOString(),payload:{p:{j:{gains:0},s7:{gains:0},m30:{gains:0},mois:{gains:0}},jours7:[],bonus}};
  missions=[{livraison_ref:"a",commande_ref:"CMD-1",statut:"acceptee",payload:{numero:"CMD-1",client_nom:"C",adr:{zone:"Cocody",quartier:"Angré"},lignes:[],montant_attendu:0}}];
  PAGE="cours";vueMissions();const h1=document.body.innerText;o.bandeau=/Zones chaudes en ce moment/.test(h1)&&/\+500/.test(h1);o.carte=/Zone chaude : \+500/.test(h1);
  PAGE="gains";vueMissions();const h2=document.body.innerText;o.page=/Mes quêtes/.test(h2)&&/2 \/ 2/.test(h2)&&/Bonus gagnés/.test(h2);return o},r.M);
 chk("BQ-7","app livreur : bandeau zones chaudes, badge sur la course, page quêtes et bonus",v.bandeau&&v.carte&&v.page,JSON.stringify(v));
 chk("BQ-8","aucune erreur JS",errs.length===0,errs.join("|"));
 console.log("RÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
