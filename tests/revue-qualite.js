/* Revue de qualité : garde-fou véhicules, contrats, FIFO, importations Distribution, moteur d'impression et portail.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/revue-qualite.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
 const pt=await ctx.newPage();pt.on("pageerror",e=>errs.push("transport: "+e.message));pt.on("dialog",d=>d.accept());await pt.goto(base+"/transport.html");await pt.waitForTimeout(500);
 await pt.evaluate(()=>{window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};window.__try=fn=>{try{atomic(()=>fn());return null}catch(e){return e.message}};
  window.__err=fn=>{try{fn();return null}catch(e){return e.message}};
  window.__sc=(c,f)=>sum(S.entries.flatMap(e=>e.lines.filter(l=>l.compte===c&&(!f||f(l,e)))),l=>(l.debit||0)-(l.credit||0));__as("admin")});
 const t=async(id,label,fn,arg)=>{let r;try{r=await pt.evaluate(fn,arg)}catch(e){r="EXC "+e.message}chk(id,label,r===true,typeof r==="string"?r:JSON.stringify(r))};
 await t("RQ-1","export : les contournements du garde-fou véhicules (accents décomposés, espaces, anglais, marques, chiffres pleine largeur) sont refusés ; « Vin de palme » reste accepté",()=>{
  const N=["Land Cruiser","Hilux","Used car","Truck 10T","Fourgon","Poids lourd","Ambulance","véhicule","v​ehicule","V E H I C U L E","Mercedes Classe C","Yamaha 125"];
  const refus=N.map(n=>__err(()=>xpProduit({code:"T"+Math.random().toString(36).slice(2,6),nom:n,categorie:"Produits manufacturés",unite:"pièce",prix_ref:1})));
  const sh=__err(()=>xpProduit({code:"SH1",nom:"Pièces",categorie:"Produits manufacturés",unite:"pièce",prix_ref:1,hs:"８７０３"}));
  const vin=__err(()=>xpProduit({code:"VP",nom:"Vin de palme",categorie:"Produits agricoles",unite:"litre",prix_ref:1}));
  return refus.every(e=>/véhicules? interdite|interdite/.test(e||""))&&/chapitre 87/.test(sh||"")&&vin===null||[refus,sh,vin]});
 await t("RQ-2","export : fret négatif, taux démesuré, prix non numérique, unité modifiée avec du stock, pays « Ivory Coast » refusés",()=>{
  const pc=xpProduit({code:"RQ-CAJ",nom:"Noix de cajou RQ",categorie:"Produits agricoles",unite:"kg",prix_ref:900,hs:"0801.31"});
  const cl=xpClient({nom:"Client RQ",pays:"Pays-Bas",devise:"EUR"});const ci=__err(()=>xpClient({nom:"Local RQ",pays:"Ivory Coast",devise:"EUR"}));
  xpLot({produit_id:pc.id,fournisseur:"F",date:today(),qte:100,cout_unit:500,mode:"credit"});
  const base={client_id:cl.id,date:today(),devise:"EUR",taux:655,incoterm:"CIF",lignes:[{produit_id:pc.id,qte:1,pu:10}]};
  const a=__err(()=>xpCreerCmd(Object.assign({},base,{fret:-500}))),b=__err(()=>xpCreerCmd(Object.assign({},base,{taux:1e300}))),c=__err(()=>xpCreerCmd(Object.assign({},base,{lignes:[{produit_id:pc.id,qte:1,pu:"abc"}]})));
  const u=__err(()=>xpProduit({id:pc.id,code:"RQ-CAJ",nom:"Noix de cajou RQ",categorie:"Produits agricoles",unite:"tonne",prix_ref:900,hs:"0801.31"}));
  return /étranger/.test(ci||"")&&/positifs/.test(a||"")&&/Taux/.test(b||"")&&/Prix invalide/.test(c||"")&&/Unité non modifiable/.test(u||"")||[ci,a,b,c,u]});
 await t("RQ-3","export : le coût FIFO des sorties fractionnaires se solde exactement (stock 3112 à zéro, pas de centime d'écart)",()=>{
  const p=xpProduit({code:"RQ-FIFO",nom:"Cacao fractionné",categorie:"Produits agricoles",unite:"kg",prix_ref:100,hs:"1801.00"});const cl=S.xp_clients.find(c=>c.nom==="Client RQ");
  const pr=xpPrestataire({nom:"Mer RQ",type:"transporteur",pays:"CI"})||S.xp_prestataires[S.xp_prestataires.length-1];const s0=__sc("3112");xpLot({produit_id:p.id,fournisseur:"F2",date:today(),qte:2,cout_unit:50,mode:"credit"});
  [0.75,0.75,0.5].forEach(q=>{const c=xpCreerCmd({client_id:cl.id,date:today(),devise:"EUR",taux:655,incoterm:"CIF",lignes:[{produit_id:p.id,qte:q,pu:10}]});xpConfirmer(c.id,{});xpFacturer(c.id,{});const x=by(S.xp_cmd,c.id);Object.keys(x.docs).forEach(k=>x.docs[k].ok=true);xpExpedier(c.id,{transporteur_id:pr.id,mode:"maritime",doc_no:"BL-"+q,depart:today(),eta:addDays(today(),20)});});
  return __sc("3112")===s0&&xpDispo(p.id)===0||[__sc("3112"),s0,xpDispo(p.id)]});
 await t("RQ-4","contrats : prolonger un contrat sans échéance fonctionne ; la prolongation qui chevauche un autre contrat du véhicule est refusée ; dépôt négatif refusé",()=>{
  S.perms.admin.contrats=["v","c","e","p","x","a"];const v0=S.vehicles.find(x=>x.statut!=="sorti"),v=Object.assign({},v0,{id:"vrq1",immat:"RQ-001-AB"});S.vehicles.push(v),d=S.drivers[0],d2=S.drivers[1]||d;
  const neg=__err(()=>creerContrat({vehicle_id:v.id,driver_id:d.id,mode:"recette",montant:10000,debut:addDays(today(),400),fin:addDays(today(),420),depot:-5}));
  const c1=creerContrat({vehicle_id:v.id,driver_id:d.id,mode:"recette",montant:10000,debut:addDays(today(),100),fin:addDays(today(),110)});
  generer(addDays(today(),110),true);const ne=S.obligations.filter(o=>o.contract_id===c1.id).length;const pr=__err(()=>modifierContrat(c1.id,{fin:addDays(today(),140),repos:c1.repos,depot:0}));
  const c2=creerContrat({vehicle_id:v.id,driver_id:d.id,mode:"recette",montant:10000,debut:addDays(today(),150),fin:addDays(today(),160)});
  const ov=__err(()=>modifierContrat(c1.id,{fin:addDays(today(),155),repos:c1.repos,depot:0}));
  return ne>0&&/Dépôt/.test(neg||"")&&pr===null&&c1.fin===addDays(today(),140)&&/double obligation/.test(ov||"")||[ne,neg,pr,ov]});
 /* Distribution : programmation de livraison */
 const pd=await ctx.newPage();pd.on("pageerror",e=>errs.push("distribution: "+e.message));pd.on("dialog",d=>d.accept());await pd.goto(base+"/distribution.html");await pd.waitForTimeout(600);
 const rd=await pd.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const mk=o=>"[LIVRAISON:"+btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")+"]";
  const ok=new Date(Date.now()+864e5).toISOString().slice(0,10);const base={n:"Test",t:"0701020304",cz:"Cocody",cq:"A",dn:"M",dt:"0102030405",z:S.config.zones[0].nom,q:"B",desc:"Colis",dat:ok,cren:"tot",p:"c"};
  const t=o=>{try{const r=webImporter(mk(Object.assign({},base,o,{f:"RQ"+Math.random().toString(36).slice(2,7).toUpperCase()})));return r.ko.length?r.ko.join("|"):"OK"}catch(e){return e.message}};
  const bad=t({dat:"2026-99-99"}),far=t({dat:"9999-12-31"});const n0=(S.clients.find(c=>/0701020304/.test(c.tel))||{adresses:[]}).adresses.length;t({});t({});t({});
  const cl=S.clients.find(c=>/0701020304/.test(c.tel));
  const mb=o=>"[BOUTIQUE:"+btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")+"]";
  const p=S.produits.find(x=>x.actif);let gps="";try{const r=webImporter(mb({f:"RQG"+Math.random().toString(36).slice(2,6).toUpperCase(),n:"Test",t:"0701020399",z:base.z,a:"",o:"",l:[[p.code,1]],p:"e"}));gps=r.ko.join("|")||"OK"}catch(e){gps=e.message}
  return{bad,far,adr:cl.adresses.length-n0,gps}});
 chk("RQ-5","Distribution : date de livraison impossible ou lointaine refusée ; adresses de programmation dédupliquées ; GPS vide ne remplace pas l'adresse",/date/.test(rd.bad)&&/date/.test(rd.far)&&rd.adr===1&&/adresse de livraison absente/.test(rd.gps),JSON.stringify(rd));
 /* Moteur d'impression */
 const pe=await pt.evaluate(async()=>{const P=ANGELS_PRINT;localStorage.removeItem("angels_print_key_v1");
  const k=await Promise.all([P.jeton({a:1}),P.jeton({a:2}),P.jeton({a:3})]);const kids=new Set(k.map(x=>x.split(".")[2]));
  const exp=JSON.parse(P.cleExporter());localStorage.removeItem("angels_print_key_v1");const k2=await P.cleRegenerer();const exp2=JSON.parse((()=>{return P.cleExporter()})());
  const croise=JSON.stringify({angels_cle:1,priv:exp.priv,pub:exp2.pub,kid:"x",t:""});let imp="";try{await P.cleImporter(croise);imp="accepté"}catch(e){imp=e.message}
  const set0=Storage.prototype.setItem;localStorage.removeItem("angels_print_key_v1");Storage.prototype.setItem=function(){throw new Error("quota")};let plein="";try{plein=await P.jeton({a:9})}finally{Storage.prototype.setItem=set0}
  return{kids:kids.size,imp,plein:plein.split(".").slice(1).join(".")}});
 chk("RQ-6","signature : trois premiers usages simultanés = une seule clé ; import d'une clé privée/publique dépareillée refusé ; stockage plein = lien non signé signalé",pe.kids===1&&/ne correspondent pas/.test(pe.imp)&&pe.plein==="-.0",JSON.stringify(pe));
 await pt.evaluate(async()=>{await ANGELS_PRINT.jeton({a:1});});
 const ap=await pt.evaluate(async()=>{await ANGELS_PRINT.ouvrir({titre:"Test",corps:"<p>x</p>",ref:"T1",date:today()});for(let i=0;i<60&&document.getElementById("ap-ov").hidden;i++)await new Promise(r=>setTimeout(r,50));const d=document.querySelector("#ap-ov [role=dialog]"),f=document.getElementById("ap-f");const r={modal:d.getAttribute("aria-modal"),sb:f.getAttribute("sandbox"),foc:document.activeElement&&document.activeElement.id};document.getElementById("ap-x").click();return r});
 chk("RQ-7","aperçu d'impression : dialogue modal, focus placé dans le dialogue, iframe en bac à sable",ap.modal==="true"&&/allow-same-origin/.test(ap.sb)&&!/allow-scripts/.test(ap.sb)&&ap.foc==="ap-p",JSON.stringify(ap));
 /* Portail */
 const pp=await ctx.newPage();pp.on("pageerror",e=>errs.push("portail: "+e.message));await pp.goto(base+"/portail.html#/constructor");await pp.waitForTimeout(700);
 const rt=await pp.evaluate(()=>({t:document.getElementById("page").innerText.slice(0,80)}));
 chk("RQ-8","portail : une page inexistante (#/constructor) retombe sur l'accueil sans « [object Object] »",!/object Object/.test(rt.t)&&rt.t.length>0,JSON.stringify(rt));
 const cm=await pp.evaluate(async()=>{const d={o:"Org",v:"Vendeur",t:"0799999999",z:[]};const tok=btoa(JSON.stringify(d)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");T.contact.whatsapp="0101010101";return envoi("t","m","R1","cmd",d.t)});
 chk("RQ-9","commande par lien : le numéro destinataire est affiché et signalé s'il n'est pas celui de l'entreprise",/0799999999/.test(cm)&&/n'est pas celui publié/.test(cm),cm.slice(0,200));
 await b.close();srv.close();console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs"+(errs.length?" ; erreurs page : "+errs.join(" | "):""));process.exit(ko||errs.length?1:0);
})();
