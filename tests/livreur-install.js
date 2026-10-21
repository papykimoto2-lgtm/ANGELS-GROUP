/* Installation de l'interface livreur seule : portée du manifeste limitée à livreur.html, carte « Installer l'application des livreurs » (lien, QR, copie, WhatsApp) dans Distributions.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/livreur-install.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const m=JSON.parse(fs.readFileSync(path.join(root,"manifest-livreur.webmanifest"),"utf8")),sc=new URL(m.scope,"http://x/").pathname,st=new URL(m.start_url,"http://x/").pathname;
 chk("LI-1","le manifeste livreur est limité à livreur.html (une fois installée, l'application ne peut pas ouvrir les autres pages)",sc==="/livreur.html"&&st.startsWith(sc),JSON.stringify([m.scope,m.start_url]));
 const lv=fs.readFileSync(path.join(root,"livreur.html"),"utf8");
 chk("LI-2","livreur.html ne contient aucun lien vers les autres applications",!/href="(?!#)[^"]*\.html/.test(lv)&&!/location\.href\s*=\s*["'][^"']*\.html/.test(lv));
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));await p.goto(base+"/distribution.html");await p.waitForTimeout(700);
 const c=await p.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");ui.ptab="liv";const h=VIEWS.params();const d=document.createElement("div");d.innerHTML=h;const card=[...d.querySelectorAll("h2")].find(x=>/Installer l'application des livreurs/.test(x.textContent));if(!card)return null;const k=card.nextElementSibling;const tab=[...d.querySelectorAll("#ptabs .on")].map(x=>x.dataset.id).join();return{qr:!!k.querySelector("svg"),lien:k.querySelector("input").value,cp:k.querySelectorAll("[data-act=cpTxt]").length,tab,wa:(k.querySelector("a[href^='https://wa.me/']")||{}).href||""}});
 chk("LI-3","Distributions → Paramètres : carte « Installer l'application des livreurs » avec QR code, lien, copie et WhatsApp",!!c&&c.qr&&/\/livreur\.html$/.test(c.lien)&&c.cp===2&&c.tab==="liv"&&decodeURIComponent(c.wa).includes(c.lien),JSON.stringify(c));
 const lp=await ctx.newPage();lp.on("pageerror",e=>errs.push(e.message));await lp.goto(base+"/livreur.html");await lp.waitForTimeout(600);
 const em=await lp.evaluate(()=>["LIVREUR TEST 2","livreur.test.2","  Livreur  Test 2 ","Kouamé Aya","Awa@Exemple.CI"].map(emailDe));
 chk("LI-5","connexion livreur : « LIVREUR TEST 2 », « livreur.test.2 » et le nom avec espaces/accents donnent le même identifiant serveur (minuscules, points) ; une adresse e-mail reste telle quelle",em[0]==="livreur.test.2@users.angels-erp.app"&&em[1]===em[0]&&em[2]===em[0]&&em[3]==="kouame.aya@users.angels-erp.app"&&em[4]==="awa@exemple.ci",JSON.stringify(em));
 chk("LI-4","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
