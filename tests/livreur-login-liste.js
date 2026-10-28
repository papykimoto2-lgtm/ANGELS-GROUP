/* Connexion livreur : la liste des identifiants s'affiche en entier à l'ouverture, se réduit pendant la saisie, est mémorisée, et une liste vide est expliquée. */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});let ok=0,ko=0;const E=[];
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const LV=[["abdoul.aziz.barro","ABDOUL-AZIZ BARRO"],["aboubakar","ABOUBAKAR"],["ange","ANGE"],["ange.mickael","Ange Mickael"],["azziz","AZZIZ"],["freddy","FREDDY"]].map(([ident,nom])=>({ident,nom}));
 const page=async(liste)=>{const ctx=await b.newContext({viewport:{width:400,height:800},serviceWorkers:"block"}),p=await ctx.newPage();p.on("pageerror",e=>E.push(e.message));
  await p.route("**/livreurs-liste",r=>liste?r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({ok:true,livreurs:liste})}):r.abort());
  await p.addInitScript(()=>{try{localStorage.setItem("ang_lv_idents",JSON.stringify([{i:"ange",n:"ANGE"}]))}catch(e){}});
  await p.goto(base+"/livreur.html");await p.waitForSelector("#li");await p.waitForTimeout(800);return p};
 let p=await page(LV);
 await p.click("#lvb");const n1=await p.$$eval("#lvl li[data-i]",l=>l.length);
 chk("LL-1","la flèche ouvre la liste complète des livreurs du serveur",n1===LV.length,n1);
 await p.fill("#li","");await p.type("#li","ange");await p.waitForTimeout(200);const t=await p.$$eval("#lvl li[data-i]",l=>l.map(x=>x.dataset.i)),vis=await p.$eval("#lvl",u=>!u.hidden);
 chk("LL-2","en tapant « ange », la liste se réduit aux identifiants correspondants (2) et reste ouverte",vis&&t.length===2&&t.includes("ange")&&t.includes("ange.mickael"),JSON.stringify(t));
 await p.fill("#li","");await p.click("#li");await p.waitForTimeout(200);const n2=await p.$$eval("#lvl li[data-i]",l=>l.length);
 chk("LL-3","champ vide : toute la liste s'affiche dès le clic",n2===LV.length,n2);
 await p.click('#lvl li[data-i="freddy"]');const v=await p.inputValue("#li");chk("LL-4","un clic sur un livreur remplit l'identifiant",v==="freddy",v);
 await p.context().close();
 /* hors ligne : liste mémorisée */
 const ctx2=await b.newContext({viewport:{width:400,height:800},serviceWorkers:"block"}),p2=await ctx2.newPage();p2.on("pageerror",e=>E.push(e.message));
 await p2.route("**/livreurs-liste",r=>r.abort());
 await p2.addInitScript(l=>{try{if(!localStorage.getItem("ang_lv_liste"))localStorage.setItem("ang_lv_liste",JSON.stringify(l.map(x=>({i:x.ident,n:x.nom}))))}catch(e){}},LV);
 await p2.goto(base+"/livreur.html");await p2.waitForSelector("#li");await p2.waitForTimeout(800);await p2.click("#lvb");const n3=await p2.$$eval("#lvl li[data-i]",l=>l.length);
 chk("LL-5","serveur injoignable : la dernière liste mémorisée s'affiche",n3===LV.length,n3);await ctx2.close();
 /* liste vide : message explicite, même avec le livreur de l'appareil */
 p=await page([]);await p.click("#lvb");const msg=await p.$eval("#lvl .cmbv",x=>x.textContent).catch(()=>"");
 chk("LL-6","liste vide côté serveur : un message l'explique (au lieu de n'afficher que le livreur du téléphone)",/vide|désactiv/i.test(msg),msg);
 chk("LL-7","aucune erreur de script",!E.length,E[0]);
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await b.close();srv.close();process.exit(ko?1:0)})();
