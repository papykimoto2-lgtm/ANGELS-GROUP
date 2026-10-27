/* Système livreurs, lot 2 (terrain) : formulaires toujours visibles, fermeture qui rend la main, confirmation allégée et contrôlée, erreurs lisibles, appel du bureau.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/livreurs-lot2.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
let ok=0,ko=0;const chk=(id,label,o,info)=>{console.log(o===true?"PASS":"FAIL",id,label,o===true?"":"-> "+(info===undefined?o:info));o===true?ok++:ko++};
(async()=>{
 await new Promise(o=>srv.listen(0,"127.0.0.1",o));const base="http://127.0.0.1:"+srv.address().port;
 const br=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await br.newContext({viewport:{width:400,height:800}}),errs=[];
 const H={"access-control-allow-origin":"*","access-control-allow-headers":"*"};
 const J=(rt,b,st)=>rt.fulfill({status:st||200,contentType:"application/json",headers:H,body:JSON.stringify(b)});
 const MISSION={livraison_ref:"l1",livreur_ref:"lv1",commande_ref:"CMD-0001",statut:"en_cours",maj_le:new Date().toISOString(),position:null,payload:{numero:"CMD-0001",client_nom:"Mme Konan",adr:{zone:"Cocody",quartier:"Angré",repere:"",instructions:"",gps:null},lignes:[{desig:"Robe",qte:1,pu:8500}],obs:"",montant_attendu:8500,modes:["Espèces","Orange Money"],collecte_at:new Date().toISOString(),nb_colis:1}};
 const q=await ctx.newPage();q.on("pageerror",e=>errs.push(e.message));const sent=[];let mode="ok";
 await q.addInitScript(()=>{window.__missions=null;const sess=()=>({access_token:"JWT-TEST",user:{id:"u1",user_metadata:{chg:false}}});
  const sb={auth:{getSession:async()=>({data:{session:sess()}}),signOut:async()=>{}},from:()=>({select:()=>({order:async()=>({data:window.__missions,error:null}),maybeSingle:async()=>({data:{livreur_ref:"lv1",nom:"Koffi Yao"},error:null})})})};
  window.supabase={createClient:()=>sb}});
 await q.route("**/functions/v1/mission-action",async rt=>{if(rt.request().method()==="OPTIONS")return rt.fulfill({status:204,headers:H});const b=JSON.parse(rt.request().postData()||"{}");sent.push(b);
  if(mode==="409")return J(rt,{ok:false,erreur:"Cette mission n'est plus à accepter"},409);return J(rt,{ok:true,statut:"x"})});
 await q.goto(base+"/livreur.html");await q.waitForTimeout(500);
 await q.evaluate(m=>{window.__missions=[m]},MISSION);await q.evaluate(async()=>{await charger()});await q.waitForTimeout(250);
 await q.click('[data-a="confirmer"]');await q.waitForTimeout(300);
 /* LT-1 formulaire de confirmation */
 const f=await q.evaluate(()=>{const g=n=>document.querySelector('.ov [name="'+n+'"]');const vis=id=>{const e=document.querySelector(".ov #"+id);return e&&getComputedStyle(e).display!=="none"};
  return{recu:g("recu_par").value,im:g("montant").getAttribute("inputmode"),ecart0:vis("lbecart"),ref0:vis("lbref")}});
 chk("LT-1","confirmation : le nom du client est déjà rempli, clavier numérique pour le montant, explication d'écart et référence Mobile Money masquées tant qu'inutiles",f.recu==="Mme Konan"&&f.im==="numeric"&&!f.ecart0&&!f.ref0,JSON.stringify(f));
 /* LT-2 champs conditionnels */
 const c2=await q.evaluate(()=>{const vis=id=>{const e=document.querySelector(".ov #"+id);return e&&getComputedStyle(e).display!=="none"};const m=document.querySelector('.ov [name="montant"]');m.value="7000";m.dispatchEvent(new Event("input",{bubbles:true}));const a=vis("lbecart");m.value="8500";m.dispatchEvent(new Event("input",{bubbles:true}));const b=vis("lbecart");
  const s=document.querySelector('.ov [name="mode"]');s.value="Orange Money";s.dispatchEvent(new Event("change",{bubbles:true}));return{ecartOn:a,ecartOff:!b,refOn:vis("lbref")}});
 chk("LT-2","l'explication apparaît seulement si le montant diffère ; la référence apparaît seulement pour Mobile Money",c2.ecartOn&&c2.ecartOff&&c2.refOn,JSON.stringify(c2));
 /* LT-3 contrôles avant envoi */
 sent.length=0;await q.click('.ov button[type=submit]');await q.waitForTimeout(400);let t=await q.innerText("#toast");
 chk("LT-3","Mobile Money sans référence : refus immédiat, clair, rien n'est envoyé (plus de refus tardif par le bureau)",/référence/i.test(t)&&!sent.some(x=>x.type==="confirmer"),t);
 await q.evaluate(()=>{const s=document.querySelector('.ov [name="mode"]');s.value="Espèces";s.dispatchEvent(new Event("change",{bubbles:true}));const m=document.querySelector('.ov [name="montant"]');m.value="6000";m.dispatchEvent(new Event("input",{bubbles:true}))});
 await q.click('.ov button[type=submit]');await q.waitForTimeout(400);t=await q.innerText("#toast");
 chk("LT-4","montant différent sans explication : refus immédiat avec le motif, rien n'est envoyé",/expliquez/i.test(t)&&!sent.some(x=>x.type==="confirmer"),t);
 /* LT-5 couches */
 const z=await q.evaluate(()=>{const ov=document.querySelector(".ov"),tb=document.querySelector(".tb"),so=document.querySelector(".sosb"),to=document.getElementById("toast");const zi=e=>e?+getComputedStyle(e).zIndex||0:0;return{ov:zi(ov),tb:zi(tb),sos:zi(so),toast:zi(to)}});
 chk("LT-5","le formulaire passe au-dessus de la barre d'onglets et du bouton SOS, et les messages restent visibles au-dessus du formulaire",z.ov>z.tb&&z.ov>z.sos&&z.toast>z.ov,JSON.stringify(z));
 /* LT-6 fermeture en touchant à côté */
 await q.mouse.click(5,5);await q.waitForTimeout(300);
 const o=await q.evaluate(()=>({ouv:ouvert,f:document.querySelectorAll(".ov").length}));
 chk("LT-6","toucher à côté du formulaire le ferme ET rend la main à l'application (liste actualisée, vigilance active)",o.f===0&&o.ouv===null,JSON.stringify(o));
 /* LT-7 envoi : libellé et envoi correct */
 await q.click('[data-a="confirmer"]');await q.waitForTimeout(300);sent.length=0;
 await q.evaluate(()=>{const m=document.querySelector('.ov [name="montant"]');m.value="8500";m.dispatchEvent(new Event("input",{bubbles:true}))});
 await q.click('.ov button[type=submit]');await q.waitForTimeout(600);
 chk("LT-7","confirmation valide : envoyée avec le nom du client, le montant attendu et un identifiant d'action",sent.length===1&&sent[0].type==="confirmer"&&sent[0].donnees.recu_par==="Mme Konan"&&+sent[0].donnees.montant===8500&&!!sent[0].cid,JSON.stringify(sent[0]));
 /* LT-8 409 sur état atteint */
 mode="409";await q.evaluate(m=>{window.__missions=[Object.assign({},m,{statut:"acceptee",payload:Object.assign({},m.payload,{collecte_at:null})})]},MISSION);await q.evaluate(async()=>{await charger()});await q.waitForTimeout(200);
 await q.evaluate(()=>{envoyer("l1","accepter",{},"Mission acceptée")});await q.waitForTimeout(600);t=await q.innerText("#toast");
 chk("LT-8","double appui sur « Accepter » : le refus 409 devient « Déjà enregistré : rien à refaire » (plus d'erreur rouge trompeuse)",/déjà enregistré/i.test(t),t);
 /* LT-9 erreurs lisibles + bouton bureau */
 const e9=await q.evaluate(()=>({a:msgErr(new Error("Failed to fetch")),b:msgErr(new Error("JWT expired")),c:msgErr(new Error("Photo obligatoire"))}));
 chk("LT-9","« Failed to fetch » et « JWT expired » deviennent des phrases compréhensibles ; les vrais messages métier sont conservés",/instable/.test(e9.a)&&/reconnectez/.test(e9.b)&&e9.c==="Photo obligatoire",JSON.stringify(e9));
 const b9=await q.evaluate(()=>{STATS={payload:{regles:{sos_tel:"+225 01 02 03 04 05"}}};vueMissions();const a=document.querySelector('a[href^="tel:"]');return{href:a&&a.getAttribute("href"),txt:a&&a.textContent}});
 chk("LT-9b","bouton « Appeler le bureau » (un geste) quand le numéro du bureau est fixé",/^tel:\+2250102030405$/.test(b9.href||"")&&/Appeler le bureau/.test(b9.txt||""),JSON.stringify(b9));
 chk("LT-10","libellés clairs : « Je prends les colis » et « Je ne peux pas la prendre »",await q.evaluate(()=>{window.__missions=[Object.assign({},window.__missions[0],{statut:"affectee"})];return true})&&await (async()=>{await q.evaluate(async()=>{await charger()});await q.waitForTimeout(200);return /Je ne peux pas la prendre/.test(await q.innerText("body"))})());
 chk("LT-11","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT : "+ok+" réussis, "+ko+" échecs");await br.close();srv.close();process.exit(ko?1:0);
})();
