/* Classement du mois diffusé aux livreurs : rang, top 10, rien de sensible. Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" node tests/livreur-classement-bureau.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");const path=require("path");
(async()=>{const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1200,height:900}})).newPage(),errs=[];
 p.on("pageerror",e=>errs.push(e.message));await p.goto("file://"+path.resolve(__dirname,"../distribution.html"));await p.waitForTimeout(500);
 const r=await p.evaluate(()=>{const lvs=S.livreurs.filter(l=>!l.archive);lvs.forEach(l=>{l.ident_serveur=l.ident_serveur||"id_"+l.id});
  const now=new Date().toISOString(),n0=S.livraisons.length;
  lvs.forEach((l,i)=>{for(let k=0;k<(lvs.length-i);k++)S.livraisons.push({id:"cl_"+i+"_"+k,commande_id:"x",livreur_id:l.id,statut:"livree",fin_at:now,debut_at:now,montant_encaisse:1000})});
  const M=passStatsMissions(),mine=M.find(m=>m.livreur_ref===lvs[0].id).payload.classement,last=M.find(m=>m.livreur_ref===lvs[lvs.length-1].id).payload.classement;
  S.livraisons.length=n0;
  return{n:lvs.length,total:mine.total,rang0:mine.rang,top:mine.top.length,moi0:mine.top.filter(x=>x.moi).length,rangN:last.rang,cles:Object.keys(mine.top[0]).sort().join(","),json:JSON.stringify(mine)}});
 const ok1=r.n>=2&&r.total===r.n&&r.rang0===1&&r.top===Math.min(10,r.n)&&r.moi0===1&&r.rangN===r.n;console.log(ok1?"PASS":"FAIL","CB-1 rang calculé par nombre de livraisons du mois, top limité à 10, ligne « moi » marquée",JSON.stringify({n:r.n,total:r.total,rang0:r.rang0,top:r.top,rangN:r.rangN}));
 const ok2=r.cles==="l,moi,n,r,t"&&!/tel|montant|argent|gains/.test(r.json);console.log(ok2?"PASS":"FAIL","CB-2 seules données diffusées : rang, nom, livraisons, taux (ni argent ni téléphone)",r.cles);
 const e=errs.length===0;console.log(e?"PASS":"FAIL","CB-3 aucune erreur JS",errs.join("|"));await b.close();process.exit(ok1&&ok2&&e?0:1)})();
