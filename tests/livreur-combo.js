/* Connexion livreur : liste déroulante limitée au livreur enregistré sur cet appareil (le dernier connecté ; aucune liste de livreurs n'est demandée au serveur).
   Usage : PLAYWRIGHT=/chemin/playwright node tests/livreur-combo.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});let ok=0,ko=0;const errs=[];
 const t=(id,l,r)=>{if(r===true){ok++;console.log("PASS",id,l)}else{ko++;console.log("FAIL",id,l,"→",r)}};
 let reseau=0;
 const nv=async(seed)=>{const c=await b.newContext({viewport:{width:390,height:800},serviceWorkers:"block"});await c.route("**/functions/v1/**",r=>{reseau++;r.fulfill({status:200,body:"{}"})});if(seed)await c.addInitScript(s=>localStorage.setItem("ang_lv_idents",s),JSON.stringify(seed));const p=await c.newPage();p.on("pageerror",e=>errs.push(e.message));await p.goto(base+"/livreur.html");await p.waitForSelector("#li",{timeout:8000});return p};
 let p=await nv(null);
 t("LC-1","aucun identifiant mémorisé : pas de flèche, aucune liste",await p.$eval("#lvb",e=>e.hidden)===true&&await p.$eval("#lvl",e=>e.hidden)===true?true:"visible");
 p=await nv([{i:"koffi.yves",n:"Koffi Yves"},{i:"traore.ali",n:"Traoré Ali"}]);   /* ancienne mémoire à 2 entrées : seule la première est proposée */
 t("LC-2","identifiants mémorisés : flèche visible, liste fermée",await p.$eval("#lvb",e=>!e.hidden)&&await p.$eval("#lvl",e=>e.hidden)?true:"état");
 await p.click("#lvb");
 const li=await p.$$eval("#lvl li",x=>x.map(e=>e.innerText.replace(/\s+/g," ").trim()));
 t("LC-3","clic sur la flèche : un seul livreur (l'enregistré) avec nom et identifiant",li.length===1&&/Koffi Yves koffi\.yves/.test(li[0])?true:JSON.stringify(li));
 await p.click("#lvl li:nth-child(1)");
 t("LC-4","choix d'un livreur : identifiant rempli, liste refermée, curseur sur le mot de passe",await p.$eval("#li",e=>e.value)==="koffi.yves"&&await p.$eval("#lvl",e=>e.hidden)&&await p.evaluate(()=>document.activeElement.id)==="lp"?true:"échec");
 await p.fill("#li","");await p.evaluate(()=>{document.activeElement.blur()});await p.focus("#li");
 t("LC-5","champ vide au focus : la liste s'ouvre d'elle-même",await p.$eval("#lvl",e=>!e.hidden)?true:"fermée");
 await p.keyboard.type("x");
 t("LC-6","saisie manuelle : la liste se referme et le champ reste libre",await p.$eval("#lvl",e=>e.hidden)&&await p.$eval("#li",e=>e.value)==="x"?true:"état");
 const mem=await p.evaluate(()=>{memoIdent("a.a","Livreur A");memoIdent("b.b","Livreur B");memoIdent("b.b","");return lsGet(LS.x,[])});
 t("LC-8","un seul livreur enregistré par appareil : le dernier connecté remplace le précédent, son nom est conservé",mem.length===1&&mem[0].i==="b.b"&&mem[0].n==="Livreur B"?true:JSON.stringify(mem));
 t("LC-7","aucune requête serveur pour remplir la liste ; aucune erreur JavaScript",reseau===0&&!errs.length?true:reseau+" requête(s) · "+errs.join("|"));
 await p.fill("#li","");await p.click("#lvb");await p.screenshot({path:process.argv[2]||"/tmp/livreur-combo.png"});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
