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
 chk("ONG-1","10 onglets ; ouverture sur « Utilisateurs et rôles » : seul ce contenu est affiché",v0.tabs.join()==="users,identite,accueil,boutique,contact,medias,stats,acces,impression,publication"&&v0.on.join()==="users"&&v0.users&&!v0.ptl&&!v0.med,JSON.stringify(v0));
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
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
