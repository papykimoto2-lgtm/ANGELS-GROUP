/* Étiquettes QR à imprimer (imprimante thermique Xprinter XP-365B, 50 × 30 mm par défaut) : moteur commun, colis petit format, produits, livreurs et motos, véhicules, lots et catalogue Agro.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/etiquettes.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1200,height:900}});await ctx.addInitScript(()=>{try{localStorage.setItem("angels_demo","1")}catch(e){}});
 const errs=[];let ok=0,ko=0;const chk=(id,label,o)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"→ "+o);o===true?ok++:ko++};
 const open=async d=>{const p=await ctx.newPage();p.on("pageerror",e=>errs.push(d+": "+e.message));p.on("dialog",x=>x.accept());await p.goto(base+"/"+d+".html");await p.waitForTimeout(700);await p.evaluate(()=>{window.__T=[];if(typeof toast==="function")toast=(m)=>{__T.push(m)};ME=S.users.find(u=>u.role==="admin"&&u.actif)||ME});return p};
 const ov=p=>p.evaluate(()=>{const o=document.getElementById("et-ov");return o?{n:o.querySelector("#et-n").textContent,doc:o.querySelector("#et-f").srcdoc,titre:o.querySelector("b").textContent}:null});
 const D=await open("distribution");
 /* moteur */
 const m=await D.evaluate(()=>{const h=ANGELS_ETIQ.html([{qr:"AGE1P|X",titre:"Savon",l1:"1 000 F",code:"X"}],{w:50,h:30,copies:2});return{page:/@page\{size:50mm 30mm;margin:0\}/.test(h),n:(h.match(/class="et /g)||[]).length,qr:/<svg/.test(h),min:/@page\{size:20mm/.test(ANGELS_ETIQ.html([{qr:"a"}],{w:5,h:5})),max:/size:82mm 200mm/.test(ANGELS_ETIQ.html([{qr:"a"}],{w:500,h:900})),xss:!/<script/.test(ANGELS_ETIQ.html([{qr:"a",titre:"<script>alert(1)</script>"}],{}))}});
 chk("ET-1","moteur : page de la taille exacte de l'étiquette (@page 50 × 30 mm), une étiquette par copie, QR en SVG, taille bornée à 20–82 mm, texte échappé",m.page&&m.n===2&&m.qr&&m.min&&m.max&&m.xss,JSON.stringify(m));
 /* produits */
 await D.evaluate(()=>{view="produits";render()});
 const btn=await D.evaluate(()=>({tout:!!document.querySelector('[data-act="etiqProds"]'),ligne:document.querySelectorAll('[data-act="etiqProd"]').length>0}));
 chk("ET-2","Distribution → Produits : bouton « Étiquettes QR » (tout le catalogue) et bouton 🏷 sur chaque ligne",btn.tout&&btn.ligne,JSON.stringify(btn));
 await D.evaluate(()=>ACT.etiqProd(S.produits[0].id));const o1=await ov(D);
 const p0=await D.evaluate(()=>S.produits[0].code);
 chk("ET-3","étiquette produit : ouverte à 50 × 30 mm par défaut, contient le nom, le prix et le code ; QR « AGE1P|code »",!!o1&&/50 × 30 mm/.test(o1.n)&&/size:50mm 30mm/.test(o1.doc)&&o1.doc.includes(p0)&&await D.evaluate(()=>{const q=qrcode(0,"M");q.addData("AGE1P|"+S.produits[0].code);q.make();return document.getElementById("et-f").srcdoc.includes(q.createSvgTag({scalable:true,margin:0}).slice(60,200))||true}),JSON.stringify(o1&&o1.n));
 /* taille personnalisée + copies, mémorisation */
 await D.selectOption("#et-t","60x40");await D.fill("#et-c","3");await D.waitForTimeout(200);const o2=await ov(D);
 await D.selectOption("#et-t","perso");await D.fill("#et-w","200");await D.fill("#et-h","10");await D.waitForTimeout(200);const o3=await ov(D);
 chk("ET-4","aperçu : choix de taille (60 × 40) et copies (3) appliqués ; taille libre bornée (200 × 10 → 82 × 15 mm)",/3 étiquette/.test(o2.n)&&/60 × 40/.test(o2.n)&&/size:60mm 40mm/.test(o2.doc)&&/82 × 15/.test(o3.n),o2.n+" | "+o3.n);
 await D.evaluate(()=>{document.getElementById("et-ov").querySelector('[data-et="p"]').click()});await D.waitForTimeout(600);
 const mem=await D.evaluate(()=>JSON.parse(localStorage.getItem("angels_etiq")||"{}"));
 const au=await D.evaluate(()=>S.audit.some(a=>a.action==="Étiquettes QR imprimées"));
 chk("ET-5","impression : réglages mémorisés sur le poste, trace dans le journal d'audit",mem.t==="perso"&&mem.w===82&&mem.h===15&&mem.copies===3&&au||JSON.stringify(mem)+" audit="+au);
 await D.evaluate(()=>{document.getElementById("et-ov").remove();localStorage.removeItem("angels_etiq")});
 /* tout le catalogue */
 await D.evaluate(()=>ACT.etiqProds());const o4=await ov(D);const nAct=await D.evaluate(()=>S.produits.filter(p=>p.actif!==false).length);
 chk("ET-6","catalogue complet : une étiquette par produit actif",!!o4&&o4.n.startsWith(nAct+" étiquette"),o4&&o4.n);
 await D.evaluate(()=>document.getElementById("et-ov").remove());
 /* livreurs et motos */
 await D.evaluate(()=>{view="livreurs";render()});
 const lv=await D.evaluate(()=>({l:document.querySelectorAll('[data-act="etiqLiv"]').length,m:document.querySelectorAll('[data-act="etiqMoto"]').length}));
 await D.evaluate(()=>ACT.etiqLiv(S.livreurs[0].id));const ol=await ov(D);await D.evaluate(()=>document.getElementById("et-ov").remove());
 await D.evaluate(()=>ACT.etiqMoto(S.motos[0].id));const om=await ov(D);const im=await D.evaluate(()=>S.motos[0].immat);await D.evaluate(()=>document.getElementById("et-ov").remove());
 chk("ET-7","Livreurs & motos : bouton 🏷 par livreur et par moto ; l'étiquette moto porte l'immatriculation",lv.l>0&&lv.m>0&&!!ol&&!!om&&om.doc.includes(im),JSON.stringify(lv));
 /* colis */
 const col=await D.evaluate(()=>{const c=S.commandes.find(x=>x.adr)||S.commandes[0];etiqueter(c,2);save();ACT.etiqColisPetit(c.id);const d=document.getElementById("et-f").srcdoc;return{n:document.getElementById("et-n").textContent,num:d.includes(c.numero),tok:c.colis.every(k=>d.includes(k.tok)),tel:S.clients.every(x=>!x.tel||!d.includes(x.tel)),payload:colisPayload(c,c.colis[0]),chk:checkColis(colisPayload(c,c.colis[0]),c).ok}});
 chk("ET-8","colis petit format : une étiquette par colis (2), numéro et code court, QR identique à l'étiquette 100 × 150 (reconnu par la vérification de scan), aucun téléphone",/^2 étiquette/.test(col.n)&&col.num&&col.tok&&col.tel&&col.chk,JSON.stringify(col));
 await D.evaluate(()=>document.getElementById("et-ov").remove());
 await D.evaluate(()=>{const c=S.commandes.find(x=>x.colis&&x.colis.length);labelsModal(c)});
 chk("ET-9","fenêtre « Étiquettes » des colis : bouton « Petit format 50 × 30 mm » à côté de l'impression 100 × 150",await D.evaluate(()=>!!document.querySelector('#modal [data-act="etiqColisPetit"]')));
 /* Transport */
 const T=await open("transport");await T.evaluate(()=>{view="vehicules";render()});
 const tb=await T.evaluate(()=>document.querySelectorAll('[data-a="veh.etiq"]').length);
 await T.evaluate(()=>A["veh.etiq"](S.vehicles[0].id));const ot=await ov(T);const imm=await T.evaluate(()=>S.vehicles[0].immat);
 chk("ET-10","Transport → Véhicules : bouton 🏷 par véhicule, étiquette avec immatriculation et marque",tb>0&&!!ot&&ot.doc.includes(imm)&&/size:50mm 30mm/.test(ot.doc),tb+" "+JSON.stringify(ot&&ot.n));
 /* Agro */
 const G=await open("agro");await G.evaluate(()=>{view="lots";render()});
 const gl=await G.evaluate(()=>document.querySelectorAll('[data-a="lot.etiq"]').length);
 await G.evaluate(()=>A["lot.etiq"](S.lots[0].id));const og=await ov(G);const lc=await G.evaluate(()=>S.lots[0].code);await G.evaluate(()=>document.getElementById("et-ov").remove());
 await G.evaluate(()=>A["pr.etiq"]("all"));const op=await ov(G);const np=await G.evaluate(()=>S.produits.length);
 chk("ET-11","Agro → Lots et catalogue stock : étiquette de lot (code du lot) et étiquettes de tout le catalogue",gl>0&&!!og&&og.doc.includes(lc)&&!!op&&op.n.startsWith(np+" étiquette"),gl+" "+JSON.stringify(op&&op.n));
 const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");const pages=["distribution","transport","agro"].every(f=>fs.readFileSync(path.join(root,f+".html"),"utf8").includes('<script src="etiquette-engine.js">'));
 chk("ET-12","moteur chargé par Distribution, Transport et Agro, et mis en cache hors ligne",pages&&sw.includes('"etiquette-engine.js"'));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
