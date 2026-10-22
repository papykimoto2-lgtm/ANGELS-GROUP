/* CRM central du hub : fiche unique par personne (fusion par téléphone), indicateurs, segments, relances, opposition, accès protégé.
   Usage : NODE_OPTIONS="--require $PWD/tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/crm-central.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1200,height:1000}}),errs=[];let ok=0,ko=0;
 const t=(id,l,r)=>{if(r===true){ok++;console.log("PASS",id,l)}else{ko++;console.log("FAIL",id,l,"→",r)}};
 const page=async u=>{const p=await ctx.newPage();p.on("pageerror",e=>errs.push(u+" : "+e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/"+u);await p.waitForTimeout(500);return p};
 const DEMO="Demo@Angels2026";
 // initialisation des trois applications (données de démonstration) puis fiche commune à Distributions et Agro
 const pd=await page("distribution.html"),pt=await page("transport.html"),pa=await page("agro.html");await pt.close();
 const ref=await pd.evaluate(()=>{const c=S.clients.find(x=>!x.divers&&S.commandes.some(m=>m.client_id===x.id&&m.statut==="livree"))||S.clients.find(x=>!x.divers);
  const ca=S.commandes.filter(m=>m.client_id===c.id&&m.statut==="livree").reduce((a,m)=>a+m.total,0),du=S.commandes.filter(m=>m.client_id===c.id&&m.statut==="livree").reduce((a,m)=>a+soldeCmd(m),0);
  return{id:c.id,nom:c.nom,tel:c.tel,ca,du,nb:S.commandes.filter(m=>m.client_id===c.id&&m.statut==="livree").length,divers:S.clients.filter(x=>x.divers).length}});
 // un client Agro avec le MÊME téléphone (écrit autrement) et un vente validée
 await pa.evaluate(tel=>{const G=JSON.parse(localStorage.getItem("angels_agro_v1"));G.clients.push({id:"cl-crm-1",nom:"Mariam Boutique",tel:"+225 "+tel,type:"detaillant",ville:"Cocody"});
  G.ventes.push({id:"vt-crm-1",numero:"FAC-CRM-1",date:new Date().toISOString().slice(0,10),client_id:"cl-crm-1",lignes:[],total:40000,echeance:"",statut:"valide",par:"test"});
  G.clients.push({id:"cl-crm-x",nom:"<img src=x onerror=window.__xss=1>",tel:"0101010101",type:"restaurant",ville:"Yop"});
  G.clients.push({id:"cl-crm-f",nom:"=CMD()",tel:"0102030405",type:"restaurant",ville:"Yop"});
  localStorage.setItem("angels_agro_v1",JSON.stringify(G))},ref.tel);
 await pd.close();await pa.close();
 const h=await page("crm.html");
 // 1. accès verrouillé
 t("CRM-1","sans connexion : aucun contact visible, formulaire d'accès",(await h.$("#gate"))!==null&&(await h.$("table"))===null?true:"données visibles");
 const login=async pw=>{await h.fill("#gate [name=pwd]",pw);await h.click("#gate button[type=submit]");await h.waitForTimeout(800)};
 await login("faux");t("CRM-2","mot de passe faux : refusé",(await h.$("#gate"))!==null&&/incorrect/.test(await h.$eval("#gate",e=>e.innerText))?true:"accepté");
 for(let i=0;i<4;i++)await login("faux");await login(DEMO);t("CRM-3","5 essais faux : blocage temporaire même avec le bon mot de passe",(await h.$("#gate"))!==null&&/patientez/.test(await h.$eval("#gate",e=>e.innerText))?true:"pas de blocage");
 await h.evaluate(()=>{TRY={n:0,until:0}});await h.reload();await h.waitForTimeout(400);await login(DEMO);
 t("CRM-4","administrateur + bon mot de passe : accès au CRM",(await h.$("#gate"))===null&&(await h.$$(".tab")).length>=7?true:"verrou persistant");
 // 2. fusion par téléphone
 const fus=await h.evaluate(tel=>{const L=ANGELS_CRM.contacts(),k=ANGELS_CRM.cleTel(tel),f=L.find(x=>x.cle===k);return f?{apps:Object.keys(f.apps).sort(),noms:f.noms,nb:L.filter(x=>x.cle===k).length}:null},ref.tel);
 t("CRM-5","même téléphone dans Distributions et Agro (formats différents) : une seule fiche",fus&&fus.nb===1&&fus.apps.join()==="agro,distribution"&&fus.noms.length===2?true:JSON.stringify(fus));
 const m=await h.evaluate(tel=>{const f=ANGELS_CRM.contacts().find(x=>x.cle===ANGELS_CRM.cleTel(tel));return{ca:f.ca,enc:f.encours,n:f.achats.length}},ref.tel);
 t("CRM-6","chiffre d'affaires = livraisons Distributions + ventes Agro",m.ca===ref.ca+40000&&m.n===ref.nb+1?true:JSON.stringify(m)+" attendu "+(ref.ca+40000));
 t("CRM-7","encours = solde des commandes livrées + facture Agro impayée",m.enc===ref.du+40000?true:m.enc+" ≠ "+(ref.du+40000));
 const dv=await h.evaluate(()=>ANGELS_CRM.contacts().some(f=>f.sources.some(s=>s.type==="client"&&s.app==="distribution"&&false)));
 const nbDiv=await h.evaluate(()=>ANGELS_CRM.contacts().divers);t("CRM-8","les clients « divers » restent hors du CRM (comptés à part)",nbDiv===ref.divers?true:nbDiv+" ≠ "+ref.divers);
 // 3. segments : le temps passe → à risque puis dormant
 const sg=await h.evaluate(tel=>{const k=ANGELS_CRM.cleTel(tel),r={};for(const j of[0,100,300]){r[j]=ANGELS_CRM.contacts(Date.now()+j*864e5).find(x=>x.cle===k).seg}return r},ref.tel);
 t("CRM-9","segments selon l'ancienneté du dernier achat (actif/nouveau → à risque → dormant)",["risque"].includes(sg[100])&&sg[300]==="dormant"&&sg[0]!=="dormant"?true:JSON.stringify(sg));
 // 4. interactions / tâches
 const cle=await h.evaluate(tel=>ANGELS_CRM.cleTel(tel),ref.tel);
 const e1=await h.evaluate(c=>{try{ANGELS_CRM.ajouterInteraction("test",c,"appel","ok");return"accepté"}catch(e){return e.message}},cle);t("CRM-10","échange trop court refusé",/3 caractères/.test(e1)?true:e1);
 await h.evaluate(c=>{ANGELS_CRM.ajouterInteraction("test",c,"appel","Rappelé : veut 5 cartons vendredi");ANGELS_CRM.ajouterTache("test",c,"Livrer 5 cartons","2020-01-01")},cle);
 await h.reload();await h.waitForTimeout(400);
 const pers=await h.evaluate(c=>{const f=ANGELS_CRM.contacts().find(x=>x.cle===c);return{n:f.nb_inter,h:ANGELS_CRM.historique(f).some(x=>/5 cartons/.test(x.lib)),ret:ANGELS_CRM.pilotage(ANGELS_CRM.contacts()).taches_retard}},cle);
 t("CRM-11","échange et tâche conservés après rechargement (session toujours ouverte), tâche en retard comptée",pers.n===1&&pers.h&&pers.ret===1?true:JSON.stringify(pers));
 // 5. interface : fiche 360
 await h.click('[data-a=tab][data-v=con]');await h.fill("#q","mariam");await h.waitForTimeout(300);
 const ligne=await h.$$eval(".cl",r=>r.map(x=>x.innerText));t("CRM-12","recherche par nom : la fiche fusionnée apparaît avec ses deux applications",ligne.filter(x=>/Distributions/.test(x)&&/Agro/.test(x)).length===1?true:JSON.stringify(ligne));
 await h.click(".cl");await h.waitForTimeout(200);const fi=await h.$eval("#app",e=>e.innerText);
 t("CRM-13","fiche 360° : indicateurs, historique des achats et échange noté",/Panier moyen/.test(fi)&&/FAC-CRM-1/.test(fi)&&/5 cartons/.test(fi)?true:fi.slice(0,300));
 // 6. opposition
 const rel0=await h.evaluate(()=>{const N=Date.now()+300*864e5;return ANGELS_CRM.relances(ANGELS_CRM.contacts(N),N).length});
 await h.evaluate(c=>ANGELS_CRM.opposer("test",c,true),cle);
 const rel1=await h.evaluate(()=>{const N=Date.now()+300*864e5,L=ANGELS_CRM.contacts(N);return{n:ANGELS_CRM.relances(L,N).length,csv:ANGELS_CRM.exportCsv(L,true),tout:ANGELS_CRM.exportCsv(L,false)}});
 t("CRM-14","contact opposé à la prospection : exclu des relances",rel1.n===rel0-1?true:rel0+" → "+rel1.n);
 t("CRM-15","export marketing sans le contact opposé, export complet avec",!/Mariam Boutique/.test(rel1.csv)&&/Mariam/.test(rel1.tout)?true:"opposition ignorée");
 t("CRM-16","export CSV : formule neutralisée (« =CMD() » devient du texte)",/"'=CMD\(\)"/.test(rel1.tout)&&!/;"=CMD/.test(rel1.tout)&&!/^"=CMD/m.test(rel1.tout)?true:"formule non neutralisée");
 // 7. relances : message WhatsApp prêt
 const rl=await h.evaluate(()=>{const L=ANGELS_CRM.contacts(Date.now()+300*864e5),R=ANGELS_CRM.relances(L,Date.now()+300*864e5);return R.length?{lien:R[0].lien,msg:R[0].msg,motif:R[0].motif}:null});
 t("CRM-17","relances : lien WhatsApp avec numéro international et message préparé",rl&&/^https:\/\/wa\.me\/225\d{10}\?text=/.test(rl.lien)&&rl.msg.length>20?true:JSON.stringify(rl));
 await h.evaluate(c=>{const L=ANGELS_CRM.contacts(Date.now()+300*864e5),R=ANGELS_CRM.relances(L,Date.now()+300*864e5);ANGELS_CRM.marquerRelance("test",R[0].f.cle,R[0].motif,new Date(Date.now()+300*864e5).toISOString())},cle);
 const rl2=await h.evaluate(()=>{const L=ANGELS_CRM.contacts(Date.now()+300*864e5);return ANGELS_CRM.relances(L,Date.now()+300*864e5).length});
 t("CRM-18","contact relancé : retiré de la liste pendant 14 jours",rl2===rel1.n-1?true:rel1.n+" → "+rl2);
 // 8. opportunités
 const op=await h.evaluate(()=>{const o=ANGELS_CRM.creerOpp("test",{nom:"Supérette Kouassi",valeur:150000,source:"Portail"});let e1="";try{ANGELS_CRM.deplacerOpp("test",o.id,"perdu","")}catch(e){e1=e.message}
  ANGELS_CRM.deplacerOpp("test",o.id,"devis");ANGELS_CRM.deplacerOpp("test",o.id,"perdu","Trop cher");const P=ANGELS_CRM.pilotage(ANGELS_CRM.contacts());return{e1,etape:ANGELS_CRM.etat().opps[0].etape,conv:P.conversion,ouvertes:P.pipeline_n}});
 t("CRM-19","opportunité perdue : motif obligatoire, taux de conversion calculé",/Motif/.test(op.e1)&&op.etape==="perdu"&&op.conv===0&&op.ouvertes===0?true:JSON.stringify(op));
 const neg=await h.evaluate(()=>{try{ANGELS_CRM.creerOpp("t",{nom:"X Y",valeur:-5});return"accepté"}catch(e){return e.message}});t("CRM-20","valeur négative refusée",/négative/.test(neg)?true:neg);
 // 9. sécurité d'affichage
 await h.click('[data-a=tab][data-v=con]');await h.fill("#q","img");await h.waitForTimeout(300);
 const xss=await h.evaluate(()=>({x:window.__xss||0,img:document.querySelectorAll("#app img").length,txt:document.getElementById("app").innerText.includes("<img src=x")}));
 t("CRM-21","nom malveillant affiché comme texte (aucun script exécuté)",!xss.x&&!xss.img&&xss.txt?true:JSON.stringify(xss));
 // 10. journal d'audit, réglages
 const au=await h.evaluate(()=>ANGELS_CRM.etat().audit.map(a=>a.action));t("CRM-22","chaque action est tracée (échange, tâche, opposition, relance, opportunité)",["Échange noté","Tâche créée","Opposition à la prospection","Relance","Opportunité créée"].every(a=>au.includes(a))?true:au.join());
 const rg=await h.evaluate(()=>{let e="";try{ANGELS_CRM.reglages("t",{nouveau_j:30,fidele_n:3,actif_j:200,risque_j:100,vip_f:500000,impaye_j:30})}catch(x){e=x.message}return e});t("CRM-23","seuils incohérents (actif ≥ à risque) refusés",/plus court/.test(rg)?true:rg);
 // 11. qualité
 const q=await h.evaluate(()=>{const Q=ANGELS_CRM.qualite(ANGELS_CRM.contacts());return{multi:Q.multi_apps.length,diff:Q.noms_differents.length}});t("CRM-24","qualité : fiche multi-applications et noms différents pour un même numéro signalés",q.multi>=1&&q.diff>=1?true:JSON.stringify(q));
 // 12. verrouillage
 await h.click("#lock");await h.waitForTimeout(200);t("CRM-25","« Verrouiller » ferme l'accès",(await h.$("#gate"))!==null&&(await h.$("table"))===null?true:"toujours ouvert");
 // 13. un rôle non autorisé ne figure pas dans la liste
 const roles=await h.$$eval("#gate option",o=>o.map(x=>x.textContent));t("CRM-26","seuls administrateur, direction et commercial peuvent ouvrir le CRM",roles.length>0&&roles.every(x=>/\((admin|direction|commercial)\)/.test(x))?true:roles.join("|"));
 // 14. hub
 const hub=await page("index.html");t("CRM-27","le hub propose la carte « CRM du groupe »",(await hub.$('a[href="crm.html"]#c-crm'))!==null?true:"carte absente");
 const pil=await page("crm.html");await pil.fill("#gate [name=pwd]",DEMO);await pil.click("#gate button[type=submit]");await pil.waitForTimeout(800);
 const dash=await pil.$eval("#app",e=>e.innerText);t("CRM-28","pilotage : indicateurs affichés sans NaN / undefined",/Contacts uniques/.test(dash)&&!/NaN|undefined/.test(dash)?true:dash.slice(0,200));
 await pil.screenshot({path:process.env.SHOT||"/tmp/crm-pilotage.png"});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
