/* Suivi en direct, page publique du client (portail.html) : interrogation du serveur, carte et étape mises à jour sans nouveau lien, coupures, expiration, signature vérifiée avec les clés publiées.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/suivi-direct-portail.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
const K="Ab3_xYz9-QwErTyUiOpAsDf";
const tok=(o,sig="-",kid="0")=>Buffer.from(JSON.stringify(o)).toString("base64url")+"."+sig+"."+kid;
const base0={o:"ANGEL'S GROUP",w:"2250707555555",n:"CMD-2026-0098",s:"en_cours",l:"Cocody · Riviera",v:"Issa",e:"2099-01-01T10:45:00.000Z",g:"2026-10-26T09:50:00.000Z",ap:12500,h:[["attente","2026-10-26T09:00:00.000Z"],["en_cours","2026-10-26T09:50:00.000Z"]],x:[5.35,-4.0],k:K,y:[5.30,-4.10,"2026-10-26T09:50:00.000Z"]};
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});let ok=0,ko=0;const errs=[];
 const chk=(id,label,v,i)=>{if(v===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",i===undefined?v:i)}};
 const PNG=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==","base64");
 const ouvrir=async(state)=>{const ctx=await b.newContext({viewport:{width:420,height:900}});await ctx.addInitScript(()=>{window.SUIVI_POLL_MS=250});
  const calls=[];state.calls=calls;
  await ctx.route("https://tile.openstreetmap.org/**",r=>r.fulfill({status:200,contentType:"image/png",body:PNG}));
  await ctx.route("https://gfzqxoolorbejxnxrlji.supabase.co/**",async r=>{const rq=r.request(),u=rq.url(),cors={"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"POST, GET, OPTIONS"};
   if(rq.method()==="OPTIONS")return r.fulfill({status:204,headers:cors});
   if(/suivi-live/.test(u)){const body=JSON.parse(rq.postData()||"{}");calls.push({body,headers:rq.headers()});
    if(body.action==="cles")return r.fulfill({status:200,headers:cors,contentType:"application/json",body:JSON.stringify({ok:true,cles:state.cles||[]})});
    const x=typeof state.rep==="function"?state.rep(calls.length):state.rep;
    if(x==="abort")return r.abort();
    return r.fulfill({status:x.status||200,headers:cors,contentType:"application/json",body:JSON.stringify(x.body)})}
   return r.fulfill({status:404,headers:cors,body:"{}"})});
  const p=await ctx.newPage();p.on("pageerror",e=>errs.push(e.message));return{ctx,p}};
 const rep=(o)=>({status:200,body:Object.assign({ok:true,etat:{o:"ANGEL'S GROUP",w:"2250707555555",n:"CMD-2026-0098",s:"en_cours",l:"Cocody · Riviera",v:"Issa",e:"2099-01-01T10:45:00.000Z",ap:12500,h:[["attente","2026-10-26T09:00:00.000Z"],["en_cours","2026-10-26T09:50:00.000Z"]],x:[5.35,-4.0]},pos:{lat:5.31,lng:-4.05,ts:new Date().toISOString(),age_s:3,precision:10},maj:new Date().toISOString(),serveur:new Date().toISOString()},o||{})});
 const aller=async(p,t)=>{await p.goto(base+"/portail.html#/suivi/"+t);await p.waitForSelector("#sv .card",{timeout:8000});await p.waitForTimeout(150)};
 const txt=p=>p.evaluate(()=>document.getElementById("sv").innerText);
 // 1. mise à jour en direct
 let st={rep:rep()};let {ctx,p}=await ouvrir(st);await aller(p,tok(base0));await p.waitForTimeout(700);
 let t=await txt(p);
 chk("SP-1","commande en route avec clé de suivi : bandeau « En direct », heure de mise à jour, position du livreur « à l'instant » (et non « au moment de l'envoi du lien »)",/En direct/.test(t)&&/mis à jour à \d\d:\d\d:\d\d/.test(t)&&/Position du livreur à l'instant/.test(t)&&!/au moment de l'envoi du lien/.test(t)&&!/Information arrêtée/.test(t),t.slice(0,700));
 chk("SP-2","la requête n'envoie que la clé du lien (aucun numéro, aucun jeton complet, pas de clé d'API)",st.calls.filter(c=>c.body.cle).every(c=>Object.keys(c.body).join()==="cle"&&c.body.cle===K&&!c.headers.apikey&&!c.headers.authorization),JSON.stringify(st.calls[0]));
 if(process.env.SHOT)await p.screenshot({path:process.env.SHOT+"/suivi-live.png",fullPage:true});
 const n0=st.calls.length;await p.waitForTimeout(1300);
 chk("SP-3","interrogation régulière sans nouveau lien (plusieurs appels en moins d'une seconde avec l'intervalle de test)",st.calls.length>=n0+2,st.calls.length+" vs "+n0);
 // 2. la position bouge : la carte bouge, pas toute la page
 await p.evaluate(()=>{window.__tl=document.querySelector("#sv .tl");window.__pin=()=>{const e=document.querySelector("#sv_map .pin:last-of-type");return e?e.style.left+"|"+e.style.top:""};window.__p0=window.__pin()});
 st.rep=rep({pos:{lat:5.3105,lng:-4.0495,ts:new Date().toISOString(),age_s:2,precision:8}});await p.waitForTimeout(900);
 const mv=await p.evaluate(()=>({moved:window.__pin()!==window.__p0,sameTl:window.__tl===document.querySelector("#sv .tl"),pins:document.querySelectorAll("#sv_map .pin").length}));
 chk("SP-4","le livreur avance : le repère de la carte se déplace, la frise d'étapes n'est pas redessinée (pas de clignotement)",mv.moved&&mv.sameTl&&mv.pins===2,JSON.stringify(mv));
 // 3. étape suivante : livrée -> frise à jour, fin du suivi
 st.rep=rep({etat:{o:"ANGEL'S GROUP",w:"2250707555555",n:"CMD-2026-0098",s:"livree",l:"Cocody · Riviera",v:"Issa",ap:0,h:[["attente","2026-10-26T09:00:00.000Z"],["en_cours","2026-10-26T09:50:00.000Z"],["livree","2026-10-26T10:20:00.000Z"]]},pos:null});await p.waitForTimeout(900);
 t=await txt(p);const nf=st.calls.length;await p.waitForTimeout(900);
 chk("SP-5","livraison terminée : « Commande livrée » affichée sans nouveau lien, plus de carte de trajet, et les appels s'arrêtent",/Livrée|livrée/.test(t)&&/livraison terminée/.test(t)&&st.calls.length<=nf+1,t.slice(0,300)+" calls "+st.calls.length+"/"+nf);
 await ctx.close();
 // 4. activation : 404 tant que le bureau n'a pas publié, puis 200
 st={rep:()=>st.pret?rep():{status:404,body:{ok:false,erreur:"Lien de suivi inconnu"}}};({ctx,p}=await ouvrir(st));await aller(p,tok(base0));await p.waitForTimeout(700);
 t=await txt(p);const a1=/en cours d'activation/.test(t)&&/Position du livreur à \d\d:\d\d \(au moment de l'envoi du lien\)/.test(t)&&!/En direct/.test(t);st.pret=true;await p.waitForTimeout(900);t=await txt(p);
 chk("SP-6","lien pas encore publié (404) : la photo du lien reste affichée avec « en cours d'activation », puis passe en direct dès que le bureau a publié",a1&&/En direct/.test(t)&&!/activation/.test(t),"a1="+a1+" "+t.slice(0,300));
 await ctx.close();
 // 5. coupure réseau puis retour
 st={rep:rep()};({ctx,p}=await ouvrir(st));await aller(p,tok(base0));await p.waitForTimeout(500);st.rep="abort";await p.waitForTimeout(1000);t=await txt(p);const cut=/Suivi en direct interrompu/.test(t)&&/Dernière information à \d\d:\d\d:\d\d/.test(t)&&/Commande n° CMD-2026-0098/.test(t);
 st.rep=rep();await p.waitForTimeout(1500);t=await txt(p);
 chk("SP-7","coupure du réseau : avertissement clair avec l'heure de la dernière information (jamais une vieille position présentée comme actuelle), puis reprise automatique",cut&&/En direct/.test(t)&&!/interrompu/.test(t),t.slice(0,400));
 await ctx.close();
 // 6. expiré
 st={rep:{status:410,body:{ok:false,expire:true,erreur:"Ce lien de suivi a expiré"}}};({ctx,p}=await ouvrir(st));await aller(p,tok(base0));await p.waitForTimeout(500);t=await txt(p);const ne=st.calls.length;await p.waitForTimeout(800);
 chk("SP-8","lien expiré (410) : message clair et arrêt des appels",/a expiré/.test(t)&&st.calls.length===ne,t.slice(0,300));
 await ctx.close();
 // 7. position absente
 st={rep:rep({pos:null})};({ctx,p}=await ouvrir(st));await aller(p,tok(base0));await p.waitForTimeout(500);t=await txt(p);
 chk("SP-9","position absente ou trop ancienne côté serveur : la page le dit et montre l'adresse de livraison sur la carte",/Position du livreur indisponible pour le moment/.test(t)&&(await p.evaluate(()=>document.querySelectorAll("#sv_map .pin").length))===1,t.slice(0,500));
 await ctx.close();
 // 8. onglet masqué
 st={rep:rep()};({ctx,p}=await ouvrir(st));await p.addInitScript(()=>{});await aller(p,tok(base0));await p.waitForTimeout(400);
 await p.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,get:()=>true})});await p.waitForTimeout(400);const h0=st.calls.length;await p.waitForTimeout(1000);const h1=st.calls.length;
 await p.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,get:()=>false});document.dispatchEvent(new Event("visibilitychange"))});await p.waitForTimeout(700);
 chk("SP-10","onglet masqué : aucun appel (économie de batterie et de données) ; retour au premier plan : actualisation immédiate",h1===h0&&st.calls.length>h1,[h0,h1,st.calls.length].join("/"));
 await ctx.close();
 // 9. ancien lien sans clé
 const {k,...sansK}=base0;st={rep:rep()};({ctx,p}=await ouvrir(st));await aller(p,tok(sansK));await p.waitForTimeout(700);t=await txt(p);
 chk("SP-11","ancien lien (sans clé de suivi) : fonctionnement d'avant (photo datée), aucun appel au serveur de suivi",st.calls.filter(c=>c.body.cle).length===0&&/Information arrêtée le/.test(t)&&/au moment de l'envoi du lien/.test(t)&&!/En direct/.test(t),t.slice(0,400));
 await ctx.close();
 // 10. lien déjà terminé
 st={rep:rep()};({ctx,p}=await ouvrir(st));await aller(p,tok(Object.assign({},base0,{s:"livree",y:undefined})));await p.waitForTimeout(600);
 chk("SP-12","lien d'une commande déjà livrée : aucun appel inutile au serveur de suivi",st.calls.filter(c=>c.body.cle).length===0);await ctx.close();
 // 11. signature : clé publique publiée par le bureau
 st={rep:rep(),cles:[]};({ctx,p}=await ouvrir(st));
 await p.goto(base+"/portail.html");const sig=await p.evaluate(async(body)=>{const kp=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]),pub=await crypto.subtle.exportKey("jwk",kp.publicKey);const sg=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},kp.privateKey,new TextEncoder().encode("T1|"+body));
   const b64=a=>btoa(String.fromCharCode(...new Uint8Array(a))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");return{sig:b64(sg),pub:{kty:pub.kty,crv:pub.crv,x:pub.x,y:pub.y}}},Buffer.from(JSON.stringify(base0)).toString("base64url"));
 const signe=Buffer.from(JSON.stringify(base0)).toString("base64url")+"."+sig.sig+".kidtest01";
 await aller(p,signe);await p.waitForTimeout(400);t=await txt(p);const avant=/Signature non vérifiable ici/.test(t);await ctx.close();
 st.cles=[{kid:"kidtest01",pub:sig.pub}];({ctx,p}=await ouvrir(st));await aller(p,signe);await p.waitForTimeout(500);t=await txt(p);
 chk("SP-13","clé publique non publiée : « Signature non vérifiable ici » ; clé publiée par le bureau (récupérée sur le serveur) : « Information certifiée par l'entreprise (signature vérifiée) »",avant&&/Information certifiée par l'entreprise/.test(t)&&!/non vérifiable/.test(t),"avant="+avant+" "+t.slice(0,200));
 // 12. lien falsifié
 const fals=Buffer.from(JSON.stringify(Object.assign({},base0,{n:"CMD-FAUX"}))).toString("base64url")+"."+sig.sig+".kidtest01";const nc=st.calls.filter(c=>c.body.cle).length;
 await aller(p,fals);await p.waitForTimeout(500);t=await txt(p);
 chk("SP-14","lien modifié : « Lien non authentique », aucune interrogation du serveur de suivi",/Lien non authentique/.test(t)&&st.calls.filter(c=>c.body.cle).length===nc,t.slice(0,200));
 await ctx.close();
 chk("SP-15","aucune erreur de script",errs.length===0,errs.join(" | "));
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");await b.close();srv.close();process.exit(ko?1:0);
})();
