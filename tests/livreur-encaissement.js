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
 await p.evaluate(({M})=>{user={id:"u"};moi={nom:"Livreur Test",livreur_ref:"l1"};missions=M;STATS={maj_le:new Date().toISOString(),payload:{argent:{solde:0,produits:0,frais:0,gardes:0,rev:0,attente:0,comptes:[]},p:{mois:{livrees:56,echecs:0,taux:100,duree:0,delais:0,nnotes:0,note:0,encaisse:0,gains:0}}}};PAGE="cours";MENU=false;RECH="";VUEL="liste";FILT="toutes";ONE_REF=null;localStorage.removeItem("ang_lv_marq");vueMissions()},{M:[
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

 await p.fill("#rech","");await p.waitForTimeout(150);
 await p.click('[data-a="marq"][data-r="b"]');await p.waitForTimeout(150);
 await p.click('[data-a="filt"][data-r="marq"]');await p.waitForTimeout(150);
 const m1=await p.evaluate(()=>({n:document.querySelectorAll(".cq").length,t:document.body.innerText,ls:localStorage.getItem("ang_lv_marq")}));
 chk("MQ-1","Marquer une commande : filtre Marquées (1) n'affiche qu'elle, marque gardée sur le téléphone",m1.n===1&&/Marquées \(1\)/.test(m1.t)&&/Toutes \(2\)/.test(m1.t)&&m1.ls==='["b"]',JSON.stringify(m1).slice(0,200));
 await p.click('[data-a="marq"][data-r="b"]');await p.waitForTimeout(150);
 const m2=await p.evaluate(()=>document.body.innerText);
 chk("MQ-2","Démarquer : filtre Marquées vide, message explicite",/Aucune commande marquée/.test(m2)&&/Marquées \(0\)/.test(m2),m2.slice(0,200));
 await p.click('[data-a="filt"][data-r="toutes"]');await p.click('[data-a="vuel"][data-r="un"]');await p.waitForTimeout(150);
 const u1=await p.evaluate(()=>({t:document.body.innerText,cartes:document.querySelectorAll(".cu").length,prec:document.querySelector('[data-a="prec"]').disabled}));
 chk("UN-1","Mode 1 par 1 : une seule carte, « Commande 1 / 2 », précédent désactivé",u1.cartes===1&&/Commande 1 \/ 2/.test(u1.t)&&u1.prec===true&&/Awa Kone/.test(u1.t)&&!/Banhiet/.test(u1.t),u1.t.slice(0,300));
 await p.click('[data-a="suiv"]');await p.waitForTimeout(150);
 const u2=await p.evaluate(()=>({t:document.body.innerText,suiv:document.querySelector('[data-a="suiv"]').disabled}));
 chk("UN-2","Suivante : « Commande 2 / 2 », autre client affiché, suivant désactivé",/Commande 2 \/ 2/.test(u2.t)&&/Banhiet/.test(u2.t)&&u2.suiv===true,u2.t.slice(0,300));
 await p.click('[data-a="vuel"][data-r="liste"]');await p.waitForTimeout(150);
 const u3=await p.evaluate(()=>({n:document.querySelectorAll(".cq").length,v:localStorage.getItem("ang_lv_vue")}));
 chk("UN-3","Retour en liste : 2 cartes, choix de vue mémorisé",u3.n===2&&u3.v==='"liste"',JSON.stringify(u3));

 await p.evaluate(()=>{STATS.payload.classement={total:12,rang:11,top:[1,2,3,4,5,6,7,8,9,10].map(r=>({r,n:"Livreur "+r,l:60-r,t:99-r,moi:false})),moi:{r:11,n:"Livreur Test",l:40,t:90,moi:true}};missions=[];PAGE="classement";vueMissions()});await p.waitForTimeout(200);
 const cl=await p.evaluate(()=>document.body.innerText.replace(/\s+/g," "));
 chk("CL-1","Classement : rang 11 / 12, top 10 avec médailles, ligne « vous » ajoutée sous le top",/Votre rang\s*11\s*\/ 12/.test(cl)&&cl.includes("🥇")&&cl.includes("🥉")&&/Livreur 10/.test(cl)&&/Livreur Test \(vous\)/.test(cl)&&!/Livreur 11\b/.test(cl),cl.slice(0,400));
 await p.evaluate(()=>{delete STATS.payload.classement;vueMissions()});
 const cl2=await p.evaluate(()=>document.body.innerText);
 chk("CL-2","Sans données : message d'attente, pas d'erreur",/pas encore disponible/.test(cl2)&&!/undefined|NaN/.test(cl2),cl2.slice(0,200));
 await p.evaluate(()=>{PAGE="cours";vueMissions()});
 await p.evaluate(()=>{missions=[];vueMissions()});await p.waitForTimeout(300);
 const t3=await p.evaluate(()=>document.body.innerText);
 chk("EN-6","aucune mission : pas d'erreur ni NaN",!/undefined|NaN/.test(t3),t3.slice(0,200));
 console.log(errs.length?errs.join("\n"):"");console.log(`RÉSULTAT : ${ok} réussis, ${ko} échecs`);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
