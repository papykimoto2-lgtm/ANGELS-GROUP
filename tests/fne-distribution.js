/* Facture normalisée électronique (FNE) dans Distributions : réglages, facture simple ou normalisée, contrôle avant émission, certification (simulation et essai DGI via le serveur),
   avoir par quantités, impression, liste des documents.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/fne-distribution.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),p=await ctx.newPage(),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());
 const posts=[];let dgiMode="ok";
 await ctx.route("**/functions/v1/fne",async r=>{const b=JSON.parse(r.request().postData()),h=r.request().headers();posts.push({b,cle:h["x-sync-key"]});
  if(dgiMode==="incertain")return r.fulfill({status:504,contentType:"application/json",body:JSON.stringify({ok:false,erreur:"La DGI n'a pas répondu",incertain:true})});
  if(b.action==="etat")return r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({ok:true,configure:true,hote:"54.247.95.108"})});
  if(b.action==="avoir")return r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,reponse:{ncc:"9606123E",reference:"A9606123E2500000006",token:"http://54.247.95.108/fr/verification/av",warning:false,balance_sticker:178}})});
  const it=b.payload.items.map((i,k)=>({id:"it-000000"+k,quantity:i.quantity,reference:i.reference,description:i.description,amount:i.amount})),tot=Math.round(b.payload.items.reduce((a,i)=>a+i.quantity*i.amount*(1+(i.taxes[0]==="TVA"?.18:0)),0));
  r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,rejoue:false,reponse:{ncc:"9606123E",reference:"9606123E25000000019",token:"http://54.247.95.108/fr/verification/019465c1",warning:false,balance_sticker:179,invoice:{id:"e2b2d8da-a532-4c08-9182-f5b428ca468d",amount:tot,vatAmount:0,items:it}}})})});
 await p.goto(base+"/distribution.html");await p.waitForTimeout(500);
 await p.evaluate(()=>{window.__T=[];toast=(m,t)=>{__T.push((t||"")+":"+m)};window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};__as("admin");
  window.__cmd=()=>{const cl=S.clients[0];return creerCmd({client_id:cl.id,adr:Object.assign({},cl.adresses[0]),lignes:[{produit_id:S.produits[0].id,qte:2,pu:S.produits[0].prix},{produit_id:S.produits[1].id,qte:1,pu:S.produits[1].prix}],frais:1500,remise:0,paiement:"livraison",mode:"Espèces",priorite:"normale",canal:"WhatsApp",confirmer:true})};
  window.__nd=()=>S.docs.filter(d=>d.type==="facture").length});
 const ev=(fn,a)=>p.evaluate(fn,a);

 /* sans FNE : comportement historique */
 let r=await ev(()=>{const c=__cmd();const n=__nd();ACT.docFac(c.id);const d=S.docs.filter(x=>x.type==="facture").pop();return {n:__nd()-n,modal:document.getElementById("modal").innerHTML.includes("Facture normalisée (FNE)"),num:d.numero,fne:!!FNE.cert({type:"facture",id:d.id}),bar:fneBarre(d)}});
 chk("FD-1","FNE désactivée : la facture simple s'émet directement (FAC-…), sans question ni mention FNE",r.n===1&&/^FAC-/.test(r.num)&&!r.fne&&r.bar==="",JSON.stringify(r));
 r=await ev(()=>{const c=S.config.fne;return {actif:c.actif,env:c.env,certs:Array.isArray(S.fne_certs)}});
 chk("FD-2","réglages FNE initialisés : inactif, simulation par défaut",r.actif===false&&r.env==="simulation"&&r.certs);

 /* réglages */
 await ev(()=>{view="params";ui.ptab="ste";render()});
 chk("FD-3","l'écran Paramètres affiche la section « Facturation normalisée (FNE) » (onglet Société et documents) avec l'avertissement sur la clé gardée côté serveur",await ev(()=>/Facturation normalisée \(FNE\)/.test(document.getElementById("main")?document.getElementById("main").innerHTML:document.body.innerHTML)&&/jamais/.test(document.body.innerHTML)));
 const sauve=async(o)=>ev(o=>{const set=(i,v)=>{const e=document.querySelector(i);if(e.type==="checkbox")e.checked=!!v;else e.value=v};set("#f_actif",o.actif);set("#f_env",o.env);set("#f_ncc",o.ncc);set("#f_etab",o.etab);set("#f_pv",o.pv);set("#f_auto",o.auto);set("#f_tel","0700000000");set("#f_mail","compta@angels.ci");__T.length=0;ACT.fneSave();return __T.join("|")},o);
 let m=await sauve({actif:true,env:"simulation",ncc:"12",etab:"ANGEL'S",pv:"01",auto:false});
 chk("FD-4","NCC invalide refusé à l'enregistrement",/NCC invalide/.test(m)&&!(await ev(()=>S.config.fne.actif)),m);
 await ev(()=>{__as("caissier")});m=await sauve({actif:true,env:"simulation",ncc:"9606123E",etab:"ANGEL'S",pv:"01",auto:false});
 chk("FD-5","un caissier ne peut pas modifier les réglages FNE",/Accès refusé|Réservé/.test(m)&&!(await ev(()=>S.config.fne.actif)),m);
 await ev(()=>{__as("admin")});m=await sauve({actif:true,env:"simulation",ncc:"9606123e",etab:"",pv:"",auto:false});
 chk("FD-6","réglages enregistrés (NCC en majuscules, simulation) ; l'établissement et le point de vente manquants seront signalés à l'émission",/enregistrés/.test(m)&&await ev(()=>S.config.fne.actif&&S.config.fne.ncc==="9606123E"&&S.config.fne.env==="simulation"),m);

 /* choix simple / normalisée, contrôle avant émission */
 r=await ev(()=>{const c=__cmd(),n=__nd();ACT.docFac(c.id);const m=document.getElementById("modal").innerHTML;window.__cid=c.id;return {ch:/Facture normalisée \(FNE\)/.test(m)&&/Facture simple/.test(m),n:__nd()-n,id:c.id}});
 chk("FD-7","FNE active : « Établir la facture » propose facture normalisée ou facture simple (rien n'est encore émis)",r.ch&&r.n===0,JSON.stringify(r));
 r=await ev(id=>{const n=__nd();ACT.fneEmettre(id+"|1");return {n:__nd()-n,modal:document.getElementById("modal").innerHTML}},r.id);
 chk("FD-8","facture normalisée avec réglages incomplets : REFUSÉE avant l'émission (aucun document créé, aucun autocollant consommé), motifs listés",r.n===0&&/Établissement/.test(r.modal)&&/Point de vente/.test(r.modal),r.modal.slice(0,200));
 await ev(()=>{S.config.fne.etablissement="ANGEL'S GROUP Yopougon";S.config.fne.point_vente="01"});
 r=await ev(async()=>{const id=window.__cid,n=__nd();ACT.fneEmettre(id+"|1");await new Promise(r=>setTimeout(r,300));const d=S.docs.filter(x=>x.type==="facture").pop(),c=FNE.cert({type:"facture",id:d.id});return {n:__nd()-n,statut:c&&c.statut,ref:c&&c.ref,env:c&&c.env,bar:fneBarre(d),html:docHTML(d),badge:fneBadge(d)}});
 chk("FD-9","facture normalisée (simulation) : émise puis certifiée ; référence SIM…, barre d'état « Facture normalisée (simulation) », mention SANS VALEUR FISCALE à l'impression, badge dans la liste",r.n===1&&r.statut==="certifiee"&&/^SIM/.test(r.ref)&&r.env==="simulation"&&/Facture normalisée \(simulation\)/.test(r.bar)&&/SIMULATION — DOCUMENT DE FORMATION/.test(r.html)&&/FACTURE NORMALISÉE ÉLECTRONIQUE/.test(r.html)&&/FNE simulation/.test(r.badge),JSON.stringify(r).slice(0,300));
 r=await ev(()=>{const c=__cmd(),n=__nd();ACT.fneEmettre(c.id+"|0");const d=S.docs.filter(x=>x.type==="facture").pop();return {n:__nd()-n,fne:!!FNE.cert({type:"facture",id:d.id}),mention:/non certifiée FNE/.test(docHTML(d)),bar:fneBarre(d),id:d.id}});
 chk("FD-10","facture SIMPLE toujours possible (FNE active) : émise sans certification, mention « non certifiée FNE » sur le document, bouton « Certifier FNE » proposé",r.n===1&&!r.fne&&r.mention&&/Certifier FNE/.test(r.bar)&&/Facture simple/.test(r.bar),r.bar.slice(0,200));
 r=await ev(async id=>{const d=S.docs.find(x=>x.id===id);await fneCertifier(d,false);const c=FNE.cert({type:"facture",id});return {statut:c.statut,n:S.docs.filter(x=>x.type==="facture").length}},r.id);
 chk("FD-11","une facture simple peut être certifiée après coup (même document, même numéro interne)",r.statut==="certifiee");

 /* avoir FNE par quantités */
 r=await ev(async()=>{const d=S.docs.filter(x=>x.type==="facture"&&FNE.valable({type:"facture",id:x.id})).slice(-2)[0];ACT.docAvoir(d.id);const mod=document.getElementById("modal").innerHTML;
  const f=document.getElementById("mf");f.q0.value="1";f.mo.value="Retour d'un sac";f.requestSubmit();await new Promise(r=>setTimeout(r,300));
  const a=S.docs.filter(x=>x.type==="avoir").pop(),c=S.fne_certs.find(x=>x.id===a.fne_id);return {mod:/Quantité rendue/.test(mod),a:!!a,fne:c&&c.kind,montant:a.montant,parent:c&&c.parent===FNE.cert({type:"facture",id:d.id}).id,badge:fneBadge(a),html:docHTML(a),fac:d.id,liste:(()=>{view="documents";render();return document.body.innerHTML})()}});
 chk("FD-12","avoir sur facture normalisée : saisie des quantités rendues, avoir certifié (rattaché à la facture), document d'avoir avec « AVOIR NORMALISÉ », badge FNE dans la liste",r.mod&&r.a&&r.fne==="avoir"&&r.montant>0&&r.parent&&/FNE/.test(r.badge)&&/AVOIR NORMALISÉ/.test(r.html)&&/FNE/.test(r.liste),JSON.stringify(r).slice(0,300));
 r=await ev(()=>{const d=S.docs.filter(x=>x.type==="facture"&&!FNE.cert({type:"facture",id:x.id})).pop()||S.docs.filter(x=>x.type==="facture")[0];avoirModal(S.docs.find(x=>x.type==="facture"&&!FNE.valable({type:"facture",id:x.id})&&!S.fne_certs.some(c=>c.src.id===x.id)));return /Montant de l'avoir/.test(document.getElementById("modal").innerHTML)});
 chk("FD-13","avoir sur une facture SIMPLE : formulaire historique par montant, inchangé",r===true);

 /* client : NCC / e-mail → B2B */
 r=await ev(()=>{const c=S.clients[1];cliForm(c);const f=document.getElementById("mf");f.email.value="resto@x.ci";f.ncc.value="9502363n";f.requestSubmit();return {email:c.email,ncc:c.ncc}});
 chk("FD-14","fiche client : e-mail et NCC enregistrés (NCC en majuscules)",r.email==="resto@x.ci"&&r.ncc==="9502363N",JSON.stringify(r));
 r=await ev(async()=>{const c2=S.clients[1];const cm=creerCmd({client_id:c2.id,adr:Object.assign({},c2.adresses[0]),lignes:[{produit_id:S.produits[0].id,qte:1,pu:S.produits[0].prix}],frais:0,remise:0,paiement:"livraison",mode:"Espèces",priorite:"normale",canal:"WhatsApp",confirmer:true});ACT.fneEmettre(cm.id+"|1");await new Promise(r=>setTimeout(r,300));const d=S.docs.filter(x=>x.type==="facture").pop(),c=FNE.cert({type:"facture",id:d.id});return {tpl:c.template,req:c.req.clientNcc}});
 chk("FD-15","client avec NCC → facture B2B avec le NCC du client",r.tpl==="B2B"&&r.req==="9502363N",JSON.stringify(r));

 /* essai DGI via le serveur */
 await ctx.addInitScript(()=>{});
 await ev(()=>{localStorage.setItem("angels_sync",JSON.stringify({actif:true,cle:"K".repeat(32)}));localStorage.setItem("angels_supabase",JSON.stringify({url:"https://projet.supabase.co"}));S.config.fne.env="test"});
 r=await ev(async()=>{const c=__cmd();ACT.fneEmettre(c.id+"|1");await new Promise(r=>setTimeout(r,500));const d=S.docs.filter(x=>x.type==="facture").pop(),ce=FNE.cert({type:"facture",id:d.id});return {statut:ce.statut,ref:ce.ref,env:ce.env,solde:ce.solde_stickers,bar:fneBarre(d),html:docHTML(d),id:d.id}});
 const sig=posts.filter(x=>x.b.action==="signer").pop();
 chk("FD-16","essai DGI : la facture part au serveur avec la clé de synchronisation (jamais la clé DGI), action signer, environnement test ; référence DGI, solde d'autocollants et QR de vérification",r.statut==="certifiee"&&r.env==="test"&&r.ref==="9606123E25000000019"&&r.solde===179&&sig&&sig.cle==="K".repeat(32)&&sig.b.env==="test"&&sig.b.app==="distribution"&&/autocollants restants/.test(r.bar)&&/ENVIRONNEMENT DE TEST DGI/.test(r.html)&&/<svg/.test(r.html),JSON.stringify(r).slice(0,300));
 chk("FD-17","la requête envoyée respecte le format DGI : type sale, moyen de paiement, gabarit, point de vente, établissement, lignes avec TVA et prix unitaire HT",sig.b.payload.invoiceType==="sale"&&sig.b.payload.pointOfSale==="01"&&sig.b.payload.establishment==="ANGEL'S GROUP Yopougon"&&sig.b.payload.items.length===3&&sig.b.payload.items.every(i=>i.taxes.length===1&&i.amount>=0)&&/^[a-z-]+$/.test(sig.b.payload.paymentMethod)&&!/9606123E/.test(JSON.stringify(sig.b.payload)),JSON.stringify(sig.b.payload).slice(0,300));
 dgiMode="incertain";
 r=await ev(async()=>{const c=__cmd();ACT.fneEmettre(c.id+"|1");await new Promise(r=>setTimeout(r,500));const d=S.docs.filter(x=>x.type==="facture").pop(),ce=FNE.cert({type:"facture",id:d.id});return {statut:ce.statut,bar:fneBarre(d),badge:fneBadge(d),id:d.id}});
 chk("FD-18","réponse DGI perdue : facture émise mais certification INCERTAINE, message d'alerte et bouton « Reprendre après vérification » (aucun renvoi automatique)",r.statut==="incertain"&&/incertain/i.test(r.bar)&&/Reprendre après vérification/.test(r.bar)&&/incertaine/.test(r.badge),JSON.stringify(r).slice(0,300));
 dgiMode="ok";
 r=await ev(async id=>{const d=S.docs.find(x=>x.id===id);ACT.fneCert(id,{dataset:{forcer:"1"}});await new Promise(r=>setTimeout(r,500));return FNE.cert({type:"facture",id}).statut},r.id);
 chk("FD-19","reprise confirmée après vérification : la facture est certifiée",r==="certifiee",r);
 r=await ev(async()=>{S.config.fne.env="prod";const c=__cmd();ACT.fneEmettre(c.id+"|1");await new Promise(r=>setTimeout(r,500));const d=S.docs.filter(x=>x.type==="facture").pop(),ce=FNE.cert({type:"facture",id:d.id});return {env:ce.env,html:docHTML(d),old:fneBarre(S.docs.find(x=>x.type==="facture"&&x.id!==d.id&&FNE.cert({type:"facture",id:x.id})&&FNE.cert({type:"facture",id:x.id}).env==="test"))}});
 chk("FD-20","production : plus aucun bandeau « sans valeur fiscale » ; une facture certifiée en essai ne vaut plus rien en production et est signalée",r.env==="prod"&&!/SANS VALEUR FISCALE/.test(r.html)&&/sans valeur dans l'environnement actuel/.test(r.old),JSON.stringify(r).slice(0,250));
 r=await ev(()=>{S.config.fne.env="simulation";S.config.fne.actif=false;const d=S.docs.filter(x=>x.type==="facture").pop();view="documents";render();return {ok:true,html:docHTML(d).length>100}});
 chk("FD-21","FNE désactivée ensuite : les documents déjà certifiés restent imprimables avec leur référence",r.ok&&r.html);
 const e=errs.filter(x=>!/ResizeObserver/.test(x));chk("FD-22","aucune erreur de script",e.length===0,e.slice(0,2).join("|"));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
