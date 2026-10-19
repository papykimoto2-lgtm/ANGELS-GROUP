/* Lien comptes utilisateurs ↔ fiches employés RH (facultatif) : unicité, formulaire, alertes, badge, trois applications.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/rh-comptes.js */
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

 await t("RC-1","fiche employé liée à un compte : un compte = un seul employé en poste ; compte inconnu refusé ; changement tracé",()=>{__as("admin");const O=ANGELS_RH.ops,E=[],u1=S.users.find(u=>u.role==="caissier"),u2=S.users.find(u=>u.role==="commercial");
  const f=n=>({nom:n,embauche:"2026-01-05",contrat:"CDI",sal_base:150000,cnps_no:"1",tel:"0700000001",user_id:u1.id});
  const a=O.saveEmploye(f("Alpha"));if(a.user_id!==u1.id)E.push("lien");let e="";try{O.saveEmploye(f("Beta"))}catch(x){e=x.message}if(!/déjà lié/.test(e))E.push("doublon accepté : "+e);
  try{O.saveEmploye(Object.assign(f("Gamma"),{user_id:"inconnu"}));E.push("compte inconnu accepté")}catch(x){}
  O.saveEmploye(Object.assign({},a,{id:a.id,user_id:u2.id,effet:"2026-09-01"}));if(a.user_id!==u2.id)E.push("changement");if(!S.audit.some(x=>/compte utilisateur : .* → /.test(x.detail)))E.push("audit");
  O.sortie(a.id,"2026-09-30","Démission");const b=O.saveEmploye(f("Delta"));if(b.user_id!==u1.id)E.push("réaffectation après sortie");return E.length?E.join(" ; "):true});
 await t("RC-2","formulaire : champ « Compte utilisateur » (comptes libres seulement), liste avec colonne Compte, badge RH dans Utilisateurs & droits",()=>{__as("admin");const E=[],u=S.users.find(x=>x.role==="preparateur"),emp=S.rh.employes[0];
  const h=VIEWS.rh();if(!/Compte/.test(h))E.push("colonne");
  const br=VIEWS.utilisateurs();const lie=S.users.find(x=>ANGELS_RH.ficheDe(x.id,RH_HOST));if(!lie||!br.includes("RH · "+ANGELS_RH.ficheDe(lie.id,RH_HOST).mat))E.push("badge RH");
  return E.length?E.join(" ; "):true});
 await t("RC-3","alertes RH : compte interne sans fiche, compte désactivé d'un employé en poste, employé sorti au compte encore actif ; livreurs et vendeurs exclus",()=>{__as("admin");const E=[],O=ANGELS_RH.ops;
  let A=ANGELS_RH.alertes(RH_HOST).map(a=>a.m).join("|");if(!/sans fiche employé/.test(A))E.push("sans fiche");const lv=S.users.find(x=>x.role==="livreur");if(A.includes("« "+lv.nom+" »"))E.push("livreur alerté");
  const vd=S.users.find(x=>x.role==="vendeur");if(vd&&A.includes("« "+vd.nom+" »"))E.push("vendeur alerté");
  const u=S.users.find(x=>x.role==="preparateur"),e=O.saveEmploye({nom:"Epsilon",embauche:"2026-01-05",contrat:"CDI",sal_base:150000,cnps_no:"9",tel:"0700000009",user_id:u.id});
  A=ANGELS_RH.alertes(RH_HOST).map(a=>a.m).join("|");if(A.includes("Compte « "+u.nom+" »"))E.push("alerte sans fiche malgré le lien");
  u.actif=false;A=ANGELS_RH.alertes(RH_HOST).map(a=>a.m).join("|");if(!/compte utilisateur désactivé/.test(A))E.push("compte désactivé");
  u.actif=true;O.sortie(e.id,"2026-09-30","Fin");A=ANGELS_RH.alertes(RH_HOST).map(a=>a.m).join("|");if(!/toujours actif : à désactiver/.test(A))E.push("sorti avec compte actif");return E.length?E.join(" ; "):true});
 const ctx2=await b.newContext({viewport:{width:1100,height:900}});
 for(const [app,id] of [["transport","RC-4"],["agro","RC-5"]]){const q=await ctx2.newPage();q.on("pageerror",e=>errs.push(app+": "+e.message));q.on("dialog",d=>d.accept());await q.goto(base+"/"+app+".html");await q.waitForTimeout(500);
  let r;try{r=await q.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const O=ANGELS_RH.ops,E=[],u=S.users.find(x=>x.role!=="admin"&&x.role!=="transitaire"&&x.actif);
   const e=O.saveEmploye({nom:"Zeta",embauche:"2026-01-05",contrat:"CDI",sal_base:150000,cnps_no:"3",tel:"0700000003",user_id:u.id,act:(typeof ACTS!=="undefined"&&ACTS[0]?ACTS[0][0]:"")});
   if(ANGELS_RH.ficheDe(u.id,RH_HOST).id!==e.id)E.push("ficheDe");let x="";try{O.saveEmploye({nom:"Eta",embauche:"2026-01-05",contrat:"CDI",sal_base:150000,cnps_no:"4",user_id:u.id,act:e.act})}catch(z){x=z.message}if(!/déjà lié/.test(x))E.push("doublon "+x);
   if(!ANGELS_RH.alertes(RH_HOST).some(a=>/sans fiche employé|compte/.test(a.m))&&S.users.filter(v=>v.actif).length>2)E.push("pas d'alerte");return E.length?E.join(" ; "):true})}catch(e){r="EXC "+e.message}
  if(r===true){ok++;console.log("PASS",id,app+" : lien compte ↔ employé")}else{ko++;console.log("FAIL",id,app,"→",r)}}
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
