/* Hub : priorités commerciales issues du CRM. Usage : node tests/hub-priorites.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1200,height:900}}),errs=[];let ok=0,ko=0;
 const t=(id,l,r)=>{if(r===true){ok++;console.log("PASS",id,l)}else{ko++;console.log("FAIL",id,l,"→",r)}};
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));
 await p.goto(base+"/index.html");await p.waitForTimeout(400);
 t("HP-1","sans opportunité : panneau masqué",await p.$eval("#prio",e=>e.hidden)?true:"visible");
 const t0=Date.now();
 await p.evaluate(()=>{const o=(id,nom,tel,v,et)=>({id,cle:"",nom,tel,valeur:v,source:"Portail",etape:et,t:new Date().toISOString(),maj:new Date().toISOString(),par:"x",motif:""});
  localStorage.setItem("angels_crm_v1",JSON.stringify({v:1,inter:[],taches:[],marques:[],audit:[],cfg:{},opps:[o("o1","Gros Dossier","0701020304",47000000,"negoc"),o("o2","Petit Lead","",0,"nouveau"),o("o3","Gagné","0701020305",5000,"gagne"),o("o4","Deuxième","0701020306",1000000,"devis"),o("o5","Troisième","0701020307",900000,"contact"),o("o6","Quatrième","0701020308",800000,"contact")]}))});
 await p.reload();await p.waitForTimeout(500);
 const r=await p.evaluate(()=>({vis:!document.getElementById("prio").hidden,n:document.querySelectorAll("#prio li").length,premier:(document.querySelector("#prio li b")||{}).textContent,wa:(document.querySelector("#prio li a")||{}).href,note:(document.querySelector("#prio .note")||{}).textContent,lien:(document.querySelector("#prio .ph a")||{}).getAttribute("href")}));
 t("HP-2","panneau visible, 3 lignes maximum, plus chaude en tête",r.vis&&r.n===3&&/Gros Dossier/.test(r.premier)?true:JSON.stringify(r));
 t("HP-3","lien WhatsApp valide et mention des autres opportunités ouvertes",/^https:\/\/wa\.me\/2250701020304/.test(r.wa)&&/2 autre/.test(r.note)?true:JSON.stringify(r));
 await p.goto(base+"/crm.html#pip");await p.waitForTimeout(500);
 t("HP-4","crm.html#pip ouvre l'onglet Opportunités",await p.evaluate(()=>ST.tab)==="pip"?true:"autre onglet");
 t("HP-5","aucune erreur JavaScript",!errs.length?true:errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
