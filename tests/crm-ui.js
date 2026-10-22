/* CRM interface vivante : recherche rapide, vues, glisser-déposer, mobile.
   Usage : NODE_OPTIONS="--require $PWD/tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/crm-ui.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1200,height:1000}}),errs=[];let ok=0,ko=0;
 const t=(id,l,r)=>{if(r===true){ok++;console.log("PASS",id,l)}else{ko++;console.log("FAIL",id,l,"→",r)}};
 const page=async u=>{const p=await ctx.newPage();p.on("pageerror",e=>errs.push(u+" : "+e.message));p.on("dialog",d=>d.accept("Prix trop élevé"));await p.goto(base+"/"+u);await p.waitForTimeout(500);return p};
 const pd=await page("distribution.html"),pa=await page("agro.html");await pd.close();await pa.close();
 const h=await page("crm.html");
 await h.fill("#gate [name=pwd]","Demo@Angels2026");await h.click("#gate button[type=submit]");await h.waitForTimeout(800);
 // 1. série
 const se=await h.evaluate(()=>ANGELS_CRM.serie(ANGELS_CRM.contacts()));
 t("UI-1","série : 12 mois, nombres finis",se.length===12&&se.every(x=>isFinite(x.ca)&&isFinite(x.nouveaux)&&x.m)?true:JSON.stringify(se));
 t("UI-2","accueil : graphique et indicateurs animés présents",(await h.$("svg"))&&(await h.$$(".kpi")).length>=4?true:"absent");
 // 2. recherche rapide
 await h.keyboard.press("/");t("UI-3","touche « / » : focus sur la recherche",await h.evaluate(()=>document.activeElement.id==="gs")?true:"pas de focus");
 await h.keyboard.type("grossiste");await h.waitForTimeout(300);
 t("UI-4","recherche rapide : suggestions affichées",(await h.$$("#gsr button[data-a=fiche]")).length>=1?true:"aucune");
 await h.click("#gsr button[data-a=fiche]");await h.waitForTimeout(300);
 t("UI-5","clic suggestion : fiche ouverte, liste fermée",(await h.$(".fiche, #app .pan"))&&await h.$eval("#gsr",e=>e.hidden)?true:"échec");
 await h.fill("#gs","<img src=x onerror=window.__x=1>");await h.waitForTimeout(200);
 t("UI-6","saisie malveillante : aucun script",!(await h.evaluate(()=>window.__x))?true:"XSS");
 await h.fill("#gs","");await h.keyboard.press("Escape");
 // 3. vues
 await h.click(".tab[data-v=con]");await h.waitForTimeout(300);
 const nbC=(await h.$$(".cl")).length;await h.click("[data-a=vue][data-v=liste]");await h.waitForTimeout(300);
 t("UI-7","bascule cartes/liste : mêmes contacts",nbC>0&&(await h.$$(".cl")).length===nbC?true:nbC+" vs "+(await h.$$(".cl")).length);
 // 4. glisser-déposer
 await h.evaluate(()=>ANGELS_CRM.creerOpp(SESS.nom||"t",{nom:"Test Drag",valeur:50000}));
 await h.click(".tab[data-v=pip]");await h.waitForTimeout(300);
 const cols=await h.$$eval(".col[data-et]",c=>c.map(x=>x.dataset.et));
 t("UI-8","pipeline : colonnes par étape",cols.length>=4&&cols.includes("gagne")&&cols.includes("perdu")?true:cols.join());
 const dt=await h.evaluateHandle(()=>new DataTransfer());
 await h.dispatchEvent(".opp[data-id]","dragstart",{dataTransfer:dt});
 await h.dispatchEvent(".col[data-et=gagne]","dragover",{dataTransfer:dt});
 await h.dispatchEvent(".col[data-et=gagne]","drop",{dataTransfer:dt});await h.waitForTimeout(400);
 t("UI-9","glisser vers « gagné » : étape changée + notification",await h.evaluate(()=>ANGELS_CRM.etat().opps.some(o=>o.etape==="gagne"))&&await h.$eval("#toast",e=>e.classList.contains("on"))?true:"non déplacée");
 await h.evaluate(()=>ANGELS_CRM.creerOpp("t",{nom:"Test Perdu",valeur:1000}));await h.reload();await h.waitForTimeout(500);
 const id2=await h.evaluate(()=>ANGELS_CRM.etat().opps.find(o=>o.nom==="Test Perdu").id);
 await h.evaluate(id=>deplacer(id,"perdu"),id2);await h.waitForTimeout(300);
 t("UI-10","« perdu » : motif demandé et enregistré",await h.evaluate(()=>{const o=ANGELS_CRM.etat().opps.find(o=>o.nom==="Test Perdu");return o.etape==="perdu"&&/Prix/.test(o.motif||"")})?true:"motif absent");
 // 5. mobile
 const m=await ctx.newPage();await m.setViewportSize({width:390,height:800});await m.goto(base+"/crm.html");await m.waitForTimeout(600);
 t("UI-11","mobile : pas de défilement horizontal",await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)?true:"débordement");
 t("UI-12","aucune erreur JavaScript",errs.length===0?true:errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
