/* Prestations (Distributions) : catalogue de services sans stock, commandes mixtes, boutique en ligne, comptabilité.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/prestations.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),errs=[];let ok=0,ko=0;
 const t=(id,l,r)=>{if(r===true){ok++;console.log("PASS",id,l)}else{ko++;console.log("FAIL",id,l,"→",r)}};
 const open=async u=>{const p=await ctx.newPage();p.on("pageerror",e=>errs.push(u.slice(0,40)+" : "+e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/"+u);await p.waitForTimeout(400);return p};
 const st=await open("distribution.html");
 await st.evaluate(()=>{window.__T=[];toast=(m,k)=>{__T.push(m)};window.__last=()=>__T[__T.length-1]||"";window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};window.__P=c=>S.produits.find(p=>p.code===c);window.__as("admin")});
 // 1. catalogue et droits
 t("PRE-1","catalogue de démonstration : 4 prestations actives sans stock",await st.evaluate(()=>S.prestations.length===4&&S.prestations.every(p=>p.actif&&p.stock===undefined))?true:"catalogue");
 t("PRE-2","menu Prestations réservé à l'administrateur et au commercial",await st.evaluate(()=>{const n=NAV.find(x=>x.v==="prestations");return n&&n.r.join()==="admin,commercial"})?true:"droits");
 const form=async(vals)=>{await st.evaluate(()=>{__T.length=0});for(const[k,v] of Object.entries(vals)){const e=await st.$(`#mf [name=${k}]`);if(!e)continue;if(typeof v==="boolean")v?await e.check():await e.uncheck();else await e.fill(String(v))}await st.click("#mf .mf button:not(.ghost)");await st.waitForTimeout(150)};
 await st.evaluate(()=>{view="prestations";render();ACT.newPresta()});
 await form({code:"PR-NET",nom:"Nettoyage moto",prix:4000,desc:"Lavage complet",actif:true,en_ligne:true});
 t("PRE-3","création d'une prestation depuis le menu",await st.evaluate(()=>{const p=S.prestations.find(x=>x.code==="PR-NET");return p&&p.prix===4000&&p.en_ligne===true&&S.audit.some(a=>/Création prestation/.test(a.action))})?true:"non créée");
 await st.evaluate(()=>{ACT.newPresta()});await form({code:"PR-NET",nom:"Doublon",prix:1});
 t("PRE-4","code déjà pris par une prestation : refusé",/déjà utilisé/.test(await st.evaluate(()=>__last()))?true:await st.evaluate(()=>__last()));
 await st.evaluate(()=>{ACT.newPresta()});await form({code:"P-RIZ",nom:"Conflit produit",prix:1});
 t("PRE-5","code déjà pris par un produit : refusé",/déjà utilisé/.test(await st.evaluate(()=>__last()))?true:await st.evaluate(()=>__last()));
 await st.evaluate(()=>{ACT.editProd(__P("P-RIZ").id)});await form({code:"PR-NET"});
 t("PRE-6","produit : code d'une prestation refusé",/prestation/.test(await st.evaluate(()=>__last()))?true:await st.evaluate(()=>__last()));
 await st.evaluate(()=>{closeModal();__as("preparateur");ACT.newPresta()});await form({code:"PR-X",nom:"X",prix:5});
 t("PRE-7","le préparateur ne peut pas créer de prestation",await st.evaluate(()=>!S.prestations.some(p=>p.code==="PR-X"))?true:"créée");
 await st.evaluate(()=>{closeModal();__as("admin")});
 // 2. commande mixte (formulaire manuel)
 await st.evaluate(()=>{view="commandes";render();ACT.newCmd?ACT.newCmd():0});
 const hasForm=await st.$("#lignes");
 if(hasForm){
  const opts=await st.$$eval(".l_prod option",o=>o.map(x=>x.value));
  t("PRE-8","formulaire de commande : produits ET prestations proposés",opts.some(v=>v.startsWith("svc:"))&&opts.some(v=>!v.startsWith("svc:"))?true:opts.join());
  await st.evaluate(()=>closeModal());
 }else t("PRE-8","formulaire de commande : produits ET prestations proposés","formulaire introuvable");
 // 3. commande mixte : stock, total, comptabilité
 const r=await st.evaluate(()=>{const ex=S.prestations.find(p=>p.code==="PR-EXP"),emb=S.prestations.find(p=>p.code==="PR-EMB"),cl=S.clients[0],eau=__P("P-EAU");const s0=eau.stock;
  const c=creerCmd({client_id:cl.id,adr:Object.assign({},cl.adresses[0]),lignes:[{produit_id:eau.id,qte:2,pu:eau.prix},{produit_id:null,prestation_id:ex.id,desig:ex.nom,qte:1,pu:ex.prix},{produit_id:null,prestation_id:emb.id,desig:emb.nom,qte:2,pu:emb.prix}],frais:1000,remise:0,paiement:"livraison",mode:"Espèces",canal:"Téléphone",confirmer:true});
  setStatut(c,"preparation");const pret=marquerPrete(c);const apres=eau.stock;
  const noms=c.lignes.map(lname);
  return{pret,s0,apres,total:c.total,prod:c.montant_produits,noms,mv:S.stock_mvts.filter(m=>m.ref===c.numero).length,id:c.id}});
 t("PRE-9","commande mixte : total = produits + prestations + frais, noms lisibles",r.total===2*1800+2000+2*1000+1000&&r.noms.join()===["Eau minérale (pack)","Livraison express (moins de 2 h)","Emballage cadeau"].join()?true:JSON.stringify(r));
 t("PRE-10","préparation : seul le produit sort du stock (aucun mouvement pour les prestations)",r.pret===true&&r.apres===r.s0-2&&r.mv===1?true:JSON.stringify(r));
 const cpt=await st.evaluate(id=>{const c=cmd(id);c.statut="livree";c.hist.push({ts:now(),de:"en_cours",a:"livree",par:"test",note:""});const E=cptAuto().find(e=>e.source_id===id);const sum=s=>E.lignes.filter(l=>l.sens===s).reduce((t,l)=>t+l.montant,0);
  const credit=k=>E.lignes.filter(l=>l.sens==="C"&&l.compte===cdd(k)).reduce((t,l)=>t+l.montant,0);return{D:sum("D"),C:sum("C"),art:credit("vente_art"),serv:credit("vente_serv"),prest:credit("vente_prest"),total:c.total}},r.id);
 t("PRE-11","comptabilité : écriture équilibrée ; marchandises en ventes d'articles, prestations en prestations vendues (7062), livraison en services vendus (7061)",cpt.D===cpt.C&&cpt.D===cpt.total&&cpt.art===3600&&cpt.prest===4000&&cpt.serv===1000?true:JSON.stringify(cpt));
 // 4. remise répartie
 const rm=await st.evaluate(()=>{const ex=S.prestations.find(p=>p.code==="PR-COU"),cl=S.clients[0],eau=__P("P-EAU");
  const c=creerCmd({client_id:cl.id,adr:Object.assign({},cl.adresses[0]),lignes:[{produit_id:eau.id,qte:1,pu:1800},{produit_id:null,prestation_id:ex.id,desig:ex.nom,qte:1,pu:3000}],frais:0,remise:2500,paiement:"livraison",mode:"Espèces",canal:"Téléphone",confirmer:true});
  c.statut="livree";c.hist.push({ts:now(),de:"en_cours",a:"livree",par:"test",note:""});const E=cptAuto().find(e=>e.source_id===c.id),cr=k=>E.lignes.filter(l=>l.sens==="C"&&l.compte===cdd(k)).reduce((t,l)=>t+l.montant,0);
  return{total:c.total,art:cr("vente_art"),serv:cr("vente_serv"),prest:cr("vente_prest"),D:E.lignes.filter(l=>l.sens==="D").reduce((t,l)=>t+l.montant,0)}});
 t("PRE-12","remise : imputée d'abord sur les articles, le reste sur les prestations ; écriture équilibrée",rm.total===2300&&rm.art===0&&rm.prest===2300&&rm.serv===0&&rm.D===2300?true:JSON.stringify(rm));
 // 5. boutique en ligne
 await st.evaluate(()=>{__P("P-RIZ").en_ligne=true;S.config.whatsapp="0707000000";S.config.momo_comptes=[];S.prestations.find(p=>p.code==="PR-EXP").en_ligne=true;S.prestations.find(p=>p.code==="PR-EMB").actif=false;S.prestations.find(p=>p.code==="PR-EMB").en_ligne=true;save()});
 const link=await st.evaluate(()=>boutLink());const sh=await open("distribution.html#boutique="+link.split("#boutique=")[1]);
 const txt=await sh.$eval("#app",e=>e.innerText);
 t("PRE-13","boutique : prestations actives et publiées affichées (pas les inactives), marquées « prestation », jamais « Épuisé »",/Livraison express/.test(txt)&&/Nettoyage moto/.test(txt)&&!/Emballage cadeau/.test(txt)&&/prestation/.test(txt)&&!/Épuisé/.test(txt)?true:txt.slice(0,300));
 await sh.click('[data-c="PR-EXP"] [data-b="+"]');await sh.click('[data-c="PR-EXP"] [data-b="+"]');await sh.click('[data-c="P-RIZ"] [data-b="+"]');
 await sh.fill("#b_nom","Awa Traoré");await sh.fill("#b_tel","0707123456");await sh.selectOption("#b_zone",{index:1});await sh.fill("#b_q","Riviera 2");await sh.click("#b_send");await sh.waitForSelector("#b_msg");
 const msg=await sh.$eval("#b_msg",e=>e.value);
 const imp=await st.evaluate(x=>{__T.length=0;__as("commercial");view="vente_ligne";render();document.getElementById("wb_txt").value=x;ACT.webImport();const c=S.commandes[0];return{m:__last(),l:c.lignes.map(l=>({n:lname(l),q:l.qte,pu:l.pu,pid:l.produit_id,sid:l.prestation_id})),total:c.total}},msg);
 t("PRE-14","import : la commande contient le produit et 2 prestations aux prix du catalogue, sans stock pour la prestation",/importée/.test(imp.m)&&imp.l.length===2&&imp.l.some(l=>l.n==="Livraison express (moins de 2 h)"&&l.q===2&&l.pu===2000&&!l.pid&&l.sid)&&imp.l.some(l=>l.n==="Riz 25 kg"&&l.q===1&&l.pid)?true:JSON.stringify(imp));
 const fg=await st.evaluate(()=>{__as("admin");const o=b64({f:"ZZ9999",n:"Test",t:"0707000222",z:S.config.zones[0].nom,q:"Cocody",l:[["PR-EMB",1]],p:"e"});__T.length=0;view="vente_ligne";render();document.getElementById("wb_txt").value="[BOUTIQUE:"+o+"]";ACT.webImport();return __last()});
 t("PRE-15","prestation désactivée depuis la publication du lien : commande refusée à l'import",/inconnu/.test(fg)?true:fg);
 // 6. écrans
 const vw=await st.evaluate(()=>{__as("admin");view="prestations";render();return document.getElementById("app").innerText});
 t("PRE-16","écran Prestations : liste, quantités vendues, sans NaN",/Livraison express/.test(vw)&&/Quantité vendue/.test(vw)&&!/NaN|undefined/.test(vw)?true:vw.slice(0,200));
 const sa=await st.evaluate(()=>{const j=JSON.parse(localStorage.getItem(KEY));return Array.isArray(j.prestations)&&j.prestations.length>=5});
 t("PRE-17","les prestations sont enregistrées avec les données (sauvegarde/restauration)",sa?true:"absentes");
 await st.screenshot({path:process.env.SHOT||"/tmp/prestations.png"});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
