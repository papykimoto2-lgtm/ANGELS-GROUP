/* Circuit direct : le centre valide lui-même des livraisons faites hors application (livreur sans réseau / téléphone en panne) : encaissement, articles remis, dates réelles,
   sans notification intermédiaire ni mission publiée ; le circuit habituel reste intact.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/circuit-direct.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const path=require("path");
(async()=>{
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:1000}}),p=await ctx.newPage(),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info===undefined?o:info));o===true?ok++:ko++};
 p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto("file://"+path.resolve(__dirname,"../distribution.html"));await p.waitForTimeout(500);
 await p.evaluate(()=>{window.__T=[];toast=m=>{__T.push(m)};ME=S.users.find(u=>u.role==="admin"&&u.actif);S.config.signature_seuil=99999999;
  window.__prete=n=>{const base=S.commandes.find(c=>c.statut==="prete")||S.commandes[0],c=JSON.parse(JSON.stringify(base));c.id="cd_"+n;c.numero="CMD-CD-"+n;c.statut="prete";c.date=new Date(Date.now()-5*864e5).toISOString();c.colis=null;c.hist=[{ts:new Date().toISOString(),de:"preparation",a:"prete",par:"t",note:""}];c.client_id=base.client_id;S.commandes.push(c);return c};
  window.__lv=S.livreurs.filter(l=>!l.archive);window.__hier=new Date(Date.now()-26*36e5).toISOString()});
 // 1. droits et ouverture
 let r=await p.evaluate(()=>{const c=__prete("1");ME=S.users.find(u=>u.role==="caissier"&&u.actif);__T.length=0;cenDirectModal();const refuse=/Réservé/.test(__T.join("|"));ME=S.users.find(u=>u.role==="admin"&&u.actif);cenDirectModal(c.id);const m=document.querySelector("#modal").innerText;closeModal();return{refuse,m:/Circuit direct/.test(m)&&/Articles remis/.test(m)&&/Livreur qui a livré/.test(m)&&m.includes(c.numero)}});
 chk("CD-1","réservé à l'administrateur et au superviseur ; la fenêtre liste les commandes avec résultat, encaissement, reçu par et articles remis",r.refuse&&r.m,JSON.stringify(r));
 // 2. livraison directe
 r=await p.evaluate(()=>{const c=cmd("cd_1"),lv=__lv[0],n0=(S.notifs||[]).length,pf0=(S.push_file||[]).length,sol0=soldeLiv(lv.id),att=soldeCmd(c);
  const e=cenDirectExec(c,{lid:lv.id,quand:__hier,resultat:"livree",montant:att,mode:"Espèces",recu_par:"Mme Test",bon:"B-77",articles:c.lignes.map(x=>({desig:lname(x),cmd:x.qte,remis:x.qte}))});
  const l=activeLiv(c.id)||livsOf(c.id).slice(-1)[0];const f=S.fonds.filter(x=>x.livraison_id===l.id);
  return{e,st:c.statut,ls:l.statut,circ:l.circuit,ce:l.code_etat,par:l.saisie_par,fin:l.fin_at===__hier,fts:f.length===1&&f[0].ts===__hier&&f[0].montant===att,sol:soldeLiv(lv.id)-sol0===att,notifs:(S.notifs||[]).length-n0,push:(S.push_file||[]).length-pf0,bon:l.bon_papier,dir:CEN_DIRECT,toastOk:typeof toast==="function"}});
 chk("CD-2","livraison directe : la commande passe à « livrée », encaissement enregistré à la date réelle et mis à la charge du livreur, bon papier et auteur conservés",r.e===""&&r.st==="livree"&&r.ls==="livree"&&r.circ==="direct"&&r.ce==="direct"&&r.fin&&r.fts&&r.sol&&r.bon==="B-77"&&!!r.par,JSON.stringify(r));
 chk("CD-3","pas de notification de mission au livreur, un seul message client (livraison) ; les contrôles reviennent à la normale après la saisie",r.push===0&&r.notifs<=1&&r.dir===false&&r.toastOk,JSON.stringify(r));
 // 4. livreur différent de celui affecté
 r=await p.evaluate(()=>{const c=__prete("2");const A=__lv[0],B=__lv[1];const l0=affecter(c,A.id,"");const e=cenDirectExec(c,{lid:B.id,quand:__hier,resultat:"livree",montant:soldeCmd(c),mode:"Espèces",recu_par:"X"});const L=livsOf(c.id);return{e,ancien:L.find(x=>x.id===l0.id).statut,reel:L.filter(x=>x.statut==="livree").map(x=>x.livreur_id)[0]===B.id}});
 chk("CD-4","commande affectée à un livreur mais livrée par un autre : réaffectation tracée, la livraison est au nom du livreur réel",r.e===""&&r.ancien==="reaffectee"&&r.reel,JSON.stringify(r));
 // 5. non livrée
 r=await p.evaluate(()=>{const c=__prete("3");const e=cenDirectExec(c,{lid:__lv[0].id,quand:__hier,resultat:"echec",motif:"Client absent",obs:"Client absent"});const l=livsOf(c.id).slice(-1)[0];return{e,st:c.statut,ls:l.statut,m:l.motif_echec}});
 chk("CD-5","livraison non réalisée : la commande passe à « échouée » avec le motif (traitement habituel ensuite : nouvelle tentative ou retour)",r.e===""&&r.st==="echouee"&&r.ls==="echouee"&&r.m==="Client absent",JSON.stringify(r));
 // 6. Mobile Money sans référence refusé
 r=await p.evaluate(()=>{const c=__prete("4");const modes=S.config.modes||[];const mm=modes.find(m=>estMobile(m));if(!mm)return{skip:true};const e=cenDirectExec(c,{lid:__lv[0].id,quand:__hier,resultat:"livree",montant:soldeCmd(c),mode:mm,ref:"",recu_par:"X"});return{e,st:c.statut}});
 chk("CD-6","paiement Mobile Money sans référence : refusé avec le motif, la commande reste intacte (pas d'état à moitié enregistré)",r.skip||(/Référence/.test(r.e)&&r.st!=="livree"),JSON.stringify(r));
 // 7. livreur au plafond d'argent détenu : ne bloque pas
 r=await p.evaluate(()=>{const c=__prete("5"),lv=__lv[0];S.config.plafond_detenu=1;S.config.dossier_obligatoire=true;const e=cenDirectExec(c,{lid:lv.id,quand:__hier,resultat:"livree",montant:soldeCmd(c),mode:"Espèces",recu_par:"X"});const ap=affecter(__prete("5b"),lv.id,"");S.config.plafond_detenu=0;S.config.dossier_obligatoire=false;return{e,st:c.statut,normalBloque:ap===false}});
 chk("CD-7","livreur au plafond d'argent détenu ou au dossier incomplet : la livraison déjà faite est quand même enregistrée ; le circuit habituel garde ses blocages",r.e===""&&r.st==="livree"&&r.normalBloque,JSON.stringify(r));
 // 8. interface : écart sans explication, articles partiels, validation en lot
 r=await p.evaluate(()=>{const a=__prete("6"),b2=__prete("7");cenDirectModal(a.id);const f=document.querySelector("#mf");f.lid.value=__lv[0].id;
  [a,b2].forEach(c=>{f["ck_"+c.id].checked=true;f["rp_"+c.id].value="Client "+c.numero});
  f["mt_"+a.id].value=String(soldeCmd(a)-500);   /* écart sans explication */
  f["q_"+b2.id+"_0"].value="0";   /* article non remis */
  f.dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));
  return{a:a.statut,b:b2.statut,t:__T.slice(-1)[0],obs:b2.obs||"",ouvert:!!document.querySelector("#modal .md")}});
 chk("CD-8","saisie en lot : la commande en écart sans explication est refusée (message), l'autre est enregistrée ; un article non remis est noté sur la commande",r.a!=="livree"&&r.b==="livree"&&/écart/.test(r.t)&&/Remis en partie/.test(r.obs),JSON.stringify(r));
 // 9. statistiques, dossier, clôture, publication
 r=await p.evaluate(()=>{const lv=__lv[0],s=statLiv(lv,Date.now()-3*864e5,Date.now());const l=S.livraisons.find(x=>x.circuit==="direct"&&x.statut==="livree");const c=cmd(l.commande_id);const pub=S.livraisons.filter(x=>x.circuit!=="direct").length<S.livraisons.length;
  return{duree:s.duree===0||s.duree>1,h:/circuit direct : validée par le centre/.test(cenPreuveHtml(c)),clot:cenCloture().sansCode.some(x=>x.circuit==="direct"),pub}});
 chk("CD-9","statistiques : pas de durée fictive pour le circuit direct ; dossier de preuve « circuit direct » ; clôture du jour le liste ; il est publié aux livreurs en lecture seule (voir circuit-direct-livreur.js)",r.duree&&r.h&&r.clot,JSON.stringify(r));
 // 10. page dédiée et circuit habituel
 r=await p.evaluate(()=>{ui.__c0=1;APPC=true;view="direct";render();const t=document.querySelector("main").innerText;const c=__prete("8");const l=affecter(c,__lv[0].id,"");const ok1=accepter(l)&&priseEnCharge(l,1)&&demarrer(l);return{page:/Circuit direct/.test(t)&&/Saisies aujourd'hui/.test(t),habituel:ok1&&l.statut==="en_cours"&&l.circuit===undefined,nav:NAV.some(n=>n.v==="direct"),btn:(APPC=false,view="livraisons",render(),/data-act="cenDirect"/.test(document.querySelector("main").innerHTML))}});
 chk("CD-10","page « Circuit direct » (saisies du jour) et bouton dans le Centre de livraison du bureau ; le circuit habituel (affecter, accepter, prise en charge, départ) fonctionne comme avant",r.page&&r.habituel&&r.nav&&r.btn,JSON.stringify(r));
 chk("CD-11","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();process.exit(ko?1:0);
})();
