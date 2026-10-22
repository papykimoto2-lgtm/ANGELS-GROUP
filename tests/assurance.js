/* Module Assurance (courtage) : assurés, compagnies, devis comparatif, polices, primes, reversements, commissions, avenants, renouvellements, sinistres, écritures SYSCOHADA.
   Usage : NODE_OPTIONS="--require $PWD/tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/assurance.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1200,height:1000},serviceWorkers:"block"}),errs=[];let ok=0,ko=0;
 const t=(id,l,r)=>{if(r===true){ok++;console.log("PASS",id,l)}else{ko++;console.log("FAIL",id,l,"→",r)}};
 const page=async u=>{const p=await ctx.newPage();p.on("pageerror",e=>errs.push(u+" : "+e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/"+u);await p.waitForTimeout(500);return p};
 const pd=await page("distribution.html");await pd.close();
 const h=await page("assurance.html");
 t("AS-1","sans connexion : formulaire d'accès, aucune donnée",(await h.$("#gate"))&&!(await h.$(".tab"))?true:"visible");
 await h.fill("#gate [name=pwd]","faux");await h.click("#gate button[type=submit]");await h.waitForTimeout(600);
 t("AS-2","mot de passe faux refusé",/incorrect/.test(await h.$eval("#gate",e=>e.innerText))?true:"accepté");
 await h.fill("#gate [name=pwd]","Demo@Angels2026");await h.click("#gate button[type=submit]");await h.waitForTimeout(800);
 t("AS-3","connexion administrateur : 7 onglets",(await h.$$(".tab")).length===7?true:(await h.$$(".tab")).length);
 const E=(f,...a)=>h.evaluate(([f,a])=>{try{return{ok:ANGELS_ASSURANCE[f](...a)}}catch(e){return{err:e.message}}},[f,a]);
 const J=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10),auj=J(0);
 const a1=(await E("ajouterAssure","t",{nom:"Koffi Jean",tel:"07 07 07 07 07"})).ok;
 t("AS-4","assuré créé",a1&&a1.type==="particulier"?true:JSON.stringify(a1));
 t("AS-5","même numéro (autre format) refusé",/existe/.test((await E("ajouterAssure","t",{nom:"Autre",tel:"+225 0707070707"})).err||"")?true:"doublon");
 const c1=(await E("ajouterCompagnie","t",{nom:"NSIA Assurances",taux:12})).ok,c2=(await E("ajouterCompagnie","t",{nom:"SUNU Assurances",taux:10})).ok;
 t("AS-6","taux de commission hors bornes refusé ; compagnie en double refusée",/Taux/.test((await E("ajouterCompagnie","t",{nom:"Z Z",taux:55})).err||"")&&/existe/.test((await E("ajouterCompagnie","t",{nom:"nsia assurances"})).err||"")?true:"accepté");
 await E("tauxBranche","t",c1.id,"sante",8);
 t("AS-7","taux par branche appliqué (santé 8 %, auto 12 %)",await h.evaluate(([i])=>{const c=ANGELS_ASSURANCE.etat().compagnies.find(x=>x.id===i);return ANGELS_ASSURANCE.tauxDe(c,"sante")===8&&ANGELS_ASSURANCE.tauxDe(c,"auto")===12},[c1.id])?true:"taux");
 // devis comparatif
 const q=(await E("creerDevis","t",{assure_id:a1.id,branche:"auto",risque:"Toyota Yaris AB-123-CI",propositions:[{compagnie_id:c1.id,prime_nette:100000,accessoires:5000,taxes:15000},{compagnie_id:c2.id,prime_nette:90000,accessoires:4000,taxes:13000}]})).ok;
 t("AS-8","devis comparatif : TTC calculé par proposition (120 000 / 107 000), moins cher repéré",q&&q.propositions[0].ttc===120000&&q.propositions[1].ttc===107000&&(await h.evaluate(i=>ANGELS_ASSURANCE.meilleure(ANGELS_ASSURANCE.etat().devis.find(x=>x.id===i)).ttc,q.id))===107000?true:JSON.stringify(q));
 t("AS-9","devis : deux propositions d'une même compagnie, prime nulle, risque vide refusés",/Une seule/.test((await E("creerDevis","t",{assure_id:a1.id,branche:"auto",risque:"xxx",propositions:[{compagnie_id:c1.id,prime_nette:1},{compagnie_id:c1.id,prime_nette:2}]})).err||"")&&/invalide/.test((await E("creerDevis","t",{assure_id:a1.id,branche:"auto",risque:"xxx",propositions:[{compagnie_id:c1.id,prime_nette:0}]})).err||"")&&/risque/.test((await E("creerDevis","t",{assure_id:a1.id,branche:"auto",risque:"",propositions:[{compagnie_id:c1.id,prime_nette:5}]})).err||"")?true:"accepté");
 // police
 const p1=(await E("emettreDepuisDevis","t",q.id,0,{numero:"POL-001",effet:J(-10)})).ok;
 t("AS-10","police émise depuis le devis : TTC 120 000, commission 12 % de la prime nette = 12 000, échéance +12 mois",p1&&p1.ttc===120000&&p1.commission===12000&&p1.echeance>p1.effet&&p1.encaisse_par==="courtier"?true:JSON.stringify(p1));
 t("AS-11","devis déjà accepté : 2e émission refusée",/déjà accepté/.test((await E("emettreDepuisDevis","t",q.id,1,{numero:"POL-002",effet:auj})).err||"")?true:"acceptée");
 t("AS-12","numéro de police en double chez la même compagnie refusé",/existe déjà/.test((await E("emettrePolice","t",{assure_id:a1.id,compagnie_id:c1.id,branche:"sante",numero:"pol-001",effet:auj,prime_nette:5000})).err||"")?true:"doublon");
 t("AS-13","échéance avant l'effet et durée > 5 ans refusées",/suivre/.test((await E("emettrePolice","t",{assure_id:a1.id,compagnie_id:c1.id,branche:"sante",numero:"P-X1",effet:auj,echeance:J(-3),prime_nette:5000})).err||"")&&/5 ans/.test((await E("emettrePolice","t",{assure_id:a1.id,compagnie_id:c1.id,branche:"sante",numero:"P-X2",effet:auj,echeance:"2040-01-01",prime_nette:5000})).err||"")?true:"acceptée");
 // encaissement / reversement
 t("AS-14","encaissement supérieur au reste refusé ; Mobile Money sans référence refusé",/supérieur/.test((await E("encaisserPrime","t",p1.id,999999,"Espèces","")).err||"")&&/Référence/.test((await E("encaisserPrime","t",p1.id,1000,"Wave","")).err||"")?true:"accepté");
 await E("encaisserPrime","t",p1.id,60000,"Wave","WAV-7001");
 t("AS-15","référence déjà utilisée refusée (casse ignorée)",/déjà été utilisée/.test((await E("encaisserPrime","t",p1.id,1000,"Orange Money","wav-7001")).err||"")?true:"doublon");
 const due=await h.evaluate(i=>{const S=ANGELS_ASSURANCE.etat(),p=S.polices.find(x=>x.id===i);return ANGELS_ASSURANCE.dueCompagnie(S,p)},p1.id);
 t("AS-16","dû à la compagnie = encaissé − commission proportionnelle (60 000 − 6 000 = 54 000)",due===54000?true:due);
 t("AS-17","reversement supérieur au dû refusé",/supérieur au dû/.test((await E("reverserCompagnie","t",p1.id,54001,"Virement","VIR-0001")).err||"")?true:"accepté");
 await E("encaisserPrime","t",p1.id,60000,"Espèces","");await E("reverserCompagnie","t",p1.id,108000,"Virement","VIR-0002");
 t("AS-18","police soldée : plus rien à encaisser ni à reverser",await h.evaluate(i=>{const S=ANGELS_ASSURANCE.etat(),p=S.polices.find(x=>x.id===i);return ANGELS_ASSURANCE.encPrime(S,p)===120000&&ANGELS_ASSURANCE.dueCompagnie(S,p)===0},p1.id)?true:"solde");
 // prime payée à la compagnie : commission à recevoir
 const p2=(await E("emettrePolice","t",{assure_id:a1.id,compagnie_id:c2.id,branche:"incendie",numero:"SUN-77",effet:auj,prime_nette:50000,accessoires:2000,taxes:3000,encaisse_par:"assureur"})).ok;
 t("AS-19","prime payée à la compagnie : le cabinet ne peut ni l'encaisser ni la reverser",/directement/.test((await E("encaisserPrime","t",p2.id,1000,"Espèces","")).err||"")&&/Rien à reverser/.test((await E("reverserCompagnie","t",p2.id,1000,"Espèces","")).err||"")?true:"accepté");
 t("AS-20","commission reçue : bornée au montant dû (5 000), puis soldée",/supérieur/.test((await E("recevoirCommission","t",p2.id,5001,"Virement","VIR-0003")).err||"")&&(await E("recevoirCommission","t",p2.id,5000,"Virement","VIR-0003")).ok?true:"erreur");
 t("AS-21","commission : encaissement par le cabinet refusé sur ce mode",/retenue/.test((await E("recevoirCommission","t",p1.id,100,"Espèces","")).err||"")?true:"accepté");
 // avenant, résiliation, renouvellement
 t("AS-22","avenant : prime TTC ajustée (+10 000), commission recalculée",(await E("avenant","t",p1.id,{objet:"Ajout bris de glace",delta:10000})).ok&&await h.evaluate(i=>{const S=ANGELS_ASSURANCE.etat(),p=S.polices.find(x=>x.id===i);return ANGELS_ASSURANCE.ttcPolice(S,p)===130000&&ANGELS_ASSURANCE.commPolice(S,p)===13200},p1.id)?true:"avenant");
 t("AS-23","avenant sans objet et prime négative refusés",/Objet/.test((await E("avenant","t",p1.id,{objet:"",delta:5})).err||"")&&/négative/.test((await E("avenant","t",p1.id,{objet:"Test x",delta:-999999})).err||"")?true:"accepté");
 const p3=(await E("emettrePolice","t",{assure_id:a1.id,compagnie_id:c1.id,branche:"sante",numero:"SAN-1",effet:J(-340),echeance:J(25),prime_nette:80000})).ok;
 t("AS-24","renouvellement : police à échéance proche signalée",(await h.evaluate(i=>ANGELS_ASSURANCE.aRenouveler().some(p=>p.id===i),p3.id))?true:"non signalée");
 const p4=(await E("renouveler","t",p3.id,{numero:"SAN-2"})).ok;
 t("AS-25","renouvellement : nouvelle police le lendemain de l'échéance, même risque, ancienne marquée renouvelée",p4&&p4.effet>p3.echeance&&p4.renouvelle_id===p3.id&&!(await h.evaluate(i=>ANGELS_ASSURANCE.aRenouveler().some(p=>p.id===i),p3.id))?true:JSON.stringify(p4));
 t("AS-26","police déjà renouvelée : 2e renouvellement refusé",/déjà renouvelée/.test((await E("renouveler","t",p3.id,{numero:"SAN-3"})).err||"")?true:"accepté");
 const p5=(await E("emettrePolice","t",{assure_id:a1.id,compagnie_id:c2.id,branche:"rc",numero:"RC-9",effet:J(-5),prime_nette:20000})).ok;
 t("AS-27","résiliation sans motif refusée ; avec motif acceptée",/Motif/.test((await E("resilier","t",p5.id,auj,"")).err||"")&&(await E("resilier","t",p5.id,auj,"Vente du bien")).ok?true:"erreur");
 // sinistres
 t("AS-28","sinistre : hors période de garantie, futur, sans nature refusés",/hors/.test((await E("declarerSinistre","t",{police_id:p1.id,date:J(-200),nature:"Choc"})).err||"")&&/futur/.test((await E("declarerSinistre","t",{police_id:p1.id,date:J(2),nature:"Choc"})).err||"")&&/Nature/.test((await E("declarerSinistre","t",{police_id:p1.id,date:auj,nature:""})).err||"")?true:"accepté");
 const s1=(await E("declarerSinistre","t",{police_id:p1.id,date:J(-1),nature:"Collision avec un tiers",estime:450000,lieu:"Cocody"})).ok;
 t("AS-29","sinistre déclaré (statut « Déclaré »)",s1&&s1.statut==="declare"?true:JSON.stringify(s1));
 t("AS-30","passage direct de « déclaré » à « indemnisé » refusé",/impossible/.test((await E("avancerSinistre","t",s1.id,"indemnise","",100)).err||"")?true:"accepté");
 await E("avancerSinistre","t",s1.id,"transmis","Dossier envoyé");await E("avancerSinistre","t",s1.id,"expertise","");await E("avancerSinistre","t",s1.id,"accepte","");
 t("AS-31","refus sans motif impossible ; indemnisation avec montant",/Motif/.test((await E("avancerSinistre","t",s1.id,"clos","")).err||"")&&(await E("avancerSinistre","t",s1.id,"indemnise","Virement reçu",380000)).ok?true:"erreur");
 // indicateurs et écritures
 const r=(await E("resume")).ok;
 t("AS-32","indicateurs cohérents (sinistres ouverts 0, polices en cours, primes à encaisser 10 000 d'avenant)",r&&r.sinistres_ouverts===0&&r.polices_en_cours>=3&&r.a_encaisser>=10000?true:JSON.stringify(r));
 const ec=await h.evaluate(()=>{const e=ANGELS_ASSURANCE.etat(),E2=ANGELS_ASSURANCE.ecritures();const com=E2.filter(x=>x.journal==="VE").flatMap(x=>x.lignes).filter(l=>l.compte==="7061").reduce((s,l)=>s+l.credit,0);return{eq:ANGELS_ASSURANCE.equilibre(E2),cptes:[...new Set(E2.flatMap(x=>x.lignes.map(l=>l.compte)))].sort().join(),com}});
 t("AS-33","écritures équilibrées (4111, 4712, 553, 571, 5211, 7061) et commissions comptabilisées",ec.eq&&ec.cptes==="4111,4712,5211,553,571,7061"&&ec.com>0?true:JSON.stringify(ec));
 const cs=await h.evaluate(()=>{ANGELS_ASSURANCE.ajouterAssure("t",{nom:"=CMD()",tel:"0909090909"});ANGELS_ASSURANCE.emettrePolice("t",{assure_id:ANGELS_ASSURANCE.etat().assures.slice(-1)[0].id,compagnie_id:ANGELS_ASSURANCE.etat().compagnies[0].id,branche:"vie",numero:"=HYPER()",effet:new Date().toISOString().slice(0,10),prime_nette:1000});return ANGELS_ASSURANCE.exportPolices()});
 t("AS-34","export Excel protégé contre l'injection de formules",!/;"=(CMD|HYPER)/.test(cs)&&/'=HYPER/.test(cs)?true:"formule");
 // écrans
 await h.evaluate(()=>{ANGELS_ASSURANCE.ajouterAssure("t",{nom:"<img src=x onerror=window.__xss=1>",tel:"0808080808"})});
 for(const v of ["pil","ass","cmp","dev","pol","sin","reg"]){await h.click(`.tab[data-v=${v}]`);await h.waitForTimeout(150)}
 await h.click(".tab[data-v=ass]");await h.waitForTimeout(200);
 t("AS-35","nom malveillant affiché comme texte",!(await h.evaluate(()=>window.__xss))&&(await h.$("img[src=x]"))===null?true:"XSS");
 await h.click(".tab[data-v=dev]");await h.waitForTimeout(150);await h.click(".bc[data-a=ouvrir]");await h.waitForTimeout(200);
 t("AS-36","fiche d'un devis : tableau comparatif",(await h.$("table"))&&(await h.$("[data-a=retour]"))?true:"absent");
 await h.click(".tab[data-v=pol]");await h.waitForTimeout(150);await h.click("table a[data-a=ouvrir]");await h.waitForTimeout(200);
 t("AS-37","fiche d'une police : montants, actions et déclaration de sinistre",(await h.$("form[data-f=sin]"))&&/Prime TTC/.test(await h.$eval("#app",e=>e.innerText))?true:"absent");
 await h.click(".tab[data-v=cmp]");await h.fill("form[data-f=cmp] [name=nom]","Allianz Côte d'Ivoire");await h.click("form[data-f=cmp] button[type=submit]");await h.waitForTimeout(300);
 t("AS-38","création d'une compagnie par l'écran",await h.evaluate(()=>ANGELS_ASSURANCE.etat().compagnies.some(c=>c.nom==="Allianz Côte d'Ivoire"))?true:"non créée");
 // hub, sync
 const hub=await ctx.newPage();hub.on("pageerror",e=>errs.push("hub : "+e.message));
 await hub.route("**/marque.js",r=>r.fulfill({contentType:"application/javascript",body:'window.ERP_MARQUE={id:"t",nom:"T",modules:["distribution","assurance"],outils:["crm"],admin:null}'}));
 await hub.goto(base+"/index.html");await hub.waitForTimeout(600);
 t("AS-39","hub : carte Assurance, indicateurs et onglet du tableau de bord",(await hub.$("#c-assurance"))&&/\d/.test(await hub.$eval("#s-p",e=>e.textContent))&&(await hub.$$eval("#tabs .tab",x=>x.some(y=>/Assurance/.test(y.textContent))))?true:"absent");
 t("AS-40","profil de synchronisation « assurance » et migration serveur",fs.readFileSync(path.join(root,"sync-engine.js"),"utf8").includes('assurance: { nom: "Assurance"')&&fs.readFileSync(path.join(root,"supabase/functions/_shared/sync.js"),"utf8").includes('"assurance"')&&/assurance/.test(fs.readFileSync(path.join(root,"supabase/migrations/019_sync_modules.sql"),"utf8"))?true:"manquant");
 t("AS-41","aucune erreur JavaScript",errs.length===0?true:errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
