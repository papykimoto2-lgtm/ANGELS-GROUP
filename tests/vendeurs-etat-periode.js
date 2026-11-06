/* État périodique vendeur (choix du vendeur + période). Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" node tests/vendeurs-etat-periode.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");const path=require("path");
(async()=>{const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1200,height:900}})).newPage(),errs=[];
 p.on("pageerror",e=>errs.push(e.message));await p.goto("file://"+path.resolve(__dirname,"../distribution.html"));await p.waitForTimeout(500);
 const r=await p.evaluate(()=>{toast=()=>{};ME=S.users.find(u=>u.role==="admin"&&u.actif);const v=S.vendeurs[0];
  S.reglements.push({id:"rg_t",vendeur_id:v.id,montant:1234,mode:"Espèces",note:"Test",ts:new Date().toISOString(),par:"t"});
  vendEtatPeriodeForm(v.id);const f=document.querySelector("#modal").innerHTML,sel=/Tous les vendeurs/.test(f)&&f.includes('name="du"');closeModal();
  const j=ymd(new Date());vendEtatPeriode(v.id,j.slice(0,4)+"-01-01",j);const h=document.querySelector("#docf").srcdoc;closeModal();
  vendEtatPeriode("",j.slice(0,4)+"-01-01",j);const h2=document.querySelector("#docf").srcdoc;closeModal();
  const hors=(vendEtatPeriode(v.id,"2001-01-01","2001-01-31"),document.querySelector("#docf").srcdoc);closeModal();
  return{sel,h:/État périodique/.test(h)&&h.includes(v.nom)&&h.includes("Test")&&/Solde dû/.test(h),tous:h2.includes(v.nom),vide:/Aucune commande sur la période/.test(hors)&&!hors.includes("Test"),btn:VIEWS.vendeurs().includes("vendEtatPeriodeForm")}});
 const o=r.sel&&r.h&&r.tous&&r.vide&&r.btn;console.log(o?"PASS":"FAIL","VP-1",JSON.stringify(r));
 const e=errs.length===0;console.log(e?"PASS":"FAIL","VP-2 aucune erreur JS",errs.join("|"));await b.close();process.exit(o&&e?0:1)})();
