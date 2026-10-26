/* Les encaissements des livreurs ne dépendent plus d'un seul appareil : tout poste du bureau relève les actions des livreurs (le poste passerelle seul publie),
   l'enregistrement de l'encaissement est identique d'un poste à l'autre (pas de doublon), et une alerte montre ce qui attend encore sur le serveur.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/encaissements-systematiques.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const path=require("path");
(async()=>{
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1000,height:900}}),p=await ctx.newPage(),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info===undefined?o:info));o===true?ok++:ko++};
 const SRV={ev:[],acq:[],publier:0,mode:"ok"};
 await ctx.route("https://x.supabase.co/**",async r=>{const H={"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"POST, OPTIONS","content-type":"application/json"};
  if(r.request().method()==="OPTIONS")return r.fulfill({status:204,headers:H});
  const b=JSON.parse(r.request().postData()||"{}");
  if(SRV.mode==="panne")return r.fulfill({status:500,headers:H,body:JSON.stringify({ok:false,erreur:"serveur indisponible"})});
  if(b.action==="evenements")return r.fulfill({status:200,headers:H,body:JSON.stringify({ok:true,evenements:SRV.ev.filter(e=>!SRV.acq.includes(e.id))})});
  if(b.action==="acquitter"){SRV.acq.push(...b.ids);return r.fulfill({status:200,headers:H,body:JSON.stringify({ok:true})})}
  if(b.action==="publier")SRV.publier++;
  return r.fulfill({status:200,headers:H,body:JSON.stringify({ok:true,commandes:[],vendeurs:[],preuve:null})})});
 p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto("file://"+path.resolve(__dirname,"../distribution.html"));await p.waitForTimeout(500);
 await p.evaluate(()=>{window.__T=[];toast=m=>{__T.push(m)};ME=S.users.find(u=>u.role==="admin"&&u.actif);S.config.passerelle_actif=true;S.config.appel_pont={url:"https://x.supabase.co",cle_admin:"cle"};S.config.signature_seuil=99999999;
  localStorage.setItem("angels_sync",JSON.stringify({actif:true,cle:"K".repeat(32)}));localStorage.setItem("angels_supabase",JSON.stringify({url:"https://x.supabase.co"}));localStorage.removeItem("angels_pg_poste");
  window.__prep=()=>{const l=S.livraisons.find(x=>isActive(x)&&cmd(x.commande_id));const c=cmd(l.commande_id);c.colis=null;c.statut="en_cours";l.statut="en_cours";l.code="1234";return l};
  window.__enc=lid=>S.fonds.filter(f=>f.type==="encaissement"&&f.livreur_id===lid)});
 const info=await p.evaluate(()=>{const l=__prep();return{ref:l.id,lid:l.livreur_id,att:l.montant_attendu,avant:__enc(l.livreur_id).length,sync:ANGELS_SYNC.actif(),poste:localStorage.getItem("angels_pg_poste")}});
 // 1. poste non désigné : relève quand même
 SRV.ev=[{id:900,livraison_ref:info.ref,livreur_ref:info.lid,type:"confirmer",cree_le:new Date(Date.now()-5*60000).toISOString(),donnees:{montant:info.att,mode:"Espèces",recu_par:"M. Test",direct:false,code_etat:"ok"}}];
 let r=await p.evaluate(async()=>{await passSync(true);return{n:__enc(__prep.lid||S.livraisons.find(x=>x.id)&&0).length}});
 r=await p.evaluate(async lid=>({n:__enc(lid).length,ids:__enc(lid).map(f=>f.id)}),info.lid);
 chk("ES-1","poste NON désigné (synchronisation active) : l'encaissement du livreur est quand même relevé et enregistré",info.sync===true&&info.poste===null&&r.n===info.avant+1&&r.ids.includes("f_ev900"),JSON.stringify([info,r]));
 chk("ES-2","l'action est acquittée sur le serveur, et ce poste ne publie rien (seul le poste passerelle publie)",SRV.acq.includes(900)&&SRV.publier===0,JSON.stringify({acq:SRV.acq,pub:SRV.publier}));
 // 3. deux postes : même identifiant → un seul enregistrement
 r=await p.evaluate(lid=>{const e=__enc(lid).find(f=>f.id==="f_ev900"),copie=JSON.parse(JSON.stringify(e));const avant=S.fonds.length;S.fonds.push(copie);const ids=S.fonds.filter(f=>f.id==="f_ev900");return{doublon_id:ids.length}},info.lid);
 const r3=await p.evaluate(lid=>{const l=__prep();S.fonds=S.fonds.filter(f=>f.id!=="f_ev900");const L=S.livraisons.find(x=>x.livreur_id===lid&&x.statut==="livree"&&S.fonds.length>=0);return 1},info.lid);
 const r4=await p.evaluate(async info=>{const l=__prep();const n0=S.fonds.filter(f=>f.id==="f_ev901").length;const ev={id:901,livraison_ref:l.id,livreur_ref:l.livreur_id,type:"confirmer",donnees:{montant:l.montant_attendu,mode:"Espèces",recu_par:"X",direct:false}};
  const a=passAppliquer(ev);const n1=S.fonds.filter(f=>f.id==="f_ev901").length;l.statut="en_cours";cmd(l.commande_id).statut="en_cours";const b2=passAppliquer(ev);const n2=S.fonds.filter(f=>f.id==="f_ev901").length;return{a,n0,n1,n2,b2}},info);
 chk("ES-3","la même action relevée deux fois (deux postes) ne crée qu'un seul encaissement : identifiant « f_ev<n° d'action> » identique",r4.n0===0&&r4.n1===1&&r4.n2===1,JSON.stringify(r4));
 // 4. le poste passerelle publie toujours
 await p.evaluate(()=>{localStorage.setItem("angels_pg_poste","1")});
 await p.evaluate(async()=>{_passSig="";await passSync(true)});
 chk("ES-4","le poste passerelle désigné continue de publier les missions vers les applications",SRV.publier>=1,SRV.publier);
 await p.evaluate(()=>{localStorage.removeItem("angels_pg_poste")});
 // 5. bandeau : actions en attente sur le serveur
 const l2=await p.evaluate(()=>{const l=__prep();l.montant_attendu=8500;return{ref:l.id,lid:l.livreur_id,nom:liv(l.livreur_id).nom}});
 SRV.ev=[{id:910,livraison_ref:l2.ref,livreur_ref:l2.lid,type:"confirmer",cree_le:new Date(Date.now()-14*60000).toISOString(),donnees:{montant:8500,mode:"Espèces",recu_par:"X",direct:false}},{id:911,livraison_ref:l2.ref,livreur_ref:l2.lid,type:"position",cree_le:new Date().toISOString(),donnees:{lat:5,lng:-4}}];
 r=await p.evaluate(async()=>{await passAttenteLire();return{att:{n:_passAtt.n,total:_passAtt.total},h:passBandeau()}});
 chk("ES-5","alerte : « 1 action de livreur reçue par le serveur, pas encore enregistrée » avec le montant et le livreur, depuis 14 min (les positions GPS ne comptent pas)",r.att.n===1&&r.att.total===8500&&/8 500 F/.test(r.h)&&new RegExp(l2.nom.split(" ")[0]).test(r.h)&&/14 min/.test(r.h)&&/Recevoir maintenant/.test(r.h),JSON.stringify(r));
 r=await p.evaluate(async()=>{_passAtt.plus=0.3;return passBandeau()});
 chk("ES-6","une action toute récente (moins d'une minute) n'alarme pas : le poste est en train de la relever",r==="",r);
 await p.evaluate(()=>{_passAtt.plus=14});
 r=await p.evaluate(()=>{view="tresorerie";render();return/pas encore enregistrée/.test(document.querySelector("main").innerText)});
 const r5b=await p.evaluate(()=>{APPC=true;view="aujourdhui";render();return/pas encore enregistrée/.test(document.querySelector("main").innerText)});
 chk("ES-7","le bandeau apparaît sur la Trésorerie et sur « Aujourd'hui »",r===true&&r5b===true,JSON.stringify([r,r5b]));
 // 8. recevoir maintenant
 r=await p.evaluate(async()=>{APPC=false;view="tresorerie";render();const n0=S.fonds.filter(f=>f.id==="f_ev910").length;await ACT.passRecevoir();await new Promise(r=>setTimeout(r,200));return{n0,n1:S.fonds.filter(f=>f.id==="f_ev910").length,b:passBandeau(),t:__T.slice(-1)[0],err:S.pass_err,T:__T.slice(-4),aud:S.audit.slice(-2).map(x=>x.action+x.detail)}});
 chk("ES-8","« ⬇ Recevoir maintenant » : l'encaissement est enregistré, le bandeau disparaît",r.n1===1&&r.b===""&&/à jour/.test(r.t),JSON.stringify(r));
 // 9. serveur injoignable
 SRV.mode="panne";r=await p.evaluate(async()=>{await passAttenteLire();return passBandeau()});
 chk("ES-9","serveur injoignable : un avertissement le dit (au lieu d'un silence)",/Impossible de vérifier/.test(r),r);
 chk("ES-10","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();process.exit(ko?1:0);
})();
