/* Rattacher des commandes déjà enregistrées (même livrées) à un vendeur partenaire : l'administrateur régularise pour pouvoir régler le vendeur.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/rattacher-commandes.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const path=require("path");
(async()=>{
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await b.newPage(),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto("file://"+path.resolve(__dirname,"../distribution.html"));await p.waitForTimeout(500);
 await p.evaluate(()=>{window.__T=[];toast=(m,t)=>{__T.push((t||"")+":"+m)};window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};__as("admin");
  window.__V=()=>S.vendeurs.find(v=>/Aya/.test(v.nom))||S.vendeurs[0];
  /* commande de vente propre LIVRÉE et encaissée, avec articles du catalogue (stock sorti) */
  window.__livree=()=>S.commandes.find(c=>!c.vendeur_id&&c.statut==="livree"&&c.stock_sorti&&c.lignes.some(l=>l.produit_id)&&soldeCmd(c)===0)});
 const ev=(f,a)=>p.evaluate(f,a);
 const av=await ev(()=>{const v=__V(),c=__livree();v.commission_pct=10;return {ok:!!c,restant:vendDue(v).restant,acquis:vendDue(v).acquis,total:c&&c.total,prod:c&&c.montant_produits,stock:c&&c.lignes.filter(l=>l.produit_id).map(l=>[l.produit_id,l.qte]),stk:c&&c.lignes.filter(l=>l.produit_id).map(l=>prod(l.produit_id).stock)}});
 chk("RC-0","situation de départ : une commande de vente propre livrée et encaissée, aucun net dû pour ce vendeur à cause d'elle",av.ok,JSON.stringify(av));
 chk("RC-1","un caissier ne peut pas rattacher (réservé à l'administrateur)",await ev(()=>{__as("caissier");let m="";try{cmdRattacher(__livree(),__V())}catch(e){m=e.message}const b=document.body.innerHTML;__as("admin");return /Réservé à l'administrateur/.test(m)&&__livree().vendeur_id==null}));
 const r=await ev(()=>{const v=__V(),c=__livree(),id=c.id,tot=c.total,stk0=c.lignes.filter(l=>l.produit_id).map(l=>prod(l.produit_id).stock),q=c.lignes.filter(l=>l.produit_id).map(l=>l.qte),mvt0=S.stock_mvts.length;
  cmdRattacher(c,v,{stock:true});save();const d=vendDue(v),c2=cmd(id);
  return {vend:c2.vendeur_id===v.id,tot:c2.total===tot,lignes:c2.lignes.every(l=>l.produit_id===null&&l.desig),stk:c2.lignes.length&&q.every((x,i)=>true),stock:S.stock_mvts.slice(mvt0).map(m=>m.type+":"+m.qte),sorti:c2.stock_sorti,elig:d.elig.some(x=>x.id===id),net:d.net(c2),acquis:d.acquis,hist:c2.hist.slice(-1)[0].note,audit:S.audit.slice(-1)[0].action,stkApres:c2.lignes.length?null:null}});
 chk("RC-2","commande livrée rattachée : vendeur, total inchangé, articles devenus articles du vendeur (désignation conservée), stock remis (mouvements « rattachement_vendeur »), plus de stock sorti",r.vend&&r.tot&&r.lignes&&r.stock.length>0&&r.stock.every(x=>/^rattachement_vendeur/.test(x))&&r.sorti===false,JSON.stringify(r));
 chk("RC-3","elle devient « livrée et encaissée » dans le calcul du vendeur : net acquis augmente (commission de 10 % déduite), donc règlement possible",r.elig&&r.acquis>av.acquis&&r.net>0&&Math.abs(r.net-Math.round(av.prod*0.9))<=1,JSON.stringify([r,av]));
 chk("RC-4","traçabilité : historique de la commande et journal d'audit",/Rattachée au vendeur partenaire/.test(r.hist)&&/Rattachement/.test(r.audit));
 const st=await ev(()=>{const c=__livree();return c===undefined}); 
 chk("RC-5","double rattachement refusé ; commande annulée refusée ; période comptable clôturée refusée",await ev(()=>{const v=__V(),c=S.commandes.find(x=>x.vendeur_id===v.id&&x.statut==="livree");let m1="",m2="",m3="";try{cmdRattacher(c,v)}catch(e){m1=e.message}
  const a=S.commandes.find(x=>!x.vendeur_id&&x.statut==="annulee");if(a)try{cmdRattacher(a,v)}catch(e){m2=e.message}else m2="annulée";
  const o=S.commandes.find(x=>!x.vendeur_id&&x.statut!=="annulee");if(o){const c0=cpt().clos;cpt().clos="2999-12-31";try{cmdRattacher(o,v)}catch(e){m3=e.message}cpt().clos=c0}else m3="clôturée";
  return /déjà rattachée/.test(m1)&&/annulée/.test(m2)&&/clôturée/.test(m3)}));
 /* formulaire groupé depuis la fiche du vendeur */
 const g=await ev(()=>{const v=__V(),cand=S.commandes.filter(c=>!c.vendeur_id&&c.statut!=="annulee");const n0=S.commandes.filter(c=>c.vendeur_id===v.id).length;ACT.vendRattacher(v.id);const h=document.getElementById("modal").innerHTML,f=document.getElementById("mf");
  const ids=cand.slice(0,2).map(c=>c.id);ids.forEach(id=>{f["c_"+id].checked=true});f.requestSubmit();return {liste:cand.length>0&&/Rattacher des commandes à un vendeur partenaire/.test(h),n:S.commandes.filter(c=>c.vendeur_id===v.id).length-n0,ids:ids.length,t:__T.slice(-2).join("|")}});
 chk("RC-6","formulaire groupé (fiche du vendeur) : liste des commandes de vente propre, plusieurs commandes cochées rattachées d'un coup",g.liste&&g.n>=1&&g.ids===2,JSON.stringify(g));
 chk("RC-7","depuis une commande : bouton « 🤝 Rattacher à un vendeur » proposé à l'administrateur seulement, vendeur et commande présélectionnés",await ev(()=>{const c=S.commandes.find(x=>!x.vendeur_id&&x.statut!=="annulee");cmdDetail(c.id);const h1=document.getElementById("modal").innerHTML;closeModal();__as("caissier");cmdDetail(c.id);const h2=document.getElementById("modal").innerHTML;closeModal();__as("admin");ACT.cmdRattacher(c.id);const f=document.getElementById("mf");const sel=f["c_"+c.id].checked;closeModal();return /Rattacher à un vendeur/.test(h1)&&!/Rattacher à un vendeur/.test(h2)&&sel}));
 chk("RC-8","le règlement du vendeur devient possible pour les commandes rattachées (reste à régler > 0, règlement enregistré)",await ev(()=>{const v=__V(),d=vendDue(v);if(!(d.restant>0))return "restant "+d.restant;const n0=S.reglements.length;S.config.dg=Object.assign({},S.config.dg,{actif:false});const r=reglerVendeur(v,Math.min(1000,d.restant),"Virement","test");return r!==false&&S.reglements.length===n0+1&&vendDue(v).restant===d.restant-Math.min(1000,d.restant)}));
 const e=errs.filter(x=>!/ResizeObserver/.test(x));chk("RC-9","aucune erreur de script",e.length===0,e.slice(0,2).join("|"));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();process.exit(ko?1:0)})();
