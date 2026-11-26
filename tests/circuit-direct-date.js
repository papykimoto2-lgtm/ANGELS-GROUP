/* Circuit direct : date de la livraison (sans heure) et filtre de la liste par date. Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" node tests/circuit-direct-date.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");const path=require("path");
(async()=>{const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const p=await (await b.newContext({viewport:{width:1200,height:900}})).newPage(),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 p.on("pageerror",e=>errs.push(e.message));await p.goto("file://"+path.resolve(__dirname,"../distribution.html"));await p.waitForTimeout(500);
 const r=await p.evaluate(()=>{window.__T=[];toast=m=>{__T.push(m)};ME=S.users.find(u=>u.role==="admin"&&u.actif);CL.on=false;
  const base=S.commandes.find(c=>c.statut==="prete")||S.commandes[0],mk=(id,jours)=>{const c=JSON.parse(JSON.stringify(base));c.id=id;c.numero=id.toUpperCase();c.statut="prete";c.colis=null;c.hist=[];c.date=new Date(Date.now()-jours*864e5).toISOString();S.commandes.push(c);return c};
  S.commandes=S.commandes.filter(c=>!["prete","affectee","en_cours"].includes(c.statut));S.livraisons=S.livraisons.filter(l=>!isActive(l));
  const a=mk("cda",0),b=mk("cdb",3);view="livraisons";ui.cdt="rep";render();cenDirectModal();
  const vis=()=>[...document.querySelectorAll("#mf .cdrow")].filter(r=>r.style.display!=="none").map(r=>r.querySelector("b").textContent);
  const f=document.querySelector("#mf"),champ=f.quand,init=vis();
  champ.value=cxJour(new Date(Date.now()-3*864e5));champ.dispatchEvent(new Event("change"));const j3=vis();
  const cd=document.getElementById("cd_dates");cd.checked=true;cd.dispatchEvent(new Event("change"));const toutes=vis();
  return{type:champ.type,hasTime:/T\d\d:\d\d/.test(champ.value),init,j3,toutes,nb:document.getElementById("cd_nb").textContent}});
 chk("CD-D1","champ « Date de la livraison » : date seule (pas d'heure)",r.type==="date"&&!r.hasTime,JSON.stringify(r));
 chk("CD-D2","la liste est filtrée par la date choisie",r.init.length===1&&r.init[0]==="CDA"&&r.j3.length===1&&r.j3[0]==="CDB",JSON.stringify(r));
 chk("CD-D3","« Voir toutes les dates » affiche tout",r.toutes.length===2,JSON.stringify(r));
 chk("CD-D4","aucune erreur JS",errs.length===0,errs.join("|"));
 console.log("RÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();process.exit(ko?1:0)})();
