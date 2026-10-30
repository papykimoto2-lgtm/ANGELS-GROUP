/* Argent : recette déclarée → encaissement en un clic (préremplissage) ; caisse fermée bloque l'espèces. */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":u.endsWith(".html")?"text/html; charset=utf-8":u.endsWith(".js")?"application/javascript":"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1200,height:900},serviceWorkers:"block"})).newPage(),E=[];
 p.on("pageerror",e=>E.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/transport.html");await p.waitForTimeout(400);
 let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const r=await p.evaluate(()=>{const o={};ME=S.users.find(x=>x.role==="caissier"&&x.actif)||(S.users.push({id:"u_a",nom:"caiss",role:"caissier",actif:true}),S.users[S.users.length-1]);
  S.drivers.push({id:"drv_e1",nom:"Yao",actif:true});
  S.declarations.push({id:"dcl_e1",numero:"DR-E1",driver_id:"drv_e1",date:today(),montant:25000,mode:"mobile",ref:"MM123",statut:"declaree",hist:[],par:"Yao",t:now()});
  view="encaissements";render();o.section=document.body.innerText.includes("Recettes déclarées à encaisser");
  o.sec0=document.body.innerText.includes("Recettes déclarées");o.can=can("encaissements","c");A["enc.decl"]("dcl_e1");
  o.mt=document.querySelector("#mt").value;o.md=document.querySelector("#md").value;o.rf=document.querySelector("#rf").value;
  document.querySelector("[data-x]").click();
  /* espèces, caisse fermée */
  S.cash_sessions.forEach(s=>{if(s.statut==="ouverte"){s.statut="cloturee"}});
  A["enc.open"]("drv_e1",{mt:5000,mode:"especes"});o.goOff=document.querySelector("#go").disabled;o.msg=document.body.innerText.includes("Caisse fermée");
  document.querySelector("[data-x]").click();
    o.btn=!!document.querySelector('[data-a="enc.decl"]');
  const old=h=>new Date(Date.now()-h*36e5).toISOString();
  S.declarations.push({id:"dcl_r1",numero:"DR-R1",driver_id:"drv_e1",date:"2025-01-01",montant:9000,mode:"especes",statut:"declaree",hist:[],par:"Yao",t:old(30)},{id:"dcl_r2",numero:"DR-R2",driver_id:"drv_e1",date:"2025-01-02",montant:7000,mode:"especes",statut:"validee",hist:[],par:"Yao",t:old(80)},{id:"dcl_r3",numero:"DR-R3",driver_id:"drv_e1",date:"2025-01-03",montant:3000,mode:"especes",statut:"declaree",hist:[],par:"Yao",t:old(2)},{id:"dcl_r4",numero:"DR-R4",driver_id:"drv_e1",date:"2025-01-04",montant:3000,mode:"especes",statut:"rejetee",hist:[],par:"Yao",t:old(90)});
  S.payments.push({id:"p_r2",driver_id:"drv_e1",type:"echeances",montant:7000,statut:"confirme",date_valeur:"2025-01-02"});
  o.al=alertesCentre().A.filter(a=>a.key.startsWith("dcn:")).map(a=>a.key+":"+a.niveau).sort().join(",");
  /* base existante : droits admin anciens (lecture seule) remis à niveau par migration, une seule fois */
  S.perms.admin.caisse=["v"];S.perms.admin.encaissements=["v"];delete S.settings.mig_perm_caisse_admin;migrerNegoce();
  o.mig=S.perms.admin.caisse.includes("c")&&S.perms.admin.caisse.includes("e")&&S.perms.admin.encaissements.includes("c");
  S.perms.admin.caisse=["v"];migrerNegoce();o.unefois=!S.perms.admin.caisse.includes("c");S.perms.admin.caisse=defPerms().admin.caisse;
  /* admin : même niveau que la caisse livraison — ouvre, encaisse, entrée/sortie, clôture */
  ME=S.users.find(x=>x.role==="admin"&&x.actif)||(S.users.push({id:"u_ad",nom:"adm",role:"admin",actif:true}),S.users[S.users.length-1]);
  S.cash_sessions=S.cash_sessions.filter(x=>x.statut!=="ouverte");view="caisse";render();
  o.btnOuvrir=!!document.querySelector('[data-a="cs.open"]');
  try{const c=cxCaisse();ouvrirCaisse(0,c.id,{});o.ouverte=!!openSession(c.id);render();o.btnBons=!!document.querySelector('[data-a="cs.in"]')&&!!document.querySelector('[data-a="cs.out"]')&&!!document.querySelector('[data-a="cs.close"]');o.can=can("encaissements","c")}catch(e){o.err=e.message}
return o});
 chk("ED-1","section « recettes déclarées à encaisser »",r.section===true,r.section);
 chk("ED-2","clic Encaisser : montant, mode, référence préremplis",r.mt==="25000"&&r.md==="mobile"&&r.rf==="MM123",JSON.stringify([r.mt,r.md,r.rf]));
 chk("ED-3","espèces avec caisse fermée : bouton bloqué + message",r.goOff===true&&r.msg===true,JSON.stringify([r.goOff,r.msg]));
 chk("ED-5","bouton Encaisser affiché (droit encaisser)",r.btn===true&&r.can===true,JSON.stringify([r.btn,r.can]));chk("ED-6","rappel : >24 h non encaissée seulement (r1 moyenne, r2 encaissée exclue, r3 récente et r4 rejetée exclues)",/dcn:dcl_e1:\w+,dcn:dcl_r1:moyenne$/.test(r.al)||/(^|,)dcn:dcl_r1:moyenne$/.test(r.al)&&!/r2|r3|r4/.test(r.al),"got="+r.al);chk("ED-7","admin : bouton Ouvrir la caisse, ouverture, boutons Entrée/Sortie/Clôturer sur la carte",r.btnOuvrir===true&&r.ouverte===true&&r.btnBons===true,JSON.stringify([r.btnOuvrir,r.ouverte,r.btnBons,r.err]));chk("ED-8","migration : droits admin anciens remis à niveau, une seule fois",r.mig===true&&r.unefois===true,JSON.stringify([r.mig,r.unefois]));chk("ED-4","aucune erreur de script",!E.length,E[0]);
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await b.close();srv.close();process.exit(ko?1:0)})();
