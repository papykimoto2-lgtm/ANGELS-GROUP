/* Passage en production (Distributions, Transport, Agro) : classement de TOUTES les données, sauvegarde obligatoire, confirmation, activité vidée, paramétrage et comptes conservés, numéros remis à 1,
   fichiers de base au choix, écrans toujours utilisables après la remise à zéro, script SQL serveur.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/passage-production.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});r.end(fs.readFileSync(f))});
const PROD=require(path.join(root,"production-engine.js"));
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const ouvrir=async app=>{const ctx=await b.newContext({viewport:{width:1300,height:1000},acceptDownloads:true}),p=await ctx.newPage(),errs=[];p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/"+app+".html");await p.waitForTimeout(500);p.errs=errs;
  await p.evaluate(()=>{window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};__as("admin");window.__T=[];if(typeof toast==="function")toast=(m,t)=>{__T.push((t||"")+":"+m)}});return p};
 /* parcourt tous les écrans : renvoie les erreurs de script rencontrées */
 const parcourir=async(p,app)=>{const n0=p.errs.length;await p.evaluate(app=>{const vues=app==="distribution"?NAV.filter(n=>n.v).map(n=>n.v):Object.keys(V);vues.forEach(v=>{try{view=v;render()}catch(e){window.__ERR=(window.__ERR||[]).concat(v+":"+e.message)}});view=app==="distribution"?"dashboard":"dash";render()},app);const x=await p.evaluate(()=>window.__ERR||[]);await p.evaluate(()=>{window.__ERR=[]});return p.errs.slice(n0).concat(x)};

 /* PP-1 : toutes les données de chaque application sont classées (rien n'est oublié ni effacé par accident) */
 const apps={};
 for(const app of ["distribution","transport","agro"]){const p=await ouvrir(app);apps[app]=p;const err=await parcourir(p,app);
  const inc=await p.evaluate(app=>ANGELS_PROD.inconnus(app,S),app);
  chk("PP-1."+app,"données entièrement classées ("+app+") : aucune clé inconnue après avoir ouvert tous les écrans",inc.length===0,JSON.stringify(inc));
  apps[app].avant=err}

 /* PP-2 : Distributions, fichiers de base conservés */
 {const p=apps.distribution;
  const av=await p.evaluate(()=>{window.__av={users:JSON.stringify(S.users),zones:S.config.zones.length,cl:S.clients.length,pr:S.produits.length,lv:S.livreurs.length,mo:S.motos.length,ve:S.vendeurs.length,cmd:S.commandes.length,liv:S.livraisons.length,cx:S.caisses.length,prest:S.prestations.length};
   cpt();cptAuto();return window.__av});
  chk("PP-2.0","données d'exercice présentes avant",av.cmd>0&&av.liv>0&&S_ok(av));
  function S_ok(a){return a.cl>0&&a.pr>0&&a.lv>0}
  const refus=await p.evaluate(()=>{try{prodExecuter();return "exécuté"}catch(e){return e.message}});
  chk("PP-2.1","sans sauvegarde téléchargée : la remise à zéro est refusée et rien n'est supprimé",/sauvegarde/i.test(refus)&&await p.evaluate(()=>S.commandes.length>0),refus);
  await p.evaluate(()=>{view="production";render()});
  const dl=p.waitForEvent("download");await p.evaluate(()=>{ACT.prodSave()});const f=await dl;
  const nom=f.suggestedFilename(),txt=fs.readFileSync(await f.path(),"utf8"),js=JSON.parse(txt);
  chk("PP-2.2","sauvegarde complète téléchargée (nom daté, données restaurables, somme de contrôle)",/^sauvegarde-avant-production-distribution-/.test(nom)&&js.data&&js.data.commandes.length===av.cmd&&js.data.users.length>0&&!!js.sum,nom);
  await p.evaluate(()=>{ACT.prodGo()});await p.waitForTimeout(100);
  const mal=await p.evaluate(()=>{const f=document.getElementById("mf");f.conf.value="oui";f.requestSubmit();return S.commandes.length});
  chk("PP-2.3","mauvaise phrase de confirmation : refus, rien n'est supprimé",mal===av.cmd,mal);
  await p.evaluate(()=>{const f=document.getElementById("mf");f.conf.value="PRODUCTION";f.requestSubmit()});await p.waitForTimeout(150);
  const ap=await p.evaluate(()=>({users:JSON.stringify(S.users),zones:S.config.zones.length,cl:S.clients.length,pr:S.produits.length,lv:S.livreurs.length,mo:S.motos.length,ve:S.vendeurs.length,cmd:S.commandes.length,liv:S.livraisons.length,cx:S.caisses.length,prest:S.prestations.length,
   vides:["commandes","livraisons","fonds","versements","stock_mvts","caisse_sessions","caisse_mvts","entretiens","pleins","equip_mvts","inventaires","avis","demandes","tournees","notifs","attributions","test_ids"].filter(k=>(Array.isArray(S[k])?S[k].length:Object.keys(S[k]||{}).length)>0),
   seq:JSON.stringify(S.seq),stock:S.produits.reduce((a,p)=>a+p.stock,0),gm:[S.gmao.ots.length,S.gmao.plans.length],audit:S.audit.map(a=>a.action),essai:!!S.config.mode_essai,prod:!!S.config.production,cptn:Object.keys(cpt().nums).filter(k=>!/^motos:immo:/.test(k)).length,cptk:Object.keys(cpt().nums).join(),
   fichiers:S.audit.length}));
  chk("PP-2.4","bonne phrase : l'activité est vidée (commandes, livraisons, caisse, stock, maintenance, test, comptabilité numérotée — hors acquisitions des motos conservées)",ap.vides.length===0&&ap.cmd===0&&ap.liv===0&&ap.cptn===0&&ap.gm[0]===0,JSON.stringify(ap.vides)+" cpt="+ap.cptk);
  chk("PP-2.5","paramétrage et comptes conservés : utilisateurs identiques (mots de passe compris), zones, caisses, prestations",ap.users===av.users&&ap.zones===av.zones&&ap.cx===av.cx&&ap.prest===av.prest);
  chk("PP-2.6","fichiers de base conservés par défaut (clients, produits, livreurs, motos, vendeurs, plans de maintenance) ; stocks à zéro",ap.cl===av.cl&&ap.pr===av.pr&&ap.lv===av.lv&&ap.mo===av.mo&&ap.ve===av.ve&&ap.stock===0&&ap.gm[1]>0);
  chk("PP-2.7","numéros remis à zéro, mode essai coupé, journal d'audit = une seule ligne « Passage en production »",/"cmd":0/.test(ap.seq)&&!ap.essai&&ap.audit.length===1&&ap.audit[0]==="Passage en production"&&ap.prod,JSON.stringify(ap.audit)+ap.seq);
  const nv=await p.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const c=creerCmd({client_id:S.clients[0].id,adr:Object.assign({},S.clients[0].adresses[0]),lignes:[{produit_id:S.produits[0].id,qte:1,pu:S.produits[0].prix}],frais:0,remise:0,paiement:"livraison",mode:"Espèces",priorite:"normale",canal:"WhatsApp",confirmer:false});return {n:c.numero,seq:S.seq.cmd}});
  chk("PP-2.8","la première commande réelle reçoit le numéro 1",nv.seq===1&&/0*1$/.test(String(nv.n)),JSON.stringify(nv));
  const e2=await parcourir(p,"distribution");chk("PP-2.9","tous les écrans s'ouvrent sans erreur après la remise à zéro",e2.length===0,e2.slice(0,3).join(" | "));
  const nonAdm=await p.evaluate(()=>{window.__as("caissier");ui.prodSauve=1;try{prodExecuter();return "exécuté"}catch(e){return e.message}});
  chk("PP-2.10","un profil non administrateur ne peut pas vider les données",/administrateur/i.test(nonAdm),nonAdm)}

 /* PP-3 : Distributions, « tout vider sauf paramétrage et comptes » */
 {const p=await ouvrir("distribution");
  const r=await p.evaluate(()=>{ui.prodSauve=1;ui.prodc=ANGELS_PROD.choixDefaut("distribution",true);const nU=S.users.length,adm=S.users.filter(u=>u.role==="admin").length;prodExecuter();
   return {cl:S.clients.length,pr:S.produits.length,lv:S.livreurs.length,mo:S.motos.length,ve:S.vendeurs.length,eq:S.equip.length,liv:S.users.filter(u=>u.role==="livreur").length,vend:S.users.filter(u=>u.role==="vendeur").length,adm:S.users.filter(u=>u.role==="admin").length,adm0:adm,zones:S.config.zones.length,orphLiv:S.users.filter(u=>u.role==="livreur"&&!S.livreurs.some(l=>l.user_id===u.id)).length}});
  chk("PP-3.1","tout vider : clients, produits, livreurs (et leurs comptes), motos, équipements, vendeurs vidés ; administrateurs et paramétrage conservés",r.cl===0&&r.pr===0&&r.lv===0&&r.mo===0&&r.ve===0&&r.eq===0&&r.liv===0&&r.vend===0&&r.adm===r.adm0&&r.adm>0&&r.zones>0,JSON.stringify(r));
  const e=await parcourir(p,"distribution");chk("PP-3.2","les écrans restent utilisables avec une base entièrement vide",e.length===0,e.slice(0,3).join(" | "))}

 /* PP-4 : Transport */
 {const p=apps.transport;
  const av=await p.evaluate(()=>({users:JSON.stringify(S.users),perms:JSON.stringify(S.perms),acc:S.accounts.length,set:JSON.stringify(S.settings),veh:S.vehicles.length,drv:S.drivers.length,tiers:S.tiers.length,tdrv:S.tiers.filter(t=>S.drivers.some(d=>d.id===t.ref)).length,ob:S.obligations.length,en:S.entries.length}));
  chk("PP-4.0","Transport : données d'exercice présentes avant",av.ob>0&&av.en>0&&av.veh>0);
  await p.evaluate(()=>{view="audit";UI.tab.aud="prod";render()});
  const html=await p.evaluate(()=>document.getElementById("main")?document.getElementById("main").innerHTML:document.body.innerHTML);
  chk("PP-4.1","onglet « Passage en production » visible pour l'administrateur, avec sauvegarde, groupes et aperçu",/Passage en production/.test(html)&&/Sauvegarde \(obligatoire\)/.test(html)&&/Aper/.test(html));
  const dl=p.waitForEvent("download");await p.evaluate(()=>{A["prod.save"]()});const f=await dl;
  chk("PP-4.2","sauvegarde Transport téléchargée",/^sauvegarde-avant-production-transport-/.test(f.suggestedFilename())&&JSON.parse(fs.readFileSync(await f.path(),"utf8")).data.obligations.length===av.ob);
  await p.evaluate(()=>{A["prod.go"]()});await p.waitForTimeout(100);
  await p.evaluate(()=>{const f=document.querySelector(".md form,form");f.elements.conf.value="non";f.requestSubmit()});await p.waitForTimeout(100);
  chk("PP-4.3","mauvaise confirmation : refus, rien n'est supprimé",await p.evaluate(()=>S.obligations.length)===av.ob);
  await p.evaluate(()=>{const f=document.querySelector(".md form,form");f.elements.conf.value="PRODUCTION";f.requestSubmit()});await p.waitForTimeout(200);
  const ap=await p.evaluate(()=>({users:JSON.stringify(S.users),perms:JSON.stringify(S.perms),acc:S.accounts.length,veh:S.vehicles.length,drv:S.drivers.length,tiers:S.tiers.length,tdrv:S.tiers.filter(t=>S.drivers.some(d=>d.id===t.ref)).length,
   vides:["contracts","assignments","obligations","payments","allocs","receipts","cash_sessions","cash_mv","entries","audit","mad_resas","gps_pos"].filter(k=>k!=="audit"&&S[k].length>0),seq:JSON.stringify(S.seq),seqZero:Object.values(S.seq).every(v=>v===0),audit:S.audit.map(a=>a.a),prod:!!S.settings.production,off:S.mad_offres.length,plans:S.plans.length}));
  chk("PP-4.4","activité Transport vidée (contrats, échéances, paiements, caisse, écritures, GPS, réservations)",ap.vides.length===0,JSON.stringify(ap.vides));
  chk("PP-4.5","utilisateurs, droits, plan comptable, offres et plans de maintenance conservés ; véhicules et chauffeurs conservés",ap.users===av.users&&ap.perms===av.perms&&ap.acc===av.acc&&ap.veh===av.veh&&ap.drv===av.drv&&ap.off>0&&ap.plans>0);
  chk("PP-4.6","tiers : seuls les tiers des chauffeurs conservés restent ; compteurs à zéro ; audit = une ligne",ap.tiers===ap.tdrv&&ap.seqZero&&ap.audit.length===1&&ap.audit[0]==="Passage en production"&&ap.prod,JSON.stringify(ap.audit)+ap.seq+" "+ap.tiers+"/"+ap.tdrv);
  const e=await parcourir(p,"transport");chk("PP-4.7","tous les écrans Transport s'ouvrent sans erreur après la remise à zéro",e.length===0,e.slice(0,3).join(" | "))}

 /* PP-5 : Agro */
 {const p=apps.agro;
  const av=await p.evaluate(()=>({users:JSON.stringify(S.users),acc:S.accounts.length,pro:S.protocoles.length,set:S.settings.org_nom,lots:S.lots.length,bat:S.batiments.length,prod:S.produits.length,ve:S.ventes.length,mv:S.mvts.length,en:S.entries.length}));
  chk("PP-5.0","Agro : données d'exercice présentes avant",av.lots>0&&av.ve>0&&av.mv>0);
  await p.evaluate(()=>{view="params";UI.tab.par="prod";render()});
  const html=await p.evaluate(()=>document.body.innerHTML);
  chk("PP-5.1","onglet « Passage en production » visible pour l'administrateur",/Sauvegarde \(obligatoire\)/.test(html));
  const dl=p.waitForEvent("download");await p.evaluate(()=>{A["prod.save"]()});const f=await dl;
  chk("PP-5.2","sauvegarde Agro téléchargée",/^sauvegarde-avant-production-agro-/.test(f.suggestedFilename())&&JSON.parse(fs.readFileSync(await f.path(),"utf8")).data.lots.length===av.lots);
  await p.evaluate(()=>{A["prod.preset"]("1")});
  await p.evaluate(()=>{A["prod.go"]()});await p.waitForTimeout(100);
  await p.evaluate(()=>{const f=document.querySelector(".md form,form");f.elements.conf.value="PRODUCTION";f.requestSubmit()});await p.waitForTimeout(200);
  const ap=await p.evaluate(()=>({users:JSON.stringify(S.users),acc:S.accounts.length,pro:S.protocoles.length,lots:S.lots.length,bat:S.batiments.length,prod:S.produits.length,staff:S.staff.length,fo:S.fournisseurs.length,cl:S.clients.length,ve:S.ventes.length,mv:S.mvts.length,en:S.entries.length,suivis:S.suivis.length,soins:S.soins.length,seq:JSON.stringify(S.seq),seqZero:Object.values(S.seq).every(v=>v===0),audit:S.audit.map(a=>a.a),rapp:JSON.stringify(S.rapp),rc:JSON.stringify(S.restes_cond),nut:S.nutrition.length}));
  chk("PP-5.3","« tout vider » Agro : bandes, suivis, soins, ventes, mouvements, écritures, fournisseurs, clients, produits, personnel, bâtiments vidés",ap.lots===0&&ap.suivis===0&&ap.soins===0&&ap.ve===0&&ap.mv===0&&ap.en===0&&ap.prod===0&&ap.staff===0&&ap.fo===0&&ap.cl===0&&ap.bat===0,JSON.stringify(ap).slice(0,300));
  chk("PP-5.4","comptes, plan comptable, protocoles et programmes nutritionnels conservés ; compteurs à zéro ; audit = une ligne",ap.users===av.users&&ap.acc===av.acc&&ap.pro===av.pro&&ap.nut>0&&ap.seqZero&&ap.audit.length===1&&ap.audit[0]==="Passage en production",JSON.stringify(ap.audit));
  const e=await parcourir(p,"agro");chk("PP-5.5","tous les écrans Agro s'ouvrent sans erreur après la remise à zéro",e.length===0,e.slice(0,3).join(" | "))}

 /* PP-6 : moteur pur, clés inconnues et script SQL */
 {const S={v:1,config:{org:"X"},users:[{id:"u1"}],commandes:[{id:"c"}],seq:{cmd:5,doc:{a:1}},mystere:[1,2,3],audit:[{}],test_ids:{a:1},produits:[{id:"p",stock:9}],clients:[{id:"k"}]};
  const pl=PROD.plan("distribution",S,PROD.choixDefaut("distribution",false));
  chk("PP-6.1","aperçu : activité comptée, fichiers de base non comptés par défaut, clé inconnue signalée",pl.groupes.find(g=>g.id==="activite").n>=4&&pl.groupes.find(g=>g.id==="clients").vide===false&&pl.inconnus.join()==="mystere",JSON.stringify(pl.inconnus));
  const r=PROD.appliquer("distribution",S,PROD.choixDefaut("distribution",false));
  chk("PP-6.2","remise à zéro en place : activité vidée, compteurs à 0 (forme conservée), clé inconnue, utilisateurs et clients conservés, stock à 0",S.commandes.length===0&&S.seq.cmd===0&&JSON.stringify(S.seq.doc)==="{}"&&S.mystere.length===3&&S.users.length===1&&S.clients.length===1&&S.produits[0].stock===0&&r.total>0);
  let e="";try{PROD.profil("inconnue")}catch(x){e=x.message}
  chk("PP-6.3","application inconnue refusée",/inconnue/.test(e));
  const sql=PROD.SQL_SERVEUR,fichier=fs.readFileSync(path.join(root,"supabase","production-reset.sql"),"utf8");
  chk("PP-6.4","le script SQL du dépôt est identique à celui affiché dans l'application",sql===fichier);
  const sensibles=["pg_livreurs","pg_vendeurs","pd_vendeurs","portail_catalogue","pg_push"];
  chk("PP-6.5","script SQL : dans une transaction, sans truncate ni drop, comptes livreurs/vendeurs/catalogue/notifications jamais touchés, activité passerelle et portail vidée",/^begin;/m.test(sql)&&/^commit;/m.test(sql)&&!/truncate|drop /i.test(sql)&&sensibles.every(t=>!new RegExp("(delete from|update) public\\."+t+"\\b","i").test(sql))&&/delete from public\.pg_missions/.test(sql)&&/delete from public\.pd_demandes/.test(sql));}

 for(const app of ["distribution","transport","agro"]){const S={v:1,config:{fne:{ncc:"X"}},settings:{fne:{ncc:"X"}},users:[{id:"u"}],fne_certs:[{id:"c1"}]};PROD.appliquer(app,S,PROD.choixDefaut(app,false));
  chk("PP-6.6."+app,"certifications FNE (essais, simulations) vidées au passage en production ; réglages FNE conservés ("+app+")",S.fne_certs.length===0&&(S.config.fne.ncc==="X"||S.settings.fne.ncc==="X"))}
 for(const k of Object.keys(apps)){const e=apps[k].errs.filter(m=>!/ResizeObserver/.test(m));chk("PP-7."+k,"aucune erreur de script pendant le test ("+k+")",e.length===0,e.slice(0,2).join(" | "))}
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
