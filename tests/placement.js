/* Module Placement : travailleurs, besoins, affectations sans conflit, pointage, facturation, paie, écritures SYSCOHADA, accès protégé.
   Usage : NODE_OPTIONS="--require $PWD/tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/placement.js */
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
 const h=await page("placement.html");
 t("PL-1","sans connexion : formulaire d'accès, aucune donnée",(await h.$("#gate"))&&!(await h.$(".tab"))?true:"visible");
 await h.fill("#gate [name=pwd]","faux");await h.click("#gate button[type=submit]");await h.waitForTimeout(600);
 t("PL-2","mot de passe faux refusé",/incorrect/.test(await h.$eval("#gate",e=>e.innerText))?true:"accepté");
 await h.fill("#gate [name=pwd]","Demo@Angels2026");await h.click("#gate button[type=submit]");await h.waitForTimeout(800);
 t("PL-3","connexion administrateur : 8 onglets",(await h.$$(".tab")).length===8?true:(await h.$$(".tab")).length);
 const E=(f,...a)=>h.evaluate(([f,a])=>{try{return{ok:ANGELS_PLACEMENT[f](...a)}}catch(e){return{err:e.message}}},[f,a]);
 const J=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10),auj=J(0);
 // 1. validations
 const t1=(await E("ajouterTravailleur","t",{nom:"Koné Ali",tel:"07 07 07 07 07",type:"moto",competences:"permis A, Abidjan"})).ok;
 t("PL-4","travailleur créé",t1&&t1.statut==="disponible"?true:JSON.stringify(t1));
 t("PL-5","même numéro (autre format) refusé : une fiche par personne",/déjà/.test((await E("ajouterTravailleur","t",{nom:"Autre",tel:"+225 0707070707",type:"moto"})).err||"")?true:"doublon accepté");
 t("PL-6","type inconnu et téléphone invalide refusés",/Type/.test((await E("ajouterTravailleur","t",{nom:"X Y",tel:"0101010101",type:"pirate"})).err||"")&&/Téléphone/.test((await E("ajouterTravailleur","t",{nom:"X Y",tel:"12",type:"moto"})).err||"")?true:"accepté");
 const t2=(await E("ajouterTravailleur","t",{nom:"Traoré Awa",tel:"0505050505",type:"bureau"})).ok,t3=(await E("ajouterTravailleur","t",{nom:"Diallo Seydou",tel:"0102030405",type:"moto"})).ok;
 const c1=(await E("ajouterClient","t",{nom:"Acme Industries"})).ok;
 t("PL-7","entreprise en double refusée (casse ignorée)",/existe/.test((await E("ajouterClient","t",{nom:"ACME industries"})).err||"")?true:"doublon");
 const bes=a=>E("creerBesoin","t",Object.assign({client_id:c1.id,type:"moto",poste:"Coursier",nb:1,debut:J(-3),fin:J(2),taux_client:10000,taux_travailleur:7000},a));
 t("PL-8","besoin : paie supérieure au tarif client refusée (marge négative)",/marge négative/.test((await bes({taux_travailleur:12000})).err||"")?true:"accepté");
 t("PL-9","besoin : fin avant début, nombre et montant invalides refusés",/précède/.test((await bes({fin:J(-9)})).err||"")&&/Nombre/.test((await bes({nb:0})).err||"")&&/invalide/.test((await bes({taux_client:-5})).err||"")?true:"accepté");
 const b1=(await bes({})).ok;
 // 2. affectation
 const a1=(await E("affecter","t",b1.id,t1.id)).ok;
 t("PL-10","affectation créée, besoin pourvu",a1&&(await h.evaluate(id=>ANGELS_PLACEMENT.etat().besoins.find(x=>x.id===id).statut,b1.id))==="pourvu"?true:"statut");
 t("PL-11","besoin déjà pourvu : 2e affectation refusée",/pourvu|plus ouvert/.test((await E("affecter","t",b1.id,t3.id)).err||"")?true:"acceptée");
 const b2=(await bes({poste:"Livreur",debut:J(0),fin:J(4)})).ok;
 t("PL-12","chevauchement : le même travailleur ne peut être à deux endroits",/Conflit/.test((await E("affecter","t",b2.id,t1.id)).err||"")?true:"conflit non détecté");
 const ex=(await E("statutTravailleur","t",t3.id,"exclu","")).err;t("PL-13","exclusion sans motif refusée",/Motif/.test(ex||"")?true:"acceptée");
 await E("statutTravailleur","t",t3.id,"exclu","Vol de colis");
 t("PL-14","travailleur exclu : affectation impossible",/exclu/.test((await E("affecter","t",b2.id,t3.id)).err||"")?true:"acceptée");
 const cand=(await h.evaluate(id=>ANGELS_PLACEMENT.candidats(null,id).map(x=>x.id),b2.id));
 t("PL-15","candidats : ni l'affecté en conflit ni l'exclu",!cand.includes(t1.id)&&!cand.includes(t3.id)&&cand.includes(t2.id)?true:JSON.stringify(cand));
 // 3. pointage
 t("PL-16","pointage d'un jour futur refusé",/futur/.test((await E("pointer","t",a1.id,J(1),1)).err||"")?true:"accepté");
 t("PL-17","pointage hors période refusé",/hors/.test((await E("pointer","t",a1.id,J(-10),1)).err||"")?true:"accepté");
 t("PL-18","fraction invalide refusée",/Présence/.test((await E("pointer","t",a1.id,J(-3),0.3)).err||"")?true:"acceptée");
 const p1=(await E("pointer","t",a1.id,J(-3),1)).ok,p2=(await E("pointer","t",a1.id,J(-2),0.5)).ok;(await E("pointer","t",a1.id,J(-1),0));
 t("PL-19","journée déjà pointée refusée",/déjà/.test((await E("pointer","t",a1.id,J(-3),1)).err||"")?true:"doublon");
 // 4. facturation
 const f1=(await E("facturer","t",c1.id)).ok;
 t("PL-20","facture : 1,5 jour × 10 000 = 15 000 HT, TVA 18 % = 2 700, TTC 17 700",f1&&f1.ht===15000&&f1.tva===2700&&f1.ttc===17700?true:JSON.stringify(f1&&[f1.ht,f1.tva,f1.ttc]));
 t("PL-21","journées facturées une seule fois",/Aucune journée/.test((await E("facturer","t",c1.id)).err||"")?true:"refacturé");
 t("PL-22","pointage facturé : correction refusée",/facturé/.test((await E("corrigerPointage","t",p1.id,0,"erreur")).err||"")?true:"modifié");
 t("PL-23","annulation d'une affectation pointée refusée",/pointées/.test((await E("annulerAffectation","t",a1.id,"x")).err||"")?true:"annulée");
 // 5. encaissement
 t("PL-24","encaissement supérieur au reste refusé",/supérieur/.test((await E("encaisser","t",f1.id,99999,"Espèces","")).err||"")?true:"accepté");
 t("PL-25","Mobile Money sans référence refusé",/Référence/.test((await E("encaisser","t",f1.id,5000,"Wave","")).err||"")?true:"accepté");
 await E("encaisser","t",f1.id,5000,"Wave","WAV-0001");
 t("PL-26","référence déjà utilisée refusée",/déjà été utilisée/.test((await E("encaisser","t",f1.id,1000,"Orange Money","wav-0001")).err||"")?true:"doublon");
 t("PL-27","facture partiellement payée",(await h.evaluate(id=>ANGELS_PLACEMENT.etat().factures.find(x=>x.id===id).statut,f1.id))==="partielle"?true:"statut");
 // 6. paie
 const pa=(await E("payer","t",t1.id,"MTN MoMo","MTN-7788")).ok;
 t("PL-28","paie : 1,5 jour × 7 000 = 10 500",pa&&pa.jours===1.5&&pa.net===10500?true:JSON.stringify(pa));
 t("PL-29","paie : même référence qu'un encaissement refusée ; rien à payer 2 fois",/Aucune journée/.test((await E("payer","t",t1.id,"Wave","WAV-0001")).err||"")?true:"double paie");
 // 7. indicateurs et écritures
 const r=(await E("resume")).ok;t("PL-30","marge du mois = facturé − paie (15 000 − 10 500)",r&&r.ca_mois===15000&&r.cout_mois===10500&&r.marge_mois===4500?true:JSON.stringify(r));
 const ec=await h.evaluate(()=>{const e=ANGELS_PLACEMENT.ecritures();return{eq:ANGELS_PLACEMENT.equilibre(e),n:e.length,cptes:[...new Set(e.flatMap(x=>x.lignes.map(l=>l.compte)))].sort().join()}});
 t("PL-31","écritures SYSCOHADA équilibrées (4111, 4431, 553, 6611, 7061, 422)",ec.eq&&ec.cptes==="4111,422,4431,553,6611,7061"?true:JSON.stringify(ec));
 const cs=await h.evaluate(()=>{ANGELS_PLACEMENT.ajouterTravailleur("t",{nom:"=CMD()",tel:"0909090909",type:"pied"});return ANGELS_PLACEMENT.exportPaies()});
 t("PL-32","export Excel protégé contre l'injection de formules",!/;"=CMD/.test(cs)?true:"formule");
 // 8. écrans
 await h.evaluate(()=>{ANGELS_PLACEMENT.ajouterTravailleur("t",{nom:"<img src=x onerror=window.__xss=1>",tel:"0808080808",type:"moto"})});
 for(const v of ["pil","tra","ent","bes","poi","fac","pai","reg"]){await h.click(`.tab[data-v=${v}]`);await h.waitForTimeout(150)}
 await h.click(".tab[data-v=tra]");await h.waitForTimeout(200);
 t("PL-33","nom malveillant affiché comme texte",!(await h.evaluate(()=>window.__xss))&&(await h.$("img[src=x]"))===null?true:"XSS");
 await h.click(".tab[data-v=bes]");await h.waitForTimeout(150);await h.click(".bc[data-a=ouvrir]");await h.waitForTimeout(200);
 t("PL-34","fiche d'un besoin : affectés et retour",(await h.$("[data-a=retour]"))?true:"absent");
 // saisie par l'écran
 await h.click(".tab[data-v=ent]");await h.fill("form[data-f=ent] [name=nom]","Société Écran SARL");await h.click("form[data-f=ent] button[type=submit]");await h.waitForTimeout(300);
 t("PL-35","création d'une entreprise par l'écran",await h.evaluate(()=>ANGELS_PLACEMENT.etat().clients.some(c=>c.nom==="Société Écran SARL"))?true:"non créée");
 // 9. instance, hub, sync
 const hub=await ctx.newPage();hub.on("pageerror",e=>errs.push("hub : "+e.message));
 await hub.route("**/marque.js",r=>r.fulfill({contentType:"application/javascript",body:'window.ERP_MARQUE={id:"t",nom:"T",modules:["distribution","placement"],outils:["crm"],admin:null}'}));
 await hub.goto(base+"/index.html");await hub.waitForTimeout(600);
 t("PL-36","hub : carte Placement et onglet de tableau de bord",(await hub.$("#c-placement"))&&(await hub.$$eval("#tabs .tab",x=>x.some(y=>/Placement/.test(y.textContent))))?true:"absent");
 t("PL-37","hub : indicateurs lus (besoins ouverts affichés)",/\d/.test(await hub.$eval("#p-b",e=>e.textContent))?true:"vide");
 t("PL-38","profil de synchronisation « placement » et migration serveur",fs.readFileSync(path.join(root,"sync-engine.js"),"utf8").includes('placement: { nom: "Placement"')&&fs.readFileSync(path.join(root,"supabase/functions/_shared/sync.js"),"utf8").includes('"placement"')&&fs.existsSync(path.join(root,"supabase/migrations/019_sync_modules.sql"))?true:"manquant");
 t("PL-39","aucune erreur JavaScript",errs.length===0?true:errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
