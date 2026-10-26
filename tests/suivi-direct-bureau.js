/* Suivi en direct, côté bureau : clé du lien, publication de l état sans donnée personnelle, clés publiques, panne du serveur sans conséquence.
   Usage : NODE_OPTIONS="--require ./tests/demo-hook.js" PLAYWRIGHT=/chemin/playwright node tests/suivi-direct-bureau.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:1100,height:900}}),p=await ctx.newPage(),errs=[];
 const posts=[];let mode="ok",live="ok",pubStatus=200;
 await ctx.route("https://x.supabase.co/**",async route=>{const rq=route.request(),u=rq.url();if(rq.method()==="OPTIONS")return route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"POST, OPTIONS"}});
  if(/suivi-live/.test(u)){const b=JSON.parse(rq.postData()||"{}");const H={"access-control-allow-origin":"*","content-type":"application/json"};if(b.action==="cles")return route.fulfill({status:200,headers:H,body:JSON.stringify({ok:true,cles:[]})});if(live==="404")return route.fulfill({status:404,headers:H,body:JSON.stringify({ok:false,erreur:"Lien de suivi inconnu"})});const sv=posts.filter(x=>x.b.suivis&&x.b.suivis.some(i=>i.cle===b.cle)).pop();const it=sv&&sv.b.suivis.find(i=>i.cle===b.cle);return route.fulfill({status:200,headers:H,body:JSON.stringify({ok:true,etat:it?it.etat:{n:"?"},pos:null})})}
  if(/suivi-publier/.test(u)){posts.push({u,h:rq.headers(),b:JSON.parse(rq.postData()||"{}")});if(pubStatus!==200)return route.fulfill({status:pubStatus,headers:{"access-control-allow-origin":"*","content-type":"application/json"},body:JSON.stringify({ok:false,erreur:pubStatus===401?"Clé d'administration invalide":"Not Found"})});return route.fulfill({status:mode==="ok"?200:500,headers:{"access-control-allow-origin":"*","content-type":"application/json"},body:JSON.stringify(mode==="ok"?{ok:true}:{ok:false,erreur:"panne"})})}
  return route.fulfill({status:200,headers:{"access-control-allow-origin":"*","content-type":"application/json"},body:JSON.stringify({ok:true,evenements:[],missions:[]})})});
 await p.goto(base+"/distribution.html");await p.waitForTimeout(300);
 await p.evaluate(()=>{window.__T=[];toast=m=>{__T.push(m)};ME=S.users.find(u=>u.role==="admin");S.config.passerelle_actif=true;S.config.appel_pont={url:"https://x.supabase.co/functions/v1",cle_admin:"CLE-ADMIN-TEST"};
  window.__c=S.commandes.find(c=>c.statut==="en_cours")||S.commandes.find(c=>!["brouillon","annulee"].includes(c.statut));window.__dec=l=>{const b=l.split("/suivi/")[1].split(".")[0].replace(/-/g,"+").replace(/_/g,"/");return JSON.parse(decodeURIComponent(escape(atob(b+"=".repeat((4-b.length%4)%4)))))}});
 let ok=0,ko=0;const t=async(id,label,fn)=>{let r;try{r=await p.evaluate(fn)}catch(e){r="EXC "+e.message}if(r===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",r)}};
 await t("SB-1","lien de suivi : porte une clé aléatoire (≥ 20 caractères, sans rapport avec le numéro de commande), stable d'un lien à l'autre",async()=>{const l1=await suiviLienPortail(__c),l2=await suiviLienPortail(__c);const d1=__dec(l1),d2=__dec(l2);return /^[A-Za-z0-9_-]{20,64}$/.test(d1.k||"")&&d1.k===d2.k&&!d1.k.includes(__c.numero)&&__c.suivi_cle===d1.k?true:JSON.stringify([d1.k,d2.k])});
 await p.waitForTimeout(600);
 const n0=posts.length;
 const chk=(id,label,v,i)=>{if(v===true){ok++;console.log("PASS",id,label)}else{ko++;console.log("FAIL",id,label,"→",i===undefined?v:i)}};
 chk("SB-2","le lien déclenche la publication immédiate (fonction suivi-publier, clé d'administration en en-tête)",n0>=1&&/\/functions\/v1\/suivi-publier$/.test(posts[0].u)&&posts[0].h["x-admin-key"]==="CLE-ADMIN-TEST",JSON.stringify(posts[0]&&posts[0].u));
 const b0=posts[0]?posts[0].b:{},it=(b0.suivis||[])[0]||{};
 chk("SB-3","l'état publié contient l'étape, le prénom du livreur, l'arrivée estimée…, et AUCUN téléphone, code, clé de lien dans l'état, ni position figée",it.cle&&it.etat&&it.etat.n&&!("k" in it.etat)&&!("g" in it.etat)&&!("y" in it.etat)&&!/0[157]\d{8}|\+225\s?\d{8}/.test(JSON.stringify(it.etat).replace(/"w":"[^"]*"/,""))&&!/code|tel|mdp|pwd/i.test(JSON.stringify(it.etat)),JSON.stringify(it).slice(0,400));
 chk("SB-4","la référence de livraison est transmise au serveur (pour lire la position) mais pas dans l'état public",it.livraison_ref!==undefined&&!JSON.stringify(it.etat).includes(it.livraison_ref||"§"),JSON.stringify([it.livraison_ref]));
 chk("SB-5","la clé PUBLIQUE de signature est publiée avec l'état (EC P-256, sans partie privée)",Array.isArray(b0.cles)&&b0.cles.length>=1&&b0.cles[0].pub.kty==="EC"&&b0.cles[0].pub.crv==="P-256"&&!("d" in b0.cles[0].pub)&&!JSON.stringify(b0).includes('"d":'),JSON.stringify(b0.cles));
 await p.evaluate(()=>suiviPublierSur());await p.waitForTimeout(300);
 chk("SB-6","rien n'a changé : aucun nouvel envoi (pas de trafic inutile toutes les 15 s)",posts.length===n0,posts.length+" vs "+n0);
 await p.evaluate(()=>{const c=__c;c.hist=c.hist||[];c.hist.push({a:"en_cours",ts:new Date().toISOString()});c.adr.quartier=(c.adr.quartier||"")+" X";return suiviPublierSur()});await p.waitForTimeout(300);
 const dernier=posts[posts.length-1];
 chk("SB-7","un changement de la commande est republié, seule cette commande est envoyée",posts.length===n0+1&&dernier.b.suivis.length===1&&dernier.b.cles.length>=1&&dernier.b.suivis[0].etat.l.includes(" X"),JSON.stringify(dernier&&dernier.b.suivis&&dernier.b.suivis.length));
 mode="panne";await p.evaluate(()=>{__c.adr.quartier+="Y"});
 const e=await p.evaluate(async()=>{let thrown=false;try{await suiviPublierSur()}catch(x){thrown=true}return{thrown,err:_suiviErr}});
 chk("SB-8","serveur en panne : aucune exception (la passerelle continue), erreur gardée, nouvel essai au tour suivant",!e.thrown&&/panne/.test(e.err),JSON.stringify(e));
 mode="ok";const n1=posts.length;await p.evaluate(()=>suiviPublierSur());await p.waitForTimeout(300);
 chk("SB-9","retour du serveur : la modification en attente est publiée",posts.length===n1+1&&posts[posts.length-1].b.suivis[0].etat.l.includes("Y"),posts.length+"/"+n1);
 const r=await p.evaluate(async()=>{S.config.suivi_direct=false;const c=S.commandes.find(x=>x!==__c&&!["brouillon","annulee"].includes(x.statut));delete c.suivi_cle;const l=await suiviLienPortail(c);return{k:__dec(l).k||null,cle:c.suivi_cle||null}});
 await p.waitForTimeout(400);
 chk("SB-10","suivi en direct désactivé (S.config.suivi_direct = false) : lien sans clé, aucune clé créée, aucune publication",r.k===null&&r.cle===null&&posts.length===n1+1,JSON.stringify(r));
 const r2=await p.evaluate(async()=>{S.config.suivi_direct=true;S.config.passerelle_actif=false;const c=S.commandes.find(x=>x!==__c&&!["brouillon","annulee"].includes(x.statut));const l=await suiviLienPortail(c);return{k:__dec(l).k||null}});
 chk("SB-11","passerelle non configurée : lien classique (photo), sans clé de suivi direct",r2.k===null,JSON.stringify(r2));
 // test intégré depuis la fenêtre Passerelle
 const ouvrirPg=async()=>{await p.evaluate(()=>{ME=S.users.find(u=>u.role==="admin");S.config.passerelle_actif=true;pgInfo()});};
 const lancer=async()=>{await p.evaluate(()=>{document.querySelector('[data-act=suiviTest]').click()});await p.waitForTimeout(500);return p.evaluate(()=>document.getElementById("sv_test").innerText)};
 await ouvrirPg();let rt=await p.evaluate(()=>({btn:!!document.querySelector('[data-act=suiviTest]'),ligne:/Suivi en direct pour les clients/.test(document.querySelector(".ov, #modal").innerText)}));
 chk("SB-12","fenêtre Passerelle : ligne d'état « Suivi en direct pour les clients » et bouton « Tester le suivi en direct »",rt.btn&&rt.ligne,JSON.stringify(rt));
 let n2=posts.length;let tx=await lancer();
 chk("SB-13","test réussi : publication acceptée, lecture publique réussie, « fonctionne de bout en bout » ; le lien d'essai est publié comme terminé (sans effet sur les vraies commandes)",/Publication acceptée/.test(tx)&&/Lecture publique réussie/.test(tx)&&/fonctionne de bout en bout/.test(tx)&&posts.length===n2+1&&posts[posts.length-1].b.suivis[0].termine===true&&posts[posts.length-1].b.suivis[0].commande_ref==="test-suivi",tx);
 pubStatus=401;await ouvrirPg();tx=await lancer();
 chk("SB-14","clé d'administration refusée : message clair qui désigne la clé d'administration de la passerelle",/Publication refusée/.test(tx)&&/clé d'administration/i.test(tx)&&!/fonctionne de bout en bout/.test(tx),tx);
 pubStatus=404;await ouvrirPg();tx=await lancer();
 chk("SB-15","fonction non déployée (404) : message « la fonction suivi-publier n'est pas déployée »",/n'est pas déployée/.test(tx),tx);
 pubStatus=200;live="404";await ouvrirPg();tx=await lancer();
 chk("SB-16","publié mais illisible côté public : incohérence signalée (table ou fonction suivi-live)",/introuvable à la lecture/.test(tx)&&!/fonctionne de bout en bout/.test(tx),tx);
 console.log(errs.length?errs.join("\n"):"");console.log(`RÉSULTAT : ${ok} réussis, ${ko} échecs`);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
