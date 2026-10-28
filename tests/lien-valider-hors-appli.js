/* Répartition : chaque carte « En course » a un lien « Valider hors application » qui ouvre le circuit direct, livreur et commande déjà choisis. */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":u.endsWith(".html")?"text/html; charset=utf-8":"application/javascript"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1100,height:900}})).newPage(),E=[];
 p.on("pageerror",e=>E.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/distribution.html");await p.waitForTimeout(300);
 const r=await p.evaluate(async()=>{const e=[];ME=S.users.find(u=>u.actif&&u.role==="admin")||S.users.find(u=>u.actif);ME.role="admin";
  S.livreurs.push({id:"lvA",nom:"ANGE",statut:"disponible",zone:"Z"},{id:"lvB",nom:"BOB",statut:"disponible",zone:"Z"});S.clients.push({id:"clX",nom:"C"});
  ["A","B"].forEach(k=>{S.commandes.push({id:"c"+k,numero:"CMD-"+k,client_id:"clX",statut:"affectee",adr:{zone:"Adjamé",quartier:"q"},priorite:"normale",lignes:[],total:1000,frais:0,date:new Date().toISOString(),hist:[]});
   S.livraisons.push({id:"l"+k,commande_id:"c"+k,livreur_id:"lv"+k,statut:"affectee",affectee_at:new Date().toISOString(),montant_attendu:1000,hist:[]})});
  view="livraisons";ui.cdt="rep";render();
  const L=[...document.querySelectorAll('#rep-act a[data-act="cenDirect"]')];if(L.length!==2)e.push("liens : "+L.length);
  L.find(a=>a.dataset.id==="cB").click();
  const lid=document.querySelector("#mf [name=lid]");if(!lid)return"fenêtre non ouverte";
  if(lid.value!=="lvB")e.push("livreur non présélectionné : "+lid.value);
  const ck=[...document.querySelectorAll('#mf input[type=checkbox][name^="ck_"]')].filter(x=>x.checked).map(x=>x.name);
  if(ck.length!==1||ck[0]!=="ck_cB")e.push("commande non cochée : "+ck);
  const vis=[...document.querySelectorAll("#mf .cdrow")].filter(x=>x.style.display!=="none").length;if(vis!==1)e.push("lignes visibles : "+vis);
  ME.role="preparateur";view="livraisons";ui.cdt="rep";closeModal();render();if(document.querySelector('#rep-act a[data-act="cenDirect"]'))e.push("lien visible sans droit");
  return e.length?e.join(" | "):true});
 const ok=r===true&&!E.length;console.log(ok?"PASS":"FAIL",r,E[0]||"");await b.close();srv.close();process.exit(ok?0:1)})();
