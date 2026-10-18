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

 const pp=await ctx.newPage();pp.on("pageerror",e=>errs.push("portail: "+e.message));pp.on("dialog",d=>d.accept());
 const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
 await pp.goto(base+"/portail.html");await pp.waitForTimeout(300);
 let tx=await pp.evaluate(()=>document.body.innerText);
 chk("PTL-1","portail sans réglage : valeurs par défaut — services, profils, FAQ, contact vide expliqué",/Boutique en ligne/.test(tx)&&/Espace chauffeur/.test(tx)&&/Questions fréquentes/.test(tx)&&/coordonnées seront publiées/.test(tx)&&!/NaN|undefined/.test(tx),tx.slice(0,300));
 await pp.click('[data-f="chauffeurs"]');tx=await pp.evaluate(()=>document.getElementById("cards").innerText);
 chk("PTL-2","filtre par profil : « Chauffeurs » n'affiche que l'espace chauffeur, marqué espace sécurisé (PIN)",/Espace chauffeur/.test(tx)&&!/Boutique/.test(tx)&&/PIN/.test(tx),tx);
 // Paramètres
 const ps=await ctx.newPage();ps.on("pageerror",e=>errs.push("parametres: "+e.message));ps.on("dialog",d=>d.accept());
 await ps.goto(base+"/parametres.html");await ps.waitForTimeout(300);
 const ro=await ps.evaluate(()=>{const f=document.getElementById("pform");return{btn:f.querySelector("button.sb").disabled,msg:document.getElementById("ptl").innerText}});
 chk("PTL-3","Paramètres : portail en lecture seule tant qu'aucun administrateur n'a déverrouillé une application ; enregistrement refusé",ro.btn&&/Lecture seule/.test(ro.msg),JSON.stringify(ro));
 const refus=await ps.evaluate(()=>{const f=document.getElementById("pform");f.nom.value="Pirate";f.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));return{k:localStorage.getItem(PKEY),m:document.getElementById("ptl").innerText.slice(0,120)}});
 chk("PTL-4","enregistrement sans déverrouillage : rien n'est écrit",refus.k===null&&/Déverrouillez/.test(refus.m),JSON.stringify(refus));
 const deb=await ps.evaluate(()=>{AUTH.dist={id:"x",nom:"t",exp:Date.now()+60000};pView();const f=document.getElementById("pform");
  f.nom.value="Menko Test";f.couleur.value="#b45309";f.slogan.value="Slogan <b>test</b>";f.tel.value="+225 07 00 00 00 00";f.whatsapp.value="225 07 00 00 00 01";f.email.value="contact@exemple.ci";
  f.ti0.value="Ma boutique";f.li0.value="https://exemple.ci/boutique";f.act1.checked=false;f.faq.value="Où livrez-vous ? | Partout à Abidjan\nQuestion sans réponse |";
  f.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));const c=JSON.parse(localStorage.getItem(PKEY)||"null");return c&&{nom:c.nom,col:c.couleur,t0:c.entrees[0].titre,a1:c.entrees[1].actif,nf:c.faq.length,m:document.getElementById("ptl").innerText.slice(0,80)}});
 chk("PTL-5","administrateur déverrouillé : réglages enregistrés (identité, couleur, contact, services, FAQ)",deb&&deb.nom==="Menko Test"&&deb.col==="#b45309"&&deb.t0==="Ma boutique"&&deb.a1===false&&deb.nf===2&&/enregistré/.test(deb.m),JSON.stringify(deb));
 const bad=await ps.evaluate(()=>{const out=[];const f=()=>document.getElementById("pform");
  f().li0.value="javascript:alert(1)";f().dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));out.push(document.getElementById("ptl").innerText.includes("Lien invalide"));
  f().li0.value="https://exemple.ci/boutique";f().email.value="pas-un-mail";f().dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));out.push(document.getElementById("ptl").innerText.includes("e-mail invalide"));
  f().email.value="contact@exemple.ci";f().nom.value="";f().dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));out.push(document.getElementById("ptl").innerText.includes("obligatoire"));return out});
 chk("PTL-6","contrôles : lien javascript:, e-mail invalide et nom vide refusés",bad.every(Boolean),JSON.stringify(bad));
 const lien=await ps.evaluate(()=>pLien(pLire()));
 // portail lit les réglages du même appareil
 await pp.goto(base+"/portail.html");await pp.waitForTimeout(300);
 tx=await pp.evaluate(()=>document.body.innerText);
 chk("PTL-7","le portail affiche les réglages du Hub : nom, slogan (échappé), contact, service renommé, service désactivé masqué, FAQ",/MENKO TEST/.test(tx)&&/Slogan <b>test<\/b>/.test(tx)&&/Ma boutique/.test(tx)&&!/Véhicules à vendre/.test(tx)&&/Où livrez-vous/.test(tx)&&/\+225 07 00 00 00 00/.test(tx),tx.slice(0,400));
 const col=await pp.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue("--c").trim());
 chk("PTL-8","couleur du portail appliquée",col==="#b45309",col);
 // lien partagé : autre appareil (contexte vierge) + assainissement
 const ctx2=await b.newContext(),p2=await ctx2.newPage();p2.on("pageerror",e=>errs.push("p2: "+e.message));
 await p2.goto(lien.replace(/^https?:\/\/[^/]+/,base));await p2.waitForTimeout(300);
 tx=await p2.evaluate(()=>document.body.innerText);
 chk("PTL-9","lien partagé : un appareil sans réglage affiche le portail publié (contenu porté par le lien)",/MENKO TEST/.test(tx)&&/Ma boutique/.test(tx),tx.slice(0,200));
 const evil={nom:"X",couleur:"red;background:url(x)",entrees:[{titre:"<img src=x onerror=alert(1)>",texte:"t",lien:"javascript:alert(1)",aud:"clients",actif:true,icone:"•"},{titre:"Sûr",texte:"t",lien:"data:text/html,<script>1</script>",aud:"clients",actif:true}],faq:[{q:"<script>1</script>",r:"r"}]};
 const h="#p="+Buffer.from(encodeURIComponent(JSON.stringify(evil)).replace(/%([0-9A-F]{2})/g,(m,x)=>String.fromCharCode(parseInt(x,16))),"binary").toString("base64");
 const p3=await (await b.newContext()).newPage();p3.on("pageerror",e=>errs.push("p3: "+e.message));await p3.goto(base+"/portail.html"+h);await p3.waitForTimeout(300);
 const sec=await p3.evaluate(()=>({img:document.querySelectorAll("img").length,scr:document.querySelectorAll("main script").length,hrefs:[...document.querySelectorAll("#cards a")].map(a=>a.getAttribute("href")),col:getComputedStyle(document.documentElement).getPropertyValue("--c").trim()}));
 chk("PTL-10","sécurité : réglages hostiles dans le lien (HTML, javascript:, data:, couleur piégée) neutralisés",sec.img===0&&sec.scr===0&&sec.hrefs.length===0&&sec.col==="#0e7490",JSON.stringify(sec));
 const pi=await ctx.newPage();await pi.goto(base+"/index.html");await pi.waitForTimeout(300);
 chk("PTL-11","Hub : carte « Portail unique » ; service worker et manifeste du portail déclarés",await pi.evaluate(()=>document.getElementById("c-portail")&&document.getElementById("c-portail").getAttribute("href")==="portail.html")&&/portail\.html/.test(fs.readFileSync(path.join(root,"sw.js"),"utf8"))&&JSON.parse(fs.readFileSync(path.join(root,"manifest-portail.webmanifest"),"utf8")).start_url==="portail.html");
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
