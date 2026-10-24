/* Finances livreur : droits des profils, plafond de paiement, avance justifiée, mode de paiement, alerte caisse fermée, écart rejeté imputé au livreur.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/finances-livreur.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),p=await ctx.newPage(),errs=[];
 p.on("pageerror",e=>errs.push("PAGEERR "+e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/distribution.html");await p.waitForTimeout(300);
 await p.evaluate(()=>{window.__T=[];toast=(m)=>{__T.push(m)};window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};__as("admin")});
 let ok=0,ko=0;const t=async(id,label,fn)=>{let r;try{r=await p.evaluate(fn)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",r)}};
 const pre=`window.__prep=()=>{ME=S.users.find(u=>u.role==="admin"&&u.actif);window.__lv=S.livreurs.find(l=>l.type!=="externe")||S.livreurs[0];window.__ouvrirCaisse=()=>{const c=(S.caisses||[]).find(x=>x.actif);if(c&&!cxOpen(c))cxOuvrirLocal(c,0,"test")}};`;
 await p.evaluate(pre);
 await p.evaluate(()=>{__prep();__ouvrirCaisse()});
 await t("FN-1","droits : un préparateur est refusé (paiement, reversement, versement, écart) ; admin, caissier et superviseur passent",()=>{const E=[],lv=__lv,cl=name=>{const b=document.createElement("button");b.dataset.act=name;b.dataset.id=lv.id;document.body.appendChild(b);b.click();b.remove()};
  ME=S.users.find(u=>u.role==="preparateur"&&u.actif);let msgs=[];const tt=toast;window.toast=m=>msgs.push(m);
  for(const a of["payer","reverser","ecartOk","ecartKo","versOk","versNo"]){document.querySelector("#mf")&&closeModal();msgs=[];cl(a);if(!msgs.some(m=>/Accès refusé/.test(m)))E.push("ouvert:"+a);if(document.querySelector("#mf"))E.push("modale:"+a)}
  let thr=false;try{payerLivreur(lv.id,{t:"commission",m:1,mode:"Espèces"})}catch(x){thr=/Accès refusé/.test(x.message)}if(!thr)E.push("payerLivreur");
  ME=S.users.find(u=>u.role==="caissier"&&u.actif);if(ME){msgs=[];cl("payer");if(msgs.some(m=>/Accès refusé/.test(m)))E.push("caissier refusé");closeModal()}
  ME=S.users.find(u=>u.role==="superviseur"&&u.actif);if(ME){msgs=[];cl("ecartOk");if(msgs.some(m=>/Accès refusé/.test(m)))E.push("superviseur refusé");closeModal()}
  window.toast=tt;__prep();return E.length?E.join(","):true});
 await t("FN-2","plafond : une commission ne peut pas dépasser le reste dû",()=>{__prep();const lv=__lv,r=commAcquise(lv.id)-commPayee(lv.id);let b=false;try{payerLivreur(lv.id,{t:"commission",m:Math.max(r,0)+1,mode:"Espèces"})}catch(x){b=/supérieur au reste/.test(x.message)}const n=S.paie.length;return b&&S.paie.length===n?true:"dépassement accepté"});
 await t("FN-3","avance : justification obligatoire, plafond cumulé, pas de plafond contourné par plusieurs avances",()=>{__prep();const lv=__lv,E=[],thr=(f,re)=>{try{f();return false}catch(x){return re.test(x.message)}};S.config.avance_max=10000;
  if(!thr(()=>payerLivreur(lv.id,{t:"avance",m:1000,mode:"Espèces",note:""}),/Justification/))E.push("sans motif");
  const base=-(commAcquise(lv.id)-commPayee(lv.id));if(!thr(()=>payerLivreur(lv.id,{t:"avance",m:10001+Math.max(0,base),mode:"Espèces",note:"urgence"}),/limitées/))E.push("plafond");
  payerLivreur(lv.id,{t:"avance",m:6000,mode:"Espèces",note:"urgence"});const deja=Math.max(0,commPayee(lv.id)-commAcquise(lv.id));
  if(deja>0&&!thr(()=>payerLivreur(lv.id,{t:"avance",m:10000-deja+1,mode:"Espèces",note:"suite"}),/limitées/))E.push("cumul");S.config.avance_max=50000;return E.length?E.join(","):true});
 await t("FN-4","mode de paiement : espèces → mouvement de caisse ; Mobile Money → pas de caisse, référence exigée et unique",()=>{__prep();__ouvrirCaisse();const lv=__lv,E=[],mm=S.config.modes.find(estMobile),m0=(S.caisse_mvts||[]).length;
  S.config.avance_max=1e6;payerLivreur(lv.id,{t:"avance",m:1000,mode:"Espèces",note:"test espèces"});if((S.caisse_mvts||[]).length!==m0+1)E.push("espèces sans caisse");
  const m1=(S.caisse_mvts||[]).length;let b=false;try{payerLivreur(lv.id,{t:"avance",m:1000,mode:mm,ref:"",note:"mobile"})}catch(x){b=/Référence/.test(x.message)}if(!b)E.push("réf MM");
  const pa=payerLivreur(lv.id,{t:"avance",m:1000,mode:mm,ref:"MM-TEST-77",note:"mobile"});if((S.caisse_mvts||[]).length!==m1)E.push("MM en caisse");if(pa.mode!==mm||pa.ref!=="MM-TEST-77")E.push("champs");
  let b2=false;try{payerLivreur(lv.id,{t:"avance",m:1000,mode:mm,ref:"mm-test-77",note:"mobile"})}catch(x){b2=/déjà enregistrée/.test(x.message)}if(!b2)E.push("réf unique");
  const e=cptAuto().find(x=>x.id==="paie:"+pa.id);if(!e||e.journal!=="MM")E.push("compta "+(e&&e.journal));S.config.avance_max=50000;return E.length?E.join(","):true});
 await t("FN-5","caisse fermée : alerte visible, mise en attente (rangée à l'ouverture), journal d'audit, aucun mouvement fantôme",()=>{__prep();const lv=__lv,c=(S.caisses||[]).find(x=>x.actif),E=[];S.config.avance_max=1e6;
  if(c&&cxOpen(c)){const s=cxOpen(c);s.statut="cloturee"}
  let msgs=[];const tt=toast;window.toast=m=>msgs.push(m);const m0=(S.caisse_mvts||[]).length,a0=S.audit.length;payerLivreur(lv.id,{t:"avance",m:1000,mode:"Espèces",note:"caisse fermée"});window.toast=tt;
  if(!msgs.some(m=>/Caisse fermée.*EN ATTENTE/.test(m)))E.push("pas d'alerte");if((S.caisse_mvts||[]).length!==m0)E.push("mouvement créé");if(!(S.caisse_file||[]).some(x=>x.type==="sortie"&&x.montant===1000))E.push("pas mis en attente");if(!S.audit.slice(a0).some(a=>/en attente \(caisse fermée\)/i.test(a.action||a.a||JSON.stringify(a))))E.push("audit");S.config.avance_max=50000;return E.length?E.join(","):true});
 await t("FN-6","écart rejeté : le manque est imputé au livreur (solde à reverser, commande soldée), une seule fois ; écart accepté : rien",()=>{__prep();const lv=__lv,E=[],c=S.commandes.find(c=>c.statut==="prete");
  const mk=(ec)=>{const l={id:uid("l"),commande_id:c.id,livreur_id:lv.id,statut:"livree",ecart:ec,ecart_statut:"a_valider",montant_attendu:5000,hist:[]};S.livraisons.push(l);return l};
  const s0=soldeLiv(lv.id),so0=soldeCmd(c),l1=mk(-2000);imputerEcart(l1);if(soldeLiv(lv.id)!==s0+2000)E.push("solde livreur "+(soldeLiv(lv.id)-s0));if(soldeCmd(c)!==Math.max(0,so0-2000))E.push("solde commande");
  imputerEcart(l1);if(soldeLiv(lv.id)!==s0+2000)E.push("double imputation");
  const l2=mk(1500);imputerEcart(l2);if(soldeLiv(lv.id)!==s0+2000)E.push("surplus imputé");
  const l3=mk(-700);ACT.ecartKo(l3.id);const f=document.querySelector("#mf");if(f){const i=f.querySelector("input,textarea");if(i)i.value="non";f.requestSubmit?f.requestSubmit():f.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}))}
  if(l3.ecart_statut!=="rejete"||soldeLiv(lv.id)!==s0+2700)E.push("via l'écran "+l3.ecart_statut+" "+(soldeLiv(lv.id)-s0));
  const l4=mk(-300);ACT.ecartOk(l4.id);const g=document.querySelector("#mf");if(g){const i=g.querySelector("input,textarea");if(i)i.value="ok";g.requestSubmit?g.requestSubmit():g.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}))}
  if(l4.ecart_statut!=="valide"||soldeLiv(lv.id)!==s0+2700)E.push("accepté a imputé");return E.length?E.join(","):true});
 await t("FN-7","paramètre : avance maximale réglable dans Paramètres",()=>{__prep();view="params";render();const i=document.getElementById("p_am");if(!i)return"champ absent";i.value="12345";ACT.saveParams();return S.config.avance_max===12345&&avanceMax()===12345?(S.config.avance_max=50000,true):"valeur "+S.config.avance_max});
 console.log(errs.length?errs.join("\n"):"");console.log(`RÉSULTAT : ${ok} réussis, ${ko} échecs`);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
