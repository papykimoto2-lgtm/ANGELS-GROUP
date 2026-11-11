/* Appli livreur : encaissement du jour et recherche (statut, à faire, livrées, à reverser), Ma tournée, itinéraire conseillé automatique avec heures estimées.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/livreur-tableau.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:400,height:850},permissions:["geolocation"],geolocation:{latitude:5.30,longitude:-4.00}}),errs=[];let ok=0,ko=0;
 const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info||o));o===true?ok++:ko++};
 const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));await p.goto(base+"/livreur.html");await p.waitForTimeout(600);
 const today=new Date().toISOString();
 const mk=(ref,num,st,nom,mode,recu)=>({livraison_ref:ref,commande_ref:num,statut:st,maj_le:today,payload:{numero:num,client_nom:nom,adr:{zone:"Yopougon",quartier:"Niangon",gps:null},lignes:[{desig:"Article",qte:1}],montant_attendu:5000,recu:recu==null?null:recu,mode_recu:mode||null}});
 await p.evaluate(({M})=>{user={id:"u"};moi={nom:"Livreur Test",livreur_ref:"l1"};missions=M;STATS={maj_le:new Date().toISOString(),payload:{argent:{solde:0,produits:0,frais:0,gardes:0,rev:0,attente:0,comptes:[]},p:{mois:{livrees:56,echecs:0,taux:100,duree:0,delais:0,nnotes:0,note:0,encaisse:0,gains:0}}}};PAGE="cours";MENU=false;RECH="";vueMissions()},{M:[
  mk("a","CMD-A","en_cours","Awa Kone"),mk("b","CMD-B","acceptee","Banhiet Stephane"),
  mk("d","CMD-D","livree","Client D","Espèces",30000),mk("e","CMD-E","livree","Client E","Wave",20000),mk("f","CMD-F","livree","Client F","",7000)]});
 await p.waitForTimeout(700);
 const t=await p.evaluate(()=>document.body.innerText.replace(/\s+/g," "));
 chk("EN-1","Encaissement du jour : total 57 000, espèces 37 000 (mode vide = espèces), Mobile Money 20 000",/Encaissement du jour/.test(t)&&/57\s000 F\s*Total/.test(t)&&/37\s000 F\s*Espèces/.test(t)&&/20\s000 F\s*Mobile Money/.test(t),t.slice(0,600));
 chk("EN-2","3 livraisons aujourd'hui et 56 ce mois (statistiques du bureau)",/3 livraison\(s\) aujourd'hui · ce mois : 56/.test(t),t.slice(0,600));
 await p.fill("#rech","banhiet");await p.waitForTimeout(200);
 const r=await p.evaluate(()=>({vis:[...document.querySelectorAll(".cq")].filter(e=>e.style.display!=="none").length,n:document.querySelector("#rechv").textContent}));
 chk("EN-3","recherche par nom : une seule carte visible, compteur de résultat",r.vis===1&&/1 résultat/.test(r.n),JSON.stringify(r));
 await p.fill("#rech","cmd-a");await p.waitForTimeout(200);
 const r2=await p.evaluate(()=>[...document.querySelectorAll(".cq")].filter(e=>e.style.display!=="none").length);
 chk("EN-4","recherche par n° de commande",r2===1,String(r2));
 await p.evaluate(()=>{vueMissions()});await p.waitForTimeout(300);
 const r3=await p.evaluate(()=>({v:document.querySelector("#rech").value,vis:[...document.querySelectorAll(".cq")].filter(e=>e.style.display!=="none").length}));
 chk("EN-5","le filtre survit au rafraîchissement de la liste",r3.v==="cmd-a"&&r3.vis===1,JSON.stringify(r3));
 await p.evaluate(()=>{missions=[];vueMissions()});await p.waitForTimeout(300);
 const t3=await p.evaluate(()=>document.body.innerText);
 chk("EN-6","aucune mission : pas d'erreur ni NaN",!/undefined|NaN/.test(t3),t3.slice(0,200));
 console.log(errs.length?errs.join("\n"):"");console.log(`RÉSULTAT : ${ok} réussis, ${ko} échecs`);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
