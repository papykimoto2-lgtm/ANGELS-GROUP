/* Carte : trois fonds (plan, satellite, satellite + noms), choix mémorisé, lien Google Maps sur la zone affichée. Leaflet servi localement (tests/vendor). */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":u.endsWith(".html")?"text/html; charset=utf-8":"application/javascript"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),p=await ctx.newPage(),E=[];
 p.on("pageerror",e=>E.push(e.message));p.on("dialog",d=>d.accept());
 await ctx.route(/unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.js/,r=>r.fulfill({contentType:"application/javascript",body:fs.readFileSync(path.join(root,"tests/vendor/leaflet.js"))}));
 await ctx.route(/unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.css/,r=>r.fulfill({contentType:"text/css",body:fs.existsSync(path.join(root,"tests/vendor/leaflet.css"))?fs.readFileSync(path.join(root,"tests/vendor/leaflet.css")):""}));
 await ctx.route(/tile\.openstreetmap\.org|arcgisonline\.com/,r=>r.abort());
 await p.goto(base+"/distribution.html");await p.waitForTimeout(300);
 const r=await p.evaluate(async()=>{const e=[];ME=S.users.find(u=>u.actif&&u.role==="admin")||S.users.find(u=>u.actif);ME.role="admin";view="carte";render();
  for(let i=0;i<60&&!(CARTE.map&&window.L);i++)await new Promise(r=>setTimeout(r,100));if(!CARTE.map)return"carte non chargée";
  const labs=[...document.querySelectorAll(".leaflet-control-layers-base label")].map(x=>x.textContent.trim());
  if(labs.length!==3)e.push("fonds : "+JSON.stringify(labs));
  const a=document.querySelector('a[href*="google.com/maps"]');if(!a)e.push("lien Google Maps absent");else if(!/@5\.\d+,-4\.\d+,\d+z/.test(a.href))e.push("lien : "+a.href);
  const ins=[...document.querySelectorAll(".leaflet-control-layers-base input")];ins[2].click();
  if(localStorage.getItem("angels_carte_fond")!=="🛰 Satellite + noms")e.push("choix non mémorisé");
  const n=document.querySelectorAll(".leaflet-tile-pane .leaflet-layer").length;if(n<3)e.push("hybride : "+n+" couches");
  return e.length?e.join(" | "):true});
 const ok=r===true&&!E.length;console.log(ok?"PASS":"FAIL",r,E[0]||"");await b.close();srv.close();process.exit(ok?0:1)})();
