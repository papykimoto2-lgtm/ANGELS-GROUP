/* Circuit direct : la livraison validée par le bureau est publiée au livreur en lecture seule, avec la mention « Validée par le bureau ». */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":u.endsWith(".html")?"text/html; charset=utf-8":"application/javascript"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),p=await ctx.newPage(),E=[];
 p.on("pageerror",e=>E.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/distribution.html");await p.waitForTimeout(300);
 const r1=await p.evaluate(()=>{const e=[];S.livreurs.push({id:"lvA",nom:"ANGE",statut:"disponible",zone:"Z"});S.clients.push({id:"clX",nom:"C"});
  S.commandes.push({id:"cA",numero:"CMD-A",client_id:"clX",statut:"livree",adr:{zone:"Adjamé"},priorite:"normale",lignes:[],date:new Date().toISOString()});
  const L={id:"lA",commande_id:"cA",livreur_id:"lvA",statut:"livree",circuit:"direct",fin_at:new Date().toISOString(),montant_attendu:1000,montant_encaisse:1000};S.livraisons.push(L);
  const m=passProjection(L);if(!m.payload.valide_bureau)e.push("drapeau absent");if(m.code)e.push("code publié");
  const n=passProjection(Object.assign({},L,{circuit:undefined}));if(n.payload.valide_bureau)e.push("drapeau à tort");
  return e.length?e.join(" | "):true});
 await p.goto(base+"/livreur.html");await p.waitForTimeout(300);
 const r2=await p.evaluate(()=>{const mk=v=>({livraison_ref:"x",commande_ref:"CMD-A",statut:"livree",payload:{adr:{},lignes:[],recu:1000,valide_bureau:v}});
  return /Validée par le bureau/.test(carte(mk(true)))&&!/Validée par le bureau/.test(carte(mk(false)))&&!/data-a="confirmer"/.test(carte(mk(true)))?true:"mention ou boutons"});
 const ok=r1===true&&r2===true&&!E.length;console.log(ok?"PASS":"FAIL",r1,r2,E[0]||"");await b.close();srv.close();process.exit(ok?0:1)})();
