/* Hub (parametres.html) : bouton « Modifier » (nom) dans Utilisateurs et rôles des applications.
   Usage : PLAYWRIGHT=/chemin/playwright node tests/hub-utilisateur-modifier.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:1000}}),errs=[];let ok=0,ko=0;
 const t=(id,l,r)=>{if(r===true){ok++;console.log("PASS",id,l)}else{ko++;console.log("FAIL",id,l,"→",r)}};
 const page=async u=>{const p=await ctx.newPage();p.on("pageerror",e=>errs.push(u+" : "+e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/"+u);await p.waitForTimeout(400);return p};
 const msg=h=>h.evaluate(()=>{const m=document.querySelector("#usr .umsg");return m?m.textContent:""});
 const DEMO="Demo@Angels2026";
 await page("distribution.html");const h=await page("parametres.html");
 await h.click("[data-um=dist]");await h.fill("#ugate [name=pwd]",DEMO);await h.click("#ugate button:not(.aa-e)");await h.waitForTimeout(800);
 // créer un compte simple à renommer
 await h.fill("#uadd [name=nom]","Test Renommer");await h.selectOption("#uadd [name=role]","caissier");await h.click("#uadd button");await h.waitForTimeout(900);
 if(await h.$("#aa-ok"))await h.click("#aa-ok");await h.waitForTimeout(300);
 const idc=await h.evaluate(()=>uEtat("dist").users.find(u=>u.nom==="Test Renommer").id);
 t("HM-1","bouton Modifier présent sur le compte",(await h.$(`[data-ue="${idc}"]`))!==null?true:"absent");
 await h.click(`[data-ue="${idc}"]`);t("HM-2","formulaire de nom affiché",(await h.$("#uedit [name=nom]"))!==null?true:"absent");
 await h.fill("#uedit [name=nom]","Nom Modifié");await h.click("#uedit button[type=submit]");await h.waitForTimeout(400);
 const r=await h.evaluate(id=>({n:uEtat("dist").users.find(u=>u.id===id).nom,a:uEtat("dist").audit.some(a=>/Utilisateur modifié \(via Hub\)/.test(a.action||a.a||""))}),idc);
 t("HM-3","nom enregistré et tracé à l'audit",r.n==="Nom Modifié"&&r.a?true:JSON.stringify([r,await msg(h)]));
 const autre=await h.evaluate(id=>uEtat("dist").users.find(u=>u.id!==id).nom,idc);await h.click(`[data-ue="${idc}"]`);await h.fill("#uedit [name=nom]",autre.toUpperCase());await h.click("#uedit button[type=submit]");await h.waitForTimeout(400);
 t("HM-4","nom déjà utilisé refusé",/déjà ce nom/.test(await msg(h))&&(await h.evaluate(id=>uEtat("dist").users.find(u=>u.id===id).nom,idc))==="Nom Modifié"?true:await msg(h));
 t("HM-5","aucune erreur JS",errs.length===0?true:errs.join("|"));
 console.log(ok+" PASS / "+ko+" FAIL");await b.close();srv.close();process.exit(ko?1:0)})();
