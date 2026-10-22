/* Acompte Mobile Money : annoncé par le client sur le portail (montant, opérateur, référence du SMS), reçu dans la demande, porté par la commande, vérifié par la caisse avant enregistrement.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/acompte-mm.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
(async()=>{
 await new Promise(o=>srv.listen(0,"127.0.0.1",o));const base="http://127.0.0.1:"+srv.address().port;
 const br=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await br.newContext({viewport:{width:420,height:1100}}),errs=[];let posts=[];
 await ctx.route("**/functions/v1/portail-demande",async rt=>{posts.push(JSON.parse(rt.request().postData()||"{}"));rt.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({ok:true,refs:["X"],doublons:0})})});
 const pg=await ctx.newPage();pg.on("pageerror",e=>errs.push("P:"+e.message));await pg.addInitScript(()=>{window.ANGELS_PASSERELLE={url:"https://demo.supabase.co",key:"x"}});
 const url="/portail.html?boutique=Yoyoo+Boutique&tel=0585656086&ref=V1&src=qr";
 await pg.goto(base+url);await pg.waitForTimeout(700);
 chk("AC-1","sans compte Mobile Money publié : aucune section d'acompte",await pg.locator("#ac_on").count()===0);
 await pg.evaluate(()=>{T.shop=Object.assign({},T.shop||{},{mm:["Wave : 07 07 07 07 07","Orange Money : 05 05 05 05 05"]});ST.cl=null;ST.ac=null;commanderRendre()});await pg.waitForTimeout(200);
 chk("AC-2","avec comptes publiés : section « Acompte Mobile Money (facultatif) », décochée par défaut, comptes de l'entreprise affichés une fois cochée",await pg.locator("#ac_on").count()===1&&!(await pg.locator("#ac_on").isChecked())&&!(await pg.locator("#ac_box").isVisible()));
 await pg.fill(".c_d","Robe wax");await pg.fill(".c_q","2");await pg.fill(".c_p","15000");await pg.check("#ac_on");await pg.waitForTimeout(100);
 await pg.fill("#c_nom","Awa");await pg.fill("#c_tel","0701020304");await pg.selectOption("#c_zone",{index:1});await pg.fill("#c_q","Riviera");
 chk("AC-3","comptes visibles une fois la case cochée",/Wave : 07 07 07 07 07/.test(await pg.innerText("#ac_box"))&&/Orange Money/.test(await pg.innerText("#ac_box")));
 await pg.click('[data-cl="add"]');await pg.waitForTimeout(200);const sug=await pg.inputValue("#ac_m");
 chk("AC-4","montant suggéré : 30 % de l'estimation (2 × 15 000 F → 9 000 F) ; l'état de la case et des champs survit à un nouvel affichage",sug==="9000"&&await pg.isChecked("#ac_on"),sug);
 await pg.fill("#ac_m","100");await pg.fill("#ac_rf","AB12");await pg.click("#c_send");await pg.waitForTimeout(150);const e1=await pg.innerText("#c_err");
 await pg.fill("#ac_m","9 000");await pg.fill("#ac_rf","ab");await pg.click("#c_send");await pg.waitForTimeout(150);const e2=await pg.innerText("#c_err");
 chk("AC-5","montant trop faible ou référence trop courte : message d'erreur, rien n'est envoyé",/entre 500 F/.test(e1)&&/référence/.test(e2)&&!posts.some(p=>p.message),e1+"|"+e2);
 await pg.selectOption("#ac_op","Orange Money");await pg.fill("#ac_rf"," om-7788 ab ");await pg.click("#c_send");await pg.waitForTimeout(300);
 const txt=await pg.innerText("#cm");
 chk("AC-6","commande validée : le message WhatsApp indique l'acompte (montant, opérateur, référence) « à vérifier »",/Acompte Mobile Money : 9[\s  ]000 F \(Orange Money, réf\. OM7788AB\) — à vérifier/.test(await pg.inputValue("textarea.msg")),(await pg.inputValue("textarea.msg")).slice(0,400));
 posts=[];await pg.click("[data-direct]");await pg.waitForTimeout(500);
 const cm=posts.find(p=>p.message),m=/\[BOUTIQUE:([A-Za-z0-9_-]+)\]/.exec(cm&&cm.message||""),dp=m&&JSON.parse(Buffer.from(m[1].replace(/-/g,"+").replace(/_/g,"/"),"base64").toString("utf8"));
 chk("AC-7","envoi direct : l'acompte part dans la commande (montant entier, opérateur, référence normalisée en majuscules)",!!dp&&dp.ac&&dp.ac.m===9000&&dp.ac.op==="Orange Money"&&dp.ac.rf==="OM7788AB",JSON.stringify(dp&&dp.ac));
 /* sans acompte */
 await pg.goto(base+url);await pg.waitForTimeout(500);await pg.evaluate(()=>{T.shop=Object.assign({},T.shop||{},{mm:["Wave : 07"]});ST.cl=null;ST.ac=null;commanderRendre()});
 await pg.fill(".c_d","Sac");await pg.fill("#c_nom","Awa");await pg.fill("#c_tel","0701020304");await pg.selectOption("#c_zone",{index:1});await pg.fill("#c_q","Riviera");await pg.click("#c_send");await pg.waitForTimeout(250);posts=[];await pg.click("[data-direct]");await pg.waitForTimeout(400);
 const c2=posts.find(p=>p.message),m2=/\[BOUTIQUE:([A-Za-z0-9_-]+)\]/.exec(c2&&c2.message||""),d2=m2&&JSON.parse(Buffer.from(m2[1].replace(/-/g,"+").replace(/_/g,"/"),"base64").toString("utf8"));
 chk("AC-8","case décochée : aucun acompte dans la commande",!!d2&&!("ac" in d2));
 /* ---------- Bureau ---------- */
 const d=await ctx.newPage();d.on("pageerror",e=>errs.push("D:"+e.message));d.on("dialog",x=>x.accept());await d.goto(base+"/distribution.html");await d.waitForTimeout(600);
 const R=await d.evaluate(()=>{
  const bad=[acMmLire({m:100,rf:"ABCD"}),acMmLire({m:9000,rf:"AB"}),acMmLire({m:9e9,rf:"ABCD"}),acMmLire(null),acMmLire("x")].map(x=>x===null);
  const good=acMmLire({m:"9000.4",op:"orange money",rf:" om-77 88 "}),inconnu=acMmLire({m:5000,op:"<img>",rf:"ABCDEF"});
  return{bad,good,inconnu:inconnu&&inconnu.op}});
 chk("AC-9","contrôle à l'import : montant hors bornes, référence trop courte ou données illisibles → ignorés ; opérateur normalisé (inconnu → « Mobile Money ») ; statut « à vérifier »",R.bad.every(Boolean)&&R.good.montant===9000&&R.good.op==="Orange Money"&&R.good.ref==="OM7788"&&R.good.statut==="a_verifier"&&R.inconnu==="Mobile Money",JSON.stringify(R));
 const S1=await d.evaluate(()=>{S.demandes=[];ME=S.users.find(u=>u.role==="vendeur");const v=vend();const msg="[BOUTIQUE:"+b64({f:"ACM001",n:"Awa Client",t:"0701020304",z:S.config.zones[0].nom,q:"Riviera",s:"qr",v:v.id,vn:v.nom,l:[["Robe wax",2,15000]],ac:{m:9000,op:"Wave",rf:"wv-5521ab"}})+"]";
  const r=webImporter(msg),dm=S.demandes[0];const html=demandeCard(dm);return{ok:r.ok.length,ac:dm&&dm.acompte,carte:/Acompte Mobile Money annoncé : 9[\s  ]000 F/.test(html)&&/WV5521AB/.test(html)&&/vérifié par la caisse/.test(html)}});
 chk("AC-10","bureau / vendeur : la demande porte l'acompte (à vérifier) et l'affiche avec la mention « vérifié par la caisse »",S1.ok===1&&S1.ac&&S1.ac.montant===9000&&S1.ac.ref==="WV5521AB"&&S1.ac.statut==="a_verifier"&&S1.carte,JSON.stringify(S1));
 const S2=await d.evaluate(async()=>{const dm=S.demandes[0];demTraiter(dm.id);const dr=WA.drafts[0];const hasAc=!!dr.acompte_mm&&dr.acompte_mm.montant===9000;
  dr.nom="Awa Client";dr.tel="0701020304";dr.zone=S.config.zones[0].nom;dr.quartier="Riviera";dr.repere="Pharmacie";dr.lignes.forEach(l=>{if(!(l.pu>=0))l.pu=15000});
  const n0=S.commandes.length;await waCreate();const c=S.commandes[0];return{hasAc,created:S.commandes.length===n0+1,acm:c.acompte_mm,fonds:S.fonds.filter(f=>f.commande_id===c.id&&f.type==="acompte").length,id:c.id}});
 chk("AC-11","transformation de la demande en commande : l'acompte suit la commande, « à vérifier », aucun mouvement de caisse tant que la caisse n'a rien confirmé",S2.hasAc&&S2.created&&S2.acm&&S2.acm.statut==="a_verifier"&&S2.fonds===0,JSON.stringify(S2));
 const S3=await d.evaluate(id=>{ME=S.users.find(u=>u.role==="vendeur");const v=acMmSection();let err="";try{acMmOk(id)}catch(e){err=e.message}const c=cmd(id);const vendeurVoit=v!==""; return{vendeurVoit,statut:c.acompte_mm.statut}},S2.id);
 chk("AC-12","le vendeur ne voit pas la section et ne peut pas confirmer l'acompte (réservé à l'administrateur et au caissier)",S3.vendeurVoit===false&&S3.statut==="a_verifier",JSON.stringify(S3));
 const S4=await d.evaluate(id=>{ME=S.users.find(u=>u.role==="caissier")||S.users.find(u=>u.role==="admin");const sec=acMmSection(),c=cmd(id);const lbl=/Acomptes Mobile Money à vérifier \(1\)/.test(sec)&&/WV5521AB/.test(sec)&&/data-act="acMmOk"/.test(sec);
  const dup=S.fonds.push({id:"x",type:"acompte",commande_id:null,montant:1,mode:"Wave",ref:"WV5521AB"});const blocked=(()=>{acMmOk(id);return c.acompte_mm.statut==="a_verifier"})();S.fonds.pop();
  acMmOk(id);const f=S.fonds.filter(x=>x.commande_id===id&&x.type==="acompte");return{lbl,blocked,statut:c.acompte_mm.statut,n:f.length,m:f[0]&&f[0].montant,ref:f[0]&&f[0].ref,mode:f[0]&&f[0].mode,pay:c.paiement,par:c.acompte_mm.par,audit:S.audit.some(a=>/Acompte Mobile Money confirmé/.test(a.action)),vide:acMmSection()===""}},S2.id);
 chk("AC-13","caisse : section « Acomptes à vérifier » ; référence déjà utilisée → refus ; confirmation → mouvement d'acompte (montant, opérateur, référence), paiement « partiel », audit, section vidée",S4.lbl&&S4.blocked&&S4.statut==="valide"&&S4.n===1&&S4.m===9000&&S4.ref==="WV5521AB"&&S4.mode==="Wave"&&S4.pay==="partiel"&&!!S4.par&&S4.audit&&S4.vide,JSON.stringify(S4));
 const S5=await d.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");const v=S.vendeurs[0],cl=S.clients[0],c=creerCmd({vendeur_id:v.id,client_id:cl.id,adr:Object.assign({},cl.adresses?cl.adresses[0]:{zone:S.config.zones[0].nom}),lignes:[{desig:"X",qte:1,pu:5000}],frais:0,remise:0,paiement:"livraison",mode:"Espèces"});
  c.acompte_mm={montant:3000,op:"Wave",ref:"NONRECU1",statut:"a_verifier",annonce_le:new Date().toISOString()};const n=S.fonds.length;acMmNon(c.id);return{statut:c.acompte_mm.statut,n:S.fonds.length-n,audit:S.audit.some(a=>/non reçu/.test(a.action))}});
 chk("AC-14","« Non reçu » : acompte refusé, aucun mouvement de caisse, audit",S5.statut==="refuse"&&S5.n===0&&S5.audit,JSON.stringify(S5));
 const S6=await d.evaluate(()=>{const t="Commande\n[ANGELS:"+b64({f:"ACW001",n:"Awa",t:"0701020304",z:S.config.zones[0].nom,l:[["Robe",1,15000]],ac:{m:5000,op:"MTN MoMo",rf:"mtn9988"}})+"]";const r=waDraftsFromText(t,[],true),dr=Array.isArray(r)?r[0]:(r&&r.drafts?r.drafts[0]:null);return{ac:dr&&dr.acompte_mm&&dr.acompte_mm.ref,op:dr&&dr.acompte_mm&&dr.acompte_mm.op}});
 chk("AC-16","commande reçue par WhatsApp ([ANGELS:…]) : l'acompte annoncé est repris dans le brouillon (référence normalisée, opérateur reconnu)",S6.ac==="MTN9988"&&S6.op==="MTN MoMo",JSON.stringify(S6));
 chk("AC-15","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await br.close();srv.close();process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
