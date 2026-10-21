/* Espace vendeur simplifié : accueil à tuiles, barre du bas, commande en 3 étapes.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/vendeur-simple.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:390,height:800}}),p=await ctx.newPage(),errs=[];
 p.on("pageerror",e=>errs.push("PAGEERR "+e.message));p.on("dialog",d=>d.accept());
 await p.goto(base+"/distribution.html?app=vendeur");await p.waitForTimeout(300);
 await p.evaluate(()=>{window.__T=[];toast=(m,k)=>{__T.push(m)};ME=S.users.find(u=>u.role==="vendeur"&&u.actif);view="vHome";render()});
 let ok=0,ko=0;const t=async(id,label,fn)=>{let r;try{r=await p.evaluate(fn)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",r)}};
 await t("VS-1","accueil : tuiles et barre du bas, sans menu latéral",()=>{const E=[];if(!document.querySelector(".vtile.main"))E.push("tuile commande");if(document.querySelectorAll(".vbar button").length!==4)E.push("barre");if(document.querySelector("aside"))E.push("menu latéral");return E.length?E.join(";"):true});
 await t("VS-2","cibles tactiles ≥ 44 px",()=>{const bad=[...document.querySelectorAll(".vtile,.vbar button,.vtop button")].filter(e=>e.getBoundingClientRect().height<44);return bad.length?bad.length+" trop petites":true});
 await t("VS-3","navigation Colis / Argent / Accueil",()=>{const E=[];document.querySelector('.vbar [data-id=mesCmd]').click();if(view!=="mesCmd"||!document.querySelector(".vapp"))E.push("colis");document.querySelector('.vbar [data-id=mesReg]').click();if(view!=="mesReg")E.push("argent");document.querySelector('.vbar [data-id=vHome]').click();if(view!=="vHome")E.push("accueil");return E.length?E.join(";"):true});
 await t("VS-4","commande en 3 étapes : refus si adresse ou article manquant, puis dépôt",()=>{const E=[],n0=S.commandes.length,f=()=>document.getElementById("mf"),vis=()=>[...document.querySelectorAll("#mf .vstep.on")].map(e=>e.dataset.s).join();
  vCmdForm();if(vis()!=="1")E.push("étape 1 attendue");const sb=document.querySelector("#mf .mf .btn:not(.ghost)");if(sb.style.display!=="none")E.push("dépôt visible dès l'étape 1");
  document.getElementById("vnext").click();if(vis()!=="1")E.push("avance sans adresse");f().quartier.value="Cocody";document.getElementById("vnext").click();if(vis()!=="2")E.push("étape 2 refusée");
  document.getElementById("vnext").click();if(vis()!=="2")E.push("avance sans article");const r=document.querySelector(".vrow");r.querySelector(".vd").value="Robe";r.querySelector(".vp").value="5000";document.getElementById("vnext").click();if(vis()!=="3")E.push("étape 3 refusée");
  if(sb.style.display==="none")E.push("dépôt masqué à l'étape 3");f().requestSubmit();if(S.commandes.length!==n0+1)E.push("commande non créée ("+__T.slice(-1)+")");return E.length?E.join(" ; "):true});
 await t("VS-6","tuile Demandes clients et section toujours visible",()=>{ME=S.users.find(u=>u.role==="vendeur"&&u.actif);view="vHome";render();const E=[];if(!document.body.innerText.includes("Demandes clients"))E.push("tuile");view="mesCmd";render();if(!document.body.innerText.includes("Demandes reçues de vos clients"))E.push("section");return E.length?E.join(";"):true});
 await t("VS-5","un autre rôle garde le gabarit complet",()=>{ME=S.users.find(u=>u.role==="admin"&&u.actif);view="commandes";render();return document.querySelector("aside")&&!document.querySelector(".vapp")?true:"gabarit"});
 console.log(errs.length?errs.join("\n"):"");console.log(`RÉSULTAT : ${ok} réussis, ${ko} échecs`);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
