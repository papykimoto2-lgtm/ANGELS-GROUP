/* Mise en production : aucune donnée de démonstration, un seul administrateur (KESSIE), bouton « afficher le mot de passe », purge d'une démonstration existante.
   À lancer SANS tests/demo-hook.js. Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/production.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});let ok=0,ko=0;const errs=[];
 const chk=(id,label,o,info)=>{console.log(o?"PASS":"FAIL",id,label,o?"":info||"");o?ok++:ko++};
 const APPS=[["distribution","Distributions","pin"],["transport","Transport","p"],["agro","Agro","p"]];
 for(const [app,nom,champ] of APPS){
  const ctx=await b.newContext({viewport:{width:1200,height:900}}),p=await ctx.newPage();p.on("pageerror",e=>errs.push(app+": "+e.message));p.on("dialog",d=>d.accept());
  await p.goto(base+"/"+app+".html");await p.waitForTimeout(700);
  const ecr=await p.evaluate(()=>({txt:document.body.innerText,cards:document.querySelectorAll(".pcard").length,opts:[...document.querySelectorAll("#lf select option")].map(o=>o.textContent.trim()),demoFlag:localStorage.getItem("angels_demo")}));
  chk("PRD-1-"+app,nom+" : base vide, un seul compte (KESSIE — Administrateur), aucun profil ni mot de passe de démonstration à l'écran",ecr.cards===0&&ecr.opts.length===1&&/^KESSIE/.test(ecr.opts[0])&&!/Demo@Angels2026|Essayez sans rien installer/.test(ecr.txt)&&!ecr.demoFlag,JSON.stringify(ecr).slice(0,400));
  const st=await p.evaluate(()=>({users:S.users.map(u=>[u.nom,u.role,!!u.pwd,!!u.chg]),nb:{cmd:(S.commandes||[]).length,cli:(S.clients||[]).length,veh:(S.vehicles||[]).length,lots:(S.lots||[]).length,prod:(S.produits||[]).filter(p=>!/^(OEUFS-B|CAL-)/.test(p.code||"")).length,drv:(S.drivers||[]).length,livr:(S.livreurs||[]).length},demoMarqueur:JSON.stringify(S).includes("Demo@")||JSON.stringify(S).includes("démonstration chargées")}));
  const vide=Object.values(st.nb).every(n=>n===0);
  chk("PRD-2-"+app,nom+" : aucune donnée d'exemple (commandes, clients, véhicules, lots, produits, chauffeurs, livreurs) et un seul administrateur",vide&&st.users.length===1&&st.users[0][0]==="KESSIE"&&st.users[0][1]==="admin"&&st.users[0][2]&&st.users[0][3]&&!st.demoMarqueur,JSON.stringify(st));
  /* mauvais mot de passe, puis le bon */
  await p.selectOption("#lf select",{index:0});await p.fill("#lf [name="+champ+"]","Mauvais@2026x");await p.click("#lf button:not(.aa-e)");await p.waitForTimeout(800);
  const rejet=await p.evaluate(()=>!document.getElementById("aa-ov")&&!ME);
  await p.fill("#lf [name="+champ+"]","Jheack@2026");await p.click("#lf button:not(.aa-e)");await p.waitForTimeout(900);
  const ov=await p.evaluate(()=>({ov:!!document.getElementById("aa-ov"),titre:(document.querySelector("#aa-ov h2")||{}).textContent,annuler:!!document.getElementById("aa-x")}));
  chk("PRD-3-"+app,nom+" : mot de passe erroné refusé ; KESSIE / Jheack@2026 accepté, changement du mot de passe imposé (non annulable)",rejet&&ov.ov&&!ov.annuler,JSON.stringify([rejet,ov]));
  await p.fill("#aa-n","Prod#Zebre-2026!");await p.fill("#aa-c","Prod#Zebre-2026!");await p.click("#aa-ok");await p.waitForTimeout(1200);
  const co=await p.evaluate(()=>({me:ME&&ME.nom,role:ME&&ME.role,chg:!!(ME&&ME.chg),ancien:ANGELS_AUTH.connecter?true:false}));
  chk("PRD-4-"+app,nom+" : après le changement, KESSIE est connecté comme administrateur",co.me==="KESSIE"&&co.role==="admin"&&!co.chg,JSON.stringify(co));
  const navs=await p.evaluate(()=>[...document.querySelectorAll("aside [data-act=nav],aside [data-a=nav],nav [data-a=nav],[data-a=nav][data-id],aside [data-act=nav][data-id]")].map(e=>e.dataset.id).filter((x,i,a)=>x&&a.indexOf(x)===i));
  let navErr=0;for(const id of navs.slice(0,60)){try{await p.evaluate(i=>{const e=document.querySelector('[data-act="nav"][data-id="'+i+'"],[data-a="nav"][data-id="'+i+'"]');if(e)e.click()},id);await p.waitForTimeout(60)}catch(e){navErr++}}
  const txtNaN=await p.evaluate(()=>/\bNaN\b|undefined/.test(document.getElementById("app").innerText));
  chk("PRD-5-"+app,nom+" : tous les écrans ("+navs.length+") s'ouvrent sur la base vide sans erreur",navs.length>=5&&!navErr&&!txtNaN&&!errs.some(e=>e.startsWith(app+":")),JSON.stringify({n:navs.length,navErr,txtNaN,errs:errs.filter(e=>e.startsWith(app+":")).slice(0,3)}));
  /* nouveau chargement : la session et les données persistent, l'ancien mot de passe ne marche plus */
  await p.evaluate(()=>{try{sessionStorage.clear()}catch(e){}});await p.reload();await p.waitForTimeout(700);
  await p.selectOption("#lf select",{index:0});await p.fill("#lf [name="+champ+"]","Jheack@2026");await p.click("#lf button:not(.aa-e)");await p.waitForTimeout(800);
  const ancien=await p.evaluate(()=>!document.getElementById("aa-ov")&&!ME);
  await p.fill("#lf [name="+champ+"]","Prod#Zebre-2026!");await p.click("#lf button:not(.aa-e)");await p.waitForTimeout(900);
  const ok2=await p.evaluate(()=>!!ME&&ME.nom==="KESSIE"&&!document.getElementById("aa-ov"));
  chk("PRD-6-"+app,nom+" : le mot de passe d'origine est abandonné après le premier changement ; le nouveau fonctionne",ancien&&ok2,JSON.stringify([ancien,ok2]));
  await ctx.close();
 }
 /* Bouton afficher / masquer le mot de passe */
 {const ctx=await b.newContext({viewport:{width:1200,height:900}}),p=await ctx.newPage();p.on("pageerror",e=>errs.push("oeil: "+e.message));
  for(const pg of ["distribution","transport","agro","parametres","livreur"]){await p.goto(base+"/"+pg+".html");await p.waitForTimeout(600);
   const r=await p.evaluate(()=>{const i=document.querySelector("input[type=password]");if(!i)return{aucun:true};const w=i.closest(".aa-w"),bt=w&&w.querySelector(".aa-e");if(!bt)return{sansBouton:true};i.value="Secret#1234";const t0=i.type;bt.click();const t1=i.type;const lab1=bt.getAttribute("aria-label");bt.click();return{t0,t1,t2:i.type,lab1,val:i.value,pressed:bt.getAttribute("aria-pressed")}});
   chk("PRD-7-"+pg,pg+" : bouton « afficher le mot de passe » dans le champ (masqué → visible → masqué), valeur conservée",r.t0==="password"&&r.t1==="text"&&r.t2==="password"&&/Masquer/.test(r.lab1||"")&&r.val==="Secret#1234",JSON.stringify(r));}
  await ctx.close()}
 /* Purge d'une démonstration existante */
 {const ctx=await b.newContext({viewport:{width:1200,height:900}}),p=await ctx.newPage();p.on("pageerror",e=>errs.push("purge: "+e.message));
  const msgs=[];p.on("dialog",d=>{msgs.push(d.message());d.accept()});
  await p.goto(base+"/distribution.html?demo=1");await p.waitForTimeout(800);
  const demo=await p.evaluate(()=>({nbU:S.users.length,cmd:S.commandes.length,flag:localStorage.getItem("angels_demo")}));
  await p.evaluate(()=>localStorage.removeItem("angels_demo"));await p.goto(base+"/distribution.html");await p.waitForTimeout(900);
  const apres=await p.evaluate(()=>({users:S.users.map(u=>u.nom),cmd:S.commandes.length,portail:(()=>{try{const x=JSON.parse(localStorage.getItem("angels_portail_v1")||"null");return x?(x.produits||x.catalogue||[]).length:0}catch(e){return -1}})()}));
  chk("PRD-8","démonstration existante : avertissement « mise en production », puis effacement complet (comptes, commandes) ; base vide avec KESSIE seul",demo.nbU>3&&demo.cmd>0&&msgs.some(m=>/MISE EN PRODUCTION/.test(m))&&apres.users.join()==="KESSIE"&&apres.cmd===0&&apres.portail<=0,JSON.stringify({demo,apres,msgs:msgs.length}));
  /* refus : les données sont conservées et la question n'est plus posée */
  await p.goto(base+"/distribution.html?demo=1");await p.evaluate(()=>{localStorage.removeItem(KEY);});await p.reload();await p.waitForTimeout(800);
  await p.evaluate(()=>localStorage.removeItem("angels_demo"));p.removeAllListeners("dialog");let n=0;p.on("dialog",d=>{n++;d.dismiss()});
  await p.goto(base+"/distribution.html");await p.waitForTimeout(800);await p.reload();await p.waitForTimeout(800);
  const garde=await p.evaluate(()=>({nb:S.users.length,cmd:S.commandes.length}));
  chk("PRD-9","refus de la purge : les données de démonstration sont conservées et la question n'est posée qu'une fois",garde.nb>3&&garde.cmd>0&&n===1,JSON.stringify({garde,n}));
  await ctx.close()}
 /* Hub : démonstration encore présente sur l'appareil → alerte et effacement en un clic */
 {const ctx=await b.newContext({viewport:{width:1200,height:900}}),p=await ctx.newPage();p.on("pageerror",e=>errs.push("hub: "+e.message));p.on("dialog",d=>d.accept());
  await p.goto(base+"/transport.html?demo=1");await p.waitForTimeout(900);await p.goto(base+"/agro.html?demo=1");await p.waitForTimeout(900);
  await p.evaluate(()=>localStorage.removeItem("angels_demo"));await p.goto(base+"/index.html");await p.waitForTimeout(900);
  const av=await p.evaluate(()=>({alerte:!document.getElementById("demo-alerte").hidden,txt:document.getElementById("demo-alerte").innerText,cons:document.getElementById("cons").innerText}));
  await p.click("#demo-purge");await p.waitForTimeout(1200);
  const ap=await p.evaluate(()=>({alerte:!document.getElementById("demo-alerte").hidden,cons:document.getElementById("cons").innerText,cles:["angels_transport_v3","angels_agro_v1","angels_compta_transport"].map(k=>localStorage.getItem(k))}));
  chk("PRD-10","Hub : données de démonstration détectées (Transport, Agro) → alerte ; un clic les efface, la vue consolidée repart à zéro, aucun chiffre de démonstration ne subsiste",av.alerte&&/Transport/.test(av.txt)&&/Agro/.test(av.txt)&&/386|346/.test(av.cons)&&!ap.alerte&&!/386 ?000|346 ?000/.test(ap.cons.replace(/\u202f|\u00a0/g," "))&&ap.cles.every(x=>x===null),JSON.stringify({av:av.txt.slice(0,120),ap:ap.cons.slice(0,160),cles:ap.cles.map(x=>!!x)}));
  await ctx.close()}
 await b.close();srv.close();console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs"+(errs.length?" ; erreurs page : "+errs.slice(0,5).join(" | "):""));process.exit(ko||errs.length?1:0);
})();
