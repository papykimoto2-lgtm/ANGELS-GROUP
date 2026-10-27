/* Liens courts et rassurants (…/l/AB3K9ZQ) : création côté bureau, résolution côté client, repli sur le lien long, garde-fous du serveur.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/liens-courts.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";if(/^\/l\/[A-Za-z0-9]+$/.test(u))u="/lien.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("introuvable")}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info===undefined?o:info));o===true?ok++:ko++};
 const H={"access-control-allow-origin":"*","access-control-allow-headers":"*"};
 const store={};let n=0,mode="ok";
 const ctx=await b.newContext({viewport:{width:1200,height:900}});
 await ctx.route("**/functions/v1/lien-court**",async rt=>{const rq=rt.request();if(rq.method()==="OPTIONS")return rt.fulfill({status:204,headers:H});
  const J=(s,o)=>rt.fulfill({status:s,headers:H,contentType:"application/json",body:JSON.stringify(o)});
  if(rq.method()==="POST"){if(mode==="panne")return J(500,{ok:false,erreur:"Erreur serveur"});const bd=JSON.parse(rq.postData()||"{}");const c="K"+String(++n).padStart(6,"A");store[c]=bd.cible;return J(200,{ok:true,code:c})}
  const c=new URL(rq.url()).searchParams.get("c");if(c==="EXPIREE")return J(410,{ok:false,erreur:"Lien expiré"});if(!store[c])return J(404,{ok:false,erreur:"Lien introuvable"});return J(200,{ok:true,cible:store[c]})});
 const p=await ctx.newPage();const errs=[];p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/distribution.html");await p.waitForTimeout(600);
 await p.evaluate(()=>{ME=S.users.find(u=>u.role==="admin"&&u.actif);S.config.appel_pont={url:"https://gfzqxoolorbejxnxrlji.supabase.co/functions/v1",cle_admin:"k"};S.config.passerelle_actif=true});
 /* 1. création */
 let r=await p.evaluate(async()=>{const long=location.origin+"/distribution.html#portail="+"A".repeat(600);const c=await lienCourt(long);const c2=await lienCourt(long);return{c,c2,court:await lienCourt(location.origin+"/portail#x")}});
 chk("LK-1","un lien long devient « …/l/CODE » (réutilisé s'il est redemandé) ; un lien déjà court reste inchangé",/^http:\/\/127\.0\.0\.1:\d+\/l\/K[A-Z0-9]{6}$/.test(r.c)&&r.c===r.c2&&/portail#x$/.test(r.court)&&Object.keys(store).length===1,JSON.stringify(r));
 chk("LK-2","la partie envoyée au serveur est une page relative de l'application (jamais une adresse externe)",/^distribution\.html#portail=A+$/.test(Object.values(store)[0]),JSON.stringify(store).slice(0,120));
 /* 3. repli */
 mode="panne";r=await p.evaluate(async()=>{const long=location.origin+"/portail#/suivi/"+"B".repeat(500);return{l:await lienCourt(long),long}});
 chk("LK-3","serveur en panne : le lien long est conservé (rien ne se perd)",r.l===r.long,r.l.slice(0,60));
 mode="ok";
 r=await p.evaluate(async()=>{S.config.passerelle_actif=false;const a=S.config.appel_pont;S.config.appel_pont=null;const long=location.origin+"/portail#/suivi/"+"C".repeat(500);const l=await lienCourt(long);S.config.appel_pont=a;S.config.passerelle_actif=true;return l===long});
 chk("LK-4","sans passerelle configurée : lien long conservé",r===true);
 r=await p.evaluate(async()=>{const l=await lienCourt("https://exemple.test/malveillant#"+"D".repeat(300));return l.startsWith("https://exemple.test/malveillant#")});
 chk("LK-5","une page qui n'est pas de l'application n'est jamais raccourcie",r===true);
 /* 6. liens utilisés : localisation client, suivi, boutique */
 r=await p.evaluate(async()=>{const c=S.clients[0];const a=c.adresses[0];await geoLinkModal(c.id,a.id);const v=(document.getElementById("gl")||{}).value||"";closeModal();return v});
 chk("LK-6","lien de localisation du client (celui de la capture) : court",/\/l\/K[A-Z0-9]{6}$/.test(r),r.slice(0,100));
 r=await p.evaluate(async()=>{const c=S.commandes.find(x=>!["brouillon","annulee"].includes(x.statut));await ACT.suiviLien(c.id);await new Promise(r=>setTimeout(r,300));const v=(document.querySelector("#modal input[readonly]")||{}).value||"";const t=document.querySelector("#modal").innerText;closeModal();return{v,signe:/signé/.test(t)}});
 chk("LK-7","lien de suivi : court, et l'explication « lien signé » reste affichée",/\/l\/K[A-Z0-9]{6}$/.test(r.v)&&r.signe,JSON.stringify(r));
 /* 8. page de résolution */
 const q=await ctx.newPage();q.on("pageerror",e=>errs.push(e.message));
 const code=Object.keys(store)[0];await q.goto(base+"/l/"+code);await q.waitForTimeout(1500);
 chk("LK-8","ouvrir le lien court redirige vers la vraie page avec tout son contenu",q.url().startsWith(base+"/distribution.html#portail=AAAA"),q.url().slice(0,120));
 await q.goto(base+"/l/EXPIREE");await q.waitForTimeout(800);
 chk("LK-9","lien expiré : message clair, aucune redirection",/expiré/.test(await q.innerText("body"))&&q.url().endsWith("/l/EXPIREE"));
 await q.goto(base+"/l/ZZZZZZZ");await q.waitForTimeout(800);
 chk("LK-10","lien inconnu : message clair",/introuvable/.test(await q.innerText("body")));
 store.EVIL1="https://evil.test/x";await q.goto(base+"/l/EVIL1");await q.waitForTimeout(800);
 chk("LK-11","une cible externe stockée n'est jamais suivie (pas de redirection ouverte)",!q.url().includes("evil.test")&&/introuvable/.test(await q.innerText("body")),q.url());
 /* 12. serveur : validation de la cible + rewrite Vercel */
 const src=fs.readFileSync(path.join(root,"supabase/functions/lien-court/index.js"),"utf8"),m=src.match(/export const cibleValide = [^;]+;/)[0];
 const cv=eval("(function(){"+m.replace("export ","")+";return cibleValide})()");
 chk("LK-12","le serveur n'accepte que des pages de l'application (refuse http://, //, javascript:, pages inconnues)",cv("distribution.html#portail=abc")&&cv("portail#/suivi/xyz")&&!cv("https://evil.test")&&!cv("//evil.test")&&!cv("javascript:alert(1)")&&!cv("admin.html#x"));
 const vj=JSON.parse(fs.readFileSync(path.join(root,"vercel.json"),"utf8"));
 chk("LK-13","vercel.json : /l/:code est servi par la page de résolution",vj.rewrites.some(x=>x.source==="/l/:code"&&x.destination==="/lien.html"));
 /* 15. téléphone : poste synchronisé sans clé d'administration (« Passerelle incomplète ») */
 const hdrs=[];await ctx.route("**/functions/v1/lien-court**",async rt=>{const rq=rt.request();hdrs.push(rq.headers());return rt.fallback()});
 r=await p.evaluate(async()=>{S.config.passerelle_actif=false;S.config.appel_pont=null;localStorage.setItem("angels_sync",JSON.stringify({actif:true,cle:"SYNC-TEST"}));const l=await lienCourt(location.origin+"/distribution.html#portail="+"Z".repeat(500));return{l,pass:!!PASS()}});
 chk("LK-15","poste synchronisé SANS clé d'administration (téléphone, « Passerelle incomplète ») : le lien court est quand même créé, avec la clé de synchronisation",!r.pass&&/\/l\/K[A-Z0-9]{6}$/.test(r.l)&&hdrs.some(h=>h["x-sync-key"]==="SYNC-TEST"&&!h["x-admin-key"]),JSON.stringify([r,hdrs.length]));
 r=await p.evaluate(async()=>{localStorage.removeItem("angels_sync");const l=await lienCourt(location.origin+"/distribution.html#portail="+"Y".repeat(500));return l.length>400});
 chk("LK-16","ni passerelle ni synchronisation : le lien long est conservé",r===true);
 r=await p.evaluate(async()=>{localStorage.setItem("angels_sync",JSON.stringify({actif:true,cle:"SYNC-TEST"}));const long=location.origin+"/distribution.html#portail="+"W".repeat(500);const a=await lienCourt(long);const k=Object.keys(_lcMemo).find(x=>x===long);_lcMemo[k].t=Date.now()-2*864e5;const b=await lienCourt(long);return{a,b,diff:a!==b}});
 chk("LK-17","la mémoire des liens expire au bout de 24 h (un lien périmé côté serveur n'est jamais redonné)",r.diff&&/\/l\//.test(r.b),JSON.stringify(r));
 r=await p.evaluate(async()=>{localStorage.setItem("angels_sync",JSON.stringify({actif:true,cle:"SYNC-TEST"}));S.config.passerelle_actif=false;S.config.appel_pont=null;const c=S.clients[0],a=c.adresses[0];await geoLinkModal(c.id,a.id);const v=(document.getElementById("gl")||{}).value||"";closeModal();return{v,pass:!!PASS()}});
 chk("LK-20","téléphone sans clé d'administration : le lien de localisation du client (fenêtre « Portail client ») est COURT",!r.pass&&/\/l\/K[A-Z0-9]{6}$/.test(r.v),JSON.stringify(r).slice(0,200));
 const srcC=fs.readFileSync(path.join(root,"supabase/functions/lien-court/index.js"),"utf8"),mc=srcC.match(/const ALPHA = [^\n]+\n[\s\S]*?const code = [\s\S]*?\n(?=export const cibleValide)/)[0].replace(/\/\*[\s\S]*?\*\//g,"");
 const gen=eval("(function(){"+mc+";return code})()"),cs=new Set();for(let i=0;i<200;i++)cs.add(gen());
 chk("LK-18","les codes ont 10 caractères lisibles (sans 0, O, 1, I, L), tous différents",[...cs].every(x=>/^[A-HJKMNP-Z2-9]{10}$/.test(x))&&cs.size===200,[...cs][0]);
 chk("LK-19","le serveur accepte aussi la clé de synchronisation et une apostrophe dans la cible",/x-sync-key/.test(srcC)&&/SYNC_KEY/.test(srcC)&&cv("portail#/suivi/L'Enfance"),"");
 chk("LK-14","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
