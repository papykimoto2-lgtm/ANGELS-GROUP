/* État imprimable des livreurs. Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" node tests/livreurs-etat.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");const path=require("path");
(async()=>{const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1200,height:900}})).newPage(),errs=[];
 p.on("pageerror",e=>errs.push(e.message));await p.goto("file://"+path.resolve(__dirname,"../distribution.html"));await p.waitForTimeout(500);
 const r=await p.evaluate(()=>{toast=()=>{};ME=S.users.find(u=>u.role==="admin"&&u.actif);const bn=perBornes("st","all"),L=statEtatLignes(bn),n=S.livreurs.filter(l=>!l.archive).length;
  statEtat();const h=document.querySelector("#docf").srcdoc;closeModal();
  return{n:L.length,nl:n,cols:L.every(x=>x.length===STAT_ETAT_ENT.length),h:/État des livreurs/.test(h)&&/TOTAL/.test(h)&&/Circuit direct/.test(h),btn:statCentre().includes('data-act="statEtat"')}});
 const o=r.n===r.nl&&r.nl>0&&r.cols&&r.h&&r.btn;console.log(o?"PASS":"FAIL","LE-1",JSON.stringify(r));
 const e=errs.length===0;console.log(e?"PASS":"FAIL","LE-2 aucune erreur JS",errs.join("|"));await b.close();process.exit(o&&e?0:1)})();
