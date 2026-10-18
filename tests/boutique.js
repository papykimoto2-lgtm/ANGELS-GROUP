/* Vente en ligne (Distributions) : boutique publique, import des commandes WhatsApp, paiement Mobile Money, droits.
   Usage : PLAYWRIGHT=/chemin/playwright [CHROMIUM=/chemin/chromium] node tests/boutique.js */
const {chromium}=require(process.env.PLAYWRIGHT||"playwright");
const http=require("http"),fs=require("fs"),path=require("path");const root=path.resolve(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u==="/")u="/index.html";const f=path.join(root,u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end("404")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));const base="http://127.0.0.1:"+srv.address().port;
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const ctx=await b.newContext({viewport:{width:480,height:900}}),errs=[];let ok=0,ko=0;
 const t=(id,l,r)=>{if(r===true){ok++;console.log("PASS",id,l)}else{ko++;console.log("FAIL",id,l,"→",r)}};
 const open=async u=>{const p=await ctx.newPage();p.on("pageerror",e=>errs.push(u.slice(0,40)+" : "+e.message));p.on("dialog",d=>d.accept());await p.goto(base+"/"+u);await p.waitForTimeout(400);return p};
 const st=await open("distribution.html");
 await st.evaluate(()=>{window.__T=[];toast=(m,k)=>{__T.push(m)};window.__as=r=>{ME=S.users.find(u=>u.role===r&&u.actif)};window.__last=()=>__T[__T.length-1]||"";window.__P=c=>S.produits.find(p=>p.code===c);
  __as("admin");__P("P-RIZ").en_ligne=true;__P("P-HUI").en_ligne=true;__P("P-EAU").en_ligne=true;__P("P-SAV").en_ligne=true;__P("P-SAV").stock=0;
  S.config.whatsapp="0707000000";S.config.momo_comptes=["Wave : 05 11 22 33 44","Orange Money : 07 99 88 77 66 (exemple à modifier)"];save()});
 const link=await st.evaluate(()=>boutLink());
 // 1. page publique
 const sh=await open("distribution.html#boutique="+link.split("#boutique=")[1]);
 const txt=await sh.$eval("#app",e=>e.innerText);
 t("WEB-1","la boutique n'affiche que les produits « vendus en ligne » (pas le sucre)",/Riz 25 kg/.test(txt)&&/Huile/.test(txt)&&!/Sucre/.test(txt)?true:txt.slice(0,200));
 t("WEB-2","produit en rupture : « Épuisé » et boutons désactivés",/Épuisé/.test(txt)&&await sh.$eval('[data-c="P-SAV"] [data-b="+"]',e=>e.disabled)?true:"non bloqué");
 t("WEB-3","aucun compte Mobile Money d'exemple publié ; le vrai compte l'est",await sh.evaluate(()=>{const m=document.getElementById("b_mm");return !!m&&/05 11 22 33 44/.test(m.innerText)&&!/07 99 88 77 66/.test(m.innerText)})?true:"comptes");
 const err=async()=>sh.$eval("#b_err",e=>e.style.display==="block"?e.textContent:"");
 await sh.click("#b_send");t("WEB-4","commande vide refusée",/au moins un produit/.test(await err())?true:await err());
 await sh.click('[data-c="P-RIZ"] [data-b="+"]');await sh.click('[data-c="P-RIZ"] [data-b="+"]');await sh.click('[data-c="P-EAU"] [data-b="+"]');
 await sh.fill("#b_nom","Awa Traoré");await sh.fill("#b_tel","0707123456");await sh.selectOption("#b_zone",{index:1});await sh.fill("#b_q","Riviera 2");
 const tot=await sh.$eval("#b_tot",e=>e.textContent.replace(/\D/g,""));
 t("WEB-5","total affiché = produits + frais de la zone",+tot===2*14500+1800+(await st.evaluate(()=>S.config.zones[0].frais))?true:tot);
 await sh.check("[name=b_pm][value=mm]");await sh.click("#b_send");t("WEB-6","Mobile Money sans référence refusé",/référence/.test(await err())?true:await err());
 await sh.fill("#b_rf","MP260101.1234.A5");await sh.click("#b_send");await sh.waitForSelector("#b_msg");
 const msg=await sh.$eval("#b_msg",e=>e.value);
 t("WEB-7","message WhatsApp structuré (lisible + marqueur importable) et lien wa.me vers le numéro de l'entreprise",/\[BOUTIQUE:[\w-]+\]/.test(msg)&&/2 x Riz 25 kg/.test(msg)&&/Mobile Money Wave — réf. MP260101\.1234\.A5/.test(msg)&&/wa\.me\/2250707000000/.test(await sh.$eval("#b_wa",e=>e.href))?true:msg.slice(0,300));
 // une 2e commande en espèces
 const sh2=await open("distribution.html#boutique="+link.split("#boutique=")[1]);
 await sh2.click('[data-c="P-HUI"] [data-b="+"]');await sh2.fill("#b_nom","Koné Ibrahim");await sh2.fill("#b_tel","0505987654");await sh2.selectOption("#b_zone",{index:2});await sh2.fill("#b_rep","Près du marché");await sh2.click("#b_send");await sh2.waitForSelector("#b_msg");
 const msg2=await sh2.$eval("#b_msg",e=>e.value);
 // 2. import côté bureau
 const imp=(role,txt)=>st.evaluate(([r,x])=>{__T.length=0;__as(r);view="vente_ligne";render();document.getElementById("wb_txt")&&(document.getElementById("wb_txt").value=x);ACT.webImport();return __last()},[role,txt]);
 const r1=await imp("commercial",msg+"\n\n"+msg2);
 t("WEB-8","import de 2 messages : 2 commandes créées",/2 commande\(s\) importée/.test(r1)?true:r1);
 const c1=await st.evaluate(()=>{const c=S.commandes.find(x=>x.web&&x.web.pm==="mm"),cl=S.clients.find(x=>x.id===c.client_id);return{canal:c.canal,statut:c.statut,total:c.total,frais:c.frais,l:c.lignes.map(l=>[prod(l.produit_id).code,l.qte,l.pu]),cl:cl.nom,tel:cl.tel,obs:c.obs,paiement:c.paiement,fonds:S.fonds.filter(f=>f.commande_id===c.id).length}});
 t("WEB-9","commande : canal « Vente en ligne », en attente de confirmation, lignes aux prix du catalogue, client créé, aucun encaissement avant vérification",
  c1.canal==="Vente en ligne"&&c1.statut==="attente"&&JSON.stringify(c1.l)===JSON.stringify([["P-RIZ",2,14500],["P-EAU",1,1800]])&&c1.total===30800+c1.frais&&c1.cl==="Awa Traoré"&&c1.fonds===0&&c1.paiement==="livraison"?true:JSON.stringify(c1));
 t("WEB-10","la référence Mobile Money figure dans les observations",/MP260101\.1234\.A5/.test(c1.obs)&&/à vérifier/.test(c1.obs)?true:c1.obs);
 // 3. contrôles à l'import
 const r2=await imp("admin",msg);t("WEB-11","même message importé deux fois : refusé (doublon)",/déjà importée/.test(r2)?true:r2);
 await st.evaluate(()=>{window.__fg=o=>"[BOUTIQUE:"+b64(Object.assign({f:"T"+Math.random().toString(36).slice(2,7),n:"Test Client",t:"0707000111",z:S.config.zones[0].nom,q:"Cocody",l:[["P-RIZ",1]],p:"e"},o))+"]"});
 const run=async(role,o)=>{const x=await st.evaluate(o=>__fg(o),o);return imp(role,x)};
 t("WEB-12","produit inconnu refusé",/produit inconnu/.test(await run("admin",{l:[["XXX",1]]}))?true:"accepté");
 t("WEB-13","zone inconnue refusée",/zone inconnue/.test(await run("admin",{z:"Atlantide"}))?true:"accepté");
 t("WEB-14","Mobile Money : même référence réutilisée refusée",/déjà utilisée/.test(await run("admin",{p:"m",op:"Wave",rf:"mp260101.1234.a5"}))?true:"accepté");
 const rt=await run("admin",{tt:1});
 t("WEB-15","total affiché falsifié : commande créée au vrai prix, écart signalé",/importée/.test(rt)&&/recalculé/.test(rt)?true:rt);
 const prix=await st.evaluate(()=>S.commandes[0].lignes[0].pu);t("WEB-16","le prix de la commande est celui du catalogue, jamais celui du message",prix===14500?true:prix);
 await st.evaluate(()=>{__P("P-RIZ").prix=15000});
 const rp=await run("admin",{});const pu2=await st.evaluate(()=>S.commandes[0].lignes[0].pu);t("WEB-17","prix modifié depuis la publication du lien : prix actuel appliqué",pu2===15000?true:pu2);
 await st.evaluate(()=>{__P("P-RIZ").prix=14500});
 // 4. droits et paiement Mobile Money
 t("WEB-18","le préparateur ne peut pas importer",/Droits insuffisants/.test(await run("preparateur",{}))?true:"autorisé");
 const pay=(role,act,id)=>st.evaluate(([r,a,i])=>{__T.length=0;__as(r);ACT[a](i);return __last()},[role,act,id]);
 const id1=await st.evaluate(()=>S.commandes.find(x=>x.web&&x.web.pm==="mm").id);
 t("WEB-19","le commercial ne peut pas valider un paiement Mobile Money",/Réservé/.test(await pay("commercial","webPayOk",id1))?true:"autorisé");
 await pay("caissier","webPayOk",id1);
 const v=await st.evaluate(id=>{const c=cmd(id);return{pay:c.web.pay,statut:c.statut,paiement:c.paiement,f:S.fonds.filter(f=>f.commande_id===id).map(f=>[f.type,f.montant,f.mode,f.ref]),du:paye(c)}},id1);
 t("WEB-20","paiement validé par le caissier : encaissement enregistré (montant total, opérateur, référence), commande confirmée",v.pay==="valide"&&v.statut==="confirmee"&&v.paiement==="avance"&&v.f.length===1&&v.f[0][0]==="acompte"&&v.f[0][2]==="Wave"&&v.f[0][3]==="MP260101.1234.A5"&&v.du===v.f[0][1]?true:JSON.stringify(v));
 await pay("caissier","webPayOk",id1);t("WEB-21","double validation sans effet (un seul encaissement)",(await st.evaluate(id=>S.fonds.filter(f=>f.commande_id===id).length,id1))===1?true:"doublon");
 await run("admin",{p:"m",op:"Orange Money",rf:"OM-998877"});const id2=await st.evaluate(()=>S.commandes.find(x=>x.web&&x.web.rf==="OM-998877").id);
 await pay("admin","webPayKo",id2);const k=await st.evaluate(id=>({p:cmd(id).web.pay,s:cmd(id).statut,f:S.fonds.filter(f=>f.commande_id===id).length}),id2);
 t("WEB-22","paiement non reçu : marqué rejeté, aucun encaissement, commande toujours en attente",k.p==="rejete"&&k.s==="attente"&&k.f===0?true:JSON.stringify(k));
 // 5. écrans
 const vw=await st.evaluate(()=>{__as("admin");view="vente_ligne";render();return document.getElementById("app").innerText});
 t("WEB-23","écran « Vente en ligne » : lien, import et tableau des commandes, sans NaN",/Copier le lien/.test(vw)&&/Importer/.test(vw)&&/CMD-/.test(vw)&&!/NaN|undefined/.test(vw)?true:vw.slice(0,200));
 const al=await st.evaluate(()=>{__as("admin");view="dashboard";render();return document.getElementById("app").innerText});
 t("WEB-24","tableau de bord : alerte « commande(s) de la boutique en ligne à confirmer »",/boutique en ligne à confirmer/.test(al)?true:"absente");
 const bad=await open("distribution.html#boutique=xxx");t("WEB-25","lien de boutique invalide : message clair",/invalide ou expiré/.test(await bad.$eval("#app",e=>e.innerText))?true:"pas de message");
 await sh.screenshot({path:process.env.SHOT||"/tmp/boutique.png"});
 console.log("\nRÉSULTAT :",ok,"réussis,",ko,"échecs");if(errs.length)console.log("Erreurs de page :",errs);await b.close();srv.close();process.exit(ko||errs.length?1:0);
})();
