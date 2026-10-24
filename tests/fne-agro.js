/* Facture normalisée électronique (FNE) dans Agro : réglages, facture simple ou certifiée, impression, annulation par avoir FNE total, essai DGI via le serveur, certification automatique.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/fne-agro.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),p=await ctx.newPage(),errs=[],posts=[],dialogs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>{dialogs.push(d.message());d.accept()});
 await ctx.route("**/functions/v1/fne",async r=>{const b=JSON.parse(r.request().postData());posts.push(b);
  if(b.action==="avoir")return r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,reponse:{ncc:"9606123E",reference:"A9606123E2500000006",token:"http://x/av",warning:false,balance_sticker:178}})});
  const it=b.payload.items.map((i,k)=>({id:"it-000000"+k,quantity:i.quantity,reference:i.reference,description:i.description,amount:i.amount})),tot=Math.round(b.payload.items.reduce((a,i)=>a+i.quantity*i.amount*(1+(i.taxes[0]==="TVA"?.18:0)),0));
  r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,rejoue:false,reponse:{ncc:"9606123E",reference:"9606123E25000000020",token:"http://54.247.95.108/fr/verification/x",warning:false,balance_sticker:150,invoice:{id:"e2b2d8da-a532-4c08-9182-f5b428ca468d",amount:tot,vatAmount:0,items:it}}})})});
 await p.goto(base+"/agro.html");await p.waitForTimeout(500);
 await p.evaluate(()=>{window.__D=[];window.alert=m=>__D.push(String(m));window.confirm=()=>true;window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};__as("admin");
  window.__vente=(cl)=>{const c=cl||S.clients[0],pr=S.produits.find(x=>x.categorie==="fini");S.mvts.push({id:uid("mv"),produit_id:pr.id,sens:"entree",qte:500,pu:100,motif:"Test",date:today(),source:{type:"test"}});return creerVente({date:today(),client_id:c.id,lignes:[{type:"stock",produit_id:pr.id,qte:30,pu:2500}],paye:0,mode:"especes"})}});
 const ev=(fn,a)=>p.evaluate(fn,a);

 let r=await ev(()=>{const v=__vente();return {fne:S.settings.fne.actif,env:S.settings.fne.env,certs:Array.isArray(S.fne_certs),badge:fneBadge(v)}});
 chk("FA-1","FNE inactive par défaut : réglages en simulation, facture simple sans mention ni badge",r.fne===false&&r.env==="simulation"&&r.certs&&r.badge==="",JSON.stringify(r));
 await ev(()=>{view="params";UI.tab.par="fne";render()});
 chk("FA-2","Paramétrage → onglet « Facturation FNE » : réglages, avertissement sur la clé gardée côté serveur",await ev(()=>/Activer la facturation FNE/.test(document.body.innerHTML)&&/jamais/.test(document.body.innerHTML)));
 const sauve=o=>ev(o=>{const set=(i,v)=>{const e=document.querySelector(i);if(e.type==="checkbox")e.checked=!!v;else e.value=v};set("#f_actif",o.actif);set("#f_env",o.env);set("#f_ncc",o.ncc);set("#f_etab",o.etab);set("#f_pv",o.pv);set("#f_auto",o.auto);set("#f_tel","0700000000");set("#f_mail","compta@agro.ci");__D.length=0;A["fne.save"]();return __D.join("|")},o).then(m=>m);
 let m=await sauve({actif:true,env:"simulation",ncc:"x",etab:"Ferme",pv:"01",auto:false});
 chk("FA-3","NCC invalide refusé",/NCC invalide/.test(m)&&!(await ev(()=>S.settings.fne.actif)),m);
 await ev(()=>{__as("magasinier")});m=await sauve({actif:true,env:"simulation",ncc:"9606123E",etab:"Ferme",pv:"01",auto:false});
 chk("FA-4","un magasinier ne peut pas modifier les réglages FNE",/insuffisants|Droits/.test(m)&&!(await ev(()=>S.settings.fne.actif)),m);
 await ev(()=>{__as("admin")});m=await sauve({actif:true,env:"simulation",ncc:"9606123e",etab:"",pv:"",auto:false});
 chk("FA-5","réglages enregistrés (NCC en majuscules)",/enregistrés/.test(m)&&await ev(()=>S.settings.fne.actif&&S.settings.fne.ncc==="9606123E"),m);
 r=await ev(async()=>{const v=__vente();__D.length=0;await fneCertifier(v.id,false);return {cert:FNE.cert(fneSrc(v)),msg:__D.join("|")}});
 chk("FA-6","réglages incomplets (établissement, point de vente) : certification refusée AVANT envoi, aucun enregistrement créé",r.cert===null&&/Établissement/.test(r.msg)&&/Point de vente/.test(r.msg),JSON.stringify(r).slice(0,200));
 await ev(()=>{S.settings.fne.etablissement="ANGEL'S AGRO";S.settings.fne.point_vente="01"});
 r=await ev(async()=>{const v=__vente();const b0=fneBarreVente(v);await fneCertifier(v.id,false);const c=FNE.cert(fneSrc(v));const h=(document.querySelector(".md")||{innerHTML:""}).innerHTML;window.__vid=v.id;view="ventes";UI.tab.ventes="v";render();return {b0,statut:c.statut,ref:c.ref,env:c.env,h,liste:document.body.innerHTML,id:v.id}});
 chk("FA-7","facture simple d'abord (bouton « Certifier FNE ») puis certifiée en simulation : référence SIM…, facture imprimée avec bloc « FACTURE NORMALISÉE » et mention SANS VALEUR FISCALE, badge dans la liste",/Certifier FNE/.test(r.b0)&&r.statut==="certifiee"&&/^SIM/.test(r.ref)&&/FACTURE NORMALISÉE ÉLECTRONIQUE/.test(r.h)&&/SIMULATION — DOCUMENT DE FORMATION/.test(r.h)&&/FNE simulation/.test(r.liste),JSON.stringify(r).slice(0,300));
 r=await ev(()=>{const c=S.clients[1];c.ncc="9502363n";const v=__vente(c);const k=ANGELS_FNE.cfg(S.settings.fne),p=ANGELS_FNE.construire(fneFacture(v),k);return {tpl:p.template,ncc:p.clientNcc,unite:p.items[0].unite,tva:p.items[0].taxes[0],ttc:ANGELS_FNE.totaux(p).ttc,tot:v.total,err:ANGELS_FNE.valider(p,k)}});
 chk("FA-8","client avec NCC → B2B ; prix TTC convertis (TVA 0 % de l'exploitation → exonération), total identique à la facture",r.tpl==="B2B"&&r.ncc==="9502363N"&&r.tva==="TVAC"&&r.ttc===r.tot&&r.err.length===0,JSON.stringify(r));
 r=await ev(async()=>{const id=window.__vid;const v=by(S.ventes,id);A["vt.ann"](id);const f=document.querySelector(".md form");f.elements.motif.value="Erreur de client";f.requestSubmit();await new Promise(r=>setTimeout(r,500));return {statut:by(S.ventes,id).statut,avoirs:S.fne_certs.filter(c=>c.kind==="avoir"&&c.src.id===id).length,items:(S.fne_certs.filter(c=>c.kind==="avoir"&&c.src.id===id)[0]||{}).items}});
 chk("FA-9","annulation d'une vente certifiée : l'avoir FNE total est certifié d'abord (toutes les lignes), puis la vente est annulée",r.statut==="annule"&&r.avoirs===1&&r.items&&r.items.length>=1,JSON.stringify(r));
 r=await ev(()=>{const v=__vente();S.settings.fne.env="test";localStorage.setItem("angels_sync",JSON.stringify({actif:true,cle:"K".repeat(32)}));localStorage.setItem("angels_supabase",JSON.stringify({url:"https://projet.supabase.co"}));return v.id});
 const id2=r;await ev(async id=>{await fneCertifier(id,false)},id2);
 const sg=posts.filter(x=>x.action==="signer").pop();
 chk("FA-10","essai DGI : envoi au serveur (app agro, env test), référence DGI conservée, bandeau « environnement de test » à l'impression",!!sg&&sg.app==="agro"&&sg.env==="test"&&sg.payload.pointOfSale==="01"&&(await ev(id=>{const c=FNE.cert(fneSrc(by(S.ventes,id)));return c.ref==="9606123E25000000020"&&c.solde_stickers===150&&/ENVIRONNEMENT DE TEST DGI/.test(ANGELS_FNE.bloc(c,fneQr,esc))},id2)),JSON.stringify(sg).slice(0,200));
 r=await ev(async()=>{S.settings.fne.env="simulation";S.settings.fne.auto=true;const v=__vente();await new Promise(r=>setTimeout(r,300));return FNE.cert(fneSrc(v))&&FNE.cert(fneSrc(v)).statut});
 chk("FA-11","mode « facture normalisée par défaut » : la vente est certifiée automatiquement après sa création",r==="certifiee",r);
 const e=errs.filter(x=>!/ResizeObserver/.test(x));chk("FA-12","aucune erreur de script",e.length===0,e.slice(0,2).join("|"));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
