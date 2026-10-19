/* Utilisateurs et rôles créés depuis le hub : les comptes doivent fonctionner dans chaque application.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/hub-users.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:1000}}),errs=[];let ok=0,ko=0;
 const t=(id,l,r)=>{if(r===true){ok++;console.log("PASS",id,l)}else{ko++;console.log("FAIL",id,l,"→",r)}};
 const page=async u=>{const p=await ctx.newPage();p.on("pageerror",e=>errs.push(u+" : "+e.message));p.on("crash",()=>console.log("CRASH",u));p.on("close",()=>console.log("CLOSE",u));p.on("dialog",d=>d.accept());await p.goto(base+"/"+u);await p.waitForTimeout(400);return p};
 const msg=h=>h.evaluate(()=>{const m=document.querySelector("#usr .umsg");return m?m.textContent:""});
 const unlock=async(h,mod,pwd)=>{await h.click(`[data-um=${mod}]`);await h.fill("#ugate [name=pwd]",pwd);await h.click("#ugate button");await h.waitForTimeout(700)};
 const DEMO="Demo@Angels2026";
 const temp=async h=>{await h.waitForSelector("#aa-m",{timeout:5000});const m=await h.$eval("#aa-m",e=>e.textContent);await h.click("#aa-ok");await h.waitForTimeout(200);return m};
 /* première connexion avec un mot de passe temporaire : l'écran de création s'affiche, on le remplit */
 const first=async(p,id,tmp,nouveau)=>{await p.evaluate(({id,tmp})=>{window.__lp=login(id,tmp)},{id,tmp});await p.waitForSelector("#aa-n",{timeout:5000});await p.fill("#aa-n",nouveau);await p.fill("#aa-c",nouveau);await p.click("#aa-ok");return p.evaluate(()=>window.__lp)};
 // initialisation des trois applications (premier lancement = données de démonstration)
 const pd=await page("distribution.html"),pt=await page("transport.html"),pa=await page("agro.html");
 const h=await page("parametres.html");
 // 1. verrou administrateur
 await h.click("[data-um=trans]");
 t("USR-1","la gestion des comptes est verrouillée tant qu'un administrateur n'a pas saisi son mot de passe",(await h.$("#uadd"))===null&&(await h.$("#ugate"))!==null?true:"formulaire visible");
 await unlock(h,"trans","9999");t("USR-2","mot de passe administrateur faux : refusé",/incorrect/.test(await msg(h))&&(await h.$("#uadd"))===null?true:await msg(h));
 for(let i=0;i<4;i++)await unlock(h,"trans","9999");
 await unlock(h,"trans",DEMO);t("USR-3","5 essais faux : blocage temporaire, même avec le bon mot de passe",/patientez/.test(await msg(h))?true:await msg(h));
 // le blocage est levé pour la suite des tests
 await h.evaluate(()=>{TRY.trans={n:0,until:0}});await h.evaluate(()=>uView());
 await unlock(h,"trans",DEMO);t("USR-4","mot de passe administrateur correct : formulaire de création affiché",(await h.$("#uadd"))!==null?true:"verrou persistant");
 // 2. création d'un compte dans chaque application, puis connexion réelle
 const cree=async(mod,nom,role)=>{await h.click(`[data-um=${mod}]`);if(await h.$("#ugate")){await h.fill("#ugate [name=pwd]",DEMO);await h.click("#ugate button");await h.waitForTimeout(700)}
  await h.fill("#uadd [name=nom]",nom);await h.selectOption("#uadd [name=role]",role);await h.click("#uadd button");await h.waitForTimeout(900)};
 await cree("trans","Awa Comptable","comptable");const mT=await temp(h);t("USR-5","Transport : compte créé, mot de passe temporaire montré une fois",/compte créé/.test(await msg(h))&&mT.length===14?true:await msg(h)+mT);
 await cree("agro","Koffi Soigneur","soigneur");const mA=await temp(h);t("USR-6","Agro : compte créé, mot de passe temporaire montré une fois",/compte créé/.test(await msg(h))&&mA.length===14?true:await msg(h)+mA);
 await cree("dist","Marie Caissière","caissier");const mD=await temp(h);t("USR-7","Distributions : compte créé, mot de passe temporaire montré une fois",/compte créé/.test(await msg(h))&&mD.length===14?true:await msg(h)+mD);
 await pt.waitForTimeout(300);await pa.waitForTimeout(300);await pd.waitForTimeout(300);
 const idT=await pt.evaluate(()=>S.users.find(x=>x.nom==="Awa Comptable").id);const bad=await pt.evaluate(id=>login(id,"0000-Pas-Bon"),idT);
 const rT=await first(pt,idT,mT,"Compta-Nouveau-61!");const lt=await pt.evaluate(()=>({role:S.users.find(x=>x.nom==="Awa Comptable").role,me:ME&&ME.nom}));
 t("USR-8","Transport : le nouvel utilisateur se connecte avec le mot de passe temporaire, le remplace et garde son rôle",lt.role==="comptable"&&rT===null&&lt.me==="Awa Comptable"&&/incorrect/.test(bad)?true:JSON.stringify([lt,rT,bad]));
 const idA=await pa.evaluate(()=>S.users.find(x=>x.nom==="Koffi Soigneur").id);const rA=await first(pa,idA,mA,"Mdp-Frais-Ferme-62!");const la=await pa.evaluate(()=>({role:S.users.find(x=>x.nom==="Koffi Soigneur").role,me:ME&&ME.nom}));
 t("USR-9","Agro : le nouvel utilisateur se connecte avec le mot de passe temporaire, le remplace et garde son rôle",la.role==="soigneur"&&rA===null&&la.me==="Koffi Soigneur"?true:JSON.stringify([la,rA]));
 const ld=await pd.evaluate(async mdp=>{const u=S.users.find(x=>x.nom==="Marie Caissière");return u?{role:u.role,ok:await ANGELS_AUTH.verifier(mdp,u.pwd),mauvais:await ANGELS_AUTH.verifier("Autre-Mdp-99!x",u.pwd),actif:u.actif,pin:u.pin_h,chg:u.chg}:null},mD);
 t("USR-10","Distributions : le compte existe, rôle et mot de passe temporaire corrects (haché), à changer",ld&&ld.role==="caissier"&&ld.ok&&!ld.mauvais&&ld.actif&&ld.pin===undefined&&ld.chg===true?true:JSON.stringify(ld));
 const aud=await h.evaluate(()=>({t:lire("angels_transport_v3").audit.some(x=>/via Hub/.test(x.a)&&/Awa Comptable/.test(x.d)),a:lire("angels_agro_v1").audit.some(x=>/via Hub/.test(x.a)&&/Koffi Soigneur/.test(x.d)),d:lire("angels_erp_v1").audit.some(x=>/via Hub/.test(x.action)&&/Marie/.test(x.detail))}));
 t("USR-11","chaque création est inscrite au journal d'audit de l'application (« via Hub »)",aud.t&&aud.a&&aud.d?true:JSON.stringify(aud));
 // 3. règles de sécurité
 await cree("agro","Koffi Soigneur","chef");t("USR-12","nom déjà utilisé : refusé",/déjà ce nom/.test(await msg(h))?true:await msg(h));
 await h.click("[data-um=trans]");t("USR-13","le formulaire de création ne propose aucun champ PIN ni mot de passe",(await h.$("#uadd [name=pin]"))===null&&(await h.$("#uadd input[type=password]"))===null?true:"champ présent");
 const roles=await h.evaluate(()=>[...document.querySelectorAll("#uadd [name=role] option")].map(o=>o.value));
 t("USR-14","Transport : le rôle chauffeur (fiche liée) n'est pas proposé",!roles.includes("chauffeur")&&roles.includes("flotte")?true:roles.join());
 // 4. changement de rôle, désactivation, dernier administrateur
 const rid=await h.evaluate(()=>lire("angels_transport_v3").users.find(u=>u.nom==="Awa Comptable").id);
 await h.selectOption(`[data-ur="${rid}"]`,"caissier");
 t("USR-15","changement de rôle enregistré dans l'application",await h.evaluate(()=>lire("angels_transport_v3").users.find(u=>u.nom==="Awa Comptable").role)==="caissier"?true:"inchangé");
 await h.click(`[data-ut="${rid}"]`);
 t("USR-16","désactivation : le compte ne peut plus se connecter",await (async()=>{await pt.waitForTimeout(300);return pt.evaluate(id=>login(id,"Compta-Nouveau-61!"),rid)})()==="Compte désactivé."?true:"connexion possible");
 await h.click(`[data-ut="${rid}"]`);
 t("USR-17","réactivation",await h.evaluate(()=>lire("angels_transport_v3").users.find(u=>u.nom==="Awa Comptable").actif)===true?true:"toujours désactivé");
 const adm=await h.evaluate(()=>lire("angels_transport_v3").users.filter(u=>u.role==="admin").map(u=>u.id));
 await h.click(`[data-ut="${adm[0]}"]`);t("USR-18","impossible de désactiver le compte administrateur qui autorise",/Impossible/.test(await msg(h))?true:await msg(h));
 await h.selectOption(`[data-ur="${adm[0]}"]`,"flotte");t("USR-19","impossible de retirer le rôle du dernier administrateur",/dernier administrateur/.test(await msg(h))&&(await h.evaluate(()=>lire("angels_transport_v3").users.filter(u=>u.role==="admin"&&u.actif).length))===1?true:await msg(h));
 // 5. réinitialisation du mot de passe
 await h.click(`[data-up="${rid}"]`);const mR=await temp(h);await pt.waitForTimeout(300);
 const rr=await pt.evaluate(async({id,mR})=>{const u=S.users.find(x=>x.id===id);return{ancien:await ANGELS_AUTH.verifier("Compta-Nouveau-61!",u.pwd),nouveau:await ANGELS_AUTH.verifier(mR,u.pwd),chg:u.chg}},{id:rid,mR});
 t("USR-20","mot de passe réinitialisé : l'ancien est refusé, le temporaire accepté et à changer",mR.length===14&&!rr.ancien&&rr.nouveau&&rr.chg===true?true:JSON.stringify([mR,rr]));
 // 6. application jamais ouverte
 await ctx.clearCookies();const h2=await ctx.newPage();await h2.goto(base+"/parametres.html");await h2.evaluate(()=>localStorage.removeItem("angels_agro_v1"));await h2.reload();await h2.click("[data-um=agro]");
 t("USR-21","application jamais ouverte : message clair, aucun formulaire",/pas encore utilisée/.test(await h2.$eval("#usr",e=>e.innerText))&&(await h2.$("#uadd"))===null?true:"formulaire visible");
 t("USR-22","aucune valeur « NaN » / « undefined » dans la section",!/NaN|undefined/.test(await h.$eval("#usr",e=>e.innerText))?true:"valeur invalide");
 const home=await ctx.newPage();await home.goto(base+"/index.html");await home.waitForTimeout(300);
 t("USR-23","le hub n'affiche plus la gestion des comptes : une carte « Paramètres » ouvre la page dédiée",(await home.$("#usr"))===null&&(await home.$('a[href="parametres.html"]'))!==null&&/Utilisateurs et rôles/.test(await home.$eval("#c-param",e=>e.innerText))?true:"section encore présente");
 await h.screenshot({path:process.env.SHOT||"/tmp/hub-utilisateurs.png"});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
