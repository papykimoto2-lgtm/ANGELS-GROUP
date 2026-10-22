/* CRM priorités commerciales : score, chaleur, tri, action. Usage : NODE_OPTIONS="--require $PWD/tests/demo-hook.js" node tests/crm-priorites.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1200,height:1000}}),errs=[];let ok=0,ko=0;
 const t=(id,l,r)=>{if(r===true){ok++;console.log("PASS",id,l)}else{ko++;console.log("FAIL",id,l,"→",r)}};
 const page=async u=>{const p=await ctx.newPage();p.on("pageerror",e=>errs.push(u+" : "+e.message));await p.goto(base+"/"+u);await p.waitForTimeout(500);return p};
 await (await page("distribution.html")).close();await (await page("agro.html")).close();
 const h=await page("crm.html");await h.fill("#gate [name=pwd]","Demo@Angels2026");await h.click("#gate button[type=submit]");await h.waitForTimeout(800);
 const r=await h.evaluate(()=>{const C=ANGELS_CRM,P="test";
  const a=C.creerOpp(P,{nom:"Gros Dossier",tel:"0701020304",valeur:47000000});C.deplacerOpp(P,a.id,"negoc");
  const b=C.creerOpp(P,{nom:"Petit Lead",tel:"",valeur:0});
  const c=C.creerOpp(P,{nom:"Gagné",tel:"0701020305",valeur:1000});C.deplacerOpp(P,c.id,"gagne");
  const L=C.prioritesOpps(Date.now()),vieux=C.scoreOpp({etape:"negoc",maj:new Date(Date.now()-40*864e5).toISOString(),valeur:47000000,tel:"0701020304"}),frais=C.scoreOpp({etape:"negoc",maj:new Date().toISOString(),valeur:47000000,tel:"0701020304"});
  return{n:L.length,premier:L[0].o.nom,chaleur:L[0].chaleur,action:L[0].action,lien:L[0].lien,sansTel:L[1].lien,scores:L.map(x=>x.score),vieux:vieux.score,frais:frais.score,clos:C.scoreOpp({etape:"gagne",maj:new Date().toISOString()})}});
 t("PRIO-1","opportunités closes exclues du classement",r.n===2&&r.clos===null?true:JSON.stringify(r));
 t("PRIO-2","la plus grosse affaire en négociation passe en tête, chaude",r.premier==="Gros Dossier"&&r.chaleur==="chaud"?true:r.premier+" "+r.chaleur);
 t("PRIO-3","scores bornés 0-100 et tri décroissant",r.scores.every(x=>x>=0&&x<=100)&&r.scores[0]>=r.scores[1]?true:r.scores);
 t("PRIO-4","une affaire sans nouvelles depuis 40 j perd des points",r.vieux<r.frais?true:r.vieux+" ≥ "+r.frais);
 t("PRIO-5","lien WhatsApp seulement si téléphone valide",/^https:\/\/wa\.me\/2250701020304\?text=/.test(r.lien)&&r.sansTel===""?true:r.lien+"|"+r.sansTel);
 await h.click(".tab[data-v=pip]");await h.waitForTimeout(400);
 t("PRIO-6","panneau « Priorités du jour » et pastille de score affichés",(await h.$$(".prio li")).length===2&&(await h.$$(".opp .sc")).length===2?true:"absent");
 t("PRIO-7","aucune erreur JavaScript",!errs.length?true:errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
