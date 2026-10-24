/* Versements Mobile Money du livreur, de bout en bout : déclaration (appli livreur) → bureau → validation / rejet par la caisse → statut et solde dans l'appli livreur.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/versement-momo-bout-en-bout.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,v,i)=>{if(v===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",i===undefined?v:i)}};
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push("BUREAU "+e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/distribution.html");await p.waitForTimeout(300);
 await p.evaluate(()=>{window.__T=[];toast=m=>{__T.push(m)};window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};
  const lv=S.livreurs[0];window.__L=lv.id;S.versements=[];S.clotures=[];S.fonds=S.fonds.filter(f=>f.livreur_id!==lv.id);
  S.fonds.push({id:"fz",type:"encaissement",livreur_id:lv.id,livraison_id:"zz",montant:50000,mode:"Espèces",ts:now()});
  window.__ev=d=>({type:"incident",livraison_ref:"stats:"+lv.id,livreur_ref:lv.id,donnees:Object.assign({nature:"VERSEMENT"},d)});
  window.__A=()=>passPayloadLivreur(liv(__L),Date.now()-1,Date.now()).argent});
 const B=(fn,a)=>p.evaluate(fn,a);
 // 1. déclaration (message tel que le serveur le transmet)
 const d1=await B(()=>{const e=passAppliquer(__ev({montant:20000,mode:"Wave",ref_paiement:"WV2610AA01",note:"midi"}));const A=__A();return{e,solde:soldeLiv(__L),att:versEnAttente(__L),v:A.versements[0],A:{solde:A.solde,attente:A.attente}}});
 chk("MM-1","déclaration reçue : « en validation », solde inchangé (50 000 F), 20 000 F en attente",d1.e===""&&d1.v.statut==="declare"&&d1.solde===50000&&d1.att===20000&&d1.A.attente===20000,JSON.stringify(d1));
 // 2. garde-fous
 const d2=await B(()=>{const dup=passAppliquer(__ev({montant:1000,mode:"Wave",ref_paiement:"wv2610aa01"})),trop=passAppliquer(__ev({montant:40000,mode:"Wave",ref_paiement:"WV2610ZZ99"})),cc=passAppliquer(__ev({montant:1000,mode:"Wave",ref_paiement:"AB"}));return{dup,trop,cc,n:S.versements.length,chat:(S.chat||[]).filter(x=>x.livreur_id===__L&&x.de==="centre").length}});
 chk("MM-2","refus : référence déjà utilisée, montant au-delà du restant (30 000 F), référence trop courte ; le livreur est prévenu par message",d2.dup&&d2.trop&&d2.cc&&d2.n===1&&d2.chat>=3,JSON.stringify(d2));
 // 3. le caissier voit la déclaration et valide par le bouton
 const d3=await B(async()=>{window.__c0=(S.caisse_mvts||[]).length;__as("caissier");view="finance";ui.fin="vers";render();const tx=document.querySelector("main").innerText,btn=document.querySelector('[data-act=versOk]');const vu=/WV2610AA01/.test(tx)&&/20 000/.test(tx)&&!!btn;btn&&btn.click();await new Promise(r=>setTimeout(r,200));const v=S.versements[0],A=__A();
  const f=S.fonds.filter(x=>x.type==="reversement"&&x.livreur_id===__L);return{vu,st:v.statut,par:v.traite_par_nom,f:f.length&&[f[0].montant,f[0].mode,f[0].ref],solde:soldeLiv(__L),att:versEnAttente(__L),Av:A.versements[0].statut,As:A.solde,Arev:A.rev,caisse:(S.caisse_mvts||[]).length-__c0}});
 chk("MM-3","le caissier voit la ligne et clique « Encaissé » : statut « valide », reversement 20 000 F (Wave) créé, solde 30 000 F, plus rien en attente",d3.vu&&d3.st==="valide"&&d3.f&&d3.f[0]===20000&&d3.f[1]==="Wave"&&d3.solde===30000&&d3.att===0&&d3.Av==="valide"&&d3.As===30000&&d3.Arev===20000,JSON.stringify(d3));
 chk("MM-4","Mobile Money : aucune entrée dans la caisse espèces",d3.caisse===0,d3.caisse);
 // 4. rejet avec motif
 const d4=await B(async()=>{passAppliquer(__ev({montant:10000,mode:"Orange Money",ref_paiement:"OM2610BB02"}));const v=S.versements.find(x=>x.ref==="OM2610BB02");__as("caissier");versTraiter(v.id,"rejeter","Somme non reçue");const A=__A(),w=A.versements.find(x=>x.ref==="OM2610BB02");return{st:w.statut,motif:w.motif,solde:soldeLiv(__L),att:versEnAttente(__L),re:versTraiter(v.id,"valider")}});
 chk("MM-5","rejet avec motif : « rejete » + motif visibles par le livreur, solde inchangé (30 000 F), rien en attente, impossible de revalider",d4.st==="rejete"&&d4.motif==="Somme non reçue"&&d4.solde===30000&&d4.att===0,JSON.stringify(d4));
 // 5. sécurité
 const d5=await B(()=>{passAppliquer(__ev({montant:5000,mode:"MTN MoMo",ref_paiement:"MT2610CC03"}));const v=S.versements.find(x=>x.ref==="MT2610CC03");__as("vendeur");versTraiter(v.id,"valider");return{st:v.statut,solde:soldeLiv(__L)}});
 chk("MM-6","sécurité : un vendeur ne peut pas valider un versement",d5.st==="declare"&&d5.solde===30000,JSON.stringify(d5));
 // 6. solde réduit depuis la déclaration : validation refusée
 const d6=await B(()=>{__as("caissier");const v=S.versements.find(x=>x.ref==="MT2610CC03");S.fonds.push({id:"fr2",type:"reversement",livreur_id:__L,montant:28000,mode:"Espèces",ts:now()});versTraiter(v.id,"valider");const r={st:v.statut,msg:__T.slice(-1)[0]};S.fonds=S.fonds.filter(f=>f.id!=="fr2");return r});
 chk("MM-7","validation refusée si le montant dépasse le restant à reverser",d6.st==="declare"&&/supérieur/.test(d6.msg),JSON.stringify(d6));
 // 7. comptabilité
 const d7=await B(()=>{const e=cptAuto().find(x=>x.ref==="WV2610AA01");return e?{d:e.lignes.filter(l=>l.sens==="D").reduce((t,l)=>t+l.montant,0),c:e.lignes.filter(l=>l.sens==="C").reduce((t,l)=>t+l.montant,0),cl:e.lignes.filter(l=>l.sens==="C").map(l=>l.compte),dl:e.lignes.filter(l=>l.sens==="D").map(l=>l.compte)}:null});
 chk("MM-8","comptabilité : écriture équilibrée de 20 000 F (débit compte Wave/mobile, crédit argent détenu par les livreurs)",d7&&d7.d===20000&&d7.c===20000&&d7.cl.length===1,JSON.stringify(d7));
 // 8. appli livreur : affichage des trois statuts et du formulaire réel
 const q=await ctx.newPage();q.on("pageerror",e=>errs.push("LIVREUR "+e.message));await q.goto(base+"/livreur.html");await q.waitForTimeout(500);
 const pay=await B(()=>{const A=__A();return JSON.parse(JSON.stringify(A))});
 const L=await q.evaluate(a=>{user={id:"u"};moi={nom:"L",livreur_ref:"l1"};STATS={maj_le:new Date().toISOString(),payload:{p:{j:{gains:0},s7:{gains:0},m30:{gains:0},mois:{gains:0}},argent:a}};const d=document.createElement("div");d.innerHTML=gainsHtml();const t=d.textContent;
  window.__sent=[];api=async(fn,body)=>{__sent.push(body);return{}};charger=async()=>{};ouvert=null;versementForm();const f=document.querySelector(".ov [name=m]");return{t:t,form:!!f,max:f&&f.max,val:f&&f.value}},pay);
 chk("MM-9","appli livreur : « Encaissé » (20 000 F, WV2610AA01), « Rejeté » + motif, « En validation » ; reste à reverser 30 000 F",/Encaissé/.test(L.t)&&/Rejeté/.test(L.t)&&/Somme non reçue/.test(L.t)&&/En validation/.test(L.t)&&/30[\s  ]000/.test(L.t)&&/Déjà reversé[^0-9]*20[\s  ]000/.test(L.t),L.t.slice(0,700));
 chk("MM-10","formulaire livreur : maximum = restant hors attente (25 000 F)",L.form&&L.max==="25000"&&L.val==="25000",JSON.stringify(L));
 console.log(errs.length?errs.join("\n"):"");console.log(`RÉSULTAT : ${ok} réussis, ${ko} échecs`);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
