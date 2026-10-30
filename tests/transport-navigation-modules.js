/* Transport : menu latéral en modules (comme Livraison) — 8 entrées au lieu de ~40, onglets du module dans la page, chaque écran reste atteignable, espace chauffeur inchangé. */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":u.endsWith(".html")?"text/html; charset=utf-8":u.endsWith(".js")?"application/javascript":"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1200,height:900},serviceWorkers:"block"})).newPage(),E=[];
 p.on("pageerror",e=>E.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/transport.html");await p.waitForTimeout(400);
 let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const r=await p.evaluate(()=>{window.as=r=>{let u=S.users.find(x=>x.role===r&&x.actif);if(!u){u={id:"u_t_"+r,nom:r,role:r,actif:true,chg:false};S.users.push(u)}ME=u;if(ME)view=NAV.find(showNav).v;render();return !!ME};
  const o={};as("admin");const side=[...document.querySelectorAll("aside a[data-a=nav]")];o.nAdmin=side.length;o.mods=side.map(a=>a.dataset.mod);o.gt=document.querySelectorAll("aside .gt").length;
  /* chaque écran de l'admin est atteignable : sidebar (module) ou onglet */
  const manque=[];for(const n of NAV.filter(showNav)){view=n.v;render();const t=document.querySelector('.mtabs a.on[data-id="'+n.v+'"]'),m=modOfT(n.v),s=m?document.querySelector('aside a[data-mod="'+m.id+'"].on'):document.querySelector('aside a.on[data-id="'+n.v+'"]');if(!s||(m&&vuesVisT(m,NAV.filter(showNav)).length>1&&!t))manque.push(n.v)}o.manque=manque;
  /* clic sur un module : ouvre sa dernière vue, onglets affichés, clic sur un onglet change d'écran */
  delete MOD_DERN.flo;view="dashboard";render();document.querySelector('aside a[data-mod="flo"]').click();o.vueFlo=view;const tabs=[...document.querySelectorAll(".mtabs a")].map(a=>a.dataset.id);o.tabsFlo=tabs;
  document.querySelector('.mtabs a[data-id="contrats"]').click();o.apresTab=view;document.querySelector('aside a[data-mod="arg"]').click();document.querySelector('aside a[data-mod="flo"]').click();o.retourFlo=view;
  /* chauffeur : liste courte, sans modules */
  o.chauffeur=as("chauffeur")?{mods:document.querySelectorAll("aside a[data-mod]").length,liens:document.querySelectorAll("aside a[data-a=nav]").length}:null;
  /* autres profils : jamais plus d'entrées que de modules */
  o.max=0;for(const rl of["directeur","flotte","caissier","comptable","controleur"]){if(as(rl))o.max=Math.max(o.max,document.querySelectorAll("aside a[data-a=nav]").length)}
  return o});
 chk("TN-1","admin : 8 entrées de module au lieu d'une quarantaine",r.nAdmin===8&&r.mods.length===8,JSON.stringify([r.nAdmin,r.mods]));
 chk("TN-2","plus de titres de groupe dans le menu de l'admin",r.gt===0,r.gt);
 chk("TN-3","chaque écran est atteignable (module actif + onglet actif)",!r.manque.length,JSON.stringify(r.manque));
 chk("TN-4","clic sur un module : ouvre sa première vue et affiche ses onglets",r.vueFlo==="vehicules"&&r.tabsFlo.includes("contrats")&&r.tabsFlo.length===7,JSON.stringify([r.vueFlo,r.tabsFlo]));
 chk("TN-5","clic sur un onglet ouvre l'écran ; le module se rouvre sur la dernière vue",r.apresTab==="contrats"&&r.retourFlo==="contrats",JSON.stringify([r.apresTab,r.retourFlo]));
 chk("TN-6","espace chauffeur : liste courte, sans modules",!!r.chauffeur&&r.chauffeur.mods===0&&r.chauffeur.liens>=5,JSON.stringify(r.chauffeur));
 chk("TN-7","autres profils : au plus 8 entrées",r.max>0&&r.max<=8,r.max);
 chk("TN-8","aucune erreur de script",!E.length,E[0]);
 await p.evaluate(()=>{as("admin");view="vehicules";render()});await p.screenshot({path:process.env.CAPT||"/tmp/transport-nav.png"});
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await b.close();srv.close();process.exit(ko?1:0)})();
