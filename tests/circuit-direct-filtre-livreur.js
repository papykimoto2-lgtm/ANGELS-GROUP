/* Circuit direct : choisir un livreur n'affiche que ses commandes (case pour tout voir). */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);const f=path.join(root,u);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"Content-Type":u.endsWith(".html")?"text/html; charset=utf-8":"application/javascript"});fs.createReadStream(f).pipe(r)});
(async()=>{await new Promise(o=>srv.listen(0,"127.0.0.1",o));const b=await chromium.launch(),p=await (await b.newContext({viewport:{width:1100,height:900}})).newPage(),e=[];p.on("pageerror",x=>e.push(x.message));
await p.goto("http://127.0.0.1:"+srv.address().port+"/distribution.html");await p.waitForTimeout(300);
const t=await p.evaluate(()=>{ME=S.users.find(u=>u.actif&&u.role==="admin")||S.users.find(u=>u.actif);S.livreurs.push({id:"lvA",nom:"ANGE",statut:"disponible",zone:"Z"},{id:"lvB",nom:"BOB",statut:"disponible",zone:"Z"});S.clients.push({id:"clX",nom:"C"});
["A","B"].forEach(k=>{S.commandes.push({id:"c"+k,numero:"CMD-"+k,client_id:"clX",statut:"affectee",adr:{zone:"Adjamé",quartier:"q"},priorite:"normale",lignes:[],date:new Date().toISOString()});
S.livraisons.push({id:"l"+k,commande_id:"c"+k,livreur_id:"lv"+k,statut:"affectee",affectee_at:new Date().toISOString(),montant_attendu:1000})});
view="livraisons";ui.cdt="rep";render();ME.role="admin";cenDirectModal();const vis=()=>[...document.querySelectorAll("#mf .cdrow")].filter(r=>r.style.display!=="none").map(r=>r.dataset.lv);
const o={init:vis().length};const s=document.querySelector("#mf [name=lid]");s.value="lvA";s.dispatchEvent(new Event("change"));o.A=vis();
const c=document.getElementById("cd_tous");c.checked=true;c.dispatchEvent(new Event("change"));o.tous=vis().length;return o});
const ok=t.init===2&&t.A.length===1&&t.A[0]==="lvA"&&t.tous===2&&!e.length;console.log(ok?"PASS":"FAIL",JSON.stringify(t),e[0]||"");await b.close();srv.close();process.exit(ok?0:1)})();
