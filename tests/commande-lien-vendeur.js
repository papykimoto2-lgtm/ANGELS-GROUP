/* Lien de commande du vendeur partenaire : la commande du client (page publique du portail) arrive en envoi direct dans l'espace du vendeur (demande « nouvelle »), sans dépendre de WhatsApp.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/commande-lien-vendeur.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:1000}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 /* bureau : un vendeur partenaire avec son lien (l'identifiant du vendeur est dans le lien) */
 const D=await ctx.newPage();D.on("pageerror",e=>errs.push("D:"+e.message));D.on("dialog",d=>d.accept());await D.goto(base+"/distribution.html");await D.waitForTimeout(600);
 const info=await D.evaluate(async()=>{ME=S.users.find(u=>u.role==="vendeur");const v=vend();v.tel=v.tel||"0708080808";await cmdLien(false);await new Promise(r=>setTimeout(r,200));const link=[...document.querySelectorAll("input[readonly]")].map(i=>i.value).find(x=>/commander\//.test(x));return{link,id:v.id,nom:v.nom,tel:v.tel}});
 const tok=(info.link||"").split("#/commander/")[1]||"",pay=tok?JSON.parse(Buffer.from(tok.replace(/-/g,"+").replace(/_/g,"/"),"base64").toString("utf8")):{};
 chk("CLV-1","le lien de commande du vendeur contient l'identifiant du vendeur",pay.i===info.id&&pay.v===info.nom,JSON.stringify(pay));
 /* client : page publique du portail */
 let posted=null;
 await ctx.route("**/functions/v1/portail-demande",async rt=>{const rq=rt.request();posted=JSON.parse(rq.postData()||"{}");rt.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({ok:true,refs:["X"],doublons:0})})});
 const P=await ctx.newPage();P.on("pageerror",e=>errs.push("P:"+e.message));await P.addInitScript(()=>{window.ANGELS_PASSERELLE={url:"https://demo.supabase.co",key:"x"}});
 await P.goto(base+"/portail.html#/commander/"+tok);await P.waitForTimeout(900);
 await P.fill(".c_d","Sac à main noir");await P.fill(".c_q","2");await P.fill(".c_p","15000");await P.fill("#c_nom","Awa Client");await P.fill("#c_tel","0701020304");
 await P.selectOption("#c_zone",{index:1});await P.fill("#c_q","Riviera");await P.fill("#c_rep","Pharmacie");await P.click("#c_send");await P.waitForTimeout(500);
 const direct=await P.locator("[data-direct]").count();
 chk("CLV-2","après « Envoyer ma commande », le bouton « Envoyer directement » est proposé (WhatsApp reste disponible)",direct===1&&await P.locator("a.go[href*='wa.me']").count()>=1);
 await P.click("[data-direct]");await P.waitForTimeout(500);
 const m=/\[BOUTIQUE:([A-Za-z0-9_-]+)\]/.exec((posted||{}).message||""),dp=m?JSON.parse(Buffer.from(m[1].replace(/-/g,"+").replace(/_/g,"/"),"base64").toString("utf8")):null;
 chk("CLV-3","envoi direct au serveur : message avec marqueur et vendeur (identifiant, téléphone, nom), client, adresse et articles",!!dp&&dp.v===info.id&&!!dp.vt&&dp.vn===info.nom&&dp.n==="Awa Client"&&dp.l[0][0]==="Sac à main noir"&&dp.l[0][1]===2&&dp.l[0][2]===15000&&(posted.message||"").length<=6000,JSON.stringify(dp));
 chk("CLV-4","le client voit la confirmation d'envoi",/Demande envoyée/.test(await P.innerText("#cm")),(await P.innerText("#cm")).slice(0,200));
 /* bureau : relève du message → demande dans l'espace du vendeur */
 const r=await D.evaluate(async({msg,vid})=>{S.demandes=[];const v=S.vendeurs.find(x=>x.id===vid);const o={};
  o.r1=webImporter(msg);o.n1=S.demandes.length;o.dem=S.demandes[0]&&{vend:S.demandes[0].vendeur_id,statut:S.demandes[0].statut,nom:S.demandes[0].nom,l:S.demandes[0].lignes.length,pu:S.demandes[0].lignes[0].pu};
  o.vue=demandesOf(v).length;ME=S.users.find(u=>u.id===v.user_id);o.espace=/Demandes reçues de vos clients \(1\)/.test(demandesSection(v));
  o.r2=webImporter(msg);o.n2=S.demandes.length;
  const sansId=msg.replace(/\[BOUTIQUE:([A-Za-z0-9_-]+)\]/,(a,x)=>{const d=unb64(x);d.f="ZZ9999";d.v="";return"[BOUTIQUE:"+b64(d)+"]"});o.r3=webImporter(sansId);o.n3=S.demandes.length;o.v3=S.demandes[1]&&S.demandes[1].vendeur_id===vid;
  const inconnu=msg.replace(/\[BOUTIQUE:([A-Za-z0-9_-]+)\]/,(a,x)=>{const d=unb64(x);d.f="YY8888";d.v="nexistepas";d.vt="0000000000";d.vn="Inconnu";return"[BOUTIQUE:"+b64(d)+"]"});o.r4=webImporter(inconnu);o.n4=S.demandes.length;
  return o},{msg:posted.message,vid:info.id});
 chk("CLV-5","import au bureau : la commande devient une demande « nouvelle » rattachée au vendeur, visible dans son espace (« Demandes reçues de vos clients »)",r.r1.ok.length===1&&r.n1===1&&r.dem.vend===info.id&&r.dem.statut==="nouvelle"&&r.dem.l===1&&r.dem.pu===15000&&r.vue===1&&r.espace===true,JSON.stringify(r));
 chk("CLV-6","jamais importée deux fois (même référence) ; ancien lien sans identifiant : vendeur retrouvé par téléphone ; vendeur introuvable : refusée avec un motif",r.r2.ok.length===0&&r.r2.ko.length===1&&r.n2===1&&r.r3.ok.length===1&&r.n3===2&&r.v3===true&&r.r4.ok.length===0&&/vendeur introuvable/.test(r.r4.ko[0])&&r.n4===2,JSON.stringify([r.r2,r.r3,r.r4]));
 chk("CLV-7","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
