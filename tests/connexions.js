/* Historique de connexion par utilisateur : journal alimenté par Distributions, Transport et Agro (succès, échecs, blocage, déconnexion, accès à la gestion des comptes), lecture et filtres dans Paramètres du hub.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/connexions.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const MDP="Demo@Angels2026";
 const open=async f=>{const p=await ctx.newPage();p.on("pageerror",e=>errs.push(f+": "+e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/"+f+".html");await p.waitForTimeout(700);return p};
 /* --- Distributions --- */
 const D=await open("distribution");
 const dl=await D.evaluate(async mdp=>{const ad=S.users.find(u=>u.role==="admin"&&u.actif),ca=S.users.find(u=>u.role==="caissier"&&u.actif);
  const go=async(u,pin)=>{ME=null;view="dashboard";render();const f=document.getElementById("lf");f.u.value=u.id;(f.pin||f.p).value=pin;f.requestSubmit();await new Promise(r=>setTimeout(r,900))};
  await go(ad,mdp);const apres=S.connexions.slice();ACT.logout();await new Promise(r=>setTimeout(r,200));
  for(let i=0;i<6;i++)await go(ca,"mauvais"+i);
  return{admin:ad.nom,caissier:ca.nom,caid:ca.id,adid:ad.id,L:S.connexions.map(x=>({ev:x.ev,uid:x.uid,nom:x.nom,app:x.app,ua:x.app_,mo:x.motif,t:x.t})),apres:apres.length}},MDP);
 const evs=dl.L.map(x=>x.ev).join(",");
 chk("CN-1","Distributions : connexion réussie, déconnexion, échecs de mot de passe puis blocage sont journalisés (une ligne chacun)",/^ok,out,ko,ko,ko,ko,ko,bloque$/.test(evs),evs);
 const l1=dl.L[0];
 chk("CN-2","chaque ligne porte la personne, l'application, l'heure et l'appareil (type · système · navigateur), jamais de mot de passe",l1.uid===dl.adid&&l1.nom===dl.admin&&l1.app==="distribution"&&!isNaN(new Date(l1.t))&&/ · /.test(l1.ua)&&!JSON.stringify(dl.L).includes("mauvais")&&!JSON.stringify(dl.L).includes(MDP),JSON.stringify(l1));
 /* --- Transport et Agro --- */
 const T=await open("transport"),A=await open("agro");
  const tr=await T.evaluate(async mdp=>{const u=S.users.find(x=>x.role==="admin"&&x.actif),o=S.users.find(x=>x.actif&&x.role!=="admin"&&x.id!==u.id);const r1=await login(u.id,mdp);A["out"]();const r2=await login(o.id,"faux");return{r1,r2,ev:S.connexions.map(x=>x.ev).join(","),app:S.connexions.map(x=>x.app).join(",")}},MDP);
 const ag=await A.evaluate(async mdp=>{const u=S.users.find(x=>x.role==="admin"&&x.actif),o=S.users.find(x=>x.actif&&x.role!=="admin"&&x.id!==u.id);const r1=await login(u.id,mdp);A.out();const r2=await login(o.id,"faux");return{r1,r2,ev:S.connexions.map(x=>x.ev).join(","),app:S.connexions.map(x=>x.app).join(",")}},MDP);
 chk("CN-3","Transport et Agro : connexion, déconnexion et échec journalisés avec le nom de leur application",tr.ev.endsWith("ok,out,ko")&&tr.app.split(",").every(x=>x==="transport")&&ag.ev.endsWith("ok,out,ko")&&ag.app.split(",").every(x=>x==="agro"),JSON.stringify([tr,ag]));
 /* --- Hub --- */
 const H=await open("parametres");
 await H.evaluate(()=>{pTab("connexions")});
 const h0=await H.evaluate(()=>({verrous:[...document.querySelectorAll("#s-cx [data-cx=deverrouiller]")].length,txt:document.getElementById("s-cx").innerText}));
 chk("CN-4","onglet « 🔐 Connexions » du hub : chaque application est verrouillée tant qu'un de ses administrateurs ne l'a pas déverrouillée (même règle que la gestion des comptes)",h0.verrous===3&&/Historique de connexion/.test(h0.txt),JSON.stringify(h0));
 const unlock=async m=>{await H.evaluate(m=>{UM=m;pTab("users");uView()},m);await H.evaluate(async mdp=>{const f=document.getElementById("ugate");f.u.selectedIndex=0;f.pwd.value=mdp;f.requestSubmit();await new Promise(r=>setTimeout(r,1500))},MDP)};
 await unlock("dist");await H.evaluate(()=>pTab("connexions"));
 const h1=await H.evaluate(()=>{const J=document.getElementById("s-cx");return{lignes:J.querySelectorAll("tbody tr").length,txt:J.innerText,verr:J.querySelectorAll("[data-cx=deverrouiller]").length}});
 chk("CN-5","après déverrouillage de Distributions : tableau par utilisateur (dernière connexion, appareil, nombre de connexions et d'échecs) et journal détaillé ; Transport et Agro restent verrouillés",h1.verr===2&&h1.txt.includes(dl.admin)&&h1.txt.includes(dl.caissier)&&/Connexion/.test(h1.txt)&&/Échec : mot de passe incorrect/.test(h1.txt)&&/Tentative pendant un blocage/.test(h1.txt)&&/Déconnexion/.test(h1.txt),h1.txt.slice(0,300));
 const h2=await H.evaluate(nom=>{const rows=[...document.querySelectorAll("#s-cx table")[0].querySelectorAll("tbody tr")].map(r=>r.innerText.replace(/\s+/g," "));const r=rows.find(x=>x.startsWith(nom));return{r,alerte:/Plusieurs échecs de connexion en 24 h/.test(document.getElementById("s-cx").innerText)}},dl.caissier);
 chk("CN-6","l'utilisateur aux mots de passe refusés apparaît avec ses échecs et une alerte « plusieurs échecs en 24 h » ; l'administrateur affiche sa dernière connexion",/Jamais/.test(h2.r||"")&&h2.alerte,JSON.stringify(h2));
 await H.click('#s-cx button[data-cx=user][data-k$="'+dl.adid+'"]');await H.waitForTimeout(200);
 const h3=await H.evaluate(nom=>{const J=document.getElementById("s-cx");return{titre:document.getElementById("cx-j").innerText,noms:[...J.querySelectorAll("table")[1].querySelectorAll("tbody tr td:nth-child(2)")].map(x=>x.innerText.trim())}},dl.admin);
 chk("CN-7","« Historique » d'un utilisateur : le journal ne montre que ses événements",h3.noms.length>=2&&h3.noms.every(n=>n===dl.admin)&&h3.titre.includes(dl.admin),JSON.stringify(h3));
 await H.click('#s-cx button[data-cx=tous]');await H.selectOption('#s-cx select[data-cx=ev]',"ko");await H.waitForTimeout(150);
 const h4=await H.evaluate(()=>[...document.querySelectorAll("#s-cx table")[1].querySelectorAll("tbody tr")].map(r=>r.innerText).join("|"));
 chk("CN-8","filtre « Échecs et blocages » : seuls les refus sont listés",/Échec|blocage/.test(h4)&&!/Déconnexion/.test(h4)&&!/\tConnexion\t/.test(h4),h4.slice(0,200));
 await H.selectOption('#s-cx select[data-cx=ev]',"");
 const csv=await H.evaluate(()=>{let t="";const old=URL.createObjectURL;URL.createObjectURL=b=>{b.text().then(x=>window.__csv=x);return old(b)};cxCsv();return new Promise(r=>setTimeout(()=>r(window.__csv),200))});
 chk("CN-9","export CSV du journal filtré (en-têtes, une ligne par événement, jamais de mot de passe)",/^\ufeff?"Date";"Utilisateur";"Application"/.test(csv||"")&&(csv||"").split("\r\n").length>=6&&!(csv||"").includes(MDP),(csv||"").slice(0,120));
 /* accès hub journalisé dans l'application */
 const hub=await H.evaluate(()=>{const G=JSON.parse(localStorage.getItem("angels_erp_v1"));return G.connexions.filter(x=>x.via==="hub").map(x=>x.ev)});
 chk("CN-10","le déverrouillage de la gestion des comptes depuis le hub est lui-même journalisé (param_ok)",hub.includes("param_ok"),JSON.stringify(hub));
 await unlock("trans");await H.evaluate(()=>pTab("connexions"));
 const h5=await H.evaluate(()=>({txt:document.getElementById("s-cx").innerText,verr:document.querySelectorAll("#s-cx [data-cx=deverrouiller]").length}));
 chk("CN-11","Transport déverrouillé : ses connexions s'ajoutent au tableau et au journal (filtre par application disponible)",/Transport/.test(h5.txt)&&h5.verr===1,h5.txt.slice(0,160));
 /* connexions antérieures au journal */
 await H.evaluate(()=>{const k="angels_erp_v1",G=JSON.parse(localStorage.getItem(k));G.connexions=G.connexions.filter(x=>x.t>"2020");G.audit.push({ts:"2020-01-02T08:00:00.000Z",user:G.users[0].nom,role:G.users[0].role,action:"Connexion",detail:""});localStorage.setItem(k,JSON.stringify(G));CX.per="all";cxView()});
 const h6=await H.evaluate(()=>/repris de l'audit/.test(document.getElementById("s-cx").innerText));
 chk("CN-12","les connexions d'avant le journal sont reprises du journal d'audit de l'application (mention « repris de l'audit »)",h6);
 const src=require("fs").readFileSync(path.join(root,"parametres.html"),"utf8");
 chk("CN-13","l'onglet est déclaré dans les réglages du hub et n'affiche ni mot de passe ni empreinte",/\["connexions","🔐 Connexions"\]/.test(src)&&!/pwd/.test(src.slice(src.indexOf("function cxView"),src.indexOf("function cxCsv"))));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
