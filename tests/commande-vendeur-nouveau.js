/* Créer un vendeur partenaire directement depuis le formulaire « Nouvelle commande » (sans changer d'écran).
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/commande-vendeur-nouveau.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const path=require("path");
(async()=>{
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await b.newPage(),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 p.on("pageerror",e=>errs.push(e.message));p.on("console",m=>{if(m.type()==="error")console.log("CONSOLE",m.text().slice(0,300))});p.on("dialog",d=>d.accept());
 await p.goto("file://"+path.resolve(__dirname,"../distribution.html"));await p.waitForTimeout(500);
 await p.evaluate(()=>{window.__T=[];toast=(m,t)=>{__T.push((t||"")+":"+m)};window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};__as("admin");S.vendeurs=[];S.users=S.users.filter(u=>u.role!=="vendeur");window.__c0=S.commandes.length});
 const ev=(f,a)=>p.evaluate(f,a);
 chk("NV-1","aucun vendeur enregistré : le formulaire propose quand même « Origine de la commande » avec « ➕ Nouveau vendeur partenaire… »",await ev(()=>{formCmd();const s=document.getElementById("f_vend");return !!s&&[...s.options].some(o=>o.value==="__vnew")&&document.getElementById("f_vnew").classList.contains("hide")}));
 chk("NV-2","choisir « Nouveau vendeur » affiche le mini-formulaire (nom, téléphone, commission) et passe la commande en mode vendeur (articles libres, paiement vendeur)",await ev(()=>{const s=document.getElementById("f_vend");s.value="__vnew";s.dispatchEvent(new Event("change",{bubbles:true}));return !document.getElementById("f_vnew").classList.contains("hide")&&!!document.getElementById("vn_nom")&&!!document.querySelector(".l_desig")&&document.getElementById("f_payrow").classList.contains("hide")&&/Nouveau vendeur partenaire/.test(document.getElementById("f_vhint").textContent)}));
 const soumettre=(o)=>ev(async o=>{const f=document.getElementById("mf"),s=document.getElementById("f_vend");s.value="__vnew";s.dispatchEvent(new Event("change",{bubbles:true}));
  f.vn_nom.value=o.nom;f.vn_tel.value=o.tel;f.vn_com.value=o.com;f.n_nom&&(f.n_nom.value="Mme Konan");f.n_tel&&(f.n_tel.value="0505123456");
  const sel=document.getElementById("f_client");sel.value="__new";sel.dispatchEvent(new Event("change",{bubbles:true}));
  const q=document.querySelector("#newcl");f.n_nom&&(f.n_nom.value="Mme Konan");f.n_tel&&(f.n_tel.value="0505123456");
  const l=document.querySelector(".lrow");if(l){l.querySelector(".l_desig").value=o.art;l.querySelector(".l_qte").value="2";l.querySelector(".l_pu").value="5000"}
  const zq=document.querySelector("#newadr input[name=n_quartier],#newadr input[name=a_q]");if(zq)zq.value="Riviera";
  window.__T.length=0;f.requestSubmit();await new Promise(r=>setTimeout(r,300));return {t:window.__T.join("|"),v:S.vendeurs.length,u:S.users.filter(u=>u.role==="vendeur").length,c:S.commandes.length-window.__c0}},o);
 let r=await soumettre({nom:"",tel:"0707070707",com:"5",art:"Robe wax"});
 chk("NV-3","nom du vendeur manquant : refus clair, aucun vendeur ni compte ni commande créés",/Nom ou boutique/.test(r.t)&&r.v===0&&r.u===0&&r.c===0,JSON.stringify(r));
 r=await soumettre({nom:"Boutique Aya",tel:"12",com:"5",art:"Robe wax"});
 chk("NV-4","téléphone trop court : refus, rien n'est créé",/Téléphone/.test(r.t)&&r.v===0&&r.c===0,JSON.stringify(r));
 r=await soumettre({nom:"Boutique Aya",tel:"0707070707",com:"150",art:"Robe wax"});
 chk("NV-5","commission hors 0-100 % : refusée (contrôle du champ ou message), rien n'est créé",r.v===0&&r.c===0,JSON.stringify(r));
 r=await soumettre({nom:"Boutique Aya",tel:"0707070707",com:"5",art:""});
 chk("NV-6","commande invalide (aucun article) : le vendeur n'est PAS créé (annulation propre), pas de doublon possible en réessayant",r.v===0&&r.u===0&&r.c===0&&/err:/.test(r.t),JSON.stringify(r));
 r=await soumettre({nom:"Boutique Aya",tel:"0707070707",com:"5",art:"Robe wax"});
 await p.waitForTimeout(900);
 const d=await ev(()=>{const v=S.vendeurs[0],u=S.users.find(x=>x.id===(v&&v.user_id)),c=S.commandes[S.commandes.length-1];return {nom:v&&v.nom,com:v&&v.commission_pct,role:u&&u.role,chg:u&&u.chg,pwd:u&&u.pwd,cmdV:S.commandes.some(k=>k.vendeur_id===(v&&v.id)),succ:/Lui donner ses accès/.test(document.getElementById("modal").innerHTML),dbg:[document.getElementById("modal").innerHTML.slice(0,160),JSON.stringify(ui.vendNouveau)],audit:S.audit.some(a=>/depuis une commande/.test(a.detail||""))}});
 chk("NV-7","commande valide : vendeur créé (commission 5 %), compte « vendeur » à mot de passe non défini à changer, commande rattachée à ce vendeur, trace d'audit",r.v===1&&r.u===1&&r.c===1&&d.nom==="Boutique Aya"&&d.com===5&&d.role==="vendeur"&&d.chg===true&&!d.pwd&&d.cmdV&&d.audit,JSON.stringify([r,d]));
 r=await ev(async()=>{closeModal();ui.vendNouveau=null;formCmd();const f=document.getElementById("mf"),s=document.getElementById("f_vend");s.value="__vnew";s.dispatchEvent(new Event("change",{bubbles:true}));f.vn_nom.value="Boutique Sika";f.vn_tel.value="0101010101";
  const sel=document.getElementById("f_client");sel.value="__div";sel.dispatchEvent(new Event("change",{bubbles:true}));const l=document.querySelector(".lrow");l.querySelector(".l_desig").value="Pagne";l.querySelector(".l_qte").value="1";l.querySelector(".l_pu").value="8000";const zq=document.querySelector("#newadr input");zq&&(zq.value="Riviera");
  f.requestSubmit();await new Promise(r=>setTimeout(r,900));const h=document.getElementById("modal").innerHTML;return {t:(window.__T||[]).slice(-3).join("|"),title:(h.match(/<b>([^<]*)<\/b>/)||[])[1],ok:/Commande créée/.test(h),acces:/Lui donner ses accès/.test(h),v:S.vendeurs.length}});
 chk("NV-8","l'écran de succès (« Commande créée ») propose « Lui donner ses accès (mot de passe temporaire) » pour le vendeur tout juste créé",r.ok&&r.acces&&r.v===2,JSON.stringify(r));
 r=await ev(async()=>{await new Promise(r=>setTimeout(r,100));ACT.vendAcces(S.vendeurs[0].id);await new Promise(r=>setTimeout(r,500));const ov=document.querySelector("#aa-ov,.aa-ov,#modal")?document.body.innerHTML:"";return {pwd:!!S.users.find(x=>x.id===S.vendeurs[0].user_id).pwd,affiche:/mot de passe temporaire|Mot de passe/i.test(ov),n:ui.vendNouveau}});
 chk("NV-9","« Lui donner ses accès » génère le mot de passe temporaire (montré une seule fois, à changer à la première connexion)",r.pwd&&r.n===null,JSON.stringify(r));
 r=await ev(()=>{S.vendeurs.length=1;ui.vendNouveau=null;formCmd();const s=document.getElementById("f_vend");return {opts:[...s.options].map(o=>o.textContent).join("|")}});
 chk("NV-10","avec des vendeurs existants : liste habituelle + option « Nouveau vendeur partenaire… » en dernier",/Boutique Aya/.test(r.opts)&&/Nouveau vendeur partenaire/.test(r.opts)&&r.opts.indexOf("Nouveau")>r.opts.indexOf("Boutique Aya"),r.opts);
 r=await soumettre({nom:"Autre",tel:"0707070707",com:"0",art:"Sac"});
 chk("NV-11","téléphone déjà utilisé par un vendeur existant : refus (choisir le vendeur dans la liste), aucun doublon",/existe déjà/.test(r.t)&&(await ev(()=>S.vendeurs.length))===1,JSON.stringify(r));
 chk("NV-12","un préparateur (sans droit sur les vendeurs) ne voit pas l'option de création",await ev(()=>{closeModal();__as("preparateur");formCmd();const s=document.getElementById("f_vend");const r=!s||![...s.options].some(o=>o.value==="__vnew");closeModal();__as("admin");return r}));
 const e=errs.filter(x=>!/ResizeObserver/.test(x));chk("NV-13","aucune erreur de script",e.length===0,e.slice(0,2).join("|"));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();process.exit(ko?1:0)})();
