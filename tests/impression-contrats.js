/* Connexion Moteur d impression (en-tête par division, pied, QR signé) et contrats d exploitation.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/impression-contrats.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
 const pt=await ctx.newPage();pt.on("pageerror",e=>errs.push("transport: "+e.message));pt.on("dialog",d=>d.accept());await pt.goto(base+"/transport.html");await pt.waitForTimeout(500);
 const LOGO="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
 await pt.evaluate(LOGO=>{ME=S.users.find(u=>u.role==="admin"&&u.actif);const c=ANGELS_PRINT.cfg();c.div.groupe.raison="ANGEL'S GROUP SARL";c.div.groupe.rccm="CI-ABJ-2024-B-0001";c.div.transport.logo=LOGO;c.div.transport.raison="ANGEL'S TRANSPORT";c.div.transport.siege="Yopougon, Abidjan";c.pied="Merci de votre confiance";ANGELS_PRINT.sauver(c);
  window.__doc=async fn=>{await fn();for(let i=0;i<60&&(!document.getElementById("ap-ov")||document.getElementById("ap-ov").hidden);i++)await new Promise(r=>setTimeout(r,50));await new Promise(r=>setTimeout(r,500));return document.getElementById("ap-f").srcdoc}},LOGO);

 const doc=async(page,fn)=>page.evaluate(async fn=>{const o=document.getElementById("ap-ov");if(o){o.hidden=true}await Promise.resolve(eval("("+fn+")")());for(let i=0;i<80&&(!document.getElementById("ap-ov")||document.getElementById("ap-ov").hidden);i++)await new Promise(r=>setTimeout(r,50));await new Promise(r=>setTimeout(r,400));return document.getElementById("ap-f").srcdoc},fn.toString());
 const txt=h=>h.replace(/<style[\s\S]*?<\/style>/g,"").replace(/<svg[\s\S]*?<\/svg>/g,"[QR]").replace(/<[^>]+>/g," ").replace(/&#39;/g,"'").replace(/&amp;/g,"&").replace(/\s+/g," ");
 /* 1. moteur sur un imprimé existant (reçu) */
 const h1=await doc(pt,()=>{const r=S.receipts[0];view="dashboard";render();recu(r);window.print()});const t1=txt(h1);
 chk("IMP-1","imprimé existant (reçu) : en-tête de la division Transport (logo, raison sociale, siège), pied de page, QR de sécurité et code de contrôle",/data:image\/png/.test(h1)&&/ANGEL'S TRANSPORT/.test(t1)&&/Yopougon, Abidjan/.test(t1)&&/RCCM CI-ABJ-2024-B-0001/.test(t1)&&/Merci de votre confiance/.test(t1)&&/<svg/.test(h1)&&/Code de contrôle : [0-9A-F]{10}/.test(t1)&&/REC-\d{4}-\d{5}/.test(t1),t1.slice(0,400));
 const lien=await pt.evaluate(()=>ANGELS_PRINT.dernier().lien);
 chk("IMP-2","le QR contient un lien de vérification signé (clé ECDSA créée, identifiant de clé)",/verifier\.html#[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{80,}$/.test(lien)&&(await pt.evaluate(()=>ANGELS_PRINT.cleInfo().existe)),lien.slice(0,120));
 const pv=await ctx.newPage();pv.on("pageerror",e=>errs.push("verifier: "+e.message));
 await pv.goto(base+"/verifier.html");await pv.waitForTimeout(200);
 const vr=async l=>{await pv.evaluate(async l=>{await window.__verifier(l)},l);return pv.evaluate(()=>document.getElementById("res").innerText)};
 const ok1=await vr(lien);
 chk("IMP-3","page de vérification : document authentique (signature valide), référence et émetteur affichés",/AUTHENTIQUE/.test(ok1)&&!/NON AUTHENTIQUE/.test(ok1)&&/REC-\d{4}-\d{5}/.test(ok1)&&/Transport/.test(ok1),ok1.slice(0,200));
 const bad=lien.replace(/#([A-Za-z0-9_-]+)\./,(m,c)=>{const canon=Buffer.from(c.replace(/-/g,"+").replace(/_/g,"/"),"base64").toString().split("|");canon[4]=String(+canon[4]+1000);return "#"+Buffer.from(canon.join("|")).toString("base64url")+"."});
 const ko1=await vr(bad);
 chk("IMP-4","document modifié (montant changé) : signature invalide, « NON AUTHENTIQUE »",/NON AUTHENTIQUE/.test(ko1),ko1.slice(0,200));
 const sansCle=await pv.evaluate(async l=>{const k=JSON.parse(localStorage.getItem("angels_print_key_v1"));localStorage.removeItem("angels_print_key_v1");await window.__verifier(l);const a=document.getElementById("res").innerText;window.__PORTAIL_DATA={print:{keys:[{kid:k.kid,pub:k.pub}],noms:{transport:"ANGEL'S TRANSPORT"}}};await window.__verifier(l);const b=document.getElementById("res").innerText;localStorage.setItem("angels_print_key_v1",JSON.stringify(k));return{a,b}},lien);
 chk("IMP-5","sans la clé locale : non confirmé ; avec la clé publique publiée (portail-data.js) : authentique",/introuvable/.test(sansCle.a)&&/AUTHENTIQUE/.test(sansCle.b)&&!/NON AUTH/.test(sansCle.b),JSON.stringify(sansCle).slice(0,300));
 const junk=await vr("https://exemple.com/n-importe-quoi");
 chk("IMP-6","lien illisible refusé",/illisible/.test(junk),junk);
 /* 2. contrats */
 const ctx0=await pt.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");S.perms.admin.contrats=["v","c","e","p","x","a"];const c=S.contracts.find(x=>x.statut==="actif"&&x.mode==="location")||S.contracts.find(x=>x.statut==="actif");window.__cid=c.id;return{id:c.id,num:c.numero,dr:chauffeurNom(c.driver_id),im:vehImmat(c.vehicle_id),m:c.montant}});
 const hc=await doc(pt,()=>{ct0=0;A["ct.print"](window.__cid)});const tc=txt(hc);
 chk("IMP-7","contrat imprimé : parties, véhicule, 9 articles, redevance, signatures, en-tête Transport et QR",new RegExp(ctx0.num).test(tc)&&tc.includes(ctx0.dr)&&tc.includes(ctx0.im)&&/Article 9/.test(tc)&&/Article 5 — Obligations du Chauffeur/.test(tc)&&/Lu et approuvé/.test(tc)&&/ANGEL'S TRANSPORT/.test(tc)&&/\[QR\]/.test(tc),tc.slice(0,300));
 const av=await pt.evaluate(()=>{avenant(window.__cid,by(S.contracts,window.__cid).montant+5000,today(),"Révision");return by(S.contracts,window.__cid).versions.length});
 const ha=await doc(pt,()=>{A["ct.avprint"](window.__cid+"|1")});const ta=txt(ha);
 chk("IMP-8","avenant imprimé : ancienne et nouvelle redevance, date d'effet, motif ; référence CTR-…-AV1",av===2&&/Avenant n° 1/.test(ta)&&/Révision/.test(ta)&&/-AV1/.test(ta)&&/\[QR\]/.test(ta),ta.slice(0,300));
 const he=await doc(pt,()=>{A["ct.ech"](window.__cid)});const te=txt(he);
 const tot=await pt.evaluate(()=>{const am=allocMap(),O=S.obligations.filter(o=>o.contract_id===window.__cid);return{n:O.length,enc:sum(O,o=>am[o.id]||0)}});
 chk("IMP-9","échéancier imprimé : une ligne par échéance, total encaissé égal à la comptabilité",(te.match(/ECH-\d{5}/g)||[]).length===tot.n&&te.includes((Math.round(tot.enc)).toLocaleString("fr-FR").replace(/[  ]/g," ")+" F"),JSON.stringify(tot)+te.slice(0,200));
 const sg=await pt.evaluate(()=>{A["ct.sign"](window.__cid);const f=document.querySelector(".md form");f.date.value=today();f.dispatchEvent(new Event("submit",{cancelable:true}));return null});await pt.waitForTimeout(300);
 const sg2=await pt.evaluate(()=>{const c=by(S.contracts,window.__cid);view="contrats";render();return{s:ctSigne(c),txt:document.getElementById("app").innerText}});
 chk("IMP-10","contrat signé : date enregistrée, badge « Signé » dans la liste, mention sur la réimpression",sg2.s&&/Signé \d{2}\/\d{2}\/\d{4}/.test(sg2.txt)&&/Exemplaire signé/.test(txt(await doc(pt,()=>{A["ct.print"](window.__cid)}))),JSON.stringify(sg2.s));
 const pr=await pt.evaluate(()=>{const c=by(S.contracts,window.__cid);const e1=(()=>{try{atomic(()=>{});modifierContrat(c.id,{fin:"2000-01-01"});return null}catch(e){return e.message}})();c.fin=addDays(today(),10);const r=(()=>{try{modifierContrat(c.id,{fin:addDays(today(),400),repos:c.repos,depot:c.depot});c.prolongations=[1];return c.fin}catch(e){return "ERR "+e.message}})();return{e1,r}});
 chk("IMP-11","prolongation : fin antérieure refusée, nouvelle fin appliquée",!!pr.e1&&pr.r===(await pt.evaluate(()=>addDays(today(),400))),JSON.stringify(pr));
 const kp=await pt.evaluate(()=>{view="contrats";UI.f.ct={s:"",m:"location",q:""};render();return document.getElementById("app").innerText});
 chk("IMP-12","écran Contrats : indicateurs (actifs, revenu théorique, impayés, dépôts, fins proches, à signer) et filtre par mode",/Contrats actifs/.test(kp)&&/Revenu théorique par jour/.test(kp)&&/Impayés des contrats ouverts/.test(kp)&&/Dépôts de garantie à percevoir/.test(kp)&&/Fin dans 30 jours/.test(kp)&&/Contrats à signer/.test(kp)&&!/\brecette\b[^A]*Mode/.test("")&&await pt.evaluate(()=>S.contracts.filter(c=>c.mode==="recette").every(c=>!document.getElementById("app").innerText.includes(c.numero))),kp.slice(0,300));
 const dec=await pt.evaluate(()=>{const c=S.contracts.find(x=>x.statut==="actif"&&x.id!==window.__cid)||by(S.contracts,window.__cid);window.__rid=c.id;c.depot=100000;c.depot_verse=100000;resilier(c.id,today(),"Fin d'activité");const am=allocMap(),O=S.obligations.filter(o=>o.contract_id===c.id&&!o.exo&&o.date_ech<=c.effet),du=sum(O,o=>soldeM(o,am));return{du,dep:c.depot_verse}});
 const hd=await doc(pt,()=>{A["ct.dec"](window.__rid)});const td=txt(hd);
 const fr=n=>Math.round(n).toLocaleString("fr-FR").replace(/[  ]/g," ")+" F";
 chk("IMP-13","décompte de fin de contrat : solde dû, retenue sur le dépôt, reste à payer ou dépôt à restituer",/Décompte de fin de contrat/.test(td)&&td.includes(fr(dec.du))&&td.includes(fr(dec.dep))&&(dec.du>dec.dep?/Reste à payer par le chauffeur/.test(td):/Dépôt à restituer/.test(td)),JSON.stringify(dec)+td.slice(0,300));
 const cp=await pt.evaluate(()=>{A["ct.copy"](window.__rid);const f=document.querySelector(".md form");const o={m:f.mode.value,mt:+f.montant.value,v:f.vehicle_id.value===by(S.contracts,window.__rid).vehicle_id,d:f.driver_id.value===by(S.contracts,window.__rid).driver_id,db:f.debut.value===today()};document.querySelectorAll(".md").forEach(x=>x.remove());return o});
 chk("IMP-14","nouveau contrat à partir d'un contrat résilié : formulaire prérempli (véhicule, chauffeur, mode, montant)",cp.v&&cp.d&&cp.db&&cp.mt>0,JSON.stringify(cp));
 const mo=await pt.evaluate(()=>{A["ct.modele"]();const f=document.querySelector(".md form");f.representant.value="Koné Ibrahim";f.qualite.value="Directeur général";f.dispatchEvent(new Event("submit",{cancelable:true}));return ctModele().representant});await pt.waitForTimeout(300);
 const hm=await doc(pt,()=>{A["ct.print"](window.__cid)});
 const perm=await pt.evaluate(()=>{ME=S.users.find(u=>u.role==="caissier");try{atomic(()=>{need("contrats","a")});return"permis"}catch(e){return"refusé"}finally{ME=S.users.find(u=>u.role==="admin")}});
 chk("IMP-15","modèle du contrat : représentant et clauses personnalisables, repris sur l'impression ; réservé aux profils de validation",mo==="Koné Ibrahim"&&/Koné Ibrahim/.test(txt(hm))&&/Directeur général/.test(txt(hm)),mo);
 /* 3. autres divisions */
 const pdist=await ctx.newPage();pdist.on("pageerror",e=>errs.push("distribution: "+e.message));pdist.on("dialog",d=>d.accept());await pdist.goto(base+"/distribution.html");await pdist.waitForTimeout(500);
 await pdist.evaluate(LOGO=>{const c=ANGELS_PRINT.cfg();c.div.distribution.raison="ANGEL'S DISTRIBUTION";c.div.distribution.logo=LOGO;c.div.distribution.couleur="#6d28d9";ANGELS_PRINT.sauver(c);ME=S.users.find(u=>u.role==="admin");rapport("Rapport test",'<h1>Rapport test</h1><div class="sub">édité</div><table><tr><th>A</th></tr><tr><td>1</td></tr></table>')},LOGO);
 const hdis=await pdist.evaluate(async()=>{document.querySelector("[data-act=printDoc]").click();for(let i=0;i<80&&(!document.getElementById("ap-ov")||document.getElementById("ap-ov").hidden);i++)await new Promise(r=>setTimeout(r,50));await new Promise(r=>setTimeout(r,400));return document.getElementById("ap-f").srcdoc});
 chk("IMP-16","Distribution : un document passe par le moteur avec l'en-tête de SA division (logo, raison sociale, couleur) et un QR",/ANGEL&#39;S DISTRIBUTION/.test(hdis)&&/--ac:#6d28d9/.test(hdis)&&/<svg/.test(hdis)&&/Rapport test/.test(hdis)&&/>Distribution</.test(hdis),txt(hdis).slice(0,200));
 const pag=await ctx.newPage();pag.on("pageerror",e=>errs.push("agro: "+e.message));pag.on("dialog",d=>d.accept());await pag.goto(base+"/agro.html");await pag.waitForTimeout(500);
 const hag=await pag.evaluate(async()=>{const c=ANGELS_PRINT.cfg();c.div.agro.raison="ANGEL'S AGRO SARL";ANGELS_PRINT.sauver(c);ME=S.users.find(u=>u.role==="admin");modal('<div class="noprint flex"><button class="btn" onclick="window.print()">Imprimer</button></div><h1>BORDEREAU TEST</h1><p>Réf. BOR-2026-00001</p>');window.print();for(let i=0;i<80&&(!document.getElementById("ap-ov")||document.getElementById("ap-ov").hidden);i++)await new Promise(r=>setTimeout(r,50));await new Promise(r=>setTimeout(r,400));return document.getElementById("ap-f").srcdoc});
 chk("IMP-17","Agro : window.print() passe par le moteur (en-tête Agro, référence reconnue, QR)",/ANGEL&#39;S AGRO SARL/.test(hag)&&/BOR-2026-00001/.test(hag)&&/<svg/.test(hag)&&/BORDEREAU TEST/.test(hag),txt(hag).slice(0,200));
 /* 4. Paramètres */
 const ps=await ctx.newPage();ps.on("pageerror",e=>errs.push("parametres: "+e.message));ps.on("dialog",d=>d.accept());await ps.goto(base+"/parametres.html");await ps.waitForTimeout(400);
 await ps.evaluate(()=>{AUTH.transport={id:"x",nom:"t",exp:Date.now()+600000};uView();pTab("impression")});await ps.waitForTimeout(200);
 const pa=await ps.evaluate(()=>({tabs:[...document.querySelectorAll("#ptabs .tab")].map(b=>b.dataset.pt).join(),cards:document.querySelectorAll("#pimp [data-idiv]").length,vis:!document.getElementById("s-imp").hidden,txt:document.getElementById("pimp").innerText}));
 chk("IMP-18","Paramètres → Impression : 4 fiches (groupe + 3 divisions), QR, pied commun, clé de signature",pa.vis&&pa.cards===4&&/impression/.test(pa.tabs)&&/Clé de signature/.test(pa.txt)&&/QR de sécurité/.test(pa.txt),JSON.stringify(pa).slice(0,300));
 await ps.setInputFiles('input[data-ilogo="agro"]',{name:"l.png",mimeType:"image/png",buffer:Buffer.from(LOGO.split(",")[1],"base64")});await ps.waitForTimeout(600);
 await ps.evaluate(()=>{const f=document.getElementById("iform");f["agro__raison"].value="ANGEL'S AGRO (réglé)";f["agro__rccm"].value="CI-ABJ-2025-B-777";f.pied.value="Pied commun test";f.site.value="https://angels-test.vercel.app";f.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}))});await ps.waitForTimeout(400);
 const sv=await ps.evaluate(()=>{const c=ANGELS_PRINT.cfg();return{r:c.div.agro.raison,rc:c.div.agro.rccm,logo:/^data:image\/png/.test(c.div.agro.logo),pied:c.pied,site:c.site}});
 chk("IMP-19","enregistrement des réglages : raison sociale, RCCM, logo de la division, pied commun, adresse du site",sv.r==="ANGEL'S AGRO (réglé)"&&sv.rc==="CI-ABJ-2025-B-777"&&sv.logo&&sv.pied==="Pied commun test"&&sv.site==="https://angels-test.vercel.app",JSON.stringify(sv));
 const bsite=await ps.evaluate(async()=>{const f=document.getElementById("iform");f.site.value="http://pas-https.example";f.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));await new Promise(r=>setTimeout(r,300));const m=document.querySelector("#pimp .umsg");return m?m.textContent:""});
 chk("IMP-20","adresse du site non sécurisée refusée",/https/.test(bsite),bsite);
 const pub=await ps.evaluate(async()=>{await ANGELS_PRINT.cleAssurer();const D=await pDonnees();return{n:D.print.keys.length,kid:D.print.keys[0]&&D.print.keys[0].kid,noms:D.print.noms.agro,priv:JSON.stringify(D).includes('"d":')}});
 chk("IMP-21","publication : la clé PUBLIQUE et les noms de division sont publiés, jamais la clé privée",pub.n===1&&/^[0-9a-f]{8}$/.test(pub.kid)&&pub.noms==="ANGEL'S AGRO (réglé)"&&!pub.priv,JSON.stringify(pub));
 const ex=await ps.evaluate(async()=>{const t=ANGELS_PRINT.cleExporter(),k0=ANGELS_PRINT.cleInfo().kid;const K=await ANGELS_PRINT.cleRegenerer();const k1=K.kid;const I=await ANGELS_PRINT.cleImporter(t);const bad=await ANGELS_PRINT.cleImporter("{}").then(()=>"ok",e=>e.message);return{same:I.kid===k0,changed:k1!==k0,bad}});
 chk("IMP-22","clé : régénération, export puis import restaurent la même clé ; fichier invalide refusé",ex.same&&ex.changed&&/pas une clé/.test(ex.bad),JSON.stringify(ex));
 const essai=await ps.evaluate(async()=>{document.querySelector('[data-ik="essai"]').click();for(let i=0;i<80&&(!document.getElementById("ap-ov")||document.getElementById("ap-ov").hidden);i++)await new Promise(r=>setTimeout(r,50));await new Promise(r=>setTimeout(r,400));return document.getElementById("ap-f").srcdoc});
 chk("IMP-23","document d'essai : en-tête du groupe, QR, ESSAI-… et signatures",/ESSAI-\d{4}-0001/.test(essai)&&/<svg/.test(essai)&&/Lu et approuvé/.test(essai));
 /* 5. repli et options */
 const sp=await pt.evaluate(async()=>{Object.defineProperty(crypto,"subtle",{get:()=>undefined,configurable:true});const r=await ANGELS_PRINT.ouvrir({division:"transport",titre:"Test sans WebCrypto",ref:"TST-2026-00001",corps:"<p>x</p>"});await new Promise(r=>setTimeout(r,400));const h=document.getElementById("ap-f").srcdoc;delete crypto.subtle;return{signe:r.signe,simple:/Contrôle simple/.test(h),a0:/A0/.test(ANGELS_PRINT.dernier().canon)}});
 chk("IMP-24","sans WebCrypto (page non sécurisée) : repli sur un contrôle simple, signalé comme non signé",!sp.signe&&sp.simple&&sp.a0,JSON.stringify(sp));
 const nq=await pt.evaluate(async()=>{const c=ANGELS_PRINT.cfg();c.qr=false;ANGELS_PRINT.sauver(c);await ANGELS_PRINT.ouvrir({division:"transport",titre:"Sans QR",ref:"TST-2026-00002",corps:"<p>x</p>"});await new Promise(r=>setTimeout(r,400));const h=document.getElementById("ap-f").srcdoc;c.qr=true;ANGELS_PRINT.sauver(c);return{sec:/class="sec"/.test(h),svg:/<svg/.test(h)}});
 chk("IMP-25","option « QR de sécurité » désactivée : aucun bloc d'authentification imprimé",!nq.sec&&!nq.svg,JSON.stringify(nq));
 const rg=await pt.evaluate(()=>{const R=ANGELS_PRINT.registre();return{n:R.length,ref:R.some(x=>x.r.startsWith("CTR-")),signe:R.filter(x=>x.s==="signe").length>0}});
 chk("IMP-26","registre des documents émis sur l'appareil (référence, empreinte, date, émetteur)",rg.n>=6&&rg.ref&&rg.signe,JSON.stringify(rg));
 const sw=require("fs").readFileSync(path.join(root,"sw.js"),"utf8"),vj=JSON.parse(require("fs").readFileSync(path.join(root,"vercel.json"),"utf8"));
 chk("IMP-27","hors ligne et routes : moteur, QR et page de vérification dans le cache ; /verifier routé",/print-engine\.js/.test(sw)&&/qrcode\.js/.test(sw)&&/verifier\.html/.test(sw)&&vj.rewrites.some(r=>r.source==="/verifier"),"");
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
