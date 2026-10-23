/* Centre de livraison : répartition sur un seul écran (À affecter | En course | À traiter), autres onglets à part ; filtres date/lieu/livreur/urgent sur la répartition. */
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
 const vue=async k=>{await p.evaluate(k=>{const b=[...document.querySelectorAll(".tabs button")].find(x=>x.dataset.id==="cdt|"+k);b.click()},k);await p.waitForTimeout(120);return p.evaluate(()=>({h:[...document.querySelectorAll("h2")].map(x=>x.innerText),filtre:!!document.querySelector("[data-f=lvp]"),cols:document.querySelectorAll(".repc").length}))};
 const t0=await p.evaluate(()=>({tabs:[...document.querySelectorAll(".tabs button")].map(x=>x.innerText.replace(/\s+/g," ").trim()),on:(document.querySelector(".tabs button.on")||{}).innerText,filtre:!!document.querySelector("[data-f=lvp]"),cols:document.querySelectorAll(".repc").length,urg:!!document.querySelector("[data-act=livUrg]"),liv:!!document.querySelector("[data-f=fl]")}));
 chk("CO-1","Centre de livraison en 8 onglets, ouvert sur « Répartition »",t0.tabs.length===8&&/^🧭 Répartition \(\d+\)/.test(t0.tabs[0])&&/Répartition/.test(t0.on||""),JSON.stringify(t0));
 chk("CO-2","la répartition montre sur un seul écran 3 colonnes (À affecter, En course, À traiter) avec filtres date, lieu, livreur et urgent",t0.cols===3&&t0.filtre&&t0.urg&&t0.liv,JSON.stringify(t0));
 const c=await vue("col"),t=await vue("tou"),l=await vue("liv");
 chk("CO-3","les autres onglets (collectes, tournées, livreurs) n'affichent que leur section, sans colonnes de répartition",c.cols===0&&t.cols===0&&l.cols===0&&c.h.some(x=>/Collectes/.test(x))&&t.h.some(x=>/Tournées/.test(x))&&l.h.some(x=>/Livreurs/.test(x)),JSON.stringify([c.h,t.h,l.h]));
 chk("CO-4","filtres date et lieu visibles sur la répartition seulement",!c.filtre&&!t.filtre&&!l.filtre,JSON.stringify([c.filtre,t.filtre,l.filtre]));
 await p.evaluate(()=>{ui.cdt="aff";render()});
 const foc=await p.evaluate(()=>({n:document.querySelectorAll(".repc").length,f:[...document.querySelectorAll(".repc.foc")].map(x=>x.id)}));
 chk("CO-5","les anciens liens (aff / act / trt) ouvrent la répartition avec la colonne demandée en évidence",foc.n===3&&foc.f.join()==="rep-aff",JSON.stringify(foc));
 await p.evaluate(()=>{ui.flieu="zzz-inexistant";render()});const f=await p.evaluate(()=>document.body.innerText.match(/À affecter \((\d+)/g));
 chk("CO-7","le filtre lieu s'applique à la colonne « À affecter » (aucune commande pour un lieu inexistant)",/\(0$/.test(f[f.length-1]),JSON.stringify(f));
 await p.evaluate(()=>{ui.flieu="";ui.fu=false;ui.cdt="rep";render()});const n1=await p.evaluate(()=>document.querySelectorAll("#rep-aff .rpk").length);
 await p.evaluate(()=>{document.querySelector("[data-act=livUrg]").click()});await p.waitForTimeout(100);const n2=await p.evaluate(()=>({n:document.querySelectorAll("#rep-aff .rpk").length,tous:[...document.querySelectorAll("#rep-aff .rpk")].every(x=>/URGENT/.test(x.innerText))}));
 chk("CO-8","« Urgents seulement » ne garde que les commandes urgentes",n2.tous&&n2.n<=n1,JSON.stringify([n1,n2]));
 chk("CO-6","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
