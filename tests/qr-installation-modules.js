/* QR d'installation dans le Hub, Agro et Livraison : cartes par module, QR décodables vers la bonne page, consignes, fermeture (bouton, Échap). */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":u.endsWith(".html")?"text/html; charset=utf-8":u.endsWith(".js")?"application/javascript":"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900},serviceWorkers:"block"});let ok=0,ko=0;const E=[];
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const page=async(u)=>{const p=await ctx.newPage();p.on("pageerror",e=>E.push(u+" "+e.message));await p.goto(base+"/"+u);await p.waitForTimeout(500);await p.addScriptTag({url:base+"/jsqr.js"});return p};
 /* lit tous les QR de la fenêtre ouverte : [{nom, url, lu}] */
 const lire=p=>p.evaluate(async()=>{const out=[];for(const c of document.querySelectorAll("#qri .qri-c")){const svg=c.querySelector("svg"),img=new Image();img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(new XMLSerializer().serializeToString(svg));await img.decode();
  const cv=document.createElement("canvas");cv.width=cv.height=600;const x=cv.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,600,600);x.drawImage(img,30,30,540,540);const r=window.jsQR(x.getImageData(0,0,600,600).data,600,600);
  out.push({nom:c.firstChild.textContent.trim(),lu:r&&r.data,url:c.querySelector("div:last-child").textContent.trim()})}return out});
 const ouvert=p=>p.waitForSelector("#qri .qri-c",{timeout:4000}).then(()=>true).catch(()=>false);
 /* Hub */
 let p=await page("index.html");await p.click("#qrinst");let o=await ouvert(p),L=o?await lire(p):[];
 chk("QR-1","Hub : une carte par module actif + applications livreur et vendeur (5)",L.length===5,JSON.stringify(L.map(x=>x.nom)));
 const att={Livraison:"distribution.html",Transport:"transport.html",Agro:"agro.html",Livreur:"livreur.html","Vendeur partenaire":"vendeur.html"};
 const bad=L.filter(x=>{const k=Object.keys(att).find(n=>x.nom.includes(n));return !k||x.lu!==base+"/"+att[k]||x.url!==x.lu});
 chk("QR-2","Hub : chaque QR se décode vers la bonne page (et l'adresse affichée est la même)",!bad.length&&L.length>0,JSON.stringify(bad));
 chk("QR-3","consignes Android / iPhone affichées",await p.evaluate(()=>/Android/.test(document.getElementById("qri").textContent)&&/iPhone/.test(document.getElementById("qri").textContent)));
 await p.keyboard.press("Escape");chk("QR-4","Échap ferme la fenêtre",await p.evaluate(()=>!document.getElementById("qri")));
 await p.click("#qrinst");await ouvert(p);await p.click("#qri-x");chk("QR-5","bouton Fermer",await p.evaluate(()=>!document.getElementById("qri")));await p.close();
 /* Agro */
 p=await page("agro.html");const la=await p.evaluate(()=>!!document.querySelector('[data-a="pwa.qr"]'));chk("QR-6","Agro : lien sur l'écran de connexion",la);
 if(la){await p.click('[data-a="pwa.qr"]');L=(await ouvert(p))?await lire(p):[];chk("QR-7","Agro : QR décodable vers agro.html",L.length===1&&L[0].lu===base+"/agro.html",JSON.stringify(L))}await p.close();
 /* Livraison */
 p=await page("distribution.html");const ld=await p.evaluate(()=>{try{refreshInstall()}catch(e){}return !!document.querySelector('[data-act="qrInstall"]')});chk("QR-8","Livraison : lien « Installer sur un téléphone (QR) »",ld);
 if(ld){await p.click('[data-act="qrInstall"]');L=(await ouvert(p))?await lire(p):[];chk("QR-9","Livraison : QR décodable vers distribution.html",L.length===1&&L[0].lu===base+"/distribution.html",JSON.stringify(L))}await p.close();
 chk("QR-10","aucune erreur de script",!E.length,E[0]);
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await b.close();srv.close();process.exit(ko?1:0)})();
