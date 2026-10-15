/* Recette automatisée — ANGEL'S Distributions (index.html : commandes, livraisons, caisse, droits, sauvegarde, hors ligne).
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/recette-distribution.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),p=await ctx.newPage(),errs=[];
 p.on("pageerror",e=>errs.push("PAGEERR "+e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/index.html");await p.waitForTimeout(300);
 await p.evaluate(()=>{window.__T=[];toast=(m,k)=>{__T.push(m)};window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};window.__last=()=>__T[__T.length-1]||"";
  window.__cl=()=>S.clients[0];window.__P=c=>S.produits.find(p=>p.code===c);window.__ln=(c,q)=>({produit_id:__P(c).id,qte:q,pu:__P(c).prix});
  window.__as_=(r,f)=>{const m=ME;ME=S.users.find(u=>u.role===r&&u.actif);try{return f()}finally{ME=m}};window.__mk=(L,o)=>__as_("admin",()=>creerCmd(Object.assign({client_id:__cl().id,adr:Object.assign({},__cl().adresses[0]),lignes:L,frais:2000,remise:0,paiement:"livraison",mode:"Espèces",priorite:"normale",canal:"Téléphone",confirmer:true},o||{})));
  window.__prete=c=>__as_("admin",()=>{setStatut(c,"preparation");return marquerPrete(c)});
  window.__run=(c,lv)=>__as_("admin",()=>{const l=affecter(c,lv.id,"");accepter(l);priseEnCharge(l,1);demarrer(l);return l});
  window.__L1=()=>S.livreurs[0];window.__L2=()=>S.livreurs[1]});
 let ok=0,ko=0;const t=async(id,label,fn)=>{let r;try{r=await p.evaluate(fn)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",r)}};

 await t("DIS-01","transitions de statut contrôlées (brouillon → livrée interdit)",()=>{__as("admin");const c=__mk([__ln("P-EAU",1)],{confirmer:false});const a=setStatut(c,"livree");const m=__last();const b2=setStatut(c,"confirmee");return(a===false&&/interdite/.test(m)&&b2===true&&c.statut==="confirmee")||(a+"|"+m)});
 await t("DIS-02","préparation : stock insuffisant refusé ; sortie de stock à la préparation ; annulation restitue",()=>{__as("preparateur");const p0=__P("P-EAU").stock;
  const big=__mk([__ln("P-EAU",p0+5)]);setStatut(big,"preparation");const r1=marquerPrete(big);const m1=__last();
  const c=__mk([__ln("P-EAU",3)]);const r2=__prete(c);const s1=__P("P-EAU").stock;__as("admin");const r3=annuler(c,"Erreur client");
  return(r1===false&&/Stock insuffisant/.test(m1)&&r2===true&&s1===p0-3&&r3===true&&__P("P-EAU").stock===p0&&c.statut==="annulee")||[r1,m1,r2,s1,r3,__P("P-EAU").stock].join("|")});
 await t("DIS-03","affectation : seulement commande prête ; moto en panne et dossier incomplet refusés",()=>{__as("superviseur");const c=__mk([__ln("P-EAU",1)]);const a=affecter(c,__L1().id,"");const m1=__last();
  __prete(c);const L3=S.livreurs[2];const b2=affecter(c,L3.id,"");const m2=__last();S.config.dossier_obligatoire=true;const c2=affecter(c,__L2().id,"");const m3=__last();S.config.dossier_obligatoire=false;
  const d=affecter(c,__L2().id,"");return(a===false&&/état actuel/.test(m1)&&b2===false&&/panne/.test(m2)&&c2===false&&/Dossier/.test(m3)&&d&&d.code&&c.statut==="affectee")||[a,m1,b2,m2,c2,m3].join("|")});
 await t("DIS-04","refus du livreur : commande de nouveau prête, réaffectation possible et tracée",()=>{__as("superviseur");const c=__mk([__ln("P-EAU",1)]);__prete(c);const l=affecter(c,__L1().id,"");__as("livreur");ME=S.users.find(u=>u.id===__L1().user_id);const r=refuser(l,"Moto en panne");
  __as("superviseur");const l2=affecter(c,__L2().id,"");return(r===true&&l.statut==="refusee"&&c.statut==="affectee"&&l2&&l2.tentative===1&&c.hist.some(h=>/Refus/.test(h.note||"")))||[r,l.statut,c.statut,l2&&l2.tentative].join("|")});
 await t("DIS-05","confirmation : code, montant, écart, référence Mobile Money, doublon de référence",()=>{__as("superviseur");const c=__mk([__ln("P-HUI",2)]);__prete(c);const l=__run(c,__L1());ME=S.users.find(u=>u.id===__L1().user_id);const att=l.montant_attendu,E=[];
  const T=(d,re)=>{const r=confirmer(l,d);E.push(r===false&&re.test(__last())?"ok":"KO:"+JSON.stringify(d)+"→"+__last())};
  T({code:"0000",montant:att,mode:"Espèces",recu_par:"X"},/Code/);T({code:l.code,montant:"",mode:"Espèces",recu_par:"X"},/montant/i);T({code:l.code,montant:att-500,mode:"Espèces",recu_par:"X"},/Écart/);
  T({code:l.code,montant:att,mode:"Wave",ref:"AB",recu_par:"X"},/Référence/);
  const r=confirmer(l,{code:l.code,montant:att,mode:"Wave",ref:"WV-TEST-001",recu_par:"Client"});const dbl=confirmer(l,{code:l.code,montant:att,mode:"Espèces",recu_par:"Client"});
  const c2=__mk([__ln("P-EAU",1)]);__prete(c2);const l2=__run(c2,__L1());const dup=confirmer(l2,{code:l2.code,montant:l2.montant_attendu,mode:"Wave",ref:"wv-test-001",recu_par:"X"});
  return(E.every(x=>x==="ok")&&r===true&&c.statut==="livree"&&S.fonds.some(f=>f.commande_id===c.id&&f.type==="encaissement"&&f.montant===att&&f.ref==="WV-TEST-001")&&dbl===false&&dup===false&&/déjà enregistrée/.test(__last()))||E.join(";")+"|"+[r,dbl,dup,__last()].join("|")});
 await t("DIS-06","signature obligatoire au-delà du seuil de valeur",()=>{__as("superviseur");S.config.signature_seuil=10000;const c=__mk([__ln("P-RIZ",2)]);__prete(c);const l=__run(c,__L1());ME=S.users.find(u=>u.id===__L1().user_id);
  const a=confirmer(l,{code:l.code,montant:l.montant_attendu,mode:"Espèces",recu_par:"X"});const m=__last();const sig="data:image/png;base64,iVBORw0KGgo=";const b2=confirmer(l,{code:l.code,montant:l.montant_attendu,mode:"Espèces",recu_par:"X",signature:sig});
  return(a===false&&/Signature/.test(m)&&b2===true&&l.signature===sig)||[a,m,b2].join("|")});
 await t("DIS-07","échec de livraison : motif tracé, pas de double clôture",()=>{__as("superviseur");const c=__mk([__ln("P-EAU",1)]);__prete(c);const l=__run(c,__L2());ME=S.users.find(u=>u.id===__L2().user_id);const a=echec(l,"Client absent","RAS"),b2=echec(l,"Autre","x");
  return(a===true&&c.statut==="echouee"&&l.motif_echec==="Client absent"&&b2===false)||[a,b2,c.statut].join("|")});
 await t("DIS-08","acompte : solde de la commande et montant attendu par le livreur",()=>{__as("commercial");const c=__mk([__ln("P-RIZ",1)],{paiement:"partiel",acompte:5000});const tot=c.total;__as("superviseur");__prete(c);const l=affecter(c,__L1().id,"");
  return(soldeCmd(c)===tot-5000&&paye(c)===5000&&l.montant_attendu===tot-5000)||[tot,soldeCmd(c),l.montant_attendu].join("|")});
 await t("DIS-09","droits dans les fonctions : préparateur ne crée pas de commande, caissier ne prépare pas, livreur limité à SES missions",()=>{const r=[];
  __as("preparateur");try{creerCmd({client_id:__cl().id,adr:Object.assign({},__cl().adresses[0]),lignes:[__ln("P-EAU",1)],frais:0,remise:0,paiement:"livraison",mode:"Espèces",priorite:"normale",canal:"Téléphone",confirmer:true});r.push("créé")}catch(e){r.push(/Droits/.test(e.message)?"ok":e.message)}
  __as("superviseur");const c=__mk([__ln("P-EAU",1)]);setStatut(c,"preparation");__as("caissier");r.push(marquerPrete(c)===false&&/Droits/.test(__last())?"ok":"prête par caissier");
  __as("superviseur");__prete(c);const l=affecter(c,__L1().id,"");ME=S.users.find(u=>u.id===__L2().user_id);r.push(accepter(l)===false&&/pas la vôtre/.test(__last())?"ok":"mission d'un autre acceptée");
  ME=S.users.find(u=>u.id===__L1().user_id);r.push(accepter(l)===true?"ok":"mission propre refusée");
  __as("commercial");r.push(affecter(c,__L2().id,"x")===false&&/Droits/.test(__last())?"ok":"affectation par commercial");return r.every(x=>x==="ok")||r.join("|")});
 await t("DIS-10","vendeur partenaire : ne peut créer ni annuler une commande d'un autre vendeur",()=>{const vs=S.vendeurs.filter(v=>v.user_id);if(vs.length<1)return "pas de vendeur de démo";const u=S.users.find(x=>x.id===vs[0].user_id);ME=u;const autre=S.vendeurs.find(v=>v.id!==vs[0].id);
  let e1=null;try{creerCmd({vendeur_id:autre?autre.id:"autre",client_id:__cl().id,adr:Object.assign({},__cl().adresses[0]),lignes:[{produit_id:null,desig:"X",qte:1,pu:1000}],frais:0,remise:0,paiement:"livraison",mode:"Espèces"})}catch(e){e1=e.message}
  __as("admin");const c=__mk([__ln("P-EAU",1)],{vendeur_id:autre?autre.id:null});ME=u;const r=annuler(c,"x");return(/Droits/.test(e1||"")&&r===false)||[e1,r,__last()].join("|")});
 await t("DIS-11","contrôle d'intégrité : propre sur les données de démonstration, détecte une falsification",()=>{const avant=integriteOps();const c=S.commandes.find(x=>x.statut==="livree");const t0=c.total;c.total+=777;const apres=integriteOps();c.total=t0;
  const p=__P("P-EAU");const s0=p.stock;p.stock=-4;const neg=integriteOps().some(x=>/Stock négatif/.test(x));p.stock=s0;return(!avant.some(x=>/incohérent|supérieurs|inconnue|nul|Stock négatif|actives/.test(x))&&apres.some(x=>/Total incohérent/.test(x))&&neg)||JSON.stringify({avant,apres})});
 await t("DIS-12","toutes les vues de chaque rôle s'affichent sans erreur",()=>{const bad=[];for(const r of Object.keys(ROLES)){__as(r);if(r==="livreur"||r==="vendeur"){/* espaces dédiés */}for(const n of NAV.filter(x=>x.r.includes(r))){try{const h=VIEWS[n.v]&&VIEWS[n.v]();if(typeof h!=="string"||!h.length)bad.push(r+"/"+n.v+" vide")}catch(e){bad.push(r+"/"+n.v+": "+e.message)}}}return bad.length===0||bad.join(" | ")});
 await t("DIS-13","saisie hostile échappée (XSS) dans la liste des clients",()=>{__as("admin");S.clients.push({id:uid("cl"),nom:"<img src=x onerror=window.__x=1>",tel:"1",adresses:[],note:""});const h=VIEWS.clients();S.clients.pop();return(!h.includes("<img src=x")&&h.includes("&lt;img"))||"non échappé"});

 // ---- sauvegarde / restauration par l'interface
 await p.evaluate(()=>{__as("admin");view="params";render()});
 const exp=await p.evaluate(()=>{let blob=null;const oc=URL.createObjectURL;URL.createObjectURL=b=>{blob=b;return"blob:test"};const ac=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){};ACT.exportData();URL.createObjectURL=oc;HTMLAnchorElement.prototype.click=ac;return blob.text()});
 const sauv=JSON.parse(exp);
 const bonne=sauv.app==="angels-livraison"&&typeof sauv.sum==="number"&&sauv.data&&sauv.data.commandes.length>0;
 console.log(bonne?"PASS":"FAIL","DIS-14 export : format signé (application, somme de contrôle, données)");bonne?ok++:ko++;
 const n0=await p.evaluate(()=>S.commandes.length);
 const alt=JSON.parse(exp);alt.data.commandes.pop();
 await p.setInputFiles("#p_imp",{name:"alteree.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(alt))});await p.waitForTimeout(300);
 const n1=await p.evaluate(()=>({n:S.commandes.length,msg:__last()}));
 const r15=n1.n===n0&&/altérée/.test(n1.msg);console.log(r15?"PASS":"FAIL","DIS-15 import d'une sauvegarde altérée refusé",r15?"":JSON.stringify(n1));r15?ok++:ko++;
 await p.evaluate(()=>{ME=null;__as("admin");view="params";render()});
 await p.evaluate(()=>{const c=__mk([__ln("P-EAU",1)]);window.__nTest=S.commandes.length;window.__cur=c.numero});
 await p.setInputFiles("#p_imp",{name:"sauvegarde.json",mimeType:"application/json",buffer:Buffer.from(exp)});await p.waitForTimeout(400);
 const n2=await p.evaluate(()=>({n:S.commandes.length,copie:!!localStorage.getItem(KEY+"_avant_import"),aud:S.audit.some(a=>/Import de données/.test(a.action))}));
 const r16=n2.n===n0&&n2.copie&&n2.aud;console.log(r16?"PASS":"FAIL","DIS-16 import valide : données restaurées, copie de sécurité conservée, import tracé",r16?"":JSON.stringify(n2)+" attendu "+n0);r16?ok++:ko++;
 // ---- hors ligne (service worker, bandeau)
 await p.goto(base+"/index.html");await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForTimeout(400);await ctx.setOffline(true);
 let off="";try{await p.reload();await p.waitForTimeout(500);off=await p.evaluate(()=>(document.getElementById("pwaBar")||{}).textContent||"");const len=await p.evaluate(()=>document.body.innerText.length);if(len<50)off="page vide"}catch(e){off="rechargement impossible : "+e.message.slice(0,60)}
 const r17=/hors ligne/i.test(off);console.log(r17?"PASS":"FAIL","DIS-17 hors ligne : l'application s'ouvre avec le bandeau « Mode hors ligne »",r17?"":off);r17?ok++:ko++;await ctx.setOffline(false);
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
