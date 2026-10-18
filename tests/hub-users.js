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
 const page=async u=>{const p=await ctx.newPage();p.on("pageerror",e=>errs.push(u+" : "+e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/"+u);await p.waitForTimeout(400);return p};
 const msg=h=>h.evaluate(()=>{const m=document.querySelector("#usr .umsg");return m?m.textContent:""});
 const unlock=async(h,mod,pin)=>{await h.click(`[data-um=${mod}]`);await h.fill("#ugate [name=pin]",pin);await h.click("#ugate button")};
 // initialisation des trois applications (premier lancement = données de démonstration)
 const pd=await page("distribution.html"),pt=await page("transport.html"),pa=await page("agro.html");
 const h=await page("index.html");
 // 1. verrou administrateur
 await h.click("[data-um=trans]");
 t("USR-1","la gestion des comptes est verrouillée tant qu'un administrateur n'a pas saisi son PIN",(await h.$("#uadd"))===null&&(await h.$("#ugate"))!==null?true:"formulaire visible");
 await unlock(h,"trans","9999");t("USR-2","PIN administrateur faux : refusé",/incorrect/.test(await msg(h))&&(await h.$("#uadd"))===null?true:await msg(h));
 for(let i=0;i<4;i++)await unlock(h,"trans","9999");
 await unlock(h,"trans","1234");t("USR-3","5 essais faux : blocage temporaire, même avec le bon PIN",/patientez/.test(await msg(h))?true:await msg(h));
 // le blocage est levé pour la suite des tests
 await h.evaluate(()=>{TRY.trans={n:0,until:0}});await h.evaluate(()=>uView());
 await unlock(h,"trans","1234");t("USR-4","PIN administrateur correct : formulaire de création affiché",(await h.$("#uadd"))!==null?true:"verrou persistant");
 // 2. création d'un compte dans chaque application, puis connexion réelle
 const cree=async(mod,nom,role,pin)=>{await h.click(`[data-um=${mod}]`);if(await h.$("#ugate")){await h.fill("#ugate [name=pin]","1234");await h.click("#ugate button")}
  await h.fill("#uadd [name=nom]",nom);await h.selectOption("#uadd [name=role]",role);await h.fill("#uadd [name=pin]",pin);await h.click("#uadd button")};
 await cree("trans","Awa Comptable","comptable","5678");t("USR-5","Transport : compte créé",/compte créé/.test(await msg(h))?true:await msg(h));
 await cree("agro","Koffi Soigneur","soigneur","4321");t("USR-6","Agro : compte créé",/compte créé/.test(await msg(h))?true:await msg(h));
 await cree("dist","Marie Caissière","caissier","2468");t("USR-7","Distributions : compte créé",/compte créé/.test(await msg(h))?true:await msg(h));
 await pt.waitForTimeout(300);await pa.waitForTimeout(300);await pd.waitForTimeout(300);
 const lt=await pt.evaluate(()=>{const u=S.users.find(x=>x.nom==="Awa Comptable");return u?{role:u.role,r:login(u.id,"5678"),me:ME&&ME.nom,mauvais:login(u.id,"0000")}:null});
 t("USR-8","Transport : le nouvel utilisateur se connecte avec son PIN et son rôle",lt&&lt.role==="comptable"&&lt.r===null&&lt.me==="Awa Comptable"&&lt.mauvais==="PIN incorrect."?true:JSON.stringify(lt));
 const la=await pa.evaluate(()=>{const u=S.users.find(x=>x.nom==="Koffi Soigneur");return u?{role:u.role,r:login(u.id,"4321"),me:ME&&ME.nom}:null});
 t("USR-9","Agro : le nouvel utilisateur se connecte avec son PIN et son rôle",la&&la.role==="soigneur"&&la.r===null&&la.me==="Koffi Soigneur"?true:JSON.stringify(la));
 const ld=await pd.evaluate(()=>{const u=S.users.find(x=>x.nom==="Marie Caissière");return u?{role:u.role,pin:u.pin_h===hashPin(u.id,"2468"),mauvais:u.pin_h===hashPin(u.id,"1111"),actif:u.actif}:null});
 t("USR-10","Distributions : le compte existe, rôle et PIN corrects",ld&&ld.role==="caissier"&&ld.pin&&!ld.mauvais&&ld.actif?true:JSON.stringify(ld));
 const aud=await h.evaluate(()=>({t:lire("angels_transport_v3").audit.some(x=>/via Hub/.test(x.a)&&/Awa Comptable/.test(x.d)),a:lire("angels_agro_v1").audit.some(x=>/via Hub/.test(x.a)&&/Koffi Soigneur/.test(x.d)),d:lire("angels_erp_v1").audit.some(x=>/via Hub/.test(x.action)&&/Marie/.test(x.detail))}));
 t("USR-11","chaque création est inscrite au journal d'audit de l'application (« via Hub »)",aud.t&&aud.a&&aud.d?true:JSON.stringify(aud));
 // 3. règles de sécurité
 await cree("agro","Koffi Soigneur","chef","1357");t("USR-12","nom déjà utilisé : refusé",/déjà ce nom/.test(await msg(h))?true:await msg(h));
 await h.click("[data-um=trans]");await h.evaluate(()=>{const f=document.getElementById("uadd");f.querySelector("[name=pin]").removeAttribute("pattern")});
 await h.fill("#uadd [name=nom]","Test PIN court");await h.fill("#uadd [name=pin]","12");await h.click("#uadd button");
 t("USR-13","PIN de longueur incorrecte : refusé",/PIN/.test(await msg(h))&&!(await h.evaluate(()=>lire("angels_transport_v3").users.some(u=>u.nom==="Test PIN court")))?true:await msg(h));
 const roles=await h.evaluate(()=>[...document.querySelectorAll("#uadd [name=role] option")].map(o=>o.value));
 t("USR-14","Transport : le rôle chauffeur (fiche liée) n'est pas proposé",!roles.includes("chauffeur")&&roles.includes("flotte")?true:roles.join());
 // 4. changement de rôle, désactivation, dernier administrateur
 const rid=await h.evaluate(()=>lire("angels_transport_v3").users.find(u=>u.nom==="Awa Comptable").id);
 await h.selectOption(`[data-ur="${rid}"]`,"caissier");
 t("USR-15","changement de rôle enregistré dans l'application",await h.evaluate(()=>lire("angels_transport_v3").users.find(u=>u.nom==="Awa Comptable").role)==="caissier"?true:"inchangé");
 await h.click(`[data-ut="${rid}"]`);
 t("USR-16","désactivation : le compte ne peut plus se connecter",await (async()=>{await pt.waitForTimeout(300);return pt.evaluate(id=>login(id,"5678"),rid)})()==="Compte désactivé."?true:"connexion possible");
 await h.click(`[data-ut="${rid}"]`);
 t("USR-17","réactivation",await h.evaluate(()=>lire("angels_transport_v3").users.find(u=>u.nom==="Awa Comptable").actif)===true?true:"toujours désactivé");
 const adm=await h.evaluate(()=>lire("angels_transport_v3").users.filter(u=>u.role==="admin").map(u=>u.id));
 await h.click(`[data-ut="${adm[0]}"]`);t("USR-18","impossible de désactiver le compte administrateur qui autorise",/Impossible/.test(await msg(h))?true:await msg(h));
 await h.selectOption(`[data-ur="${adm[0]}"]`,"flotte");t("USR-19","impossible de retirer le rôle du dernier administrateur",/dernier administrateur/.test(await msg(h))&&(await h.evaluate(()=>lire("angels_transport_v3").users.filter(u=>u.role==="admin"&&u.actif).length))===1?true:await msg(h));
 // 5. réinitialisation de PIN
 await h.click(`[data-up="${rid}"]`);await h.fill(`[data-upin="${rid}"] [name=pin]`,"8642");await h.click(`[data-upin="${rid}"] button.sb:not(.g)`);
 await pt.waitForTimeout(300);t("USR-20","PIN réinitialisé : l'ancien est refusé, le nouveau accepté",await pt.evaluate(id=>[login(id,"5678"),login(id,"8642")],rid).then(r=>r[0]==="PIN incorrect."&&r[1]===null?true:JSON.stringify(r)));
 // 6. application jamais ouverte
 await ctx.clearCookies();const h2=await ctx.newPage();await h2.goto(base+"/index.html");await h2.evaluate(()=>localStorage.removeItem("angels_agro_v1"));await h2.reload();await h2.click("[data-um=agro]");
 t("USR-21","application jamais ouverte : message clair, aucun formulaire",/pas encore utilisée/.test(await h2.$eval("#usr",e=>e.innerText))&&(await h2.$("#uadd"))===null?true:"formulaire visible");
 t("USR-22","aucune valeur « NaN » / « undefined » dans la section",!/NaN|undefined/.test(await h.$eval("#usr",e=>e.innerText))?true:"valeur invalide");
 await h.screenshot({path:process.env.SHOT||"/tmp/hub-utilisateurs.png"});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
