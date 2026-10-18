/* Catalogue des véhicules (Transport) : parking, véhicules en livraison (arrivages d'importation et ventes à livrer), fiches, photos, impression.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/catalogue.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1200,height:1000}}),errs=[];let ok=0,ko=0;
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/transport.html");await p.waitForTimeout(500);
 const PNG="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
 await p.evaluate(PNG=>{window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};
  window.__try=fn=>{const snap=JSON.stringify(S),me=ME&&ME.id;try{fn();return null}catch(e){S=JSON.parse(snap);ME=me?by(S.users,me):null;return e.message}};
  window.__ach=o=>acheterVehicule(Object.assign({date:today(),fournisseur:"Auto Import SARL",marque:"Toyota",modele:"Corolla",annee:2020,vin:"CAT-"+Math.random().toString(36).slice(2,8).toUpperCase(),prix:1180000,paye:1180000,mode:"banque",km:30000},o));
  window.__img=id=>{S.attachments.push({id,nom:id+".png",type:"image/png",taille:70,t:now(),par:"t",data:PNG});return id};
  window.__txt=(v,tab)=>{if(tab){UI.tab.cat=tab}view=v;render();return document.getElementById("app").innerText};
  __as("admin");S.settings.tva_taux=18;S.attachments.push({id:"at_pdf",nom:"f.pdf",type:"application/pdf",taille:5,t:now(),par:"t",data:"data:application/pdf;base64,AAAA"})},PNG);
 const t=async(id,label,fn,arg)=>{let r;try{r=await p.evaluate(fn,arg)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",typeof r==="string"?r:JSON.stringify(r))}};
 await t("CAT-1","menu « Catalogue véhicules » visible pour les profils du stock, des ventes et de la direction ; absent pour le chauffeur et le transitaire ; modification réservée au stock et aux ventes",()=>{
  const vis=r=>{__as(r);return NAV.filter(showNav).some(n=>n.v==="catalogue_veh")};const R=["admin","directeur","stock_auto","commercial_auto","comptable","controleur","importateur"].map(vis);const X=["chauffeur","transitaire"].map(vis);
  __as("admin");const v=__ach({vin:"CAT-DROIT"});__as("comptable");const c=__try(()=>majFicheVN(v.id,{prix_affiche:1000000}));__as("stock_auto");const s=__try(()=>majFicheVN(v.id,{prix_affiche:1000000}));__as("commercial_auto");const k=__try(()=>majFicheVN(v.id,{prix_affiche:1500000}));__as("admin");
  return R.every(Boolean)&&X.every(x=>!x)&&/Droits insuffisants/.test(c)&&s===null&&k===null||JSON.stringify({R,X,c,s,k})});
 await t("CAT-2","fiche catalogue : prix, boîte, places, équipements, description ; contrôles ; véhicule vendu ou disparu non modifiable",()=>{
  const v=__ach({vin:"CAT-FICHE",marque:"Hyundai",modele:"Tucson"}),id=v.id;const E=[__try(()=>majFicheVN(id,{prix_affiche:-5})),__try(()=>majFicheVN(id,{prix_affiche:1,boite:"cvt"})),__try(()=>majFicheVN(id,{prix_affiche:1,places:99}))];
  majFicheVN(id,{prix_affiche:15900000,boite:"automatique",places:5,couleur:"Blanc",annee:2022,carburant:"Diesel",equipements:"Climatisation, caméra de recul",description:"Premier propriétaire"});const w=by(S.vn,id);
  const x=vendreVehicule({vn_id:id,date:today(),client:"Kouadio",prix:16000000,mode:"banque"});const sold=__try(()=>majFicheVN(id,{prix_affiche:1}));
  return /Prix/.test(E[0])&&/Boîte/.test(E[1])&&/places/.test(E[2])&&w.prix_affiche===15900000&&w.boite==="automatique"&&w.places===5&&w.equipements.includes("caméra")&&w.annee===2022&&/non modifiable/.test(sold)&&S.audit.some(a=>/Fiche catalogue/.test(a.a))||JSON.stringify({E,sold})});
 await t("CAT-3","photos : image obligatoire (PDF refusé), 6 maximum, retrait qui libère le fichier non utilisé",()=>{
  const v=__ach({vin:"CAT-PHOTO"}),id=v.id;const e1=__try(()=>photoVN(id,"at_pdf")),e0=__try(()=>photoVN(id,""));for(let i=1;i<=6;i++)photoVN(id,__img("im"+i));const e7=__try(()=>photoVN(id,__img("im7")));
  const a=by(S.vn,id).photos.length;retirerPhotoVN(id,"im1");const b2=by(S.vn,id).photos.length,libere=!S.attachments.some(x=>x.id==="im1");__as("comptable");const c=__try(()=>retirerPhotoVN(id,"im2"));__as("admin");
  return /image/i.test(e1)&&/Choisir/.test(e0)&&a===6&&/6 photos/.test(e7)&&b2===5&&libere&&/Droits insuffisants/.test(c)||JSON.stringify({e1,e0,e7,a,b2,libere,c})});
 await t("CAT-4","au parking : seuls les véhicules présents (ni en route, ni vendus, ni disparus) ; cartes avec photo, prix, caractéristiques, emplacement ; aucune donnée interne (coût, fournisseur)",()=>{
  const d=creerImport({fournisseur:"Yokohama",pays:"Japon",devise:"EUR",taux:655.957,date_taux:today(),cle:"valeur",etd:addDays(today(),-5),eta:addDays(today(),25)});const r=ajouterVehiculeImport(d.id,{marque:"Nissan",modele:"Patrol",vin:"CAT-ROUTE",prix_dev:9000,poids:2000,volume:15});
  const v=S.vn.find(x=>x.vin==="CAT-FICHE"),w=S.vn.find(x=>x.vin==="CAT-PHOTO");majFicheVN(w.id,{prix_affiche:8900000,carburant:"Essence"});transfererVN(w.id,{loc:"Zone B — 12",motif:"Mise en vitrine"});
  const txt=__txt("catalogue_veh","parking"),html=document.getElementById("app").innerHTML,ids=parkingVN().map(x=>x.vin);
  return !ids.includes("CAT-ROUTE")&&!ids.includes("CAT-FICHE")&&ids.includes("CAT-PHOTO")&&/Corolla/.test(txt)&&!/Tucson/.test(txt)&&!/Patrol/.test(txt)&&/8\s900\s000\sF/.test(txt)&&/Zone B — 12/.test(txt)&&/<img/.test(html)&&!/Coût de revient|Auto Import SARL|Fournisseur/.test(txt)&&!/NaN|undefined/.test(txt)||JSON.stringify({ids,c:/Corolla/.test(txt),t:/Tucson/.test(txt),p:/Patrol/.test(txt),px:/8\s900\s000\sF/.test(txt),z:/Zone B — 12/.test(txt),img:/<img/.test(html),int:(txt.match(/Coût de revient|Auto Import SARL|Fournisseur/)||[])[0],nan:/NaN|undefined/.test(txt)})});
 await t("CAT-5","filtres du parking : recherche, carburant, disponibles / réservés / dommages / fiche à compléter",()=>{
  const w=S.vn.find(x=>x.vin==="CAT-PHOTO"),c2=__ach({vin:"CAT-FILTRE",marque:"Kia",modele:"Sportage",carburant:"Diesel"});reserverVN({vn_id:c2.id,client:"Awa",date:today()});ctrlReception(w.id,{date:today(),etat:"dommages",dommages:"Rayure portière"});
  const cnt=(s,c,q)=>{UI.f.cat={q:q||"",s:s||"",c:c||""};UI.tab.cat="parking";view="catalogue_veh";render();return document.querySelectorAll(".vc").length};
  const all=cnt(),dis=cnt("dispo"),res=cnt("reserve"),dom=cnt("dommages"),inc=cnt("incomplet"),die=cnt("","Diesel"),q=cnt("","","sportage"),none=cnt("","","zzzz");UI.f.cat={q:"",s:"",c:""};
  return all===parkingVN().length&&res===1&&dis===all-1&&dom===1&&inc>=1&&die>=1&&q===1&&none===0||JSON.stringify({all,dis,res,dom,inc,die,q,none})});
 await t("CAT-6","en livraison — arrivages : véhicules importés en route avec dossier, étape, ETA (retard / jours restants), précommande, blocage ; absents du parking",()=>{
  const d=S.imports[S.imports.length-1],v=S.vn.find(x=>x.vin==="CAT-ROUTE");faireEtape(d.id,"achat_docs",{date:today()});faireEtape(d.id,"transport",{date:today()});faireEtape(d.id,"expedie",{date:today()});reserverVN({vn_id:v.id,client:"Mensah",date:today(),precommande:"oui"});bloquerImport(d.id,{cause:"paiement",note:"Attente fonds"});
  const d2=creerImport({fournisseur:"Seoul Motors",pays:"Corée",devise:"USD",taux:600,date_taux:today(),cle:"valeur",etd:addDays(today(),-20),eta:addDays(today(),-3)});ajouterVehiculeImport(d2.id,{marque:"Hyundai",modele:"Santa Fe",vin:"CAT-RETARD",prix_dev:12000,poids:1900,volume:14});
  const txt=__txt("catalogue_veh","livraison");const html=document.getElementById("app").innerHTML;
  return /Arrivages — importations en route vers le parc/.test(txt)&&/Patrol/.test(txt)&&/Santa Fe/.test(txt)&&/IMP-\d{4}-\d{5}/.test(txt)&&/En transit/.test(txt)&&/Mensah \(précommande\)/.test(txt)&&/Paiement/.test(txt)&&/dépassée de 3 j/.test(txt)&&/J-\d+/.test(txt)&&/Arrivages en retard/.test(txt)&&!/NaN|undefined/.test(txt)||txt.slice(0,600)});
 await t("CAT-7","en livraison — ventes à livrer : véhicules vendus non livrés (état, solde dû, autorisation) et ventes à l'export ; la livraison les retire de la liste",()=>{
  const a=S.vn.find(x=>x.vin==="CAT-PHOTO"),x1=vendreVehicule({vn_id:a.id,date:today(),client:"Yao Client",prix:9000000,mode:"banque",encaisse:2000000});
  const e=__ach({vin:"CAT-EXP",marque:"Peugeot",modele:"3008"}),x2=vendreVehicule({vn_id:e.id,date:today(),client:"Kofi Mensah",prix:7000000,export:"oui",pays:"Ghana",mode:"banque"});
  let txt=__txt("catalogue_veh","livraison");const avant=ventesALivrer().length;
  const has=/Ventes à livrer aux clients/.test(txt)&&/Yao Client/.test(txt)&&/Kofi Mensah/.test(txt)&&/7 000 000 F|Export — À préparer/.test(txt)&&/À livrer/.test(txt)&&/Zone B — 12/.test(txt);
  __as("directeur");autoriserLivraison(x1.id,{derogation:"Solde réglé sous 30 jours, client connu"});__as("admin");livrerVente(x1.id,{date:today(),statut_physique:"present",etat:"conforme",km:31000,doc0:"oui",doc1:"oui",doc2:"oui",doc3:"oui",doc4:"oui",responsable:"Chef de parc"});
  txt=__txt("catalogue_veh","livraison");return has&&ventesALivrer().length===avant-1&&!/Yao Client/.test(txt)&&/Kofi Mensah/.test(txt)||JSON.stringify({has,avant,txt:txt.slice(0,300)})});
 await t("CAT-8","impression : véhicules disponibles uniquement, prix et caractéristiques, sans coût, fournisseur, châssis ni marge ; CSV du catalogue",()=>{
  A["cat.print"]();const m=document.querySelector(".md").innerText;document.querySelector(".md").remove();const disp=parkingVN().filter(v=>!resActive(v));const csv=CSVS.catalogue_veh();
  return /Véhicules disponibles/.test(m)&&/Prix TTC/.test(m)&&disp.every(v=>m.includes(v.modele))&&!/Coût|Fournisseur|Marge|CAT-/.test(m)&&!/Sportage/.test(m)&&csv[1].some(r=>r[0]==="Parking")&&csv[1].some(r=>r[0]==="Arrivage")&&csv[1].some(r=>r[0]==="Vente à livrer")&&!/NaN|undefined/.test(m)||JSON.stringify({m:m.slice(0,200)})});
 await t("CAT-9","fiche du véhicule : galerie de photos, caractéristiques, prix affiché ; alerte « fiche catalogue à compléter » ; données conservées après rechargement",()=>{
  const v=S.vn.find(x=>x.vin==="CAT-FILTRE");A["vn.det"](v.id);const m=document.querySelector(".md");const t0=m.innerText;m.remove();const w=S.vn.find(x=>x.vin==="CAT-PHOTO"),g=(by(S.vn,w.id).photos||[]).length;
  const al=alertesCentre().A.some(a=>/Fiche catalogue à compléter/.test(a.msg));save();const j=JSON.parse(localStorage.getItem(KEY)),vv=j.vn.find(x=>x.vin==="CAT-PHOTO");
  return /Fiche catalogue|Stock commercial/.test(t0)&&al&&g>=5&&vv.prix_affiche===8900000&&vv.photos.length===g&&!/NaN|undefined/.test(t0)||JSON.stringify({g,al})});
 await p.evaluate(()=>{__as("admin");UI.tab.cat="parking";UI.f.cat={q:"",s:"",c:""};view="catalogue_veh";render()});await p.screenshot({path:process.env.SHOT||"/tmp/catalogue.png"});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
