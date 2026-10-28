/* Répartition : cartes « En course » lisibles (un seul badge de situation, durées en h/j, position affichée seulement si ancienne). */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":u.endsWith(".html")?"text/html; charset=utf-8":"application/javascript"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1100,height:900}})).newPage(),errs=[];
 p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/distribution.html");await p.waitForTimeout(300);
 const r=await p.evaluate(()=>{const E=[];
  if(dureeTxt(5)!=="5 min"||dureeTxt(180)!=="3 h"||dureeTxt(3033)!=="2 j")E.push("durées "+[5,180,3033].map(dureeTxt));
  const L={statut:"affectee",affectee_at:new Date(Date.now()-48*3600000).toISOString()};if(nonAccLiv(L)<2800)E.push("non acceptée");
  return E.length?E.join(" | "):true});
 console.log(r===true?"PASS":"FAIL",r);if(errs.length)console.log("ERR",errs[0]);await b.close();srv.close();process.exit(r===true&&!errs.length?0:1)})();
