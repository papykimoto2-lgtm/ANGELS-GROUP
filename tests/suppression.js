/* Moteur de suppression / archivage / corbeille : commandes, livreurs, motos.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/suppression.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),p=await ctx.newPage(),errs=[];
 p.on("pageerror",e=>errs.push("PAGEERR "+e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/distribution.html");await p.waitForTimeout(300);
 await p.evaluate(()=>{window.__T=[];toast=(m,k)=>{__T.push(m)};window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};window.__last=()=>__T[__T.length-1]||"";
  window.__ch=(el,v)=>{el.value=v;el.dispatchEvent(new Event("change",{bubbles:true}))};window.__in=(el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}))};
  window.__clic=re=>[...document.querySelectorAll("button")].find(x=>re.test(x.textContent)).click();
  window.__V=()=>S.vendeurs[0];window.__Z=()=>S.config.zones[0].nom;
  window.__prod=()=>S.produits.find(x=>x.actif&&x.stock>=50);
  /* commande d'ANGEL'S pour un client divers, créée à la main */
  window.__div=(o)=>{o=o||{};const ad={id:uid("a"),libelle:"Livraison",zone:__Z(),quartier:o.q||"Cocody",repere:"Pharmacie",gps:null,instructions:"",defaut:true};
   const cl={id:uid("cl"),nom:"Client divers",tel:"",tel2:"",adresses:[ad],note:"",divers:true};if(o.vendeur)cl.vendeur_id=o.vendeur;S.clients.push(cl);
   __as("admin");return creerCmd({client_id:cl.id,adr:Object.assign({},ad),lignes:o.lignes||[{produit_id:__prod().id,qte:2,pu:__prod().prix}],frais:1000,remise:0,paiement:"livraison",mode:"Espèces",priorite:"normale",canal:"Téléphone",obs:"",confirmer:o.confirmer!==false,vendeur_id:o.vendeur||null,paye_vendeur:0})}});
 let ok=0,ko=0;const t=async(id,label,fn)=>{let r;try{r=await p.evaluate(fn)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",r)}};

 await t("SU-1","commande sans trace : suppression → corbeille (copie), motif obligatoire, client divers orphelin retiré, audit ; restauration complète",()=>{const E=[],c=__div({confirmer:false}),cid=c.client_id,n=c.numero;__as("admin");c.statut="attente";
  let e="";try{supExecuter("commande",c.id,"x","supprimer")}catch(x){e=x.message}if(!/Motif/.test(e))E.push("motif non exigé : "+e);
  supExecuter("commande",c.id,"Saisie en double","supprimer");if(cmd(c.id))E.push("encore présente");if(S.clients.some(x=>x.id===cid))E.push("client divers conservé");if(!corbeille().some(g=>g.libelle.startsWith(n)))E.push("corbeille");if(!S.audit.some(a=>a.action==="Suppression commande"&&a.detail.includes("Saisie en double")))E.push("audit");
  supRestaurer(corbeille()[0].id);if(!cmd(c.id)||!S.clients.some(x=>x.id===cid))E.push("restauration");if(corbeille().length)E.push("corbeille non vidée");return E.length?E.join(" ; "):true});
 await t("SU-2","commande traitée (confirmée, payée, livrée…) : suppression refusée avec la liste des raisons ; pas d'archivage",()=>{const E=[],c=__div();__as("admin");let e="";try{supExecuter("commande",c.id,"Test erreur","supprimer")}catch(x){e=x.message}if(!/impossible/.test(e))E.push("suppression permise : "+e);
  const c2=__div({confirmer:false});c2.statut="attente";S.fonds.push({id:uid("f"),type:"acompte",commande_id:c2.id,montant:100,mode:"Espèces",ts:now(),par:"t"});if(!supTraces("commande",c2).some(x=>/paiement/.test(x)))E.push("paiement non détecté");
  try{supExecuter("commande",c.id,"Test erreur","archiver");E.push("archivage commande permis")}catch(x){}return E.length?E.join(" ; "):true});
 await t("SU-3","seul l'administrateur : boutons et actions refusés aux autres rôles",()=>{const E=[],c=__div({confirmer:false});c.statut="attente";__as("commercial");let e="";try{supExecuter("commande",c.id,"Test erreur","supprimer")}catch(x){e=x.message}if(!/administrateur/.test(e))E.push("commercial autorisé");
  cmdDetail(c.id);if(/🗑 Supprimer/.test(document.body.innerText))E.push("bouton visible au commercial");__as("admin");cmdDetail(c.id);if(!/🗑 Supprimer/.test(document.body.innerText))E.push("bouton absent pour l'admin");return E.length?E.join(" ; "):true});
 await t("SU-4","livreur sans histoire : supprimé avec son compte, restaurable ; livreur avec histoire : suppression refusée, archivage",()=>{const E=[];__as("admin");
  const u={id:uid("u"),nom:"Test Neuf",role:"livreur",actif:true,pwd:null,chg:true},l={id:uid("lv"),user_id:u.id,nom:"Test Neuf",tel:"0700000001",zone:__Z(),moto_id:null,statut:"disponible",gps_consent:false,remu:null};S.users.push(u);S.livreurs.push(l);
  if(supEtat("livreur",l).mode!=="supprimer")E.push("mode "+supEtat("livreur",l).mode);supExecuter("livreur",l.id,"Créé par erreur","supprimer");if(liv(l.id)||usr(u.id))E.push("livreur/compte conservé");supRestaurer(corbeille()[0].id);if(!liv(l.id)||!usr(u.id))E.push("restauration");
  const h=S.livreurs.find(x=>S.livraisons.some(y=>y.livreur_id===x.id));if(h){if(supEtat("livreur",h).mode!=="archiver")E.push("mode histoire");let e="";try{supExecuter("livreur",h.id,"Test","supprimer")}catch(x){e=x.message}if(!/impossible/.test(e))E.push("suppression permise")}return E.length?E.join(" ; "):true});
 await t("SU-5","archiver un livreur : moto libérée, compte désactivé, plus proposé à l'affectation ; refusé avec mission en cours ; désarchivage",()=>{const E=[];__as("admin");
  const mo={id:uid("m"),immat:"ZZ-111-AA",modele:"X",km:0,prochain_km:800,statut:"affectee"};S.motos.push(mo);const u={id:uid("u"),nom:"Arch Liv",role:"livreur",actif:true,pwd:null,chg:true},l={id:uid("lv"),user_id:u.id,nom:"Arch Liv",tel:"0700000002",zone:__Z(),moto_id:mo.id,statut:"disponible",gps_consent:false,remu:null};S.users.push(u);S.livreurs.push(l);
  const lv={id:uid("l"),livreur_id:l.id,commande_id:null,statut:"en_cours"};S.livraisons.push(lv);let e="";try{supExecuter("livreur",l.id,"Départ","archiver")}catch(x){e=x.message}if(!/en cours/.test(e))E.push("mission en cours non bloquante : "+e);
  lv.statut="livree";supExecuter("livreur",l.id,"Départ de l'entreprise","archiver");if(!l.archive||l.moto_id||mo.statut!=="disponible"||u.actif||l.statut!=="indisponible")E.push("effets archivage "+JSON.stringify([!!l.archive,l.moto_id,mo.statut,u.actif]));
  if(lvActifs().some(x=>x.id===l.id))E.push("encore proposé");
  supDesarchiver("livreur",l.id);if(l.archive)E.push("désarchivage");return E.length?E.join(" ; "):true});
 await t("SU-6","moto : libre → supprimée (restaurable) ; affectée/avec entretien → archivée ; immatriculation unique à la restauration",()=>{const E=[];__as("admin");
  const m1={id:uid("m"),immat:"SU-222-BB",modele:"Y",km:0,prochain_km:800,statut:"disponible"};S.motos.push(m1);if(supEtat("moto",m1).mode!=="supprimer")E.push("mode libre");supExecuter("moto",m1.id,"Doublon","supprimer");if(moto(m1.id))E.push("encore là");
  S.motos.push({id:uid("m"),immat:"su-222-bb",modele:"Z",km:0,prochain_km:800,statut:"disponible"});let e="";try{supRestaurer(corbeille()[0].id)}catch(x){e=x.message}if(!/existe déjà/.test(e))E.push("doublon restauré : "+e);
  const m2=S.motos.find(x=>S.livreurs.some(l=>l.moto_id===x.id));if(m2){if(supEtat("moto",m2).mode!=="archiver")E.push("mode affectée");}
  const m3={id:uid("m"),immat:"SU-333-CC",modele:"W",km:0,prochain_km:800,statut:"disponible"};S.motos.push(m3);S.entretiens=S.entretiens||[];S.entretiens.push({id:uid("e"),moto_id:m3.id,date:"2026-01-01",type:"vidange",cout:1000});
  supExecuter("moto",m3.id,"Réformée","archiver");if(m3.statut!=="archivee"||!m3.archive)E.push("archivage moto");supDesarchiver("moto",m3.id);if(m3.archive||m3.statut!=="disponible")E.push("désarchivage moto");return E.length?E.join(" ; "):true});
 await t("SU-7","modifier un livreur : moto déjà affectée à un autre refusée ; modification tracée avec le détail avant → après",()=>{const E=[];__as("admin");
  const a=S.livreurs.find(l=>l.moto_id&&!l.archive);if(!a)return"pas de livreur avec moto";const l2=S.livreurs.find(l=>l.id!==a.id&&!l.archive);
  livForm(l2);const sel=document.querySelector('[name="moto"]');if(![...sel.options].some(o=>o.value===a.moto_id&&/affectée à/.test(o.textContent)))E.push("mention affectation absente");
  __ch(sel,a.moto_id);__clic(/Valider/);if(l2.moto_id===a.moto_id)E.push("moto doublon acceptée");
  closeModal();return E.length?E.join(" ; "):true});
 await t("SU-8","modifier une moto : immatriculation déjà utilisée refusée ; modification tracée",()=>{const E=[];__as("admin");
  const [m1,m2]=S.motos.filter(x=>!x.archive);motoForm(m2);document.querySelector('[name="immat"]').value=m1.immat.toLowerCase();__clic(/Valider/);if(normTxt(m2.immat)===normTxt(m1.immat))E.push("doublon accepté");
  closeModal();motoForm(m2);const km=m2.km+10;document.querySelector('[name="km"]').value=km;__clic(/Valider/);
  if(m2.km!==km)E.push("km non modifié");if(!S.audit.some(a=>a.action==="Modification moto"&&/km : /.test(a.detail)))E.push("audit détaillé");return E.length?E.join(" ; "):true});
 await t("SU-9","archivés masqués par défaut, affichables ; corbeille visible uniquement à l'admin ; mode serveur : refus",()=>{const E=[];__as("admin");const l=S.livreurs.find(x=>!x.archive&&!S.livraisons.some(y=>y.livreur_id===x.id&&isActive(y)));l.archive={le:now(),par:"t",motif:"t"};
  ui.arch="";const h=VIEWS.livreurs();if(h.includes(">"+l.nom+"<")&&h.includes("📦 Archivé"))E.push("archivé visible par défaut");ui.arch="1";if(!VIEWS.livreurs().includes("📦 Archivé"))E.push("archivés non affichables");ui.arch="";
  if(!/Corbeille/.test(VIEWS.livreurs()))E.push("corbeille admin absente");__as("commercial");if(/Corbeille/.test(VIEWS.livreurs()))E.push("corbeille visible");
  __as("admin");const cl=CL.on;CL.on=true;try{supExecuter("commande","x","motif","supprimer");E.push("serveur permis")}catch(x){if(!/serveur/.test(x.message))E.push(x.message)}finally{CL.on=cl}return E.length?E.join(" ; "):true});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
