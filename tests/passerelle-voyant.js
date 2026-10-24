/* Voyant « Passerelle » (Distributions) : état de la liaison avec les applications livreur et vendeur, visible du bureau.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/passerelle-voyant.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const path=require("path");
(async()=>{
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext(),p=await ctx.newPage(),errs=[];let mode="ok";
 await ctx.route("https://x.supabase.co/**",async r=>{const CORS={"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"POST, OPTIONS"};if(r.request().method()==="OPTIONS")return r.fulfill({status:204,headers:CORS});if(mode==="refus")return r.fulfill({status:401,contentType:"application/json",headers:CORS,body:JSON.stringify({ok:false,erreur:"Clé d'administration invalide"})});r.fulfill({status:200,contentType:"application/json",headers:CORS,body:JSON.stringify({ok:true,evenements:[],commandes:[],ignorees:0})})});let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto("file://"+path.resolve(__dirname,"../distribution.html"));await p.waitForTimeout(500);
 await p.evaluate(()=>{window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};__as("admin");window.__v=()=>{pgVoyant();const e=document.getElementById("pg-v");return e?e.textContent:""}});
 const v=()=>p.evaluate(()=>__v());
 chk("PV-1","passerelle non configurée et aucun compte livreur/vendeur sur le serveur : aucun voyant (pas de bruit)",await p.evaluate(()=>{S.livreurs.forEach(l=>delete l.ident_serveur);S.vendeurs.forEach(x=>delete x.ident_serveur);S.config.passerelle_actif=false;return __v()===""}));
 await p.evaluate(()=>{S.livreurs[0].ident_serveur="issa"});
 chk("PV-2","des comptes serveur existent mais la passerelle est inactive sur ce poste : voyant gris « inactive »",/⚪ Passerelle inactive/.test(await v()),await v());
 await p.evaluate(()=>{S.config.passerelle_actif=true});
 chk("PV-3","passerelle activée mais adresse ou clé d'administration manquante : voyant rouge « incomplète »",/🔴 Passerelle incomplète/.test(await v()),await v());
 await p.evaluate(()=>{S.config.appel_pont={url:"https://x.supabase.co",cle_admin:"cle"}});
 chk("PV-4","configurée, aucun échange encore : « en attente »",/Passerelle : en attente/.test(await v()),await v());
 const r=await p.evaluate(async()=>{await passSync(true);return {t:__v(),e:S.pass_err}});
 chk("PV-5","après un échange réussi avec le serveur : voyant vert « connectée »",/🟢 Passerelle connectée/.test(r.t)&&r.e==="",JSON.stringify(r));
 mode="refus";const r2=await p.evaluate(async()=>{await passSync(true);return {t:__v(),e:S.pass_err}});
 chk("PV-6","échange refusé par le serveur : voyant rouge « en erreur » avec le message",/🔴 Passerelle en erreur/.test(r2.t)&&/invalide/.test(r2.e),JSON.stringify(r2));
 mode="ok";const r3=await p.evaluate(async()=>{S.pass_err="";await passSync(true);_passOkAt=Date.now()-5*60000;return __v()});
 chk("PV-7","dernier échange il y a 5 minutes : voyant orange « sans échange récent »",/🟠 Passerelle sans échange récent/.test(r3),r3);
 const r4=await p.evaluate(()=>{localStorage.setItem("angels_sync",JSON.stringify({actif:true,cle:"K".repeat(32)}));localStorage.setItem("angels_supabase",JSON.stringify({url:"https://x.supabase.co"}));localStorage.removeItem("angels_pg_poste");return __v()});
 chk("PV-8","synchronisation entre postes active et ce poste n'est pas le poste passerelle : voyant orange « gérée par un autre poste »",/🟠 Passerelle gérée par un autre poste/.test(r4),r4);
 const r5=await p.evaluate(()=>{localStorage.setItem("angels_pg_poste","1");_passOkAt=Date.now();S.pass_err="";return __v()});
 chk("PV-9","le poste passerelle désigné : voyant vert",/🟢/.test(r5),r5);
 chk("PV-10","un clic ouvre le détail : comptes livreurs/vendeurs créés, poste passerelle, dernier échange, bouton « Échanger maintenant »",await p.evaluate(()=>{ACT.pgInfo();const h=document.getElementById("modal").innerHTML;closeModal();return /Comptes livreurs créés sur le serveur/.test(h)&&/Comptes vendeurs/.test(h)&&/Échanger maintenant/.test(h)&&/Dernier échange réussi/.test(h)}));
 chk("PV-11","le voyant n'apparaît pas pour un livreur ou un préparateur (rôles sans droit) ni en mode serveur",await p.evaluate(()=>{__as("preparateur");const a=__v();__as("admin");return a===""}));
 const e=errs.filter(x=>!/ResizeObserver/.test(x));chk("PV-12","aucune erreur de script",e.length===0,e.slice(0,2).join("|"));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();process.exit(ko?1:0)})();
