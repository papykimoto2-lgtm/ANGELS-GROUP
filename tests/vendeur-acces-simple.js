/* Accès vendeur simplifié (1000 partenaires) : lien d'accès prérempli, mot de passe oublié par WhatsApp, politique de mot de passe allégée, création en masse.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/vendeur-acces-simple.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});r.end(fs.readFileSync(f))});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 /* 1. lien d'accès : identifiant + code préremplis, paramètres retirés de l'adresse */
 const ctx=await b.newContext({viewport:{width:400,height:800}});const p=await ctx.newPage();
 await p.goto(base+"/vendeur.html?id=0701020304&c=482913&w=2250779181075");await p.waitForTimeout(1200);
 const a=await p.evaluate(()=>({li:document.getElementById("li").value,lp:document.getElementById("lp").value,url:location.search,w:localStorage.getItem("ang_vd_w")||JSON.stringify(Object.entries(localStorage))}));
 chk("VA-1","le lien d'accès préremplit l'identifiant et le code ; ils disparaissent de l'adresse (pas d'historique ni de partage)",a.li==="0701020304"&&a.lp==="482913"&&a.url==="",JSON.stringify(a));
 /* 2. mot de passe oublié : WhatsApp vers l'agence */
 const f=await p.evaluate(()=>{document.getElementById("lo").click();const x=document.querySelector("#lo_box a.btn");return{href:x?decodeURIComponent(x.href):"",txt:document.getElementById("lo_box").textContent}});
 chk("VA-2","« Mot de passe oublié » : un bouton WhatsApp vers l'agence demande un nouveau code, avec l'identifiant",/^https:\/\/wa\.me\/2250779181075\?text=/.test(f.href)&&f.href.includes("0701020304")&&/nouveau code/.test(f.txt),JSON.stringify(f));
 const p2=await (await b.newContext({viewport:{width:400,height:800}})).newPage();await p2.goto(base+"/vendeur.html");await p2.waitForTimeout(900);
 const g=await p2.evaluate(()=>{document.getElementById("lo").click();return{wa:!!document.querySelector("#lo_box a.btn"),txt:document.getElementById("lo_box").textContent}});
 chk("VA-3","sans lien d'accès préalable : consigne claire (écrire au centre en donnant son numéro), sans bouton cassé",!g.wa&&/numéro de téléphone/.test(g.txt),JSON.stringify(g));
 /* 3. politique de mot de passe allégée */
 const m=await p2.evaluate(()=>["abc","aaaaaa","111111","123456","monpass","ab12cd"].map(mdpValide));
 chk("VA-4","mot de passe simple à retenir : 6 caractères minimum, pas de répétition (123456 et monpass acceptés ; aaaaaa et trop court refusés)",JSON.stringify(m)==="[false,false,false,true,true,true]",JSON.stringify(m));
 /* 4. création en masse côté bureau */
 const ctx2=await b.newContext({viewport:{width:1300,height:1000}});const calls=[];let n=0;
 await ctx2.route("**/functions/v1/mission-sync",async rt=>{const rq=rt.request(),q=JSON.parse(rq.postData()||"{}"),h={"access-control-allow-origin":"*","access-control-allow-headers":"*"};if(rq.method()==="OPTIONS")return rt.fulfill({status:204,headers:h});
  calls.push(q);const body=q.action==="vendeur-compte-creer"?{ok:true,ident:q.ident,mdp:String(100000+(++n))}:{ok:true};rt.fulfill({status:200,headers:h,contentType:"application/json",body:JSON.stringify(body)})});
 const q=await ctx2.newPage();q.on("dialog",d=>d.accept());await q.goto(base+"/distribution.html");await q.waitForTimeout(800);
 const r=await q.evaluate(async()=>{ME=S.users.find(u=>u.role==="admin");S.config.appel_pont={url:"https://x.supabase.co/functions/v1",cle_admin:"k"};S.config.passerelle_actif=true;
  for(let i=0;i<7;i++){const id=uid();S.vendeurs.push({id,nom:"Vendeur "+i,tel:"07 00 00 00 0"+i,actif:true})}
  const avant=vendSansAcces().length;await vendAccesTous();await new Promise(r=>setTimeout(r,1500));
  const res=_vendAccesRes;return{avant,fait:res.filter(x=>!x.err).length,idents:res.map(x=>x.ident).sort().join(","),apres:vendSansAcces().length,msg:(res[0]||{}).msg||"",modal:(document.getElementById("modal")||{}).textContent||""}});
 chk("VA-5","création en masse : tous les vendeurs sans accès reçoivent un compte (identifiant = téléphone) en un clic",r.avant>=7&&r.fait===r.avant&&r.apres===0&&/^0700000000,/.test(r.idents),JSON.stringify([r.avant,r.fait,r.apres,r.idents]));
 chk("VA-6","chaque vendeur reçoit un message WhatsApp complet (identifiant, code, lien) ; la liste est exportable en CSV",/Votre identifiant : 07\d+/.test(r.msg)&&/Votre code d.accès/.test(r.msg)&&/vendeur\.html\?id=/.test(r.msg)&&/CSV/.test(r.modal),r.msg.slice(0,300));
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
