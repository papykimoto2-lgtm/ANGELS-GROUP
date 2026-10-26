/* Photos des colis dans l'application livreur : vignettes dans la mission, agrandissement, lecture à la demande, cache hors ligne, nettoyage des missions terminées.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/colis-photos-livreur.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});let ok=0,ko=0;const errs=[];
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const ctx=await b.newContext({viewport:{width:400,height:850},isMobile:true});const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));
 await p.goto(base+"/livreur.html");await p.waitForTimeout(600);
 const IMG=(c)=>"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/"+c;
 await p.evaluate(()=>{window.__req=[];const mkSb=()=>({from:t=>({select:()=>({eq:(c,ref)=>({order:async()=>{__req.push(t+":"+ref);const L=(window.__DB||{})[ref];return L?{data:L,error:null}:{data:[],error:null}}})})})});sb=mkSb();window.enLigne=()=>true});
 const mission=(ref,st,n)=>({livraison_ref:ref,commande_ref:"CMD-"+ref.toUpperCase(),statut:st,maj_le:new Date().toISOString(),payload:{client_nom:"Client "+ref,adr:{zone:"Cocody",quartier:"Riviera"},lignes:[{desig:"Article",qte:2}],montant_attendu:5000,photos_colis:n}});
 const show=(M)=>p.evaluate(M=>{user={id:"u"};moi={nom:"Livreur Test",livreur_ref:"l1"};missions=M;PAGE="cours";MENU=false;STATS=null;vueMissions()},M);
 // 1. mission avec 2 photos
 await p.evaluate(({a,b})=>{window.__DB={a:[{n:1,photo:a},{n:2,photo:b}]}},{a:IMG("AAA"),b:IMG("BBB")});
 await show([mission("a","acceptee",2),mission("z","acceptee",0)]);await p.waitForTimeout(600);
 let r=await p.evaluate(()=>({thumbs:[...document.querySelectorAll(".cphi")].map(x=>x.innerText.trim()),imgs:document.querySelectorAll(".cphi img").length,req:window.__req.slice(),titre:/Colis à livrer/.test(document.body.innerText)}));
 chk("CL-1","mission avec 2 photos : « Colis à livrer », 2 vignettes « Colis 1 » et « Colis 2 », une seule lecture serveur de ses photos",r.titre&&r.imgs===2&&r.thumbs.join()==="Colis 1,Colis 2"&&r.req.join()==="pg_colis_photos:a",JSON.stringify(r));
 chk("CL-2","mission sans photo (photos_colis = 0) : aucun bloc, aucune lecture serveur",(await p.evaluate(()=>document.querySelectorAll(".cphb").length))===1&&!(await p.evaluate(()=>window.__req)).includes("pg_colis_photos:z"));
 // 2. agrandissement
 await p.click('.cphi[data-r="a|2"]');await p.waitForTimeout(200);
 const z=await p.evaluate(()=>{const o=document.querySelector(".ov");return{ouvert:!!o,img:o&&o.querySelector("img")&&o.querySelector("img").src.slice(-3),txt:o&&o.innerText}});
 chk("CL-3","toucher une photo : agrandissement du colis 2 avec consigne de comparaison",z.ouvert&&z.img==="BBB"&&/Colis 2/.test(z.txt)&&/Comparez/.test(z.txt),JSON.stringify(z));
 await p.click('.ov [data-a="fermer"]');await p.waitForTimeout(150);
 chk("CL-4","le bouton Fermer referme l'agrandissement",(await p.evaluate(()=>!document.querySelector(".ov"))));
 // 3. pas de relecture inutile, puis hors ligne avec le cache
 const n0=await p.evaluate(()=>window.__req.length);await show([mission("a","acceptee",2)]);await p.waitForTimeout(300);
 chk("CL-5","réaffichage de la liste : photos gardées, aucune nouvelle lecture serveur",(await p.evaluate(()=>window.__req.length))===n0);
 await p.evaluate(()=>{window.enLigne=()=>false});await p.reload();await p.waitForTimeout(500);
 await p.evaluate(()=>{window.enLigne=()=>false;user={id:"u"};moi={nom:"L",livreur_ref:"l1"};sb=null});
 await show([mission("a","acceptee",2)]);await p.waitForTimeout(300);
 chk("CL-6","téléphone sans réseau (après rechargement) : les photos déjà lues restent visibles depuis le cache du téléphone",(await p.evaluate(()=>document.querySelectorAll(".cphi img").length))===2);
 // 4. photos pas encore publiées puis publiées
 await p.evaluate(()=>{window.__DB={};window.__req=[];window.enLigne=()=>true;sb={from:t=>({select:()=>({eq:(c,ref)=>({order:async()=>{__req.push(ref);return{data:(window.__DB||{})[ref]||[],error:null}}})})})};CPH={}});
 await show([mission("n","acceptee",1)]);await p.waitForTimeout(400);
 const t1=await p.evaluate(()=>({txt:document.body.innerText,imgs:document.querySelectorAll(".cphi img").length}));
 await p.evaluate(img=>{window.__DB={n:[{n:1,photo:img}]};CPH.n.t=0},IMG("CCC"));await show([mission("n","acceptee",1)]);await p.waitForTimeout(500);
 const t2=await p.evaluate(()=>document.querySelectorAll(".cphi img").length);
 chk("CL-7","photos annoncées mais pas encore publiées : message d'attente, puis les vignettes apparaissent d'elles-mêmes à la relecture",/Chargement des photos des colis/.test(t1.txt)&&t1.imgs===0&&t2===1,JSON.stringify([t1.txt.slice(0,200),t2]));
 // 5. nettoyage du cache
 await p.evaluate(()=>{CPH.vieux={n:1,t:Date.now(),L:[{n:1,photo:"data:image/jpeg;base64,ZZZ"}]};cphElaguer()});
 chk("CL-8","cache : les photos des missions terminées ou retirées sont supprimées du téléphone",(await p.evaluate(()=>!("vieux" in CPH)&&"n" in CPH)));
 // 6. missions terminées : pas de bloc
 await show([mission("n","livree",1)]);await p.waitForTimeout(300);
 chk("CL-9","mission livrée : plus de photos dans la carte",(await p.evaluate(()=>document.querySelectorAll(".cphb").length))===0);
 if(process.env.SHOT){await p.evaluate(()=>{const mk=(c,t)=>{const k=document.createElement("canvas");k.width=200;k.height=200;const x=k.getContext("2d");x.fillStyle=c;x.fillRect(0,0,200,200);x.fillStyle="#fff";x.font="bold 40px sans-serif";x.fillText(t,30,115);return k.toDataURL("image/jpeg",.7)};window.__DB={a:[{n:1,photo:mk("#b86e00","Sac")},{n:2,photo:mk("#0e7490","Boîte")}]};CPH={};window.enLigne=()=>true;user={id:"u"};missions=[]});await show([mission("a","acceptee",2)]);await p.waitForTimeout(500);await p.evaluate(()=>{const e=document.querySelector(".cphb");if(e)e.scrollIntoView({block:"center"})});await p.waitForTimeout(200);await p.screenshot({path:process.env.SHOT+"/colis-photos-livreur.png"})}
 chk("CL-10","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
