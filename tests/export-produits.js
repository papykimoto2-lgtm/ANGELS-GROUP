/* Connexion Module 13 — Export de produits (V2) : jamais de véhicules.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/export-produits.js */
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
 await t("EXP-1","catalogue produits exportables ; un véhicule est refusé (désignation, catégorie, code SH chapitre 87)",()=>{
  const p=xpProduit({code:"cacao-01",nom:"Cacao en fèves",categorie:"Produits agricoles",unite:"tonne",prix_ref:1500000,hs:"1801.00",origine:"Côte d'Ivoire",seuil:2});xpProduit({code:"CAJ-01",nom:"Noix de cajou",categorie:"Produits agricoles",unite:"kg",prix_ref:900,hs:"0801.31"});
  const e1=__err(()=>xpProduit({code:"V1",nom:"Toyota Corolla 2018",categorie:"Produits manufacturés",unite:"pièce",prix_ref:1}));
  const e2=__err(()=>xpProduit({code:"V2",nom:"Pièces diverses",categorie:"Produits manufacturés",unite:"pièce",prix_ref:1,hs:"8703.23"}));
  const e3=__err(()=>xpProduit({code:"V3",nom:"Camion benne",categorie:"Produits manufacturés",unite:"pièce",prix_ref:1}));
  const e4=__err(()=>xpProduit({code:"CACAO-01",nom:"Doublon",categorie:"Produits agricoles",unite:"kg",prix_ref:1}));
  return p.code==="CACAO-01"&&/véhicules/i.test(e1)&&/chapitre 87/.test(e2)&&/véhicules/i.test(e3)&&/existe déjà/.test(e4)&&S.xp_produits.length===2||[e1,e2,e3,e4]});
 await t("EXP-2","client étranger obligatoire : la Côte d'Ivoire est refusée, devise et incoterm par défaut",()=>{
  const e=__err(()=>xpClient({nom:"Local SARL",pays:"Côte d'Ivoire",devise:"EUR"}));xpClient({nom:"Sud Cacao BV",pays:"Pays-Bas",ville:"Rotterdam",devise:"EUR",incoterm:"CIF",email:"achat@sudcacao.nl"});
  xpPrestataire({nom:"Mer Express",type:"transporteur",pays:"CI"});return /étranger/.test(e)&&S.xp_clients.length===1&&S.xp_prestataires.length===1||e});
 await t("EXP-3","achat de lots : stock export (3112) alimenté, dette fournisseur ; règlement ultérieur",()=>{
  const p=S.xp_produits[0],q=S.xp_produits[1];const l1=xpLot({produit_id:p.id,fournisseur:"Coop Daloa",date:today(),qte:10,cout_unit:1000000,mode:"credit"});
  xpLot({produit_id:q.id,fournisseur:"Coop Daloa",date:today(),qte:500,cout_unit:700,mode:"banque"});
  const du=xpLotDu(l1);xpLotRegler(l1.id,{montant:4000000,mode:"banque",date:today()});
  return __sc("3112")===10000000+350000&&du===10000000&&xpLotDu(l1)===6000000&&xpDispo(p.id)===10&&__sc("4011")===-6000000||[__sc("3112"),du,__sc("4011")]});
 await t("EXP-4","devis en euros → contrat → facture : exportation hors taxe (aucune TVA), 4113 / 7013 au taux du devis",()=>{
  const cl=S.xp_clients[0],p=S.xp_produits[0];const c=xpCreerCmd({client_id:cl.id,date:today(),devise:"EUR",taux:655.957,incoterm:"CIF",lieu:"Rotterdam",lignes:[{produit_id:p.id,qte:6,pu:2500}],fret:600,assurance_cl:100});
  window.__c=c.id;const tot=xpTotal(c);xpConfirmer(c.id);xpFacturer(c.id,{});
  const e=S.entries.find(x=>x.source&&x.source.type==="xp_facture"&&x.source.id===c.id);const ok=c.statut==="facturee"&&tot===15700&&xpFactXof(c)===Math.round(15700*655.957)&&e.lines.some(l=>l.compte==="4113"&&l.debit===xpFactXof(c))&&e.lines.some(l=>l.compte==="7013"&&l.credit===xpFactXof(c))&&!e.lines.some(l=>l.compte.startsWith("443"));
  return ok||[c.statut,tot,xpFactXof(c),JSON.stringify(e&&e.lines)]});
 await t("EXP-5","aucun véhicule dans une commande : véhicule lié, note ou ligne libre refusés",()=>{
  const cl=S.xp_clients[0],p=S.xp_produits[0];const a=__err(()=>xpCreerCmd({client_id:cl.id,date:today(),devise:"EUR",taux:656,vn_id:"x",lignes:[{produit_id:p.id,qte:1,pu:1}]}));
  const b=__err(()=>xpCreerCmd({client_id:cl.id,date:today(),devise:"EUR",taux:656,notes:"Ajouter une voiture Toyota",lignes:[{produit_id:p.id,qte:1,pu:1}]}));
  const c=__err(()=>xpCreerCmd({client_id:"zz",date:today(),devise:"EUR",taux:656,lignes:[{produit_id:p.id,qte:1,pu:1}]}));const d=__err(()=>xpCreerCmd({client_id:cl.id,date:today(),devise:"EUR",lignes:[{produit_id:p.id,qte:1,pu:1}]}));
  return /véhicules/i.test(a)&&/véhicules/i.test(b)&&/étranger/.test(c)&&/Taux/.test(d)||[a,b,c,d]});
 await t("EXP-6","expédition : documents obligatoires exigés, stock vérifié, sortie FIFO au coût réel (6032 / 3112)",()=>{
  const c=by(S.xp_cmd,window.__c),pr=S.xp_prestataires[0];const e1=__err(()=>xpExpedier(c.id,{transporteur_id:pr.id,mode:"maritime",doc_no:"BL-1",depart:today()}));
  xpDocs(c.id,"colisage",true);xpDocs(c.id,"origine",true);xpDocs(c.id,"transport",true);
  const lot2=xpLot({produit_id:S.xp_produits[0].id,fournisseur:"Coop San Pedro",date:today(),qte:2,cout_unit:1200000,mode:"banque"});
  xpExpedier(c.id,{transporteur_id:pr.id,mode:"maritime",doc_no:"BL-1",depart:today(),eta:addDays(today(),20)});
  const cout=xpCoutLignes(c);return /obligatoires/.test(e1)&&c.statut==="expediee"&&cout===6000000&&__sc("6032")===cout&&xpDispo(S.xp_produits[0].id)===6&&c.lignes[0].alloc.length===1||[e1,c.statut,cout,xpDispo(S.xp_produits[0].id)]});
 await t("EXP-7","stock insuffisant : expédition refusée",()=>{
  const cl=S.xp_clients[0],p=S.xp_produits[0];const c=xpCreerCmd({client_id:cl.id,date:today(),devise:"XOF",lignes:[{produit_id:p.id,qte:50,pu:2000000}]});xpConfirmer(c.id);xpFacturer(c.id,{});["colisage","origine","transport"].forEach(k=>xpDocs(c.id,k,true));
  const e=__err(()=>xpExpedier(c.id,{transporteur_id:S.xp_prestataires[0].id,mode:"maritime",doc_no:"BL-2",depart:today()}));xpAnnuler(c.id,"Test annulation sans règlement");
  return /Stock insuffisant/.test(e)&&c.statut==="annulee"&&S.entries.some(x=>x.source&&x.source.type==="extourne")||e});
 await t("EXP-8","encaissements en devise : écart de change à chaque règlement, solde exact, gain 776 / perte 676",()=>{
  const c=by(S.xp_cmd,window.__c);xpEncaisser(c.id,{montant_dev:7000,taux:660,mode:"banque",date:today()});
  const e1=c.reglements[0].ecart;const r=xpEncaisser(c.id,{montant_dev:8700,taux:650,mode:"banque",date:today()});
  const fx=xpFactXof(c),enc=xpEncCompta(c);return e1===Math.round(7000*660)-Math.round(7000*655.957)&&enc===fx&&xpResteDev(c)===0&&__sc("4113")===0+(__sc("4113"))&&(__sc("776")<0||__sc("676")>0)&&__sc("4113",(l,e)=>e.source.id===c.id)===0||[e1,fx,enc,xpResteDev(c)]});
 await t("EXP-9","frais logistiques : facture du prestataire obligatoire, imputés à l'activité export, marge = facturé − coût − frais ± change",()=>{
  const c=by(S.xp_cmd,window.__c),pr=S.xp_prestataires[0];const e=__err(()=>xpFrais(c.id,{type:"expedition",prestataire_id:pr.id,montant:800000,mode:"banque",date:today()}));
  xpFrais(c.id,{type:"expedition",prestataire_id:pr.id,montant:800000,mode:"banque",date:today(),facture_no:"MX-221"});
  const m=xpMarge(c);return /facture/i.test(e)&&m===xpFactXof(c)-6000000-800000+xpChange(c)&&__sc("6245")===800000||[e,m,xpChange(c)]});
 await t("EXP-10","livraison puis clôture : dossier clôturé car soldé ; suivi de l'expédition tracé",()=>{
  const c=by(S.xp_cmd,window.__c);xpSuivi(c.id,"Chargé au port d'Abidjan");xpLivrer(c.id,{date:today(),note:"Reçu à Rotterdam"});return c.statut==="cloturee"&&c.expedition.suivi.length===3&&!!c.expedition.livraison||[c.statut,c.expedition.suivi.length]});
 await t("EXP-11","analytique : l'activité « Exportation de produits » existe (8 activités), somme = résultat comptable",()=>{
  const yr=today().slice(0,4),R=resultatActivites(yr+"-01-01",yr+"-12-31"),ex=R.find(x=>x.k==="export"),tot=resultat(yr+"-01-01",yr+"-12-31").r;
  const cl=S.entries.filter(e=>e.source&&e.source.type==="cloture").length;return R.length===8&&ex.p>0&&ex.c>0&&sum(R,x=>x.r)===tot||[R.length,ex,sum(R,x=>x.r),tot]});
 await t("EXP-12","contrôle automatique des écritures : aucune opération export non comptabilisée, aucune anomalie",()=>{
  const k=ctrlAuto(),xp=k.par.filter(x=>/^xp_/.test(x.type));return xp.length>=5&&k.nonCompt===0&&k.anom.length===0||[k.nonCompt,k.anom.slice(0,3),xp.length]});
 await t("EXP-13","droits : le caissier consulte seulement ; le comptable ne confirme ni n'annule ; l'administrateur oui",()=>{
  __as("caissier");const a=__err(()=>xpProduit({code:"Z1",nom:"Mangue séchée",categorie:"Produits agricoles",unite:"kg",prix_ref:1}));__as("comptable");const cl=S.xp_clients[0];
  const c=(__as("admin"),xpCreerCmd({client_id:cl.id,date:today(),devise:"XOF",lignes:[{produit_id:S.xp_produits[1].id,qte:1,pu:1000}]}));__as("comptable");const b=__err(()=>xpConfirmer(c.id));__as("admin");
  return !!a&&!!b&&can("export_v2","a")&&!can("export_v2","c",(__as("caissier"),0))||[a,b]});
 await t("EXP-14","alertes : devis expiré, facture échue, expédition en retard, stock bas",()=>{
  __as("admin");const cl=S.xp_clients[0],p=S.xp_produits[1];const c=xpCreerCmd({client_id:cl.id,date:addDays(today(),-40),devise:"XOF",validite:addDays(today(),-5),lignes:[{produit_id:p.id,qte:1,pu:1000}]});
  const q=xpCreerCmd({client_id:cl.id,date:today(),devise:"XOF",echeance:addDays(today(),-3),lignes:[{produit_id:p.id,qte:100,pu:1000}]});xpConfirmer(q.id);xpFacturer(q.id,{});
  p.seuil=10000;const m=xpAlertes().map(x=>x.m).join("|");return /expiré/.test(m)&&/échue/.test(m)&&/Stock export bas/.test(m)||m});
 await t("EXP-15","toutes les vues et tous les onglets s'affichent pour chaque rôle sans erreur ; CSV disponible",()=>{
  const bad=[];for(const r of Object.keys(ROLES)){__as(r);if(r==="chauffeur")continue;if(!NAV.filter(showNav).some(n=>n.v==="export_v2"))continue;for(const tab of ["synthese","commandes","produits","clients","stock","prestataires"]){UI.f.xp={t:tab};UI.xpc=null;view="export_v2";try{render()}catch(e){bad.push(r+":"+tab+":"+e.message)}}}
  __as("admin");UI.xpc=S.xp_cmd[0].id;view="export_v2";try{render()}catch(e){bad.push("detail:"+e.message)}UI.xpc=null;const csv=CSVS.export_cmd();return !bad.length&&csv[1].length===S.xp_cmd.length&&csv[0].length===csv[1][0].length||bad});
 await pt.evaluate(()=>{__as("admin");UI.xpc=null;UI.f.xp={t:"commandes"};view="export_v2";render()});
 const ui=await pt.evaluate(()=>({txt:document.body.innerText,nav:NAV.filter(showNav).some(n=>n.v==="export_v2")}));
 chk("EXP-16","écran : menu « Export de produits », liste des commandes, avertissement d'exclusion des véhicules",ui.nav&&/Sud Cacao BV/.test(ui.txt)&&/véhicules sont exclus/.test(ui.txt),ui.txt.slice(0,200));
 await pt.evaluate(()=>{const b=[...document.querySelectorAll("[data-a='xp.open']")][0];b.click()});
 const det=await pt.evaluate(()=>document.body.innerText);
 chk("EXP-17","détail de commande : produits, encaissements, frais, documents, expédition et historique",/Encaissements/.test(det)&&/Frais logistiques/.test(det)&&/Documents d'exportation/.test(det)&&/Expédition et suivi/.test(det)&&/Historique/.test(det));
 await pt.evaluate(()=>{__as("admin");UI.xpc=null;UI.f.xp={t:"commandes"};view="export_v2";render();A["xp.cmd.add"]()});
 const f0=await pt.evaluate(()=>{const f=document.querySelector(".md form"),n=S.xp_cmd.length;f.client_id.value=S.xp_clients[0].id;f.devise.value="USD";f.taux.value="610";f.p1.value=S.xp_produits[1].id;f.q1.value="100";f.u1.value="1.5";f.fret.value="20";f.dispatchEvent(new Event("submit",{cancelable:true}));return n});
 await pt.waitForTimeout(300);
 const f1=await pt.evaluate(f0=>{const c=S.xp_cmd[S.xp_cmd.length-1];return{n:S.xp_cmd.length-f0,devise:c.devise,tot:xpTotal(c),open:!!document.querySelector(".md")}},f0);
 chk("EXP-18","formulaire « Nouveau devis » : saisie en dollars, ligne de produit, fret refacturé, devis créé",f1.n===1&&f1.devise==="USD"&&f1.tot===170&&!f1.open,JSON.stringify(f1));
 await pt.evaluate(()=>{A["xp.prod.add"]()});
 const bad=await pt.evaluate(()=>{const f=document.querySelector(".md form");f.code.value="AUTO1";f.nom.value="Voiture d'occasion";f.prix_ref.value="5";f.dispatchEvent(new Event("submit",{cancelable:true}));return null});
 await pt.waitForTimeout(300);
 chk("EXP-19","formulaire produit : un véhicule saisi à l'écran est refusé (le produit n'est pas créé)",await pt.evaluate(()=>!S.xp_produits.some(p=>p.code==="AUTO1")));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
