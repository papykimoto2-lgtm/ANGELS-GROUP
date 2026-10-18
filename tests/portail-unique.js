/* Portail unique du groupe : réglages dans les Paramètres du Hub, page publique portail.html, sécurité des liens.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/portail-unique.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1200,height:1000}}),errs=[];let ok=0,ko=0;
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/transport.html");await p.waitForTimeout(500);
 await p.evaluate(()=>{window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};
  window.__try=fn=>{const snap=JSON.stringify(S),me=ME&&ME.id;try{fn();return null}catch(e){S=JSON.parse(snap);ME=me?by(S.users,me):null;return e.message}};
  window.__sc=(c,f)=>sum(S.entries.flatMap(e=>e.lines.filter(l=>l.compte===c&&(!f||f(l,e)))),l=>(l.debit||0)-(l.credit||0));
  window.__ach=o=>acheterVehicule(Object.assign({date:today(),fournisseur:"Auto Import SARL",marque:"Toyota",modele:"Corolla",annee:2020,vin:"VIN-"+Math.random().toString(36).slice(2,8).toUpperCase(),prix:1180000,paye:1180000,mode:"banque",km:30000},o));
  window.__vente=(vid,o)=>vendreVehicule(Object.assign({vn_id:vid,date:today(),client:"Kouassi Yao",prix:1534000,mode:"banque"},o));
  __as("admin");S.settings.tva_taux=18;S.attachments.push({id:"at_test",nom:"p.pdf",type:"application/pdf",taille:5,t:now(),par:"t",data:"data:application/pdf;base64,AAAA"})});
 const t=async(id,label,fn,arg)=>{let r;try{r=await p.evaluate(fn,arg)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",typeof r==="string"?r:JSON.stringify(r))}};

 const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
 // jeton de boutique réel, construit par Distributions
 const pd=await ctx.newPage();pd.on("pageerror",e=>errs.push("distribution: "+e.message));pd.on("dialog",d=>d.accept());await pd.goto(base+"/distribution.html");await pd.waitForTimeout(400);
 const tok=await pd.evaluate(()=>{const z=S.config.zones.slice(0,2).map(z=>[z.nom,Math.round(z.frais||0)]);const pr=S.produits.filter(p=>p.actif).slice(0,2).map(p=>[p.code,p.nom,Math.round(p.prix),Math.max(0,Math.floor(p.stock))]);return{t:b64({o:"ANGEL'S",w:"0707000000",z,p:pr,m:["Wave 0707000000"],t:Date.now()}),zone:z[0][0],code:pr[0][0],nom:pr[0][1]}});
 const pp=await ctx.newPage();pp.on("pageerror",e=>errs.push("portail: "+e.message));pp.on("dialog",d=>d.accept());
 await pp.goto(base+"/portail.html");await pp.waitForTimeout(400);
 let tx=await pp.evaluate(()=>document.body.innerText);
 const hrefs=await pp.evaluate(()=>[...document.querySelectorAll("a[href]")].map(a=>a.getAttribute("href")));
 chk("PTL-1","modèle Menko : bandeau défilant, « Mon espace », parcours 1 Découvrir · 2 Comprendre · 3 Passer à l'action, menu Activités, héros, atouts ; AUCUN lien vers une application de gestion",
  /Commandez en ligne, livraison rapide/.test(tx)&&/MON ESPACE/.test(tx)&&/DÉCOUVRIR/.test(tx)&&/COMPRENDRE/.test(tx)&&/PASSER À L'ACTION/.test(tx)&&/ACTIVITÉS/.test(tx)&&/Livraison rapide/.test(tx)&&/Nos activités/.test(tx)&&!hrefs.some(h=>/(distribution|transport|agro|index|parametres|compta-groupe|hub)\.html|^vendeur$/i.test(h))&&!/Espace chauffeur|Accès équipe/.test(tx),JSON.stringify(hrefs));
 const nav=await pp.evaluate(async()=>{const o={};const go=async p=>{document.querySelector('[data-go="'+p+'"]').click();await new Promise(r=>setTimeout(r,150));return document.getElementById("page").innerText};
  o.dd=(()=>{document.querySelector('[data-dd="act-menu"]').click();return document.getElementById("act-menu").classList.contains("open")&&/Distributions/.test(document.getElementById("act-menu").innerText)})();
  o.act=await go("act1");o.bout=await go("boutique");o.vend=await go("vendeur");o.soc=await go("societe");o.faq=await go("faq");o.ct=await go("contact");
  document.querySelector('[data-dd="espace-menu"]').click();o.esp=await go("espace-client");o.espv=await go("espace-vendeur");o.hash=location.hash;return o});
 chk("PTL-2","navigation par pages : activité (menu), boutique, vendeur partenaire, société, FAQ, contact, espace client et espace vendeur (sans accès aux applications)",nav.dd&&/Distributions/.test(nav.act)&&/ouvre bientôt/.test(nav.bout)&&/Devenir vendeur|Nom ou nom/.test(nav.vend)&&/Notre société/.test(nav.soc)&&/Questions fréquentes/.test(nav.faq)&&/Nous contacter/.test(nav.ct)&&/Suivre ma commande/.test(nav.esp)&&/déjà partenaire/.test(nav.espv)&&nav.hash==="#/espace-vendeur",JSON.stringify(nav).slice(0,400));
 const ps=await ctx.newPage();ps.on("pageerror",e=>errs.push("parametres: "+e.message));ps.on("dialog",d=>d.accept());
 await ps.goto(base+"/parametres.html");await ps.waitForTimeout(300);
 const ro=await ps.evaluate(()=>{const f=document.getElementById("pform");f.nom.value="Pirate";f.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));return{btn:f.querySelector("button.sb").disabled,k:localStorage.getItem(PKEY),m:document.getElementById("ptl").innerText.slice(0,200)}});
 chk("PTL-3","Paramètres : lecture seule sans administrateur déverrouillé ; enregistrement refusé, rien d'écrit",ro.btn&&ro.k===null&&/Déverrouill/.test(ro.m),JSON.stringify(ro));
 const bad=await ps.evaluate(t=>{AUTH.dist={id:"x",nom:"t",exp:Date.now()+60000};pView();const out=[];const f=()=>document.getElementById("pform"),go=()=>{f().dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));return document.getElementById("ptl").innerText};
  f().hvideo.value="javascript:alert(1)";out.push(/Vidéo/.test(go()));f().hvideo.value="";
  f().boutique.value="n'importe quoi";out.push(/Lien de boutique invalide/.test(go()));
  f().boutique.value="";f().email.value="x";out.push(/e-mail invalide/.test(go()));f().email.value="";
  f().act0.checked=true;f().nm0.value="";out.push(/le nom est obligatoire/.test(go()));f().nm0.value="Distributions";return out},tok);
 chk("PTL-4","contrôles : vidéo non https, lien de boutique invalide, e-mail invalide, activité sans nom refusés",bad.every(Boolean),JSON.stringify(bad));
 const sv=await ps.evaluate(t=>{const f=document.getElementById("pform");f.nm0.value="Livraison express";f.tx0.value="Livré en 2 h";f.dt0.value="Nous livrons en moins de 2 heures.";f.act2.checked=false;f.bandeau.value="🎉 Ouverture de la boutique\n🚚 Livraison gratuite ce week-end";f.stats.value="500 | Clients livrés\n3 | Activités";f.at_t0.value="Rapide";f.at_x0.value="En 2 h";f.avis.value="Awa | Très rapide, merci !";
  f.email.value="contact@exemple.ci";f.nom.value="Menko Test";f.couleur.value="#b45309";f.slogan.value="Slogan <b>test</b>";f.tel.value="0707000000";f.whatsapp.value="0707000000";f.boutique.value="https://exemple.ci/distribution.html#boutique="+t.t;f.faq.value="Où livrez-vous ? | Partout à Abidjan";
  f.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));const c=JSON.parse(localStorage.getItem(PKEY)||"null");return c&&{nom:c.nom,b:c.boutique===t.t,na:c.activites.filter(a=>a.actif).length,nb:c.bandeau.length,ns:c.stats.length,av:c.avis.length,v:c.v,old:c.services===undefined&&c.entrees===undefined,m:document.getElementById("ptl").innerText.slice(0,60)}},tok);
 chk("PTL-5","administrateur déverrouillé : identité, bandeau, accueil, activités, avis, contact, boutique (jeton extrait du lien) et FAQ enregistrés",sv&&sv.nom==="Menko Test"&&sv.b&&sv.na===2&&sv.nb===2&&sv.ns===2&&sv.av===1&&sv.v===5&&sv.old&&/enregistré/.test(sv.m),JSON.stringify(sv));
 await pp.goto(base+"/portail.html");await pp.waitForTimeout(400);
 tx=await pp.evaluate(()=>document.body.innerText);
 chk("PTL-6","le portail affiche les réglages : nom, slogan échappé, bandeau, chiffres clés, activités, rubrique Avis",/Menko Test/i.test(tx)&&/Slogan <b>test<\/b>/.test(tx)&&/Ouverture de la boutique/.test(tx)&&/clients livrés/i.test(tx)&&/Livraison express/.test(tx)&&/AVIS/.test(tx),tx.slice(0,500));
 // commande
 await pp.goto(base+"/portail.html#/boutique");await pp.waitForTimeout(400);
 const cmd=await pp.evaluate(async t=>{const out={};const e=id=>document.getElementById(id);document.getElementById("b_send").click();out.v1=e("b_err").textContent;
  document.querySelector('.bp[data-c="'+t.code+'"] [data-b="+"]').click();document.querySelector('.bp[data-c="'+t.code+'"] [data-b="+"]').click();
  e("b_send").click();out.v2=e("b_err").textContent;e("b_nom").value="Awa Koné";e("b_tel").value="0102030405";e("b_send").click();out.v3=e("b_err").textContent;
  e("b_zone").value=t.zone;e("b_zone").dispatchEvent(new Event("change"));e("b_send").click();out.v4=e("b_err").textContent;e("b_q").value="Cocody";
  document.querySelector('[name=b_pm][value=mm]').click();e("b_send").click();out.v5=e("b_err").textContent;e("b_rf").value="MP260101.1234";e("b_send").click();
  out.msg=(document.querySelector("#shop textarea.msg")||{}).value||"";out.wa=(document.querySelector("#shop a.go")||{}).href||"";return out},tok);
 chk("PTL-7","commande en ligne : contrôles pas à pas (produit, nom, téléphone, zone, adresse, référence Mobile Money) puis message WhatsApp avec marqueur [BOUTIQUE:…] vers le numéro publié",/produit/.test(cmd.v1)&&/nom/.test(cmd.v2)&&/zone/.test(cmd.v3)&&/quartier|repère/.test(cmd.v4)&&/Mobile Money/.test(cmd.v5)&&/\[BOUTIQUE:[A-Za-z0-9_-]+\]/.test(cmd.msg)&&/wa\.me\/2250707000000/.test(cmd.wa),JSON.stringify(cmd).slice(0,600));
 const imp=await pd.evaluate(m=>{ME=S.users.find(u=>u.role==="admin");const r=webImporter(m);const c=S.commandes.find(c=>c.numero===r.ok[0].numero);return{ok:r.ok.length,ko:r.ko,canal:c.canal,total:c.total,mm:c.web&&c.web.pm}},cmd.msg);
 chk("PTL-8","la commande du portail s'importe dans Distributions (canal « Vente en ligne », Mobile Money à vérifier, prix recalculés)",imp.ok===1&&imp.ko.length===0&&imp.canal==="Vente en ligne"&&imp.mm==="mm",JSON.stringify(imp));
 // candidature
 await pp.goto(base+"/portail.html#/vendeur");await pp.waitForTimeout(400);
 const cand=await pp.evaluate(()=>{const out={};const e=id=>document.getElementById(id);e("c_send").click();out.v1=e("c_err").textContent;e("c_nom").value="Fatou Diallo";e("c_tel").value="0505050505";e("c_send").click();out.v2=e("c_err").textContent;e("c_act").value="Vente de cosmétiques";e("c_ville").value="Yopougon";e("c_prod").value="Savons, crèmes";e("c_send").click();
  out.msg=(document.querySelector("#vend textarea.msg")||{}).value||"";return out});
 chk("PTL-9","candidature vendeur partenaire : nom, téléphone et activité contrôlés ; message WhatsApp avec marqueur [VENDEUR:…]",/nom/.test(cand.v1)&&/activité|produits/.test(cand.v2)&&/\[VENDEUR:[A-Za-z0-9_-]+\]/.test(cand.msg)&&/Fatou Diallo/.test(cand.msg),JSON.stringify(cand).slice(0,400));
 const cd=await pd.evaluate(m=>{const out={};ME=S.users.find(u=>u.role==="admin");const nv0=S.vendeurs.length,nu0=S.users.length;
  const r=candImporter(m);out.imp=r.ok.length;const dup=candImporter(m);out.dup=dup.ko.length&&/déjà/.test(dup.ko[0]);
  const c=S.candidatures[S.candidatures.length-1];out.noacc=S.vendeurs.length===nv0&&S.users.length===nu0&&c.statut==="attente";
  try{candApprouver(c.id,"12","5")}catch(e){out.pinko=/PIN/.test(e.message)}
  ME=S.users.find(u=>u.role==="livreur"||u.role==="preparateur")||ME;let denied=false;const savedRole=ME.role;try{candApprouver(c.id,"4321","5")}catch(e){denied=/Droits/.test(e.message)}out.denied=denied||savedRole==="admin";
  ME=S.users.find(u=>u.role==="admin");const v=candApprouver(c.id,"4321","7.5");const u=S.users.find(x=>x.id===v.user_id);out.vend=v.nom==="Fatou Diallo"&&v.commission_pct===7.5&&u.role==="vendeur"&&u.pin_h===hashPin(u.id,"4321");out.statut=c.statut==="approuvee"&&c.vendeur_id===v.id;
  out.twice=(()=>{try{candApprouver(c.id,"4321","5")}catch(e){return /déjà traitée/.test(e.message)}})();
  const m2=m.replace(/\[VENDEUR:[^\]]+\]/,"["+"VENDEUR:"+b64({f:"ZZZZZZ",n:"Koffi",t:"0909090909",a:"Vente de sacs"})+"]");candImporter(m2);const c2=S.candidatures[S.candidatures.length-1];
  try{candRefuser(c2.id,"x")}catch(e){out.motif=/Motif/.test(e.message)}candRefuser(c2.id,"Produits non conformes");out.ref=c2.statut==="refusee"&&c2.hist.length===2;
  ui.page="vendeurs";out.vue=/Candidatures reçues du portail/.test(VIEWS.vendeurs())&&!/NaN|undefined/.test(VIEWS.vendeurs());return out},cand.msg);
 chk("PTL-10","Distributions : import des candidatures (doublon refusé, rien créé sans accord), approbation avec PIN et commission, refus motivé, historique conservé, écran",cd.imp===1&&cd.dup&&cd.noacc&&cd.pinko&&cd.denied&&cd.vend&&cd.statut&&cd.twice&&cd.motif&&cd.ref&&cd.vue,JSON.stringify(cd));
 // lien partagé / sécurité
 const lien=await ps.evaluate(()=>pLien(pLire()));
 const ctx2=await b.newContext(),p2=await ctx2.newPage();p2.on("pageerror",e=>errs.push("p2: "+e.message));
 await p2.goto(lien.replace(/^https?:\/\/[^/]+/,base));await p2.waitForTimeout(500);
 tx=await p2.evaluate(()=>document.body.innerText);
 await p2.evaluate(()=>{document.querySelector('[data-go="boutique"]').click()});await p2.waitForTimeout(200);
 const tb=await p2.evaluate(()=>document.getElementById("page").innerText);
 await p2.evaluate(()=>{document.querySelector('[data-go="vendeur"]').click()});await p2.waitForTimeout(200);
 const tv=await p2.evaluate(()=>document.getElementById("page").innerText);
 chk("PTL-11","lien partagé : un autre appareil voit le site, la boutique et la candidature publiés",/Menko Test/i.test(tx)&&tb.includes(tok.nom)&&/Nom ou nom/.test(tv),tx.slice(0,200));
 const evil={nom:"X",couleur:"red;background:url(x)",boutique:"AAAAAAAAAAAAAAAAAAAAAAAA",hero:{titre:"<img src=x onerror=alert(1)>",texte:"t",video:"javascript:alert(1)"},bandeau:["<script>1</script>"],activites:[{icone:"<b>",nom:"<img src=x onerror=alert(1)>",texte:"<script>1</script>",detail:"x"},{nom:"App",lien:"https://exemple.ci/transport.html",texte:"t"}],services:[{titre:"Espace chauffeur",lien:"transport.html"}],entrees:[{titre:"Espace chauffeur",lien:"transport.html",actif:true}],faq:[{q:"<script>1</script>",r:"r"}]};
 const h="#p="+Buffer.from(encodeURIComponent(JSON.stringify(evil)).replace(/%([0-9A-F]{2})/g,(m,x)=>String.fromCharCode(parseInt(x,16))),"binary").toString("base64");
 const p3=await (await b.newContext()).newPage();p3.on("pageerror",e=>errs.push("p3: "+e.message));await p3.goto(base+"/portail.html"+h);await p3.waitForTimeout(400);
 const sec=await p3.evaluate(()=>{document.querySelector('[data-go="act1"]')&&document.querySelector('[data-go="act1"]').click();return{img:document.querySelectorAll("#page img, .logo-area img").length,scr:document.querySelectorAll("script:not([src])").length,hrefs:[...document.querySelectorAll("a[href]")].map(a=>a.getAttribute("href")).filter(h=>/\.html|javascript|^vendeur/.test(h)),col:getComputedStyle(document.documentElement).getPropertyValue("--c").trim(),vid:document.querySelectorAll("video").length,esp:/Espace chauffeur/.test(document.body.innerText)}});
 chk("PTL-12","sécurité : réglages hostiles dans le lien (HTML, vidéo javascript:, couleur piégée, jeton de boutique falsifié, anciens « espaces » connectés) neutralisés",sec.img===0&&sec.scr===1&&sec.hrefs.length===0&&sec.col==="#0e7490"&&sec.vid===0&&!sec.esp,JSON.stringify(sec));
 const pi=await ctx.newPage();await pi.goto(base+"/index.html");await pi.waitForTimeout(300);
 chk("PTL-13","Hub : carte « Portail unique » décrite comme site public sans accès aux applications ; service worker et manifeste déclarés",await pi.evaluate(()=>{const c=document.getElementById("c-portail");return !!c&&c.getAttribute("href")==="portail.html"&&/N'ouvre aucune application/.test(c.innerText)})&&/portail\.html/.test(fs.readFileSync(path.join(root,"sw.js"),"utf8"))&&JSON.parse(fs.readFileSync(path.join(root,"manifest-portail.webmanifest"),"utf8")).start_url==="portail.html");
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
