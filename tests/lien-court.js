/* Lien de commande court et rassurant : plus de bloc codé, texte « lien officiel », aperçu WhatsApp (Open Graph), anciens liens toujours valides.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/lien-court.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":f.endsWith(".html")?"text/html; charset=utf-8":f.endsWith(".js")?"application/javascript":"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:420,height:900}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push("D:"+e.message));D.on("dialog",d=>d.accept());await D.goto(base+"/distribution.html");await D.waitForTimeout(700);
 const d=await D.evaluate(async()=>{ME=S.users.find(u=>u.role==="admin");const o={};const c=S.clients[0];c.tel=c.tel||"0102030405";
  cliLienModal(c);let h=document.getElementById("modal").innerHTML;const val=[...document.querySelectorAll("#modal input[readonly]")].map(i=>i.value)[0]||"",wa=(h.match(/href="(https:\/\/wa\.me\/[^"]+)"/)||[])[1]||"";
  o.cli=val;o.cliCourt=val.length<150&&/\/commander\?client=/.test(val)&&!/eyJ/.test(val);o.cliMsg=decodeURIComponent(wa.split("text=")[1]||"").includes("Lien officiel");
  closeModal();
  const l=lienCourtCommande({boutique:"Yoyoo Boutique",tel:"0585656086",ref:"vd_x1"});o.lien=l;o.fmt=/^https?:\/\/[^/]+\/commander\?boutique=Yoyoo\+Boutique&tel=0585656086&ref=vd_x1$/.test(l);
  return o});
 chk("LC-1","lien client : court, lisible (…/commander?client=…), sans bloc codé ; message avec la mention « Lien officiel »",d.cliCourt&&d.cliMsg,JSON.stringify(d));
 chk("LC-2","format du lien vendeur : boutique, téléphone, référence (espaces en +)",d.fmt,d.lien);
 const P=await ctx.newPage();P.on("pageerror",e=>errs.push("P:"+e.message));await P.addInitScript(()=>{window.ANGELS_PASSERELLE={url:"https://demo.supabase.co",key:"x"}});
 await P.goto(base+"/portail.html?boutique=Yoyoo+Boutique&tel=0585656086&ref=vd_x1");await P.waitForTimeout(800);
 const t1=await P.innerText("body");
 chk("LC-3","page de commande : « Commander chez Yoyoo Boutique », mention de lien officiel et d'absence de paiement, URL propre",/Commander chez Yoyoo Boutique/.test(t1)&&/Lien officiel/.test(t1)&&/aucun paiement/.test(t1)&&/\?boutique=Yoyoo\+Boutique/.test(P.url())&&!/eyJ/.test(P.url()),P.url());
 chk("LC-4","zone : liste des zones par défaut quand le lien n'en contient pas et que le bureau n'a rien publié",await P.locator("select#c_zone option").count()>10&&(await P.locator("select#c_zone").innerText()).includes("Cocody"));
 await P.goto(base+"/portail.html?client=Marie+Kone&tel=0102030405&zone=Cocody&quartier=Angre");await P.waitForTimeout(800);
 chk("LC-5","lien client : ouvre la boutique avec le client reconnu, sans erreur",/#\/boutique/.test(P.url())&&(await P.innerText("body")).length>200,P.url());
 const tok=Buffer.from(JSON.stringify({o:"ANGEL'S GROUP",w:"0585656086",v:"Ancienne Boutique",t:"0585656086",i:"vd_old",z:["Cocody","Abobo"]})).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
 await P.goto(base+"/portail.html#/commander/"+tok);await P.waitForTimeout(800);
 chk("LC-6","ancien lien codé (#/commander/…) toujours valide",/Commander chez Ancienne Boutique/.test(await P.innerText("body"))&&await P.locator("select#c_zone").count()===1);
 const html=fs.readFileSync(path.join(root,"portail.html"),"utf8"),vj=JSON.parse(fs.readFileSync(path.join(root,"vercel.json"),"utf8"));
 chk("LC-7","aperçu WhatsApp (Open Graph : titre, description, logo en adresse absolue) et réécriture /commander",/og:title" content="Commander en ligne/.test(html)&&/og:image" content="https:\/\/[^"]+\.png"/.test(html)&&vj.rewrites.some(r=>r.source==="/commander"&&r.destination==="/portail.html"));
 chk("LC-8","aucune erreur JS",errs.length===0,errs.join("|"));
 console.log("RÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0)})();
