/* Page Paramètres du Hub : organisation en onglets (utilisateurs, portail, médias, publication).
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/parametres-onglets.js */
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
 const ps=await ctx.newPage();ps.on("pageerror",e=>errs.push("parametres: "+e.message));ps.on("dialog",d=>d.accept());
 await ps.goto(base+"/parametres.html");await ps.waitForTimeout(400);
 const vis=()=>ps.evaluate(()=>({tabs:[...document.querySelectorAll("#ptabs .tab")].map(b=>b.dataset.pt),on:[...document.querySelectorAll("#ptabs .tab.on")].map(b=>b.dataset.pt),users:!document.getElementById("s-users").hidden,ptl:!document.getElementById("s-ptl").hidden,med:!document.getElementById("s-med").hidden,panels:[...document.querySelectorAll("#ptl .pp")].filter(p=>!p.hidden&&p.offsetParent!==null).map(p=>p.dataset.pp).filter((x,i,a)=>a.indexOf(x)===i)}));
 const v0=await vis();
 chk("ONG-1","11 onglets ; ouverture sur « Utilisateurs et rôles » : seul ce contenu est affiché",v0.tabs.join()==="users,identite,accueil,boutique,contact,medias,stats,acces,impression,cloud,publication"&&v0.on.join()==="users"&&v0.users&&!v0.ptl&&!v0.med,JSON.stringify(v0));
 const res={};
 for(const t of ["identite","accueil","boutique","contact","medias","stats","acces","publication"]){await ps.click('#ptabs [data-pt="'+t+'"]');res[t]=await vis()}
 const want={identite:["identite"],accueil:["accueil"],boutique:["boutique"],contact:["contact"],publication:["publication"]};
 chk("ONG-2","chaque onglet n'affiche que son contenu : identité (nom, logo, couleurs, bandeau), accueil (activités, avis, FAQ), boutique et vendeurs, contact et légal, médias, publication",
  Object.keys(want).every(t=>res[t].ptl&&!res[t].users&&!res[t].med&&res[t].panels.join()===want[t].join())&&res.medias.med&&!res.medias.ptl&&!res.medias.users&&!res.stats.ptl&&!res.acces.ptl,JSON.stringify(res));
 const contenu=await ps.evaluate(()=>{const g=k=>[...document.querySelectorAll('#ptl .pp[data-pp="'+k+'"]')].map(p=>p.textContent).join(" ");return{id:/Logo du portail/.test(g("identite"))&&/Couleur primaire/.test(g("identite"))&&/Bandeau défilant/.test(g("identite")),ac:/Page d'accueil/.test(g("accueil"))&&/Activités/.test(g("accueil"))&&/Questions fréquentes/.test(g("accueil"))&&/Avis clients/.test(g("accueil")),bo:/Lien de la boutique/.test(g("boutique"))&&/vendeur partenaire/.test(g("boutique")),co:/WhatsApp/.test(g("contact"))&&/Informations légales/.test(g("contact"))&&/Mentions légales/.test(g("contact")),pu:/portail-data\.js/.test(g("publication"))&&/portail autonome/.test(g("publication"))}});
 chk("ONG-3","contenu rangé au bon endroit dans chaque onglet",Object.values(contenu).every(Boolean),JSON.stringify(contenu));
 await ps.reload();await ps.waitForTimeout(400);const v1=await vis();
 chk("ONG-4","l'onglet courant est mémorisé pour la visite (rechargement)",v1.on.join()==="publication"&&v1.ptl,JSON.stringify(v1));
 // enregistrement : les champs de tous les onglets sont enregistrés ensemble, depuis n'importe quel onglet
 await ps.evaluate(()=>{AUTH.dist={id:"x",nom:"t",exp:Date.now()+600000};uView()});await ps.waitForTimeout(150);
 await ps.click('#ptabs [data-pt="identite"]');
 const bar=await ps.evaluate(()=>{const b=document.querySelector("#pform>.uf");return{vis:b.offsetParent!==null,btn:b.innerText}});
 const sv=await ps.evaluate(()=>{const f=document.getElementById("pform");f.nom.value="Groupe Test";f.whatsapp.value="0707070707";f.faq.value="Q ? | R";f.vtexte.value="Postulez";f.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));const c=JSON.parse(localStorage.getItem(PKEY));return{nom:c.nom,w:c.contact.whatsapp,faq:c.faq.length,v:c.vendeurs.texte,tab:PTAB,msg:document.getElementById("ptl").innerText.includes("enregistré")}});
 chk("ONG-5","barre « Enregistrer » visible dans les onglets de réglages ; un seul enregistrement couvre tous les onglets ; l'onglet reste affiché",bar.vis&&/Enregistrer le portail/.test(bar.btn)&&sv.nom==="Groupe Test"&&sv.w==="0707070707"&&sv.faq===1&&sv.v==="Postulez"&&sv.tab==="identite",JSON.stringify({bar,sv}));
 await ps.click('#ptabs [data-pt="publication"]');
 const pub=await ps.evaluate(()=>{const b=document.querySelector("#pform>.uf");return{barre:b.style.display,btns:[...document.querySelectorAll('#ptl .pp[data-pp="publication"] [data-p]')].map(x=>x.dataset.p).join()}});
 chk("ONG-6","onglet Publication : boutons de publication (données, autonome, lien, WhatsApp), pas de barre d'enregistrement",pub.barre==="none"&&pub.btns==="data,auto,lien,wa",JSON.stringify(pub));
 await ps.click('#ptabs [data-pt="users"]');
 const us=await ps.evaluate(()=>({u:document.getElementById("usr").innerText.length>20,tabs:document.querySelectorAll("#utabs .tab").length}));
 chk("ONG-7","onglet Utilisateurs : gestion des comptes des trois applications toujours disponible",us.u&&us.tabs>=3,JSON.stringify(us));
 const mob=await ctx.newPage();await mob.setViewportSize({width:375,height:700});await mob.goto(base+"/parametres.html");await mob.waitForTimeout(300);
 const ov=await mob.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2);
 chk("ONG-8","téléphone (375 px) : pas de défilement horizontal de la page",ov);
 /* Cloud / Supabase */
 {await ps.click('#ptabs [data-pt="cloud"]');
 const c0=await ps.evaluate(()=>({vis:!document.getElementById("s-cloud").hidden,ptl:document.getElementById("s-ptl").hidden,users:document.getElementById("s-users").hidden,url:document.getElementById("cl-url").value,badge:document.getElementById("cl-badge").innerText,apps:document.getElementById("cl-apps").innerText}));
 chk("CLD-1","onglet Cloud / Supabase : projet par défaut affiché (URL, clé, état connecté) et état des applications branchées",c0.vis&&c0.ptl&&c0.users&&/gfzqxoolorbejxnxrlji\.supabase\.co/.test(c0.url)&&/Connecté/.test(c0.badge)&&/Passerelle livreur/.test(c0.apps),JSON.stringify(c0));
 await ps.evaluate(()=>{Object.keys(AUTH).forEach(k=>delete AUTH[k]);localStorage.removeItem("angels_supabase")});
 await ps.click('[data-cl="save"]');const lock=await ps.innerText("#cl-res");
 chk("CLD-2","enregistrer sans application déverrouillée : refusé",/Déverrouillez/.test(lock),lock);
 await ps.evaluate(()=>{AUTH.test={exp:Date.now()+6e5}});
 const val=await ps.evaluate(()=>{const r={};const t=(u,k)=>{try{clValide(u,k);return"ok"}catch(e){return e.message}};
  const J=r2=>"eyJhbGciOiJIUzI1NiJ9."+btoa(JSON.stringify({role:r2}))+".sig";
  r.service=t("https://abc.supabase.co",J("service_role"));r.secret=t("https://abc.supabase.co","sb_secret_xyz");r.url=t("http://abc.supabase.co",J("anon"));r.bad=t("https://abc.supabase.co","pas-une-cle");r.ok=t("https://abc.supabase.co/rest/v1/",J("anon"));r.pub=t("https://abc.supabase.co","sb_publishable_abc123");return r});
 chk("CLD-3","validation : clé service_role / secrète refusées, URL non https refusée, clé anonyme et clé publishable acceptées",/service_role/.test(val.service)&&/SECRÈTE/.test(val.secret)&&/URL invalide/.test(val.url)&&/invalide/.test(val.bad)&&val.ok==="ok"&&val.pub==="ok",JSON.stringify(val));
 const keyOk="eyJhbGciOiJIUzI1NiJ9."+Buffer.from(JSON.stringify({role:"anon"})).toString("base64url")+".sig";
 await ps.fill("#cl-url","https://nouveau.supabase.co/");await ps.fill("#cl-key",keyOk);await ps.click('[data-cl="save"]');
 const sv=await ps.evaluate(()=>({o:JSON.parse(localStorage.getItem("angels_supabase")),eff:clEff()}));
 chk("CLD-4","enregistrement : configuration partagée stockée (URL normalisée) et prise comme configuration effective",sv.o&&sv.o.url==="https://nouveau.supabase.co"&&sv.eff.perso&&sv.eff.url===sv.o.url,JSON.stringify(sv));
 await ps.route("https://nouveau.supabase.co/**",r=>{const u=r.request().url();r.fulfill({status:/pg_livreurs/.test(u)?404:200,headers:{"access-control-allow-origin":"*"},contentType:"application/json",body:"{}"})});
 await ps.click('[data-cl="test"]');await ps.waitForTimeout(600);const tr=await ps.innerText("#cl-res");
 chk("CLD-5","test de connexion : projet joignable, et migration de la passerelle signalée comme non installée quand les tables manquent",/Projet joignable/.test(tr)&&/tables non installées/.test(tr),tr);
 await ps.click('[data-cl="clear"]');const cl=await ps.evaluate(()=>({o:JSON.parse(localStorage.getItem("angels_supabase")),b:document.getElementById("cl-badge").innerText}));
 await ps.click('[data-cl="def"]');const df=await ps.evaluate(()=>localStorage.getItem("angels_supabase"));
 chk("CLD-6","effacer : mode local ; projet par défaut rétabli ensuite",cl.o.off===true&&/Mode local/.test(cl.b)&&df===null,JSON.stringify([cl,df]));
 await ps.evaluate(()=>{Object.keys(AUTH).forEach(k=>delete AUTH[k]);localStorage.removeItem("angels_sync")});await ps.fill("#cs-key","courte");await ps.check("#cs-on");await ps.click('[data-cl="sync-save"]');const s0=await ps.innerText("#cs-res");const l0=await ps.evaluate(()=>localStorage.getItem("angels_sync"));
 await ps.evaluate(()=>{AUTH.test={exp:Date.now()+6e5}});await ps.click('[data-cl="sync-save"]');const s1=await ps.innerText("#cs-res");const l1=await ps.evaluate(()=>localStorage.getItem("angels_sync"));
 await ps.fill("#cs-key","CLE-DE-SYNCHRONISATION-LONGUE-123");await ps.click('[data-cl="sync-save"]');const s2=await ps.evaluate(()=>({o:JSON.parse(localStorage.getItem("angels_sync")),b:document.getElementById("cs-badge").innerText}));
 chk("CLD-7","synchronisation entre postes : réglage réservé aux administrateurs, clé trop courte refusée, puis activée et mémorisée sur l'appareil",/Déverrouillez/.test(s0)&&l0===null&&/trop courte/.test(s1)&&l1===null&&s2.o&&s2.o.actif===true&&s2.o.cle==="CLE-DE-SYNCHRONISATION-LONGUE-123"&&/activée/.test(s2.b),JSON.stringify({s0,s1,s2}));
 const lg=await ps.evaluate(()=>document.getElementById("cl-apps").innerText);
 chk("CLD-9","carte « Applications branchées » : la ligne « Synchronisation entre postes » passe à Actif dès l'enregistrement de la clé",/Synchronisation entre postes[\s\S]*Actif/.test(lg)&&!/Synchronisation entre postes[^\n]*Inactif/.test(lg),lg);
 await ps.route("https://gfzqxoolorbejxnxrlji.supabase.co/functions/v1/sync",r=>{const k=r.request().headers()["x-sync-key"];r.fulfill({status:k==="BONNE-CLE-DE-SYNCHRO-0123456"?200:401,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(k==="BONNE-CLE-DE-SYNCHRO-0123456"?{ok:true,enregistrements:{distribution:12,transport:3,agro:0}}:{ok:false,erreur:"Clé de synchronisation invalide"})})});
 await ps.fill("#cs-key","MAUVAISE-CLE-DE-SYNCHRO-012");await ps.click('[data-cl="sync-test"]');await ps.waitForTimeout(400);const t0=await ps.innerText("#cs-res");
 await ps.fill("#cs-key","BONNE-CLE-DE-SYNCHRO-0123456");await ps.click('[data-cl="sync-test"]');await ps.waitForTimeout(400);const t1=await ps.innerText("#cs-res");
 chk("CLD-8","test de la clé : clé refusée signalée ; clé acceptée affiche le nombre d'enregistrements du serveur par application",/refusée/.test(t0)&&/Clé acceptée/.test(t1)&&/Distributions 12/.test(t1),JSON.stringify([t0,t1]));}
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
