/* Application livreur : deux commandes se distinguent d'un coup d'œil (numéro en grand, lieu et montant en gras, rang n/N, bandeau de couleur selon l'état). */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:400,height:800},serviceWorkers:"block"})).newPage(),E=[];p.on("pageerror",e=>E.push(e.message));
 await p.goto(base+"/livreur.html");await p.waitForTimeout(300);
 const r=await p.evaluate(()=>{const e=[],mk=(n,st,q,mt)=>({livraison_ref:n,commande_ref:n,statut:st,payload:{adr:{quartier:q,zone:"Cocody"},lignes:[],montant_attendu:mt,client_nom:"client divers"}});
  const L=[mk("CMD-A","en_cours","Riviera",26500),mk("CMD-B","acceptee","Angré 7e tranche",11500)],h=L.map(carte);const h2=L.map((m,i,a)=>carte(m,i,a));
  if(!/Angré 7e tranche[^<]*11 500/.test(h2[1].replace(/\s/g," ").replace(/&nbsp;| | /g," ")))e.push("résumé lieu + montant absent");
  if(!/class="cn"/.test(h2[0]))e.push("numéro en grand");if(!/>1\/2</.test(h2[0])||!/>2\/2</.test(h2[1]))e.push("rang n/N");
  if(!/st-en_cours/.test(h2[0])||!/st-acceptee/.test(h2[1]))e.push("bandeau d'état");
  if(/>1\/1</.test(carte(L[0],0,[L[0]])))e.push("rang inutile pour une seule mission");
  if(/class="bd rg"/.test(carte({...L[0],statut:"livree"},0,L)))e.push("rang sur une mission terminée");
  return e.length?e.join(" | "):true});
 const ok=r===true&&!E.length;console.log(ok?"PASS":"FAIL",r,E[0]||"");await b.close();srv.close();process.exit(ok?0:1)})();
