/* Bordereau de livraison détaillé par livreur. Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" node tests/bordereau-livreur.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");const path=require("path");
(async()=>{const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1200,height:900}})).newPage(),errs=[];
 p.on("pageerror",e=>errs.push(e.message));await p.goto("file://"+path.resolve(__dirname,"../distribution.html"));await p.waitForTimeout(500);
 const r=await p.evaluate(()=>{window.__T=[];toast=m=>{__T.push(m)};ME=S.users.find(u=>u.role==="admin"&&u.actif);S.config.signature_seuil=99999999;
  const base=S.commandes.find(c=>c.statut==="prete")||S.commandes[0],c=JSON.parse(JSON.stringify(base));c.id="bd_1";c.numero="CMD-BD-1";c.statut="prete";c.colis=null;c.hist=[];S.commandes.push(c);
  const lv=S.livreurs.filter(l=>!l.archive)[0],vide={id:"lv_vide_t",nom:"Vide Test",tel:"0000"};S.livreurs.push(vide);
  cenBordereauLivreur(vide.id);const sans=__T.some(m=>/aucune course active/.test(m));
  CEN_DIRECT=true;const l=affecter(c,lv.id,"");CEN_DIRECT=false;
  cenBordereauLivreur(lv.id);const f=document.querySelector("#docf"),h=f?f.srcdoc:"";closeModal();
  ME=S.users.find(u=>u.role==="livreur");__T.length=0;cenBordereauLivreur(lv.id);const refuse=__T.some(m=>/Accès refusé/.test(m));
  ME=S.users.find(u=>u.role==="admin"&&u.actif);
  return{sans,aff:!!l,h:/Bordereau de livraison/.test(h)&&h.includes("CMD-BD-1")&&/TOTAL/.test(h)&&/Livreur — signature/.test(h)&&h.includes(lv.nom),refuse,btn:cenLivCard(lv).includes("cenBordereau"),btn2:(ui.cdt="liv",view="livraisons",VIEWS.livraisons().includes("cenBordereau"))}});
 const o=r.sans&&r.aff&&r.h&&r.refuse&&r.btn&&r.btn2;console.log(o?"PASS":"FAIL","BL-1",JSON.stringify(r));
 const e=errs.length===0;console.log(e?"PASS":"FAIL","BL-2 aucune erreur JS",errs.join("|"));await b.close();process.exit(o&&e?0:1)})();
