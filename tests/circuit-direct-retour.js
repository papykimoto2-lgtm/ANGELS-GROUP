/* Circuit direct : colis retourné au dépôt (échec → retour → réceptionné, remis en stock).
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/circuit-direct-retour.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const path=require("path");
(async()=>{
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1100,height:1000}})).newPage(),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info===undefined?o:info));o===true?ok++:ko++};
 p.on("pageerror",e=>errs.push(e.message));p.on("dialog",d=>d.accept());
 await p.goto("file://"+path.resolve(__dirname,"../distribution.html"));await p.waitForTimeout(500);
 const r=await p.evaluate(()=>{toast=()=>{};ME=S.users.find(u=>u.role==="admin"&&u.actif);S.config.signature_seuil=99999999;
  const base=S.commandes.find(c=>c.statut==="prete")||S.commandes[0],c=JSON.parse(JSON.stringify(base));c.id="cdr_1";c.numero="CMD-CDR-1";c.statut="prete";c.date=new Date(Date.now()-5*864e5).toISOString();c.colis=null;c.hist=[{ts:new Date().toISOString(),de:"preparation",a:"prete",par:"t",note:""}];S.commandes.push(c);
  const lv=S.livreurs.filter(l=>!l.archive)[0],n0=S.retours.length,e=cenDirectExec(c,{lid:lv.id,quand:new Date(Date.now()-26*36e5).toISOString(),resultat:"retour",motif:"Client refuse le colis",obs:"Client refuse le colis"});
  const m=(()=>{cenDirectModal(c.id);const t=document.querySelector("#modal").innerHTML;closeModal();return t.includes('value="retour"')})();
  return{e,st:c.statut,ret:S.retours.length-n0,rec:S.retours.slice(-1)[0],stock:c.stock_sorti,m}});
 chk("CDR-1","retour direct : commande « retour réceptionné », retour tracé, option dans la fenêtre",r.e===""&&r.st==="retour_recu"&&r.ret===1&&r.rec.circuit==="direct"&&r.stock!==true&&r.m,JSON.stringify(r));
 chk("CDR-2","aucune erreur JS",errs.length===0,errs.join("|"));
 console.log(ok+" PASS / "+ko+" FAIL");await b.close();process.exit(ko?1:0)})();
