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
 /* test de la passerelle et création des comptes manquants, serveur simulé */
 let mode="ok";const creer=[];
 await ctx.route("**/functions/v1/mission-sync",async rt=>{const rq=rt.request(),b=JSON.parse(rq.postData()||"{}"),h={"access-control-allow-origin":"*","access-control-allow-headers":"*"};
  if(rq.method()==="OPTIONS")return rt.fulfill({status:204,headers:h});
  if(mode==="net")return rt.abort();if(mode==="401")return rt.fulfill({status:401,headers:h,contentType:"application/json",body:JSON.stringify({ok:false,erreur:"Clé d'administration invalide"})});
  if(mode==="404")return rt.fulfill({status:404,headers:h,contentType:"application/json",body:"{}"});
  if(b.action==="compte-creer"){creer.push(b.livreur_ref);return rt.fulfill({status:200,headers:h,contentType:"application/json",body:JSON.stringify({ok:true,ident:b.ident,mdp:"Tmp-"+creer.length+"-Xk9"})})}
  rt.fulfill({status:200,headers:h,contentType:"application/json",body:JSON.stringify({ok:true,evenements:[]})})});
 const essai=async m=>{mode=m;return p.evaluate(async()=>{view="params";ui.ptab="liv";render();$("#p_apurl").value="https://x.supabase.co/functions/v1";$("#p_apkey").value="k";await ACT.pgTest();return document.getElementById("pg_res").textContent})};
 const t401=await essai("401"),t404=await essai("404"),tnet=await essai("net"),tok=await essai("ok");
 chk("PGA-5","« Tester la passerelle » : clé refusée (401), fonction introuvable (404), serveur injoignable, succès : chaque cas a son message précis",/Clé refusée \(401\).*ADMIN_KEY/.test(t401)&&/introuvable \(404\)/.test(t404)&&/injoignable/.test(tnet)&&/Passerelle OK/.test(tok),JSON.stringify([t401,t404,tnet,tok]));
 mode="ok";const cr=await p.evaluate(async()=>{S.config.appel_pont={url:"https://x.supabase.co/functions/v1",cle_admin:"k"};S.config.passerelle_actif=true;ANGELS_AUTH.afficherTemp=async()=>{};
  const avant=S.livreurs.filter(l=>!l.ident_serveur).length;view="params";ui.ptab="liv";render();window.confirm=()=>true;await ACT.pgComptes();
  return{avant,apres:S.livreurs.filter(l=>!l.ident_serveur&&!l.archive).length,idents:S.livreurs.map(l=>l.ident_serveur).filter(Boolean).length,msg:document.getElementById("pg_res").textContent}});
 chk("PGA-6","« Créer les comptes serveur manquants » : un compte par livreur actif sans compte, identifiant mémorisé, aucun doublon au second appel",cr.avant>0&&cr.apres===0&&creer.length===cr.avant&&/compte\(s\) créé/.test(cr.msg),JSON.stringify([cr,creer.length]));
 chk("PGA-4","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
