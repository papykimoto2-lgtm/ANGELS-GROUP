/* Transport : « Installer sur un téléphone (QR) » — lien sur l'écran de connexion, fenêtre avec QR décodable vers transport.html, consignes Android / iPhone. */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":u.endsWith(".html")?"text/html; charset=utf-8":u.endsWith(".js")?"application/javascript":"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1100,height:900},serviceWorkers:"block"})).newPage(),E=[];
 p.on("pageerror",e=>E.push(e.message));
 await p.goto(base+"/transport.html");await p.waitForTimeout(400);await p.addScriptTag({url:base+"/jsqr.js"});
 const r=await p.evaluate(async()=>{const e=[];
  if(!document.querySelector('[data-a="pwa.qr"]'))e.push("lien absent de l'écran de connexion");
  document.querySelector('[data-a="pwa.qr"]').click();
  const m=document.querySelector(".md");if(!m)return"fenêtre non ouverte";
  const svg=m.querySelector("#qr_inst svg");if(!svg)return"QR absent";
  const url=new URL("transport.html",location.href).href;if(!m.textContent.includes(url))e.push("adresse non affichée");
  if(!/Android/.test(m.textContent)||!/iPhone/.test(m.textContent))e.push("consignes");
  const xml=new XMLSerializer().serializeToString(svg),img=new Image();img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(xml);await img.decode();
  const c=document.createElement("canvas");c.width=c.height=600;const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,600,600);x.drawImage(img,30,30,540,540);
  const d=x.getImageData(0,0,600,600),res=window.jsQR(d.data,600,600);if(!res||res.data!==url)e.push("QR illisible ou différent : "+(res&&res.data));
  m.querySelector("button").click();if(document.querySelector(".md"))e.push("Fermer sans effet");
  return e.length?e.join(" | "):true});
 const ok=r===true&&!E.length;console.log(ok?"PASS":"FAIL",r,E[0]||"");await b.close();srv.close();process.exit(ok?0:1)})();
