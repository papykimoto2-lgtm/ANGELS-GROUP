/* Application vendeur dédiée (même charpente que l'application livreur) : connexion, menu ☰, pages, version, aucune fuite vers le logiciel du bureau.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/vendeur-app.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:400,height:800}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const swV=(fs.readFileSync(path.join(root,"sw.js"),"utf8").match(/const V = "angels-v(\d+)"/)||[])[1];
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));await p.goto(base+"/vendeur.html");await p.waitForTimeout(1200);
 const l=await p.evaluate(()=>({t:document.title,h:(document.querySelector(".hd")||{}).textContent,champs:!!document.getElementById("li")&&!!document.getElementById("lp"),liste:!!document.getElementById("lvl"),mdp:document.getElementById("lp").type}));
 chk("VD-1","écran de connexion au style livreur : en-tête « ANGEL'S — Vendeur », identifiant + mot de passe, sans liste publique des vendeurs",/Vendeur/.test(l.t)&&/ANGEL'S — Vendeur/.test(l.h)&&l.champs&&!l.liste&&l.mdp==="password",JSON.stringify(l));
 const css=await p.evaluate(()=>{const s=getComputedStyle(document.querySelector(".hd")),r=getComputedStyle(document.documentElement);return{bg:s.backgroundColor,b:r.getPropertyValue("--b").trim()}});
 chk("VD-2","mêmes couleurs que l'application livreur (en-tête #0b3b4c, accent #0e7490)",css.bg==="rgb(11, 59, 76)"&&css.b==="#0e7490",JSON.stringify(css));
 const m=await p.evaluate(()=>{user={id:"u"};moi={nom:"Boutique Awa"};D={commandes:[{numero:"CMD-1",statut:"En préparation",client:"Koné",montant:5000}],reglements:[],solde:2500,lien:"https://exemple.test/portail.html?v=1"};PAGE="accueil";MENU=false;vue();const h1=document.querySelector(".hd").textContent,btn=!!document.querySelector('[data-a="menu"]');MENU=true;vue();const items=[...document.querySelectorAll(".dr .mi")].map(x=>x.textContent);return{h1,btn,items}});
 chk("VD-3","accueil : nom du vendeur, bouton ☰, menu avec Accueil, Mes commandes, Mes règlements, Mon lien client, Mon compte, Se déconnecter",/Boutique Awa/.test(m.h1)&&m.btn&&["Accueil","Mes commandes","Mes règlements","Mon lien client","Mon compte","Se déconnecter"].every(t=>m.items.some(i=>i.includes(t))),JSON.stringify(m));
 const pg=await p.evaluate(()=>{const o={};for(const k of ["commandes","reglages_v","lien","compte"]){PAGE=k;MENU=false;vue();o[k]=document.querySelector(".wrap").textContent}return o});
 chk("VD-4","pages : commande listée, règlements vides expliqués, lien client affiché, compte avec changement de mot de passe",/CMD-1/.test(pg.commandes)&&/Aucun règlement/.test(pg.reglages_v)&&/portail\.html\?v=1/.test(await p.evaluate(()=>{PAGE="lien";vue();return document.querySelector(".wrap").innerHTML}))&&/Changer mon mot de passe/.test(pg.compte),JSON.stringify(pg));
 const v=await p.evaluate(()=>{PAGE="compte";vue();return(document.querySelector(".appv")||{}).textContent});
 await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForTimeout(800);
 const v2=await p.evaluate(()=>{PAGE="compte";vue();lireVersion();return new Promise(r=>setTimeout(()=>r((document.querySelector(".appv")||{}).textContent),500))});
 chk("VD-5","la version de l'application s'affiche (« Version N » = cache du service worker)",v2==="Version "+swV,v2+" / "+swV);
 const net=[];p.on("request",r=>net.push(r.url()));await p.evaluate(()=>{PAGE="accueil";vue()});
 const bureau=await p.evaluate(()=>typeof S==="undefined"&&typeof ANGELS_ROLES==="undefined"&&!document.querySelector("script[src*=sync-engine]"));
 chk("VD-6","l'application ne charge pas le moteur du logiciel du bureau (aucune donnée du bureau sur l'appareil du vendeur)",bureau===true);
 chk("VD-7","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
