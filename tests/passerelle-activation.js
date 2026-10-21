/* Activation de la passerelle livreur : la case ne se décoche plus sans explication (clé d'administration ou adresse manquante : message clair).
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/passerelle-activation.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1300,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/distribution.html");await p.waitForTimeout(700);
 const r=await p.evaluate(async()=>{ME=S.users.find(u=>u.role==="admin");view="params";ui.ptab="liv";render();const o={};
  const fill=(pg,url,key)=>{view="params";ui.ptab="liv";render();$("#p_pg").checked=pg;$("#p_apurl").value=url;$("#p_apkey").value=key;ACT.saveParams()};
  const txt=()=>[...document.querySelectorAll("#toast .t")].map(x=>x.textContent).join(" | ");
  fill(true,"https://x.supabase.co/functions/v1","");await new Promise(r=>setTimeout(r,200));o.sansCle={actif:S.config.passerelle_actif,msg:txt()};
  document.getElementById("toast").innerHTML="";
  fill(true,"http://x","cle");await new Promise(r=>setTimeout(r,200));o.sansHttps={actif:S.config.passerelle_actif,msg:txt()};
  document.getElementById("toast").innerHTML="";
  fill(true,"https://x.supabase.co/functions/v1","cle-admin-test");await new Promise(r=>setTimeout(r,200));o.ok={actif:S.config.passerelle_actif,msg:txt()};return o});
 chk("PGA-1","case cochée sans clé d'administration : passerelle non activée ET message qui nomme le champ manquant",r.sansCle.actif===false&&/clé d'administration/i.test(r.sansCle.msg)&&/NON activée/.test(r.sansCle.msg),JSON.stringify(r.sansCle));
 chk("PGA-2","adresse non https : message qui nomme l'adresse des fonctions",r.sansHttps.actif===false&&/https:\/\//.test(r.sansHttps.msg)&&/Adresse des fonctions/.test(r.sansHttps.msg),JSON.stringify(r.sansHttps));
 chk("PGA-3","adresse https et clé renseignées : passerelle activée, aucun message d'erreur",r.ok.actif===true&&!/NON activée/.test(r.ok.msg),JSON.stringify(r.ok));
 chk("PGA-4","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
