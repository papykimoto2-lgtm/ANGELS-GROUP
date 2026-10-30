/* Application chauffeur : ?app=chauffeur → manifeste et titre dédiés, connexion réservée aux chauffeurs, session admin ignorée ; page Transport inchangée. */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":u.endsWith(".html")?"text/html; charset=utf-8":u.endsWith(".js")?"application/javascript":u.endsWith(".webmanifest")?"application/manifest+json":"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:390,height:800},serviceWorkers:"block"}),p=await ctx.newPage(),E=[];
 p.on("pageerror",e=>E.push(e.message));p.on("dialog",d=>d.accept());
 let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 await p.goto(base+"/transport.html");await p.waitForTimeout(400);
 await p.evaluate(()=>{S.drivers.push({id:"drv_a",nom:"Kouassi Yao",actif:true});S.users.push({id:"u_ch1",nom:"Kouassi",role:"chauffeur",actif:true,driver_id:"drv_a",chg:false});save()});
 const norm=await p.evaluate(()=>({m:document.querySelector('link[rel=manifest]').getAttribute("href"),opts:[...document.querySelectorAll("#lf select[name=u] option, .pcard")].length,hero:document.body.innerText.includes("Votre espace chauffeur")}));
 await p.goto(base+"/transport.html?app=chauffeur");await p.waitForTimeout(500);
 const ch=await p.evaluate(()=>({m:document.querySelector('link[rel=manifest]').getAttribute("href"),t:document.title,hero:document.body.innerText.includes("Votre espace chauffeur"),esp:document.body.innerText.includes("ESPACE CHAUFFEUR"),opts:[...document.querySelectorAll("#lf select[name=u] option")].map(o=>o.textContent),cartes:[...document.querySelectorAll(".pcard")].map(c=>c.innerText)}));
 chk("AC-1","?app=chauffeur : manifeste, titre, écran « Espace chauffeur »",/manifest-chauffeur/.test(ch.m)&&ch.t==="Angel's Chauffeur"&&ch.hero&&ch.esp,JSON.stringify(ch));
 chk("AC-2","connexion chauffeur : aucun compte ni profil de démonstration stocké dans l'appareil (la liste vient du serveur)",ch.cartes.length===0,JSON.stringify([ch.opts,ch.cartes]));
 chk("AC-3","page Transport normale inchangée (manifeste transport, pas d'écran chauffeur)",/manifest-transport/.test(norm.m)&&!norm.hero,JSON.stringify(norm));
 const mf=JSON.parse(fs.readFileSync(path.join(root,"manifest-chauffeur.webmanifest"),"utf8"));
 chk("AC-7","manifeste chauffeur : démarre sur ?app=chauffeur, icônes existantes",/app=chauffeur/.test(mf.start_url)&&mf.short_name==="Chauffeur"&&mf.icons.every(i=>fs.existsSync(path.join(root,i.src))),JSON.stringify([mf.start_url,mf.short_name]));
 chk("AC-8","manifeste chauffeur précaché hors ligne (sw.js)",/manifest-chauffeur\.webmanifest/.test(fs.readFileSync(path.join(root,"sw.js"),"utf8")));
 chk("AC-9","aucune erreur de script",!E.length,E[0]);
 await p.screenshot({path:process.env.CAPT||"/tmp/transport-chauffeur.png"});
 await p.evaluate(()=>{sessionStorage.removeItem("tr_me")});await p.reload();await p.waitForTimeout(500);await p.screenshot({path:"/tmp/transport-chauffeur-login.png"});
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await b.close();srv.close();process.exit(ko?1:0)})();
