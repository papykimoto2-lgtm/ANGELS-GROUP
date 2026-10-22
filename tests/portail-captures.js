/* Captures d'écran du client sur le portail (ventes live) : compression et envoi (portail), contrôles et stockage (serveur), relève bureau/vendeur, suppression à l'acquittement.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/portail-captures.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
const b64=o=>Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
(async()=>{
 const P=await import("../supabase/functions/_shared/portail-demandes.js");
 const D={rows:[],ph:{},n:0};
 const db={compterRecentes:async()=>0,enAttente:async()=>0,existe:async ref=>D.rows.some(r=>r.ref===ref),inserer:async row=>{D.rows.push(Object.assign({id:++D.n,traite:false},row))},
  insererPhotos:async(ref,L)=>{D.ph[ref]=L.slice()},
  photosDe:async(ref,v)=>{const d=D.rows.find(r=>r.ref===ref&&!r.traite);if(!d)return[];if(v?d.vendeur!==v:(d.vendeur&&d.vendeur==="V1"))return[];return D.ph[ref]||[]},
  enAttenteListe:async()=>D.rows.filter(r=>!r.traite).map(r=>({id:r.id,ref:r.ref,nb_photos:r.nb_photos})),acquitter:async ids=>{D.rows.forEach(r=>{if(ids.includes(r.id)){r.traite=true;delete D.ph[r.ref]}})},
  empreinteVendeur:async()=>null};
 const cfg={adminKey:"ADM",sel:"s",limiteHeure:50,fileMax:50};
 const jpg=n=>"data:image/jpeg;base64,"+"A".repeat(n);
 const msg=(ref,v)=>"Commande\n[BOUTIQUE:"+b64({f:ref,n:"Awa",t:"0701020304",v:v||"",l:[["Sac",1,null]]})+"]";
 let r=await P.recevoir(db,cfg,{message:msg("CAP001"),photos:[jpg(1000),jpg(2000)]},"1.1.1.1");
 chk("CAP-1","commande avec 2 captures : acceptée, captures stockées, nombre noté sur la demande",r.status===200&&D.rows[0].nb_photos===2&&D.ph.CAP001.length===2,JSON.stringify(r));
 const bad=async(req,code,l)=>{const x=await P.recevoir(db,cfg,req,"2.2.2.2");return x.status===code?null:l+" → "+x.status};
 const E=[await bad({message:msg("CAP002"),photos:Array(6).fill(jpg(100))},400,"6 captures"),await bad({message:msg("CAP003"),photos:["data:image/png;base64,AAAA"]},400,"png"),await bad({message:msg("CAP004"),photos:[jpg(150001)]},400,"trop lourde"),
  await bad({message:msg("CAP005"),photos:["javascript:alert(1)"]},400,"script"),await bad({message:msg("CAP006"),photos:"x"},400,"non tableau"),await bad({message:msg("CAP007"),photos:[jpg(149000),jpg(149000),jpg(149000),jpg(149000),jpg(149000)]},413,"volume total"),
  await bad({message:msg("CAP008")+msg("CAP009"),photos:[jpg(100)]},400,"deux demandes")].filter(Boolean);
 chk("CAP-2","refus : plus de 5 captures, non JPEG, trop lourde, injection, format invalide, volume total > 600 Ko, plusieurs demandes ; rien n'est stocké",E.length===0&&D.rows.length===1&&!D.ph.CAP002,E.join(" ; "));
 r=await P.recevoir(db,cfg,{message:msg("CAP010")},"3.3.3.3");chk("CAP-3","commande sans capture : inchangée (nb_photos = 0)",r.status===200&&D.rows[1].nb_photos===0,JSON.stringify(r));
 let x=await P.traiterBureau(db,cfg,{action:"photos",ref:"cap001"},"ADM"),y=await P.traiterBureau(db,cfg,{action:"photos",ref:"CAP001"},"mauvaise");
 chk("CAP-4","bureau : lit les captures d'une demande avec la clé d'administration (référence normalisée) ; clé invalide : refusé",x.body.photos.length===2&&y.status===401&&!JSON.stringify(y.body).includes("AAAA"),JSON.stringify([x.status,y.status]));
 await P.recevoir(db,cfg,{message:msg("CAP011","V1"),photos:[jpg(500)]},"4.4.4.4");
 const bz=await P.traiterBureau(db,cfg,{action:"photos",ref:"CAP011"},"ADM");
 chk("CAP-5","bureau : ne lit pas les captures d'une demande réservée à un vendeur qui a une clé de relève",bz.body.photos.length===0,JSON.stringify(bz.body).slice(0,100));
 await P.traiterBureau(db,cfg,{action:"acquitter",ids:[1]},"ADM");const ap=await P.traiterBureau(db,cfg,{action:"photos",ref:"CAP001"},"ADM");
 chk("CAP-6","acquittement : les captures sont supprimées",ap.body.photos.length===0&&!D.ph.CAP001);
 const mig=fs.readFileSync(path.join(root,"supabase/migrations/013_portail_photos.sql"),"utf8"),adp=fs.readFileSync(path.join(root,"supabase/functions/_shared/serveur-portail.js"),"utf8");
 chk("CAP-7","base : table protégée (RLS, aucun droit anon/authenticated, aucune politique), JPEG et taille bornés, suppression à l'acquittement et purge à 30 jours",/enable row level security/.test(mig)&&/revoke all on public\.pd_photos from anon, authenticated/.test(mig)&&!/create policy/i.test(mig)&&/length\(data\) <= 150000/.test(mig)&&/interval '30 days'/.test(mig)&&/delete\(\)\.in\("demande_ref"/.test(adp));
 /* ---------- Portail (navigateur) ---------- */
 await new Promise(o=>srv.listen(0,"127.0.0.1",o));const base="http://127.0.0.1:"+srv.address().port;
 const br=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await br.newContext({viewport:{width:420,height:1000}}),errs=[];let posted=null;
 await ctx.route("**/functions/v1/portail-demande",async rt=>{posted=JSON.parse(rt.request().postData()||"{}");rt.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({ok:true,refs:["X"],doublons:0})})});
 const pg=await ctx.newPage();pg.on("pageerror",e=>errs.push(e.message));await pg.addInitScript(()=>{window.ANGELS_PASSERELLE={url:"https://demo.supabase.co",key:"x"}});
 await pg.goto(base+"/portail.html?boutique=Yoyoo+Boutique&tel=0585656086&ref=V1");await pg.waitForTimeout(800);
 await pg.fill(".c_d","Robe rouge");await pg.fill("#c_nom","Awa");await pg.fill("#c_tel","0701020304");
 /* grande image bruitée (compression nécessaire) */
 const big=await pg.evaluate(()=>{const c=document.createElement("canvas");c.width=2400;c.height=1800;const x=c.getContext("2d");for(let i=0;i<4000;i++){x.fillStyle="hsl("+(i*7%360)+",80%,50%)";x.fillRect(Math.random()*2400,Math.random()*1800,60,60)}return c.toDataURL("image/png").split(",")[1]});
 const f={name:"capture.png",mimeType:"image/png",buffer:Buffer.from(big,"base64")};
 await pg.setInputFiles("#cap_in",[f,f]);await pg.waitForTimeout(1500);
 const n1=await pg.locator("#cap_l img").count(),vals=await pg.evaluate(()=>({nom:document.getElementById("c_nom").value,art:document.querySelector(".c_d").value,len:ST.cphotos.map(x=>x.length),jpeg:ST.cphotos.every(x=>x.startsWith("data:image/jpeg;base64,"))}));
 chk("CAP-8","portail : 2 captures ajoutées, réduites en JPEG ≤ 150 Ko, aperçus affichés, saisie conservée",n1===2&&vals.jpeg&&vals.len.every(l=>l<=150000)&&vals.nom==="Awa"&&vals.art==="Robe rouge",JSON.stringify([n1,vals]));
 await pg.click("[data-capdel='0']");await pg.waitForTimeout(300);const n2=await pg.locator("#cap_l img").count();
 chk("CAP-9","portail : une capture peut être retirée",n2===1&&await pg.locator("#cap_in").count()===1);
 await pg.setInputFiles("#cap_in",[{name:"x.txt",mimeType:"text/plain",buffer:Buffer.from("hello")}]);await pg.waitForTimeout(400);
 chk("CAP-10","portail : un fichier qui n'est pas une image est refusé avec un message",/pas une image/.test(await pg.innerText("#cap_er"))&&await pg.locator("#cap_l img").count()===1);
 await pg.selectOption("#c_zone",{index:1});await pg.fill("#c_q","Riviera");await pg.click("#c_send");await pg.waitForTimeout(400);await pg.click("[data-direct]");await pg.waitForTimeout(600);
 chk("CAP-11","envoi direct : les captures partent avec la commande, la confirmation s'affiche, les captures sont vidées",!!posted&&Array.isArray(posted.photos)&&posted.photos.length===1&&/\[BOUTIQUE:/.test(posted.message)&&/Demande envoyée/.test(await pg.innerText("#cm"))&&(await pg.evaluate(()=>ST.cphotos.length))===0,JSON.stringify(Object.keys(posted||{})));
 /* bureau : relève → captures rattachées à la demande importée */
 const dp=await ctx.newPage();dp.on("pageerror",e=>errs.push("D:"+e.message));await dp.goto(base+"/distribution.html");await dp.waitForTimeout(600);
 const rel=await dp.evaluate(async({m,j})=>{S.demandes=[];const x=webImporter(m);await demandePhotos(async b=>({ok:true,photos:[j,"data:image/png;base64,AAAA","javascript:1"]}),{ref:"CAP100",nb_photos:3});const d=S.demandes[0];return{ok:x.ok.length,ph:d&&d.photos.length,card:/photoZoomD/.test(demandeCard(d))}},{m:msg("CAP100",(await dp.evaluate(()=>S.vendeurs[0].id))),j:jpg(300)});
 chk("CAP-13","bureau : les captures lues sur le serveur sont rattachées à la demande (JPEG seulement) et visibles sur sa fiche",rel.ok===1&&rel.ph===1&&rel.card===true,JSON.stringify(rel));
 chk("CAP-12","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await br.close();srv.close();process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
