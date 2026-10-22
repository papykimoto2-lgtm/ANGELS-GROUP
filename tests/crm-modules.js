/* CRM unifié des instances : fiches issues de Distribution, Placement et Assurance fusionnées par téléphone.
   Usage : NODE_OPTIONS="--require $PWD/tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/crm-modules.js */
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
 const pl=await page("placement.html"),as=await page("assurance.html");
 const J=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10),auj=J(0);
 // même personne : client Distribution, entreprise cliente du Placement et assuré du courtage (numéro écrit trois façons)
 await pl.evaluate(()=>{const J=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10),P=ANGELS_PLACEMENT;const t=P.ajouterTravailleur("t",{nom:"Koné Ali",tel:"0707070707",type:"moto"});const c=P.ajouterClient("t",{nom:"Société Yao SARL",tel:"+225 05 05 05 05 05"});
  const b=P.creerBesoin("t",{client_id:c.id,type:"moto",poste:"Coursier",nb:1,debut:J(-2),fin:J(0),taux_client:10000,taux_travailleur:7000});const a=P.affecter("t",b.id,t.id);P.pointer("t",a.id,J(-2),1);P.pointer("t",a.id,J(-1),1);const f=P.facturer("t",c.id);P.encaisser("t",f.id,10000,"Espèces","")});
 await as.evaluate(()=>{const J=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10),A=ANGELS_ASSURANCE;const a=A.ajouterAssure("t",{nom:"Yao Société",tel:"0505050505"});A.ajouterAssure("t",{nom:"<img src=x onerror=window.__xss=1>",tel:"0606060606"});const c=A.ajouterCompagnie("t",{nom:"NSIA",taux:10});
  A.emettrePolice("t",{assure_id:a.id,compagnie_id:c.id,branche:"auto",numero:"P-1",effet:J(-3),prime_nette:100000,accessoires:5000,taxes:15000});A.encaisserPrime("t",A.etat().polices[0].id,20000,"Espèces","")});
 const h=await page("crm.html");
 await h.fill("#gate [name=pwd]","Demo@Angels2026");await h.click("#gate button[type=submit]");await h.waitForTimeout(800);
 const L=await h.evaluate(()=>{const L=ANGELS_CRM.contacts();const f=L.find(x=>x.cle===ANGELS_CRM.cleTel("0505050505"));return{n:L.length,apps:f?Object.keys(f.apps).sort().join():"",ca:f?f.ca:0,enc:f?f.encours:0,achats:f?f.achats.length:0,trav:L.some(x=>x.types.travailleur),lues:Object.keys(L.apps_lues).sort().join()}});
 t("CRM-M1","applications lues : Placement et Assurance en plus de Distribution",/assurance/.test(L.lues)&&/placement/.test(L.lues)?true:L.lues);
 t("CRM-M2","même numéro (3 écritures) dans Placement et Assurance : une seule fiche",L.apps==="assurance,placement"?true:L.apps);
 t("CRM-M3","chiffre d'affaires = facture placement TTC (23 600) + prime d'assurance TTC (120 000)",L.ca===143600?true:L.ca);
 t("CRM-M4","encours = reste de la facture (13 600) + prime non encaissée (100 000)",L.enc===113600?true:L.enc);
 t("CRM-M5","travailleurs du Placement présents comme fiches liées (sans chiffre d'affaires)",L.trav?true:"absents");
 await h.click(".tab[data-v=con]");await h.waitForTimeout(300);
 const o6=await h.$$eval("select[data-a=fapp] option",o=>o.map(x=>x.value).join());t("CRM-M6","ANGEL'S : filtre par application inchangé (3 applications d'origine)",o6===",distribution,transport,agro"?true:o6);
 t("CRM-M7","nom malveillant affiché comme texte",!(await h.evaluate(()=>window.__xss))?true:"XSS");
 // instance LOGISTICA : le CRM propose ses trois applications
 const hl=await ctx.newPage();hl.on("pageerror",e=>errs.push("crm instance : "+e.message));
 await hl.route("**/marque.js",r=>r.fulfill({contentType:"application/javascript",body:'window.ERP_MARQUE={id:"t",nom:"T",modules:["distribution","placement","assurance"],outils:["crm"],admin:null}'}));
 await hl.goto(base+"/crm.html");await hl.waitForTimeout(500);await hl.fill("#gate [name=pwd]","Demo@Angels2026");await hl.click("#gate button[type=submit]");await hl.waitForTimeout(800);await hl.click(".tab[data-v=con]");await hl.waitForTimeout(300);
 const opts=await hl.$$eval("select[data-a=fapp] option",o=>o.map(x=>x.value).join());
 t("CRM-M8","instance : filtre limité aux modules choisis (Distribution, Placement, Assurance)",opts===",distribution,placement,assurance"?true:opts);
 await hl.selectOption("select[data-a=fapp]","assurance");await hl.waitForTimeout(300);
 t("CRM-M9","filtre Assurance : seulement les assurés",(await hl.$$(".cl")).length===2?true:(await hl.$$(".cl")).length);
 t("CRM-M10","aucune erreur JavaScript",errs.length===0?true:errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
