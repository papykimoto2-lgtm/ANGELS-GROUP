/* Connexion livreur : liste déroulante des livreurs de la base (fonction « livreurs-liste »), le livreur enregistré sur l'appareil en tête ;
   hors ligne : seulement celui de l'appareil. Usage : PLAYWRIGHT=/chemin/playwright node tests/livreur-combo.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http:"+"//127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});let ok=0,ko=0;const errs=[],autres=[];let liste=0;
 const t=(id,l,r)=>{if(r===true){ok++;console.log("PASS",id,l)}else{ko++;console.log("FAIL",id,l,"→",r)}};
 /* serveur : null = hors ligne ; tableau = réponse de « livreurs-liste » */
 const nv=async(seed,serveur)=>{const c=await b.newContext({viewport:{width:390,height:800},serviceWorkers:"block"});
  await c.route("**/functions/v1/**",r=>{const u=r.request().url();if(/livreurs-liste/.test(u)){liste++;if(serveur===null)return r.abort();return r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({ok:true,livreurs:serveur})})}autres.push(u);r.fulfill({status:200,body:"{}"})});
  if(seed)await c.addInitScript(s=>localStorage.setItem("ang_lv_idents",s),JSON.stringify(seed));
  const p=await c.newPage();p.on("pageerror",e=>errs.push(e.message));await p.goto(base+"/livreur.html");await p.waitForSelector("#li",{timeout:8000});await p.waitForTimeout(500);return p};
 const items=p=>p.$$eval("#lvl li",x=>x.map(e=>e.innerText.replace(/\s+/g," ").trim()));
 let p=await nv(null,null);
 t("LC-1","ni mémoire ni serveur : la flèche reste visible et la liste explique pourquoi elle est vide (aucun livreur proposé)",await p.isVisible("#lvb")&&await (async()=>{await p.click("#lvb");const l=await items(p);return l.length===1&&/indisponible/.test(l[0])&&await p.$$eval("#lvl li[data-i]",x=>x.length)===0})()?true:JSON.stringify(await items(p)));
 p=await nv([{i:"koffi.yves",n:"Koffi Yves"},{i:"traore.ali",n:"Traoré Ali"}],null);   /* ancienne mémoire à 2 entrées, serveur injoignable : seule la première est proposée */
 t("LC-2","hors ligne avec livreur enregistré : flèche visible, liste fermée",await p.isVisible("#lvb")&&await p.$eval("#lvl",e=>e.hidden)?true:"état");
 await p.click("#lvb");const li=await items(p);
 t("LC-3","hors ligne : un seul livreur, celui enregistré sur l'appareil, avec nom et identifiant",li.length===1&&/Koffi Yves .*koffi\.yves/.test(li[0])?true:JSON.stringify(li));
 await p.click("#lvl li:nth-child(1)");
 t("LC-4","choix d'un livreur : identifiant rempli, liste refermée, curseur sur le mot de passe",await p.$eval("#li",e=>e.value)==="koffi.yves"&&await p.$eval("#lvl",e=>e.hidden)&&await p.evaluate(()=>document.activeElement.id)==="lp"?true:"échec");
 await p.fill("#li","");await p.evaluate(()=>{document.activeElement.blur()});await p.focus("#li");
 t("LC-5","champ vide au focus : la liste s'ouvre d'elle-même",await p.$eval("#lvl",e=>!e.hidden)?true:"fermée");
 await p.keyboard.type("x");
 t("LC-6","saisie manuelle : la liste se referme et le champ reste libre",await p.$eval("#lvl",e=>e.hidden)&&await p.$eval("#li",e=>e.value)==="x"?true:"état");
 const mem=await p.evaluate(()=>{memoIdent("a.a","Livreur A");memoIdent("b.b","Livreur B");memoIdent("b.b","");return lsGet(LS.x,[])});
 t("LC-8","un seul livreur enregistré par appareil : le dernier connecté remplace le précédent, son nom est conservé",mem.length===1&&mem[0].i==="b.b"&&mem[0].n==="Livreur B"?true:JSON.stringify(mem));
 /* livreurs de la base */
 const base3=[{ident:"adama.k",nom:"Adama Koné"},{ident:"koffi.yves",nom:"Koffi Yves"},{ident:"traore.ali",nom:"Traoré Ali"}];
 p=await nv([{i:"traore.ali",n:"Traoré Ali"}],base3);await p.click("#lvb");const l3=await items(p);
 t("LC-9","livreurs de la base : les 3 sont proposés, le livreur enregistré sur l'appareil en tête (« déjà utilisé sur ce téléphone »)",l3.length===3&&/^Traoré Ali · déjà utilisé sur ce téléphone/.test(l3[0])&&/Adama Koné/.test(l3.join("|"))?true:JSON.stringify(l3));
 await p.click("#lvl li:nth-child(2)");
 t("LC-10","choix d'un livreur de la base : identifiant rempli, curseur sur le mot de passe",["adama.k","koffi.yves"].includes(await p.$eval("#li",e=>e.value))&&await p.evaluate(()=>document.activeElement.id)==="lp"?true:await p.$eval("#li",e=>e.value));
 p=await nv(null,base3);
 await p.click("#lvb");t("LC-11","appareil neuf, serveur joignable : les 3 livreurs de la base sont proposés",await p.isVisible("#lvl")&&(await items(p)).length===3?true:JSON.stringify(await items(p)));
 p=await nv(null,[]);
 await p.click("#lvb");const l0=await items(p);t("LC-12","liste serveur vide et appareil neuf : message « aucun livreur actif », aucun livreur proposé",l0.length===1&&/Aucun livreur actif/.test(l0[0])?true:JSON.stringify(l0));
 p=await nv(null,base3);await p.focus("#li");await p.keyboard.press("Escape");await p.click("#li");
 t("LC-13","champ déjà actif : un toucher sur le champ vide rouvre la liste (pas seulement le focus)",await p.isVisible("#lvl")?true:"fermée");
 t("LC-7","la liste est lue par « livreurs-liste » seulement : aucune autre requête, aucune erreur JavaScript",liste>0&&autres.length===0&&!errs.length?true:liste+" liste · "+autres.join(",")+" · "+errs.join("|"));
 await p.screenshot({path:"/dev/null"}).catch(()=>{});
 const q=await nv([{i:"traore.ali",n:"Traoré Ali"}],base3);await q.click("#lvb");await q.screenshot({path:process.argv[2]||"/tmp/livreur-combo.png"});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
