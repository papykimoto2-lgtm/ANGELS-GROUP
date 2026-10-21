/* Centre de livraison en onglets : À affecter, Courses actives, Collectes vendeurs, Tournées, Livreurs, À traiter ; filtres date/lieu sur les onglets concernés.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/centre-onglets.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/distribution.html");await p.waitForTimeout(700);
 await p.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");view="livraisons";ui={};render()});
 const t0=await p.evaluate(()=>({tabs:[...document.querySelectorAll(".tabs button")].map(x=>x.innerText.replace(/\s+/g," ").trim()),on:(document.querySelector(".tabs button.on")||{}).innerText,filtre:!!document.querySelector("[data-f=lvp]"),h:[...document.querySelectorAll("h2")].map(x=>x.innerText)}));
 chk("CO-1","Centre de livraison en 8 onglets avec compteurs, ouvert sur « À affecter »",t0.tabs.length===8&&/À affecter \(\d+\)/.test(t0.tabs[0])&&/Courses actives \(\d+\)/.test(t0.tabs[1])&&/Collectes vendeurs \(\d+\)/.test(t0.tabs[2])&&/Tournées \(\d+\)/.test(t0.tabs[3])&&/Livreurs \(\d+\)/.test(t0.tabs[4])&&/Statistiques/.test(t0.tabs[5])&&/À traiter \(\d+\)/.test(t0.tabs[6])&&/À affecter/.test(t0.on),JSON.stringify(t0));
 chk("CO-2","onglet « À affecter » : barre de filtres, zones, tableau des commandes prêtes ; rien des autres sections",t0.filtre&&t0.h.some(x=>/^À affecter/.test(x))&&!t0.h.some(x=>/Courses actives|Collectes|Tournées|Écarts/.test(x)),JSON.stringify(t0.h));
 const vue=async k=>{await p.evaluate(k=>{const b=[...document.querySelectorAll(".tabs button")].find(x=>x.dataset.id==="cdt|"+k);b.click()},k);await p.waitForTimeout(120);return p.evaluate(()=>({h:[...document.querySelectorAll("h1,h2")].map(x=>x.innerText),filtre:!!document.querySelector("[data-f=lvp]"),txt:document.body.innerText}))};
 const a=await vue("act"),c=await vue("col"),t=await vue("tou"),l=await vue("liv"),z=await vue("trt");
 chk("CO-3","chaque onglet n'affiche que sa section : actives / collectes chez les vendeurs / tournées / livreurs / échecs et écarts",a.h.some(x=>/Courses actives/.test(x))&&!a.h.some(x=>/À affecter|Collectes/.test(x))&&c.h.some(x=>/Collectes chez les vendeurs/.test(x))&&!c.h.some(x=>/Courses actives/.test(x))&&t.h.some(x=>/Tournées/.test(x))&&l.h.some(x=>/^Livreurs/.test(x))&&z.h.some(x=>/échouées/.test(x))&&z.h.some(x=>/Écarts/.test(x)),JSON.stringify([a.h,c.h,t.h,l.h,z.h]));
 chk("CO-4","filtres date et lieu visibles sur « À affecter », « Courses actives » et « À traiter » seulement",a.filtre&&z.filtre&&!c.filtre&&!t.filtre&&!l.filtre,JSON.stringify([a.filtre,z.filtre,c.filtre,t.filtre,l.filtre]));
 await p.evaluate(()=>{const b=[...document.querySelectorAll(".tabs button")].find(x=>x.dataset.id==="cdt|aff");b.click()});await p.waitForTimeout(100);
 await p.evaluate(()=>{ui.flieu="zzz-inexistant";render()});const f=await p.evaluate(()=>document.body.innerText.match(/À affecter \((\d+)/g));
 chk("CO-5","onglet conservé après un filtre ; le filtre lieu s'applique (aucune commande pour un lieu inexistant)",/\(0$/.test(f[f.length-1])&&await p.evaluate(()=>ui.cdt==="aff"),JSON.stringify(f));
 chk("CO-6","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
