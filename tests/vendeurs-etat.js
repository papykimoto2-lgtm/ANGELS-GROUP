/* État récapitulatif par vendeur partenaire. Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" node tests/vendeurs-etat.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");const path=require("path");
(async()=>{const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1200,height:900}})).newPage(),errs=[];let ko=0;
 p.on("pageerror",e=>errs.push(e.message));await p.goto("file://"+path.resolve(__dirname,"../distribution.html"));await p.waitForTimeout(500);
 const r=await p.evaluate(()=>{toast=()=>{};ME=S.users.find(u=>u.role==="admin"&&u.actif);const L=vendEtatLignes(),v=S.vendeurs[0],d=vendDue(v),l=L.find(x=>x[0]===v.nom);
  vendEtat();const h=document.querySelector("#docf").srcdoc;closeModal();
  return{n:L.length,nv:S.vendeurs.length,ok:!!l&&l[10]===d.restant&&l[7]===d.acquis,h:/État des vendeurs partenaires/.test(h)&&/TOTAL/.test(h)&&h.includes(v.nom),btn:VIEWS.vendeurs().includes('data-act="vendEtat"')}});
 const o=r.n===r.nv&&r.nv>0&&r.ok&&r.h&&r.btn;console.log(o?"PASS":"FAIL","VE-1",JSON.stringify(r));
 const e=errs.length===0;console.log(e?"PASS":"FAIL","VE-2 aucune erreur JS",errs.join("|"));await b.close();process.exit(o&&e?0:1)})();
