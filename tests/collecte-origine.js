/* Collectes chez les vendeurs : seules les commandes passées par le partenaire vendeur lui-même (application, espace, boutique) sont à collecter ;
   celles que l'agence enregistre pour un vendeur ne le sont pas (la marchandise est déjà entre ses mains).
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/collecte-origine.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const path=require("path");
(async()=>{
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),p=await ctx.newPage(),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info===undefined?o:info));o===true?ok++:ko++};
 p.on("pageerror",e=>errs.push(e.message));
 await p.goto("file://"+path.resolve(__dirname,"../distribution.html"));await p.waitForTimeout(500);
 await p.evaluate(()=>{window.__T=[];toast=m=>{__T.push(m)};ME=S.users.find(u=>u.role==="admin"&&u.actif);
  window.__V=S.vendeurs[0];S.collectes=[];
  window.__mk=(n,extra)=>{const base=S.commandes[0],c=JSON.parse(JSON.stringify(base));c.id="co_"+n;c.numero="CMD-CO-"+n;c.statut="confirmee";c.vendeur_id=__V.id;c.hist=[{ts:new Date().toISOString(),de:"",a:"attente",par:"Agent agence",note:""}];delete c.app_ref;delete c.depose_par_vendeur;Object.assign(c,extra||{});S.commandes.push(c);return c}});
 let r=await p.evaluate(()=>{const ag=__mk("ag"),ap=__mk("ap",{app_ref:"APP-1"}),dp=__mk("dp",{depose_par_vendeur:true}),L=aCollecter(__V.id).map(c=>c.numero);return{L,ag:L.includes("CMD-CO-ag"),ap:L.includes("CMD-CO-ap"),dp:L.includes("CMD-CO-dp")}});
 chk("CO-1","commande enregistrée par l'agence pour un vendeur : NON à collecter ; commande déposée par le vendeur (application ou espace) : à collecter",r.ag===false&&r.ap===true&&r.dp===true,JSON.stringify(r));
 r=await p.evaluate(()=>{const u=S.users.find(x=>x.role==="vendeur");const c=__mk("hu");c.hist[0].par=u?u.nom:"?";return{auj:u?aCollecter(__V.id).some(x=>x.id===c.id):true}});
 chk("CO-2","anciennes commandes déposées par le compte du vendeur (sans marque) : reconnues grâce à l'auteur de la création",r.auj===true,JSON.stringify(r));
 r=await p.evaluate(()=>{const ag=cmd("co_ag");let e1="";try{colPlanLocal({vendeur_id:__V.id,commandes:[ag.id],livreur:S.livreurs[0].id,creneau:new Date().toISOString(),note:""})}catch(x){e1=x.message}return{e1}});
 chk("CO-3","planifier une collecte avec une commande saisie par l'agence : refusé avec le motif",/enregistrée par l'agence/.test(r.e1),JSON.stringify(r));
 r=await p.evaluate(()=>{const ap=cmd("co_ap");let c1=null,e="";try{S.config.dossier_obligatoire=false;c1=colPlanLocal({vendeur_id:__V.id,commandes:[ap.id],livreur:S.livreurs[0].id,creneau:new Date().toISOString(),note:"",adresse:{zone:"Cocody",quartier:"Angré",repere:"x"}})}catch(x){e=x.message}return{n:c1&&c1.numero,e}});
 chk("CO-4","commande déposée par le vendeur : la collecte se planifie",!!r.n,JSON.stringify(r));
 r=await p.evaluate(()=>{const c=cmd("co_ag");c.statut="confirmee";ME=S.users.find(u=>u.role==="admin"&&u.actif);const h=(typeof cmdFiche==="function"?"":"")||"";view="livraisons";ui.cdt="col";render();const t=document.querySelector("main").innerText;return{ag:/CMD-CO-ag/.test(t),ap:/CMD-CO-ap/.test(t)||true,ct:t.includes("Collectes chez les vendeurs")}});
 chk("CO-5","l'onglet « Collectes vendeurs » ne liste pas la commande saisie par l'agence",r.ag===false&&r.ct===true,JSON.stringify(r));
 r=await p.evaluate(()=>{const ag=cmd("co_ag");cmdDetail(ag.id);const h=document.querySelector("#modal").innerHTML;closeModal();return{btn:/data-act="colPlan"/.test(h),prep:/data-act="cmdPrep"/.test(h)}});
 chk("CO-6","fiche de la commande saisie par l'agence : pas de bouton « Planifier la collecte », mais « Début de préparation » disponible",r.btn===false&&r.prep===true,JSON.stringify(r));
 chk("CO-7","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();process.exit(ko?1:0);
})();
