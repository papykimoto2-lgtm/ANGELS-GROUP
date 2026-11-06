/* Vue consolidée : chiffres comptables réservés à admin/direction/directeur.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/hub-verrou-compta.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext();let ok=0,ko=0;
 const t=(id,l,r)=>{if(r===true){ok++;console.log("PASS",id,l)}else{ko++;console.log("FAIL",id,l,"→",r)}};
 const p=await ctx.newPage();await p.goto(base+"/transport.html");await p.waitForTimeout(500);
 const mdp="Verrou-Test-77!x";
 await p.evaluate(async mdp=>{const S=JSON.parse(localStorage.getItem("angels_transport_v3"));const mk=async(id,nom,role)=>({id,nom,role,actif:true,pwd:await ANGELS_AUTH.creer(mdp)});S.users=[await mk("u_dir","Dir Test","directeur"),await mk("u_cpt","Cpt Test","comptable")];localStorage.setItem("angels_transport_v3",JSON.stringify(S))},mdp);await p.close();
 const h=await ctx.newPage();await h.goto(base+"/index.html");await h.waitForTimeout(500);
 t("VER-1","verrouillé par défaut : aucun chiffre",(await h.$("#fgate"))&&!/\d\s?F/.test(await h.$eval("#cons",e=>e.innerText))&&(await h.$$eval("#tcons *",e=>e.length))===0?true:"visible");
 const essai=async(n,m)=>{await h.fill("#fgate [name=nom]",n);await h.fill("#fgate [name=pwd]",m);await h.click("#fgate button[type=submit]");await h.waitForTimeout(2500)};
 await essai("Cpt Test",mdp);t("VER-2","comptable : refusé",(await h.$("#fgate"))!==null?true:"déverrouillé");
 await essai("Dir Test","faux");t("VER-3","mot de passe faux : refusé",(await h.$("#fgate"))!==null?true:"déverrouillé");
 await essai("Dir Test",mdp);t("VER-4","directeur : chiffres affichés",(await h.$("#fgate"))===null&&(await h.$$eval("#big b",e=>e.length))===4?true:"verrou persistant");
 await h.reload();await h.waitForTimeout(500);t("VER-5","session conservée après rechargement",(await h.$("#fgate"))===null?true:"reverrouillé");
 await h.evaluate(()=>sessionStorage.removeItem("hub_fin"));await h.reload();await h.waitForTimeout(500);t("VER-6","session effacée : verrou rétabli",(await h.$("#fgate"))!==null?true:"ouvert");
 console.log(`\n${ok} PASS / ${ko} FAIL`);await b.close();srv.close();process.exit(ko?1:0)})();
