/* Photos des colis : prise de photo à la préparation (bureau), publication au livreur, affichage et agrandissement dans l application livreur, nettoyage.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/colis-photos.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),p=await ctx.newPage(),errs=[];
 const posts=[];let pub="ok";
 await ctx.route("https://x.supabase.co/**",async route=>{const rq=route.request(),u=rq.url(),H={"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"POST, OPTIONS","content-type":"application/json"};
  if(rq.method()==="OPTIONS")return route.fulfill({status:204,headers:H});
  if(/colis-photos/.test(u)){posts.push({h:rq.headers(),b:JSON.parse(rq.postData()||"{}")});return route.fulfill({status:pub==="ok"?200:500,headers:H,body:JSON.stringify(pub==="ok"?{ok:true}:{ok:false,erreur:"panne photos"})})}
  return route.fulfill({status:200,headers:H,body:JSON.stringify({ok:true,evenements:[],missions:[],commandes:[]})})});
 const PNG=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==","base64");
 await p.goto(base+"/distribution.html");await p.waitForTimeout(300);
 await p.evaluate(()=>{window.__T=[];toast=m=>{__T.push(m)};window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};
  S.config.passerelle_actif=true;S.config.appel_pont={url:"https://x.supabase.co/functions/v1",cle_admin:"CLE-ADMIN-TEST"};
  const l=S.livraisons.find(x=>isActive(x)&&cmd(x.commande_id));window.__l=l;window.__c=cmd(l.commande_id);__c.colis=null;window.__fiche=role=>{__as(role);view="commandes";render();cmdDetail(__c.id);return document.getElementById("modal")?document.getElementById("modal").innerHTML:document.body.innerHTML}});
 let ok=0,ko=0;const chk=(id,label,v,i)=>{if(v===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",i===undefined?v:i)}};
 // 1. droits d'accès au bouton
 const f1=await p.evaluate(()=>({prep:/data-act="photosColis"/.test(__fiche("preparateur")),sup:/data-act="photosColis"/.test(__fiche("superviseur")),comm:/data-act="photosColis"/.test(__fiche("commercial")),caiss:/data-act="photosColis"/.test(__fiche("caissier"))}));
 chk("CPH-1","fiche de la commande : bouton « 📷 Photos des colis » pour préparateur, superviseur et commercial, pas pour le caissier",f1.prep&&f1.sup&&f1.comm&&!f1.caiss,JSON.stringify(f1));
 // 2. création des emplacements puis photo
 await p.evaluate(()=>{__as("preparateur");photosColisModal(__c)});
 let h=await p.evaluate(()=>document.getElementById("cph_box").innerText);
 chk("CPH-2","aucun colis défini : la fenêtre propose « Nombre de colis » et « Créer les emplacements »",/Nombre de colis/.test(h)&&/Créer les emplacements/.test(h),h);
 await p.fill("#cph_nb","2");await p.click('[data-act="cphCreer"]');await p.waitForTimeout(250);
 h=await p.evaluate(()=>document.getElementById("cph_box").innerText);
 chk("CPH-3","2 emplacements créés : « Colis 1 », « Colis 2 », « 0/2 colis photographiés »",/Colis 1/.test(h)&&/Colis 2/.test(h)&&/0\/2 colis photographiés/.test(h),h);
 await p.setInputFiles('input[data-cph$="|1"]',{name:"colis1.png",mimeType:"image/png",buffer:PNG});await p.waitForTimeout(500);
 const a1=await p.evaluate(()=>({ph:(__c.colis[0].photo||"").slice(0,22),len:(__c.colis[0].photo||"").length,par:__c.colis[0].photo_par,img:!!document.querySelector("#cph_box img[alt='Photo du colis 1']"),txt:document.getElementById("cph_box").innerText,aud:S.audit.slice(-3).some(a=>/Photo de colis/.test(JSON.stringify(a)))}));
 chk("CPH-4","photo prise : JPEG réduit (≤ 60 000 caractères) enregistré sur le colis 1, auteur tracé, vignette affichée, « 1/2 », audit",a1.ph==="data:image/jpeg;base64"&&a1.len>0&&a1.len<=60000&&!!a1.par&&a1.img&&/1\/2 colis photographiés/.test(a1.txt)&&a1.aud,JSON.stringify(a1));
 await p.setInputFiles('input[data-cph$="|1"]',{name:"remplace.png",mimeType:"image/png",buffer:PNG});await p.waitForTimeout(400);
 await p.setInputFiles('input[data-cph$="|2"]',{name:"colis2.png",mimeType:"image/png",buffer:PNG});await p.waitForTimeout(400);
 await p.evaluate(()=>{document.querySelector('[data-act="cphDel"][data-id$="|2"]').click()});await p.waitForTimeout(200);
 const a2=await p.evaluate(()=>({p1:!!__c.colis[0].photo,p2:!!__c.colis[1].photo}));
 chk("CPH-5","reprise de la photo 1 possible ; photo 2 prise puis retirée : seule la photo 1 reste",a2.p1&&!a2.p2,JSON.stringify(a2));
 await p.evaluate(()=>{__as("vendeur");const n=__T.length;photosColisModal(__c);window.__refus=__T.slice(n).join()});
 chk("CPH-6","un vendeur ne peut pas ouvrir la fenêtre des photos",/refusé/.test(await p.evaluate(()=>window.__refus)),await p.evaluate(()=>window.__refus));
 // 3. publication au serveur
 await p.evaluate(async()=>{__as("admin");window.__closeM=()=>{try{closeModal()}catch(e){}};await passSync(true)});await p.waitForTimeout(500);
 const pst=posts.filter(x=>x.b.livraisons&&x.b.livraisons.length);
 const dp=pst[pst.length-1];chk("CPH-7","la photo est publiée pour la livraison en cours (fonction colis-photos, clé d'administration), avec son numéro de colis, dès la prise de photo",pst.length>=1&&dp.h["x-admin-key"]==="CLE-ADMIN-TEST"&&dp.b.livraisons[0].photos.length===1&&dp.b.livraisons[0].photos[0].n===1&&/^data:image\/jpeg;base64,/.test(dp.b.livraisons[0].photos[0].photo)&&dp.b.livraisons[0].livraison_ref===(await p.evaluate(()=>__l.id)),JSON.stringify(posts.map(x=>Object.keys(x.b))));
 const pl=await p.evaluate(()=>passProjection(__l).payload.photos_colis);
 chk("CPH-8","la mission publiée au livreur indique le nombre de photos (1), jamais les images dans la mission",pl===1&&!/data:image/.test(JSON.stringify(await p.evaluate(()=>passProjection(__l).payload))),pl);
 const n0=posts.length;await p.evaluate(()=>passSync(true));await p.waitForTimeout(400);
 chk("CPH-9","rien n'a changé : photos non renvoyées",posts.length===n0,posts.length+" vs "+n0);
 pub="panne";await p.evaluate(()=>{__c.colis[1].photo=__c.colis[0].photo;__c.colis[1].photo_ts=now()});await p.evaluate(()=>passSync(true));await p.waitForTimeout(400);
 const e1=await p.evaluate(()=>({err:_cphErr,etat:(()=>{pgInfo();return document.body.innerText.includes("Photos des colis publiées aux livreurs")})()}));
 chk("CPH-10","serveur en panne : aucune exception, erreur affichée dans la fenêtre Passerelle, nouvel essai ensuite",/panne photos/.test(e1.err)&&e1.etat,JSON.stringify(e1));
 pub="ok";const n1=posts.length;await p.evaluate(()=>{closeModal&&closeModal();return passSync(true)});await p.waitForTimeout(500);
 chk("CPH-11","retour du serveur : les 2 photos sont publiées",posts.length>n1&&posts[posts.length-1].b.livraisons[0].photos.length===2,posts.length+"/"+n1);
 const n2=posts.length;await p.evaluate(()=>{__l.statut="livree";__l.fin_at=now()});await p.evaluate(()=>passSync(true));await p.waitForTimeout(500);
 const ret=posts.slice(n2).find(x=>x.b.retirer);
 chk("CPH-12","livraison terminée : le bureau demande le retrait des photos sur le serveur",ret&&ret.b.retirer.includes(await p.evaluate(()=>__l.id)),JSON.stringify(posts.slice(n2).map(x=>x.b.retirer)));
 // 4. nettoyage des commandes terminées
 const nt=await p.evaluate(()=>{const c=S.commandes.find(x=>x!==__c&&!x.colis);c.colis=[{n:1,tok:"ABCDE",photo:"data:image/jpeg;base64,AAA"}];c.statut="livree";c.hist=[{a:"livree",ts:new Date(Date.now()-30*3600e3).toISOString()}];const d=S.commandes.find(x=>x!==__c&&x!==c&&!x.colis);d.colis=[{n:1,tok:"FGHIJ",photo:"data:image/jpeg;base64,BBB"}];d.statut="livree";d.hist=[{a:"livree",ts:new Date().toISOString()}];const n=colisPhotosPurger();return{n,vieille:!!c.colis[0].photo,recente:!!d.colis[0].photo,tok:c.colis[0].tok}});
 chk("CPH-13","commande livrée depuis plus de 24 h : photo supprimée (étiquette conservée) ; livrée aujourd'hui : photo gardée",nt.n===1&&!nt.vieille&&nt.recente&&nt.tok==="ABCDE",JSON.stringify(nt));
 console.log(errs.length?errs.join("\n"):"");console.log(`RÉSULTAT : ${ok} réussis, ${ko} échecs`);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
